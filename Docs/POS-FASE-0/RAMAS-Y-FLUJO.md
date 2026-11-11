# Rabbitty POS · Flujo de ramas y operación sin riesgo

**Estado:** vigente
**Fecha:** 11 de noviembre de 2026
**Audiencia:** cualquier desarrollador o agente que retome el trabajo
**Relacionado:** [`ROADMAP-Y-CHECKPOINTS.md`](./ROADMAP-Y-CHECKPOINTS.md) · [`README`](./README.md) · [`RIESGOS`](./RIESGOS.md)

---

## 1. Principio

> `main` es producción y **siempre debe estar desplegable**.
> Nada de Fase 0 se desarrolla, prueba ni mergea de forma que pueda romperla.

Consecuencias operativas:

- Todo el trabajo de Fase 0 vive en ramas.
- Solo se mergea a `main` **por bloque cerrado y verificado**, nunca "todo junto".
- Mientras Fase 0 avanza, `main` sigue recibiendo ajustes normales.

---

## 2. Modelo de ramas

| Rama | Propósito | Vida | Deploy |
|---|---|---|---|
| `main` | Producción | Permanente | **Sí** (Railway / Vercel) |
| `feat/pos-phase0` | **Integración** de la fase: aquí llegan las ramas hijas y aquí se prueba el conjunto | Mientras dure la fase | **No** |
| `feat/pos-0b1-integridad-ordenes` | Helper, `version`, `order_events`, test de arquitectura | Corta | No |
| `feat/pos-0b2-rutas-miniapp` | 13 rutas de miniapp + 3 crons al helper | Corta | No |
| `feat/pos-0b3-saga-pagos` | Estados, `payment_transitions`, `SETTLED_AFTER_EXPIRY` | Corta | No |
| `feat/pos-0b4-eventos-impresion` | Outbox realtime + cola de impresión | Corta | No |
| `feat/pos-0b5-aislamiento` | Matriz de aislamiento por sucursal | Corta | No |
| `hotfix/<tema>` | Urgencia productiva | Horas | Sí, vía PR a `main` |
| `docs/<tema>` | Documentación suelta | Corta | No |

### Diagrama

```
                          ┌──────────────┐
                          │     main     │  ← producción, siempre verde
                          └──────┬───────┘
                                 │ (1) nace la integración
                          ┌──────▼────────────┐
                          │ feat/pos-phase0   │  ← integración, NO despliega
                          └───┬───┬───┬───┬───┘
                 ┌────────────┘   │   │   └────────────┐
        ┌────────▼──────┐ ┌──────▼───┐ ┌▼───────────┐ ┌▼──────────────┐
        │ 0b1 integridad│ │0b2 rutas │ │0b3 pagos   │ │0b4 eventos    │ …
        └────────┬──────┘ └──────┬───┘ └┬───────────┘ └┬──────────────┘
                 │               │      │              │
                 └──── PR ───────┴──────┴──────────────┘
                        (2) cada bloque entra a la integración

        (3) cuando un bloque está CERRADO y verificado:
            feat/pos-phase0 ──PR──► main     (uno por bloque, no al final)
```

---

## 3. Ciclo de vida de una rama de bloque

1. **Nace** de `feat/pos-phase0` (no de `main`, para no arrastrar divergencia).
2. **Trabaja** un solo bloque del [roadmap](./ROADMAP-Y-CHECKPOINTS.md).
3. **Prueba** según [`ROADMAP §4`](./ROADMAP-Y-CHECKPOINTS.md) y el ADR correspondiente.
4. **PR a `feat/pos-phase0`** con: qué cambia, pruebas ejecutadas, riesgos, rollback.
5. **Merge** solo con gates en verde.
6. **Se borra** al mergear (el historial queda en la integración).

### Contrato de PR (obligatorio)

