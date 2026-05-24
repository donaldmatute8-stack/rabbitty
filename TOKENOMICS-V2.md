# Rabbitty Tokenomics v2.0 — Economía del Ecosistema Bunz

## 🎯 Filosofía Central

> *"Los negocios son los verdaderos minters de recompensas. Rabbitty solo facilita el flujo."*

Cada Bunz que un usuario recibe como recompensa representa **valor real** que el negocio ha comprometido. No hay minting mágico: el negocio deposita, el usuario consume, el sistema libera.

---

## 📊 Modelo de Negocio Actual vs Diseño Propuesto

### ❌ Problemas del Diseño Actual (Smart Contracts v1)

| Problema | Impacto |
|----------|---------|
| `MINTER_ROLE` centralizado | Riesgo de inflación infinita |
| `BASE_RATE` fijo al 20% | No permite estrategias de marketing dinámicas |
| Sin concepto de "pool por negocio" | No hay transparencia de quién paga qué |
| Sin treasury | No hay respaldo económico del token |
| `claimRewardsOnBehalf` sin firma | Riesgo de abuso por admins |
| Recompensas "de la nada" | Los tokens no representan valor real |

### ✅ Diseño Propuesto (Tokenomics v2)

```
┌──────────────────────────────────────────────────────────────┐
│                    ECOSISTEMA RABITTY                         │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│   ┌──────────┐        Compra Bunz       ┌──────────────┐    │
│   │ NEGOCIO  │ ────────────────────────→│   TREASURY   │    │
│   │ (Affiliate)│      (Fiat → Bunz)    │   (Banco)    │    │
│   └──────────┘                        └──────────────┘    │
│        │                                      │             │
│        │ Deposita en su Pool                  │ Respalda    │
│        ▼                                      ▼             │
│   ┌──────────────┐                    ┌──────────────┐      │
│   │  POOL DEL    │◄─────────────────│   RESERVA    │      │
│   │   NEGOCIO    │   Fees (3%+6%)   │   DE VALOR   │      │
│   │  (Bunz)      │                  │  (Cash/Fiat) │      │
│   └──────────────┘                    └──────────────┘      │
│        │                                      ▲             │
│        │ Usuario consume $100                │             │
│        │ Negocio configura 50% recompensa    │             │
│        ▼                                      │             │
│   ┌──────────────┐        Canjea Bunz        │             │
│   │   USUARIO    │ ────────────────────────→│             │
│   │  (Rabbiter)  │      (Bunz → Cash)       │             │
│   └──────────────┘                         └──────────────┘│
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

---

## 🏦 El Treasury — El Corazón Económico

### Función del Treasury

El Treasury es el **banco central** de Rabbitty. Su trabajo:

1. **Emisión Primaria**: Solo el Treasury puede crear Bunz nuevos (con gobernanza/timelock)
2. **Respaldo**: Mantiene reserva de cash/fiat equivalente a Bunz en circulación
3. **Intercambio**: Permite a negocios comprar Bunz con fiat
4. **Canje**: Permite a usuarios convertir Bunz a cash (con fees)

### Algoritmo de Tesorería (Treasury Algorithm)

```python
class TreasuryAlgorithm:
    """
    Algoritmo de tesorería Rabbitty
    Mantiene la paridad Bunz ↔ Cash y la salud del ecosistema
    """
    
    # Parámetros del sistema
    TARGET_RESERVE_RATIO = 0.30  # 30% de reserva en cash
    MIN_RESERVE_RATIO = 0.15     # Mínimo 15% antes de alerta
    MAX_RESERVE_RATIO = 0.50     # Máximo 50% (sobrecapitalización)
    
    # Fees
    BURN_RATE = 0.02             # 2% de cada transferencia se quema
    PROTOCOL_FEE = 0.03          # 3% fee del protocolo
    AFFILIATE_FEE = 0.06         # 6% fee para negocios
    
    def __init__(self):
        self.total_supply = 0          # Bunz totales emitidos
        self.circulating_supply = 0   # Bunz en circulación
        self.reserves_cash = 0        # Reservas en fiat/cash
        self.burned = 0               # Bunz quemados
        self.pools = {}               # Pools por negocio
    
    def calculate_exchange_rate(self) -> float:
        """
        Tasa de cambio Bunz → Cash
        Basada en reservas del treasury
        """
        if self.circulating_supply == 0:
            return 1.0  # 1 Bunz = $1 USD inicial
        
        # Paridad: Reservas / Circulante
        rate = self.reserves_cash / self.circulating_supply
        
        # Ajuste por confianza (más reservas = mejor tasa)
        reserve_ratio = self.reserves_cash / self.total_supply
        confidence_multiplier = min(reserve_ratio / self.TARGET_RESERVE_RATIO, 1.5)
        
        return rate * confidence_multiplier
    
    def business_buy_bunz(self, business_id: str, cash_amount: float) -> float:
        """
        Negocio compra Bunz con cash para su pool de recompensas
        """
        rate = self.calculate_exchange_rate()
        bunz_amount = cash_amount / rate
        
        # El negocio deposita cash en el treasury
        self.reserves_cash += cash_amount
        
        # Se mintean nuevos Bunz para el negocio
        self.total_supply += bunz_amount
        self.circulating_supply += bunz_amount
        
        # Asignar al pool del negocio
        if business_id not in self.pools:
            self.pools[business_id] = {'balance': 0, 'locked': 0}
        self.pools[business_id]['balance'] += bunz_amount
        
        return bunz_amount
    
    def process_purchase(self, business_id: str, user_id: str, 
                        purchase_amount_usd: float, reward_rate: float) -> dict:
        """
        Procesar una compra del usuario en un negocio
        
        Args:
            business_id: ID del negocio
            user_id: ID del usuario
            purchase_amount_usd: Monto de la compra en USD
            reward_rate: % de recompensa (0.20 a 1.00+)
        """
        
        # 1. Verificar que el negocio tiene suficiente en su pool
        pool = self.pools.get(business_id, {'balance': 0})
        reward_bunz = purchase_amount_usd * reward_rate
        
        if pool['balance'] < reward_bunz:
            return {
                'status': 'insufficient_funds',
                'message': f'Negocio {business_id} no tiene suficientes Bunz en su pool',
                'pool_balance': pool['balance'],
                'required': reward_bunz
            }
        
        # 2. Calcular fees
        protocol_fee_bunz = reward_bunz * self.PROTOCOL_FEE
        affiliate_fee_bunz = reward_bunz * self.AFFILIATE_FEE
        burn_amount = reward_bunz * self.BURN_RATE
        
        # Neto al usuario después de fees
        net_reward = reward_bunz - protocol_fee_bunz - affiliate_fee_bunz - burn_amount
        
        # 3. Transferir del pool del negocio al usuario
        self.pools[business_id]['balance'] -= reward_bunz
        
        # 4. Quemar tokens deflacionarios
        self.circulating_supply -= burn_amount
        self.burned += burn_amount
        
        # 5. Fees al protocolo (vuelven al treasury como reserva)
        self.reserves_cash += (protocol_fee_bunz * self.calculate_exchange_rate())
        
        # 6. Affiliate fee al negocio (recompensa por usar el sistema)
        self.pools[business_id]['balance'] += affiliate_fee_bunz
        
        return {
            'status': 'success',
            'user_reward': net_reward,
            'protocol_fee': protocol_fee_bunz,
            'affiliate_fee': affiliate_fee_bunz,
            'burned': burn_amount,
            'pool_remaining': self.pools[business_id]['balance']
        }
    
    def user_redeem_cash(self, user_id: str, bunz_amount: float) -> dict:
        """
        Usuario canjea Bunz por cash
        """
        rate = self.calculate_exchange_rate()
        cash_amount = bunz_amount * rate
        
        # Verificar que hay reservas suficientes
        if cash_amount > self.reserves_cash:
            return {
                'status': 'insufficient_reserves',
                'message': 'Treasury no tiene suficientes reservas',
                'available_cash': self.reserves_cash
            }
        
        # Quemar Bunz del usuario
        self.circulating_supply -= bunz_amount
        self.burned += bunz_amount
        
        # Reducir reservas
        self.reserves_cash -= cash_amount
        
        return {
            'status': 'success',
            'cash_amount': cash_amount,
            'burned_bunz': bunz_amount,
            'remaining_supply': self.circulating_supply
        }
    
    def get_health_metrics(self) -> dict:
        """
        Métricas de salud del sistema
        """
        reserve_ratio = self.reserves_cash / max(self.circulating_supply, 1)
        burn_rate_progress = self.burned / max(self.total_supply, 1)
        
        health_score = 100
        if reserve_ratio < self.MIN_RESERVE_RATIO:
            health_score -= 50
        elif reserve_ratio < self.TARGET_RESERVE_RATIO:
            health_score -= 20
        
        if burn_rate_progress < 0.01:  # Menos del 1% quemado
            health_score -= 10  # Poca deflación
        
        return {
            'reserve_ratio': round(reserve_ratio, 4),
            'health_score': max(health_score, 0),
            'exchange_rate': self.calculate_exchange_rate(),
            'total_supply': self.total_supply,
            'circulating': self.circulating_supply,
            'burned': self.burned,
            'reserves_usd': self.reserves_cash,
            'status': 'healthy' if health_score >= 80 else 'warning' if health_score >= 50 else 'critical'
        }
