# Estado · 2026-11-15 — Memberships 15.1/15.2 + ajustes de app

> Documento de continuidad. Léelo antes de tocar membresías, Bunz o el POS.
> Cubre **qué está vivo**, **cómo está financiado** y **qué queda**.

---

## 1. Dónde vamos

| Fase | Estado |
|---|---|
| **15.1 — MVP Web2 de Memberships** | ✅ **Cerrada** (admin, app, POS, Stripe, ticket) |
| **15.2.1 — Misiones** | ✅ Hecho **sin Bunz** (insignias) |
| **15.2.2 — Bono de lealtad** | ✅ Hecho con **pozo respaldado** |
| **15.2.3 — Analítica de suscripciones** | ✅ Hecho (panel admin) |
| **Fase 12 — Campaign analytics** | ❌ Pendiente |
| **Ciclo de vida Stripe (renovación/cancelación)** | ⏳ Pendiente de prueba real |
| **Recompensas más ricas ligadas al uso** | ⏳ Siguiente (decisión de producto) |

Documentos de referencia (locales, `DOCS/` está en `.gitignore`):
- `DOCS/RABBITTY-MEMBERSHIPS-ROADMAP.md`
- `DOCS/ROADMAP.md` (Fases 12 y 15)

---

## 2. Economía de Bunz: la regla que no se rompe

**No se emite un Bunz sin respaldo.** Toda emisión está anclada a:

1. **Compra pagada** → cashback = `tasa del negocio` (20 % por defecto) × monto.
   El mint **aumenta la capacidad del negocio** para aceptar canjes (`ownedBusinesses.bunzBalance`).
2. **Bono de lealtad** → sale de un **pozo** que es un porcentaje del **neto de la
   membresía ya cobrada**. No se apoya en la venta (ya usada al 100 % en el cashback base).

### Bono de lealtad (15.2.2)

Implementado en:
- `telegram-miniapp/src/lib/membershipLoyalty.ts` (cálculo)
- `telegram-miniapp/src/app/api/pos/reward/route.ts` (aplicación en el cobro)

```
pozo mensual = (precio del plan × 0.92) / meses_del_ciclo × 10 %
bono por compra = min( floor(baseBunz × pct_nivel), pozo_restante, 15 )
```

| Nivel | Renovaciones | Bono |
|---|---|---|
| Bronce | 0–1 | 0 % |
| Plata | 2–4 | +10 % |
| Oro | 5+ | +20 % |

Reglas duras:
- Solo membresías **pagadas** (`membershipOrigin = PURCHASED`, con `paymentProvider` real). **Cortesías, invitaciones y promos no bonifican.**
- **Nunca** sobre consumos cubiertos por la membresía (esos no emiten Bunz).
- **No acumulable** con campañas flash: si hay boost, gana el boost.
- Tope **15 Bunz/ticket** + remanente del pozo (ventana móvil de 30 días).
- Trazabilidad en `ledger_entries.metadata`: `loyaltyBonus`, `loyaltyTier`, `loyaltyPool`, `subscriptionId`.

**Interruptores sin deploy** (env, Vercel miniapp):
- `LOYALTY_MULTIPLIER=off` → apaga el bono.
- `LOYALTY_POOL_PCT` (default `10`, en %).
- `LOYALTY_MAX_PER_ORDER` (default `15`).

> Si se cambia el % o el tope, actualizar también `packages/api/src/routers/memberships.ts`
> (`loyaltyAnalytics` replica las mismas constantes para el panel).

### Dónde se ve el bono
- **Ticket**: “Incluye +N Bunz por lealtad” (ESC/POS y ticket en pantalla).
- **Admin → Memberships → Bono de lealtad**: bonificado, pozo disponible, % de
  consumo, órdenes bonificadas y detalle por socio.

---

## 3. Misiones (15.2.1) — sin dinero

`telegram-miniapp/src/app/api/memberships/missions/route.ts` + panel en `/memberships`.

El progreso se **deriva** de datos existentes (no hay tablas nuevas):

| Misión | Medición | Insignia |
|---|---|---|
| Visita 3 veces esta semana | días con actividad (canje o compra con rewards) | Explorador |
| Usa 2 beneficios este mes | unidades de `entitlement_usages` (30 días) | Constante |
| Sostén tu membresía | periodos completos pagados | Veterano |

**Las insignias no emiten Bunz.** Si algún día llevan premio real (upgrade,
prioridad, acceso), decidir si lo paga el negocio por mostrador o el **pozo**.

