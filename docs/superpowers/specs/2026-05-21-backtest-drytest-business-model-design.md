# Backtest + Drytest — Business Model Design

> Spec định nghĩa cách monetize stack Backtest + Drytest, các tier subscription, và stream doanh thu phụ.
> Draft 1 — 2026-05-21. Brainstorm session với Tri.

---

## 0. Assumptions (anh override nếu sai)

Spec viết dựa trên các giả định em đã propose trong brainstorm — anh chốt lại trước khi đi sâu hơn:

| #   | Assumption                                                                                                                                | Status                     |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------- | -------------------------- |
| A1  | **Drytest là feature riêng**, không phải mode của live bot. UI riêng, quota riêng. (Brainstorm câu 3, option B em recommend)              | 🟡 chờ anh chốt            |
| A2  | Subscription model + recurring revenue là core, không phải one-time payment                                                               | 🟡 chờ anh chốt            |
| A3  | Stripe (hoặc tương đương) sẽ wire-up cho payment — chưa có, sẽ là task riêng                                                              | 🟡 chờ anh chốt            |
| A4  | Marketplace + Verified badge là roadmap **sau** MVP backtest/drytest, không phải v1                                                       | 🟡 chờ anh chốt            |
| A5  | Coin98 audience target: retail trader VN + SEA, 80% mobile, sẵn pay $5-15/m cho tool tốt                                                  | 🟡 cần research thị trường |
| A6  | BE đã support `dry_run: true` flag (đã verify trong UnifiedBotStrategyCreate). Drytest UI mới chỉ cần BE thêm filter `/bot/list?mode=dry` | ✅ confirmed via openapi   |

---

## 1. Mục tiêu (Goal)

**Primary:** Monetize stack Backtest + Drytest, biến từ "feature có sẵn" thành "engine doanh thu".

**Secondary:**

- Funnel free → paid với conversion ≥ 5% (industry baseline cho freemium SaaS)
- Tạo foundation cho marketplace sau — backtest/drytest result là social proof
- Differentiator vs 3Commas/Pionex/Cryptohopper

**Non-goals (out of scope spec này):**

- Stripe integration code
- Marketplace UI/UX (phase 3+)
- Performance fee accounting infrastructure (phase 3+)
- B2B API gating

---

## 2. Personas (3 nhóm chính)

### 2.1. Free Explorer

- Crypto curious, chưa từng dùng bot
- Vào explore xem có lãi không, không bỏ tiền
- Behavior: tạo 1-2 bot test, run vài backtest, quit hoặc upgrade
- **Conversion driver:** backtest 7d ra kết quả tốt → muốn test 365d → paywall

### 2.2. Pro Retail Trader (target chính)

- Trade crypto 6-24 tháng, có vốn $1k-$50k
- Đã thử Pionex/3Commas, không thỏa mãn UX
- Sẵn pay $9-15/m cho tool tốt hơn
- Behavior: 10-20 backtest/tháng, 2-3 drytest concurrent, 1-3 live bot
- **Conversion driver:** marketplace + verified strategy + advanced analytics

### 2.3. Power User / Pre-fund (5-10% user, ~50% revenue tiềm năng)

- Trade pro / quant junior / fund nhỏ
- Muốn API access, parallel backtest, custom integrations
- Sẵn pay $15-50/m hoặc share PnL
- **Conversion driver:** Max tier + perf fee tier + BaaS API

---

## 3. 3-tier validation journey

Mọi business model em đề xuất dựa trên journey này — đây là "rail" cho user và cho monetize point:

```
┌─────────────┐    ┌──────────────┐    ┌──────────────┐
│  Backtest   │ →  │   Drytest    │ →  │  Live Bot    │
│ historical  │    │  live paper  │    │  real money  │
└─────────────┘    └──────────────┘    └──────────────┘
   (cheap)            (medium)           (expensive)

Free 7d              Free 1 × 7d         Free 0
Pro 365d             Pro 3 concurrent    Pro 1
Max + tick           Max 10 concurrent   Max 5
```

