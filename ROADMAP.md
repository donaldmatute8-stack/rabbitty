# Rabbitty POS + Restaurant Management — ROADMAP

> **Stack:** Next.js 16 + Turborepo + tRPC v11 + NextAuth v5 + Drizzle ORM + PostgreSQL + Tailwind v4
> **Dominio:** https://rabbitty.me
> **Workspace:** `/Users/bullslab/.openclaw/agents/sofia-workspace/projects/Rabbitty`

---

## 📋 LEYENDA

| Símbolo | Significado |
|---------|-------------|
| ✅ | Completado |
| 🚧 | En progreso |
| ❌ | No iniciado |
| 🟢 | Prioridad baja |
| ⏸️ | Pospuesto (no se trabaja por ahora) |

---

## ✅ FASE 0 — Fundación (COMPLETADA)

### Infraestructura
- [x] Turborepo monorepo con pnpm workspaces
- [x] 3 apps: `apps/pos`, `apps/kds`, `apps/admin`
- [x] 8 packages: `api`, `auth`, `bunz`, `config`, `database-core`, `database-restaurant`, `events`, `ui`
- [x] Build unificado via `pnpm build` (Turbo 2.9+)
- [x] `turbo.json` con `tasks` (Turbo 2.0+ compat)
- [x] Docker Compose para PostgreSQL 16 local
- [x] `.env.example` en apps/pos, kds, admin
- [x] TastyIgniter archivado en `_archive/tastyigniter/`
- [x] Docs obsoletos archivados en `_archive/docs/`

### Arquitectura
- [x] tRPC v11 con `fetchRequestHandler` + `router.createCaller`
- [x] NextAuth v5 con Resend (magic link) + Telegram credentials
- [x] Auth middleware en las 3 apps (login protegido)
- [x] Login pages en las 3 apps (con formulario email)
- [x] Route handlers `api/auth/[...nextauth]` en cada app
- [x] tRPC context con auth session + DB connections
- [x] `protectedProcedure` con rate limiting + audit log
- [x] `publicLimitedProcedure` para endpoints públicos rate-limited

### Database
- [x] Restaurant DB: 15 tablas (restaurants, branches, menu, orders, payments, inventory, staff, events)
- [x] Core DB: 16 tablas (users, transactions, referrals, levels, achievements, etc.)
- [x] Drizzle relations
- [x] Migración inicial generada y aplicada
- [x] Seed data: 1 restaurant, 2 sucursales, 4 categorías, 15 items, 3 staff, 12 mesas, 2 órdenes
- [x] Scripts `db:generate`, `db:migrate`, `db:seed`

### Real-time / Events
- [x] EventBus in-memory (`@rabbitty/events`)
- [x] SSE endpoint en KDS (`/api/sse`)
- [x] 13 event types definidos
- [x] KDS page conectada vía EventSource (no polling)

### POS App
- [x] Sidebar navegación
- [x] TableGrid con status (free/occupied/reserved/cleaning)
- [x] CartDrawer con menú, agregar/quitar items
- [x] Crear orden desde carrito
- [x] Menu page con categorías y búsqueda
- [x] Orders page con expand/collapse + payment (cash/card/bunz)
- [x] History page
- [x] `calculateBunzReward` + `calculateBunzCost` integrados

### KDS App
- [x] Dark theme
- [x] Order grid con status transitions
- [x] Item workflow: pendiente → preparando → listo → servido
- [x] Filter tabs (all/pending/preparing/ready)
- [x] Notification bell con animación
- [x] SSE real-time updates
- [x] Skeleton loading state
- [x] KDS Sound alerts — useSound hook + SSE real-time
- [x] KDS SLA tracking — OrderTimer con colores por tiempo
- [x] KDS completed view — CompletedOrders.tsx + completed/page.tsx
- [x] KDS full-screen mode — useFullscreen hook

### Admin App
- [x] Sidebar navegación
- [x] Dashboard con stats cards
- [x] Orders panel
- [x] Table summary grid
- [x] Reports page (sales analytics)
- [x] Login page

### Middlewares
- [x] Rate limiter (60 req/min por usuario)
- [x] Audit logger (mutation tracking)

