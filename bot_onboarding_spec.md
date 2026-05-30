# 🤖 Rabbitty Onboarding Bot Architecture (Hefesto)

## 1. Flujo de Usuario (UX Flow)
El bot actúa como el portero del Hub. Su objetivo es clasificar y entregar el kit correcto sin intervención humana.

### A. Entrada y Clasificación
1. `/start` $\rightarrow$ Mensaje de Bienvenida (High Status).
2. **Menú de Selección de Rol:**
   - 🐰 **Quiero ser Rabbitter** (Gestor de Zona)
   - 🏪 **Quiero ser Afiliado** (Dueño de Negocio)
   - 🛠️ **Soporte Técnico/Ventas**

### B. Rutas de Entrega (Kits de Supervivencia)
- **Senda Rabbitter:**
  - Envío de `Kit de Nodo` (PDF/Mensajes).
  - Explicación de Niveles (Bronce $\rightarrow$ Plata $\rightarrow$ Oro).
  - Enlace al tópico de Rabbitters en la comunidad.
- **Senda Afiliado:**
  - Formulario de registro de negocio.
  - Guía de implementación de QR y Materiales.
  - Enlace al tópico de Afiliados.
- **Senda Soporte:**
  - Menú de opciones (Ventas / Técnico).
  - Redirección al tópico de Soporte o Ventas.

---

## 2. Implementación Técnica (Staging)

### A. Stack Tecnológico
- **Lenguaje:** Python 3.11+
- **Librería:** `python-telegram-bot` o `aiogram`.
- **Base de Datos (Tracking):** SQLite / PostgreSQL para mapear `user_id` $\rightarrow$ `rol` $\rightarrow$ `zona`.

### B. Estructura de Archivos (Propuesta)
```text
/Users/bullslab/.openclaw/agents/sofia-workspace/projects/Rabbitty/bot/
├── main.py             # Entry point y polling
├── handlers/
│   ├── start.py        # Manejo de /start y bienvenida
│   ├── onboarding.py   # Lógica de clasificación de roles
│   └── support.py      # Gestión de tickets y redirecciones
├── assets/
│   ├── texts/          # Copys de los kits (Markdown)
│   └── docs/           # PDF y Guías
└── utils/
    └── db.py           # Persistencia de usuarios y roles
```

---

## 3. Automatizaciones de "Sincronización"
- **Alerta de Nuevo Nodo:** Cuando un usuario completa el onboarding de Rabbitter, el bot envía una notificación al **War Room de Marketing**: *"🚀 Nuevo Nodo detectado en [Zona]. Activando seguimiento."*
- **Validación de Afiliado:** Al recibir los datos del negocio, el bot notifica al tópico de **Ventas** para validación manual antes de otorgar el rol de Afiliado.

---

## 4. Estado de Entrega
- [x] Diseño de arquitectura y flujos.
- [x] Definición de roles y kits.
- [ ] Desarrollo de código (Modo Staging).
- [ ] Pruebas de flujo de usuario.
- [ ] Despliegue final y activación de campaña.

**Estado:** `PREPARADO Y LISTO` (En fase de codificación final).