**Monetize point mỗi tier:**

- Backtest: history depth, run frequency, advanced analytics, parallel runs
- Drytest: concurrency, duration cap, instant-start (vs queue)
- Live: số bot, perf fee, custom integrations

---

## 4. Pricing tiers (recommended)

> Số liệu pricing là **placeholder hợp lý** — cần A/B test thực tế. Em research comp ở §10.

### 4.1. Tier matrix

| Tier            | Giá          | Backtest                                     | Drytest                                  | Live       | Khác                                                                |
| --------------- | ------------ | -------------------------------------------- | ---------------------------------------- | ---------- | ------------------------------------------------------------------- |
| **Free**        | $0           | 7d history, 5 runs/m, 1 cặp/lúc              | 1 drytest concurrent, max 7d duration    | 0 bot live | Watermark "Powered by C98" trên export, ads Cypheus                 |
| **Pro**         | **$9 / m**   | 365d history, unlimited runs, 3 cặp parallel | 3 drytest concurrent, unlimited duration | 1 bot live | Export logs JSON, no watermark, basic Cypheus AI                    |
| **Max**         | **$15 / m**  | 365d + intraday tick data, 10 cặp parallel   | 10 drytest concurrent                    | 5 bot live | API access, custom Telegram bot, priority support, advanced Cypheus |
| **Pay-per-run** | **$1 / run** | 1Y backtest one-shot (không subscription)    | —                                        | —          | Cho user occasional, không commit sub                               |

### 4.2. Lý do gating cụ thể

| Limit Free           | Lý do BE/UX                                                           |
| -------------------- | --------------------------------------------------------------------- |
| 7d history           | BE storage cheap (OHLCV 7d cho 100 pair < 50MB). 1Y data đắt hơn 50x. |
| 5 runs/m             | Backtest 1Y CPU ≈ 30s-2min. 5 run/user = manageable load.             |
| 1 drytest concurrent | Mỗi drytest = 1 process Freqtrade chạy 24/7. Đắt.                     |
| Max 7d drytest       | Force user chuyển sang Pro nếu muốn validate dài.                     |
| 0 bot live           | Live bot ăn tiền thật → must verify user serious (pay) trước.         |

### 4.3. Yearly pricing (đề xuất bổ sung)

|     | Monthly | Yearly             | Discount |
| --- | ------- | ------------------ | -------- |
| Pro | $9/m    | **$84/y** ($7/m)   | 22% off  |
| Max | $15/m   | **$144/y** ($12/m) | 20% off  |

Yearly giúp cashflow predictable + giảm churn.

---

## 5. Doanh thu streams (5 streams + dependencies)

### 5.1. Stream 1: Subscription (core, MVP)

**Mục tiêu:** $5-15K MRR sau 6 tháng (cần 500-1500 paid user)

- Free → Pro: target conversion 5-8%
- Pro → Max: target conversion 15-20% (Pro user)

**Dependency:** Stripe + tier enforcement BE-side.

### 5.2. Stream 2: Strategy Marketplace ⭐ (highest potential)

**Mục tiêu:** Sau MVP — phase 3.

- User publish strategy → set price $5-50/copy hoặc 5-10% PnL share của buyer
- Platform commission **20-30%** trên mỗi transaction
- **Backtest result + Drytest track record** là social proof bán hàng
- Built-in trust gate: chỉ Pro+ user mới được publish

**Vì sao đây là biggest bet:**

1. Network effect — strategy hay attract user, user attract publisher
2. Marginal cost ~0 (BE chỉ host strategy file)
3. Recurring revenue qua commission, không qua sub
4. Locks user vào ecosystem (strategy mua xong khó migrate)

**Dependency:** Marketplace UI, payment, strategy escrow, dispute resolution. Lớn — phase 3.

### 5.3. Stream 3: "Verified PnL" badge ($5/strategy/month)

**Mục tiêu:** Recurring per-strategy revenue + signal cho marketplace.

