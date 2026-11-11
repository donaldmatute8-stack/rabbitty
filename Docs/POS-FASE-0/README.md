# Rabbitty POS — Fase 0 · Decision Lock & Implementation Design

**Estado:** documentación aprobada (0A). **Sin código, sin migraciones, sin despliegues.**
**Fecha:** 11 de noviembre de 2026
**Alcance:** cerrar arquitectura del núcleo transaccional antes de construir Restaurant Engine.
**Checkpoint:** `C0` (ver [`ROADMAP-Y-CHECKPOINTS.md`](./ROADMAP-Y-CHECKPOINTS.md)).

---

## 1. Qué es este paquete

Cinco decisiones de arquitectura que deben quedar cerradas **antes** de tocar operaciones críticas, más el inventario exacto de dónde vive hoy el riesgo.

El principio rector, dictado por dirección:

> Primero garantizar que Rabbitty nunca pierda, duplique o mezcle una operación comercial. Después hacemos que opere más tipos de negocios.

---

## 2. Documentos

| Documento | Qué decide | Estado |
|---|---|---|
| [`ADR-016-superficie-canonica.md`](./ADR-016-superficie-canonica.md) | Qué POS y qué KDS son los oficiales; `apps/pos` congelado | Aprobado para diseño |
| [`ADR-017-transporte-eventos.md`](./ADR-017-transporte-eventos.md) | Una librería de publicación, dos colas; Centrifugo con aislamiento | Aprobado para diseño |
| [`ADR-018-integridad-ordenes.md`](./ADR-018-integridad-ordenes.md) | `version` obligatoria, punto único de escritura, **las 85 escrituras** | Aprobado para diseño |
| [`ADR-019-saga-pagos.md`](./ADR-019-saga-pagos.md) | At-most-once en Rabbitty + reconciliación; `SETTLED_AFTER_EXPIRY` | Aprobado para diseño |
| [`ADR-020-impresion.md`](./ADR-020-impresion.md) | `SENT_TO_SPOOLER` ≠ `CONFIRMED`; `IN_DOUBT` decide operador | Aprobado para diseño |
| [`ADR-021-cfdi.md`](./ADR-021-cfdi.md) | `PacProvider`, Facturama **sandbox**, sin reglas fiscales fijas | Aprobado para diseño |
| [`CFDI-COMUNICACION.md`](./CFDI-COMUNICACION.md) | Inventario de menciones activas a corregir | Requiere autorización aparte |
| [`RIESGOS.md`](./RIESGOS.md) | Matriz de riesgos pendientes (R-01 … R-12) | Vivo |
| [`ROADMAP-Y-CHECKPOINTS.md`](./ROADMAP-Y-CHECKPOINTS.md) | Fases, dependencias y puntos de reanudación | Vivo |
| [`RAMAS-Y-FLUJO.md`](./RAMAS-Y-FLUJO.md) | Modelo de ramas, PR, gates, handoff y rollback | **Vigente** |
| [`0B-1-EJECUCION.md`](./0B-1-EJECUCION.md) | Qué se construyó en 0B-1 y qué falta para cerrarlo | **En curso** |
| [`PLAN-PRUEBAS-COBRO.md`](./PLAN-PRUEBAS-COBRO.md) | Casos de cobro y resultados de la ventana (C-01, C-03, C-05) | Parcial: falta C-02 |
| [`ADR-022-directCheckout.md`](./ADR-022-directCheckout.md) | Mapa de las 11 escrituras del cobro y plan de cableado | ✅ Cableado completo |
| [`PLAN-MERGE-A-MAIN.md`](./PLAN-MERGE-A-MAIN.md) | Migración `0038`, orden de merge, smoke tests y rollback | **Listo para ejecutar** |
| [`STAGING-ON-OFF.md`](./STAGING-ON-OFF.md) | Encender staging solo para probar (cuidar compute de Neon) | Vigente |
| [`NEON-CONSUMO-Y-KDS.md`](./NEON-CONSUMO-Y-KDS.md) | Reposo del KDS para no agotar el cupo de Neon | En rama `fix/neon-idle` |

---

## 3. Decisiones cerradas

| ID | Decisión |
|---|---|
| D-01 | Superficie canónica: admin POS + `apps/kds`. `apps/pos` congelado (no eliminar, no migrar) |
| D-02 | Una librería de publicación y dos colas; `chat_event_outbox` intacta |
| D-03 | Control de versión obligatorio en toda mutación de orden |
| D-04 | Punto único de escritura + test de arquitectura en CI |
| D-05 | Contrato `CONFLICT` con `currentVersion` para la terminal |
| D-06 | Pagos: at-most-once en Rabbitty + reconciliación de incertidumbre |
| D-07 | `SETTLED_AFTER_EXPIRY` como estado de primera clase |
| D-08 | `paymentCore` intocable hasta regresión completa verde |
| D-09 | Impresión: no se promete confirmación física |
| D-10 | `IN_DOUBT` sin reintento automático; reimpresión marcada |
| D-11 | CFDI: `PacProvider` + sandbox Facturama, sin producción |
| D-12 | Reglas fiscales Bunz/fiat fuera del diseño (dictamen externo) |
| D-13 | Dinero: `real` → `numeric(12,2)` como bloque posterior independiente |
| D-14 | Historia de estación append-only, nunca sobrescritura |

---

## 4. Lo que este paquete NO autoriza

- Migraciones (ni staging ni producción).
- Cambios en `pos.ts`, `paymentCore`, `chatOutbox`, esquemas o dependencias.
- Despliegues.
- Cambios en tasas, comisiones, saldos o reglas Bunz.
- Activación o contratación de CFDI productivo.
- Cambios de contenido en landing, onboarding o Bunzy (ver [`CFDI-COMUNICACION.md`](./CFDI-COMUNICACION.md)).
- Eliminación de `apps/pos` o de cualquier interfaz.

---

## 5. Cómo se audita este paquete

1. Leer este índice.
2. Revisar **ADR-018** primero: es el que dimensiona el riesgo real (85 escrituras en 18 archivos).
3. Contrastar cada afirmación con su evidencia (`archivo:línea`), incluida en cada ADR.
4. Verificar que ningún documento propone cambios fuera de documentación.

---

## 6. Cómo se retoma tras una pausa

Leer [`ROADMAP-Y-CHECKPOINTS.md`](./ROADMAP-Y-CHECKPOINTS.md) § *Retomar en 5 minutos*:
fase actual, decisiones cerradas, preguntas abiertas y siguiente acción exacta.

Para saber **en qué rama trabajar y cómo integrar**, leer [`RAMAS-Y-FLUJO.md`](./RAMAS-Y-FLUJO.md).

---

## 7. Evidencia de alcance documental

- Rama: `main`
- No se modificó código fuente, esquema, configuración ni dependencias.
- Solo se agregaron archivos dentro de `Docs/POS-FASE-0/`.