---

## 4. Flujo de membresías (para no romperlo)

1. **Alta**: `/memberships` → marketplace → `/memberships/plan/[id]` →
   `/api/memberships/checkout` (Stripe Connect, `mode: subscription`, fee 8 %)
   o venta en caja (`CASH_POS`/`PROMO`).
2. **Webhook**: `apps/admin/src/app/api/webhooks/stripe/route.ts` activa/renueva
   y provisiona entitlements.
3. **Pase**: `/memberships` y Rabbitty Pass (QR firmado de 30 s).
4. **Canje en POS**: el POS escanea el pase → `resolvePass` → auto-aplica
   beneficios → `redeemAtPOS` (atómico, idempotente).
5. **Cierre**: `directCheckout` → mint de Bunz (con bono de lealtad) → ticket.

⚠️ El **ticket** tiene reglas propias (commit `0710e06`): si la membresía cubre
todo, **no imprime Bunz ni QR**; si hay pago dividido, imprime el desglose y el
QR solo si no hubo crédito automático.

---

## 5. App móvil: decisiones recientes que no se deben revertir

| Tema | Decisión |
|---|---|
| **Mapa** | MapLibre + OpenFreeMap (vectorial, sin key) con estilo propio en `features/map/style/rabbittyStyle.ts`. Fallback automático a Leaflet (`NEXT_PUBLIC_MAP_ENGINE=leaflet`). **El contenedor lleva tamaño en línea** (maplibre-gl.css anula `absolute`). |
| **Loader** | `components/ui/BunnyInlineLoader.tsx` (mismo del pull-to-refresh). El mapa lo muestra hasta el primer `idle` (tiles pintados), tope 3.5 s. |
| **Pines** | Logo del afiliado si existe. `safeLogoUrl` acepta rutas relativas y data URLs de imagen; sigue bloqueando `javascript:`. |
| **Voz del mapa** | Cierre por silencio (web 1.4 s; iOS 4 s de gracia + 1.4 s y tope 15 s). Tocar el mic cierra y **procesa** lo dictado. |
| **Notas de voz del chat** | Se descargan con `getAuthHeaders()` y se reproducen desde blob. En chats **E2E** se descifran (el efecto de descifrado no debe ser pisado por la URL del proxy). |
| **Notificaciones** | Rutas viejas se traducen (`/pos` y `/business-dashboard` → `/business`); destino inválido = aviso, no 404. |
| **Rabbitty Pass** | QR **estándar** por defecto (BrandQR), Rabbitty Code neón a un toque. Acciones “Mi Membresía” + “Ver QR”. Swipe con guía, temas, opciones. |
| **Errores de pantalla** | `src/app/error.tsx` evita la pantalla en blanco. |

---

## 6. Qué falta (orden sugerido)

1. **Prueba de ciclo de vida** (sin código):
   - suscribirse con tarjeta de prueba a un plan real;
   - verificar activación por webhook y `currentPeriodEnd`;
   - cancelar (`cancelAtPeriodEnd`) y confirmar que el pase sigue activo hasta el corte;
   - dejar expirar y comprobar que el canje falla con mensaje claro.
2. **Recompensas ligadas al uso** (producto): elegir entre insignia, upgrade o
   prioridad, y si alguna lleva Bunz, financiarla del pozo (nunca emisión libre).
3. **Campaign analytics** (Fase 12): apertura/entrega por campaña.
4. **Ajuste del 10 %** con datos reales de 30–60 días (panel admin).

---

## 7. Archivos clave

```
packages/api/src/routers/memberships.ts        # planes, suscripción, canje, analytics, loyalty
packages/api/src/routers/pos.ts                # checkout, mint, bono de lealtad
telegram-miniapp/src/lib/membershipLoyalty.ts  # pozo + niveles + topes
telegram-miniapp/src/app/api/pos/reward/route.ts
telegram-miniapp/src/app/api/memberships/*     # list, checkout, pass, missions, manage
telegram-miniapp/src/components/ui/MembershipCard.tsx   # Rabbitty Pass
telegram-miniapp/src/components/ui/BrandQR.tsx          # QR estándar con identidad
telegram-miniapp/src/app/memberships/page.tsx           # pase, marketplace, misiones
apps/admin/src/app/(dashboard)/memberships/page.tsx     # planes, miembros, bono
apps/admin/src/lib/print-engine/payload-builder.ts      # ticket ESC/POS
apps/admin/src/app/(pos)/pos/page.tsx                    # escaneo de pase + cobro
```