- Strategy chạy drytest **≥ 30 ngày** (auto-tracked) + đạt threshold:
  - PnL > 0
  - MDD < 20%
  - Trade count ≥ 30
- → Earn "Verified" badge trên marketplace
- Trả $5/m/strategy để giữ badge (mất badge nếu performance drop)

**Vì sao work:**

- Strategy author muốn badge để bán giá cao hơn
- Buyer thấy badge → tin tưởng → mua nhiều hơn
- Win-win: platform thu phí author + commission buyer

**Dependency:** Drytest infrastructure (đã có), badge logic BE, performance monitoring.

### 5.4. Stream 4: Performance fee tier (no-subscription)

**Mục tiêu:** Capture power user không thích sub fee.

- $0/m subscription, nhưng **10-15% share PnL** trên live bot
- Chỉ available cho user verify identity + connect Coin98 wallet
- BE đã track lifetime PnL → enforce dễ

**Vì sao work:**

- User lớn không tin fixed fee (sợ phí > value)
- Sẵn share lãi vì "không lãi không trả"
- Aligned incentive: platform có động lực giúp user lãi

**Dependency:** Accurate PnL accounting, withdrawal hook, compliance check.

### 5.5. Stream 5: Cypheus AI optimization ($0.50/suggestion hoặc Pro+ unlimited)

**Mục tiêu:** Tận dụng Cypheus đã có làm differentiator.

- Cypheus phân tích backtest result → suggest param tweak (e.g., "tăng RSI period từ 14 → 21, MDD giảm 30%")
- $0.50/suggestion (one-off) hoặc include trong Pro
- Hoặc bán bundle "10 suggestions" $4

**Dependency:** Cypheus đã scripted demo → cần thực sự AI behind (phase sau).

### 5.6. Stream 6: B2B Backtest-as-a-Service (niche, phase 3+)

**Mục tiêu:** Niche nhưng margin cao.

- API access cho fund nhỏ / quant trader chạy backtest batch
- $99-499/m cho parallel runs, throughput cao, raw data export

**Dependency:** API gating, rate limit, billing.

---

## 6. Funnel & conversion mechanics

### 6.1. Entry points (free user)

1. Landing page → "Try free backtest" CTA
2. Templates page → "Backtest this strategy" → free 7d auto-run
3. Builder canvas → "Backtest" button luôn enabled (free vẫn dùng được)

### 6.2. Paywall placements (3 chỗ)

**Placement 1 — Date range chip disabled (Backtest1 Figma)**

- User chọn 30d/90d/1Y chips → grayed out với badge "PRO"
- Click → upgrade modal ngay tại đó
- **Friction:** thấp (paywall ở chỗ user đã muốn action)

**Placement 2 — After free run (recommended bổ sung)**

- User run 7d backtest free → result hiển thị OK
- Banner ở result view: "Run này có 32 trades. Test 1 năm có thể ra 380 trades — unlock với Pro"
- **Friction:** thấp (paywall sau khi user thấy giá trị)

**Placement 3 — Drytest start**

- Free user click "Start drytest" → modal "Free: max 7 days. Pro: unlimited."
- **Friction:** trung bình (chấp nhận được vì drytest = commitment higher)

### 6.3. Upgrade triggers (in-app prompt)

| Trigger                                    | Prompt                                                 |
| ------------------------------------------ | ------------------------------------------------------ |
| User chạy 4/5 free backtest tháng này      | Banner "1 run left this month. Upgrade for unlimited." |
| Free user xem strategy template "advanced" | Tooltip "Pro feature"                                  |
| Drytest free hết 7 ngày auto-stop          | Email + in-app: "Drytest paused. Resume with Pro."     |
| Backtest result PnL > 50%                  | Banner "Run này lãi 52%. Validate live → Pro Drytest." |

### 6.4. Retention mechanics (sau khi paid)

- Cypheus suggestion weekly: "Your bot có thể tốt hơn 20% với 1 tweak — xem?"
- Telegram alerts ngày: P&L, win rate, suggestions
- Monthly performance report email

