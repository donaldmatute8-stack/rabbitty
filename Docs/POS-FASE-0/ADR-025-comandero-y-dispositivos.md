# ADR-025 · Comandero digital y enlace de dispositivos

**Estado:** propuesta (13-nov-2026)
**Objetivo:** que un mesero tome la orden desde un celular o tablet, la mande a
cocina/barra y la caja cobre **la misma cuenta**. Un solo ticket, no dos.

---

## 1. Qué es el comandero (y qué no)

**Es** una pantalla táctil para tomar la orden en la mesa:

- elegir mesa (o para llevar / mostrador)
- menú por categorías, búsqueda, **precios en MXN**
- por platillo: cantidad, **extras** (modificadores con precio), **notas**,
  **alergias**
- enviar a la estación que corresponda (cocina, barra, postres)
- dejar la cuenta **abierta** para que la caja cobre después

**No es** un punto de cobro:

- no cobra, no pide método de pago, no divide
- **no maneja propina** (eso es de caja)
- no emite CFDI (eso es de caja)

La regla que lo hace simple: **el comandero abre la cuenta, la caja la cierra.**

---

## 2. Dónde vive

`apps/admin` → ruta **`/comandero`**, dentro del mismo grupo `(pos)`.

Razones (todas de costo y consistencia):

| Alternativa | Veredicto |
|---|---|
| Ruta nueva en el admin | **elegida** — misma auth, mismo tRPC, mismas estaciones, cero infra nueva |
| App separada (Railway) | descartada: otro servicio que pagar y otra sesión que mantener |
| PWA instalable | **incluida** — "Añadir a pantalla de inicio" en iPhone/Android; sin tiendas |

El kiosko existente (`/kiosk`) es **autoservicio con pago**; el comandero es otra
cosa y no lo reemplaza. Comparten menú y estaciones, no flujo.

---

## 3. Cómo se enlazan los dispositivos (ya construido)

El modelo de terminales del POS ya resuelve esto. El comandero lo reutiliza tal
cual, sin inventar otro mecanismo:

```
Admin                        Dispositivo                    Servidor
  │                               │                             │
  │  crea terminal + estación     │                             │
  │──────────────────────────────►│  guarda deviceKey (local)   │
  │                               │                             │
  │                               │ createAuthRequest(deviceKey)│
  │                               │────────────────────────────►│
  │                               │◄── código de 6 dígitos ─────│
  │  aprueba el código            │                             │
  │──────────────────────────────►│                             │
  │                               │ issueSession(deviceKey)      │
  │                               │────────────────────────────►│
  │                               │◄── token 24 h ───────────────│
  │                               │  x-pos-terminal-token        │
  │                               │                             │
  │                               │ startShift(PIN)  (mesero)   │
  │                               │────────────────────────────►│
  │                               │◄── x-pos-operator-token ────│
```

Lo que ya existe y se usa sin cambios:

- `pos_terminals` con `deviceKeyHash`, `stationId`, `status`, `expiresAt`
- códigos de autorización (`posAuthRequests`) con caducidad y rate limit
- sesiones de terminal (`pos_terminal_sessions`, 24 h)
- turno por PIN del empleado (`posOperators.startShift`)
- revocación desde *Ajustes → Terminales*

Lo que hay que añadir:

- **`pos_terminals.kind`** (`CASHIER` | `COMANDERO` | `KDS`) y una lista de
  capacidades, para que el servidor no deje cobrar desde un comandero ni tomar
  pedidos desde una caja si el negocio no quiere.
- **QR de vinculación**: el admin muestra un QR con un código de un solo uso; el
  celular lo escanea y queda enlazado sin teclear nada.

---

## 4. Cómo queda cableado con POS y KDS

```
   COMANDERO (mesero)                CAJA (POS)                COCINA/BARRA (KDS)
   ─────────────────                ──────────                ──────────────────
   abre cuenta de mesa
   agrega platillos      ─────────► orders (PENDING)
   notas/alergias/extras            │                        └─► cola por estación
   envía a estación                 │                            (outbox → Centrifugo)
                                    │
                                    │  ve la misma cuenta abierta
                                    │  cobra (efectivo/tarjeta/Bunz)
                                    └─► orders (COMPLETED)
```

Todo pasa por la **misma** tabla `orders` y el mismo helper de mutaciones
(`withOrderMutation`): versión, bitácora y bloqueo de orden. Por eso no pueden
existir dos tickets de la misma mesa: el comandero y la caja editan la misma
orden abierta.

