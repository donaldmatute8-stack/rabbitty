# 🚀 Rabbitty — 6 Puntos Críticos de Implementación

## 📋 Checklist de Desarrollo

### ✅ PUNTO 1: Frontend para Rabbitters (App Móvil/Web)
**Funcionalidades:**
- [ ] Escaneo QR de negocios (cámara integrada)
- [ ] Ver balance de bunz en tiempo real
- [ ] Historial de transacciones (ganados/gastados)
- [ ] Gastar bunz (escanear para pagar)
- [ ] Ver mapa de negocios afiliados cercanos
- [ ] Perfil de usuario (Rabbiter identity)
- [ ] Compartir en social feed (brag about bunz)

**Tech Stack:**
- Flutter (iOS/Android) o React Native
- Web3.js/ethers.js para integración con contratos
- QR scanner nativo

**Tiempo estimado:** 3-4 semanas

---

### ✅ PUNTO 2: Business Panel (Dashboard para Negocios)
**Funcionalidades (Fase 2 ✅ Completada):**
- [x] Configurar % de recompensa dinámico (10%-100%)
- [x] Seleccionar paquetes de "Crédito de Minting" ($10k, $20k, $50k) 
- [x] Crear negocio vinculándolo a la Smart Wallet del afiliado
- [x] Analytics y UI Responsive (Sidebar Desktop, BottomNav Mobile)
- [ ] Configurar ventanas de tiempo (días/horas) para otorgar recompensas (Dynamic Reward Windows)
- [ ] Escanear QR de Rabbitters para procesar pagos (Pendiente Fase 3)
- [ ] Historial de recompensas dadas (Pendiente Fase 3)

**Tech Stack:**
- React.js / Next.js
- Charts.js para gráficas
- Admin template (Material UI o similar)

**Tiempo estimado:** 2-3 semanas

---

### ✅ PUNTO 3: Oracle/Backend (Verificación Bidireccional)
**Funcionalidades:**
- [ ] API REST para validación de transacciones
- [ ] Verificación bidireccional: Negocio ↔ Usuario
- [ ] Validación de reglas de tiempo (Días/Horas activas) para recibir/otorgar BUNZ
- [ ] Generar QR único por transacción (nonce + timestamp)
- [ ] Anti-replay protection (hash único por consumo)
- [ ] Rate limiting (max 100 transacciones/hora por negocio)
- [ ] Webhook a contrato bunz.sol para mintReward
- [ ] Logs de auditoría completos

**Tech Stack:**
- Node.js + Express o Python + FastAPI
- PostgreSQL para logs
- Redis para rate limiting
- Web3.py/Web3.js

**Tiempo estimado:** 2-3 semanas

---

### ✅ PUNTO 4: Treasury Engine (Promociones e Inventario)
**Funcionalidades:**
- [ ] Acumulación automática de fees (6% + 3%)
- [ ] Crear ofertas especiales (ej: "50% off en café XYZ")
- [ ] Inventario de promociones disponibles
- [ ] Distribución de incentivos a negocios
- [ ] Dashboard de salud económica del ecosistema
- [ ] Alertas cuando fees superen umbral

**Smart Contract:** Treasury.sol
**Tech Stack:** Python + Web3.js

**Tiempo estimado:** 1-2 semanas

---

### ✅ PUNTO 5: Referral System ("Give to Get")
**Funcionalidades:**
- [ ] Código único de referido por Rabbiter
- [ ] Bonus por invitar nuevos usuarios (ej: 50 bunz)
- [ ] Bonus por invitar nuevos negocios (ej: 100 bunz)
- [ ] Tracking de red de referidos (niveles)
- [ ] Visualización de "árbol de referidos"

**Smart Contract:** Modificación a bunz.sol
**Tiempo estimado:** 1 semana

---

### ✅ PUNTO 6: Social Feed (Compartir Experiencias)
**Funcionalidades:**
- [ ] Feed de actividad de amigos
- [ ] Postear compras con recompensas ganadas
- [ ] "Brag about your bunz" (mostrar balance)
- [ ] Like/comment en posts de compras
- [ ] Recompensas por engagement (likes recibidos)
- [ ] Fotos de experiencias en negocios
- [ ] Check-ins con recompensa extra

**Tech Stack:**
- MongoDB para posts
- AWS S3 para imágenes
- Real-time updates (WebSockets)

**Tiempo estimado:** 2-3 semanas

---

### ✅ PUNTO 7: Telegram Chat Messaging (Pendiente)
**Funcionalidades:**
- [ ] Integrar chat estilo Telegram en la pestaña de mensajes.
- [ ] Chats P2P (Rabbitters) y B2C (Afiliados-Clientes).
- [ ] Compartir ubicaciones y promociones por mensaje.
- [ ] Dejar de usar "mock data".

**Tech Stack:**
- WebSockets o Firebase Realtime DB
- UI similar a Telegram nativo

**Tiempo estimado:** 2 semanas

---

## 📊 Timeline Total

| Fase | Puntos | Semanas | Prioridad |
|------|--------|---------|-----------|
| **Fase 1: Core** | 3 (Oracle + Business + Rabbiter) | 6-7 semanas | 🔥 CRÍTICO |
| **Fase 2: Growth** | 2 (Referral + Social) | 3-4 semanas | 📈 ALTO |
| **Fase 3: Scale** | 1 (Treasury) | 1-2 semanas | 💰 MEDIUM |
| **TOTAL** | 6 puntos | **10-13 semanas** | |

---

## 💡 Sugerencia de Marco

Empezar con **Fase 1** inmediatamente:
1. Backend/Oracle (base de todo)
2. Business Panel (para atraer negocios)
3. Rabbiter App (para usuarios)

¿Procedemos con la Fase 1? 🚀
