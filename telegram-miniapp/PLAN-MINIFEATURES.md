# PLAN DE ATAQUE — Miniapp Fixes

## FASE 1: 🔴 Bugs Críticos (funcionalidad rota)

| # | Issue | Archivos | Fix |
|---|-------|----------|-----|
| 1.1 | `pending_bunz` no existe en schema → referral page muestra 0 | `referral/page.tsx:72`, `api/auth/profile/route.ts` | Agregar `pendingBunz` calculado al perfil (sum referrals PENDING × rewardAmount) |
| 1.2 | `profile?.level` mal (es `levelId`) → siempre fallback a 1 | `referral/page.tsx:65` | Mapear levelId → name usando gamification API |
| 1.3 | Race condition en referralLogic (update no atómico) | `lib/referralLogic.ts:71` | Usar `sql` increment en vez de read+modify+write |
| 1.4 | Spend route no trigger referral/gamification | `api/transaction/spend/route.ts` | Agregar calls a `processReferralAndNotifications` + `awardHops` + `evaluateHatTricks` |

## FASE 2: 🟡 Stub APIs (503 errors)

| # | Issue | Archivos | Fix |
|---|-------|----------|-----|
| 2.1 | `POST /business/scan/redeem` → 503 | `api/business/scan/redeem/route.ts` | Implementar redeem con tabla coupons en schema |
| 2.2 | `POST /business/reserve` → 503 | `api/business/reserve/route.ts` | Implementar reserve (crear pendingReservations en schema) |
| 2.3 | `POST /business/credit` → 503 | `api/business/credit/route.ts` | Implementar credit (crear creditTransactions en schema) |

## FASE 3: 🟠 Mock Data → Real API

| # | Issue | Archivos | Fix |
|---|-------|----------|-----|
| 3.1 | Dashboard stats hardcodeadas | `MobileAffiliateDashboard.tsx:10-14` | Conectar a GET /api/business/transactions + GET /api/reservations |
| 3.2 | Portal dashboard stats hardcodeadas | `business-dashboard/portal/page.tsx:28-54` | Conectar a API real con queries agregadas |
| 3.3 | Coordenadas aleatorias al crear negocio | `api/business/route.ts:67-68` | Usar geocoding con Nominatim o permitir lat/lng manual |
| 3.4 | Hops target hardcodeado "500" | `profile/page.tsx:109` | Usar levels table para next level threshold |
| 3.5 | "Usar ubicación" hardcodea dirección | `BusinessSetupForm.tsx:162` | Usar Geolocation API real |

## FASE 4: 🟠 Auth & Seguridad

| # | Issue | Archivos | Fix |
|---|-------|----------|-----|
| 4.1 | Crea dueño SYSTEM_OWNER_* fantasma | `api/business/route.ts:59-65` | Rechazar con error si no hay owner real |
| 4.2 | No auth middleware en business API | `api/business/route.ts` | Validar initData como en otras rutas |
| 4.3 | mock_init_data fallback en affiliate page | `affiliate/[id]/page.tsx:250` | Quitar fallback mock |

## FASE 5: 🟢 Mock Pages → API Real

| # | Issue | Archivos | Fix |
|---|-------|----------|-----|
| 5.1 | Discover page hardcodeada | `discover/page.tsx` | Conectar a GET /api/business/search |
| 5.2 | Social feed hardcodeado | `social/page.tsx` | Conectar a GET /api/feed |
| 5.3 | Map markers hardcodeados | `map/page.tsx` | Conectar a GET /api/business (all with coords) |
| 5.4 | Level colors hardcodeados en profile | `profile/page.tsx:31-37` | Usar levels table colors |

## FASE 6: 🟢 Polish

| # | Issue | Archivos | Fix |
|---|-------|----------|-----|
| 6.1 | Google Business mock toggle | `BusinessSetupForm.tsx:173-182` | Quitar toggle si no hay integración real |
| 6.2 | Missing nav links (clients, settings) | `business/layout.tsx` | Crear pages stub o redirigir |
| 6.3 | Demo fiat hardcodeado 500 | `affiliate/[id]/page.tsx:272` | Hacer configurable |
