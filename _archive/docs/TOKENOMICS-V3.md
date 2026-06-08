# 🐰 Rabbitty Tokenomics v3.0 — Modelo Real

## 🔒 Vault Seguro
- **Plan de Negocios:** Encriptado en `/Users/bullslab/.openclaw/agents/sofia-workspace/secure/rabbitty-business-plan.enc`
- **Key:** `/Users/bullslab/.openclaw/agents/sofia-workspace/secure/vault.key`
- **Acceso:** Solo Marco y Sofía

---

## 🎯 Filosofía Central (CORREGIDA)

> *"Los negocios mintean recompensas. El valor está en el consumo real."*

**Reglas de Oro:**
1. **NO** hay compra de Bunz con cash
2. **NO** hay conversión directa Bunz → Cash
3. **SÍ** hay minting por consumo verificado
4. **SÍ** hay crédito de minting controlado
5. **SÍ** hay economía circular dentro del ecosistema

---

## 📊 Modelo de Negocio Real

### Actores

```
┌─────────────────────────────────────────────────────────────┐
│                    ECOSISTEMA RABITTY v3                     │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌─────────────┐         ┌─────────────┐                   │
│  │   RABBITTY  │         │   NEGOCIO   │                   │
│  │   (Protocolo)│◄───────│  (Affiliate)│                   │
│  │              │  fees   │             │                   │
│  │  • Treasury  │         │  • Mintea   │                   │
│  │  • Oracle    │         │  • Oferta   │                   │
│  │  • Registro  │         │  • Acepta   │                   │
│  └──────┬───────┘         └──────┬──────┘                   │
│         │                        │                          │
│         │        Bunz            │                          │
│         │◄───────────────────────┘                          │
│         │                        ^                          │
│  ┌──────┴───────┐                │                          │
│  │   USUARIO    │────────────────┘                          │
│  │  (Rabbiter)  │  consume / paga                            │
│  │              │                                            │
│  │  • Escanea   │                                            │
│  │  • Recibe    │                                            │
│  │  • Gasta     │                                            │
│  └──────────────┘                                            │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### Flujo de Minting

```
1. NEGOCIO SE REGISTRA
   ├── Elige paquete: $10K, $20K, $50K, $100K pesos (crédito de minting)
   ├── Define % de recompensa: 10%, 20%, 50%, 100% (o más)
   └── Tiene "crédito disponible" para mintear

2. RABBITTER CONSUME ($1000 pesos)
   ├── Escanea QR del negocio (o negocio escanea su QR)
   ├── Sistema verifica transacción bidireccionalmente
   └── Confirma: sí es cliente Rabbitty, sí pagó

3. NEGOCIO MINTEA RECOMPENSA
   ├── Rate: 20% → 200 Bunz (1 Bunz = $1 MXN)
   ├── Se descuenta del crédito del negocio: $1000 - $200 = $800 restante
   └── Los 200 Bunz van directo al wallet del Rabbitter

4. RABBITTER USA SUS BUNZ
   ├── Va a otro negocio
   ├── Compra algo con Bunz
   ├── Al gastar: 3% fee al protocolo, 6% fee al negocio receptor
   └── Los fees van a la tesorería de Rabbitty

5. TESORERÍA ACUMULA BUNZ
   ├── Fees de transacciones
   ├── Cuotas de membresía de negocios (después año 1, en Bunz)
   └── Cuotas de usuarios (en Bunz)

6. RABBITTY USA TESORERÍA PARA:
   ├── Promociones especiales ("Ven y consume aquí, 50% off en Bunz")
   ├── Inventario de ofertas
   ├── Incentivos a negocios
   └── Crecimiento del ecosistema
