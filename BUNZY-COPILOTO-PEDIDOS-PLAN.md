# BUNZY · Copiloto del pedido (plan de implementación)

**Estado:** preparado, **no implementado** · **Creado:** 2026-11-03
**Decisiones abiertas:** ver §8 (necesitan respuesta del founder)

---

## 1 · Qué queremos

Que Bunzy deje de ser un asistente pasivo y acompañe al Rabbitter **durante y
después del pedido**:

1. Preguntar por lo que **realmente pidió** (dinámico, no genérico):
   *"¿Qué te está pareciendo tu café americano?"*
2. Capturar la **evaluación del producto/servicio** incluso **antes de pagar**.
3. Dejar la **evaluación del lugar** solo cuando ya pagó (flujo y sanción social).
4. Que Bunzy **actúe**: pedir la reseña en el momento correcto, recordarla si no
   se dejó, y responder con contexto del pedido.

---

## 2 · Lo que YA existe (no hay que construirlo)

| Pieza | Dónde | Estado |
|---|---|---|
| Tabla de reseñas por pedido | `orderRatings` (`packages/database-restaurant/.../schema/index.ts:231`) | ✅ 1 por pedido, `stars`, `attributes`, `comment`, moderación |
| Auditoría de reseñas | `orderRatingEvents` | ✅ append-only (creada/editada/anulada/reportada/moderada) |
| Regla de elegibilidad | `isOrderEligibleForRating` (`services/ratingRules.ts:23`) | ✅ exige estado `COMPLETED`/`PAID` **y** un pago `COMPLETED` |
| Ventana de edición | `RATING_EDIT_WINDOW_MS` | ✅ 24 h |
| Moderación automática | `resolveModerationStatus` | ✅ solo duplicado exacto → `PENDING_REVIEW`; el resto `VISIBLE` |
| Chips de evaluación | `ATTRIBUTES` | ✅ `atencion`, `comida`, `tiempo`, `ambiente` |
| Envío de reseña | `ratings.submitRating` (tRPC) | ✅ con guard de dueño y aviso al afiliado |
| Consulta de elegibilidad | `ratings.isOrderRateable` (tRPC) | ✅ `rateable`, `alreadyRated`, `reason` |
| Resumen para el negocio | `ratings.merchantRatingSummary` | ✅ ya aislado por tenant (`assertBranchAccess`) |
| Bunzy con modos | `src/lib/bunzy.ts` → `generateBunzyAssist` | ✅ `draft`, `summarize`, `admin_qa`, `marketing_proposal` |
| Knowledge base de Bunzy | `src/lib/support-content.ts` + `/api/bunzy/kb` | ✅ RAG con embeddings (FAQS + DOC_SECTIONS) |

**Conclusión:** el backend de reseñas del **lugar** ya está completo y cumple la
regla que pediste ("evaluación del lugar solo después de pagar"). Lo que falta
es (a) exponerlo al móvil, (b) el pulso **pre-pago** del producto, y (c) la capa
proactiva de Bunzy.

---

## 3 · Lo que falta

### 3.1 Endpoint REST para el móvil (bloqueante)

`ratings.*` vive en **tRPC** y lo consume el admin. La app móvil usa rutas REST
(`telegram-miniapp/src/app/api/...` con `getAuthenticatedUser`).

**Crear:**

```
GET  /api/orders/[id]/rating    → { rateable, alreadyRated, reason, myRating? }
POST /api/orders/[id]/rating    → { stars, attributes[], comment? }
```

Requisitos:
- Reusar `submitRatingForOrder` de `packages/api/src/services/ratingSubmit.ts`
  (no duplicar reglas).
- Autenticado por el dueño del pedido (`orders.customerId === caller.id`).
- Devolver los mismos `reason`: `NOT_PAID`, `NO_PAYMENT`, `WINDOW_CLOSED`,
  `NOT_YOURS`, `NOT_FOUND`.

### 3.2 Pulso pre-pago del producto (tabla nueva)

El modelo actual es **a nivel pedido**. Para preguntar por el producto antes de
pagar hace falta una tabla propia, separada del rating del lugar:

```sql
CREATE TABLE order_item_feedback (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  orderId         text NOT NULL,
  itemId          uuid,                    -- order_items.id (nullable: feedback general)
  customerUserId  text NOT NULL,
  sentiment       text NOT NULL,           -- 'UP' | 'DOWN'
  chips           jsonb,                   -- ['sabor','tiempo','temperatura','presentacion']
  comment         text,
  stage           text,                    -- etapa del pedido al responder (PREPARING/READY/DONE)
  createdAt       timestamp DEFAULT now()
);
CREATE UNIQUE INDEX ux_item_feedback_once
  ON order_item_feedback (orderId, coalesce(itemId::text, 'general'), customerUserId);
```

- **Sin moderación**: es un pulso privado del negocio, no una reseña pública.
- Se puede responder **varias veces por pedido** si pide más productos después
  (una por item).
- El negocio lo ve agregado (KDS/readiness y reportes), nunca con nombre.

### 3.3 Tarjeta de Bunzy en el móvil

Componente `BunzyOrderFeedback` (home y página del afiliado), montado donde hoy
vive la tarjeta de seguimiento:

| Momento | Qué pregunta | Regla |
|---|---|---|
| Pedido en `PREPARING`/`READY` | *"¿Qué tal va tu {item}?"* → 👍/👎 + chips | Solo si hay pedido activo **y** ≥1 item entregado o listo |
| Pedido `DONE` y **pagado** | *"¿Cómo estuvo {negocio}?"* → 1-5 estrellas + chips + comentario | Usa `isOrderRateable` (ya exige pago) |
| `DONE` **sin pagar** | Nada. Bunzy no pide reseña del lugar. | `NOT_PAID` |
| Ya calificó | No se vuelve a preguntar (editable 24 h desde el detalle) | `alreadyRated` |

Copy dinámico: Bunzy redacta con el `itemsSummary` real del pedido, no plantillas
fijas. Ej.: *"Se ve que van un americano y una concha — ¿qué tal van?"*

### 3.4 Bunzy proactivo (comportamiento)

Nuevo modo `order_companion` en `generateBunzyAssist`:
- **Entrada:** items del pedido, etapa, si pagó, historial de feedback.
- **Salida:** una sola pregunta corta (máx. 20 palabras) + nada de emojis
  excesivos.
- **Triggers** (máximo 1 mensaje por pedido y por etapa):
  1. Al pasar a `PREPARING`.
  2. Al pasar a `READY` (si no respondió el pulso).
  3. A las 2 h de `DONE` si pagó y no calificó (recordatorio único).
- **Nunca** insiste dos veces por el mismo motivo (flag por pedido/etapa).

### 3.5 Acciones que Bunzy puede ejecutar

| Acción | Cómo | Guard |
|---|---|---|
| Registrar pulso de item | `POST /api/orders/[id]/feedback` | dueño del pedido, 1 por item |
| Abrir el formulario de reseña | deep link al sheet con `orderId` | elegibilidad del server |
| Recordar la reseña | push interno (categoría `orders`) | máx. 1 por pedido |
| Sugerir "pedir otra vez" | si 👍 y el negocio está abierto | solo sugerencia, sin costo |

**Bunzy jamás** inventa saldos, emite Bunz, ni publica reseñas por el usuario:
solo abre el flujo y precarga lo que el usuario dijo.

---

## 4 · Flujo completo (deseado)

```
Pedido creado
   └─ (POS) Procesando  ──►  Bunzy: "¿Qué tal va tu café?"  ──► pulso 👍/👎 (privado)
   └─ (POS) Despachando ──►  Bunzy recuerda si no hubo pulso
   └─ (POS) Entregado
         ├─ pagado      ──►  Bunzy: "¿Cómo estuvo 626 Café?" ──► 1-5★ + chips + comentario
         └─ sin pagar   ──►  nada (el cobro sigue su curso)
Pagado 2 h después sin reseña ──► 1 recordatorio (push + tarjeta)
```

---

## 5 · Reglas y guardrails

1. **Sin pago no hay reseña del lugar.** Ya está en `isOrderEligibleForRating`.
2. **El pulso del producto no es público**: es señal operativa para el negocio.
3. **Una reseña por pedido** (editable 24 h), una sola vez por autor.
4. **Moderación**: solo duplicado exacto pasa a `PENDING_REVIEW`; el resto visible.
   Reportes manuales → `reviewFlag`.
