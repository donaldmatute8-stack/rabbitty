# Pendientes de CFDI (seguimiento)

> **No cerrar la fase comercial de facturación hasta completar P-01 y P-02.**
> Hoy la plataforma **no timbra**: rechaza con un mensaje claro cuando el
> negocio no ha conectado su PAC. Eso es intencional.

Estado al 12-nov-2026: contrato `PacProvider` + adaptador Facturama + UI en el
admin + descarga de XML/PDF, todo desplegado. Falta lo que depende de una cuenta
real.

---

## P-01 · Credenciales sandbox de Facturama — **bloqueante**

**Qué falta:** usuario y contraseña de API de una cuenta Facturama (sandbox).

**Por qué:** sin ellas no se puede ejecutar el caso feliz (timbrado real) ni
validar el mapeo de errores del SAT contra el proveedor.

**Cómo se desbloquea:**

1. Crear cuenta gratuita en <https://facturama.mx>.
2. Activar el módulo API (sandbox no cuesta).
3. Cargar el CSD de prueba del SAT (`EKU9003173C9`).
4. Copiar usuario/contraseña de API.
5. En el admin: *Facturación CFDI → Conectar un PAC → ambiente Pruebas*,
   pegar y pulsar **Probar conexión**.

**Dueño:** Marco · **Cuándo:** siguiente iteración de facturación.

---

## P-02 · Validación de timbrado en sandbox

Casos a correr con P-01 listo:

| # | Caso | Resultado esperado |
|---|---|---|
| 1 | Orden normal, receptor G03 | `INVOICED` + UUID + XML/PDF descargables |
| 2 | RFC inválido | `FAILED` con mensaje del SAT, orden **no** facturada |
| 3 | Credenciales incorrectas | error de conexión, sin fila `INVOICED` |
| 4 | Orden ya facturada | rechazo, sin duplicado |
| 5 | Cancelación motivo 02 | estado `CANCELLED` y `cfdiStatus` vuelve a `NONE` |
| 6 | Cancelación motivo 01 sin sustituto | rechazo del PAC |
| 7 | Descarga XML y PDF | archivos válidos, UUID coincide |
| 8 | Orden 100% Bunz | rechazo: no genera CFDI |

---

## P-03 · Subida del CSD del tenant

Hoy el CSD se carga **en el portal del PAC**, no en Rabbitty. Es lo correcto
para que el tenant sea dueño de su certificado, pero conviene un enlace directo
y una guía de 3 pasos en la pantalla de facturación.

---

## P-04 · Factura global

Ventas al público en general sin datos fiscales. Requiere un job diario que
agrupe las órdenes sin factura y timbre un CFDI global (dentro de las 24 h que
exige el SAT). No iniciado.

---

## P-05 · Notas de crédito y complementos de pago

Devoluciones (`Egreso`) y complemento de pago para `PPD`. No iniciado; hoy el
POS solo emite ingresos `PUE`.

---

## P-06 · Dictamen fiscal de Bunz

¿Los Bunz son moneda electrónica, descuento o promoción? Cambia el monto
facturable. Requiere contador. Documentado como D-12 en el ADR-021.

---

## P-07 · Retirar la promesa comercial

Mensajes en landing, miniapp y correos que prometen "facturación automática"
(M-01…M-04 de `CFDI-COMUNICACION.md`). Mientras no haya timbrado validado, el
texto debe decir que se habilita al conectar un PAC.

---

## P-08 · Almacenar XML/PDF

Hoy se descargan del PAC bajo demanda (`cfdi.download`). Si el PAC rota
credenciales o el tenant cancela su cuenta, se pierde el acceso. Guardar el XML
(timbrado) en almacenamiento propio es la práctica recomendada.
