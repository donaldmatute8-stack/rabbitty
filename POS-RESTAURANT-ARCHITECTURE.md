# Rabbitty POS + Restaurant Management System

## Arquitectura, Roadmap y Progreso

**Inicio:** 2026-05-31
**Updated:** 2026-05-31
**Owner:** Hefesto / Marco
**Meta:** Reemplazar TastyIgniter con un sistema POS + Restaurant Management nativo TypeScript, integrado con Rabbitty Mini App.

---

## Stack 2026

| Capa | Tecnología | Justificación |
|------|-----------|---------------|
| **Runtime** | Next.js 16 + React 19 | Ya en uso, RSC, streaming SSR, PWA |
| **API Layer** | tRPC v11 | Type-safe end-to-end, reemplaza API routes + FastAPI (CRUD) |
| **ORM** | Drizzle ORM | Ya en uso, tipo-safe, migraciones, shared packages |
| **Database Core** | Supabase (Postgres) | Auth users, wallet, bunz, gamification, metadata negocios |
| **Database Restaurant** | Postgres dedicado (VPS) | Orders, mesas, menú, inventory, staff, eventos |
| **Auth** | Auth.js v5 + Telegram + Magic Link | 0 passwords, restaurantes pierden passwords siempre |
| **UI** | shadcn/ui + Tailwind v4 | 0 inline styles, accesible, consistente |
| **State Client** | Zustand | POS carrito, mesa activa, UI transient state |
| **State Server** | TanStack Query | Cache, refetch, optimistic updates |
| **Tables** | TanStack Table | POS order list, inventory |
| **Charts** | Recharts | Dashboard analytics |
| **Events** | Inngest | order.created, order.paid, wallet.credited |
| **Realtime** | SSE + Upstash Redis | KDS, notificaciones, menos complejo que WS directo |
| **Hosting Mini App** | Vercel | Sin cambios, serverless, edge |
| **Hosting POS/KDS/Admin** | Docker VPS (Hetzner/DO) + Coolify | Más barato, control total, WebSocket real |
| **Hosting FastAPI** | Railway | Sin cambios, solo blockchain Oracle |
| **Package Manager** | pnpm | Workspaces nativos, más rápido |

---

## Arquitectura General

```
Turborepo
│
├── apps/
│   ├── miniapp/          # Telegram Mini App (NEXT.js 16) - existente
│   ├── pos/              # POS Web App (Next.js 16) - 🆕
│   ├── kds/              # Kitchen Display (Next.js 16, SSE) - 🆕
│   └── admin/            # Admin multi-branch (Next.js 16) - 🆕
│
├── packages/
│   ├── database-core/    # Rabbitty Core schema (Drizzle)
│   ├── database-restaurant/ # Restaurant schema (Drizzle)
│   ├── api/              # tRPC router unificado
│   ├── auth/             # Auth.js + Telegram + Magic Link
│   ├── ui/               # shadcn/ui + Tailwind v4
│   ├── bunz/             # Reward calculation engine
│   └── events/           # Inngest event definitions
│
├── backend/              # FastAPI - solo blockchain Oracle + AI + ETL
├── contracts/            # Solidity - Token Bunz
└── turbo.json
```

### Flujo de datos

```
Cliente (Mini App / POS / KDS)
        │
        ▼
    tRPC (type-safe, end-to-end)
        │
        ├──► Drizzle ORM
        │       ├──► Supabase (Core DB: users, wallet, bunz)
        │       └──► Postgres VPS (Restaurant DB: orders, menu)
        │
        └──► Inngest (eventos async)
                ├──► bunz reward calculation
                ├──► notifications
                └──► FastAPI (blockchain minting)
```

---

## Database: Dual Schema

### Rabbitty Core DB (Supabase)

Tablas existentes + movidas del mini app:

```
users                  # Auth, Telegram ID, wallet, bunz balance
webSessions            # JWT sessions
qrSessions             # QR login
transactions           # Core ledger (earn/spend bunz)
pendingVaults          # Bunz no reclamados
referrals              # Referral network
notifications          # Push/in-app
levels                 # Gamification levels
hatTricks              # Hitos
achievements           # Logros
userHatTricks          # Progreso user → hitos
userAchievements       # Logros desbloqueados
conversations          # Chat
messages               # Chat messages
ownedBusinesses        # Metadata del negocio + reward config
reservations           # Reservaciones
```

### Restaurant DB (Postgres dedicado VPS)

Nuevas tablas para POS + Restaurant Management:

```
restaurants            # FK → ownedBusinesses.id, config específica POS
branches               # Multi-sucursal

menu_categories        # Categorías del menú (Ej: "Bebidas", "Platos Fuertes")
menu_items             # Items del menú (nombre, precio, costo, imagen, categoría)
menu_item_modifiers    # Modificadores (Ej: "Sin lactosa", " término", "Extra queso")
menu_item_variants     # Variantes (Ej: "Chico/Mediano/Grande")

tables                 # Mesas (número, capacidad, ubicación, QR)
table_sessions         # Sesión de mesa abierta (check-in, check-out, mesero)

orders                 # Órdenes (mesa, mesero, estado, total, bunz reward)
order_items            # Items de la orden (item, cantidad, modificadores, precio)
order_payments         # Pagos (método, monto, split info)

staff                  # Empleados (FK → users, rol, branch)
staff_shifts           # Turnos (check-in, check-out, branch)
staff_roles            # admin, cashier, waiter, kitchen

inventory_items        # Items de inventario
inventory_movements    # Entradas/salidas/merma
inventory_alerts       # Low stock alerts

events                 # Eventos para reportes on-demand
                       # (order.created, order.paid, inventory.low, etc.)
```

