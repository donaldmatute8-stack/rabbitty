# Tienda de productos para cafés y restaurantes

**Qué resuelve:** un negocio de comida ya vende platillos en el menú; ahora
también vende lo que el cliente se lleva a casa —café en grano, pan, botellas,
merch— **sin un modelo de datos paralelo**.

## Decisión de diseño: producto = platillo marcado

Un producto de tienda es una fila de `menu_items` con `kind = 'PRODUCT'`.

| Pieza | Se reutiliza |
|---|---|
| Carrito, orden, líneas de orden | `cart` del perfil del negocio y `/api/pos/checkout` |
| Ticket / POS / KDS | mismas tablas: un producto se cobra como cualquier línea |
| Contabilidad y conciliación | `payments`, `orders`, `ledger_entries` (sin cambios) |
| Inventario y bajo stock | `inventory_items` + `inventory_movements` |
| Envío | `orderType = DELIVERY` con `deliveryAddressData` (ya existía) |

Lo único nuevo en la base (migración `0027_store_products.sql`, aditiva):

```
menu_items.kind           DISH | PRODUCT   (default DISH)
menu_items.requiresShipping   pide dirección de entrega
menu_items.weightGrams        peso, para cotizar envío
menu_items.maxPerOrder        tope de unidades por pedido
```

El **stock no se guarda aquí**: se descuenta del inventario con una receta 1:1
(`menu_item_ingredients` con `quantityRequired = 1` → `inventory_items`). Un
producto con receta descuenta stock automáticamente al cobrar; sin receta se
vende sin control de existencias, igual que un platillo.

## Motor de inventario compartido

`packages/api/src/services/inventoryDeduction.ts`

- `resolveInventoryRequirements()` — traduce líneas de pedido a insumos,
  siguiendo sub-recetas y cortando ciclos.
- `checkStockForItems()` — ¿alcanza? Devuelve los faltantes con nombre.
- `deductOrderInventory()` — descuenta al cobrar y deja `inventory_movements`.

Lo usan **los dos** caminos que cobran: el POS (`pos.processPayment`) y la app
(`/api/pos/checkout`). Antes sólo el POS descontaba stock, así que una venta
desde la app dejaba el inventario intacto.

Regla distinta a propósito: el POS puede vender de más y avisar (la venta ya
ocurrió en el mostrador); **la app bloquea** el pedido con 409 y dice qué falta,
porque el cliente paga y se quedaría sin producto.

## Cómo lo ve cada quien

**Rabbiter** (`/affiliate/[id]`): tercera pestaña **Tienda**, sólo si hay
productos. Escaparate en tarjetas con foto, precio, chip *Envío* y tope por
pedido. Tocar abre el mismo detalle de producto del menú (cantidad, notas) y
cae al **mismo carrito**. Al confirmar, el selector de siempre decide: recoger
(`TAKEAWAY`) o envío (`DELIVERY` + dirección). Si el pedido trae un producto que
se envía y el cliente no eligió nada, se asume envío y se le pide la dirección.

**Comercio** (`admin → Menú`): al crear o editar un artículo se elige
*Platillo* o *Producto de tienda*; si es producto aparece el interruptor de
envío, peso y máximo por pedido. Las tarjetas del catálogo muestran el sello
`Tienda` / `Tienda · envío`. El stock se controla en **Inventario** (receta del
producto), donde ya existen movimientos y alertas de bajo stock.

**Envío:** el pedido sale como `DELIVERY` con dirección estructurada, que es lo
que ya consumen los proveedores de última milla (`MANUAL`, `UBER_DIRECT` cuando
haya credenciales y `RABBITTY_RIDE` a futuro). No se añadió un segundo flujo de
entrega.

## Estado (18-nov, cierre del bloque)

**Hecho después de la v1:**

- **Fotos en el bucket**: `POST /api/uploads/product` (admin) sube a
  `menu/<branchId>/<uuid>.jpg` y guarda la URL; se sirven por
  `/api/media/product/<key>` (pública, cache inmutable). El chat reusa el mismo
  helper (`@rabbitty/api/services/mediaStorage`). Si el bucket no está
  configurado, el formulario cae al dataURL como antes: no se rompe.
- **Zonas de envío por distancia**: `deliveryConfig.zones = [{maxKm, fee}]`. Se
  elige la primera zona que cubre la distancia sucursal→dirección (haversine); sin
  coordenadas se usa `baseFee`. La sucursal necesita `lat/lng` (626 Café ya los
  tiene).
- **Editar producto desde `/store`**: precio, foto (subida o URL), envío, peso y
  tope por pedido, sin ir a Menú.
- **Toggle de envío y badge de bajo stock** por producto en la lista.
- **Sucursal de producción**: la ficha del cliente, la cotización y el checkout
  eligen activa + no-sandbox; antes `findFirst`/`limit(1)` podía devolver la
  archivada (sin coordenadas ni tienda).

**Decisión sobre pedidos mixtos**: **no se parte la orden**. Un pedido con
platillos + productos es una sola orden y un solo cobro; el KDS filtra los
productos (no hay nada que cocinar) y el POS los ve como líneas normales. Partir
habría obligado a dos pagos y dos tickets para un cliente.

**Ajuste de horario**: check-in ("Estoy Aquí"), "planeo ir" y las alertas de
proximidad exigen que el negocio esté abierto (`isBusinessOpen`, el mismo horario
de la ficha y el POS). Con el local cerrado el panel dice "Cerrado ahora" y el
servidor responde 409.

## Pendiente / siguiente iteración

> El detalle priorizado y con criterios de aceptación vive en
> `Docs/ROADMAP/SIGUIENTE.md` (bloque 1: envío cobrable, admin de tienda,
> existencias visibles, contabilidad por tipo y fotos en bucket).

- **Costo de envío**: hoy la dirección viaja, pero la tarifa no se cobra en línea
  (se cotiza en el POS al asignar repartidor). Si se quiere cobrar por adelantado,
  el lugar es `orders.deliveryFee` + cotización del proveedor antes de pagar.
- **Envío sólo**: hoy el pedido puede mezclar platillos y productos; si el
  negocio quiere separar tickets (comida para ahora + café para casa) hace falta
  partir la orden por `requiresShipping`.
- **Fotos de producto**: se guardan como dataURL (límite 300 KB). Para catálogos
  grandes conviene el bucket (S3/R2) que ya usa el marketplace.
- **Stock en la app**: el catálogo no muestra existencias (sólo bloquea al
  cobrar). Exponer `stock` en `/api/business/[id]` sería el siguiente paso.

## Prueba local (datos de demostración)

En la base local de 626 Café quedó un producto de prueba:

```
Café en grano 500 g · $320 · kind=PRODUCT · requiresShipping=true · máx 4
Insumo "Café en grano 500 g (prueba)" con stock 12 y receta 1:1
```

Para verlo: `/affiliate/fb7f4847-920f-4482-8ae3-c810a20e75ad` → pestaña
**Tienda**. Para borrarlo, elimina la fila `11111111-2222-3333-4444-555555555555`
de `menu_items` y su insumo en `inventory_items`.

Comprobado con las dos bases locales (core y restaurant, que en producción son
la misma): el endpoint devuelve el producto y `checkStockForItems` responde
`[]` con 1 unidad y el faltante con 20.
