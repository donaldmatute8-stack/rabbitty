# Rabbitty MVP - Phase 1: Telegram Mini App

## Project Overview
Rabbitty is a reward-based ecosystem where users earn "Bunz" tokens through a "Give to Get" model, integrating local business directories.

## Stack
- **Frontend**: React + TypeScript (Telegram Mini App SDK)
- **Backend**: Node.js + Express (REST API)
- **Database**: PostgreSQL (Neon)
- **Blockchain**: Polygon Testnet (ERC-20 Bunz Token)
- **Hosting**: Vercel (Frontend), Railway/Render (Backend)

## Directory Structure
- `/src/frontend`: Telegram Mini App source code
- `/src/backend`: API server and business logic
- `/src/contracts`: Solidity smart contracts for Bunz tokens
- `/assets`: Logos and UI designs

## Getting Started
1. Clone the repository.
2. Set up environment variables in `.env` (DB_URL, TELEGRAM_BOT_TOKEN, POLYGON_RPC_URL).
3. Install dependencies: `npm install` in both `frontend` and `backend`.
4. Deploy contracts to Polygon Testnet.
5. Start the backend and frontend development servers.

## MVP Roadmap (Phase 1)
- [ ] Telegram Auth Integration
- [ ] Bunz Wallet Dashboard
- [ ] Affiliate Business Directory
- [ ] "Give to Get" Reward Logic
- [ ] QR Payment System
- [ ] User Profiles