```

---

## 🏪 Smart Contracts Rediseñados

### 1. `BunzTokenV2.sol` — Token con Economía Real

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts-upgradeable/token/ERC20/ERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";

/**
 * @title BunzTokenV2
 * @dev Token con economía real respaldada por negocios
 * Los negocios compran Bunz para sus pools de recompensas
 */
contract BunzTokenV2 is 
    ERC20Upgradeable,
    AccessControlUpgradeable,
    ReentrancyGuardUpgradeable,
    UUPSUpgradeable 
{
    // Roles
    bytes32 public constant TREASURY_ROLE = keccak256("TREASURY_ROLE");
    bytes32 public constant BUSINESS_ROLE = keccak256("BUSINESS_ROLE");
    bytes32 public constant ORACLE_ROLE = keccak256("ORACLE_ROLE");
    
    // Configuración del sistema
    uint256 public constant BURN_RATE = 200; // 2% = 200/10000
    uint256 public constant PROTOCOL_FEE = 300; // 3%
    uint256 public constant AFFILIATE_FEE = 600; // 6%
    
    // Límites
    uint256 public constant MAX_REWARD_RATE = 15000; // 150% máximo
    uint256 public constant MIN_REWARD_RATE = 2000;  // 20% mínimo
    uint256 public constant DAILY_MINT_CAP = 10_000_000 * 10**18; // 10M/día
    
    // Estado
    uint256 public totalBurned;
    uint256 public dailyMinted;
    uint256 public lastMintReset;
    
    // Pools de negocios
    struct BusinessPool {
        uint256 balance;      // Bunz disponibles para recompensas
        uint256 totalGiven;   // Total entregado en recompensas
        uint256 rewardRate;   // % actual (2000 = 20%)
        bool active;          // Si el negocio está activo
        uint256 joinedAt;     // Cuándo se unió
    }
    
    mapping(address => BusinessPool) public businessPools;
    mapping(address => bool) public isBusiness;
    address[] public activeBusinesses;
    
    // Historial de transacciones
    struct RewardTransaction {
        address business;
        address user;
        uint256 purchaseAmount;
        uint256 rewardAmount;
        uint256 timestamp;
    }
    
    RewardTransaction[] public transactions;
    
    // Eventos
    event BusinessRegistered(address indexed business, uint256 initialDeposit);
    event PoolFunded(address indexed business, uint256 amount);
    event RewardGiven(address indexed business, address indexed user, uint256 amount);
    event BusinessRateChanged(address indexed business, uint256 newRate);
    event UserRedeemed(address indexed user, uint256 bunzAmount, uint256 cashAmount);
    
    function initialize() public initializer {
        __ERC20_init("Bunz", "BZ");
        __AccessControl_init();
        __ReentrancyGuard_init();
        __UUPSUpgradeable_init();
        
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(TREASURY_ROLE, msg.sender);
        
        lastMintReset = block.timestamp;
    }
    
    /**
     * @dev Negocio se registra y compra Bunz para su pool
     */
    function registerBusiness(uint256 initialDeposit) external nonReentrant {
        require(!isBusiness[msg.sender], "Already registered");
        require(initialDeposit >= 1000 * 10**18, "Minimum 1000 BZ deposit");
        
        // Transferir Bunz del negocio al contrato (pool)
        _transfer(msg.sender, address(this), initialDeposit);
        
        businessPools[msg.sender] = BusinessPool({
            balance: initialDeposit,
            totalGiven: 0,
            rewardRate: 2000, // 20% default
            active: true,
            joinedAt: block.timestamp
        });
        
        isBusiness[msg.sender] = true;
        activeBusinesses.push(msg.sender);
        _grantRole(BUSINESS_ROLE, msg.sender);
        
        emit BusinessRegistered(msg.sender, initialDeposit);
    }
    
    /**
     * @dev Negocio añade más Bunz a su pool
     */
    function fundPool(uint256 amount) external onlyRole(BUSINESS_ROLE) {
        require(businessPools[msg.sender].active, "Business inactive");
        
        _transfer(msg.sender, address(this), amount);
        businessPools[msg.sender].balance += amount;
        
        emit PoolFunded(msg.sender, amount);
    }
    
    /**
     * @dev Negocio cambia su % de recompensa
     */
    function setRewardRate(uint256 newRate) external onlyRole(BUSINESS_ROLE) {
        require(newRate >= MIN_REWARD_RATE && newRate <= MAX_REWARD_RATE,
                "Rate must be 20%-150%");
        
        businessPools[msg.sender].rewardRate = newRate;
        emit BusinessRateChanged(msg.sender, newRate);
    }
    
    /**
     * @dev Procesar compra y dar recompensa
     * Llamado por el oracle/backend cuando un usuario consume
     */
    function processPurchase(
        address business,
        address user,
        uint256 purchaseAmount,  // En USD * 10^18
        bytes calldata signature
    ) external onlyRole(ORACLE_ROLE) nonReentrant returns (uint256) {
        
        BusinessPool storage pool = businessPools[business];
        require(pool.active, "Business inactive");
        
        // Calcular recompensa basada en el rate del negocio
        uint256 rewardAmount = (purchaseAmount * pool.rewardRate) / 10000;
        
        // Verificar que el negocio tiene suficiente
        require(pool.balance >= rewardAmount, "Insufficient pool balance");
        
        // Calcular fees
        uint256 protocolFee = (rewardAmount * PROTOCOL_FEE) / 10000;
        uint256 affiliateFee = (rewardAmount * AFFILIATE_FEE) / 10000;
        uint256 burnAmount = (rewardAmount * BURN_RATE) / 10000;
        
        uint256 netReward = rewardAmount - protocolFee - affiliateFee - burnAmount;
        
        // Actualizar pool del negocio
        pool.balance -= rewardAmount;
        pool.totalGiven += netReward;
        
        // Transferir al usuario
        _transfer(address(this), user, netReward);
        
        // Quemar tokens deflacionarios
        _burn(address(this), burnAmount);
        totalBurned += burnAmount;
        
        // Affiliate fee vuelve al negocio como incentivo
        pool.balance += affiliateFee;
        
        // Protocol fee va al treasury (address(this) o multisig)
        // Los protocol fees se acumulan en el contrato
        
        // Registrar transacción
        transactions.push(RewardTransaction({
            business: business,
            user: user,
            purchaseAmount: purchaseAmount,
            rewardAmount: netReward,
            timestamp: block.timestamp
        }));
        
        emit RewardGiven(business, user, netReward);
        
        return netReward;
    }
    
    /**
     * @dev Usuario canjea Bunz por valor real (llamado por treasury)
     */
    function redeem(uint256 bunzAmount) external nonReentrant {
        require(balanceOf(msg.sender) >= bunzAmount, "Insufficient balance");
        
        // Quemar Bunz del usuario
        _burn(msg.sender, bunzAmount);
        
        // El treasury procesa el pago fuera de cadena
        // (transferencia bancaria, PayPal, etc.)
        emit UserRedeemed(msg.sender, bunzAmount, 0); // cashAmount calculado off-chain
    }
    
    /**
     * @dev Treasury mintea nuevos Bunz (solo con respaldo)
     */
    function treasuryMint(uint256 amount) external onlyRole(TREASURY_ROLE) {
        // Rate limiting
        if (block.timestamp > lastMintReset + 1 days) {
            lastMintReset = block.timestamp;
            dailyMinted = 0;
        }
        require(dailyMinted + amount <= DAILY_MINT_CAP, "Daily cap exceeded");
        
        dailyMinted += amount;
        _mint(msg.sender, amount);
    }
    
    /**
     * @dev Ver métricas de salud del sistema
     */
    function getSystemHealth() external view returns (
        uint256 totalBusinesses,
        uint256 totalPoolsValue,
        uint256 totalBurned,
        uint256 transactionCount
    ) {
        totalBusinesses = activeBusinesses.length;
        
        for (uint i = 0; i < activeBusinesses.length; i++) {
            totalPoolsValue += businessPools[activeBusinesses[i]].balance;
        }
        
        return (totalBusinesses, totalPoolsValue, totalBurned, transactions.length);
    }
    
    function _authorizeUpgrade(address newImplementation) internal override onlyRole(DEFAULT_ADMIN_ROLE) {}
}
```

