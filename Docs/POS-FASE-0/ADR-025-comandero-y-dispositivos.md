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

---

## 10. Decisiones cerradas (13-nov-2026)

| # | Decisión |
|---|---|
| D1 | **Envío por tanda**: el mesero arma la orden y la manda a cocina/bar. Se puede seguir editando (agregar, quitar, cambiar notas) **mientras la orden no se cierre**. La comanda va en cola **a su mesa**. |
| D2 | **Nombre por comensal**: cada ítem lleva `guestName` ("para Luis", "para la señora del fondo"). El mesero entrega por nombre, no por platillo. |
| D3 | **Alergias**: catálogo fijo (gluten, lactosa, nuez, mariscos, huevo, soya, cacahuate) **+ nota libre**. Se guarda como texto legible para cocina. |
| D4 | **Extras**: solo los del menú (`priceAdjust`); el mesero no inventa montos. |
| D5 | **La cuenta se cobra en caja**. "Pedir la cuenta" desde el comandero queda para otra fase. |
| D6 | **Dispositivo**: PWA en celular del mesero **y** tablet del restaurante. |
| D7 | **Reloj checador dentro del comandero**: al entrar, el mesero escanea un código que muestra el admin (o un dispositivo de la sucursal) y abre su turno; sin checar, el comandero no opera. |
| D8 | **Modo operativo restringido**: sin notificaciones del móvil y solo con Wi-Fi. |
| D9 | **Notificador al mesero** cuando cocina/barra marca un ítem como listo, con detalle: producto, estación y a quién va. |

---

## 11. Requisitos nuevos y cómo se cubren

### 11.1 Reloj checador (D7)

Ya existe el modelo (`staff_shifts`, `staff.clockIn/clockOut`) y el PIN del
empleado. El comandero lo usa así:

```
Admin / dispositivo de la sucursal        Comandero (celular del mesero)
   muestra QR rotativo  ─── escanea ───►  detecta sucursal + vigencia
                                          pide PIN del mesero
                                          abre turno (staff_shifts) y sesión
                                          de operador → entra al comandero
```

- El QR rota (p. ej. cada 60 s) y va firmado: prueba **presencia física**.
- El PIN prueba **identidad**.
- Al cerrar el comandero se registra la salida (`clockOut`).
- Sin chequeo vigente, el comandero se queda en la pantalla de acceso.

### 11.2 "Sin notificaciones / solo Wi-Fi" (D8) — qué es posible de verdad

Un PWA **no puede** activar modo avión ni silenciar las notificaciones del
sistema. Sería deshonesto prometerlo. Lo que sí se puede, y es lo que se
implementará:

| Quiero | Cómo se logra |
|---|---|
| Pantalla completa sin distracciones | PWA `display: standalone` + WakeLock |
| Evitar salir por accidente | confirmación al cerrar y reentrada por chequeo |
| Detectar datos móviles | `navigator.connection.type` (Android/Chrome) → bloquear si no es Wi-Fi |
| Bloquear en iOS (no expone el tipo de red) | aviso + regla de negocio (no bloqueo técnico) |
| Bloqueo **real** del sistema | **Guided Access** (iOS) o **Screen Pinning** (Android); con MDM, modo kiosco |

Se implementa el bloqueo cuando el navegador informa la red y, cuando no,
un aviso persistente. El bloqueo duro del dispositivo queda documentado como
configuración del equipo (Guided Access / MDM), no como código.

### 11.3 Notificador al mesero (D9)

Cuando el KDS marca un ítem `READY`, se publica al canal del mesero:

```
order.item.ready {
  orderId, tableNumber, guestName,
  itemName, quantity, stationName,
  waiterStaffId
}
```

