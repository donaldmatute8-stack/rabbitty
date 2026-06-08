# 🐰 Rabbitty — Propiedades del Sistema / Domain Model

**Última actualización:** 2026-05-24
**Estado:** Documento vivo — actualizar según evolución del sistema

---

## 📋 Índice de Entidades

1. [User](#user)
2. [Business](#business)
3. [Transaction](#transaction)
4. [Referral](#referral)
5. [FeedPost](#feedpost)
6. [BusinessCategory](#businesscategory)
7. [ReferralTierConfig](#referraltierconfig)

---

## 👤 User

**Tabla:** `users`  
**Descripción:** Usuario de Rabbitty (Member o Business Owner)

| Propiedad | Tipo | Nullable | Default | Descripción |
|-----------|------|----------|---------|-------------|
| `id` | Integer (PK) | No | auto | Identificador único |
| `telegram_id` | BigInteger | No | — | ID de Telegram |
| `username` | String(50) | Sí | null | Username de Telegram |
| `first_name` | String(100) | No | — | Nombre |
| `last_name` | String(100) | Sí | null | Apellido |
| `photo_url` | String(500) | Sí | null | Foto de perfil |
| `wallet_address` | String(42) | Sí | null | Dirección wallet blockchain |
| `referral_code` | String(20) | No | auto | Código único de referido |
| `referred_by` | Integer | Sí | null | ID del usuario que lo invitó |
| `total_bunz_earned` | BigInteger | No | 0 | Total bunz ganados |
| `total_bunz_spent` | BigInteger | No | 0 | Total bunz gastados |
| `total_referrals` | Integer | No | 0 | Total referidos |
| `is_active` | Boolean | No | true | Cuenta activa |
| `is_premium` | Boolean | No | false | Usuario premium |
| `created_at` | DateTime | No | now | Fecha de registro |
| `updated_at` | DateTime | Sí | null | Última actualización |
| `last_login` | DateTime | Sí | null | Último inicio de sesión |

**Relaciones:**
- `businesses` → Business[] (1:N, como owner)
- `transactions` → Transaction[] (1:N)
- `referrals_given` → Referral[] (1:N, como referrer)
- `referral_received` → Referral (1:1, como referred)
- `feed_posts` → FeedPost[] (1:N)

**Reglas de negocio:**
- `wallet_address` debe ser único (si existe)
- `referral_code` generado automáticamente
- `total_bunz_earned` ≥ `total_bunz_spent` (balance no negativo)

---

## 🏪 Business

**Tabla:** `businesses`  
**Descripción:** Negocio afiliado a Rabbitty

| Propiedad | Tipo | Nullable | Default | Descripción |
|-----------|------|----------|---------|-------------|
| `id` | Integer (PK) | No | auto | Identificador único |
| `owner_id` | Integer (FK) | No | — | ID del dueño (User) |
| `name` | String(200) | No | — | Nombre del negocio |
| `type` | String(50) | No | — | Tipo (Café, Restaurante, etc) |
| `description` | Text | Sí | null | Descripción |
| `logo_url` | String(500) | Sí | null | Logo del negocio |
| `address` | String(500) | Sí | null | Dirección física |
| `latitude` | Numeric(10,8) | Sí | null | Latitud GPS |
| `longitude` | Numeric(11,8) | Sí | null | Longitud GPS |
| `phone` | String(20) | Sí | null | Teléfono de contacto |
| `email` | String(100) | Sí | null | Email de contacto |
| `website` | String(200) | Sí | null | Sitio web |
| `credit_limit` | BigInteger | No | 100000 | Límite de crédito en bunz |
| `credit_used` | BigInteger | No | 0 | Crédito consumido |
| `reward_rate` | Integer | No | 20 | % de recompensa por compra |
| `total_transactions` | Integer | No | 0 | Total transacciones |
| `total_customers` | Integer | No | 0 | Clientes únicos |
| `total_bunz_given` | BigInteger | No | 0 | Bunz otorgados |
| `rating` | Float | No | 5.0 | Calificación promedio |
| `is_active` | Boolean | No | true | Negocio activo |
| `is_verified` | Boolean | No | false | Negocio verificado |
| `created_at` | DateTime | No | now | Fecha de registro |
| `updated_at` | DateTime | Sí | null | Última actualización |

**Relaciones:**
- `owner` → User (N:1)
- `transactions` → Transaction[] (1:N)
- `feed_posts` → FeedPost[] (1:N)

**Reglas de negocio:**
- `credit_used` ≤ `credit_limit`
- `reward_rate` entre 10 y 200 (10% - 200%)
- `rating` entre 0 y 5
- Solo el `owner` puede modificar `reward_rate`

---

## 💰 Transaction

**Tabla:** `transactions`  
**Descripción:** Transacción de bunz (ganados o gastados)

| Propiedad | Tipo | Nullable | Default | Descripción |
|-----------|------|----------|---------|-------------|
| `id` | Integer (PK) | No | auto | Identificador único |
| `user_id` | Integer (FK) | No | — | Usuario que transacciona |
| `business_id` | Integer (FK) | Sí | null | Negocio involucrado |
| `type` | Enum | No | — | earned / spent / referral / bonus |
| `status` | Enum | No | completed | pending / completed / failed / cancelled |
| `amount` | BigInteger | No | — | Monto en bunz |
| `purchase_amount` | Numeric(20,2) | Sí | null | Monto de compra en fiat |
| `reward_amount` | BigInteger | Sí | null | Bunz ganados (si aplica) |
| `protocol_fee` | BigInteger | No | 0 | Fee del protocolo (3%) |
| `affiliate_fee` | BigInteger | No | 0 | Fee de afiliado (6%) |
| `receipt_hash` | String(64) | No | — | Hash SHA256 del recibo |
| `qr_data` | String(500) | Sí | null | Datos del QR escaneado |
| `description` | String(200) | Sí | null | Descripción de la transacción |
| `category` | String(50) | Sí | null | Categoría (Comida, Fitness, etc) |
| `tx_hash` | String(66) | Sí | null | Hash de la tx blockchain |
| `block_number` | Integer | Sí | null | Número de bloque |
| `created_at` | DateTime | No | now | Fecha de creación |
| `completed_at` | DateTime | Sí | null | Fecha de completado |

**Relaciones:**
- `user` → User (N:1)
- `business` → Business (N:1, nullable)

**Reglas de negocio:**
- `amount` > 0
- `protocol_fee` = `amount` × 0.03 (solo en gastos)
- `affiliate_fee` = `amount` × 0.06 (solo en gastos)
- `receipt_hash` debe ser único
- Para tipo `earned`: `reward_amount` = `purchase_amount` × (`business.reward_rate` / 100)

---

## 🤝 Referral

**Tabla:** `referrals`  
**Descripción:** Relación de referido entre usuarios

| Propiedad | Tipo | Nullable | Default | Descripción |
|-----------|------|----------|---------|-------------|
| `id` | Integer (PK) | No | auto | Identificador único |
| `referrer_id` | Integer (FK) | No | — | Usuario que invita |
| `referred_id` | Integer (FK) | No | — | Usuario invitado |
| `referral_code` | String(20) | No | — | Código usado |
| `bonus_amount` | BigInteger | No | 50 | Bunz de bonus |
| `is_claimed` | Boolean | No | false | Bonus reclamado |
| `claimed_at` | DateTime | Sí | null | Fecha de reclamo |
| `tier` | Enum | No | bronze | bronce / silver / gold / platinum |
| `created_at` | DateTime | No | now | Fecha de creación |
| `completed_at` | DateTime | Sí | null | Fecha de completado |

**Relaciones:**
- `referrer` → User (N:1)
- `referred` → User (N:1)

**Reglas de negocio:**
- Un usuario no puede referirse a sí mismo (`referrer_id` ≠ `referred_id`)
- Un usuario solo puede ser referido una vez
- `bonus_amount` depende del tier del referrer:
  - Bronze: 50 bunz
  - Silver: 75 bunz
  - Gold: 100 bunz
  - Platinum: 200 bunz

---

## 📱 FeedPost

**Tabla:** `feed_posts`  
**Descripción:** Post en el feed social

| Propiedad | Tipo | Nullable | Default | Descripción |
|-----------|------|----------|---------|-------------|
| `id` | Integer (PK) | No | auto | Identificador único |
| `user_id` | Integer (FK) | No | — | Usuario que publica |
| `content` | Text | Sí | null | Texto del post |
| `image_url` | String(500) | Sí | null | Imagen del post |
| `label` | String(100) | Sí | null | Etiqueta/descripción |
| `business_id` | Integer (FK) | Sí | null | Negocio relacionado |
| `business_name` | String(200) | Sí | null | Nombre del negocio |
| `bunz_amount` | BigInteger | No | 0 | Bunz ganados en esta experiencia |
| `likes_count` | Integer | No | 0 | Número de likes |
| `comments_count` | Integer | No | 0 | Número de comentarios |
| `shares_count` | Integer | No | 0 | Número de shares |
| `created_at` | DateTime | No | now | Fecha de publicación |

**Relaciones:**
- `user` → User (N:1)
- `business` → Business (N:1, nullable)
- `likes` → FeedLike[] (1:N)
- `comments` → FeedComment[] (1:N)

---

## 🏷️ BusinessCategory

**Tabla:** `business_categories`  
**Descripción:** Categorías de negocios predefinidas

| Propiedad | Tipo | Nullable | Default | Descripción |
|-----------|------|----------|---------|-------------|
| `id` | Integer (PK) | No | auto | Identificador único |
| `name` | String(50) | No | — | Nombre de la categoría |
| `icon` | String(50) | Sí | null | Emoji/icono representativo |
| `description` | String(200) | Sí | null | Descripción |

**Valores iniciales:**
| name | icon |
|------|------|
| Cafés | ☕ |
| Restaurantes | 🍕 |
| Gimnasios | 💪 |
| Retail | 🛍️ |
| Belleza | 💅 |
| Tecnología | 💻 |

---

## 🎖️ ReferralTierConfig

**Tabla:** `referral_tier_configs`  
**Descripción:** Configuración de niveles de referido

| Propiedad | Tipo | Nullable | Default | Descripción |
|-----------|------|----------|---------|-------------|
| `id` | Integer (PK) | No | auto | Identificador único |
| `tier` | Enum | No | — | bronze / silver / gold / platinum |
| `min_referrals` | Integer | No | — | Referidos mínimos para alcanzar |
| `bonus_amount` | BigInteger | No | — | Bunz de bonus por referido |
| `description` | String(200) | Sí | null | Descripción del nivel |

**Valores iniciales:**
| tier | min_referrals | bonus_amount |
|------|---------------|--------------|
| bronze | 0 | 50 |
| silver | 5 | 75 |
| gold | 15 | 100 |
| platinum | 50 | 200 |

---

## 📊 Resumen de Relaciones

```
User 1 ──────< N Business (owner)
User 1 ──────< N Transaction
User 1 ──────< N Referral (referrer)
User 1 ──────< 1 Referral (referred) [opcional]
User 1 ──────< N FeedPost

Business 1 ──< N Transaction
Business 1 ──< N FeedPost
Business N ──1 BusinessCategory [opcional]

FeedPost 1 ──< N FeedLike
FeedPost 1 ──< N FeedComment
```

---

## 🔄 Flujos de Datos

### Registro de usuario
```
Telegram WebApp → Auth API → JWT Token → User creado → Referral code generado
```

### Escaneo QR (ganar bunz)
```
User escanea QR → Validar negocio → Calcular reward → Crear Transaction (earned)
→ Actualizar Business.credit_used → Actualizar User.total_bunz_earned
→ Generar FeedPost → Notificar
```

### Pago con bunz (gastar bunz)
```
User paga → Validar saldo → Calcular fees → Crear Transaction (spent)
→ Actualizar User.total_bunz_spent → Transferir bunz blockchain
→ Generar recibo
```

### Referido
```
Nuevo usuario → Usa referral_code → Crear Referral → Calcular tier
→ Asignar bonus → Notificar referrer
```

---

## 📈 Escalabilidad Consideraciones

| Entidad | Volumen esperado | Índices necesarios |
|---------|-----------------|-------------------|
| User | 100K+ | telegram_id, wallet_address, referral_code |
| Business | 10K+ | owner_id, type, is_active |
| Transaction | 1M+ | user_id, business_id, type, created_at |
| FeedPost | 500K+ | user_id, business_id, created_at |
| Referral | 200K+ | referrer_id, referred_id |

**Particionamiento recomendado:**
- `transactions` por `created_at` (mensual)
- `feed_posts` por `created_at` (mensual)

---

*Documento generado por Sofía para el equipo Rabbitty*