# Rabbitty POS · Roadmap y checkpoints de reanudación

**Estado:** vivo — este documento es el punto de retorno
**Fecha:** 11 de noviembre de 2026
**Relacionado:** [`README`](./README.md) · [`RIESGOS`](./RIESGOS.md)

---

## 1. Principio rector

> Primero garantizar que Rabbitty nunca pierda, duplique o mezcle una operación comercial.
> Después hacemos que opere más tipos de negocios.

Ninguna capacidad nueva (estaciones, KDS multiestación, retail, tours) se construye antes de cerrar la integridad del núcleo.

---

## 2. Estructura de fases

| Fase | Contenido | Estado |
|---|---|---|
| **0A** | Decisiones, ADR y comunicación | **Documentado (este paquete)** |
| **0B** | Integridad operativa: concurrencia, pagos, outbox, impresión, aislamiento | Diseñado, **no autorizado a ejecutar** |
| **0C** | Base Restaurant Engine: estaciones, ruteo, cursos, asientos | Diseño aprobado, sin implementar |
| **1** | Restaurante avanzado: cocina + barra, expediter, split, mesas | Posterior |
| **2** | Catálogo universal: variantes, barcode, menús por horario | Posterior |
| **3** | Operación distribuida: multi-sucursal, offline (evaluación aparte) | Posterior |
| **4** | Otras verticales: experiencias, servicios | Posterior |

---

## 3. Desglose de 0B

| Bloque | Alcance | Depende de | Riesgos que cierra |
|---|---|---|---|
| **0B-1** | Helper `withOrderMutation` + `version` + `order_events` + test de arquitectura; migrar los 35 `M` de `pos.ts` | 0A | R-01 |
| **0B-2** | 13 rutas de miniapp + 3 crons al mismo helper | 0B-1 | R-07 |
| **0B-3** | Saga de pagos, `payment_transitions`, `SETTLED_AFTER_EXPIRY` | 0B-1 | R-02, R-02b, R-09 |
| **0B-4** | Outbox realtime + cola de impresión | 0B-1 | R-04, R-05 |
| **0B-5** | Matriz de aislamiento por sucursal | 0B-1 | — |

Cada bloque entrega: cambios propuestos, pruebas, resultados, riesgos y **rollback**.

---

## 4. Puertas de calidad (aplican a todo bloque)

1. Prueba ejecutada, no "implementado".
2. Rollback escrito **antes** de mergear.
3. Sin cambios de comportamiento no anunciados.
4. Sin tocar economía Bunz.
5. Sin tocar `paymentCore` sin regresión verde y autorización aparte.

---

## 5. Checkpoints

| Checkpoint | Qué queda cerrado | Evidencia de cierre |
|---|---|---|
| **C0** | 0A documental | Este paquete de 9 documentos |
| **C1** | 0B-1 | Prueba de 2 terminales concurrentes + test de arquitectura verde |
| **C2** | 0B-2 | Rutas miniapp y crons escriben solo por el helper |
| **C3** | 0B-3 | Webhook duplicado y tardío resueltos sin duplicar |
| **C4** | 0B-4 | KDS reconectado en <5 s + cola de impresión con `IN_DOUBT` |
| **C5** | 0B-5 | Matriz de aislamiento completa en verde |

---

## 6. Retomar en 5 minutos

Cuando el trabajo se pause por otro frente, retomar es:

1. Leer **este documento** (§7 Estado actual).
2. Leer el ADR del bloque en curso.
3. Ejecutar el comando de verificación del bloque.
4. Continuar desde la **siguiente acción exacta**.

### §7 · Estado actual

```
FASE:                     0B-1 — CERRADA Y EN MAIN
ÚLTIMO CHECKPOINT CERRADO: C1 · integridad de órdenes
MIGRACIÓN 0038:           APLICADA en producción (11-nov-2026)
MERGE:                    76f8175 · deploy SUCCESS · / y /pos → 200
TRINQUETE:                0 procedimientos y 0 archivos sin helper
SIGUIENTE ACCIÓN:         0C — modelo de estaciones y contratos KDS (diseño)
BLOQUEADO POR:            nada
PREGUNTAS ABIERTAS:
  - Ventana para 0C
  - Actualizar la rama `staging` a main (al hacerlo, despliega staging)
  - Autorizar corrección de mensajes CFDI (M-01 … M-04)
  - Autorizar PAC sandbox Facturama
```

> **Instrucción:** al cerrar cada checkpoint, actualizar este bloque. Es el contrato de reanudación.

---

## 7.1 Plantilla para actualizar §7

```
FASE:
ÚLTIMO CHECKPOINT CERRADO:
SIGUIENTE ACCIÓN:
BLOQUEADO POR:
RAMAS:
PREGUNTAS ABIERTAS:
  - …
```

---

## 8. Lo que este roadmap no autoriza

- Migraciones productivas.
- Despliegues.
- Cambios en saldos, tasas, comisiones o reglas Bunz.
- Timbrado fiscal productivo.
- Eliminación de interfaces.
- Refactors generales sin propuesta incremental y reversible.