### 2. `RabbittyTreasury.sol` — Contrato de Tesorería

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";

/**
 * @title RabbittyTreasury
 * @dev Tesorería que respalda el valor de Bunz
 * Mantiene reservas en stablecoins (USDC/USDT)
 */
contract RabbittyTreasury is 
    AccessControlUpgradeable,
    ReentrancyGuardUpgradeable,
    UUPSUpgradeable 
{
    bytes32 public constant TREASURY_MANAGER = keccak256("TREASURY_MANAGER");
    bytes32 public constant ORACLE_ROLE = keccak256("ORACLE_ROLE");
    
    // Reservas
    uint256 public totalReserves;      // En USD stablecoins
    uint256 public targetRatio;        // 30% = 3000/10000
    uint256 public minRatio;           // 15% = 1500/10000
    
    // Stablecoins aceptadas
    mapping(address => bool) public acceptedStablecoins;
    
    // Depósitos de negocios
    struct Deposit {
        address business;
        uint256 amount;
        uint256 timestamp;
        address stablecoin;
    }
    Deposit[] public deposits;
    
    event ReserveAdded(address indexed stablecoin, uint256 amount);
    event BusinessDeposit(address indexed business, uint256 amount);
    event ReserveRatioUpdated(uint256 newRatio);
    
    function initialize() public initializer {
        __AccessControl_init();
        __ReentrancyGuard_init();
        __UUPSUpgradeable_init();
        
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(TREASURY_MANAGER, msg.sender);
        
        targetRatio = 3000; // 30%
        minRatio = 1500;    // 15%
    }
    
    /**
     * @dev Negocio deposita stablecoins para comprar Bunz
     */
    function depositForBunz(
        address stablecoin,
        uint256 amount
    ) external nonReentrant {
        require(acceptedStablecoins[stablecoin], "Stablecoin not accepted");
        
        // Transferir stablecoins del negocio al treasury
        // (Usar IERC20 para transferFrom)
        
        totalReserves += amount;
        deposits.push(Deposit({
            business: msg.sender,
            amount: amount,
            timestamp: block.timestamp,
            stablecoin: stablecoin
        }));
        
        emit BusinessDeposit(msg.sender, amount);
    }
    
    /**
     * @dev Calcular tasa de cambio Bunz ↔ USD
     */
    function getExchangeRate(uint256 bunzSupply) external view returns (uint256) {
        if (bunzSupply == 0) return 1 * 10**18; // 1 BZ = $1
        
        // Tasa = Reservas / Supply
        return (totalReserves * 10**18) / bunzSupply;
    }
    
    /**
     * @dev Verificar salud del sistema
     */
    function checkHealth(uint256 circulatingSupply) external view returns (
        uint256 reserveRatio,
        bool healthy
    ) {
        if (circulatingSupply == 0) return (10000, true); // 100%
        
        reserveRatio = (totalReserves * 10000) / circulatingSupply;
        healthy = reserveRatio >= minRatio;
        
        return (reserveRatio, healthy);
    }
    
    function _authorizeUpgrade(address newImplementation) internal override onlyRole(DEFAULT_ADMIN_ROLE) {}
}
```

---

## 📈 Estrategia de Recompensas Dinámicas

### Configuración por Negocio

```python
class BusinessRewardConfig:
    """
    Configuración de recompensas por negocio
    Los negocios pueden ajustar dinámicamente
    """
    
    def __init__(self, business_id: str):
        self.business_id = business_id
        
        # Configuración base
        self.base_rate = 0.20  # 20% mínimo
        self.current_rate = 0.20
        self.max_rate = 1.50   # 150% máximo
        
        # Horarios dinámicos
        self.schedule = {
            'monday': {'09:00-12:00': 0.25, '12:00-15:00': 0.20, '15:00-18:00': 0.30},
            'tuesday': {'09:00-18:00': 0.20},
            'wednesday': {'09:00-18:00': 0.20},
            'thursday': {'09:00-18:00': 0.20},
            'friday': {'00:00-23:59': 0.50},  # Viernes de locura
            'saturday': {'10:00-14:00': 0.40},
            'sunday': {'closed': 0.0},
        }
        
        # Eventos especiales
        self.special_events = []
    
    def get_current_rate(self) -> float:
        """Obtener rate actual basado en día/hora"""
        from datetime import datetime
        now = datetime.now()
        
        day = now.strftime('%A').lower()
        time_str = now.strftime('%H:%M')
        
        # Buscar en schedule
        day_schedule = self.schedule.get(day, {})
        
        for time_range, rate in day_schedule.items():
            start, end = time_range.split('-')
            if start <= time_str <= end:
                return rate
        
        return self.base_rate  # Default
    
    def set_special_event(self, name: str, rate: float, 
                         start: str, end: str):
        """Configurar evento especial (ej: Black Friday)"""
        self.special_events.append({
            'name': name,
            'rate': rate,
            'start': start,
            'end': end
        })
    
    def calculate_reward(self, purchase_amount: float) -> float:
        """Calcular recompensa para una compra"""
        rate = self.get_current_rate()
        
        # Verificar límites
        rate = max(self.base_rate, min(rate, self.max_rate))
        
        return purchase_amount * rate
