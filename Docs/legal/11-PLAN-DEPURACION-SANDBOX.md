# Plan de depuración de sandbox (Ka13 y Bull Box)

> **Procedimiento operativo.** Requiere respaldo, vista previa y autorización antes
> de ejecutar. No es una opinión legal.

**Objetivo:** separar por completo las operaciones de prueba de la operación real,
sin borrar evidencia histórica y sin generar obligaciones.

**Alcance:** negocios marcados como sandbox o creados para pruebas
(`Ka13`, `Bull Box` y cualquier tenant `test-*`).

---

## 1. Definición de sandbox

Un negocio es sandbox si cumple al menos una:

- `ownedBusinesses.slug` empieza con `test-`.
- Se creó desde “Crear Afiliado Prueba” en `/god/tenants`.
- Está marcado explícitamente en `verificationData` o en una tabla de control.
- Sus usuarios están marcados `users.sandbox = true`.

**Regla:** si hay duda, se trata como sandbox hasta confirmar lo contrario.

---

## 2. Qué se conserva y qué se depura

| Elemento | Acción | Motivo |
|---|---|---|
| Negocio y sucursales | Conservar, marcar sandbox | Evitar borrar tenancy |
| Usuarios de prueba | Conservar, marcar `sandbox=true` | Evitar mezclar métricas |
| Saldos Bunz | Poner en 0 | Sin valor real |
| Capacidad MCCE | Poner en 0 | Sin obligación real |
| Propuestas/recuperación | Cancelar/cerrar | Sin efecto |
| Órdenes/pagos de prueba | Conservar con marca sandbox | Evidencia, no finanzas |
| CFDIs | No emitir | No hay operación real |
| Métricas/reportes | Excluir | No contaminar |
| Notificaciones | Pausar | No molestar |
| Tokens de re-onboarding | Invalidar | No reusar |

---

## 3. Procedimiento

### Paso 1 · Inventario

```sql
-- Negocios candidatos
SELECT id, name, slug, status, "createdAt"
FROM "ownedBusinesses"
WHERE slug LIKE 'test-%'
   OR name ILIKE '%ka13%'
   OR name ILIKE '%bull box%';

-- Usuarios de prueba
SELECT id, email, "firstName", sandbox
FROM users
WHERE sandbox = true;
```

### Paso 2 · Respaldo

- Exportar negocio, sucursales, usuarios, saldos, capacidad, propuestas y
  órdenes a JSON.
- Guardar en `DOCS/data/backups/sandbox-YYYYMMDD.json`.
- Calcular hash del respaldo.

### Paso 3 · Vista previa

- Generar reporte de “antes”: saldos, capacidad, propuestas, órdenes, CFDIs.
- Confirmar que no hay obligaciones reales ni facturas.
- Revisar con operaciones.

### Paso 4 · Autorización

- Aprobar por escrito (fundador/operaciones).
- Registrar actor, fecha y alcance.

### Paso 5 · Ejecución

- Poner saldos y capacidad en 0.
- Cerrar propuestas pendientes como `CANCELLED` o `EXPIRED` con motivo `SANDBOX`.
- Marcar usuarios `sandbox=true`.
- Invalidar tokens de re-onboarding.
- Pausar notificaciones y campañas.
- No borrar órdenes; marcarlas como sandbox en el reporte.

### Paso 6 · Verificación

- Confirmar 0 saldos y 0 capacidad.
- Confirmar que no hay CFDIs emitidos.
- Confirmar que reportes reales excluyen sandbox.
- Confirmar que el negocio no puede redimir/emitir.

### Paso 7 · Reporte

- Documento con antes/después, respaldo, hash, autorización y evidencia.
- Archivar en el expediente.

---

## 4. Criterios de aceptación

- [ ] Inventario completo.
- [ ] Respaldo con hash.
- [ ] Vista previa revisada.
- [ ] Autorización registrada.
- [ ] Saldos y capacidad en 0.
- [ ] Propuestas cerradas.
- [ ] Usuarios marcados.
- [ ] Tokens invalidados.
- [ ] Reportes reales sin sandbox.
- [ ] Reporte final archivado.

---

## 5. Rollback

Si algo sale mal:

1. Restaurar desde el respaldo.
2. Reabrir propuestas si aplica.
3. Revertir marcas `sandbox`.
4. Documentar el incidente y la causa.
5. No reintentar sin corregir el procedimiento.