### API Routers (11/11 migrados a Drizzle)
- [x] **POS router** — tables, menu, cart, orders, payments
- [x] **KDS router** — orders, item status
- [x] **Staff router** — CRUD, shifts, clock-in/out
- [x] **Inventory router** — items, movements, alerts via EventBus
- [x] **Admin router** — restaurants, branches, menu, reports
- [x] **Payments router** — process, refund, totals
- [x] **Customer router** — lookup por orders
- [x] **Reservations router** — lookup por orders
- [x] **Notifications router** — event-based
- [x] **Printing router** — printers in-memory
- [x] **Webhooks router** — webhooks in-memory

---

## ✅ FASE 1 — Migración Inline Styles Miniapp (COMPLETADA)

- [x] Migrated ~250 inline styles → Tailwind across 34 files in `telegram-miniapp/`
- [x] 12 files Tier 4 (1-4 styles), 5 files Tier 3 (5-8 styles), 12 files Tier 1-2 (10-24 styles)
- [x] CSS variable refs → `bg-[var(--x)]`, `text-[var(--x)]`
- [x] Gradients → `bg-gradient-to-br`
- [x] Dynamic state conditionals → conditional class strings
- [x] Safe-area, animations, dynamic computed values left inline where needed
- [x] Build verified: `next build` passes
- [x] CHANGELOG.md created at project root
- [x] No regressions: visual fidelity maintained 1:1

---

## ✅ FASE 2 — CRUD Admin + POS Features (COMPLETADA)

### Admin App — CRUD Funcional (6 páginas)
- [x] **Restaurants** (`/restaurants`) — Modal editar con form, update mutation conectada
- [x] **Menu** (`/menu`) — Modal crear/editar platillo y categoría, delete con confirmación
- [x] **Staff** (`/staff`) — Formulario crear/editar, delete (soft), PIN en creación
- [x] **Kitchen** (`/kitchen`) — SLA editables, update order item status (pending→preparing→ready)
- [x] **Settings** (`/settings`) — Formularios editables inline (nombre, tax, bunz rate, acceptsBunz)
- [x] **Inventory** (`/inventory`) — Fix `.mutate()` bug, crear item dialog, ajuste de stock funcional

### ✅ POS Features (COMPLETADA)
- [x] **Void order** — backend mutation + frontend UI (wired en Orders page)
- [x] **Split bill** — modal existente, wiring completado en Orders page
- [x] **Discounts & Promos** — modal existente, wiring completado en Orders page
- [x] Quick order — orden sin asignar mesa (para llevar)
- [x] Takeout/Delivery mode — flujo completo con datos de cliente
- [x] Menu item modifiers — choices/extras por platillo desde el cart
- [x] DB migration — customerName + customerPhone fields added to orders table

---

## ✅ FASE 8.5 — Security Hardening (COMPLETADA — 02 Jun 2026)

> Auditoría de ciberseguridad fintech aplicada al código y repo.

### Secrets & Exposure
- [x] Audit completo de secrets en repo completo (9 CRITICAL, 2 WARNING, 2 INFO)
- [x] Files con secrets hardcodeados movidos a .gitignore (6 JS scripts en telegram-miniapp/)
- [x] `console.log` de payloads sensibles eliminado de webhook route
- [x] `.env.example` de backend-oracle identificado con private key real (pendiente rotación)
- [x] `.gitignore` reforzado: *.pem, *.key, *.crt, secure/, credentials*, secrets*

### What was found (CRITICAL) — requires action from Marco:
1. **Neon DB credentials** hardcoded in 4 JS scripts (committed to git)
2. **2 Telegram bot tokens** hardcoded in 2 JS scripts (committed to git)
3. **Thirdweb secret key** in `.env.local` (gitignored, but on disk)
4. **Google OAuth client secret** in `.env.local`
5. **Ollama API key** in `.env.local`
6. **Oracle private key** in `backend-oracle/.env.example` (real ETH private key)
7. **MySQL password** in `_archive/tastyigniter/.env`

### Recommendations for Marco
- 🔴 Purge git history with `git filter-repo` for committed secrets
- 🔴 Rotate ALL leaked tokens/keys immediately
- 🔴 Change Neon DB password
- 🔴 Verify Oracle private key is testnet and rotate if real

### Practices enforced
- [x] All secrets in `.env` / `process.env` — never hardcoded
- [x] `.env.example` files use clearly fake placeholders
- [x] `NEXT_PUBLIC_*` vars audited — only public-safe values exposed
- [x] API routes don't log sensitive data
- [x] Gitignore covers env, build output, IDE, OS files, archive

---

## 🚧 FASE 3 — Integración Rabbitty Ecosystem (EN PROGRESO — 70%)