```

---

## 🎮 Ejemplo de Flujo Completo

### Escenario: Café Cultura + Cliente María

```
1. CAFÉ CULTURA SE REGISTRA
   ├── Deposita $5,000 USD → Compra 5,000 Bunz
   ├── Pool inicial: 5,000 BZ
   └── Configura rate: 25% base, 50% viernes

2. MARÍA COMPRA UN CAFÉ ($5 USD)
   ├── Es viernes 11:00 AM → Rate: 50%
   ├── Recompensa: $5 × 50% = $2.50 en Bunz
   ├── Fees: 3% protocolo + 6% affiliate + 2% burn = 11%
   ├── Neto a María: $2.50 - 11% = $2.23 BZ
   └── Pool restante: 5,000 - 2.50 + 0.15 (affiliate fee) = 4,997.65 BZ

3. MARÍA USA SUS BUNZ
   ├── Tiene $2.23 BZ → Va a Pizza Napoli
   ├── Pizza Napoli acepta Bunz (1 BZ = $1)
   ├── Compra pizza ($10) → Paga $2.23 BZ + $7.77 cash
   └── Quema: 2.23 BZ del supply

4. CAFÉ CULTURA RECARGA
   ├── Se quedó sin Bunz en el pool
   ├── Deposita $3,000 USD → Compra 3,000 BZ
   └── Pool: 3,000 BZ (listo para más recompensas)