**Comandos**:
- typecheck: `npx tsc --noEmit` en `telegram-miniapp`, `apps/admin`, `packages/api`
- build: `npx next build` en `telegram-miniapp` y `apps/admin`
- despliegue: push a `main` → Vercel (app) y Railway (`rabbitty-admin`, watch `apps/**`)

---

## 8. Preferencias de consumo + Bunzy (implementado 2026-11-15)

> Especificación completa: `DOCS/PREFERENCIAS-CONSUMO-Y-BUNZY.md`.
> Decidido: **opt-in explícito**, favorito **por negocio + categoría global**,
> umbral **precio × 1.05**, **1/negocio/72 h y 3/semana**, y **barista con opt-in**.

### Lo que está vivo

| Pieza | Dónde |
|---|---|
| Tablas `user_preferences` y `preference_nudges` | migración `0011_user_preferences.sql` **aplicada en prod** |
| Agregación de pedidos (180 días, decaimiento 45) | `apps/admin/src/app/api/cron/preferences` (POST) |
| Avisos "ya te alcanza" | `apps/admin/src/app/api/cron/preference-nudges` (POST) |
| API del Rabbitter | `telegram-miniapp/src/app/api/preferences` (GET lista, POST favorito explícito) |
| Categoría push `favorites` + tipo `PREFERENCE_ALERT` | `packages/events` |
| Opt-in | Ajustes → "Avisarme cuando me alcance para mi favorito" (`pushRules.favoriteAlerts`) |
| "Tu favorito aquí" + "Lo de siempre" | `telegram-miniapp/src/app/affiliate/[id]/page.tsx` |
| "Suele pedir: X" al barista | `pos.customerFavorite` + chip en el POS (solo con opt-in) |
| Favoritos agregados del negocio | `businessAnalytics.topFavorites` + panel de Admin |

### Reglas del aviso (todas obligatorias)
`score ≥ 0.25` · `≥ 3` señales · opt-in · categoría no silenciada · saldo ≥ precio × 1.05
· producto activo y disponible · sin aviso de ese favorito en 72 h · máx 3/semana
· fuera de 21:00–09:00 (hora México) · negocio APPROVED/VERIFIED.

### Operación
1. **Crons ya programados en GitHub Actions** (secretos `CRON_SECRET` y opcional `ADMIN_APP_URL`):
   - `.github/workflows/preferences-cron.yml` → `POST /api/cron/preferences`, diario **09:00 UTC (03:00 MX)**.
   - `.github/workflows/preference-nudges-cron.yml` → `POST /api/cron/preference-nudges`, **cada 2 h** (el endpoint aplica el horario de silencio y los topes).
2. **Medición**: al abrir la ficha de un negocio se llama `POST /api/preferences/visit`, que marca `openedAt` y `convertedAt` del último aviso (7 días). El panel de Admin muestra **avisos enviados / apertura / conversión (30 d)**.
3. **Fase 3 viva**:
   - **franja habitual** (`DAY_PART` calculado en la agregación): el aviso "ya te alcanza" solo sale dentro de la franja del producto ("tu café de las 8:30");
   - **riesgo de abandono** (`CHURN_RISK`): si no viene en 21 días y le alcanza, aviso semanal con dedupe por semana.
4. **Insights**: favoritos y categorías agregadas por negocio (`topFavorites`, `topCategories`).
2. Verificar datos:
   ```sql
   SELECT kind, "businessId", label, score, "signalCount", explicit
   FROM user_preferences ORDER BY score DESC LIMIT 20;
   SELECT count(*) FROM preference_nudges WHERE "sentAt" > now() - interval '7 days';
   ```
3. Apagar por usuario: el usuario desactiva el opt-in (Ajustes). Apagar global:
   dejar de programar el cron o silenciar la categoría `favorites`.
4. Un favorito **explícito** nunca se pisa: la agregación lo respeta (`explicit = true`).

### Pendientes de esta línea
- **Promo sobre el favorito** (cruzar campañas flash con `user_preferences`).
- **Bunz por vencer**: requiere lotes con caducidad (hoy el saldo es agregado, sin vencimiento por lote).
- Insights por cohorte/segmento y forecast de inventario.
- Comparar conversión con/sin aviso (hoy se mide, no se A/B testea).
