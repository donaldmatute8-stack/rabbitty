# Rabbit Chair — Concepto, producto y landing privada

> Nombre oficial: **Rabbit Chair** · La experiencia se llama **“La Silla”**.

> Estado: **concepto cerrado para revisión**. No hay código, ni cambios en 626, ni deploy.
> Fecha: 2026-11-23 · Autor: Rabbitty (producto) para 626 Café y tenants seleccionados.

---

## 0. Resumen ejecutivo

**La Silla** es una experiencia inmersiva de bar oscuro con cupo secreto: una silla bajo un
spot, un bartender con máscara de conejo, música siniestra y **10 minutos** para tomar algo
que el cliente configura sin hablar. Se vende a los tenants como **upgrade de experiencia**
o se regala como **recompensa por hitos** (antigüedad, clientes, aniversario).

Es un producto de Rabbitty, no una página aparte: usa el login, los pagos con tarjeta, el POS
y las notificaciones que ya existen.

**Lo que se vende no es una bebida: es un drop.** Escasez, silencio y sorpresa.

---

## 1. La idea en una página

**Promesa:**
> Una silla. Una luz. Diez minutos. No hablas: eliges.

**Reglas de la casa:**

1. No hay fecha pública: el día se lanza sin avisar (o lo elige el tenant).
2. 10 lugares por activación.
3. No se habla: todo se pide desde el teléfono.
4. No hay precio fijo: aportación mínima **$50**, solo **tarjeta**.
5. 10 minutos desde que se sirve la bebida.
6. Bartender sorpresa (opcional).

**Por qué engancha:** convierte una visita en un **rito**. El cliente no compra un café,
compra haber estado ahí.

**Origen (para la historia de marca):** una noche de música de terror, luces apagadas y una
luz roja. La gente se detuvo en la calle a mirar. La silla nació de esa imagen.

---

## 2. Variantes configurables (lo que elige el tenant)

Todo el producto se define con **5 decisiones**. La landing las presenta como “arma tu
experiencia”.

| # | Decisión | Opciones | Default sugerido |
|---|---|---|---|
| 1 | **Carta** | Solo café · Con alcohol · Ambas según evento | Solo café (arranque) |
| 2 | **Formato** | **Una silla** (de uno en uno) · **Diez a la vez** · Mixto (10 en la noche, de uno en uno) | Mixto |
| 3 | **Fecha** | La elige el tenant · **Aleatoria con un clic (Bunzy)** · Recurrente | Aleatoria con ventana |
| 4 | **Música** | Playlist curada por Rabbitty (3 moods) · Curada + propia | Terror / ambiente |
| 5 | **Bartender** | Fijo (mismo cada vez) · **Rotativo sorpresa** | Rotativo |

### 2.1 “Aleatoria con un clic (Bunzy)”

El tenant define una **ventana** (ej. “cualquier día de las próximas 3 semanas, entre 18:00 y
22:00, que no sea lunes”) y Bunzy:

1. elige día y hora dentro de la ventana respetando horario del negocio y staff,
2. deja el drop en **secreto** (nadie ve la fecha),
3. a la hora elegida dispara el push “Hay una silla” al segmento,
4. abre el cupo.

El tenant puede **cancelar hasta X horas antes** sin penalización.

---

## 3. La experiencia del cliente (flujo)

```
App (Rabbitters)
 └─ Teaser "???"  ──►  Push "Hay una silla"
      └─ Pantalla del drop: cupo restante + botón "Tomar la silla"
           └─ Configurador silencioso (sin hablar)
                └─ Pago con tarjeta (aporte ≥ $50)
                     └─ Pase con QR + instrucciones ("llega, siéntate, no hables")
                          └─ En 626: QR del asiento → barra
                               └─ Bartender sirve (máscara)
                                    └─ Cronómetro 10:00
                                         └─ La luz cambia → fin
```

**El configurador (sin palabras):**

| Paso | Opciones (ejemplo café) |
|---|---|
| Base | Espresso · Filtrado · Cold brew |
| Intensidad | Suave · Media · Oscura |
| Textura | Solo · Leche · Espuma |
| Temperatura | Caliente · Frío |
| Dulzor | Sin · Poco · Punto |
| Aroma | Vainilla · Cacao · Cítrico · Ninguno |
| Extra | Shot extra · Sin lactosa · Hielo grande |

Con alcohol se cambia el set (base, amargo, cítrico, humo, garnish). **La configuración es
parte del espectáculo:** nada de nombres de marca, todo sensorial.

**Reglas del pase:** una bebida por persona, no fotos con flash, no llamadas, salida al
terminar el tiempo.

---

## 4. La operación (tenant)

### 4.1 Preparar (5 minutos)

- Cupo (1 / 10 / mixto), duración (10 min), aportación mínima.
- Carta y configurador (café / alcohol / ambos).
- Playlist (preset o propia) y guion de luz.
- Bartender (fijo o rotativo) — **no se publica**.
- Fecha: manual o “que Bunzy elija”.

### 4.2 Lanzar