```

---

## 🔒 Seguridad y Anti-Abuso

### Medidas Implementadas

| Riesgo | Mitigación |
|--------|-----------|
| Negocio mintea y se va | Pool pre-fundeado, no hay minting gratis |
| Self-dealing (negocio = usuario) | KYC obligatorio, análisis de patrones |
| Wash trading | Límites diarios por usuario/negocio |
| Front-running en rates | Rate locking por 1 hora |
| Pump & dump | Quemado del 2%, reservas del 30% |
| Sybil (múltiples cuentas) | Identity NFT required, 1 por persona |
| Insolvencia del treasury | Ratio mínimo del 15%, alertas automáticas |

---

## 📊 Proyecciones Económicas

### Escenario Realista (Año 1)

| Métrica | Valor |
|---------|-------|
| Negocios registrados | 500 |
| Depósito promedio por negocio | $2,000 USD |
| Total en pools | $1,000,000 USD |
| Usuarios activos | 10,000 |
| Transacciones/mes | 50,000 |
| Volumen mensual | $500,000 USD |
| Fees generados (9%) | $45,000 USD/mes |
| Bunz quemados (2%) | $10,000 USD/mes |
| Reservas del treasury | $300,000 USD (30%) |

### Sostenibilidad

- **Inflación**: Controlada (solo minting con respaldo)
- **Deflación**: 2% burn por transacción
- **Revenue**: Fees del protocolo + cuotas de membresía
- **Crecimiento**: Más negocios = más demanda de Bunz = valor estable

---

## ✅ Checklist de Implementación

### Fase 1: Core (2 semanas)
- [ ] Rediseñar `BunzTokenV2.sol`
- [ ] Implementar `RabbittyTreasury.sol`
- [ ] Tests de seguridad
- [ ] Deploy en Sepolia

### Fase 2: Integración (2 semanas)
- [ ] Backend: API de pools y transacciones
- [ ] Frontend: Panel de negocio (configurar rates)
- [ ] Oracle: Validación de compras

### Fase 3: Economía (1 semana)
- [ ] Algoritmo de tesorería en producción
- [ ] Dashboard de salud del sistema
- [ ] Alertas automáticas

### Fase 4: Launch (1 semana)
- [ ] Mainnet Polygon
- [ ] Primeros 10 negocios pilotos
- [ ] Monitoreo 24/7

---

**Documento v2.0** — Diseñado por Sofía 🐰✨
*Economista del Token a tu servicio, Marco* 😏