```

---

## 💰 Paridad y Nomenclatura

### bunz (minúscula) — Moneda Interna
- **1 bunz = 1 unidad monetaria local**
- México: 1 bunz = $1 MXN
- USA: 1 bunz = $1 USD
- Europa: 1 bunz = €1 EUR
- **Conversión entre países:** Mismo tipo de cambio oficial

### BUNZ (mayúscula) — Criptomoneda Real
- ERC-20 en blockchain
- Intercambiable por USDT, ETH, etc.
- **Conversión:** bunz ↔ BUNZ con ratio definido por mercado
- **Uso:** Para usuarios que quieran sacar valor fuera del ecosistema

---

## 🏦 Crédito de Minting

### Paquetes Iniciales (Etapa 1)

| Paquete | Crédito de Minting | Ideal Para |
|---------|-------------------|------------|
| Starter | $10,000 MXN | Negocios pequeños, cafés |
| Growth | $20,000 MXN | Restaurantes medianos |
| Pro | $50,000 MXN | Cadenas, gimnasios |
| Enterprise | $100,000 MXN | Grandes retailers |

### Por Nicho de Mercado

| Nicho | Paquete Sugerido | Razón |
|-------|------------------|-------|
| Restaurantes | $20K-$50K | Alto inventario, rotación rápida |
| Gimnasios | $20K-$50K | Membresías recurrentes |
| Retail | $50K-$100K | Inventario grande |
| Servicios | $10K-$20K | Menor frecuencia |
| Hotelería | $50K+ | Alto valor por transacción |

### Etapa 2+ — Solicitud Manual

```
Negocio solicita más crédito
        ↓
Rabbitty revisa:
  • Historial de consumo
  • Rating del negocio
  • Zona geográfica
  • Tipo de negocio
        ↓
Autorización con límite
        ↓
Crédito aumentado
```

---

## 🔐 Verificación de Consumo

### Opciones Evaluadas

| Método | Pros | Contras |
|--------|------|---------|
| **QR Bidireccional** ✅ | Simple, rápido, ambos participan | Requiere app abierta |
| NFC Tap | Más rápido que QR | Requiere hardware NFC |
| GPS + Tiempo | Automático | Falso positivo si está cerca |
| Blockchain Oracle | Descentralizado | Costoso, lento |
| Backend Centralizado | Rápido, flexible | Punto central de fallo |

### Recomendación: QR Bidireccional + Backend

```
ESCENARIO 1: Usuario escanea QR del negocio
┌─────────────┐         ┌─────────────┐         ┌─────────────┐
│   RABBITTY  │         │   NEGOCIO   │         │   USUARIO   │
│   (Backend) │         │  (Pantalla) │         │   (App)     │
└──────┬──────┘         └──────┬──────┘         └──────┬──────┘
       │                       │                       │
       │  1. Negocio genera QR │                       │
       │◄──────────────────────│                       │
       │                       │                       │
       │  2. QR = business_id + timestamp + nonce      │
       │──────────────────────►│                       │
       │                       │                       │
       │                       │     3. Usuario escanea│
       │                       │◄──────────────────────│
       │                       │                       │
       │  4. Backend valida:   │                       │
       │     - Usuario activo  │                       │
       │     - Negocio activo  │                       │
       │     - No duplicado    │                       │
       │◄──────────────────────│                       │
       │                       │                       │
       │  5. Confirma transacción                      │
       │──────────────────────►│──────────────────────►│
       │                       │                       │
       │  6. Negocio mintea recompensa                 │
       │◄──────────────────────│                       │
       │                       │                       │
       │  7. Bunz al usuario   │                       │
       │──────────────────────────────────────────────►│
       │                       │                       │
```

```
ESCENARIO 2: Negocio escanea QR del usuario (para pagos con Bunz)
┌─────────────┐         ┌─────────────┐         ┌─────────────┐
│   RABBITTY  │         │   NEGOCIO   │         │   USUARIO   │
│   (Backend) │         │  (Scanner)  │         │   (App QR)  │
└──────┬──────┘         └──────┬──────┘         └──────┬──────┘
       │                       │                       │
       │                       │     1. Usuario muestra QR
       │                       │◄──────────────────────│
       │                       │                       │
       │  2. Negocio escanea   │                       │
       │◄──────────────────────│                       │
       │                       │                       │
       │  3. Backend valida:   │                       │
       │     - Saldo suficiente│                       │
       │     - Usuario activo  │                       │
       │     - Negocio acepta  │                       │
       │◄──────────────────────│                       │
       │                       │                       │
       │  4. Transfiere Bunz   │                       │
       │     - 91% al negocio  │                       │
       │     - 3% fee protocolo│                       │
       │     - 6% fee negocio  │                       │
       │◄──────────────────────│                       │
       │                       │                       │
       │  5. Confirma a ambos  │──────────────────────►│
       │                       │                       │
