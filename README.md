# Strategy Builder Tool

Interactive strategy builder for the Trading Bot platform. MVP scope:
single-strategy builder with Cypheus AI scripted demo and JSON export.

> Specs live in `Spec/Phase 1/` — start with `Spec/Phase 1/README.md`.

## Quick start

```bash
pnpm install
pnpm dev          # http://127.0.0.1:5173
pnpm build        # production build
pnpm test         # vitest
pnpm lint         # eslint
pnpm format       # prettier write
pnpm typecheck    # tsc no-emit
```

## Stack

- React 18 + TypeScript + Vite
- Tailwind CSS + shadcn/ui (Radix primitives)
- Zustand (state) + React Hook Form + Zod (validation)
- Framer Motion (motion) + Sonner (toast) + Lucide (icons)
- prism-react-renderer (JSON live view)

## Layout

```
.
├── src/
│   ├── components/        # ui primitives + common components
│   ├── features/          # domain features (bot-builder, cypheus, fx…)
│   ├── pages/             # route-level pages
│   ├── lib/               # serializer, validator, utils
│   ├── schemas/           # zod schemas (bot, strategy, indicator)
│   ├── stores/            # zustand stores
│   ├── styles/            # tokens.css, fonts.css
│   ├── i18n/              # en.ts (locale strings)
│   └── types/             # shared TS types
├── Spec/                  # specs (MVP plan, UX, design, Cypheus)
├── Data/                  # JSON payload samples
└── Ref_screen/            # design reference screenshots
```

## Status

Bootstrap milestone (M0) complete. Next: M1 — 3-column layout shell.
