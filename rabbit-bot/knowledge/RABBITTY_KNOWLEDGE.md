# RABBITTY - Conocimiento del Ecosistema

## ¿Qué es Rabbitty?
Plataforma de lealtad y recompensas que conecta consumidores (Rabbitters) con negocios locales (Afiliados) mediante el token **bunz**. Los usuarios ganan bunz al comprar en afiliados y los gastan en el mismo ecosistema.

## Mini App / Bot de acceso
La experiencia principal de Rabbitty es via **Telegram Mini App** en el bot **@Rabbittyme_bot**.
- Los usuarios abren la Mini App desde Telegram para registrarse, escanear QRs, ver su perfil y saldo de bunz, y gestionar su cuenta.
- @Rabbittyme_bot es el punto de entrada — NO es una app de App Store/Play Store.
- Rabbitty Bot (@rabbittybot_bot) es el asistente de soporte e inteligencia artificial.

## Roles en Rabbitty

### 1. Usuario Regular (USER)
- Consumidor que escanea QRs, gana y gasta bunz
- Gana 20%+ de recompensa en compras en afiliados
- Sin compromiso, solo usa la app

### 2. Rabbitter (Nodo / Gestor de Zona)
- Power-user / gestor de zona geográfica
- Recluta afiliados y gana comisiones por su actividad
- Tiene acceso a la comunidad exclusiva de Rabbitters
- Recibe un "Kit de Nodo" al activarse

**Niveles de Rabbitter:**
- **Bronze** (Socio Local): Hasta 5 afiliados, comisiones básicas
- **Silver** (Gestor de Zona): 10+ afiliados reclutados, bonos trimestrales
- **Gold** (Capitán Regional): Red de otros Rabbitters, porcentaje residual de actividad

**Cómo ganan los Rabbitters:**
- Comisión recurrente por cada afiliado reclutado
- Ingreso residual por actividad de su zona (Gold+)
- Bonos por activar zonas difíciles
- Challenges semanales con premios extra

**Cómo se convierte uno:**
- Después de 3 usos en la red, el sistema notifica: "Tienes el perfil para ser el Nodo de tu zona"
- Completa registro → Recibe kit digital → Acceso a comunidad Rabbitters

### 3. Afiliado (Affiliate / Business)
- Negocio local que ofrece recompensas bunz a clientes
- Compra paquetes de crédito de minting
- Recibe herramientas: dashboard, analytics, POS, marketing automation

**Paquetes de Crédito:**
| Paquete | Crédito | Ideal para |
|---------|---------|-----------|
| Starter | $10,000 MXN | Cafés, pequeños negocios |
| Growth | $20,000 MXN | Restaurantes medianos |
| Pro | $50,000 MXN | Cadenas, gimnasios |
| Enterprise | $100,000 MXN | Grandes retailers |

**Categorías de negocio:**
Food, Restaurantes, Cafés, Salud, Gimnasios, Electrónicos, Retail, Servicios, Hoteles, Franquicias

**Comisiones en rewards (cuando un Rabbitter gana bunz):**
- Protocol Fee: 3% (Rabbitty Treasury)
- Affiliate Fee: 6% (vuelve al pool del negocio)
- Burn: 1-2% (deflacionario)

### 4. Admin
- Administrador de la plataforma Rabbitty
- Gestiona negocios, usuarios y configuración

## Tokens y Finanzas

**bunz token:**
- Contrato: `0x8d0CC6dcD796e9B14bd25BA2A21291aa3Af39fcB` (Sepolia)
- Token de recompensa del ecosistema
- Siempre en minúsculas: "bunz", nunca "$BZ" ni "BNZ"
- Se gana comprando en afiliados, se gasta en el ecosistema

## Grupos de Telegram (Rabbitty Hub)

El hub principal es `@rabbittyhub` con topics por rol:

| Topic ID | Nombre | Acceso |
|----------|--------|--------|
| 1 | General | Público - todos los miembros |
| 3 | Rabbitters Zone | Solo Rabbitters (Nodos) |
| 4 | Affiliates Circle | Solo Afiliados (Negocios) |
| 5 | Soporte Técnico | Usuarios con issues |
| 10 | Soporte Demos | Demos y onboarding |

Rabbit Bot gestiona el acceso: cuando un usuario obtiene un rol, se le agrega al grupo correspondiente.

## Onboarding Flow
1. Usuario llega via QR, link o invitación
2. Bot de Telegram guía la bienvenida (intereses, zona, etc.)
3. Elige rol: Usuario regular o Rabbitter
4. Si es negocio: flujo de registro de afiliado con documentación
5. Recibe acceso al grupo correspondiente según su rol
