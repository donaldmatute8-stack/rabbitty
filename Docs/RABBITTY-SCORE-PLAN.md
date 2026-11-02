# RABBITTY SCORE — Plan, Fases y Roadmap

> **Estado:** Fase 1 — ✅ CERRADA (implementada y ya en `main`: rating en prod con canal nativo verificado).
> Fase 2 (Trust & Engagement shadow) — 🔧 **EN RAMA** (implementada; en el cierre: migración `0022` → §10).
> **Última actualización:** 2026-11-02
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
| **F1-staging** | Validación manual del prompt en producción (ambos canales) | 🔴 **BLOQUEADO POR EL BUG H6** — probar de nuevo tras deploy con `RATING_INTERNAL_SECRET` en Vercel (miniapp + admin); los atributos chips/comentarios ya funcionan, el submit es lo que colgaba | No bloquea F2 |
| **F2** | Rabbitter Trust & Engagement en shadow | 🔧 **EN RAMA** | Reglas puras + snapshot `rabbitter_score_shadow` + panel God en `/god/insights`. Pendiente: aplicar migración `0022` a prod y validación operativa |
| F3 | Growth Allocation (promos/visibilidad con scores calibrados) | 🔧 **SHADOW EN RAMA (code only)** | Motor puro `allocRules.ts` + query `getGrowthAllocationShadow` + panel en `/god/insights`. Nada operativo — requiere presupuesto/autorización (D-6) + data de atribución D-5 acumulándose. Bunzy entra como advisor (Bx2) cuando haya data |
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
| H6 | **BUG de device (2026-11-02):** el submit del rating por canal NATIVO/miniapp ("carga y no pasa nada") — el proxy `/api/pay/rate` llamaba `ratings.submitRating` (protectedProcedure de la sesión admin) SIN sesión; el pago sí liquidaba porque `payments.*` usa `publicLimitedProcedure` con su propio scoping | Motor extraído a `ratingSubmit.ts` compartido + canal interno `/api/internal/rating` (secret) + proxy con autenticación y timeout 8s. ✅ **resuelto con prueba device del 2026-11-02 07:04 (ka13) — rating entró completo** |
| H7 | **Race de cierre QR (2026-11-02):** al cerrar el QR el POS cancelaba a ciegas el intent; el comensal pagaba el intent regenerado seconds después → "POS cancelada" con pago vivo | `resolveStripeModalClose` re-lee el intent antes de cancelar + POS rastrea por ORDEN (`payments.latestIntentForOrder`) en vez de por intent muerto |
| H8 | **Cashback sin acreditación (2026-11-02, ka13 $185):** webhook liquidó pero intent ganador tenía `payerSubjectId NULL` (pagó vía link de cuenta /pay con intent regenerado) → el mint de Bunz no ocurrió ni notificación. Orden COMPLETED con customerId vinculado + 0 ledger | `reconcileOrderCashback()`: fallback payer = cualquier intent con payer → `orders.customerId`; ruta de re-ejecución `/api/internal/cashback-reconcile` (UNA orden o barrido por días, idempotente) para recuperar retroactivo |

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
| D-5 | Atribución de campañas (Growth) | ✅ **INSTRUMENTADO (2026-11-01):** columna `users.firstSeenCampaignId` (nullable, sin FK a propósito) + captura en los 2 puntos de alta real: `auth/telegram` (prefijo `camp_{campaignId}` en startParam, solo en creación y solo si la campaña existe) y `auth/otp/verify` (body.campaignId opcional — el front lo pasará cuando existan links de campaña en /login). Migración manual `0017` **aplicada a prod** (norma DRIFT-001). La data acumula durante el corredor shadow → insumo listo para F3 |
| D-6 | Presupuesto de promos cofinanciadas | F3/F4; tope % GMV + autorización God |
| D-8 | Atribuir abandono de payment intent: ¿fricción de UX (checkout→3DS) o del usuario? | F2 shadow lo clasifica como `expired/cancelled/failed` sin juzgar; decidir con datos |
| D-9 | ¿Recompensar evaluar con hops (+2 hops por rating honesto, cap/coldown anti-gaming)? Levanta cobertura y suaviza el sesgo de respuesta sin tocar el score | **Pendiente decisión de Marco** — no implementado hasta su visto bueno |
| D-10 | Regla de economía del cashback (auditoría 2026-11-02): el settle del QR-Bunz minteaba cashback sobre TODA la venta aunque se pagara 100% en Bunz — doble-beneficio | ✅ **DECIDIDO y APLICADO: el cashback SOLO se gana con venta fiat** — `fiatMxn = amountMxn − bunzAmount` en `paymentIntentDomain` (settle) y `reconcileOrderCashback` (H8; skip `NO_FIAT`). Pagos mixtos: proporcional al fiat. Registry: los Bunz no generan Bunz |
| D-12 | **Pagar con Bunz → configuración comercial del afiliado** | ✅ **IMPLEMENTADO (H16)**: Nivel A Rabbitty(server: saldo, atomicidad, 0 cashback D-10, ledger) + Nivel B comercial (módulo, ALWAYS/SCHEDULE, min/max, daily límite atómico advisory-lock) en Settings→Bunz, mobile-responsive. Si no disponible → botón NO aparece (eval server-side, reason codes para telemetría) |
| D-13 | **Liquidación Bunz del negocio**: ¿el afiliado recibe los Bunz en su bunzBalance propio (re-utilizables en Rabbitty) o se consideran consumidos al pagarse? **CAMBIA ledger + settlement** | **PENDIENTE de decisión Marco** — recomendación actual: bundling credit a `ownedBusinesses.bunzBalance` (circuito cerrado: reciben, aceptan, sin promesa fiat) — NO implementado aún hasta decisión |
| D-11 | **GRATIFICACIONES VOLUNTARIAS (2026-11-02, implementado):** catálogo controlado por Rabbitty — modo por canal (OFF/POS/DIGITAL/BOTH) + subset [5,10,15], NADA preseleccionado, "No dejar" siempre primera, independiente del método de pago (server: gratuityRules + guard en directCheckout — cap 15% sin opt-in, estricta por catálogo con opt-in). Conciliación: pool de propinas del equipo (Corte Z) | ✅ Implementado en prod — habilitado en Ka13 y 626 CAFE para pruebas. DIGITAL quedará activo con Stripe rebuild (D-12) |
| D-8 | Atribuir abandono de payment intent: ¿fricción de UX (checkout→3DS) o del usuario? | F2 shadow lo clasifica como `expired/cancelled/failed` sin juzgar; decidir con datos |

