# RABBITTY SCORE — Plan, Fases y Roadmap

> **Estado:** Fase 1 — ✅ CERRADA (implementada y ya en `main` vía merge FF `ecd406c`).
> Fase 2 (Trust & Engagement shadow) — 🔧 **EN RAMA** (implementada; migración `0022` pendiente de aplicar a prod manualmente → norma DRIFT-001).
> **Última actualización:** 2026-11-01
> **Dueño de producto:** Marco (God Admin)
> **Principio rector:** la reputación construye confianza; **no** toca la economía base (Bunz/cashback) en Fase 1.
>
> 📌 **Plan relacionado:** `Docs/PUSH-NOTIFICATIONS-PLAN.md` (v2.1) — el stack de notificaciones
> (outbox, realtime, FCM, geofencing con matriz nativa) se implementa en `main` y esta rama se
> rebasea sobre él antes de arrancar F2/F3, porque Trust & Engagement consume las mismas
> señales de proximidad y los mismos eventos de negocio.

---

## 1. Visión (una línea)

Un sistema de confianza de dos caras al estilo Uber: **Rabbitter Trust & Engagement** (confiabilidad del comensal), **Affiliate Service Quality** (calidad percibida del negocio) y **Rabbitty Growth Allocation** (distribución inteligente de promos/presupuesto), separado en 3 motores independientes para que ninguna señal contamine a otra.

## 2. Reglas de oro (no negociables)

1. **Cashback base ≠ beneficios promocionales.** El cashback base jamás se reduce por reputación; las promos pueden asignarse con scores calibrados (fase posterior) y siempre sujetas a presupuesto.
2. **Señales antifraude ≠ culpabilidad.** Correlación multi-cuenta (Gmail/IP/device/push token) marca `REVIEW_FLAG`; nunca sanciona sola.
3. **Shadow mode antes de dinero.** Ningún score mueve un peso, un lugar en el mapa o una campaña hasta validar poder predictivo.
4. **Anonimato del comensal frente al negocio.** El comercio ve estrellas y comentarios; **nunca** identidad.
5. **Nada de esto altera pago, ledger de Bunz, inventario o cierre de mesa** (invariante probado en cada entrega).

## 3. Fases

| Fase | Entregable | Estado | Notas |
|---|---|---|---|
| **F1-E1** | Rating post-pago (ambos canales: Stripe settle y efectivo con PIN) | ✅ **EN PROD** | Prompt in-app (RatingSheet) + web (WebRatingCard en /pay) |
| **F1-E2** | Superficie Affiliate (agregado, n, comentarios anónimos, estado de moderación) | ✅ **EN PROD** | `/ratings` (sidebar admin: Reputación de Servicio) |
| **F1-E3** | God Admin: reporte, moderación manual con motivo, historial, identidad solo-God | ✅ **EN PROD** | `moderateRating`/`moderationQueue`, `moderation_log` + `order_rating_events` |
| **F1-E4** | Shadow score interno (bayesiano suavizado, recencia, cobertura) | ✅ **EN PROD** | `ratings.merchantScoreShadow` (god) + snapshots `merchant_score_shadow`; sin uso operativo |
| **F1-tests** | Tests de aceptación (checklist §6) | ✅ Unit 10/10 + integración ROLLBACK | Suite API 31/31 |
| **F1-staging** | Validación manual del prompt en producción (ambos canales) | ⏳ Pendiente operativo | No bloquea F2 |
| **F2** | Rabbitter Trust & Engagement en shadow | 🔧 **EN RAMA** | Reglas puras + snapshot `rabbitter_score_shadow` + panel God en `/god/insights`. Pendiente: aplicar migración `0022` a prod y validación operativa |
| F3 | Growth Allocation (promos/visibilidad con scores calibrados) | ⏳ Pendiente | Requiere presupuesto/autorización + atribución de campañas |
| F4 | Beneficios variables y tiering vendible (liga con Analíticas Pro) | ⏳ Pendiente | Solo con datos de F2/F3 |
| F5 | Rabbitty Score público + multiplicadores | ⏳ Pendiente | Decisión económica explícita — no automática |

#### Backlog F2 — señales de Trust (en shadow)
| Señal | Fuente | Estado en F2 |
|---|---|---|
| Pagos completados vs abandonados | `payment_intents` por `payerSubjectId` | ✅ Componente `payments` (55%): SUCCEEDED sobre cerrados (90d); ≥3 cerrados para ser confiable. La atribución de abandono (¿fricción de producto o usuario?) sigue abierta → D-8 |
| Tabs huérfanas por causa | `orders.voidReason='STALE_TAB'` | ✅ Componente `tabs` (diagnóstico — NO entra al score consolidado hasta decidir D-7). Falta registrar actor (¿cliente u operador?) |
| Canjes legítimos vs abuso | `ledgerEntries` (ratio SPEND/EARN) + lupa multi-cuenta | ✅ Componente `ledger` (25%): sospecha si ratio > 2.5 o acumula ≥200 Bunz sin redimir — SOLO marca `reviewFlag`, nunca sanciona. Lupa ya existente (`getAccountSecurity.identityLinkSignals`) |
| Presencia honesta | `presenceSessions` (GPS ≤ geofence, `source: gps/scan/geofence`) | ✅ Componente `presence` (20%). `geofence` como fuente llega con push plan v2.1 (P4) — el componente ya la admite (`other` mientras tanto) |
| Estabilidad del chat | flags de bloqueo | NO medir en F2 (requiere proceso de revisión — decisión del review) |