El comandero lo muestra como aviso grande ("Listo: 2× Tacos · Barra · para
Luis · Mesa 4") y vibra. En nativo (Capacitor) además se manda push por APNs;
en PWA se usa el mismo canal de Centrifugo (tiempo real) y, si la pantalla está
bloqueada, la notificación del sistema solo donde el navegador lo permita.

---

## 12. Fases actualizadas

| Fase | Contenido | Estado |
|---|---|---|
| **1** | Alergias, nombre del comensal, extras con precio, `pos_terminals.kind`, KDS muestra alergias | **en curso** |
| **2** | Comandero: mesas → menú → ítem (extras/notas/alergias/nombre) → tanda → enviar | **hecho (v1)** |
| **3** | Chequeo con QR + PIN + admin del reloj | **hecho** · candado de Wi-Fi pendiente |
| **4** | Notificador de "listo" al mesero | **hecho v1** (sondeo 10 s + sonido/vibración; push nativo pendiente) |
| **5** | Pedir la cuenta desde el comandero | **hecho** (marca `billRequestedAt`) |
| **6** | Cola local sin conexión | pendiente |

---

## 13. Estado de la Fase 1 (implementado)

```
order_items.allergies          catálogo + nota libre
order_items.guestName          entrega por nombre
pos_terminals.kind             CASHIER | COMANDERO | KDS
pos.addToCart                  valida extras contra el menú y suma su precio
                               acepta allergies y guestName
kds.loadKdsQueue               devuelve allergies y guestName
KDS (app)                      alergias en rojo y "Para <nombre>"
```

Migración `0056` (aditiva).

---

## 14. Fase 2 y 3 (implementado 13-nov-2026)

**Comandero (`/comandero`)**

- tablero de mesas con cuenta abierta + Para llevar / Mostrador
- `comandero.openOrder` reutiliza la cuenta abierta de la mesa (nunca dos)
- hoja del platillo: cantidad, extras del menú con precio, alergias (catálogo +
  libre), nota, nombre del comensal
- `hold: true` en `addToCart`: el ítem queda **en captura**
- `comandero.sendRound`: marca los ítems, publica a cada estación y refresca
- total en MXN, sin propina, sin cobro

**Chequeo**

- `services/presenceCode.ts`: código HMAC por sucursal, ventana de 60 s
  (se acepta la anterior por reloj/escaneo)
- `comandero.checkIn`: valida código + PIN (con bloqueo por intentos), abre
  `staff_shifts` y la sesión de operador
- `comandero.checkOut`: cierra turno y sesión
- Admin **Ajustes → Reloj checador**: QR rotativo, quién está en turno,
  cerrar turno huérfano e historial (`staff.forceClockOut`, `staff.shiftHistory`)
- El layout del POS no pinta su candado sobre `/comandero` (tiene el suyo)

**Guías**

- `/academy` → *Comandero digital y reloj checador*
- `Docs/POS-FASE-0/GUIA-COMANDERO.md`

**Guarda de `kind` (hecha)**: `directCheckout` rechaza el cobro cuando la
sesión es de una terminal `COMANDERO` sin usuario. El admin elige el tipo en
*Ajustes → Terminales* (Caja / Comandero / Pantalla de cocina).

**Pendiente**: notificador de "listo" al mesero (fase 4), pedir la cuenta desde
el comandero (5), cola local sin conexión (6) y el candado de Wi-Fi (depende del
navegador).

---

## 15. Notificador de "listo" (fase 4, v1)

`comandero.readyFeed` devuelve los ítems `READY` de las cuentas **de este
mesero** con todo lo que necesita para entregar:

```
{ itemId, orderId, quantity, name, guestName, allergies,
  stationName, tableNumber, orderType }
```

El comandero lo consulta cada 10 s. Cuando aparece algo nuevo suena (oscilador
WebAudio, sin asset), vibra y muestra un banner fijo sobre cualquier vista:

```
2× Tacos al pastor
Barra · Mesa 4 · para Luis
⚠ sin cebolla (alergia)
[ Entregado ]
```

"Entregado" marca el ítem como `SERVED` con la misma ruta del KDS
(`kds.updateOrderItemStatus`), así cocina y mesero ven lo mismo.

**Por qué sondeo y no push todavía**: en PWA no hay push fiable sin service
worker + suscripción; el comandero está abierto mientras el mesero trabaja, así
que 10 s de latencia es aceptable. El push nativo (APNs, Capacitor) queda para
cuando el comandero se empaquete como app.

---

## 16. Pedir la cuenta y candado de Wi-Fi (fase 5 + D8)

**Pedir la cuenta**: migración `0057` añade `orders.billRequestedAt`. El mesero
toca **Pedir la cuenta** en el comandero; la mesa queda marcada ("Cuenta
pedida") y la caja lo ve en la orden. El comandero sigue sin cobrar.

**Candado de Wi-Fi**: si el navegador informa `navigator.connection.type ===
"cellular"`, el comandero **no opera** y muestra una pantalla que pide conectarse
al Wi-Fi. Donde el navegador no expone el tipo (iOS/Safari) se muestra un aviso
permanente, no un bloqueo: no se puede fingir una capacidad que no existe.

**Pendiente**: cola local sin conexión (fase 6) y push nativo.
