# Authentication Architecture

> Tài liệu mô tả cơ chế xác thực giữa Wallet, Backend, và Hyperliquid API trong Gamma Trade.
>
> https://hyperliquid.gitbook.io/hyperliquid-docs/for-developers/api/nonces-and-api-wallets

## Tổng quan

Gamma Trade sử dụng mô hình **non-custodial** với 3 lớp xác thực:

1. **Wallet Auth** — Xác thực user bằng EIP-191 Personal Sign
2. **Agent Wallet** — Ủy quyền trading bằng EIP-712 Typed Data (Hyperliquid approveAgent)
3. **Trading Execution** — Bot tự ký lệnh bằng agent private key (server-side)

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│                        AUTHENTICATION LAYERS                                     │
└──────────────────────────────────────────────────────────────────────────────────┘

 ┌─────────────┐           ┌──────────────────┐           ┌──────────────────────┐
 │   Browser   │           │  Backend (Fast   │           │   Hyperliquid API    │
 │  (MetaMask) │           │    API Server)   │           │                      │
 └──────┬──────┘           └────────┬─────────┘           └────────────┬─────────┘
        │                           │                                  │
        │  LAYER 1: Wallet Auth     │                                  │
        │  (EIP-191 Personal Sign)  │                                  │
        │                           │                                  │
        │  LAYER 2: Agent Wallet    │                                  │
        │  (EIP-712 Typed Data)     │                                  │
        │                           │   LAYER 3: Trading Execution     │
        │                           │   (Agent private key signs)      │
        │                           │─────────────────────────────────►│
        └───────────────────────────┴──────────────────────────────────┘
```

---

## Layer 1: Wallet Authentication (Session)

### Mục đích

Xác thực user cho tất cả API calls tới backend. Không sử dụng username/password — thay vào đó dùng chữ ký cryptographic từ MetaMask.

### Flow

```
Browser                          Backend                         Redis
───────                          ───────                         ─────
   │                                │                              │
   │  GET /wallet/nonce?address=0x..│                              │
   │───────────────────────────────►│  generate nonce              │
   │                                │─────────────────────────────►│ SET wallet_nonce:0x... TTL=24h
   │◄───────────────────────────────│                              │
   │  {nonce, message}              │                              │
   │                                │                              │
   │  [MetaMask: personal_sign(message)]                           │
   │                                │                              │
   │  ALL subsequent requests include headers:                     │
   │  X-Wallet-Address: 0x...       │                              │
   │  X-Wallet-Nonce: abc123        │                              │
   │  X-Wallet-Signature: 0x...     │                              │
   │───────────────────────────────►│                              │
   │                                │  1. Verify nonce in Redis    │
   │                                │─────────────────────────────►│ GET wallet_nonce:0x...
   │                                │◄─────────────────────────────│
   │                                │  2. EIP-191 recover address  │
   │                                │  3. Compare recovered == header address
   │                                │  4. Lookup/create User in DB │
   │                                │                              │
   │◄───────────────────────────────│  request.state.user = User   │