**Método (shadow v1, `trust_shadow_v1`):** score 0–100 = promedio ponderado de los componentes CON datos suficientes (renormalización de pesos). Sin muestra suficiente en ninguno → `score: null` + `confidence: NONE`. `confidence`: HIGH (todo confiable + ≥10 pagos), MEDIUM (≥3 pagos + todo confiable), LOW (resto). Snapshot persistido en `rabbitter_score_shadow` (restaurant DB) con `reviewFlag` agregado de las 5 señales multi-cuenta (gmail cluster, IP, device, push token, ledger) — Regla de oro §2: solo revisión.

## 4. Hallazgos de auditoría que mandaron el diseño

| # | Hallazgo (verificado en código) | Resolución en F1 |
|---|---|---|
| H1 | `ORDER_PAID` **no se emite** en `confirmPaymentIntentSettled` (paymentCore.ts no tiene ningún `bus.emit`) — el canal digital no podía disparar el prompt | Se añade emisión con payload completo `{orderId, branchId, paymentId, method, amount}` post-commit |
| H2 | `ORDER_VOIDED` solo se emite en `voidOrder`; el sweep de tabs y la expiración de intent no lo emiten | Helper `invalidateOrderRating(orderId)` en las 3 transiciones + listener del bus + job de reconciliación |
| H3 | Payloads de `ORDER_PAID` en pos.ts son mínimos (`{orderId}`) | El listener re-hidrata por `orderId` (branch/customer) — defensivo |
| H4 | Las cortesías no tenían entitlements al activarse por webhook Stripe | Corregido en el batch de membresías (mismo repo) |
| H5 | Rating no debe usar propina / % Rabbitty Pay / velocidad de liquidación | Excluidos del score de servicio en F1 |

## 5. Diseño técnico F1

### 5.1 Persistencia (restaurantDb — nuevas tablas, sin tocar existentes)

- `order_ratings`: 1 fila por orden (`UNIQUE "orderId"`), `stars` 1-5, `attributes` JSONB (chips), `comment`, `isEligible`, `moderationStatus` (`VISIBLE|PENDING_REVIEW|HIDDEN`), `editedAt`, `reportedAt`, timestamps, `customerUserId` (text sin FK a core).
- `order_rating_events`: append-only — `CREATED|EDITED|VOIDED|REPORTED|MODERATED_HIDDEN|RESTORED`, before/after, actor, motivo.
- `moderation_log`: acciones de terceros (God), motivo obligatorio.
- `merchant_score_shadow`: snapshot diario del score interno + componentes (nunca expuesto al comercio).

### 5.2 Elegibilidad de una orden

`status ∈ {COMPLETED, PAID}` **y** existe `payments` COMPLETED **y** `order.customerId` = usuario autenticado. Nada de esto se confía al cliente: todo se valida por `orderId` server-side.

### 5.3 Método estadístico (shadow)

- Media ordinal con **shrinkage bayesiano**: `(Σstars + W·μ) / (n + W)`, `W=4`.
- `μ` inicial = 3.0 no informativo (n=0 → nunca público).
- Calibración mensual: `μ_global` con datos reales; `μ_segmento` (categoría) **solo si n_segmento ≥ 30**; si no, hereda global.
- Recencia: decaimiento exponencial, vida media 90 días.
- Público solo con `n ≥ 5`; antes: "Nuevo en Rabbitty / Reuniendo opiniones".
- Cobertura (`% órdenes evaluadas`) se muestra como **cobertura**, no satisfacción.

### 5.4 Señales sospechosas (solo revisión)

- Ocultamiento automático únicamente por **duplicado exacto verificable** (mismo texto byte-a-byte, mismo comercio, mismo usuario, ≥3 en 72h).
- Correlación multi-cuenta → `REVIEW_FLAG` para God. Nunca exclusión automática.

## 6. Checklist de aceptación (F1 — 9 pruebas no negociables)