- **Ruteo a estación**: `resolveStationsForItems` al agregar el ítem (ya existe).
- **Tiempo real**: el outbox publica `order.item.added` al canal de la estación
  (ya existe).
- **Impresión**: la estación ya tiene `printerId`; el comandero puede imprimir
  la comanda de cocina o no, según el negocio.
- **KDS**: el standalone está apagado (sin cocina activa); mientras tanto la
  cocina usa `/kitchen` del admin. Cuando se encienda, el comandero no cambia
  nada: el evento ya va al mismo canal.

---

## 5. Roles y permisos

El comandero **no** recibe la sesión del administrador. Usa terminal + turno.

| Rol | Puede | No puede |
|---|---|---|
| **Mesero** (`POS_ORDER`) | abrir mesa, agregar, mandar a cocina, ver cuentas abiertas | cobrar, reembolsar, anular cobros, abrir/cerrar caja |
| **Cajero** (`POS_CHARGE`) | todo lo anterior + cobrar | reembolsar |
| **Encargado** | todo | — |

El `kind` de la terminal refuerza esto en el servidor: un `COMANDERO` no puede
llamar `directCheckout` aunque el rol lo permitiera.

Auditoría: cada ítem queda con `staffId` del turno y la terminal que lo capturó.

---

## 6. Lo que falta construir (gaps reales)

| # | Gap | Qué implica | Fase |
|---|---|---|---|
| G1 | **Alergias** no existen como campo | migración `order_items.allergies` + mostrarlo en KDS y comanda | 1 |
| G2 | **Extras con precio no se cobran** | `addToCart` ignora `menuItemModifiers.priceAdjust`; hay que validarlo en servidor y sumarlo al ítem | 1 |
| G3 | Terminal sin `kind`/capacidades | migración `pos_terminals.kind` + guardas en `posProcedure` | 1 |
| G4 | No hay pantalla de comandero | `/comandero`: mesas → menú → ítem → carrito → enviar | 2 |
| G5 | KDS no muestra alergias | una línea en rojo en la tarjeta del ítem | 2 |
| G6 | Vinculación por QR para celulares | token de un uso + QR en el admin | 3 |
| G7 | Sin modo sin conexión | cola local de ítems (hoy: si no hay red, no se envía) | 4 |

---

## 7. Fases

**Fase 1 · cimientos (backend, ~1 sesión)**
G1 alergias + G2 precio de extras + G3 `kind` de terminal.
Sin UI nueva; se prueba con el POS actual.

**Fase 2 · comandero (la pantalla)**
G4 + G5. Mesas, menú, hoja de ítem (extras/notas/alergias), carrito, enviar.
Reusa `pos.getMenuItems`, `pos.getCategories`, `pos.getModifiers`, `pos.addToCart`
y un `comandero.board` nuevo para ver mesas con cuenta abierta.

**Fase 3 · enlace cómodo**
G6: QR de vinculación y "Añadir a pantalla de inicio" guiado.

**Fase 4 · resistencia**
G7: cola local de ítems y reintento (el mesero no puede perder la comanda).

---

## 8. Decisiones pendientes (para ti)

1. **Envío**: ¿cada ítem va a cocina al tocarlo, o el mesero arma la tanda y
   manda "toda la mesa"? Hoy el POS envía al agregar.
2. **Alergias**: ¿catálogo fijo (gluten, lactosa, nuez, mariscos, huevo, soya) o
   texto libre? Propongo catálogo + nota libre, porque en cocina se lee mejor.
3. **Extras**: ¿el precio del extra lo define el menú (`priceAdjust`) o el
   mesero puede poner monto libre? Propongo solo menú (predecible y auditable).
4. **Alcance de la cuenta**: ¿el comandero puede dividir la cuenta o eso queda
   siempre en caja? Propongo caja.
5. **Dispositivo**: ¿PWA en el celular del mesero o tablet del restaurante? La
   propuesta soporta ambas; cambia solo la vinculación.

---

## 9. Evidencia del terreno

- Terminales y sesiones: `packages/api/src/routers/posTerminals.ts`
- Turno por PIN: `packages/api/src/routers/posOperators.ts`
- Ruteo a estación: `packages/api/src/services/stationRouting.ts`
- Realtime: `packages/api/src/services/realtimeOutbox.ts` + ADR-017
- Menú y modificadores: `menuItems`, `menuItemModifiers` (`priceAdjust`, `maxSelect`)
- Ítems de orden: `orderItems` (hoy con `notes` y `modifiers`, sin `allergies`)