### Relación entre DBs

```
Core DB                           Restaurant DB
─────────                         ─────────────
users.id ────────────────────────► staff.user_id
ownedBusinesses.id ──────────────► restaurants.business_id
                                  branches.restaurant_id
                                  orders.branch_id
                                  tables.branch_id
                                  menu_items.branch_id
```

---

## Feature Set por Fase

### FASE 0: Setup (Semana 1)

```
Objetivo: Base del monorepo + shared packages + migración de schema
Dependencias: Mini App existente en producción

Entregables:
├── pnpm workspace (turborepo)
├── packages/database-core (schema actual migrado del mini app)
├── packages/database-restaurant (schema nuevo)
├── packages/auth (Auth.js + Telegram + Magic Link)
├── packages/ui (shadcn/ui, tailwind v4, 0 inline styles)
├── packages/api (tRPC base routers)
├── packages/bunz (reward engine)
├── packages/events (Inngest types)
├── Docker Compose dev environment (Postgres Core + Restaurant)
└── Coolify/Dokploy setup para staging

Output: Dev environment funcional, todas las apps compilan
```

### FASE 1: POS Core V1 (Semanas 2-3)

```
Objetivo: MVP funcional que pueda cobrar en un restaurante real
Dependencias: Fase 0 completada

Scope MÍNIMO: "Mesas, Órdenes, Pagos, KDS, Bunz"

POS App (apps/pos):
├── Login: Magic Link (email) + QR con Telegram
├── Table Grid: vista de mesas (ocupado/libre/limpia)
├── Menu Browser: categorías → items → carrito
├── Order Creation: seleccionar items, cantidades, notas
├── Payment: cash, card, Bunz (vía tRPC → Core DB)
├── Receipt: digital (PDF/print thermal) + email
└── Order History: últimas 24h

KDS App (apps/kds):
├── SSE connection for real-time orders
├── Order cards (nuevo, prep, listo, entregado)
├── Sound alert on new order
└── Full screen mode

tRPC routers nuevos:
├── pos.tables.*         (CRUD mesas)
├── pos.menu.*           (CRUD menú)
├── pos.orders.*         (CRUD órdenes + items)
├── pos.payments.*       (procesar pago, split)
└── pos.kds.*            (SSE stream + status updates)

Inngest events:
├── order.created        → KDS push
├── order.paid           → bunz reward calculation
└── bunz.reward.ready    → mint via FastAPI

Output: POS funcional para 1 restaurante, 1 sucursal
```

### FASE 2: Management (Semanas 4-5)

```
Objetivo: Herramientas de gestión para el dueño del restaurante
Dependencias: Fase 1 completada

POS App additions:
├── Staff management (invitar, roles, turnos)
├── Shift management (check-in/out con código)
├── Table merge/split
├── Discounts (% off, flat, promo codes)
├── Tip management (cash, card, split)
└── Daily close (Z report)

Admin App (apps/admin):
├── Dashboard: ventas hoy/semana/mes
├── Order search + filters
├── Staff performance
└── Branch selector

Inventory (básico):
├── Stock items CRUD
├── Stock movements (entrada/salida)
├── Low stock alerts (Inngest → notificación)
└── Inventory adjustments (merma)

tRPC routers nuevos:
├── pos.staff.*
├── pos.shifts.*
├── pos.discounts.*
├── pos.inventory.*
└── admin.reports.*

Output: Dueño puede gestionar staff e inventario básico
```

### FASE 3: Multi-Branch + Analytics (Semanas 6-7)

```
Objetivo: Cadena de restaurantes, reportes avanzados
Dependencias: Fase 2 completada

Admin App additions:
├── Multi-branch dashboard
├── Sales comparison (branch vs branch)
├── Menu item popularity (por branch, global)
├── Peak hours analysis
├── Staff cost analysis
└── Export reports (CSV, PDF)

POS App additions:
├── Centralized menu management (push to branches)
├── Cross-branch order transfer
└── Global inventory view

Events → Reports engine:
├── events pipeline en Inngest
├── Report generation from stored events
└── No precomputed aggregates

Output: Cadena de restaurantes funcional
```

### FASE 4: Polish + Escala (Semana 8+)

```
Objetivo: Producción real, pulir, escalar
Dependencias: Fase 3 completada

POS App:
├── PWA offline mode (service worker)
├── offine order capture → sync when online
├── Thermal printer support (WebUSB / Bluetooth)
├── Multiple menu boards (breakfast/lunch/dinner)
├── Customer display (pantalla para cliente)
└── Bunz marketing (promo "paga con bunz y ahorra 20%")

KDS:
├── Multiple stations (appetizers, grill, drinks)
├── Order bumping
├── Prep time tracking
└── Expos/Chaser screen

Migración TastyIgniter:
├── Export historical orders
├── Export menu items
├── Export customer data
└── Sunset TastyIgniter server

Output: Sistema completo ready para escalar a cientos de restaurantes
```

