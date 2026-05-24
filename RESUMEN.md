# 🐰 Rabbitty - Estructura Completa del Proyecto

## Estado Actual (2026-05-08)

### ✅ MVP COMPLETO - Listo para Testing

---

## 📁 Estructura de Archivos

```
projects/Rabbitty/
├── README.md                     # Documentación principal
├── ARQUITECTURA-TECNICA.md       # Arquitectura técnica detallada
├── PROGRESS.md                   # Log de progreso
├── package.json                  # Scripts de proyecto
├── tsconfig.json                 # Config TypeScript
├── Dockerfile                    # Container backend
├── scripts/
│   ├── test-backend.sh          # Test local backend
│   └── deploy.sh                # Deploy local completo
├── src/
│   ├── backend/                 # FastAPI Server
│   │   ├── server.py            # API principal (completo)
│   │   └── requirements.txt     # Dependencias Python
│   ├── frontend/                # React + TypeScript
│   │   ├── App.tsx              # Componente principal (completo)
│   │   ├── index.tsx            # Entry point
│   │   ├── index.css            # Estilos globales
│   │   ├── index.html           # HTML base
│   │   ├── landing.html         # Landing page (completa)
│   │   ├── telegram-webapp.d.ts # Tipos Telegram
│   │   ├── package.json         # Dependencias frontend
│   │   └── vite.config.ts       # Config Vite
│   ├── contracts/               # Smart Contracts (specs)
│   │   ├── IDENTITY-SPEC.md     # Spec NFT Identidad
│   │   └── BUNZ-SPEC.md         # Spec Token Bunz
│   └── miniapp/                 # Telegram Bot
│       └── telegram-bot.py      # Bot handlers (completo)
└── docs/                        # Documentación adicional
```

---

## 🚀 Cómo Correr Localmente

### Backend (API)

```bash
cd projects/Rabbitty/src/backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
python server.py
# API en http://localhost:3000
```

### Frontend (Mini App)

```bash
cd projects/Rabbitty/src/frontend
npm install
npm run dev
# App en http://localhost:5173
```

### Bot de Telegram

```bash
export TELEGRAM_BOT_TOKEN="tu_token_aqui"
cd projects/Rabbitty/src/miniapp
python telegram-bot.py
```

---

## 🎯 Funcionalidades Implementadas

### Backend (FastAPI)
- ✅ User management (wallet, balance)
- ✅ Identity NFT (create, view, accessories)
- ✅ Bunz earning system (20%+ base)
- ✅ Level/XP progression
- ✅ Affiliate directory (50+ sample businesses)
- ✅ Transaction history
- ✅ Referral system (5% bonus)
- ✅ REST API completo

### Frontend (React + Telegram)
- ✅ Wallet page (balance, transactions, identity)
- ✅ Affiliates page (browse by category)
- ✅ Identity page (mint NFT, equip accessories)
- ✅ Dark theme with orange accent
- ✅ Telegram Web App integration
- ✅ Responsive design

### Landing Page
- ✅ Hero section con demo card
- ✅ Features grid
- ✅ How it works (4 steps)
- ✅ Identity NFT showcase
- ✅ For business section
- ✅ CTA footer

### Telegram Bot
- ✅ /start command
- ✅ /balance, /identity, /referral
- ✅ Mini App launcher
- ✅ Inline keyboards

### Smart Contracts (Specs)
- ✅ Soulbound NFT (ERC-721 + ERC-5192)
- ✅ Dynamic metadata
- ✅ Level/XP system on-chain
- ✅ Accessory equipment
- ✅ ERC-20 Bunz token with rewards
- ✅ Signature-based claims
- ✅ Referral tracking

---

## 🔐 Smart Contracts - Estado

> ⚠️ **Los smart contracts están especificados pero NO implementados.**
> 
> Siguiente paso: Implementar en Solidity cuando estés listo para transacciones.

### Especificaciones Completas:

1. **RabbittyIdentity.sol**
   - Soulbound (non-transferable)
   - ERC-721 base
   - Level/XP on-chain
   - Accessory system
   - Dynamic metadata

2. **BunzToken.sol**
   - ERC-20 with mint/burn
   - Signature-based claims
   - Referral rewards
   - Treasury management

---

## 📊 SAT/Fisco Status

- ✅ FIEL autenticación funciona
- ⏳ CFDIs en proceso de descarga (SAT tarda 2-5 minutos)
- Request activo: 58b6cc2e-5923-4d50-9417-327b2c3806de
- Estado: En Proceso (2)

---

## 🎨 Diseño

- **Colores**: Dark theme (#07070d, #12121f)
- **Accent**: Orange (#e67e22)
- **Font**: Inter
- **Icons**: Lucide React
- **Animations**: CSS keyframes

---

## 🚀 Próximos Pasos

### Fase 2: Smart Contracts
1. Implementar RabbittyIdentity.sol
2. Implementar BunzToken.sol
3. Setup Hardhat/Foundry
4. Unit tests
5. Security audit

### Fase 3: Web3 Integration
1. WalletConnect
2. Contract interactions
3. Event listeners
4. IPFS metadata

### Fase 4: Production
1. PostgreSQL migration
2. Redis cache
3. Docker deployment
4. Polygon Amoy testnet
5. CI/CD pipeline

---

**Proyecto listo para testing local y desarrollo de smart contracts.**

Contacto: Bull's Lab | 2026
