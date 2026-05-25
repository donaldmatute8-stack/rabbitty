# 🔗 Sepolia Testnet Setup

## Estado Actual

**Contratos en Localhost:**
- RabbittyIdentity: `0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512`
- BunzToken: `0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9`

**Sepolia:** No desplegado aún

---

## Requisitos para Sepolia

### 1. Faucet ETH Sepolia
Necesitas ETH de Sepolia para gas. Opciones:
- **Alchemy Faucet:** https://sepoliafaucet.com (0.5 ETH/día)
- **Infura Faucet:** https://www.infura.io/faucet (0.5 ETH/día)
- **QuickNode Faucet:** https://faucet.quicknode.com (0.1 ETH)

### 2. RPC Endpoints Sepolia
- **Alchemy:** `https://eth-sepolia.g.alchemy.com/v2/YOUR_KEY`
- **Infura:** `https://sepolia.infura.io/v3/YOUR_KEY`
- **Public:** `https://ethereum-sepolia-rpc.publicnode.com`

### 3. Private Key
Tienes: `SEPOLIA_PRIVATE_KEY=5e009fa90adbc590c6e06c4b48d89bc2365c79acd12fbbccab07725d451732f8`

---

## Pasos para Deploy en Sepolia

### 1. Configurar .env

```bash
# En ~/.openclaw/agents/sofia-workspace/projects/Rabbitty/contracts/
SEPOLIA_RPC=https://ethereum-sepolia-rpc.publicnode.com
PRIVATE_KEY=5e009fa90adbc590c6e06c4b48d89bc2365c79acd12fbbccab07725d451732f8
```

### 2. Deploy contratos

```bash
cd ~/.openclaw/agents/sofia-workspace/projects/Rabbitty/contracts

# Compilar
npx hardhat compile

# Deploy a Sepolia
npx hardhat run scripts/deploy.js --network sepolia
```

### 3. Guardar direcciones

Actualizar en:
- `telegram-miniapp/.env.local`
- `backend/app/config.py`

---

## Configuración Frontend

### Variables de entorno para Vercel

```
NEXT_PUBLIC_API_URL=https://api.rabbitty.com/v1
NEXT_PUBLIC_BUNZ_CONTRACT_ADDRESS=0x... (dirección Sepolia)
NEXT_PUBLIC_RPC_URL=https://eth-sepolia.g.alchemy.com/v2/YOUR_KEY
NEXT_PUBLIC_CHAIN_ID=11155111
```

---

## Test de Sepolia

### Verificar balance
```bash
npx hardhat console --network sepolia
> await ethers.provider.getBalance("TU_DIRECCION")
```

### Verificar contrato
```bash
npx hardhat verify --network sepolia DIRECCION_CONTRATO "param1" "param2"
```

---

## ⚠️ IMPORTANTE

**Para producción (Mainnet):**
- Polygon Mainnet es mejor para Rabbitty (bajo gas, rápido)
- Chain ID: 137
- RPC: Alchemy/Infura Polygon
- Requiere MATIC para gas

**Sepolia es solo para testing.**

---

## Próximos pasos

1. [ ] Obtener ETH Sepolia del faucet
2. [ ] Deploy contratos BunzToken a Sepolia
3. [ ] Deploy contratos RabbittyIdentity a Sepolia
4. [ ] Verificar contratos en Etherscan Sepolia
5. [ ] Actualizar direcciones en config
6. [ ] Probar transacciones en Sepolia

---

*Documento creado por Sofía - 2026-05-24*