```md
## Bloque
0B-1 · integridad de órdenes

## Qué cambia
- ...

## Pruebas ejecutadas
- [ ] prueba 1 (resultado)
- [ ] prueba 2 (resultado)

## Riesgos
- R-01 mitigado / pendiente

## Rollback
- Revertir commit X; flag Y apagado; sin migración destructiva

## Evidencia
- captura/log/enlace
```

Sin las cuatro secciones, la PR **no se revisa**.

---

## 4. Cuándo un bloque pasa a `main`

Un bloque (no la fase completa) puede ir a `main` cuando:

| Condición | Verificación |
|---|---|
| Comportamiento sin cambios por defecto | Flag apagado = comportamiento actual |
| Pruebas del ADR en verde | Evidencia en la PR |
| Rollback probado | Se ejecutó al menos una vez en la rama |
| Sin migraciones destructivas | Revisión de `migrations/` del PR |
| Sin tocar Bunz, tasas ni comisiones | `git diff` sin esos archivos |
| Revisión de dirección | Aprobación explícita |

> Regla: **un bloque por PR a `main`**. Nunca "Fase 0 completa".

---

## 5. Probar sin producción

| Necesidad | Cómo | Prohibido |
|---|---|---|
| Desarrollo diario | `pnpm dev` con base local | Escribir en la base de producción |
| Integración | Base de staging dedicada (crear si no existe) | Correr migraciones en producción |
| Pruebas de concurrencia | Script con 2+ clientes sobre staging | Probar concurrencia contra producción |
| Pruebas de UI | Preview deploy de la rama (solo lectura) | Apuntar un preview a la base productiva |
| Pruebas de pago | Stripe sandbox / mocks | Cobros reales |

**Requisito pendiente (0B-0):** confirmar que existe una base de staging separada. Si no existe, es el primer entregable de 0B y bloquea las pruebas de concurrencia.

---

## 6. Despliegues

- Railway y Vercel construyen desde `main`.
- Las ramas **no** despliegan a producción por el solo hecho de existir.
- **Verificación hecha (11-nov-2026):** todos los servicios desplegables (`rabbitty-admin`, `rabbitty-kds`, `rabbitty-landing`, `rabbitty-oracle`, `rabbitty-bot`) están conectados a la rama **`main`**, commit `30952b03`. Empujar una rama no despliega nada.
- **Pre-flight antes de cada nueva rama:** repetir esa verificación (`branch` del último deployment) y confirmar que no se habilitaron *PR environments*.
- Un merge a `main` es un despliegue. Por eso el tamaño de la PR importa.

---

## 7. Rollback

| Escenario | Acción |
|---|---|
| Bloque falla después de mergear a `main` | `git revert <merge>` + redespliegue |
| Bloque falla pero está detrás de flag | Apagar flag (sin revertir) |
| Rama hija falla | Borrar rama; la integración no se toca |
| Integración contaminada | Volver `feat/pos-phase0` al último commit verde conocido |

Todo rollback se escribe **antes** del merge, no después.

---

## 8. Conflictos y archivos calientes

- **Archivo caliente principal:** `packages/api/src/routers/pos.ts` (3 857 LOC, 46 escrituras). Un solo bloque puede tocarlo a la vez.
- Sincronización: cada rama hace `git rebase feat/pos-phase0` **antes** de abrir PR (máximo 2 días de antigüedad).
- Prohibido `merge main` dentro de ramas de Fase 0: se rebasa, no se mergea.
- Si dos bloques necesitan el mismo archivo, se ordenan (ver §10).

---

## 9. Handoff entre agentes o desarrolladores

**En 5 minutos:**

1. Leer [`ROADMAP-Y-CHECKPOINTS.md §7`](./ROADMAP-Y-CHECKPOINTS.md) → fase, checkpoint, siguiente acción, bloqueos.
2. Leer el ADR del bloque en curso.
3. `git fetch --all && git checkout <rama indicada>`.
4. Revisar la bitácora de ramas (§11) para saber qué está en vuelo.
5. Ejecutar la verificación del bloque y continuar desde la siguiente acción.

