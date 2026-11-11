# Rabbitty POS · Matriz de riesgos pendientes

**Estado:** vivo — se actualiza en cada checkpoint
**Fecha:** 11 de noviembre de 2026
**Relacionado:** [`ADR-018`](./ADR-018-integridad-ordenes.md) · [`ADR-019`](./ADR-019-saga-pagos.md) · [`ROADMAP-Y-CHECKPOINTS.md`](./ROADMAP-Y-CHECKPOINTS.md)

---

## Escala

- **Probabilidad:** Alta / Media / Baja
- **Impacto:** Crítico (dinero o legal) / Alto (operación) / Medio (calidad) / Bajo
- **Bloque:** fase donde se resuelve

---

## Matriz

| ID | Riesgo | Prob. | Impacto | Mitigación | Bloque |
|---|---|---|---|---|---|
| R-01 | Pérdida de ítems por concurrencia entre 2 terminales | **Alta** | Alto | Helper + `version` + lock ([ADR-018](./ADR-018-integridad-ordenes.md)) | 0B-1 |
| R-02 | Doble aplicación de pago | Media | **Crítico** | Saga + transiciones ([ADR-019](./ADR-019-saga-pagos.md)) | 0B-3 |
| R-02b | `status: 'PAID'` escrito sin saga (`bot/webhook:459`, `pos/checkout:594`) | **Alta** | **Crítico** | Migrar a excepción auditada o a la saga | 0B-3 |
| R-03 | URL de factura inexistente entregada al cliente | **Alta (hoy)** | Alto (legal) | Retirar/neutralizar ([CFDI-COMUNICACION](./CFDI-COMUNICACION.md)) | **0A** |
| R-04 | Eventos KDS no cruzan servicios | **Alta** | Medio | Outbox + Centrifugo ([ADR-017](./ADR-017-transporte-eventos.md)) | 0B-4 |
| R-05 | Duplicado físico de comanda al reintentar | Media | Medio | `IN_DOUBT` + decisión humana ([ADR-020](./ADR-020-impresion.md)) | 0B-4 |
| R-06 | Deriva monetaria por `real` (float) | **Alta** | Medio | Tolerancia ±$0.01 + conciliación nocturna + D-13 | 0B / posterior |
| R-07 | Rutas de miniapp escriben órdenes fuera del helper (13 caminos) | **Alta** | Alto | Incluidas en [ADR-018 §5](./ADR-018-integridad-ordenes.md) | 0B-2 |
| R-08 | Romper `chat_event_outbox` al generalizar | Baja | Alto | No se toca ([ADR-017 §3.1](./ADR-017-transporte-eventos.md)) | — |
| R-09 | Regresión en `paymentCore` | Media | **Crítico** | Condición dura ([ADR-019 §6](./ADR-019-saga-pagos.md)) | 0B-3 |
| R-10 | Pilotos sin instrumentación | Media | Medio | Preparar perfiles y métricas en 0A; ejecutar tras 0B | 0A / 0B |
| R-11 | Fiscalidad de Bunz mal asumida | Media | Alto | Dictamen externo (D-12) | Externa |
| R-12 | Divergencia en `apps/pos` | Baja | Bajo | Congelado (D-01) | — |

---

## Riesgos que requieren decisión fuera del equipo

| ID | Quién decide | Qué se necesita |
|---|---|---|
| R-11 | Dirección + asesor fiscal | Naturaleza fiscal de Bunz y tratamiento de pagos mixtos |
| R-03 | Dirección | Autorizar corrección de mensajes (M-01 a M-04) |
| R-09 | Dirección | Autorizar cambios en `paymentCore` solo con regresión verde |

---

## Cómo se actualiza

- Cada checkpoint marca riesgos **resueltos**, **mitigados** o **abiertos**.
- Un riesgo no se cierra por "ya se implementó": se cierra con **prueba ejecutada**.
- Todo riesgo nuevo entra con ID consecutivo y dueño.