---

## 7. Pricing positioning vs comp

### 7.1. Competitor pricing table

|                       | Free tier              | Entry paid       | Top tier        | Notes                               |
| --------------------- | ---------------------- | ---------------- | --------------- | ----------------------------------- |
| **3Commas**           | Limited                | $19/m (Pro)      | $49/m (Expert)  | Old UI, complex                     |
| **Pionex**            | Free + 0.05% trade fee | —                | —               | Fee-based, không sub                |
| **Cryptohopper**      | 7 days trial           | $19/m (Explorer) | $99/m (Hero)    | Mạnh marketplace                    |
| **Bitsgap**           | 7 days trial           | $24/m (Basic)    | $110/m (Pro)    | Strong arbitrage                    |
| **Mizar**             | Free                   | $14.95/m (Pro)   | $39/m (Pro+)    | Hybrid copy + DIY                   |
| **🎯 Coin98 đề xuất** | **Free always**        | **$9/m (Pro)**   | **$15/m (Max)** | Aggressive pricing, retail-friendly |

### 7.2. Positioning

**Coin98 strategy:** "More affordable than 3Commas, less complex than Cryptohopper, better backtest than Pionex."

- $9 < competitor entry $14-24 → user chọn thử
- $15 Max < competitor mid $39-49 → giữ user
- Free tier always (không 7-day trial) → reduce barrier

**Tradeoff:** Lower ARPU, but volume play. Cần 1000+ paid user để bằng 200 user $49/m.

---

## 8. Free tier limits — chi tiết per feature

### 8.1. Backtest (Free)

- ✅ Tạo unlimited strategies
- ✅ Run backtest 7d window
- ✅ 5 runs/month (counted across all strategies)
- ✅ View all 15 metrics + chart
- ✅ Export logs CSV (with watermark)
- ❌ History > 7d
- ❌ Parallel runs (sequential only)
- ❌ Intraday tick data
- ❌ Compare 2 runs side-by-side

### 8.2. Drytest (Free)

- ✅ 1 drytest concurrent
- ✅ Max 7 days duration (auto-stop)
- ✅ Real-time P&L tracking
- ✅ Telegram notification cơ bản (1/day)
- ❌ More than 1 concurrent
- ❌ Duration > 7d
- ❌ Custom alerts

### 8.3. Live bot (Free)

- ❌ Không cho deploy live
- Force upgrade Pro để live

---

## 9. Pro tier ($9/m) — chi tiết

### 9.1. Backtest (Pro)

- ✅ All Free features
- ✅ 365 days history
- ✅ Unlimited runs
- ✅ 3 parallel runs
- ✅ Export logs JSON (no watermark)
- ✅ Compare 2 runs side-by-side

### 9.2. Drytest (Pro)

- ✅ 3 drytests concurrent
- ✅ Unlimited duration
- ✅ Custom Telegram alerts
- ✅ Performance email weekly

### 9.3. Live bot (Pro)

- ✅ 1 bot live
- ✅ Real-time monitoring
- ✅ Basic stop-loss insurance ($100 cap)

### 9.4. Khác

- ✅ Cypheus AI suggestions (5/month)
- ✅ Priority queue cho backtest (jumps free user queue)

---

## 10. Max tier ($15/m) — chi tiết

### 10.1. Backtest (Max)

- ✅ All Pro features
- ✅ Intraday tick data (1m, 5m, 15m granularity)
- ✅ 10 parallel runs
- ✅ Advanced analytics: Sortino, Calmar, Sharpe by month
- ✅ Compare 5 runs side-by-side
- ✅ A/B test mode (split test 2 params)

### 10.2. Drytest (Max)

- ✅ 10 drytests concurrent
- ✅ Custom webhook alerts (Discord, Slack, generic)
- ✅ Real-time WebSocket data feed

### 10.3. Live bot (Max)