```

### Chi tiết kỹ thuật

| Component             | Detail                                                                    |
| --------------------- | ------------------------------------------------------------------------- |
| **Chuẩn chữ ký**      | EIP-191 Personal Sign                                                     |
| **Message format**    | `"Sign this message to authenticate with Gamma Trade.\n\nNonce: {nonce}"` |
| **Nonce storage**     | Redis, key=`wallet_nonce:{address}`, TTL=24h                              |
| **Nonce reusability** | Reusable trong TTL (không consume sau mỗi request)                        |
| **Middleware**        | `app/middleware/wallet_auth.py` → `WalletAuthMiddleware`                  |
| **Recovery**          | `eth_account.Account.recover_message()`                                   |
| **Auto-create**       | User record tự động tạo lần đầu connect                                   |

### Code references

- `app/services/wallet_auth.py` — Nonce generation, EIP-191 verify
- `app/middleware/wallet_auth.py` — Request middleware
- `app/api/routes/wallet.py` — `/wallet/nonce`, `/wallet/disconnect`
- `ui/components/wallet_connect.py` — Frontend component

---

## Layer 2: Agent Wallet (Hyperliquid Delegation)

### Mục đích

Tạo một "agent wallet" — keypair phụ được Hyperliquid on-chain authorize để trade thay mặt master wallet. User ký 1 lần, sau đó bot có thể tự trade mà không cần user approve từng lệnh.

### Flow

```
Browser                    Backend                        Hyperliquid
───────                    ───────                        ───────────
   │                          │                               │
   │ POST /agent/create       │                               │
   │  {label, spending_limit} │                               │
   │─────────────────────────►│                               │
   │                          │  1. Generate new keypair      │
   │                          │  2. Build EIP-712 sign_payload│
   │                          │  3. Store pending in Redis    │
   │                          │     (TTL=10 min)              │
   │◄─────────────────────────│                               │
   │  {agent_address,         │                               │
   │   sign_payload}          │                               │
   │                          │                               │
   │  [MetaMask: eth_signTypedData_v4(sign_payload)]          │
   │                          │                               │
   │ POST /agent/confirm      │                               │
   │  {wallet_address,        │                               │
   │   agent_address,         │                               │
   │   signature, nonce}      │                               │
   │─────────────────────────►│                               │
   │                          │  4. Build HL request body     │
   │                          │  5. Forward to Hyperliquid    │
   │                          │──────────────────────────────►│
   │                          │  POST /exchange               │
   │                          │  {action: "approveAgent",     │
   │                          │   agentAddress, signature}    │
   │                          │                               │
   │                          │◄──────────────────────────────│
   │                          │  {status: "ok"}               │
   │                          │                               │
   │                          │  6. Persist AgentSession      │
   │                          │  7. Encrypt private key       │
   │                          │  8. Delete pending from Redis │
   │◄─────────────────────────│                               │
   │  {id, agent_address,     │                               │
   │   is_active: true}       │                               │
```

### EIP-712 Typed Data Structure

```json
{
  "types": {
    "EIP712Domain": [
      { "name": "name", "type": "string" },
      { "name": "version", "type": "string" },
      { "name": "chainId", "type": "uint256" },
      { "name": "verifyingContract", "type": "address" }
    ],
    "HyperliquidTransaction:ApproveAgent": [
      { "name": "hyperliquidChain", "type": "string" },
      { "name": "agentAddress", "type": "address" },
      { "name": "agentName", "type": "string" },
      { "name": "nonce", "type": "uint64" }
    ]
  },
  "primaryType": "HyperliquidTransaction:ApproveAgent",
  "domain": {
    "name": "HyperliquidSignTransaction",
    "version": "1",
    "chainId": 42161,
    "verifyingContract": "0x0000000000000000000000000000000000000000"
  },
  "message": {
    "hyperliquidChain": "Mainnet",
    "agentAddress": "0x...(generated agent address)",
    "agentName": "My Agent",
    "nonce": 1716100000000
  }
}
```

### Agent Revocation

Revoke agent bằng cách gửi `approveAgent` với `agentAddress = 0x000...000`:

```
Browser                    Backend                        Hyperliquid
───────                    ───────                        ───────────
   │                          │                               │
   │ GET /agent/{id}/revoke-payload                           │
   │─────────────────────────►│                               │
   │◄─────────────────────────│                               │
   │  {sign_payload with      │                               │
   │   agentAddress=0x000...} │                               │
   │                          │                               │
   │  [MetaMask: eth_signTypedData_v4]                        │
   │                          │                               │
   │ POST /agent/{id}/revoke  │                               │
   │  {wallet_address, nonce, │                               │
   │   signature}             │                               │
   │─────────────────────────►│──────────────────────────────►│
   │                          │  POST /exchange               │
   │                          │  approveAgent(0x000...)       │
   │                          │◄──────────────────────────────│
   │                          │  {status: "ok"}               │
   │                          │                               │
   │                          │  Mark DB: is_active=False     │
   │◄─────────────────────────│                               │
