# Matriz de proveedores, encargados y DPA

> **Borrador de trabajo.** Las regiones, roles y estado contractual deben
> confirmarse con cada proveedor. No constituye opinión legal.

**Criterio:** todo proveedor que trate datos personales por cuenta de RABBITTY
requiere instrucciones documentadas (DPA o cláusulas equivalentes), medidas de
seguridad, subencargados identificados y reglas de transferencia.

---

## 1. Matriz

| Proveedor | Servicio | Datos que trata | Rol | Región | DPA / contrato | Estado | Acción |
|---|---|---|---|---|---|---|---|
| **Railway** | Hosting de admin, app, landing, audit, bot | Todo lo que pasa por la app; logs | Encargado | `iad` (EE. UU.) confirmado en audit; confirmar resto | Términos + DPA | Por firmar/archivar | Solicitar DPA y regiones |
| **Neon** | PostgreSQL | Toda la base de datos | Encargado | Por confirmar (probable US) | DPA | Por firmar/archivar | Confirmar región y respaldos |
| **AWS S3** | Almacenamiento de medios/adjuntos | Imágenes, archivos, comprobantes | Encargado | Por confirmar (bucket) | DPA AWS | Por firmar/archivar | Confirmar región, cifrado, lifecycle |
| **Stripe** | Pagos, suscripciones, Connect | Datos de pago, identidad fiscal, montos | Encargado/Responsable independiente en su KYC | Global | DPA + SCC | Por firmar/archivar | Confirmar rol por flujo |
| **Resend** | Correo transaccional | Correo, nombre, contenido de avisos | Encargado | Por confirmar | DPA | Por firmar/archivar | Confirmar retención de logs |
| **Telegram** | Canal de la miniapp y mensajería | Telegram ID, mensajes, perfil | Responsable independiente / encargado según flujo | Global | Términos | Revisar | Aclarar rol y límites |
| **SignalWire** | SMS/OTP | Teléfono, código, metadatos | Encargado | Por confirmar | DPA | Por firmar/archivar | Confirmar retención de OTP |
| **OpenAI** | Modelo de lenguaje / embeddings | Consultas y contenido enviado al modelo | Encargado | EE. UU. | DPA/API terms | Por firmar/archivar | Confirmar no entrenamiento y retención |
| **Apple APNs** | Push iOS / Live Activities | Token de dispositivo, contenido del aviso | Encargado | Global | Términos | Revisar | Documentar contenido mínimo |
| **Uber Direct** | Entregas | Dirección, teléfono, nombre, pedido | Encargado/Responsable independiente | Global | DPA | Por firmar/archivar | Confirmar datos compartidos |
| **Cloudflare** | DNS/CDN (si aplica) | IP, metadatos de tráfico | Encargado | Global | DPA | Revisar | Confirmar si está en el flujo |

> **Nota:** si un proveedor no trata datos personales (por ejemplo, solo DNS sin
> logs), se documenta la exclusión y el motivo.

---

## 2. Preguntas obligatorias por proveedor

1. ¿Cuál es la región primaria y de respaldo?
2. ¿Hay subencargados? ¿Cuáles y dónde?
3. ¿Se transfieren datos fuera de México? ¿Con qué mecanismo?
4. ¿Cuánto tiempo conserva logs y respaldos?
5. ¿Cómo notifica incidentes y en qué plazo?
6. ¿Cómo atiende solicitudes ARCO o de titulares?
7. ¿Cómo devuelve o suprime datos al terminar?
8. ¿Permite auditoría o evidencia de certificaciones?
9. ¿Usa datos para entrenar modelos o fines propios?
10. ¿Qué cifrado aplica en tránsito y en reposo?

---

## 3. Datos que NO deben enviarse a proveedores sin base

- Contenido de chat E2E en claro (el servidor no debe poder leerlo).
- Plantillas biométricas (no existen en RABBITTY).
- Datos de salud o categorías sensibles no previstas.
- Documentos de identidad completos a herramientas de IA.
- Datos de sandbox mezclados con producción.

---

## 4. Evidencia a archivar

- DPA firmado o términos aceptados con fecha y versión.
- Lista de subencargados y regiones.
- Certificaciones o reportes de seguridad disponibles.
- Registro de la evaluación de riesgo.
- Correo de confirmación de retención y no entrenamiento (IA).
- Fecha de última revisión.

---

## 5. Responsable interno

| Tarea | Responsable | Frecuencia |
|---|---|---|
| Enviar/renovar DPA | Legal/privacidad | Anual o al cambiar proveedor |
| Revisar subencargados y regiones | Privacidad + técnico | Semestral |
| Revisar retención y borrado | Privacidad + técnico | Anual |
| Actualizar esta matriz | Privacidad | Cada cambio |

---

## 6. Criterio de cierre

La matriz se considera cerrada cuando:

- Cada proveedor con datos personales tiene DPA o cláusulas equivalentes.
- Región y subencargados están confirmados.
- Existe evidencia archivada.
- Los flujos del RAT coinciden con los proveedores listados.