- ✅ 5 bots live
- ✅ Advanced risk management (cross-bot SL)
- ✅ Multi-exchange (sẵn sàng khi BE support thêm Binance/Bybit; hiện tại chỉ Hyperliquid)

### 10.4. Khác

- ✅ Cypheus AI unlimited
- ✅ API access (read backtest, run backtest, list bots)
- ✅ Priority support (response < 4h)
- ✅ Custom Telegram bot branding

---

## 11. Pay-per-run model ($1/run)

**Mục đích:** Capture user không commit sub.

**Mechanism:**

- Free user thấy "1Y backtest? $1 one-time"
- Pay via wallet (Coin98 wallet integration đã có)
- Run xong → result hiển thị, export OK
- Không recurring, không feature lock

**Dự kiến volume:** 10-20% Free user sẽ pay-per-run ít nhất 1 lần → quick win.

---

## 12. Marketplace concept (phase 3, đề xuất)

> Section này là sketch — phase 3+ mới build full. Đặt foundation cho roadmap.

### 12.1. Publishing flow

1. User Pro+ với strategy đã backtest tốt (PnL > 0, MDD < 30%, trade ≥ 30)
2. Click "Publish to marketplace" trong builder
3. Set price: $5-50 one-time hoặc 5-10% PnL share
4. Strategy file lưu encrypted trên BE
5. Public listing có: backtest summary + drytest verified status + price

### 12.2. Buyer flow

1. Browse marketplace, filter by win rate / MDD / category
2. Preview backtest result (read-only)
3. Buy → strategy unlock vào builder của buyer
4. Modify nếu muốn, hoặc deploy nguyên xi

### 12.3. Revenue model

- Author bán $20 strategy → buyer trả $20
- Platform commission **25%** → author nhận $15, platform $5
- Verified badge holder: commission rate giảm còn 20% (incentive verify)

### 12.4. Dispute & quality

- Buyer 30-day refund window nếu strategy lỗ > 20%
- Auto-suspend listing nếu drytest verified status drop

---

## 13. Verified PnL badge — detailed

### 13.1. Requirements để earn badge

| Criteria         | Threshold          |
| ---------------- | ------------------ |
| Drytest duration | ≥ 30 ngày liên tục |
| Win rate         | ≥ 50%              |
| MDD              | < 20%              |
| Trade count      | ≥ 30               |
| PnL              | > 0                |

### 13.2. Monthly fee

- $5/strategy/m để giữ badge
- Tự động charge từ wallet/Stripe
- Nếu fail criteria 7 ngày liên tiếp → badge revoked, fee stop

### 13.3. Display

- Badge hiển thị trong marketplace listing
- Verified strategy được boost trong search ranking
- Special filter "Verified only"

---

## 14. Performance fee tier — detailed

### 14.1. Eligibility

- User connect Coin98 wallet
- Verify identity (KYC light cho compliance)
- Min vốn $1k để eligible

### 14.2. Fee structure

- 10% PnL share nếu PnL/month < $500
- 15% PnL share nếu PnL/month ≥ $500
- Loss month: $0 fee
- High water mark: fee chỉ trên new high

### 14.3. Settlement

- Tự động deduct từ wallet end-of-month
- User thấy "Pending fee" trong dashboard
- Tax receipt email auto (jurisdiction-dependent)

---

## 15. Open questions (chốt trước khi code)

| #   | Question                                                                  | Owner | Deadline                     |
| --- | ------------------------------------------------------------------------- | ----- | ---------------------------- |
| Q1  | Drytest = feature riêng (B) hay mode (A)?                                 | Tri   | Trước prototype              |
| Q2  | Pricing $9/$15 anh muốn em research deeper hay placeholder OK?            | Tri   | Trước landing redesign       |
| Q3  | Free tier có "5 runs/month" hay unlimited 7d?                             | Tri   | Trước paywall implementation |
| Q4  | Marketplace có trong roadmap Q3 2026 không?                               | Tri   | Quarterly planning           |
| Q5  | Performance fee tier compliance check ai handle (legal)?                  | Tri   | Trước launch perf fee        |
| Q6  | Coin98 audience research data có không? Confirm willingness-to-pay $9-15? | Tri   | Validate pricing             |
| Q7  | Pay-per-run $1 — wallet pay hay credit card?                              | Tri   | Implementation detail        |
| Q8  | Cypheus AI thực sự — phase nào ship real AI?                              | Tri   | Roadmap                      |

