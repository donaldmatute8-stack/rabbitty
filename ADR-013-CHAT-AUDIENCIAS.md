# ADR-013 · Tipos de conversación y privacidad (BUSINESS vs PEER)

**Fecha:** 2026-11-04 · **Estado:** implementado el modelo (grupos: siguiente fase)

---

## Problema

La diferencia entre "chat con un negocio" y "chat entre Rabbitters" era
**implícita**: se infería con *"¿algún participante es un negocio?"*. Eso es
frágil — el founder es dueño de su propio local y su chat **como cliente** se
clasificaba como bandeja de negocio (bug real: desaparecía de Chats).

Y era peor de cara al futuro: grupos, E2E, búsqueda y retención necesitan reglas
distintas y no pueden depender de una heurística.

## Decisión: dos ejes explícitos

```
conversations.kind:     DIRECT | GROUP
conversations.audience: BUSINESS | PEER
```

| Combinación | Qué es |
|---|---|
| `DIRECT` + `BUSINESS` | Rabbitter ↔ afiliado |
| `DIRECT` + `PEER` | Rabbitter ↔ Rabbitter |
| `GROUP` + `PEER` | Grupo de Rabbitters |
| `GROUP` + `BUSINESS` | Grupo/broadcast del negocio (futuro) |

Backfill (`0034`): si **ningún** participante es un negocio afiliado ⇒ `PEER`.

## Matriz de comportamiento

| Aspecto | BUSINESS | PEER |
|---|---|---|
| Cifrado | Transporte (WSS) + Postgres | **E2E** (fase posterior) |
| Quién puede leer | El negocio (soporte, disputas) | Solo los participantes |
| Métricas | Sí | No |
| Moderación | Sí | Solo por reporte explícito |
| Push | Con preview (nombre + texto) | Genérico cuando llegue E2E |
| Búsqueda | Server-side | Solo cliente |
| Retención | Política del negocio | Del usuario |
| Media | Bucket privado; el negocio puede verla | Bucket privado + cifrado por archivo |
| Inbox del admin | **Sí** (única fuente) | Nunca |

## Reglas de implementación

1. **El inbox del admin filtra `audience = 'BUSINESS'`** — antes listaba por
   participación del negocio (correcto por accidente).
2. **"Bandeja de negocio" en el móvil** = `audience === 'BUSINESS'` **y** el
   usuario **no** es participante directo. Si es directo, es *su* chat como
   cliente (caso founder).
3. `kind`/`audience` se exponen en la lista para que la UI (y el copy del push)
   decidan sin adivinar.
4. Nada de E2E, moderación ni retención condicionada por "es negocio": se decide
   por `audience`.

## Consecuencias para grupos

- Un grupo creado por un Rabbiter nace `GROUP` + `PEER`: hereda privacidad,
  push genérico y (a futuro) E2E.
- Un grupo del negocio nace `GROUP` + `BUSINESS`: hereda métricas y moderación.
- La autorización por `conversation_members` entra cuando exista grupo; los
  `DIRECT` siguen usando `participant1/2`.

## Pendiente

- `conversation_members` + creación/administración de grupos.
- Búsqueda server-side **solo** para `BUSINESS`.
- E2E **solo** para `PEER`.
