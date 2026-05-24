# 🐰 Rabbitty

**Give to Get** — The reward ecosystem where every purchase earns you Bunz tokens.

---

## What is Rabbitty?

Rabbitty turns everyday purchases into rewards. Support local businesses, build your unique on-chain identity, and watch your Bunz grow.

- **20%+ Bunz back** on every purchase at affiliates
- **Dynamic Identity NFT** that levels up with you
- **Soulbound** — cannot be transferred, truly yours
- **Telegram Mini App** — no downloads needed
- **Polygon blockchain** — fast, cheap, scalable

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Telegram Mini App                        │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │   Wallet     │  │  Identity    │  │  Affiliates  │     │
│  │   Page       │  │  Page        │  │  Page        │     │
│  └──────────────┘  └──────────────┘  └──────────────┘     │
└────────────────────┬──────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│                    FastAPI Backend                          │
│  • User management    • Bunz token logic                    │
│  • Identity service   • Affiliate registry                    │
│  • Transaction API    • Web3 integration (future)         │
└────────────────────┬──────────────────────────────────────┘
                     │
         ┌───────────┼───────────┐
         ▼           ▼           ▼
   ┌─────────┐ ┌──────────┐ ┌──────────┐
   │ Bunz    │ │ Identity │ │ IPFS/    │
   │ Token   │ │ NFT      │ │ Arweave  │
   │ (ERC20) │ │ (ERC721) │ │ (metadata)│
   └─────────┘ └──────────┘ └──────────┘
         │           │           │
         └───────────┴───────────┘
                     │
              ┌──────▼──────┐
              │   Polygon   │
              │   Amoy      │
              └─────────────┘
```

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | React + TypeScript |
| Mini App | Telegram Web App |
| Backend | FastAPI (Python) |
| Blockchain | Polygon (Amoy testnet) |
| Smart Contracts | Solidity (ERC-20, ERC-721) |
| Storage | IPFS for NFT metadata |
| Wallet | MetaMask / WalletConnect |

---

## Project Structure

```
projects/Rabbitty/
├── README.md                    # This file
├── ARQUITECTURA-TECNICA.md      # Technical architecture docs
├── src/
│   ├── backend/                 # FastAPI server
│   │   ├── server.py            # Main API
│   │   └── requirements.txt       # Dependencies
│   ├── frontend/                # React frontend
│   │   ├── App.tsx              # Main app component
│   │   ├── landing.html         # Landing page
│   │   └── index.tsx            # Entry point
│   ├── contracts/               # Smart contracts (TODO)
│   │   ├── BunzToken.sol        # ERC-20 token
│   │   ├── RabbittyIdentity.sol # Soulbound NFT
│   │   └── RabbittyRegistry.sol # Affiliate registry
│   └── miniapp/                 # Telegram integration
│       └── telegram-bot.py      # Bot handlers
├── docs/                        # Documentation
│   └── API.md                   # API reference
└── scripts/                     # Deployment scripts
    └── deploy.sh
```

---

## Smart Contracts (Planned)

> ⚠️ **Smart contracts are NOT implemented yet.** They will be the final step before mainnet deployment.

### Identity NFT (RabbittyIdentity.sol)

- **Standard**: ERC-721 with custom extensions
- **Soulbound**: Non-transferable after mint
- **Dynamic**: Metadata updates on-chain
- **Upgradable**: UUPS proxy pattern

```solidity
// Key features:
// - SBT (Soulbound Token) - cannot be transferred
// - Level system with on-chain XP
// - Accessory equip/unequip
// - Metadata URI generation
// - Soulbound validation
```

### Bunz Token (BunzToken.sol)

- **Standard**: ERC-20 with burn/mint
- **Distribution**: Via affiliate claims
- **Utility**: Redeem at affiliates

---

## Identity System

The core of Rabbitty is your **dynamic, soulbound Identity NFT**.

### Features

- **Unique username** — on-chain, public
- **Level system** — gain XP from transactions
- **Power score** — competitive ranking
- **Accessories** — badges, frames, effects, crowns
- **Achievements** — permanent on-chain history

### Accessory Types

| Type | Rarity | Description |
|------|--------|-------------|
| Badge | 1-5 | Achievement markers |
| Frame | 2-5 | Profile borders |
| Effect | 3-5 | Visual animations |
| Headwear | 3-5 | Hats, crowns, etc. |
| Background | 4-5 | Profile backgrounds |

---

## Earning Bunz

### Base Rate

- **20% Bunz** back on every purchase
- **+2% per level** — higher levels earn more

### Referrals

- **5% bonus** on referred users' transactions
- **Multi-level** — referrals of referrals count

---

## API Endpoints

### User

- `GET /api/user/{wallet}` — Get user data
- `POST /api/identity/create` — Mint Identity NFT
- `POST /api/identity/equip` — Equip accessory

### Transactions

- `POST /api/scan` — Process affiliate scan/earn
- `GET /api/transactions/{wallet}` — Transaction history

### Affiliates

- `GET /api/affiliates` — List affiliates
- `GET /api/affiliates/{id}` — Affiliate details

### Accessories

- `GET /api/accessories` — Available accessories

---

## Roadmap

### Phase 1: MVP (In Progress)
- ✅ Backend API
- ✅ Frontend Mini App
- ✅ Landing page
- ⏳ Telegram Bot integration
- ⏳ Test deployment

### Phase 2: Smart Contracts
- 🔒 Identity NFT (Soulbound ERC-721)
- 🔒 Bunz Token (ERC-20)
- 🔒 Affiliate Registry
- 🔒 Security audit

### Phase 3: Launch
- 🚀 Polygon Amoy Testnet
- 🚀 Mainnet deployment
- 🚀 Marketing campaign

---

## Running Locally

### Backend

```bash
cd src/backend
pip install -r requirements.txt
python server.py
# Runs on http://localhost:3000
```

### Frontend

```bash
cd src/frontend
npm install
npm run dev
# Runs on http://localhost:5173
```

### Telegram Bot

```bash
cd src/miniapp
export TELEGRAM_BOT_TOKEN="your_token"
python telegram-bot.py
```

---

## License

MIT © 2026 Bull's Lab

Built with 🐰 by Marco and team.
