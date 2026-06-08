# 🚀 Rabbitty - Phase 4: Production Deployment

## Estado: Phase 4 EN PROGRESO ⏳

### ✅ Local Deployment Complete

**Contracts deployed to Hardhat localhost:**
```
RabbittyIdentity Proxy: 0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512
RabbittyIdentity Implementation: 0x5FbDB2315678afecb367f032d93F642f64180aa3
BunzToken Proxy: 0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9
BunzToken Implementation: 0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0
```

**Test Results:**
- ✅ Identity minted successfully (Token ID: 1)
- ✅ Bunz tokens minted (Balance: 1,000,000,1000 BZ)

---

## 📋 Phase 4 Tasks

| # | Task | Status |
|---|---|---|
| 1 | Deploy to Polygon Amoy Testnet | ⏳ Ready |
| 2 | Verify contracts on Amoy | ⏳ Ready |
| 3 | Deploy Mini App to Vercel | ⏳ Ready |
| 4 | Configure Telegram Mini App URL | ⏳ Ready |
| 5 | Add branding (logo, identity) | ⏳ Ready |
| 6 | Plan Global Rewards Algorithm | ⏳ Ready |
| 7 | Create Micro SaaS APIs | ⏳ Ready |

---

## 🌐 Deployment Commands

### Polygon Amoy Testnet
```bash
export PRIVATE_KEY="your_private_key"
npx hardhat run scripts/deploy.js --network amoy
```

### Polygon Mainnet
```bash
export PRIVATE_KEY="your_private_key"
npx hardhat run scripts/deploy.js --network polygon
```

### Verify Contract
```bash
npx hardhat verify --network amoy CONTRACT_ADDRESS
```

---

## 🎨 Branding Assets Needed

1. **Logo Rabbitty**
   - Format: SVG/PNG
   - Sizes: 512x512, 192x192, 64x64
   - Colors: Primary brand color

2. **Identity NFT Images**
   - Base character design
   - Accessories (badges, frames, effects)
   - Backgrounds

3. **App Icons**
   - Telegram Mini App icon
   - Website favicon

---

## 🔗 Mini App URL Configuration

**Vercel Deployment:**
```
1. Push code to GitHub
2. Connect Vercel to repo
3. Deploy to: https://rabbitty.vercel.app
4. Configure in Telegram BotFather: /setwebapp
```

**Telegram Bot Configuration:**
```
/setwebapp -> https://rabbitty.vercel.app
```

---

## 🧮 Global Rewards Algorithm Plan

### Core Formula
```python
total_reward = base_reward * level_multiplier * streak_multiplier * governance_bonus

where:
- base_reward = fiscal_volume * 0.001  # 0.1% of fiscal activity
- level_multiplier = 1 + (level * 0.02)  # +2% per level
- streak_multiplier = 1 + (consecutive_months * 0.05)  # +5% per month streak
- governance_bonus = 1 + (participation_score * 0.01)  # +1% per governance point
```

### Reward Sources
1. **Fiscal Activity** (40%)
   - CFDI downloads
   - Tax declarations
   - Compliance score

2. **Platform Engagement** (30%)
   - Daily check-ins
   - Referrals
   - Achievements

3. **Governance** (20%)
   - Voting participation
   - Proposals
   - Community contribution

4. **Staking** (10%)
   - Token lock periods
   - LP provision

### Distribution Schedule
- **Daily**: Small rewards for check-ins
- **Weekly**: Compliance bonuses
- **Monthly**: Fiscal activity rewards
- **Quarterly**: Governance distributions

---

## 🔌 Micro SaaS APIs

### API Endpoints

#### User Management
```
POST   /api/v1/users/register
GET    /api/v1/users/{rfc}
PUT    /api/v1/users/{rfc}/sync
```

#### Rewards
```
GET    /api/v1/rewards/calculate/{rfc}
POST   /api/v1/rewards/claim
GET    /api/v1/rewards/leaderboard
```

#### Identity
```
GET    /api/v1/identity/{tokenId}
GET    /api/v1/identity/username/{username}
POST   /api/v1/identity/mint
```

#### Achievements
```
GET    /api/v1/achievements
GET    /api/v1/achievements/{rfc}
POST   /api/v1/achievements/unlock
```

---

**Phase 4 READY FOR PRODUCTION DEPLOYMENT**

Date: 2026-05-08