---

## Despliegue

| App | Host | Strategy |
|-----|------|----------|
| miniapp | Vercel | Sin cambios, serverless edge |
| pos | Docker VPS (Hetzner CPX31) | Coolify, auto-deploy desde GH |
| kds | Docker VPS (mismo que POS) | Coolify, subdominio separado |
| admin | Docker VPS (mismo que POS) | Coolify, subdominio separado |
| backend (FastAPI) | Railway | Sin cambios, solo blockchain |
| Core DB | Supabase | Managed Postgres, auth incluido |
| Restaurant DB | Postgres en VPS (o Supabase si alcanza) | Dedicado, conexión directa |
| Redis | Upstash | Serverless, REST + SSE |
| File Storage | Uploadthing o R2 | Images de menú, logos |
| Events | Inngest | Serverless, free tier generoso |

### Dominios

```
t.me/rabbittybot              → Mini App (Telegram)
pos.rabbitty.app              → POS App
kds.rabbitty.app              → Kitchen Display
admin.rabbitty.app            → Admin Panel
api.rabbitty.app              → FastAPI (Oracle backend)
```

### CI/CD

```
GitHub → push to main
  └── Turborepo build (pnpm build)
        ├── Vercel deploy (miniapp)
        └── Coolify deploy (POS/KDS/Admin)
              └── Docker build → restart container
```

---

## Progreso

| Fase | Estado | Fecha Inicio | Fecha Fin |
|------|--------|-------------|-----------|
| Fase 0: Setup | ⏳ Pendiente | - | - |
| Fase 1: POS Core V1 | ⏳ Pendiente | - | - |
| Fase 2: Management | ⏳ Pendiente | - | - |
| Fase 3: Multi-Branch + Analytics | ⏳ Pendiente | - | - |
| Fase 4: Polish + Escala | ⏳ Pendiente | - | - |

<br>

### Fase 0 — Setup

- [ ] Turborepo + pnpm workspace initialized
- [ ] packages/database-core con schema actual migrado
- [ ] packages/database-restaurant con schema nuevo
- [ ] packages/auth (Auth.js + Telegram + Magic Link)
- [ ] packages/ui (shadcn/ui + Tailwind v4)
- [ ] packages/api (tRPC base)
- [ ] packages/bunz
- [ ] packages/events (Inngest)
- [ ] Docker Compose dev environment
- [ ] Coolify staging server ready
- [ ] Apps compilando (miniapp, pos, kds, admin)

<br>

### Fase 1 — POS Core V1

- [ ] Magic Link login
- [ ] QR Telegram login
- [ ] Table Grid UI
- [ ] Menu browser + carrito
- [ ] Order creation
- [ ] Payment (cash/card)
- [ ] Payment (Bunz)
- [ ] Digital receipt
- [ ] Order history (24h)
- [ ] KDS SSE connection
- [ ] KDS order cards
- [ ] KDS sound alerts
- [ ] Inngest events: order.created, order.paid
- [ ] Bunz reward on payment

<br>

### Fase 2 — Management

- [ ] Staff CRUD + roles
- [ ] Shift check-in/out
- [ ] Table merge/split
- [ ] Discounts engine
- [ ] Tips management
- [ ] Daily close (Z report)
- [ ] Admin dashboard
- [ ] Inventory items
- [ ] Stock movements
- [ ] Low stock alerts
- [ ] Inventory adjustments

<br>

### Fase 3 — Multi-Branch + Analytics

- [ ] Multi-branch support
- [ ] Cross-branch dashboard
- [ ] Menu popularity analytics
- [ ] Peak hours analysis
- [ ] Staff cost analysis
- [ ] Report export (CSV/PDF)
- [ ] Centralized menu management
- [ ] Events → reports pipeline

<br>

### Fase 4 — Polish + Escala

- [ ] PWA offline mode
- [ ] Offline sync
- [ ] Thermal printer support
- [ ] Multiple menu boards
- [ ] Customer display
- [ ] Bunz marketing promos
- [ ] KDS multiple stations
- [ ] KDS prep time tracking
- [ ] TastyIgniter data export
- [ ] TastyIgniter sunset
- [ ] Load test (100+ concurrent)
- [ ] Security audit

---

## Notas

- **bunz** siempre en minúscula
- 0 inline styles en apps nuevas (POS/KDS/Admin)
- Mini App existente se migrará gradualmente a Tailwind puro (no bloquear)
- FastAPI queda solo para: blockchain Oracle, AI workers, ETL scripts
- Reports se generan on-demand desde events, no se precomputan ni duplican
- Inventory V1 = stock + alerts. Nada de auto-reorder ni purchase orders
- Auth = Telegram + Magic Link. NO passwords
- Cada fase termina con deploy a producción y smoke test
- Al terminar cada fase, actualizar sección Progreso
