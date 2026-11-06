# Snapshots de validación (panel GOD, read-only)

Esta carpeta es la **única fuente** del panel `GOD → Validación`.
No hay DB, no hay escrituras: el panel solo lee `*.json` de aquí.

## Cómo se llena

```bash
node scripts/validation-snapshot.mjs dataset.json \
  --out apps/admin/documents/validation/2026-11-13.json \
  --source-commit <sha>
```

Un archivo por semana. El nombre libre (sin espacios) es el `id` del snapshot.

## Feature flag

El panel está **apagado** por defecto. Se activa con:

```
GOD_VALIDATION_PANEL=true
```

Directorio alternativo (opcional):

```
GOD_VALIDATION_DIR=/ruta/a/snapshots
```

## Contrato

El JSON debe tener `status`, y opcionalmente `pilot`, `coverage`, `metrics`,
`rules`, `backtest`, `audit` y `decisions`. Si un campo falta, el panel muestra
`n/d`; nunca inventa un cero.

## Qué es y qué no es

- Es un **parte de estado**: cobertura, huecos, reglas, backtest y compuertas.
- **No** aprueba la economía, **no** desbloquea RP-2 y **no** calcula nada.
- `2026-11-06-pilot.json` es un **fixture sintético** para ver el panel en v0.
