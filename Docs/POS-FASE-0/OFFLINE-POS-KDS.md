# Offline POS/KDS — alcance para 626 Café (2026-11-17)

> Documento de arranque. Se escribe **antes** de tocar código y se ajusta con lo
> que 626 Café cuente de su operación real. Mientras no haya datos de campo, esto
> es una propuesta, no un compromiso.

---

## 1. Lo que YA existe (no se rehace)

| Pieza | Estado | Dónde |
|---|---|---|
| Idempotencia del cobro | **hecho** (`idempotencyKey`, reintento devuelve el mismo cobro) | `packages/api/src/routers/pos.ts:2273`, `:2348` |
| Cola local del comandero | **hecho** (IndexedDB + respaldo localStorage, solo encola fallos de red) | `apps/admin/src/lib/comandero-queue.ts` |
| Service worker del comandero | **hecho** (cachea armazón, **nunca** `/api/`) | `apps/admin/public/sw.js` |
| Turno de caja obligatorio para efectivo | **hecho** (`assertOpenShiftForCash`) | `pos.ts:2288` |
| Bitácora de inventario por movimiento | **hecho** (`inventory_movements`) | `packages/api/src/routers/suppliers.ts` |

Conclusión: la mitad del camino ya está pavimentada. El offline del **cobro** no
parte de cero — el servidor ya sabe deduplicar un reintento.

---

## 2. Regla de oro (no negociable)

**En offline solo se cobra en EFECTIVO.** Tarjeta, wallet y Bunz requieren
servidor (autorización, saldo, pozo). Si no hay red, esos botones se apagan y el
cajero ve por qué.

Y una segunda: **un cobro offline nunca se aplica solo.** Queda en una bandeja de
conciliación hasta que un humano confirma que el dinero existe, salvo que la
operación sea demostrablemente segura (misma llave de idempotencia que el
servidor, turno abierto, orden creada localmente).

---

## 3. Arquitectura propuesta

```
Caja sin red
  ├─ Order + Payment creados en IndexedDB (operationId = uuid del cliente)
  ├─ Imprime ticket de efectivo (impresora local, no depende de red)
  └─ Outbox: POST pendiente con idempotencyKey = operationId

Al volver la red
  ├─ Se envía el outbox en orden de captura
  ├─ Servidor deduplica por idempotencyKey → mismo cobro, sin duplicar
  └─ Lo que el servidor rechace (turno cerrado, orden ya pagada en caja,
     precio cambiado) va a CONCILIACIÓN, nunca se descarta en silencio
```

### Piezas nuevas

1. `apps/admin/src/lib/pos-outbox.ts` — outbox en IndexedDB (mismo patrón que
   `comandero-queue.ts`: sobrevive recargas, respaldo localStorage).
2. `apps/admin/src/lib/offline-shift.ts` — espejo local del turno abierto
   (id, caja, apertura) para poder validar efectivo sin red.
3. `/conciliaciones` (página ya existe: `apps/admin/src/app/(dashboard)/conciliaciones`)
   — bandeja de cobros offline pendientes de confirmar, con diff y acciones.
4. Endpoint `pos.reconcileOfflineCharge` — recibe el lote, aplica lo seguro y
   devuelve por operación: `APPLIED | DUPLICATE | NEEDS_REVIEW | REJECTED`.

### KDS offline (más simple)

El KDS solo **lee** la cola y **marca** estados. No mueve dinero.
- Cachear el último snapshot en IndexedDB al polling exitoso (hoy cada 10s).
- Sin red: mostrar el snapshot con sello "visto a las HH:MM".
- Encolar los "bump" (en preparación / listo / entregado); al reconectar se
  aplican en orden. Un bump sobre un ticket que ya cambió se resuelve por
  `updatedAt` y se registra, no se fuerza.

---

## 4. Preguntas para 626 Café (esto define el diseño)

1. **¿Cada cuánto se cae la red y por cuánto tiempo?** (minutos vs horas). Si son
   minutos, sobra outbox; si son horas, hace falta el turno completo offline.
2. **¿Cuántas cajas abren a la vez** y quién cierra el turno.
3. **¿Se cobra con tarjeta la mayoría o es mixto?** Define cuánto duele apagar
   tarjeta.
4. **¿Qué pasa hoy cuando se cae?** (papel, calculadora, cuaderno). El sistema
   debe parecerse a eso, no a un manual nuevo.
5. **¿La impresora es de red o USB/local?** Si es de red, tampoco funciona
   offline y el ticket tendría que salir por otra vía.
6. **¿Quién cuadra la caja al final del día** y qué hace con un cobro dudoso.
7. **¿El KDS es tablet fija o dispositivo que se mueve?**

---

## 5. Fases (cada una se despliega sola)

| Fase | Alcance | Criterio de aceptación |
|---|---|---|
| **A** | Outbox + efectivo offline + ticket local | Se apaga el Wi-Fi, se cobra en efectivo, se recupera la red y el cobro aparece **una sola vez** con la caja correcta |
| **B** | Bandeja de conciliación + rechazos explicados | Un cobro con turno ya cerrado cae en conciliación con motivo legible, no se pierde |
| **C** | KDS: snapshot + bumps en cola | Se corta la red, se marca "listo" y al volver se aplica sin duplicar |

**No se hace en la fase A**: tarjeta offline, Bunz offline, cierre de turno
offline, reportes offline.

---

## 6. Riesgos aceptados y su mitigación

| Riesgo | Mitigación |
|---|---|
| Doble cobro (el peor) | `idempotencyKey` ya existe en servidor; el cliente usa el mismo `operationId` en todos los reintentos |
| Cobro con turno cerrado | El turno local se valida contra el espejo; el servidor rechaza y va a conciliación |
| Stock desincronizado | El cobro offline no descuenta inventario en local; se aplica al conciliar |
| Precio cambió mientras estaba offline | Se cobra el precio capturado y el diff se muestra en conciliación |
| Se pierde el dispositivo | El outbox vive en IndexedDB; si el equipo muere, queda la bitácora del servidor + el papel |

---

## 7. Lo que se decide mañana en la junta

- ¿Entra tarjeta offline con terminal física? (recomendación: **no**)
- ¿Se permite cerrar turno sin red? (recomendación: **no**, se cierra al volver)
- ¿Ventana máxima de operación offline antes de bloquear? (propuesta: 4 h)
- ¿Quién aprueba la conciliación: cajero o dueño?

---

## 8. Definition of done de la fase A

1. `npx tsc --noEmit` en 0, `next build` pasa.
2. Prueba manual con Wi-Fi apagado en `admin.rabbitty.me/pos`: cobro en efectivo,
   recarga de página, vuelve la red, el cobro existe **una vez**.
3. Prueba de reintento forzado (doble envío): sigue existiendo una vez.
4. Un cobro offline con turno cerrado cae en conciliación (no se pierde).
5. 626 Café lo usa un turno completo en modo real antes de considerarlo cerrado.