```

### Chi tiết kỹ thuật

| Component            | Detail                                            |
| -------------------- | ------------------------------------------------- |
| **Chuẩn chữ ký**     | EIP-712 Typed Data (eth_signTypedData_v4)         |
| **Chain ID**         | 42161 (Arbitrum One)                              |
| **signatureChainId** | `0xa4b1` (42161) — trong POST body                |
| **Pending state**    | Redis, TTL=10 phút                                |
| **Key storage**      | PostgreSQL `agent_sessions.encrypted_private_key` |
| **Encryption**       | Fernet (derived từ `CREDENTIALS_ENCRYPTION_KEY`)  |
| **Spending limit**   | Daily limit, auto-reset mỗi 24h                   |

### Code references

- `app/services/agent_wallet.py` — Core agent logic, EIP-712 helpers
- `app/api/routes/agent.py` — All agent endpoints
- `app/services/crypto.py` — Fernet encrypt/decrypt
- `ui/components/agent_approve.py` — Frontend EIP-712 signing component
- `ui/pages/wallet_settings.py` — Agent management UI

---

## Layer 3: Trading Execution (Bot → Hyperliquid)

### Mục đích

Gamma Trade sử dụng agent private key để tự ký và gửi lệnh trade tới Hyperliquid mà không cần user confirm từng lệnh.

### Flow

```
Gamma Trade              Backend (hyperliquid)           Hyperliquid API
─────────────              ──────────────────           ───────────────
      │                           │                          │
      │  create_order(...)        │                          │
      │──────────────────────────►│                          │
      │                           │  1. Build order action   │
      │                           │  2. Sign EIP-712 with    │
      │                           │     privateKey (agent)   │
      │                           │  3. POST /exchange       │
      │                           │─────────────────────────►│
      │                           │  {action: "order",       │
      │                           │   signature: {...},      │
      │                           │   nonce, vaultAddress}   │
      │                           │                          │
      │                           │◄─────────────────────────│
      │◄──────────────────────────│  {status: "ok", ...}     │
      │  order result             │                          │
```

### Config injection

Khi tạo/start bot, backend build config:

```python
# Nếu user có active agent + exchange là Hyperliquid:
is_hl_agent = True

config = {
    "exchange": {
        "name": "hyperliquid",
        "key": "",                    # ← Trống (không dùng API key)
        "secret": "",                 # ← Trống
        "walletAddress": "0x...",     # ← Master wallet address
        "privateKey": "abcdef...",    # ← Agent private key (decrypted)
    }
}
```

Backend nhận config này và tự động sử dụng `walletAddress` + `privateKey` cho tất cả requests.

### Spending Limit Guard

```
Trade Signal → pre_trade_guard.validate_trade_entry()
                    │
                    ├── Lookup BotInstance → user_id
                    ├── Lookup active AgentSession
                    ├── Check spending_limit_usd
                    │     ├── Reset daily counter nếu > 24h
                    │     ├── remaining = limit - spent_today
                    │     └── trade_amount > remaining → BLOCK
                    │
                    ├── ALLOWED → Bot executes trade
                    └── BLOCKED → Trade rejected
```

### Code references

- `app/services/freqtrade_manager.py:_try_load_agent_key()` — Load & decrypt agent key
- `app/services/freqtrade_manager.py:build_freqtrade_config()` — Inject key vào config
- `freqtrade/exchange/exchange.py:_init_Backend()` — Pass walletAddress/privateKey to Backend
- `freqtrade/exchange/hyperliquid.py` — Hyperliquid-specific exchange class
- `app/services/pre_trade_guard.py` — Spending limit enforcement

---

## Hyperliquid API Map

### Endpoints sử dụng

| Endpoint                               | Method | Mục đích                               | Auth                       |
| -------------------------------------- | ------ | -------------------------------------- | -------------------------- |
| `https://api.hyperliquid.xyz/exchange` | POST   | Write actions (trade, approve, revoke) | EIP-712 signature required |
| `https://api.hyperliquid.xyz/info`     | POST   | Read queries (market data, agent list) | Không cần auth             |