## 8. Cómo darle seguimiento

- **Rama:** `feat/rabbitty-score` (base `main`). Merge solo con checklist §6 verde.
- **Métricas de adopción esperadas (F1):** ≥25% de órdenes elegibles con rating en la primera semana; ≥60% de comentarios legítimos visibles; 0 alteraciones al ledger (test #9).
- **Revisión de calibración:** a los 30/90 días se recalibran prior y W; se documenta en este archivo.
- **God panel:** agregados de reputación se integran a `/god/insights` en una iteración posterior (F2).
- **Integración Bunzy (motor de scoring/optimización):** definida en `BUNZY_ROADMAP_SUPREMO.md` §11 (Bx0→Bx3). Trigger: F2 cerrado + ≥30 días de snapshots shadow — **no el 100% del Score, no "ahora"**. Bx0 entra con F2, Bx2 apoya F3/F4 con propuesta + aprobación humana.
- **Instrumentación para F3:** `firstSeenCampaignId` en alta de cliente (D-5) — se implementa ANTES de F3 para que la data de atribución acumule durante el corredor shadow.
- **Riesgo principal a vigilar:** sesgo de respuesta (quien ratea no es muestra aleatoria) — la cobertura por segmento se monitorea desde el día 1.

## 9. Registro de cambios del documento

| Fecha | Cambio |
|---|---|
| 2026-11-01 | Creación. Versión final de alcance aprobada (9 puntos del review incorporados). Inicio de F1 en `feat/rabbitty-score`. |
| 2026-11-01 | **F1 implementada en rama** `feat/rabbitty-score`: migración `0020` aplicada a prod (4 tablas), emisión `ORDER_PAID` en settle digital, invalidación inmediata en 3 transiciones, router `ratings`, prompts in-app y web, superficie `/ratings`, moderación God y shadow score. |
| 2026-11-01 | **F1 CERRADA**: reglas puras extraídas a `services/ratingRules.ts`; tests unitarios 10/10 (checklist §6) + integration tests con ROLLBACK (requieren `TEST_DATABASE_URL`); suite API 31/31. |
| 2026-11-02 | F1 mergeada a `main` (FF `ecd406c`) — el dataset de ratings corre en producción. Rama lista para F2 (rebase sobre main cuando el plan de notificaciones v2.1 esté en P0/P1). |
| 2026-11-02 | **H6 corregido (bug de device en staging nativo)**: motor de submit extraído a `services/ratingSubmit.ts` (dual-canal: tRPC web + interno HTTP) + `/api/internal/rating` en admin con `x-rating-secret` + proxy `/api/pay/rate` ahora autentica al comensal, manda `userId` validado y con timeout 8s. Pendiente deploy: env `RATING_INTERNAL_SECRET` en Vercel (miniapp + admin). Tests del rating 10/10. |
| 2026-11-02 | **Prueba device ka13 07:04 (post-H6):** rating nativo ✅ entró completo (stars+chips+comentario). Descubiertos H7 (race de cierre QR) y H8 (cashback sin mintear por intent sin pagador) — ambos corregidos en rama. |
| 2026-11-02 | **F1-staging VALIDADO en device (ka13):** rating nativo entró completo (stars/chips/comentario) post-H6 + secret. **H7/H8 descubiertos y corregidos en el mismo session** (race de cierre QR y cashback sin mint por intent sin pagador). **D-10 RESUELTA:** cashback solo con venta fiat (`fiatMxn = amountMxn − bunzAmount`); pagos 100% Bunz ⇒ 0 cashback; mixtos ⇒ proporcional. Auditoría cashback full (4 rutas × Rabbitter/Afiliado × POS/nativa) sin otros hallazgos. |
| 2026-11-02 | **F3 SHADOW en rama (code only)**: `allocRules.ts` puro (servicio 40% + eficiencia 35% + momentum 25%, recomendaciones BOOST/REFILL/NURTURE/PAUSE/OPTIMIZE/KEEP con reasons explicables) + unitarios 8/8 + `getGrowthAllocationShadow` en god + panel shadow en `/god/insights`. **Nunca operativo** — acciones requieren aprobación humana (D-6). Bunzy Bx2 entra cuando haya data shadow madura. |
| 2026-11-01 | **GATE de mañana (marco, 2026-11-02):** pruebas del flujo pago 1-paso con propina + prompt rating (F1) **en un tenant real** — cierre de F1-staging y del §14-5 (pagos no cuelgan). Resultado = GO para ejecutar el cierre de F2 (§10: F2-1/F2-2) y arrancar la cuenta regresiva de 30 días (Bunzy Bx0 / F3). |
| 2026-11-01 | **D-5 instrumentado (F3-ready)**: `users.firstSeenCampaignId` + captura en alta Telegram (`camp_` en startParam) y OTP verify (body opcional); migración `0017` aplicada a prod. La atribución acumula desde ya durante el shadow. |
| 2026-11-01 | **F2 en rama** (`feat/rabbitty-score`, rebaseada sobre main con push plan v2.1 y pin de drizzle): `trustRules.ts` puro + unitarios 16/16, migración `0022` (`rabbitter_score_shadow` — **aplicar a prod manualmente, norma DRIFT-001**), God queries `getRabbitterTrustShadow` + `rabbitterTrustShadowQueue`, panel shadow en `/god/insights`. Snapshot on-demand (patrón F1); sin cron. Pendiente operativo: correr snapshot contra datos reales y validación manual. |

## 10. Pendientes de F2 — para cerrar y pulir (ANOTADO, no bloquea; se hace al finalizar)

| # | Pendiente | Tipo | Cuándo hacerlo |
|---|---|---|---|
| F2-1 | Aplicar migración `0022` a prod Neon: `psql -f packages/database-restaurant/migrations/0022_military_iron_lad.sql` (norma DRIFT-001, nunca `db:migrate` auto) | Migración | Al cerrar F2 |
| F2-2 | Correr snapshots reales desde `/god/insights` (persist: true) contra 2-3 subjectIds con data viva y validar insumos (pagos/tabs/ledger/presence caen coherentes) | Validación | Al cerrar F2 |
| F2-3 | Cron opcional de snapshots diarios (hoy es on-demand como F1) — solo si God lo pide, no antes | Enhancement | Después de F2-2 |
| F2-4 | Decidir D-7 (actor de tab huérfana: cliente vs operador) — si es del usuario, `tabs` entra al score | Decisión | Con datos shadow |
| F2-5 | Decidir D-8 (atribución de abandono de intent: ¿fricción de UX o del usuario?) | Decisión | Con datos shadow (30-90d) |
| F2-6 | Exponer `source: 'geofence'` en `presenceSessions` cuando push plan P4 entregue el instrumento nativo (el componente ya lo admite) | Extension | Con P4 |
| F2-7 | Integrar Trust a `/god/insights` resumen ejecutivo / insights de negocio (hoy el panel vive en God solo) | UI | Con F3/F4 |
| F2-8 | Calibration pass: revisar pesos (55/25/20), umbrales de abuso (ratio 2.5, 200 Bunz) con distribución real | Tuning | 30-90 días |
| F2-9 | Push/desplegar rama + merge a main cuando: migration aplicada y validación F2-2 verde (checklist §6 del merge) | Git | Al cerrar F2 |

> **Regla:** F2 en shadow NO bloquea nada operativo. Los F2-x se ejecutan juntos al decidir "finalizar y pulir" — probablemente junto con la validación 30-90 días o al arrancar F3.