- Botón **“Abrir la silla”** → push al segmento (radio / miembros / lista de espera).
- Al llenarse: **SOLD OUT** automático.
- Al terminar: se archiva y entra a la caja normal.

### 4.3 En piso

- El POS abre la pestaña **LA SILLA** con los lugares: configuración, nombre, estatus.
- `Pagado → En barra → Servido (arranca cronómetro) → Tiempo`.
- La luz cambia al terminar (automático o manual).

### 4.4 Cierre

- La activación se concilia como cualquier venta. **No hay caja paralela.**

---

## 5. Producto: qué se construye y qué se reutiliza

| Pieza | Estado | Uso |
|---|---|---|
| Pagos tarjeta (Stripe) | ✅ existe | Aporte ≥ $50 |
| Órdenes + POS + barra | ✅ existe | La configuración entra como comanda |
| Push + segmentos | ✅ existe | El drop |
| Proximidad | ✅ existe | Avisar solo a quienes están cerca |
| Membresías / Bunz | ✅ existe | Preventa o beneficio para miembros |
| Vibe Passport / PoA | ✅ existe | Sello de la experiencia |
| Kiosko / QR | ✅ existe | Configurador en el asiento |
| **Activación con cupo secreto** | 🆕 | Tabla + UI del drop |
| **Configurador silencioso** | 🆕 | App + QR |
| **Aporte variable (sin precio fijo)** | 🆕 | Checkout con monto libre |
| **Cronómetro desde “servido”** | 🆕 | Marca en POS + countdown |

**Modelo de datos (mínimo):**

```
activations        id, businessId, branchId, nombre, estado (SECRET|LIVE|SOLD_OUT|DONE),
                   cupo, minAportacionCents, moneda, soloTarjeta, duracionMin,
                   startsAt (privado), radioMetros, playlist, luzPreset,
                   formato (ONE|TEN|MIXED), carta (COFFEE|ALCOHOL|BOTH), bartenderMode
activation_slots   id, activationId, indice, estado (FREE|HELD|PAID|SEATED|SERVED|DONE),
                   orderId, userId, servedAt, endsAt
activation_configs id, slotId, base, intensidad, textura, temperatura, dulzor, aroma, extras
```

La orden entra al POS con `channel = 'LA_SILLA'`.

---

## 6. Landing privada para venderlo

### 6.1 Objetivo

Que un tenant **invitado** entienda la experiencia en 60 segundos y diga **“actívalo”**
(upgrade) o reciba su **regalo** (hito).

### 6.2 Cómo es privada

| Mecanismo | Detalle |
|---|---|
| URL con token | `rabbitty.me/la-silla?t=<token firmado>` — un enlace por tenant |
| Contenido personalizado | Saluda por nombre del negocio y muestra su caso (upgrade o regalo) |
| Sin indexar | `noindex, nofollow` + `robots.txt` |
| Caducidad | 30 días (configurable) |
| Marca de agua | Nombre del tenant visible para desalentar reenvíos |
| Acceso | Sin login para que el dueño la abra desde WhatsApp; el CTA sí lleva al panel |

### 6.3 Estructura y copy (listo para maquetar)

---

#### HERO

> **626 · LA SILLA**
> **No sabes cuándo. No sabes quién.**
> Solo sabes que hay una silla y diez minutos.
>
> *Aportación desde $50 · solo tarjeta · sin hablar.*
>
> **[ Quiero La Silla ]**

*Fondo: la imagen del spot rojo con la silla y el bartender de máscara. Sin texto encima más
que el título y una línea. Nada de botones brillantes.*

---

#### 01 · QUÉ ES

> Una activación secreta en tu local.
> Una silla bajo la luz. Un bartender que no conoces. Música que te pone en alerta.
> El cliente no habla: elige. Y a los diez minutos, se va.
>
> **No vendes una bebida. Vendes haber estado ahí.**

---

#### 02 · CÓMO FUNCIONA (5 pasos)

1. **Eliges** carta, formato, fecha y bartender.
2. **Abres** la silla: se manda el aviso.
3. **Se llena**: 10 lugares, ni uno más.
4. **Se sirve**: el cronómetro arranca solo.
5. **Se cierra**: entra a tu caja como cualquier venta.

---

#### 03 · TÚ DECIDES

> **Una silla o diez.** De uno en uno, todos a la vez, o mixto en la misma noche.
> **Café o coctelería.** Según tu carta y tu licencia.
> **Fecha tuya o al azar.** Un clic y Bunzy elige el día, respetando tu horario.
> **Música nuestra o tuya.** Tres ambientes curados: *Terror*, *Ritual*, *After*.
> **Bartender fijo o sorpresa.** El que tú digas; si no, rota.

---

#### 04 · LO QUE GANAS

| Para el negocio | Para el cliente |
|---|---|
| Noche vendida sin promociones ni descuentos | Una experiencia que no puede comprar en otro lado |
| Ticket promedio más alto (aporte libre) | Estatus: “yo estuve en La Silla” |
| Contenido orgánico (la gente lo cuenta) | Sello en su pase de Rabbitty |
| Datos: quién viene, qué configura | Cero fricción: paga desde el teléfono |