### API calls forwarded qua Backend

Các requests mà Backend đóng vai trò **proxy** — nhận signature từ frontend và forward lên Hyperliquid:

| Backend Route                 | HL Endpoint | Action                              | Ai ký?                       |
| ----------------------------- | ----------- | ----------------------------------- | ---------------------------- |
| `POST /agent/confirm`         | `/exchange` | `approveAgent` (tạo mới)            | User ký EIP-712 via MetaMask |
| `POST /agent/{id}/revoke`     | `/exchange` | `approveAgent` (zero addr = revoke) | User ký EIP-712 via MetaMask |
| `POST /agent/external-revoke` | `/exchange` | `approveAgent` (zero addr)          | User ký EIP-712 via MetaMask |

### API calls trực tiếp từ Backend (không qua user)

| Caller                           | HL Endpoint | Action                     | Ai ký?                          |
| -------------------------------- | ----------- | -------------------------- | ------------------------------- |
| `GET /agent/hyperliquid-wallets` | `/info`     | `extraAgents` query        | Không cần ký (read-only)        |
| Gamma Trade (trading)            | `/exchange` | `order`, `cancel`, etc.    | Agent private key (server-side) |
| Agent self-revoke                | `/exchange` | `approveAgent` (zero addr) | Agent private key (server-side) |
| Market data sync                 | `/info`     | OHLCV, L2Book queries      | Không cần ký (read-only)        |

---

## Complete Auth Flow: Wallet ↔ Backend ↔ Hyperliquid

### Phase 1: Wallet Connect (one-time per session)

```
Browser                           Backend                        Hyperliquid
   |                                 |                               |
   |  GET /wallet/nonce?addr=0x..    |                               |
   |  =============================> |                               |
   |                                 |                               |
   |  {nonce, message}               |                               |
   |  <============================= |                               |
   |                                 |                               |
   |  personal_sign(message)         |                               |
   |  => signature                   |                               |
   |                                 |                               |
```

### Phase 2: Authenticated API Calls (every request)

```
Browser                           Backend                        Hyperliquid
   |                                 |                               |
   |  ANY REQUEST + headers:         |                               |
   |    X-Wallet-Address: 0x...      |                               |
   |    X-Wallet-Nonce: ...          |                               |
   |    X-Wallet-Signature: 0x...    |                               |
   |  =============================> |                               |
   |                                 |  verify nonce (Redis)         |
   |                                 |  EIP-191 recover address      |
   |                                 |  lookup/create User           |
   |  Response                       |                               |
   |  <============================= |                               |
   |                                 |                               |
```

### Phase 3: Agent Creation (one-time)

```
Browser                           Backend                        Hyperliquid
   |                                 |                               |
   |  POST /agent/create             |                               |
   |  {label, spending_limit}        |                               |
   |  =============================> |                               |
   |                                 |  generate keypair             |
   |                                 |  build EIP-712 payload        |
   |  {agent_address, sign_payload}  |                               |
   |  <============================= |                               |
   |                                 |                               |
   |  eth_signTypedData_v4(payload)  |                               |
   |  => signature                   |                               |
   |                                 |                               |
   |  POST /agent/confirm            |                               |
   |  {wallet, agent, sig, nonce}    |                               |
   |  =============================> |                               |
   |                                 |  build request body           |
   |                                 |  split sig => r, s, v         |
   |                                 |                               |
   |                                 |  POST /exchange  [FORWARD]    |
   |                                 |  {action:"approveAgent",...}  |
   |                                 |  =============================>
   |                                 |                               |
   |                                 |  {status: "ok"}               |
   |                                 |  <=============================
   |                                 |                               |
   |                                 |  persist AgentSession (DB)    |
   |  {id, agent_address, active}    |                               |
   |  <============================= |                               |
   |                                 |                               |
```