5. **Anti-fatiga**: máximo 1 mensaje de Bunzy por etapa y 1 recordatorio post-entrega.
6. **Privacidad**: el negocio ve agregados, nunca "quién dijo qué" en el pulso.
7. **Accesibilidad**: el pulso debe responderse en ≤2 toques; el comentario es opcional.

---

## 6 · Fases de implementación

### Fase 1 — Reseña del lugar en el móvil (1–2 días)
- [ ] `GET/POST /api/orders/[id]/rating` reusando `submitRatingForOrder`.
- [ ] `BunzyOrderFeedback` (estado `DONE` + pagado) con estrellas, chips y comentario.
- [ ] Mostrar "ya calificaste" + editar dentro de 24 h.
- [ ] Probar con 626 Café y Bull Box.

### Fase 2 — Pulso pre-pago (1–2 días)
- [ ] Migración `order_item_feedback`.
- [ ] `POST /api/orders/[id]/feedback` (idempotente por item).
- [ ] UI 👍/👎 con chips contextuales (comida vs bebida vs servicio).
- [ ] Agregado en el admin: "Pulso del pedido" en Reportes (sin nombres).

### Fase 3 — Bunzy proactivo (1 día)
- [ ] Modo `order_companion` en `generateBunzyAssist`.
- [ ] Triggers por etapa con flag anti-repetición.
- [ ] Recordatorio post-entrega (push categoría `orders`).
- [ ] Ingesta del nuevo vocabulario en la KB (`/api/bunzy/kb`).

### Fase 4 — Cierre del loop (opcional)
- [ ] Si 👍 y el negocio está abierto → "¿Pido lo mismo otra vez?".
- [ ] Si 👎 → avisar al POS en la comanda (alerta discreta, sin exponer al cliente).
- [ ] Métricas: % de pedidos con pulso, % con reseña, tiempo medio a la reseña.

---

## 7 · Archivos que se tocarán

```
telegram-miniapp/src/app/api/orders/[id]/rating/route.ts      (nuevo)
telegram-miniapp/src/app/api/orders/[id]/feedback/route.ts    (nuevo)
telegram-miniapp/src/components/affiliate/BunzyOrderFeedback.tsx (nuevo)
telegram-miniapp/src/lib/bunzy.ts                             (modo order_companion)
telegram-miniapp/src/lib/support-content.ts                   (KB del producto)
packages/database-restaurant/src/schema/index.ts              (order_item_feedback)
packages/database-restaurant/migrations/manual/00XX_item_feedback.sql
packages/api/src/services/ratingSubmit.ts                     (reuso, sin cambios)
apps/admin/src/app/(dashboard)/reports/page.tsx               (agregado del pulso)
```

---

## 8 · Decisiones abiertas (para el founder)

1. **¿Pulso pre-pago público o privado?** Propuesta: **privado** (señal para el
   negocio). Si lo quieres público, necesita moderación y cambiar el diseño.
2. **¿Cada cuánto se puede preguntar?** Propuesta: 1 por etapa + 1 recordatorio.
3. **¿La reseña del lugar es obligatoria para ganar Bunz?** Hoy no. Si quieres
   incentivar, se puede dar un bono pequeño por primera reseña (requiere regla
   antidúplicados por usuario/negocio).
4. **¿El pulso 👎 debe alertar al POS?** Propuesta: sí, discreto y sin nombre.
5. **¿Idioma del copy?** Español MX, tono Bunzy (cercano, sin exagerar emojis).

---

## 9 · Cómo retomarlo

1. Leer §2 para no reconstruir lo que ya existe.
2. Empezar por **Fase 1** (endpoint REST + tarjeta) — es la que desbloquea todo.
3. Re-seed de la KB después de tocar `support-content.ts`:
   ```bash
   curl -X POST https://app.rabbitty.me/api/bunzy/kb \
     -H "x-bunzy-kb-secret: $BUNZY_KB_SECRET" \
     -H 'Content-Type: application/json' -d '{"action":"seed-support"}'
   ```
