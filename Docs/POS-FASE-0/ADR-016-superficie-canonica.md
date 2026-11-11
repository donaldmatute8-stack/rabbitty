# ADR-016 · Superficie operativa canónica

**Estado:** aprobado para diseño
**Fecha:** 11 de noviembre de 2026
**Decide:** D-01
**Relacionado:** [`ADR-017`](./ADR-017-transporte-eventos.md) · [`ADR-018`](./ADR-018-integridad-ordenes.md) · [`README`](./README.md)

---

## 1. Contexto

El monorepo contiene **tres interfaces** que pueden operar un punto de venta y una cuarta que puede operar cocina:

| Implementación | Ruta | Tamaño | Rol actual |
|---|---|---:|---|
| Admin POS | `apps/admin/src/app/(pos)/pos/page.tsx` | 6 307 LOC | POS en producción |
| KDS | `apps/kds/src` | 626 LOC | Pantalla de cocina en producción |
| POS alterno | `apps/pos/src` | 22 componentes | Sin desplegar |
| KDS dentro de admin | `apps/admin/src/app/(dashboard)/kitchen/page.tsx` | 200 LOC | Vista secundaria |

## 2. Evidencia de estado

| Comprobación | Resultado |
|---|---|
| `GET https://admin.rabbitty.me/pos` | **200** |
| `GET https://kds.rabbitty.me` | **200** — `<title>KDS - Rabbitty</title>` |
| `GET https://pos.rabbitty.me` | **404** |
| Servicio Railway `rabbitty-kds` | Repo `donaldmatute8-stack/rabbitty`, imagen propia |
| `apps/pos` en configuración de despliegue | **Ausente** (sin `vercel.json`, sin servicio, sin referencia en CI) |

## 3. Decisión

1. **Canónicas:** `apps/admin` (grupo `(pos)`) y `apps/kds`.
2. **`apps/pos` congelado:** no se elimina, no se migra, no recibe features nuevas.
3. **`apps/admin/(dashboard)/kitchen`** queda como vista secundaria de supervisión, no como KDS operativo. Su rol se documenta en ADR-020.

## 4. Reglas derivadas

- Toda feature de POS/KDS se implementa en las superficies canónicas.
- Un cambio de contrato tRPC impacta a ambas: se considera cambio de plataforma, no de app.
- Cualquier trabajo en `apps/pos` requiere excepción documentada con fecha y motivo.
- La paridad funcional no se asume: si algún día se propone migrar, primero se mide con matriz de pruebas.

## 5. Riesgos

| Riesgo | Mitigación |
|---|---|
| Divergencia silenciosa en `apps/pos` | Congelamiento explícito + nota en su README |
| Confusión de KDS operativo vs vista de supervisión | Documentar en ADR-020 y renombrar la etiqueta de menú si aplica |
| Tentación de "unificar rápido" | Decisión D-01: no se unifica sin paridad demostrada |

## 6. Criterios de aceptación

- [ ] ADR aprobado por dirección.
- [ ] Nota de congelamiento visible en `apps/pos`.
- [ ] Ninguna referencia nueva a `apps/pos` en documentación de producto.

## 7. Rollback

Revertir el documento. No hay efecto técnico.

## 8. Evidencia

- `apps/admin/src/app/(pos)/pos/page.tsx`, `wc -l` = 6 307.
- `apps/kds/src/app/page.tsx` + `api/sse/route.ts`.
- Respuestas HTTP citadas en §2 (consultadas el 11-nov-2026).
