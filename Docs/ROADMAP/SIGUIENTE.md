# Siguiente sesión — plan de trabajo

> Escrito al cierre del **18-nov-2026**. Es la lista de lo que falta, lo acordado
> para mañana y los pendientes que ya viven en otros documentos.
> Estado del árbol en ese cierre: `main` = `1fb60d7`, health `ok`, app del cliente
> en producción y build iOS **2.5 (19)** subido a App Store Connect.

---

## 0. Qué quedó cerrado hoy (para no repetirlo)

| Tema | Resultado |
|---|---|
| Base de datos | Fail-fast si falta la URL (host centinela en vez de `127.0.0.1`), fallback restaurante→core, `/api/health` con modos `?config=1` y `?strict=1`, errores en una línea (`describeError`) |
| SSE `realtime/events` | Cierra a los 4 min (ya no choca con el timeout de 300 s de Vercel) |
| App Store 3.1.1 | Alta de negocios retirada del binario; build 19 subido (aviso 90725 = solo informativo) |
| Entorno local | Postgres propio, esquema clonado de producción, datos de referencia de 626 Café, cero consumo de Neon |
| Swipe | Primitiva compartida (`useSwipeToDismiss` + `overlayLock`); el gesto ya no atraviesa al pull-to-refresh ni al swipe de atrás |
| Tienda v1 | Producto = platillo con `kind = 'PRODUCT'`; inventario compartido entre POS y app; pestaña Tienda; admin con tipo/envío/peso/tope |

---

## 1. Mañana — Bloque 1 · Tienda v2 (cotizabilidad, admin, existencias)

Hoy la tienda vende; mañana tiene que **administrarse y cobrarse completa**.
`Docs/STORE/TIENDA-PRODUCTOS.md` tiene el diseño; esto es lo que falta.

### 1.1 Envío cobrable (2 h)
- [ ] Cotizar antes de cobrar: `uberDirect.quote` con dirección + peso del carrito
      (`menu_items.weightGrams`) y mostrar el costo en el carrito.
- [ ] Guardar la tarifa en `orders.deliveryFee` (la columna ya existe, hoy siempre 0).
- [ ] Fallback cuando no hay proveedor: tarifa plana por zona del negocio (nueva
      tabla `delivery_zones` o un campo JSON en `restaurants`), nunca envío gratis
      silencioso.
- [ ] Decidir política: **cobrar el envío en la app** (Bunz/efectivo no cubren la
      tarifa) o **cobrarlo en el POS** al asignar repartidor. Sin decisión, el
      comercio absorbe el costo.
- Criterio: un pedido de tienda a domicilio muestra el envío en el resumen y ese
  monto llega al ticket y a conciliación.

### 1.2 Administración de la tienda (2 h)
- [ ] Vista **Tienda** en admin (filtro `kind = 'PRODUCT'`): lista con precio,
      stock actual, vendidos del mes y estado publicado/oculto.
- [ ] Ligar la receta 1:1 desde la propia ficha del producto (hoy hay que ir a
      Inventario a mano). Un clic: "controlar existencias con este insumo".
- [ ] Publicar/despublicar (`isAvailable`) y orden del escaparate (`sortOrder`)
      desde esa vista.
- [ ] Aviso al comercio cuando un producto se queda sin stock (reusar los
      invariantes de `ops-health`, no un cron nuevo).
- Criterio: el dueño crea, publica y controla un producto sin salir de la sección.

### 1.3 Existencias visibles (1 h)
- [ ] Exponer `stock` en `GET /api/business/[id]` (join a `inventory_items` por la
      receta) con `stock` y `lowStock` por producto.
- [ ] En la app: "quedan N" cuando `stock <= minStock`, y agotado al llegar a 0
      (hoy solo se bloquea al cobrar).
- [ ] Respetar `maxPerOrder` también en el carrito (hoy solo lo valida el servidor).
- Criterio: el cliente no puede agregar más de lo que hay ni de lo permitido.