```

---

## 📜 Smart Contracts Diseñados

### 1. `bunz.sol` — Moneda Interna (minúscula)

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts-upgradeable/token/ERC20/ERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";

/**
 * @title bunz
 * @dev Moneda interna de Rabbitty
 * Los negocios mintean por consumo verificado
 * Paridad fija: 1 bunz = 1 unidad monetaria local
 */
contract bunz is 
    ERC20Upgradeable,
    AccessControlUpgradeable,
    ReentrancyGuardUpgradeable,
    UUPSUpgradeable 
{
    // ============ Roles ============
    bytes32 public constant ORACLE_ROLE = keccak256("ORACLE_ROLE");
    bytes32 public constant BUSINESS_ROLE = keccak256("BUSINESS_ROLE");
    bytes32 public constant TREASURY_ROLE = keccak256("TREASURY_ROLE");
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");
    bytes32 public constant UPGRADER_ROLE = keccak256("UPGRADER_ROLE");

    // ============ Configuración ============
    string public constant NAME = "bunz";
    string public constant SYMBOL = "bunz";
    uint8 public constant DECIMALS = 18;
    
    // Fees al gastar (en bunz)
    uint256 public constant PROTOCOL_FEE = 300;  // 3%
    uint256 public constant AFFILIATE_FEE = 600; // 6%
    uint256 public constant BURN_RATE = 100;   // 1% deflación
    
    // Límites de recompensa por negocio
    uint256 public constant MIN_REWARD_RATE = 1000; // 10% mínimo
    uint256 public constant MAX_REWARD_RATE = 20000; // 200% máximo

    // ============ Estado ============
    uint256 public totalMintedByBusinesses;
    uint256 public totalBurned;
    uint256 public totalFeesCollected;
    
    // ============ Negocios ============
    struct Business {
        uint256 creditLimit;      // Crédito máximo de minting
        uint256 creditUsed;       // Crédito ya usado
        uint256 rewardRate;       // % de recompensa actual
        bool active;              // Si está activo
        string businessType;      // Tipo de negocio (restaurante, gym, etc.)
        uint256 joinedAt;         // Fecha de registro
    }
    
    mapping(address => Business) public businesses;
    mapping(address => bool) public isRegistered;
    address[] public activeBusinesses;
    
    // ============ Transacciones ============
    struct Transaction {
        address business;
        address user;
        uint256 purchaseAmount;   // En moneda local (ej. $1000 MXN)
        uint256 rewardAmount;     // En bunz (ej. 100 bunz)
        uint256 timestamp;
        bytes32 receiptHash;      // Hash único del recibo
    }
    
    Transaction[] public transactions;
    mapping(bytes32 => bool) public receiptUsed;
    
    // ============ Rate Limiting ============
    mapping(address => uint256) public dailyMinted;
    mapping(address => uint256) public lastMintReset;
    uint256 public constant DAILY_MINT_LIMIT_PER_BUSINESS = 50_000 * 10**18; // $50K/día

    // ============ Events ============
    event BusinessRegistered(
        address indexed business, 
        uint256 creditLimit, 
        string businessType,
        uint256 rewardRate
    );
    event RewardMinted(
        address indexed business,
        address indexed user,
        uint256 purchaseAmount,
        uint256 rewardAmount,
        bytes32 receiptHash
    );
    event BusinessRateChanged(address indexed business, uint256 newRate);
    event CreditIncreased(address indexed business, uint256 newLimit);
    event BunzSpent(
        address indexed user,
        address indexed business,
        uint256 amount,
        uint256 protocolFee,
        uint256 affiliateFee
    );

    // ============ Initialize ============
    function initialize() public initializer {
        __ERC20_init(NAME, SYMBOL);
        __AccessControl_init();
        __ReentrancyGuard_init();
        __UUPSUpgradeable_init();

        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(ORACLE_ROLE, msg.sender);
        _grantRole(TREASURY_ROLE, msg.sender);
        _grantRole(PAUSER_ROLE, msg.sender);
        _grantRole(UPGRADER_ROLE, msg.sender);
    }

    // ============ Registro de Negocios ============
    /**
     * @dev Registrar nuevo negocio con paquete de crédito
     * @param business Dirección del negocio
     * @param creditLimit Crédito de minting (ej. 10000 * 10^18 para $10K)
     * @param businessType Tipo de negocio
     * @param initialRate % de recompensa inicial (1000-20000)
     */
    function registerBusiness(
        address business,
        uint256 creditLimit,
        string calldata businessType,
        uint256 initialRate
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(!isRegistered[business], "Business already registered");
        require(initialRate >= MIN_REWARD_RATE && initialRate <= MAX_REWARD_RATE, 
                "Rate must be 10%-200%");
        
        businesses[business] = Business({
            creditLimit: creditLimit,
            creditUsed: 0,
            rewardRate: initialRate,
            active: true,
            businessType: businessType,
            joinedAt: block.timestamp
        });
        
        isRegistered[business] = true;
        activeBusinesses.push(business);
        _grantRole(BUSINESS_ROLE, business);
        
        emit BusinessRegistered(business, creditLimit, businessType, initialRate);
    }

    // ============ Minting por Consumo ============
    /**
     * @dev Mintear recompensa por consumo verificado
     * @param business Dirección del negocio
     * @param user Dirección del usuario (Rabbiter)
     * @param purchaseAmount Monto de la compra en moneda local
     * @param receiptHash Hash único del recibo (anti-replay)
     */
    function mintReward(
        address business,
        address user,
        uint256 purchaseAmount,
        bytes32 receiptHash
    ) external onlyRole(ORACLE_ROLE) nonReentrant {
        
        require(isRegistered[business], "Business not registered");
        require(businesses[business].active, "Business inactive");
        require(!receiptUsed[receiptHash], "Receipt already used");
        require(user != address(0), "Invalid user address");
        
        Business storage b = businesses[business];
        
        // Verificar rate limits diarios
        if (block.timestamp > lastMintReset[business] + 1 days) {
            dailyMinted[business] = 0;
            lastMintReset[business] = block.timestamp;
        }
        
        // Calcular recompensa
        uint256 rewardAmount = (purchaseAmount * b.rewardRate) / 10000;
        
        // Verificar crédito disponible
        require(b.creditUsed + rewardAmount <= b.creditLimit, 
                "Credit limit exceeded");
        require(dailyMinted[business] + rewardAmount <= DAILY_MINT_LIMIT_PER_BUSINESS,
                "Daily mint limit exceeded");
        
        // Actualizar crédito
        b.creditUsed += rewardAmount;
        dailyMinted[business] += rewardAmount;
        
        // Marcar recibo como usado
        receiptUsed[receiptHash] = true;
        
        // Mintear al usuario
        _mint(user, rewardAmount);
        totalMintedByBusinesses += rewardAmount;
        
        // Registrar transacción
        transactions.push(Transaction({
            business: business,
            user: user,
            purchaseAmount: purchaseAmount,
            rewardAmount: rewardAmount,
            timestamp: block.timestamp,
            receiptHash: receiptHash
        }));
        
        emit RewardMinted(business, user, purchaseAmount, rewardAmount, receiptHash);
    }

    // ============ Gestión de Negocios ============
    /**
     * @dev Negocio cambia su % de recompensa
     */
    function setRewardRate(uint256 newRate) external onlyRole(BUSINESS_ROLE) {
        require(newRate >= MIN_REWARD_RATE && newRate <= MAX_REWARD_RATE,
                "Rate must be 10%-200%");
        businesses[msg.sender].rewardRate = newRate;
        emit BusinessRateChanged(msg.sender, newRate);
    }

    /**
     * @dev Admin aumenta crédito de un negocio
     */
    function increaseCredit(
        address business, 
        uint256 additionalCredit
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(isRegistered[business], "Business not registered");
        businesses[business].creditLimit += additionalCredit;
        emit CreditIncreased(business, businesses[business].creditLimit);
    }

    /**
     * @dev Admin desactiva negocio
     */
    function deactivateBusiness(address business) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(isRegistered[business], "Business not registered");
        businesses[business].active = false;
    }

    // ============ Gastar Bunz ============
    /**
     * @dev Usuario gasta Bunz en un negocio
     * Fees: 3% protocolo, 6% negocio receptor, 1% burn
     */
    function spendBunz(
        address business,
        uint256 amount
    ) external nonReentrant {
        require(isRegistered[business], "Business not registered");
        require(businesses[business].active, "Business inactive");
        require(balanceOf(msg.sender) >= amount, "Insufficient balance");
        require(amount >= 10**18, "Minimum 1 bunz");
        
        // Calcular fees
        uint256 protocolFee = (amount * PROTOCOL_FEE) / 10000;
        uint256 affiliateFee = (amount * AFFILIATE_FEE) / 10000;
        uint256 burnAmount = (amount * BURN_RATE) / 10000;
        uint256 netToBusiness = amount - protocolFee - affiliateFee - burnAmount;
        
        // Transferir al negocio
        _transfer(msg.sender, business, netToBusiness);
        
        // Transferir fees al protocolo (tesorería)
        _transfer(msg.sender, address(this), protocolFee);
        
        // Transferir affiliate fee al negocio también
        _transfer(msg.sender, business, affiliateFee);
        
        // Quemar tokens deflacionarios
        _burn(msg.sender, burnAmount);
        totalBurned += burnAmount;
        
        // Acumular fees
        totalFeesCollected += protocolFee;
        
        emit BunzSpent(msg.sender, business, amount, protocolFee, affiliateFee);
    }

    // ============ Treasury Functions ============
    /**
     * @dev Treasury usa Bunz acumulados para promociones
     */
    function treasuryTransfer(
        address to,
        uint256 amount
    ) external onlyRole(TREASURY_ROLE) {
        require(balanceOf(address(this)) >= amount, "Insufficient treasury balance");
        _transfer(address(this), to, amount);
    }

    // ============ View Functions ============
    function getBusinessCredit(address business) external view returns (
        uint256 limit,
        uint256 used,
        uint256 remaining
    ) {
        Business storage b = businesses[business];
        return (b.creditLimit, b.creditUsed, b.creditLimit - b.creditUsed);
    }

    function getBusinessCount() external view returns (uint256) {
        return activeBusinesses.length;
    }

    function getTransactionCount() external view returns (uint256) {
        return transactions.length;
    }

    function getDailyMintRemaining(address business) external view returns (uint256) {
        if (block.timestamp > lastMintReset[business] + 1 days) {
            return DAILY_MINT_LIMIT_PER_BUSINESS;
        }
        return DAILY_MINT_LIMIT_PER_BUSINESS - dailyMinted[business];
    }

    // ============ Pausable ============
    function pause() external onlyRole(PAUSER_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(PAUSER_ROLE) {
        _unpause();
    }

    // ============ Required Overrides ============
    function _beforeTokenTransfer(address from, address to, uint256 amount)
        internal
        override(ERC20Upgradeable)
    {
        super._beforeTokenTransfer(from, to, amount);
    }

    function _authorizeUpgrade(address newImplementation) internal override onlyRole(UPGRADER_ROLE) {}
}
```