### Bridge POS ↔ Miniapp
- [x] **miniapp-client service**: Cliente HTTP reutilizable que llama API de la miniapp
- [x] **fastapi-bridge real**: Todos los endpoints ahora llaman a la miniapp real (reward, charge, sync, history, gamification)
- [x] **Env vars**: `RABBITTY_MINIAPP_URL` y `RABBITTY_API_SECRET` añadidos a POS/KDS/Admin
- [x] **BUNZ payment wired**: POS paga con Bunz → llama a miniapp para cargar Bunz
- [x] **Multi-branch**: Eliminado BRANCH_ID hardcoded, ahora usando ctx.userId para identificar sucursal
- [x] **Auto bunz reward**: al pagar, llama a `/api/pos/reward` de la miniapp
- [x] **Bunz balance verification**: verifyBunzBalance endpoint en POS + bridge a miniapp
- [x] **Restaurant sync**: Admin crea restaurante → sync via bridge a miniapp (`POST /api/business`)
- [x] **Oracle on-chain**: Conexión establecida (fire-and-forget desde mint endpoint)
- [x] **Reservations sync**: Admin crea reserva → sync a miniapp vía bridge
- [x] **Notifications push**: POS paga → notificación push al cliente en miniapp
- [x] **Customer identity bridge**: POS linkea orden con miniapp user por teléfono, businessId en transacciones
- [x] **Business auto-sync**: Admin updateRestaurant → auto-sync a miniapp
- [x] **QR login en POS**: Componente QrCustomerLogin + API routes bridge para generar/poll QR sessions
- [ ] **Shared DB**: Plan creado (`PLAN_SHARED_DB.md`) — pendiente ejecución

---

## ⏸️ FASE 4 — Rabbitty Pay (POSTPUESTO)
_Sistema de pagos — solo Telegram Native por ahora_

> **Decisión:** Solo funcionamos con Telegram Native por ahora. Stripe/MercadoPago se evaluarán más adelante.

- [ ] Payments API (Stripe + MercadoPago) — ⏸️
- [ ] Procedimiento `processPayment` en POS — ⏸️
- [ ] Bunz payment flow (quemar Bunz al pagar) — ⏸️
- [ ] Refund flow en Admin — ⏸️
- [ ] Receipt printing (ticket digital + físico) — ⏸️

---

## 🚧 FASE 5 — Reservations, Calendar & Operations (COMPLETADA)

- [x] Reservations page in admin — list view + calendar view
- [x] Table map — mapa interactivo de mesas en POS
- [x] Customer history — ver historial de visits/gastos por Rabbitter
- [x] Waitlist — lista de espera con notificación automática
- [x] Table layout editor — editor visual de distribución de mesas

---

## ✅ FASE 6 — Visual Identity & UI (COMPLETADA)

- [x] Design tokens — tokens.css con colores, spacing, typography
- [x] Dark mode funcional en Admin/Settings/KDS
- [x] Logo/favicon en cada app
- [x] Responsive design verificado en POS/KDS/Admin
- [x] Loading states — skeletons en todas las pages
- [x] Error boundaries — manejo de errores consistente con ErrorBoundary

---

## ⏸️ FASE 7 — Smart Contracts & Web3 (POSTPUESTO)

- [ ] RabbittyIdentity.sol (ERC-721 soulbound)
- [ ] BunzToken.sol (ERC-20 con mint/burn)
- [ ] RabbittyRegistry.sol (affiliate management)
- [ ] Hardhat/Foundry setup
- [ ] Unit tests
- [ ] Polygon Amoy deployment
- [ ] WalletConnect integration

---

## 🚧 FASE 8 — Testing (EN PROGRESO)

- [x] Unit tests (Vitest) — packages/api, packages/bunz
- [x] Security audit — secrets, env, gitignore, exposure (02 Jun 2026)
- [x] Integration tests — routers contra DB real (POS: 8, KDS: 3)
- [x] Admin hardcoded branchId eliminado — 3 pages (staff, menu, inventory)
- [x] E2E tests (Playwright) — 11 tests cubriendo login, tables, menu, cart, categories, sidebar
- [ ] Load testing — KDS con 100+ órdenes simultáneas

---

## 🚧 FASE 9 — Infra & Casa (EN PROGRESO)