### 1.4 Contabilidad y control (1 h)
- [ ] Reporte por `kind`: ventas de tienda vs menú, margen (`price` vs `cost`),
      unidades y ticket promedio.
- [ ] Ticket y KDS: los productos no van a cocina (filtrar por `kind` en la
      estación/KDS).
- [ ] Conciliación: incluir productos con su `cost` para el margen real.
- Criterio: el contador puede separar "tienda" de "consumo en local" sin Excel.

### 1.5 Pendientes menores (si sobra tiempo)
- [ ] Fotos fuera de la base (dataURL hoy, tope 300 KB) → bucket del marketplace.
- [ ] Pedido mixto (comida ahora + café para casa): evaluar partir en dos órdenes.

---

## 2. Mañana — Bloque 2 · Página de comercio premium

**Diagnóstico medido** de `telegram-miniapp/src/app/affiliate/[id]/page.tsx`:
**1,718 líneas**, **21 colores hex distintos** (24 usos del rosa de marca, más
morados, azules, verdes, ámbar y un `#25D366` de WhatsApp), **10 gradientes
inline** en una sola pantalla, y todo compitiendo a la vez: pestañas, hero,
recompensa, "planeo ir", mood, happy hour, marketplace de membresías, galería,
tabs de sucursal y carrito flotante.

La queja es correcta: hay demasiados acentos y todo grita al mismo volumen.

### 2.1 Sistema antes de pantalla (1.5 h)
- [ ] Fijar tokens en `globals.css`: superficie (3 niveles), borde, texto
      (primario/secundario/tenue), **un solo acento de marca** (rosa→violeta) y
      semánticos reservados a estado (verde = abierto/ok, ámbar = atención).
- [ ] Escala tipográfica única (display / título / cuerpo / micro) y **un radio
      por nivel** (hoy conviven 12, 14, 16, 20, 24, 34 px).
- [ ] Regla: nada de hex inline nuevo en pantallas; si hace falta un color, es
      token. Se revisa en el diff.
- Entregable: `Docs/design/COMERCIO-TOKENS.md` con la tabla de tokens y 3
  ejemplos de uso.

### 2.2 Jerarquía de la pantalla (2 h)
- [ ] **Una acción primaria**: "Pedir" (menú/tienda). Todo lo demás baja de nivel.
- [ ] Hero: foto del local + estado (abierto/cerrado) + recompensa en Bunz. Sin
      badges decorativos.
- [ ] Pestañas a **2 o 3**: `Menú`, `Tienda` (si hay), `Info`. "Planeo ir", mood,
      happy hour y galería se mueven a `Info` o a una hoja inferior.
- [ ] Marketplace de membresías y otras secciones secundarias: fuera del primer
      scroll.
- [ ] Menos tarjetas apiladas: agrupar en secciones con aire, no una card por dato.

### 2.3 Cierre
- [ ] Capturas antes/después y una guía corta de "cómo se ve premium aquí".
- [ ] Sin tocar lógica: solo presentación y estructura de componentes.
- Criterio: la pantalla se lee de un vistazo —qué es, si está abierto, cuánto
  devuelve y cómo pedir— sin competir con decoración.

---

## 3. Mañana (o en cuanto haya ventana) — Bloque 3 · Offline

Base ya escrita en `Docs/POS-FASE-0/OFFLINE-POS-KDS.md`. Decisiones que **no** se
reabren:

- En offline **solo se cobra en efectivo**; tarjeta, wallet y Bunz se apagan
  (necesitan servidor y el pozo). Nunca emitir Bunz sin respaldo.
- Todo cobro offline deja una **llave de idempotencia** (el servidor ya deduplica,
  `pos.ts:2273/2348`) y entra a una **bandeja de conciliación**: no se aplica solo.
- La impresión del ticket no puede depender de la red.
- Ya existe: cola del comandero en IndexedDB (`apps/admin/src/lib/comandero-queue.ts`)
  y service worker que nunca cachea `/api/`.

Pasos propuestos:
- [ ] **Paso 1 (sin tocar el cobro):** outbox genérico de comandos + reintento con
      backoff y estado visible ("3 pendientes"). Reusar la cola existente.