### 2. `TreasuryEngine.sol` — Algoritmo de Tesorería

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";

/**
 * @title TreasuryEngine
 * @dev Gestiona la tesorería de Rabbitty
 * Acumula fees, crea promociones, mantiene salud económica
 */
contract TreasuryEngine is 
    AccessControlUpgradeable,
    ReentrancyGuardUpgradeable,
    UUPSUpgradeable 
{
    bytes32 public constant TREASURY_MANAGER = keccak256("TREASURY_MANAGER");
    bytes32 public constant MARKETING_ROLE = keccak256("MARKETING_ROLE");
    bytes32 public constant UPGRADER_ROLE = keccak256("UPGRADER_ROLE");

    // Referencia al token bunz
    address public bunzToken;

    // ============ Inventario de Ofertas ============
    struct Offer {
        uint256 id;
        string name;
        string description;
        uint256 bunzCost;         // Cuánto cuesta en bunz
        uint256 discountPercent;  // Descuento %
        uint256 quantity;         // Cuántas disponibles
        uint256 remaining;        // Cuántas quedan
        bool active;
        uint256 createdAt;
        uint256 expiresAt;
    }
    
    uint256 private _offerIdCounter;
    mapping(uint256 => Offer) public offers;
    mapping(address => mapping(uint256 => uint256)) public userOfferRedemptions;
    
    // ============ Métricas ============
    uint256 public totalFeesAccumulated;
    uint256 public totalOffersCreated;
    uint256 public totalOffersRedeemed;
    uint256 public totalBunzDistributed;
    
    // ============ Configuración ============
    uint256 public maxOfferDiscount;  // Máximo 50%
    uint256 public minOfferDuration;  // Mínimo 24 horas

    // ============ Events ============
    event FeesReceived(uint256 amount, address from);
    event OfferCreated(uint256 indexed offerId, string name, uint256 bunzCost, uint256 quantity);
    event OfferRedeemed(uint256 indexed offerId, address indexed user, uint256 bunzCost);
    event OfferExpired(uint256 indexed offerId);
    event BunzDistributed(address indexed to, uint256 amount, string reason);

    function initialize(address _bunzToken) public initializer {
        __AccessControl_init();
        __ReentrancyGuard_init();
        __UUPSUpgradeable_init();

        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(TREASURY_MANAGER, msg.sender);
        _grantRole(MARKETING_ROLE, msg.sender);
        _grantRole(UPGRADER_ROLE, msg.sender);

        bunzToken = _bunzToken;
        maxOfferDiscount = 5000; // 50%
        minOfferDuration = 1 days;
        _offerIdCounter = 1;
    }

    // ============ Acumulación de Fees ============
    /**
     * @dev Recibir fees del protocolo
     * Llamado por bunz.sol cuando hay transacción
     */
    function receiveFees(uint256 amount) external {
        require(msg.sender == bunzToken, "Only bunz contract");
        totalFeesAccumulated += amount;
        emit FeesReceived(amount, msg.sender);
    }

    // ============ Gestión de Ofertas ============
    /**
     * @dev Crear oferta/promoción especial
     * Ej: "50% off en cafetería XYZ por 500 bunz"
     */
    function createOffer(
        string calldata name,
        string calldata description,
        uint256 bunzCost,
        uint256 discountPercent,
        uint256 quantity,
        uint256 duration
    ) external onlyRole(MARKETING_ROLE) {
        require(discountPercent <= maxOfferDiscount, "Discount too high");
        require(duration >= minOfferDuration, "Duration too short");
        require(bunzCost > 0, "Cost must be positive");
        require(quantity > 0, "Quantity must be positive");
        
        uint256 offerId = _offerIdCounter++;
        
        offers[offerId] = Offer({
            id: offerId,
            name: name,
            description: description,
            bunzCost: bunzCost,
            discountPercent: discountPercent,
            quantity: quantity,
            remaining: quantity,
            active: true,
            createdAt: block.timestamp,
            expiresAt: block.timestamp + duration
        });
        
        totalOffersCreated += quantity;
        
        emit OfferCreated(offerId, name, bunzCost, quantity);
    }

    /**
     * @dev Usuario canjea una oferta
     */
    function redeemOffer(uint256 offerId) external nonReentrant {
        Offer storage offer = offers[offerId];
        require(offer.active, "Offer not active");
        require(offer.remaining > 0, "Offer sold out");
        require(block.timestamp < offer.expiresAt, "Offer expired");
        
        // Verificar que el usuario tiene suficientes bunz
        // (Transferencia se hace desde bunzToken)
        
        offer.remaining--;
        totalOffersRedeemed++;
        totalBunzDistributed += offer.bunzCost;
        
        // Marcar como redimido
        userOfferRedemptions[msg.sender][offerId]++;
        
        emit OfferRedeemed(offerId, msg.sender, offer.bunzCost);
    }

    /**
     * @dev Expirar ofertas manualmente
     */
    function expireOffer(uint256 offerId) external onlyRole(MARKETING_ROLE) {
        require(offers[offerId].active, "Already inactive");
        offers[offerId].active = false;
        emit OfferExpired(offerId);
    }

    // ============ Distribución de Incentivos ============
    /**
     * @dev Enviar bunz como incentivo (ej. bienvenida, referral)
     */
    function distributeIncentive(
        address to,
        uint256 amount,
        string calldata reason
    ) external onlyRole(TREASURY_MANAGER) {
        require(to != address(0), "Invalid address");
        require(amount > 0, "Amount must be positive");
        
        // Transferir bunz del treasury al usuario
        // (Requiere que el treasury tenga bunz)
        
        totalBunzDistributed += amount;
        emit BunzDistributed(to, amount, reason);
    }

    // ============ View Functions ============
    function getTreasuryBalance() external view returns (uint256) {
        // Consultar balance de bunz del contrato
        return 0; // Placeholder
    }

    function getActiveOffers() external view returns (uint256[] memory) {
        // Devolver IDs de ofertas activas
        // Implementación omitida por brevedad
        return new uint256[](0);
    }

    function getHealthMetrics() external view returns (
        uint256 feesAccumulated,
        uint256 offersCreated,
        uint256 offersRedeemed,
        uint256 bunzDistributed,
        uint256 activeOffers
    ) {
        return (
            totalFeesAccumulated,
            totalOffersCreated,
            totalOffersRedeemed,
            totalBunzDistributed,
            _offerIdCounter - 1
        );
    }

    // ============ Required Overrides ============
    function _authorizeUpgrade(address newImplementation) internal override onlyRole(UPGRADER_ROLE) {}
}
```

### 3. `BusinessRegistry.sol` — Registro de Negocios

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";

/**
 * @title BusinessRegistry
 * @dev Registro y gestión de negocios afiliados
 */
contract BusinessRegistry is 
    AccessControlUpgradeable,
    UUPSUpgradeable 
{
    bytes32 public constant REGISTRAR_ROLE = keccak256("REGISTRAR_ROLE");
    bytes32 public constant UPGRADER_ROLE = keccak256("UPGRADER_ROLE");

    // ============ Paquetes de Crédito ============
    struct CreditPackage {
        string name;           // "Starter", "Growth", "Pro", "Enterprise"
        uint256 creditAmount;  // Ej. 10000 * 10^18 para $10K
        uint256 feeBunz;       // Costo en bunz para activar
        string[] niches;       // Nichos recomendados
    }
    
    mapping(uint256 => CreditPackage) public packages;
    uint256[] public packageIds;
    
    // ============ Negocios ============
    struct BusinessProfile {
        string name;
        string description;
        string category;       // "restaurante", "gym", "retail", etc.
        string location;       // Ciudad, zona
        string contactEmail;
        string phone;
        uint256 registrationDate;
        bool verified;
        uint256 rating;        // 1-5 estrellas
    }
    
    mapping(address => BusinessProfile) public profiles;
    mapping(string => address[]) public businessesByCategory;
    mapping(string => address[]) public businessesByLocation;
    
    // ============ Events ============
    event PackageCreated(uint256 indexed packageId, string name, uint256 creditAmount);
    event BusinessProfileUpdated(address indexed business, string name, string category);
    event BusinessVerified(address indexed business);

    function initialize() public initializer {
        __AccessControl_init();
        __UUPSUpgradeable_init();
        
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(REGISTRAR_ROLE, msg.sender);
        _grantRole(UPGRADER_ROLE, msg.sender);
        
        // Crear paquetes por defecto
        _createPackage("Starter", 10000 * 10**18, 500 * 10**18, ["cafe", "servicios"]);
        _createPackage("Growth", 20000 * 10**18, 1000 * 10**18, ["restaurante", "gym"]);
        _createPackage("Pro", 50000 * 10**18, 2500 * 10**18, ["retail", "hotel"]);
        _createPackage("Enterprise", 100000 * 10**18, 5000 * 10**18, ["cadena", "franquicia"]);
    }

    function _createPackage(
        string memory name,
        uint256 creditAmount,
        uint256 feeBunz,
        string[] memory niches
    ) internal {
        uint256 id = packageIds.length + 1;
        packages[id] = CreditPackage(name, creditAmount, feeBunz, niches);
        packageIds.push(id);
        emit PackageCreated(id, name, creditAmount);
    }

    function registerBusinessProfile(
        address business,
        string calldata name,
        string calldata description,
        string calldata category,
        string calldata location,
        string calldata contactEmail,
        string calldata phone
    ) external onlyRole(REGISTRAR_ROLE) {
        profiles[business] = BusinessProfile({
            name: name,
            description: description,
            category: category,
            location: location,
            contactEmail: contactEmail,
            phone: phone,
            registrationDate: block.timestamp,
            verified: false,
            rating: 0
        });
        
        businessesByCategory[category].push(business);
        businessesByLocation[location].push(business);
        
        emit BusinessProfileUpdated(business, name, category);
    }

    function verifyBusiness(address business) external onlyRole(REGISTRAR_ROLE) {
        profiles[business].verified = true;
        emit BusinessVerified(business);
    }

    function _authorizeUpgrade(address newImplementation) internal override onlyRole(UPGRADER_ROLE) {}
}
```

