# 🐰 Rabbitty MVP Checklist

## Current Status

### ✅ Completed
- [x] Smart contracts (Solidity)
- [x] Contract tests (26 passing)
- [x] Local deployment (Hardhat)
- [x] Rewards engine algorithm
- [x] Business model defined

### 🚧 In Progress
- [ ] Testnet deployment (Polygon Amoy)
- [ ] Mini App frontend (React/Vite)
- [ ] Wallet connection (MetaMask)
- [ ] Branding assets (logo, colors)

### ⏳ Pending
- [ ] Contract verification
- [ ] IPFS metadata hosting
- [ ] Accessory NFT designs
- [ ] Mainnet deployment

---

## 🎯 MVP Definition

**Core Features:**
1. Mint soulbound identity NFT
2. Display identity with XP/level
3. Earn BZ tokens for activity
4. View rewards dashboard
5. Claim rewards to wallet

**Success Criteria:**
- User can mint identity
- User can see their stats
- User receives rewards
- Transactions work on testnet

---

## 📋 Tasks to Complete MVP

### 1. Frontend Setup (2-3h)
```bash
cd miniapp
npm create vite@latest . -- --template react-ts
npm install ethers @web3-react/core @web3-react/injected-connector
npm install recharts lucide-react
```

### 2. Wallet Integration (2h)
- MetaMask connection
- WalletConnect support
- Network switching (Polygon)

### 3. Contract Integration (3h)
- Mint identity function
- Get identity data
- Claim rewards function
- Event listeners

### 4. UI/UX (4h)
- Identity card component
- Stats dashboard
- Rewards section
- Transaction status

### 5. Branding (2h)
- Logo design/generation
- Color scheme (#FF6B35 primary)
- Typography
- Icons

### 6. Deploy (1h)
- Vercel setup
- Environment variables
- Domain config

**Total Estimate: 14-15 hours**

---

## 🔗 Dependencies

**Before starting:**
- [ ] Private key for testnet
- [ ] MATIC on Amoy testnet
- [ ] Vercel account
- [ ] Domain/subdomain

---

**Ready to proceed?**
