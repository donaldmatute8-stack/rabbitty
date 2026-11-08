# Admin · Funciones ocultas y depuradas (2026-11-08)

> Registro de lo que se ocultó, se eliminó o se dejó accesible solo por URL
> durante la revisión del admin de afiliados. El objetivo es no perder trabajo
> útil y no prometer funciones que todavía no existen.

## 1. Eliminado

### `/fastapi-settings` — FastAPI Webhook Bridge (página)

- **Qué era:** formulario para configurar la URL/secreto del bridge FastAPI y
  probar la conexión con la miniapp.
- **Por qué se eliminó:** era una página técnica de nivel plataforma expuesta
  dentro del área de afiliados (`protectedProcedure` en lectura). La
  configuración real vive en variables de entorno (`RABBITTY_MINIAPP_URL`,
  `RABBITTY_API_SECRET`) y la operación de sincronización ya se hace desde
  `/restaurant-sync`, que sigue en el menú.
- **Qué se conserva:** el router `trpc.fastapi.*` sigue activo porque
  `/restaurant-sync` usa `syncRestaurant` y `rechargeBusinessBunz`. No se tocó.
- **Si se necesita de nuevo:** montar la pantalla bajo `/god/*` y no en el área
  de afiliados. `fastapi.configure` ya es `godAdminProcedure`.

## 2. Oculto pero funcional (sin entrada en el menú)

Estas páginas existen y compilan, pero no se muestran en el sidebar. Se dejan
para no perder la implementación; **no** están anunciadas al afiliado.

| Ruta | Estado | Decisión |
|---|---|---|
| `/waitlist` | Funcional (lista de espera con mesas del POS) | Útil para operación. Falta decidir si se activa como módulo del sidebar (`waitlist`) y si entra en el onboarding. |
| `/invoices` | Funcional (consulta/cancelación CFDI) | Depende del cierre fiscal. Se activa cuando facturación esté lista. |
| `/restaurant-sync` | Funcional (sync POS + recarga Bunz) | **Sí está en el menú** (Configuración). Se menciona aquí solo para aclarar que reemplaza a `fastapi-settings`. |

## 3. Funciones futuras retiradas de la UI

| Función | Dónde estaba | Qué se hizo |
|---|---|---|
| **Rabbitty Print Agent** | `/hardware` (tarjeta con botones macOS/Windows) y guía de conexión | Se quitó la tarjeta y los botones de descarga. La guía ahora explica solo lo que hoy funciona: bridge USB/Mac, Web Bluetooth (BLE) e impresión del navegador. |
| **Impresión por red RAW 9100** | Guía de hardware | Se dejó como limitación explícita (“no disponible desde el navegador”), sin prometer un agente. |
| **Propina digital (`DIGITAL` / `BOTH`)** | `Mi negocio → Operación POS` | El selector muestra solo `OFF` y `POS`. Si un negocio tenía `DIGITAL`/`BOTH` guardado, se normaliza a `POS` al cargar. El enum del API se conserva para no romper datos históricos. |

## 4. Separación GOD / afiliado

- Las aprobaciones de negocios viven en **`/god/tenants`** (solo `godAdminProcedure`).
- `/restaurants` quedó como resumen operativo del afiliado, sin acciones GOD.
- La edición del negocio vive en **`/perfil-negocio`**; `Ajustes` solo enlaza.
- `admin.getPendingBusinesses` ahora filtra en SQL por
  `PENDING` / `PENDING_VERIFICATION` y ordena por fecha, para que el panel GOD
  no reciba toda la base de negocios.

## 5. Deuda técnica relacionada

- El estado canónico de negocio aprobado es **`APPROVED`**. `VERIFIED` se sigue
  aceptando al leer (datos históricos) pero ya no se escribe desde el flujo
  nuevo.
- `waitlist` e `invoices` no tienen entrada de menú; si se activan, agregarlas
  a `MODULE_BY_HREF` en `AdminSidebar` y a los presets de negocio.
