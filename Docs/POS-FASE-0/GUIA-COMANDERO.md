# Guía · Comandero digital y reloj checador

**Para:** dueños, encargados y meseros
**Versión:** 13-nov-2026 · ADR-025

---

## 1. Qué es

Una pantalla para **tomar pedidos** desde el celular del mesero o desde una
tablet del restaurante. Manda la comanda a cocina/barra y deja la cuenta abierta
para que la caja la cobre.

**No cobra, no maneja propina y no factura.** Eso sigue siendo de caja.

La ventaja de fondo: **no hay que comprar hardware**. Cualquier teléfono con
cámara y Wi-Fi sirve.

---

## 2. Puesta en marcha (una sola vez, desde el admin)

1. **Ajustes → Terminales**: crear una terminal y asignarle **estación**
   (Barra, Cocina…). Esa estación decide a qué pantalla llega la comanda.
2. **Ajustes → Reloj checador**: dejar esa pantalla abierta en la caja o en una
   tablet de la entrada. Muestra un QR que **rota cada minuto**.
3. En el celular del mesero: abrir `/comandero`, **escanear el QR** y capturar
   su **PIN**.
4. Instalar como app: en Safari *Compartir → Añadir a pantalla de inicio*; en
   Chrome *Menú → Instalar aplicación*. Queda a pantalla completa.

---

## 3. Operación diaria

| Paso | Qué hace el mesero |
|---|---|
| Entrar | Escanea el QR de la sucursal + PIN. Queda registrada su entrada. |
| Elegir mesa | Toca la mesa. Si ya tiene cuenta abierta, se reutiliza. |
| Pedir | Toca el platillo: cantidad, **extras**, **alergias**, **nota** y **para quién es**. |
| Enviar | Botón **Enviar**. Lo agregado pasa de *en captura* a *enviado a cocina*. |
| Seguir | Puede agregar más tandas mientras la cuenta esté abierta. |
| Cerrar | Sale del comandero; se registra su salida. La cuenta la cobra caja. |

### Extras

Solo los que el menú define para ese platillo, **con su precio**. El mesero no
puede inventar montos: lo que se cobra es lo que dice el menú.

### Alergias

Catálogo de un toque (gluten, lactosa, nuez, mariscos, huevo, soya, cacahuate)
**más** texto libre para lo que no esté en la lista. En la pantalla de cocina
sale en **rojo** y también se imprime en la comanda.

### Nombre del comensal

Cada platillo lleva un nombre ("Luis", "la señora del fondo"). El mesero
entrega por nombre, no preguntando "¿quién pidió los tacos?".

---

## 4. Reloj checador (control del admin)

- El QR rota cada minuto: una foto del QR deja de servir.
- El QR prueba **presencia** (el dispositivo está en la sucursal); el PIN prueba
  **identidad**.
- En *Ajustes → Reloj checador* el admin ve **quién está en turno**, cuánto
  lleva y puede **cerrar un turno huérfano** (celular descargado, mesero que se
  fue sin checar).
- Historial de las últimas checadas con horas trabajadas.

---

## 5. Cómo queda enlazado con todo

```
Comandero (mesero)                  Caja (POS)              Cocina / Barra (KDS)
──────────────────                  ──────────              ───────────────────
abre cuenta de mesa   ───────────►  misma orden
agrega platillos                    │                       recibe la comanda
alergias / nombre / extras          │                       por estación, en vivo
envía la tanda                      │
                                    └── cobra y cierra
```

- **Un solo ticket**: comandero y caja editan la misma orden.
- **Cola por estación**: cada platillo va a la estación que le toca.
- **Tiempo real**: la comanda aparece sin recargar (outbox + Centrifugo).
- **Impresión**: si la estación tiene impresora, sale el ticket de cocina.

---

## 6. Límites conocidos (para no prometer de más)

| Tema | Realidad |
|---|---|
| Modo avión / silenciar notificaciones | Un PWA **no puede**. Se detecta datos móviles y se avisa; el bloqueo duro se hace con **Guided Access** (iOS) o **Screen Pinning** (Android) o MDM. |
| Sin internet | Todavía no hay cola local: si no hay red, no se envía. Es la siguiente fase. |
| Pedir la cuenta desde el comandero | Aún no; se hace en caja. Está en la lista. |
| División de cuenta | Solo en caja. |

---

## 7. Problemas frecuentes

| Síntoma | Causa / solución |
|---|---|
| "Este dispositivo no está vinculado" | Falta enlazarlo en *Ajustes → Terminales* o abrir el enlace de vinculación. |
| "El código de la sucursal venció" | El QR rotó. Escanear de nuevo. |
| "PIN incorrecto" | Tras varios intentos se bloquea un minuto (protección). |
| La comanda no aparece en cocina | La estación del platillo no coincide con la pantalla, o cocina está viendo otra estación. |
| El mesero no puede cobrar | Es correcto: el comandero no cobra. |