> **Ocupa una barra. Llena una noche. Te posiciona.**

---

#### 05 · DOS FORMAS DE TENERLO

**Regalo por hito (única vía por ahora)**
> Llegaste a **[hito]**. Va por nuestra cuenta: **3 activaciones** para que lo pruebes con
> tus clientes.
>
> *Asignación manual · sin permanencia · sin costo*

**Más adelante (documentado, no activo)**
> Upgrade de experiencia: módulo en tu panel, configurador, drops y playlists.
> *Precio a definir.*

---

#### 06 · PREGUNTAS QUE SIEMPRE NOS HACEN

**¿Necesito comprar equipo?**
No. Un teléfono para el configurador y una luz.

**¿Puedo cobrar en efectivo?**
La experiencia está pensada para tarjeta: el aporte se cobra en la app.

**¿Y si no llegan?**
Puedes liberar los lugares no reclamados a los 10 minutos. La lista de espera entra sola.

**¿Es solo para 626?**
No. El formato se adapta a cualquier tenant con barra.

**¿Se puede sin alcohol?**
Sí. La versión café funciona igual y abre la puerta a más públicos.

---

#### CIERRE

> **Hay una silla esperando.**
> La pregunta es si vas a ser tú.
>
> **[ Activar La Silla ]** · **[ Hablar con nosotros ]**

---

### 6.4 CTA y qué pasa al tocar

1. **Activar**: lleva al panel (login) → módulo La Silla → asistente de 5 pasos.
2. **Hablar con nosotros**: abre el chat de soporte con el tenant y el contexto de la landing.
3. **Regalo**: mismo flujo, con las 3 activaciones ya cargadas y fecha por definir.

### 6.5 Métricas de la landing

- Apertura del enlace (por tenant).
- Tiempo en página y scroll hasta “Dos formas”.
- Clic en Activar / Hablar.
- Activación real en los siguientes 30 días.

---

## 7. Cómo se empaqueta comercialmente

| Modelo | Cuándo usarlo | Qué incluye |
|---|---|---|
| **Add-on mensual** | Tenant que ya opera y quiere diferenciarse | Módulo + drops ilimitados + playlists |
| **Pago por activación** | Tenant estacional o que quiere probar | 1 noche, cupo fijo |
| **Incluido en tier superior** | Plan “Signature” / premium | Todo lo anterior + soporte de montaje |
| **Regalo por hito** | Antigüedad, clientes, aniversario | 3 activaciones de prueba |

**Estado actual:** sin precio. **Solo regalo por hito**, asignado **a mano** por el equipo de Rabbitty
(se genera el enlace privado y el tenant lo recibe por WhatsApp o correo). El empaquetado comercial
queda documentado para cuando se decida cobrar.

---

## 8. Legal, pagos y Apple

- **Experiencia física** pagada con tarjeta: permitido dentro de la app (no es contenido digital).
- **Alcohol**: licencia de bebidas, +18, sin promoción a menores. Si no hay licencia, versión café.
- **Música**: si es comercial en evento, revisar SACM; las playlists curadas son ambientales.
- **Imagen**: aviso claro si habrá fotos; opción “sin teléfonos” desde el pase.
- **Aportación libre**: se muestra el mínimo antes de pagar; se registra como venta, no como propina.

---

## 9. Roadmap

| Fase | Entrega | Esfuerzo |
|---|---|---|
| **0** | Documento + landing privada (esta pieza) | 1–2 días |
| **1** | Activación manual, cupo, configurador, pago, POS y cronómetro | 1–2 semanas |
| **2** | Drop con push por radio, lista de espera, sold out | 3–5 días |
| **3** | Fecha aleatoria con Bunzy, playlists, sello en Vibe Passport | 3–5 días |
| **4** | Landing self-service y paquetes comerciales | 1 semana |

---

## 10. Decisiones (cerradas y abiertas)

**Cerradas el 2026-11-23:**

1. **Nombre:** Rabbit Chair (la experiencia: “La Silla”).
2. **Precio:** no hay precio por ahora. El acceso es por **hito**, asignado **manualmente** desde Rabbitty.
3. **MVP:** arranca con **café y alcohol** (626 Café vende ambos en producción).
4. **Fecha:** manual o aleatoria con un clic (Bunzy), a elección del tenant.
5. **Bartender:** fijo o rotativo, a elección del tenant.

**Abiertas (documentadas para después):**

- Regla del hito (meses, clientes, aniversario) y **quién** lo otorga.
- Ventana por defecto para la fecha aleatoria.
- Empaquetado comercial (add-on / pago por activación) cuando se decida cobrar.
- Si el regalo incluye montaje en sitio o solo el módulo.

---

## 11. Resumen para WhatsApp (invitación)

> Hicimos **Rabbit Chair**: una silla, una luz, diez minutos y diez lugares.
> El cliente no habla: configura su bebida desde el teléfono y paga con tarjeta desde $50.
> Tú eliges día o dejas que el sistema lo sortee, con bartender sorpresa.
> Te tocó por hito, va por nuestra cuenta. Te mando tu enlace privado.