### Phase 4: Agent Revoke

```
Browser                           Backend                        Hyperliquid
   |                                 |                               |
   |  GET /agent/{id}/revoke-payload |                               |
   |  =============================> |                               |
   |  {sign_payload (addr=0x000)}    |                               |
   |  <============================= |                               |
   |                                 |                               |
   |  eth_signTypedData_v4(payload)  |                               |
   |  => signature                   |                               |
   |                                 |                               |
   |  POST /agent/{id}/revoke        |                               |
   |  {wallet, nonce, signature}     |                               |
   |  =============================> |                               |
   |                                 |  POST /exchange  [FORWARD]    |
   |                                 |  approveAgent(0x000...000)    |
   |                                 |  =============================>
   |                                 |  {status: "ok"}               |
   |                                 |  <=============================
   |                                 |  mark DB: is_active=False     |
   |  {status: "revoked"}            |                               |
   |  <============================= |                               |
   |                                 |                               |
```

### Phase 5: Bot Trading (automated, no user action)

```
Browser                           Backend                        Hyperliquid
   |                                 |                               |
   |                                 |  Bot start:                   |
   |                                 |  decrypt agent_private_key    |
   |                                 |  inject walletAddress +       |
   |                                 |    privateKey into config     |
   |                                 |                               |
   |                                 |  Trade signal => Backend signs|
   |                                 |  with agent key (EIP-712)     |
   |                                 |                               |
   |                                 |  POST /exchange               |
   |                                 |  {action:"order", sig:{r,s,v}}|
   |                                 |  =============================>
   |                                 |  {status:"ok", order_id}      |
   |                                 |  <=============================
   |                                 |                               |
   |                                 |  record spending (DB)         |
   |                                 |                               |
```

### Tóm tắt

| Phase        | Action                                 | Auth method                     |
| ------------ | -------------------------------------- | ------------------------------- |
| Connect      | Lấy nonce + ký message                 | EIP-191 personal_sign           |
| API calls    | Gửi headers mỗi request                | Nonce + Signature verify        |
| Agent create | Ký EIP-712, backend **forward** lên HL | User signs, backend forwards    |
| Agent revoke | Ký EIP-712, backend **forward** lên HL | User signs, backend forwards    |
| Trading      | Bot tự ký mỗi lệnh                     | Agent private key (server-side) |

### Phân loại requests tới Hyperliquid

| Loại        | Route                   | Hyperliquid Action         | Ai ký?             |
| ----------- | ----------------------- | -------------------------- | ------------------ |
| **FORWARD** | POST /agent/confirm     | approveAgent               | User (MetaMask)    |
| **FORWARD** | POST /agent/{id}/revoke | approveAgent (zero addr)   | User (MetaMask)    |
| **FORWARD** | POST /agent/ext-revoke  | approveAgent (zero addr)   | User (MetaMask)    |
| **SERVER**  | Bot trading             | order, cancel, modify      | Agent key (server) |
| **SERVER**  | Agent self-revoke       | approveAgent (zero addr)   | Agent key (server) |
| **READ**    | GET /agent/hl-wallets   | POST /info extraAgents     | Không cần          |
| **READ**    | Market data sync        | POST /info (OHLCV, L2Book) | Không cần          |

---

## Security Considerations

### Key Protection

- Agent private key encrypted bằng **Fernet** (AES-128-CBC + HMAC-SHA256)
- Encryption key: env `CREDENTIALS_ENCRYPTION_KEY` (fallback `JWT_SECRET_KEY`)
- Key chỉ decrypt khi build config (bot create/start)
- Key tồn tại dạng plaintext trong config file trên disk khi bot running

### Non-custodial Guarantees

- Backend **KHÔNG BAO GIỜ** có master wallet private key
- User giữ toàn quyền revoke agent bất kỳ lúc nào
- Agent key chỉ trade được — không thể withdraw funds từ Hyperliquid
- Spending limit là lớp bảo vệ thêm phía server (Hyperliquid không enforce)
