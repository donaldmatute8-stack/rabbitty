# ADR-015 · Captura de nichos no cubiertos (Bunzy + Resend)

**Fecha:** 2026-11-04 · **Estado:** implementado (aditivo, sin deploy) · **Deploy pendiente**
**Contexto:** producción. Regla: **solo cambios aditivos**; nada del POS ni del alta existente se altera.

---

## 1 · Problema

El onboarding solo ofrecía nichos que el POS ya opera (restaurante, cafetería,
bar, panadería, pizzería, taquería, barbería, gym, retail, servicios) más un
`other` genérico. Un negocio de otro giro (veterinaria, lavandería, hotel…)
quedaba encajonado en `other` o abandonaba el alta:

- perdíamos el lead sin saber qué giro era;
- no teníamos cola real de producto;
- Bunzy no podía explicar nada de ese nicho.

---

## 2 · Decisión

1. **El catálogo guarda contexto de TODOS los giros conocidos**, no solo de los
   activos. `niches.isActive` decide si se ofrece en el onboarding; los inactivos
   existen para que Bunzy y el formulario tengan contexto (`description`,
   `capabilities`).
2. **`other` deja de ofrecerse.** En su lugar, el Paso 0 tiene una entrada
   explícita: *"No veo mi tipo de negocio"*.
3. Esa entrada abre una **captura real** con **correo y WhatsApp obligatorios**
   (celular MX, 10 dígitos). Sin ambos no se registra nada.
4. La solicitud se guarda en `niche_requests` (cola de producto) y dispara un
   **correo de bienvenida inmediato** con Resend, personalizado por giro: qué
   estamos preparando para ese nicho y la promesa de avisar por correo y
   WhatsApp. **Sin fechas inventadas.**
5. **Bunzy es determinista en el onboarding** (copy local por nicho/paso, cero
   llamada a modelo) y en el chat recibe el catálogo completo en su prompt.

---

## 3 · Flujo

```
Paso 0 · NichePicker
   │  elige un nicho activo → sigue el alta normal
   │
   └─ "No veo mi tipo de negocio"
         │  Bunzy: "No hemos llegado a tu nicho…"
         ▼
      Formulario (giro*, correo*, WhatsApp*, nombre y negocio opcionales)
         │  POST /api/niches/request
         ▼
      niche_requests (PENDING) + correo Resend inmediato
         │
         ▼
      Confirmación en pantalla (mismo mensaje que el correo)
```

---

## 4 · Seguridad y multitenant

| Riesgo | Mitigación |
|---|---|
Filtrar datos de otro tenant | El endpoint **no lee** datos de negocios/usuarios: solo escribe la solicitud. Bunzy en onboarding recibe únicamente `niche`, `step` y el nombre que escribió el usuario |
Inventar condiciones | Copy determinista; el prompt prohíbe inventar montos/fechas |
Abuso del endpoint público | Honeypot + rate limit por IP (5 / 10 min, mejor esfuerzo en serverless) + límite de body (8 KB) |
Spam a Resend/usuarios | Dedupe de 24 h por `email + giro`; no se reenvía correo |
Inyección en el HTML del correo | Todo texto del usuario se recorta y se escapa (`escapeHtml`) antes de renderizar |
Enumeración de correos | La respuesta de dedupe no devuelve datos del registro previo |
Datos sensibles | Solo se guarda email y celular normalizado (E.164); no se piden documentos ni secretos |

---

## 5 · Modelo

`niche_requests`

| Campo | Nota |
|---|---|
`id` | uuid |
`niche` | id del catálogo si se reconoció (puede ser inactivo) o NULL |
`nicheLabel` | cómo lo nombró la persona / nombre oficial si existe |
`businessName`, `contactName` | opcionales |
`email`, `phone` | **obligatorios**; `phone` E.164 sin `+` (ej. `523221234567`) |
`message` | opcional, 500 chars |
`source` | `onboarding_paso_0`, etc. |
`status` | `PENDING` → `CONTACTED` / `LAUNCHED` / `DISCARDED` |
`createdAt`, `notifiedAt`, `emailId` | trazabilidad del correo |

Migración: `0041_niche_requests.sql` (aditiva; también añade `niches.description`
y siembra 10 nichos inactivos con contexto).

---

## 6 · Activar un nicho nuevo

1. `UPDATE niches SET "isActive" = true WHERE id = 'veterinary';`
2. Añadir sus módulos en el POS según `capabilities`.
3. Marcar las solicitudes correspondientes como `LAUNCHED` y contactarlas.

No hace falta tocar el onboarding ni el formulario: el catálogo es datos.

---

## 7 · Pendientes

- Re-ingesta de la KB de Bunzy (RAG) **después** del deploy.
- Panel interno para ver `niche_requests` (hoy: consulta SQL).
- Email interno de aviso al equipo cuando entra una solicitud (opcional).
- `POS_TERMINAL_SESSIONS` sigue apagado: Fase 2 del POS no se toca aquí.
