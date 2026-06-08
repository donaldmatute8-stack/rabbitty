# Changelog

## 2026-05-31 — Massive Inline Style → Tailwind Migration

Migrated ~250 inline styles across 34 files in `telegram-miniapp/` to Tailwind CSS, maintaining exact visual fidelity.

### Summary
- **12 files** with 1-4 inline styles (Tier 4)
- **5 files** with 5-8 inline styles (Tier 3)
- **12 files** with 10+ inline styles (Tier 2/1)
- **5 files** left with necessary inline styles (dynamic props, safe-area, CSS animations)

### Converted patterns
- CSS variable refs: `var(--bg-primary)` → `bg-[var(--bg-primary)]`
- Static values: `color: '#111'` → `text-[#111]`
- Status conditionals: `isDark ? '#000' : '#FAFAFA'` → conditional class strings
- Gradients: `background: 'linear-gradient(...)'` → `bg-gradient-to-br from-... to-...`
- Animations: kept inline (not Tailwind-compatible)
- Safe area / Telegram runtime values: kept inline
- Dynamic computed values: kept inline

### Files migrated

| File | Change |
|------|--------|
| `app/chat/page.tsx` | textDecoration → no-underline |
| `components/AppOpener.tsx` | filter → drop-shadow class |
| `features/auth/AuthProvider.tsx` | spinner + loading div → Tailwind |
| `features/admin/AdminPanel.tsx` | height: 100vh → h-dvh |
| `app/support/page.tsx` | 2x textDecoration → no-underline |
| `app/support/faq/page.tsx` | fontFamily removido, textDecoration → class |
| `app/onboarding/page.tsx` | fontFamily removido, filter/gradient → classes |
| `app/history/page.tsx` | filtros dinámicos → conditional classes |
| `app/profile/gamification/page.tsx` | tabs dinámicos + opacity/filter condicionales |
| `components/BottomNav.tsx` | filter + 3x color condicionales |
| `components/ui/Header.tsx` | filter → brightness/invert classes |
| `components/ui/ProfileSubpageLayout.tsx` | fontFamily removido + filter convertido |
| `features/business/MobileAffiliateDashboard.tsx` | appearance + status badge condicionales |
| `app/bot/page.tsx` | fontFamily+background consolidados, isSelected condicionales |
| `app/referral/page.tsx` | gradient convertido, spinner, share buttons condicionales |
| `app/security/page.tsx` | 4 backgrounds/blurs convertidos |
| `app/login/page.tsx` | fontFamily removido, layout convertido |
| `app/profile/support/page.tsx` | 2 gradients convertidos, 3 dinámicos inline |
| `components/ui/dotted-glow-background.tsx` | opacity/mix-blend-mode convertidos, CSS props inline |
| `app/discover/page.tsx` | border/margin/padding condicionales convertidos |
| `app/scan/page.tsx` | page bg, gradient, tabs, botón, input → clases |
| `app/profile/wallet/page.tsx` | card gradient, modales, tx rows, badges → clases |
| `app/chat/[targetId]/page.tsx` | burbujas, input, botón send, spinner → clases |
| `app/affiliate/[id]/page.tsx` | header dinámico, hero, card, badges → clases |
| `features/map/InteractiveMap.tsx` | filtros, selected card, badges → clases |
| `app/welcome/page.tsx` | CSS variables role cards → Tailwind arbitrary values |
| `app/signup/page.tsx` | multi-step buttons consolidados a clases Tailwind |
| `app/page.tsx` (Feed) | ~24 isDark conditionals convertidos a clases |
| `features/business/BusinessSetupForm.tsx` | 19 inline → gradientes, condicionales, theme |
| `app/role-selection/page.tsx` | fontFamily removido |

### Notes
- `components/ui/Skeleton.tsx` — sin cambios (styles dinámicos desde props)
- `components/ui/BottomSheet.tsx` — sin cambios (maxHeight dinámico)
- `components/ui/3d-globe.tsx` — sin cambios
- Tailwind v4 con `@import "tailwindcss"` — no hay tailwind.config.ts