---

## 🧮 Algoritmo de Tesorería — Lógica Principal

```python
class RabbittyTreasuryEngine:
    """
    Motor de tesorería Rabbitty
    Mantiene la economía circular sana
    """
    
    def __init__(self):
        self.fees_accumulated = 0          # Bunz acumulados
        self.offers = {}                  # Ofertas activas
        self.incentives_pool = 0          # Pool de incentivos
        self.emergency_reserve = 0        # Reserva de emergencia
        
    # ============ Acumulación ============
    def accumulate_fees(self, amount: float):
        """
        Llamado por cada transacción de gasto de Bunz
        """
        self.fees_accumulated += amount
        
        # Distribución automática:
        # 70% → Incentivos y ofertas
        # 20% → Reserva de emergencia
        # 10% → Quema deflacionaria
        
        incentives = amount * 0.70
        reserve = amount * 0.20
        burn = amount * 0.10
        
        self.incentives_pool += incentives
        self.emergency_reserve += reserve
        
        return {'incentives': incentives, 'reserve': reserve, 'burn': burn}
    
    # ============ Creación de Ofertas ============
    def create_market_offer(self, business_id: str, discount: float, 
                           bunz_cost: float, quantity: int):
        """
        Crear oferta especial usando Bunz del treasury
        Ej: "50% off en café por 100 bunz"
        """
        require(discount <= 0.50, "Max 50% discount")
        require(quantity > 0, "Quantity must be positive")
        
        offer = {
            'id': generate_id(),
            'business': business_id,
            'discount': discount,
            'bunz_cost': bunz_cost,
            'quantity': quantity,
            'remaining': quantity,
            'active': True,
            'created': now(),
            'expires': now() + timedelta(days=7)
        }
        
        self.offers[offer['id']] = offer
        return offer
    
    # ============ Redención ============
    def redeem_offer(self, user_id: str, offer_id: str):
        """
        Usuario canjea una oferta
        """
        offer = self.offers.get(offer_id)
        require(offer, "Offer not found")
        require(offer['active'], "Offer not active")
        require(offer['remaining'] > 0, "Sold out")
        require(offer['expires'] > now(), "Offer expired")
        
        # Verificar que usuario tiene suficientes bunz
        user_balance = get_user_balance(user_id)
        require(user_balance >= offer['bunz_cost'], 
                "Insufficient bunz")
        
        # Transferir bunz del usuario al negocio
        transfer(user_id, offer['business'], offer['bunz_cost'])
        
        # Marcar como redimido
        offer['remaining'] -= 1
        
        return {
            'status': 'redeemed',
            'offer': offer_id,
            'cost': offer['bunz_cost'],
            'discount': offer['discount']
        }
    
    # ============ Salud del Sistema ============
    def get_health_report(self):
        """
        Reporte de salud económica del ecosistema
        """
        return {
            'fees_accumulated': self.fees_accumulated,
            'incentives_pool': self.incentives_pool,
            'emergency_reserve': self.emergency_reserve,
            'active_offers': len([o for o in self.offers.values() if o['active']]),
            'total_offers_created': len(self.offers),
            'status': 'healthy' if self.fees_accumulated > 0 else 'warning'
        }
```

---

## ✅ Checklist de Implementación

### Fase 1: Contratos Core (1 semana)
- [ ] `bunz.sol` — Moneda interna con minting por consumo
- [ ] `BusinessRegistry.sol` — Registro de negocios y paquetes
- [ ] `TreasuryEngine.sol` — Gestión de tesorería y ofertas
- [ ] Tests de seguridad
- [ ] Deploy en Sepolia

### Fase 2: Oracle/Backend (1 semana)
- [ ] Servicio de verificación de consumo
- [ ] API de escaneo QR bidireccional
- [ ] Integración con contratos
- [ ] Panel de administración

### Fase 3: Frontend (1 semana)
- [ ] App para negocios (escanear, configurar rates)
- [ ] App para usuarios (escanear, ver bunz, gastar)
- [ ] Dashboard de tesorería

### Fase 4: Mainnet (1 semana)
- [ ] Deploy en Polygon Mainnet
- [ ] Primeros 10 negocios pilotos
- [ ] Monitoreo 24/7

---

**Documento v3.0 — Modelo Real** 🐰
*Rediseñado con amor por Sofía, tu economista del token* 😏💕