**Regla de oro del handoff:** el estado vive en los documentos, no en la cabeza de nadie. Si no está escrito, no existe.

---

## 10. Orden de ejecución y dependencias

| Orden | Rama | Depende de | Toca `pos.ts` |
|---|---|---|---|
| 1 | `feat/pos-0b1-integridad-ordenes` | `feat/pos-phase0` | **Sí (35 sitios)** |
| 2 | `feat/pos-0b2-rutas-miniapp` | 0B-1 | No |
| 3 | `feat/pos-0b3-saga-pagos` | 0B-1 | Sí (parcial) |
| 4 | `feat/pos-0b4-eventos-impresion` | 0B-1 | No |
| 5 | `feat/pos-0b5-aislamiento` | 0B-1 | No |

0B-1 es cuello de botella: si se retrasa, 0B-3 se adelanta solo en diseño.

---

## 11. Bitácora de ramas (viva)

Actualizar al crear/mergear/borrar.

| Rama | Estado | Base | Último commit | PR | Notas |
|---|---|---|---|---|---|
| `feat/pos-phase0` | **abierta** | `main@30952b0` | docs 0A | — | Solo documentación (0A). No despliega |
| `feat/pos-0b1-integridad-ordenes` | **abierta** | `feat/pos-phase0` | 0B-1 | — | Helper + migración 0038 + test de arquitectura. Sin cablear |
| `feat/pos-0b2-rutas-miniapp` | no creada | `feat/pos-phase0` | — | — | Requiere 0B-1 |
| `feat/pos-0b3-saga-pagos` | no creada | `feat/pos-phase0` | — | — | Requiere autorización |
| `feat/pos-0b4-eventos-impresion` | no creada | `feat/pos-phase0` | — | — | Requiere autorización |
| `feat/pos-0b5-aislamiento` | no creada | `feat/pos-phase0` | — | — | Requiere autorización |

**Estados válidos:** `abierta` · `en revisión` · `mergeada a integración` · `mergeada a main` · `abandonada`.

---

## 12. Reglas de oro

1. Nunca `push --force` a `main`.
2. Nunca mergear sin gates en verde.
3. Nunca un PR con más de un bloque.
4. Nunca migraciones destructivas en el mismo PR que código.
5. Nunca tocar economía Bunz, tasas o comisiones en Fase 0.
6. Nunca probar contra producción.
7. Nunca borrar una rama con PR abierta.
8. Si algo no está documentado, no se hizo.

---

## 13. Convención de commits

```
tipo(alcance): resumen imperativo

cuerpo opcional (qué y por qué, no cómo)

refs: ADR-018, R-01
```

Tipos: `feat`, `fix`, `docs`, `test`, `chore`, `refactor`, `perf`.
Alcance: `pos`, `kds`, `pagos`, `impresion`, `docs`, `infra`.

Ejemplo:

```
feat(pos): versionado obligatorio en mutaciones de orden

Agrega orders.version, order_events y el helper withOrderMutation.
Sin cambio de comportamiento: la versión es opcional hasta 0B-2.

refs: ADR-018, R-01
```

---

## 14. Cómo nace la integración (paso ejecutado)

```bash
git checkout main && git pull
git checkout -b feat/pos-phase0
# (documentación 0A en Docs/POS-FASE-0/)
git add -f Docs/POS-FASE-0
git commit -m "docs(pos): fase 0 — decisiones, ADR y flujo de ramas"
git push -u origin feat/pos-phase0
```

`main` no se toca en ningún paso.

---

## 15. Nota sobre mayúsculas de la carpeta

En este repositorio la carpeta de documentación existe como `DOCS` en disco y `Docs` en el índice de git (macOS no distingue mayúsculas: ambas resuelven al mismo directorio, inodo idéntico).

**Regla:** en comandos y enlaces, usar siempre **`Docs/POS-FASE-0/`** (la forma que git versiona). Así funciona igual en macOS, Linux y CI.
