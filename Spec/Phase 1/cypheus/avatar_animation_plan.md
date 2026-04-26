# Cypheus Avatar Animation Plan

> Plan ngắn gọn: dùng 3 asset có sẵn (1 ảnh tĩnh + 2 anim webm), chỉ trigger 2 anim ở những thời điểm cụ thể, còn lại default về ảnh tĩnh.

- **Ngày:** 2026-04-25
- **Asset:** `Asset/avatar.png`, `Asset/hello.webm`, `Asset/coding.webm`

---

## 1. Asset inventory

| File | Loại | Vai trò |
|---|---|---|
| **`avatar.png`** | PNG transparent | Avatar **mặc định/idle** – hiển thị mọi lúc trừ khi có anim đang chạy |
| **`hello.webm`** | Video alpha | Anim chào – chạy 1 lần rồi quay về `avatar.png` |
| **`coding.webm`** | Video alpha | Anim đang build – chạy loop suốt thời gian Cypheus build |

---

## 2. Trigger map – chỉ 2 case duy nhất

### 2.1 Trigger `hello.webm`

Chạy **1 lần (one-shot)** khi:

| Trigger | Khi nào |
|---|---|
| **A1.** Page load greeting | Vừa mở `/builder` lần đầu (hoặc refresh) |
| **A2.** Click "Create new bot" | Sau khi confirm reset, trước khi greeting message hiện |

→ Sau khi anim chạy xong → **về `avatar.png` static**.

### 2.2 Trigger `coding.webm`

Chạy **loop liên tục** khi:

| Trigger | Khi nào |
|---|---|
| **B1.** Magic build active | Từ lúc user submit input → đến lúc 4 step ✓ + summary view |

→ Sau khi build done → **về `avatar.png` static**.

### 2.3 Mặc định

Mọi thời điểm khác → hiển thị **`avatar.png`** static, không animation.

---

## 3. Sơ đồ timeline

```
T+0       Page load
          ▶ hello.webm (one-shot)
T+~2s     Hello xong → avatar.png static
          ...
T+5       User submit
          ▶ coding.webm (loop)
T+5 → 32s coding loop chạy suốt magic build
T+32s     Build done → avatar.png static
          ...
T+anytime User click "Create new bot"
          ▶ hello.webm (one-shot)
          → avatar.png static
```

---

## 4. Implementation gọn

```tsx
// CypheusAvatar.tsx
type AvatarState = 'idle' | 'hello' | 'coding'

function CypheusAvatar({ state }: { state: AvatarState }) {
  if (state === 'hello') {
    return (
      <video
        src="/cypheus/hello.webm"
        autoPlay
        muted
        playsInline
        onEnded={() => setState('idle')}  // về idle khi xong
      />
    )
  }
  if (state === 'coding') {
    return (
      <video
        src="/cypheus/coding.webm"
        autoPlay
        loop
        muted
        playsInline
      />
    )
  }
  return <img src="/cypheus/avatar.png" alt="Cypheus" />  // idle default
}
```

**State trigger:**

```ts
// cypheus.store.ts
onPageLoad      → setAvatarState('hello')
onUserSubmit    → setAvatarState('coding')
onBuildDone     → setAvatarState('idle')
onCreateNewBot  → setAvatarState('hello')
```

---

## 5. WebM lưu ý

- File phải có **alpha channel transparent** (codec VP8/VP9 với alpha) để layer lên nền tối không thấy box đen.
- `<video>` cần `muted` + `playsInline` để autoplay không bị chặn (Chrome/Safari policy).
- Browser fallback: nếu trình duyệt không support `.webm` alpha → hiện `avatar.png` static (graceful degrade).

---

## 6. Acceptance

- [ ] Page load → `hello.webm` chạy 1 lần → tự về `avatar.png`.
- [ ] User submit → `coding.webm` loop suốt magic build.
- [ ] Build xong → quay về `avatar.png`.
- [ ] Click "Create new bot" → `hello.webm` chạy lại 1 lần.
- [ ] Mọi lúc khác → hiển thị `avatar.png` static.
- [ ] WebM không có viền đen / nền vuông (alpha hoạt động đúng).

---

*End of plan.*