---

## 16. Out of scope (YAGNI)

Spec này KHÔNG cover:

- Stripe/payment integration code (task riêng)
- Compliance/KYC infrastructure
- Marketplace UI/UX detail (chỉ concept)
- Performance fee accounting engine
- BaaS B2B API gating
- Mobile app pricing tiers (web only first)
- Multi-currency pricing (USD only first)
- Promo codes / referral system (phase 2)
- Annual prepay discount mechanics

---

## 17. Recommendation cho prototype HTML

Em recommend prototype HTML thử nghiệm cover:

1. **Backtest config modal** với 2 variant:
   - Free (7d limit + paywall sidebar) — như Figma1
   - Pro (full unlock) — như Figma2

2. **Backtest result view** simplified — như Figma3 nhưng:
   - KPI bar đầy đủ (5 metrics)
   - Chart placeholder (real lib quá nặng cho prototype)
   - Trade list bottom (Figma chưa có, em đề xuất)
   - "Compare with previous run" CTA (validate Pro feature)

3. **Drytest dashboard** mới (chưa có Figma):
   - List drytests đang chạy với status (running/stopped/finished)
   - Real-time P&L chart per drytest
   - Quota indicator "1 of 3 used" + upgrade CTA
   - Start new drytest modal

4. **Paywall variants** 3 placement test:
   - In config modal (Figma1)
   - After free run banner
   - Upgrade modal full-page

5. **Tier comparison page** standalone (cho landing/upgrade flow)

**Out of prototype:**

- Marketplace UI (chỉ mention concept)
- Performance fee dashboard
- BaaS console
- Stripe checkout (mock với fake form)

---

## 18. Success metrics (sau khi launch)

Trong 6 tháng post-launch, đo:

| Metric                               | Target  |
| ------------------------------------ | ------- |
| Free signup → Pro conversion         | ≥ 5%    |
| Pro → Max upgrade                    | ≥ 15%   |
| Pay-per-run ARPU per Free user       | ≥ $2/m  |
| Churn Pro monthly                    | < 5%    |
| Time-to-first-backtest (Free signup) | < 5 min |
| Backtest run / Free user / month     | > 3     |
| Drytest run / Pro user / month       | > 1     |

---

## 19. Risks

| Risk                                             | Mitigation                                              |
| ------------------------------------------------ | ------------------------------------------------------- |
| Pricing quá thấp → không sustainable             | A/B test giá; nếu CAC > LTV, bump giá Pro $9 → $12      |
| Free tier quá hào phóng → low conversion         | Giảm runs/month từ 5 → 3, hoặc giảm history 7d → 3d     |
| BE infra cost overrun (drytest concurrent đắt)   | Hard cap concurrent across all users, queue nếu vượt    |
| Marketplace listings spam / scam strategies      | Verified badge mandatory cho publishing, dispute system |
| Performance fee compliance (jurisdictions)       | Legal review trước launch, geo-restrict ban đầu         |
| Coin98 brand association (nếu C98 wallet outage) | Multi-wallet support phase 2 (MetaMask, Phantom)        |

---

## Appendix: References

- 4 Figma frames: `Spec/Phase 2/Backtest/Backtest{1,2,3,4}.png`
- BE backtest endpoints: `BE/tradingbot_doc.md` §5.4
- BE Backtest_History schema: `BE/tradingbot_doc.md` §4.5
- Existing FE stub: `Spec/PROJECT_OVERVIEW.md` §11.2
- Spec ý đồ cũ inline drawer: `Spec/trading_bot_spec.md` §17
- Wallet auth (đã có) làm foundation perf fee: `BE/auth-architecture.md`
