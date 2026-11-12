# Consumo de Neon y reposo del KDS

**Estado:** implementado en rama `fix/neon-idle` (no mergeada)
**Fecha:** 11 de noviembre de 2026
**Motivo:** el proyecto llegó al 97 % del cupo de Neon.

---

## 1. Diagnóstico

Medido sobre la base de staging:

| Métrica | Valor | Lectura |
|---|---|---|
| Tamaño de la base | **21 MB** | El consumo **no es almacenamiento** |
| Conexiones externas | 0 (salvo pruebas) | Nada la mantiene despierta fuera de la app |
| Cupo estimado | ~191 CU-h | 730 h/mes × 0.25 CU ≈ **182 CU-h** → 95 % |

**Conclusión:** el compute nunca se suspende. Neon solo suspende tras ~5 min sin
consultas, y siempre hay algo consultando.

## 2. Qué mantiene el compute despierto

| Fuente | Intervalo | ¿Consulta la base? |
|---|---|---|
| KDS abierto (pantalla de cocina) | 10 s | **Sí** |
| KDS · órdenes completadas | 30 s | **Sí** |
| POS abierto | 5–15 s | **Sí** |
| Bot de Telegram | 2 s (a Telegram) | No |
| Healthcheck del bot | estático | No |

Un KDS encendido toda la noche es suficiente para que el compute no duerma nunca.

## 3. Cambio aplicado (KDS)

`apps/kds/src/app/page.tsx`:

- Tras **10 minutos sin ítems activos**, el KDS entra en **reposo**.
- En reposo: `refetchInterval = false` en `getOrders` y en `CompletedOrders`.
- Se muestra una capa a pantalla completa: *"Pantalla en reposo · toca para reanudar"*.
- Al tocar: reanuda y refresca una vez.
- Si llega una comanda por SSE, el contador de activos vuelve a > 0 y sale solo del reposo.
- El temporizador de inactividad es **local** (no hace peticiones).

`apps/kds/src/components/CompletedOrders.tsx`: acepta `paused` y detiene su polling.

### Por qué no basta con ocultar la pestaña

react-query ya suspende el `refetchInterval` cuando la pestaña está en segundo plano
(`refetchIntervalInBackground: false` por defecto). El problema es que un KDS es una
pantalla **visible**: nunca está en segundo plano.

## 4. Ahorro esperado

| Escenario | Horas sin consultar | CU-h ahorrados/mes |
|---|---:|---:|
| Cocina cierra 8 h/noche | 240 h | ~60 |
| Cocina cierra 10 h/noche | 300 h | ~75 |

Con ~60 CU-h menos, el 97 % baja aproximadamente a **65 %**. Suficiente para seguir
en Neon sin migrar.

## 5. Acciones operativas (sin código)

1. **Apagar la pantalla del KDS** al cerrar la cocina (el reposo ayuda, apagarla es mejor).
2. **Quitar el deployment de staging** cuando no se esté probando.
3. Verificar en Neon: *autosuspend 5 min* y *CU mínimo (0.25)*.
4. Confirmar que ningún scheduler externo llame `/api/cron/*` cada minuto.

## 6. Pendiente (no incluido aquí)

- **POS**: mismo patrón de pausa por inactividad (más delicado: hay cobros en curso).
- **Definitivo**: push con Centrifugo (0B-4) → cero polling.

## 7. Rollback

Revertir el commit. El KDS vuelve a pollear cada 10 s y muestra todo igual.
No hay cambios de datos ni de esquema.

## 8. Verificación

```
tsc    apps/kds        → 0 errores
build  apps/kds        → OK
```