- [ ] **Paso 2:** lectura offline del menú y mesas (cache caliente con versión y
      `updatedAt`), para que el POS abra sin red.
- [ ] **Paso 3:** cobro offline en efectivo con corte local, outbox y bandeja de
      conciliación en admin.
- [ ] **Requisito:** probarlo con 626 Café en una ventana sin operación (hoy el
      local está en producción; no se puede experimentar en vivo).

---

## 4. Pendientes que ya están documentados (índice)

| Tema | Documento | Estado |
|---|---|---|
| Tienda: diseño y límites | `Docs/STORE/TIENDA-PRODUCTOS.md` | v1 en producción; falta el bloque 1 de arriba |
| Rechazo 3.1.1 y nota al revisor | `Docs/APP-STORE/3.1.1-ALTA-NEGOCIO.md` | build 19 subido, **esperando review** |
| Offline POS/KDS | `Docs/POS-FASE-0/OFFLINE-POS-KDS.md` | alcance y reglas escritos; sin código |
| Resiliencia / centro de mando | `Docs/RESILIENCIA_OFFLINE_Y_CENTRO_COMANDO.md` | diseño |
| Hardware y adquirente (EMV L3) | `Docs/PAYMENTS/` (brief + cuestionario PSP) | **bloqueado**: falta que un adquirente mexicano certifique L3 |
| Entorno local | `Docs/OPS/ENTORNO-LOCAL.md` | funcionando; falta sesión de prueba para pantallas autenticadas |
| Deuda de migraciones DB | `Docs/DEUDA-MIGRACIONES-DB.md` | abierta |
| Legal pendiente `[REVISAR]` | `Docs/LEGAL/00-INDICE-Y-ADVERTENCIA.md` | abogado |
| Monitoreo de la app | `/api/health?strict=1` | endpoint listo; **decidir** si un uptime externo lo consulta |

---

## 5. Riesgos y dependencias

- **Orden de despliegue:** migración **antes** que el código que la usa (hoy se
  aplicó `0027` a producción antes del deploy de Vercel). Cualquier columna nueva
  hereda esta regla; el predeploy de Railway corre `sql-migrate`, Vercel no.
- **Apple:** no tocar compras ni alta de negocios mientras el build 19 está en
  review. Un cambio en esas pantallas obliga a otro build.
- **Uber Direct:** sin credenciales (`UBER_DIRECT_*`), el envío es manual. El bloque
  1.1 no depende de él si se usa tarifa por zona.
- **Neon:** el entorno local ya no lo despierta. El `?config=1` del health tampoco
  hace queries, así que un cron de 15 min no consume base.
- **626 Café:** cualquier prueba de offline requiere ventana acordada.

---

## 6. Arranque sugerido para mañana

```bash
cd /Users/Marco/Documents/Company/Rabbitty/dApp
git pull                       # main debe estar en 1fb60d7 o más
curl -s localhost:3000/api/health        # core + restaurant ok
curl -s "localhost:3000/api/health?config=1"
```

Orden propuesto: **1.1 envío cobrable → 1.2 admin → 1.3 existencias → 1.4
contabilidad → Bloque 2 → Bloque 3**. Si el envío cobrable se complica con Uber,
seguir con 1.2/1.3 (no dependen de credenciales) y dejar 1.1 para cuando haya
proveedor.

---

## 7. Definición de "terminado" por bloque

- **Tienda v2:** un pedido de tienda se cotiza, se cobra con envío, descuenta
  stock, aparece separado en el reporte y el dueño lo administra desde el admin
  sin tocar SQL.
- **Comercio premium:** ≤ 2 acentos de color en pantalla (marca + semántico),
  1 acción primaria, ≤ 3 pestañas, y las capturas antes/después lo demuestran.
- **Offline:** el POS abre y cobra en efectivo sin red, imprime, y al volver la red
  el cobro se concilia sin duplicar (misma orden, misma llave) — probado con 626.