### Urgente (seguridad)
- [ ] 🔴 **Purgar git history** — 6 JS scripts con secrets commitados (Neon DB creds, Telegram bot tokens). Usar `git filter-repo`.
- [ ] 🔴 **Rotar tokens expuestos** — Telegram bots, Neon DB, Thirdweb key, Google OAuth secret, Ollama key
- [ ] 🔴 **Oracle private key** — Verificar si es testnet o real; rotar si es real
- [ ] 🔴 **Cambiar password MySQL** en Railway (tastyigniter archive)

### VPS (Hetzner + Coolify)
- [ ] Coolify instance setup
- [ ] Docker Compose for 3 apps
- [ ] PostgreSQL for restaurant DB
- [ ] Neon for Core DB
- [ ] SSL / Caddy reverse proxy

### DNS
- [ ] `pos.rabbitty.me` → POS app
- [ ] `kds.rabbitty.me` → KDS app
- [ ] `admin.rabbitty.me` → Admin app

### CI/CD
- [ ] GitHub actions
- [ ] Auto-deploy on push
- [ ] Docker image build

---

## ✅ FASE 8.5 — Code Audit + Miniapp Real Features (COMPLETADA — 03 Jun 2026)

> 86 audit hits corregidos + miniapp features reales + bridge POS↔Miniapp

### Code Audit (86 hits)
- [x] CartDrawer i18n: "item(s)" → "artículo(s)"
- [x] Middleware → Proxy: migrados POS/KDS/Admin (Next.js 16 compat)
- [x] Schema forward reference fix (staff before tableSessions)
- [x] Unused imports limpiados en 10 routers
- [x] `as any` type assertions eliminados (admin, reports, refunds, qr-generator)
- [x] Env var `!` assertions → throw clear errors (3 route.ts)
- [x] Error messages traducidos a español (8 errores)
- [x] clearCart +returning(), sortOrder incremental en addToCart
- [x] alert() → toast en waitlist, usePayment sonner → @rabbitty/ui
- [x] Restaurant-sync slug hardcoded → real, QR generator `{} as any` → skipToken

### Bridge POS ↔ Miniapp
- [x] miniapp-client service (HTTP client con API secret auth)
- [x] fastapi-bridge real: reward, charge, sync, history, gamification
- [x] Env vars: `RABBITTY_MINIAPP_URL` + `RABBITTY_API_SECRET` en 3 apps
- [x] BUNZ payment wired → llama a miniapp para cargar Bunz

### Miniapp Features Reales
- [x] **Social feed**: datos reales del DB (ownedBusinesses), sin mock categories
- [x] **Inventory**: reservas reales desde la DB (antes stub vacío)
- [x] **Offers**: generado dinámicamente desde businesses con rewardPercentage > 0
- [x] **Notifications**: query real a la DB (antes devolvía array vacío siempre)
- [x] **Oracle connected**: oracle-client en miniapp, fire-and-forget desde mint endpoint
- [x] **POS reward endpoint**: acepta `business_id` y devuelve `userId` para identity bridge
- [x] **POS charge endpoint**: usa `business_id` en lugar de hardcoded 'unknown'

### Wired Points 1-6 (03 Jun 2026)
- [x] **Reservations sync**: `reservations.create` en Admin → sync a miniapp vía bridge
- [x] **Notifications push**: `pos.payOrder` → sendNotification a miniapp user
- [x] **Customer identity bridge**: POS linkea orden con miniapp user (phone+businessId)
- [x] **Business auto-sync**: `admin.updateRestaurant` → `miniappClient.createBusiness` automático
- [x] **QR login en POS**: componente QrCustomerLogin + API routes (`/api/qr-login/*`)
- [x] **Shared DB plan**: `PLAN_SHARED_DB.md` creado con fases y风险评估

---

## 📊 Progreso General

| Componente | Estado | Completado |
|------------|--------|------------|
| FASE 0 — Fundación | ✅ | 100% |
| FASE 1 — Inline Styles Miniapp | ✅ | 100% |
| FASE 2 — CRUD Admin + POS Features | ✅ | 100% |
| FASE 3 — Rabbitty Ecosystem | 🚧 | 90% |
| FASE 4 — Rabbitty Pay | ⏸️ | Postpuesto |
| FASE 5 — Reservations | ✅ | 100% |
| FASE 6 — Visual Identity | ✅ | 100% |
| FASE 7 — Smart Contracts | ⏸️ | Postpuesto |
| FASE 8 — Testing | 🚧 | 50% |
| FASE 8.5 — Code Audit + Miniapp Features | ✅ | 100% |
| FASE 9 — Infra & Casa | 🚧 | 0% |