| # | Prueba | Cobertura |
|---|---|---|
| 1 | Doble submit → 1 fila (UNIQUE + idempotente) | ✅ `ratings.integration.test.ts` (UNIQUE orderId) + router `.onConflictDoNothing` devuelve existente |
| 2 | Webhook duplicado → ni rating, ni pago, ni cashback duplicado | ✅ guard `SUCCEEDED` de `confirmPaymentIntentSettled` (paymentCore 337) + UNIQUE idempotencia del settle |
| 3 | Pago pendiente/fallido/3DS sin resolver → sin prompt | ✅ `isOrderEligibleForRating` (unit) + `isOrderRateable` |
| 4 | Orden anulada (3 rutas) → rating inelegible **inmediato** | ✅ `invalidateOrderRating` en VOID/EXPIRED/STALE_TAB + integración |
| 5 | Orden ajena → 403 sin revelar datos | ✅ `submitRating`/`isOrderRateable` (FORBIDDEN genérico) |
| 6 | Edición >24h → rechazo; válida → evento before/after | ✅ `canEditRating` (unit) + `order_rating_events` |
| 7 | Comentario reportado → fuera de agregados, visible a God | ✅ integración (agregado excluye PENDING_REVIEW) + `moderateRating` |
| 8 | Efectivo y digital → prompt solo post-settle COMPLETED | ✅ `isOrderEligibleForRating` (unit, ambos status) + emisión `ORDER_PAID` en ambos canales |
| 9 | Invariante económico: ledger/pagos idénticos | ✅ integración (snapshot antes/después) + módulo de reglas puro |

**Estado:** unitarios **10/10** (`ratingRules.test.ts`) · suite API **31/31**. Los integration tests corren solo con `TEST_DATABASE_URL` (nunca prod) y hacen ROLLBACK total.

Pendiente operativo (no bloqueante): validación en staging del prompt con una orden real en ambos canales.

## 7. Decisiones pendientes

| # | Decisión | Recomendación actual |
|---|---|---|
| D-1 | Listener: payload completo vs re-hidratación por `orderId` | Ambos (payload donde exista + re-hidratar) |
| D-2 | ¿El Rabbitter ve su propio historial de ratings en F1? | No (evitar gaming); reevaluar con data shadow |
| D-3 | ¿Prompt también en web `/pay`? | Sí, mismo endpoint |
| D-4 | ¿Comentario obligatorio con 1-2★? | No, siempre opcional |
| D-5 | Atribución de campañas (Growth) | F3; requiere `firstSeenCampaignId` en alta de cliente |
| D-6 | Presupuesto de promos cofinanciadas | F3/F4; tope % GMV + autorización God |
| D-7 | ¿Quién causa la tab huérfana (cliente vs operador)? Define si `tabs` entra al score | **Actual:** componente diagnóstico puro, fuera del score |
| D-8 | Atribuir abandono de payment intent: ¿fricción de UX (checkout→3DS) o del usuario? | F2 shadow lo clasifica como `expired/cancelled/failed` sin juzgar; decidir con datos |

## 8. Cómo darle seguimiento

- **Rama:** `feat/rabbitty-score` (base `main`). Merge solo con checklist §6 verde.
- **Métricas de adopción esperadas (F1):** ≥25% de órdenes elegibles con rating en la primera semana; ≥60% de comentarios legítimos visibles; 0 alteraciones al ledger (test #9).
- **Revisión de calibración:** a los 30/90 días se recalibran prior y W; se documenta en este archivo.
- **God panel:** agregados de reputación se integran a `/god/insights` en una iteración posterior (F2).
- **Riesgo principal a vigilar:** sesgo de respuesta (quien ratea no es muestra aleatoria) — la cobertura por segmento se monitorea desde el día 1.

## 9. Registro de cambios del documento

| Fecha | Cambio |
|---|---|
| 2026-11-01 | Creación. Versión final de alcance aprobada (9 puntos del review incorporados). Inicio de F1 en `feat/rabbitty-score`. |
| 2026-11-01 | **F1 implementada en rama** `feat/rabbitty-score`: migración `0020` aplicada a prod (4 tablas), emisión `ORDER_PAID` en settle digital, invalidación inmediata en 3 transiciones, router `ratings`, prompts in-app y web, superficie `/ratings`, moderación God y shadow score. |
| 2026-11-01 | **F1 CERRADA**: reglas puras extraídas a `services/ratingRules.ts`; tests unitarios 10/10 (checklist §6) + integration tests con ROLLBACK (requieren `TEST_DATABASE_URL`); suite API 31/31. |
| 2026-11-02 | F1 mergeada a `main` (FF `ecd406c`) — el dataset de ratings corre en producción. Rama lista para F2 (rebase sobre main cuando el plan de notificaciones v2.1 esté en P0/P1). |
| 2026-11-01 | **F2 en rama** (`feat/rabbitty-score`, rebaseada sobre main con push plan v2.1 y pin de drizzle): `trustRules.ts` puro + unitarios 16/16, migración `0022` (`rabbitter_score_shadow` — **aplicar a prod manualmente, norma DRIFT-001**), God queries `getRabbitterTrustShadow` + `rabbitterTrustShadowQueue`, panel shadow en `/god/insights`. Snapshot on-demand (patrón F1); sin cron. Pendiente operativo: correr snapshot contra datos reales y validación manual. |
