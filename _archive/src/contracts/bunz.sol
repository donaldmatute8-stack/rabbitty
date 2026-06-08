// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts-upgradeable/token/ERC20/ERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";

/**
 * @title bunz
 * @dev Moneda interna de Rabbitty — Sistema de recompensas por consumo
 * 
 * REGLAS:
 * - Los negocios mintean bunz cuando hay consumo verificado
 * - Cada negocio tiene un "crédito de minting" limitado
 * - 1 bunz = 1 unidad monetaria local (fijo, no variable)
 * - NO hay quema, NO hay conversión a cash
 * - Fees: 6% al recompensar, 3% al gastar
 * - Todo es interno al ecosistema Rabbitty
 */
contract bunz is 
    ERC20Upgradeable,
    AccessControlUpgradeable,
    ReentrancyGuardUpgradeable,
    PausableUpgradeable,
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
    
    // Fees (en bunz)
    uint256 public constant REWARD_FEE = 600;    // 6% cuando negocio recompensa
    uint256 public constant SPEND_FEE = 300;     // 3% cuando usuario gasta
    
    // Límites de recompensa
    uint256 public constant MIN_REWARD_RATE = 1000;  // 10% mínimo
    uint256 public constant MAX_REWARD_RATE = 20000; // 200% máximo

    // ============ Estado ============
    uint256 public totalMintedByBusinesses;
    uint256 public totalFeesCollected;
    address public treasuryAddress;              // Dirección de la tesorería
    
    // ============ Negocios ============
    struct Business {
        uint256 creditLimit;      // Crédito máximo de minting
        uint256 creditUsed;       // Crédito ya usado
        uint256 rewardRate;       // % de recompensa actual
        bool active;              // Si está activo
        string businessType;      // Tipo de negocio
        uint256 joinedAt;         // Fecha de registro
    }
    
    mapping(address => Business) public businesses;
    mapping(address => bool) public isRegistered;
    address[] public activeBusinesses;
    
    // ============ Transacciones ============
    struct Transaction {
        address business;
        address user;
        uint256 purchaseAmount;   // En moneda local
        uint256 rewardAmount;     // En bunz
        uint256 feeAmount;        // Fee cobrado
        uint256 timestamp;
        bytes32 receiptHash;      // Hash único
    }
    
    Transaction[] public transactions;
    mapping(bytes32 => bool) public receiptUsed;
    
    // ============ Rate Limiting ============
    mapping(address => uint256) public dailyMinted;
    mapping(address => uint256) public lastMintReset;
    uint256 public constant DAILY_MINT_LIMIT = 50_000 * 10**18; // $50K/día

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
        uint256 feeAmount,
        bytes32 receiptHash
    );
    event BusinessRateChanged(address indexed business, uint256 newRate);
    event CreditIncreased(address indexed business, uint256 newLimit);
    event BunzSpent(
        address indexed user,
        address indexed business,
        uint256 amount,
        uint256 feeAmount
    );
    event TreasuryAddressChanged(address newTreasury);

    // ============ Modifiers ============
    modifier onlyBusiness() {
        require(isRegistered[msg.sender], "Not a registered business");
        _;
    }

    // ============ Initialize ============
    function initialize(address _treasury) public initializer {
        __ERC20_init(NAME, SYMBOL);
        __AccessControl_init();
        __ReentrancyGuard_init();
        __Pausable_init();
        __UUPSUpgradeable_init();

        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(ORACLE_ROLE, msg.sender);
        _grantRole(TREASURY_ROLE, msg.sender);
        _grantRole(PAUSER_ROLE, msg.sender);
        _grantRole(UPGRADER_ROLE, msg.sender);

        treasuryAddress = _treasury;
    }

    // ============ Registro de Negocios ============
    function registerBusiness(
        address business,
        uint256 creditLimit,
        string calldata businessType,
        uint256 initialRate
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(!isRegistered[business], "Business already registered");
        require(initialRate >= MIN_REWARD_RATE && initialRate <= MAX_REWARD_RATE, 
                "Rate must be 10%-200%");
        require(treasuryAddress != address(0), "Treasury not set");
        
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
        
        // Reset diario si es necesario
        if (block.timestamp > lastMintReset[business] + 1 days) {
            dailyMinted[business] = 0;
            lastMintReset[business] = block.timestamp;
        }
        
        // Calcular recompensa
        uint256 rewardAmount = (purchaseAmount * b.rewardRate) / 10000;
        
        // Calcular fee (6% al recompensar)
        uint256 fee = (rewardAmount * REWARD_FEE) / 10000;
        uint256 netReward = rewardAmount - fee;
        
        // Verificar límites
        require(b.creditUsed + rewardAmount <= b.creditLimit, 
                "Credit limit exceeded");
        require(dailyMinted[business] + rewardAmount <= DAILY_MINT_LIMIT,
                "Daily mint limit exceeded");
        
        // Actualizar crédito
        b.creditUsed += rewardAmount;
        dailyMinted[business] += rewardAmount;
        
        // Marcar recibo
        receiptUsed[receiptHash] = true;
        
        // Mintear al usuario (neto después de fee)
        _mint(user, netReward);
        
        // Mintear fee a tesorería
        _mint(treasuryAddress, fee);
        totalFeesCollected += fee;
        
        totalMintedByBusinesses += rewardAmount;
        
        // Registrar transacción
        transactions.push(Transaction({
            business: business,
            user: user,
            purchaseAmount: purchaseAmount,
            rewardAmount: netReward,
            feeAmount: fee,
            timestamp: block.timestamp,
            receiptHash: receiptHash
        }));
        
        emit RewardMinted(business, user, purchaseAmount, netReward, fee, receiptHash);
    }

    // ============ Gestión de Negocios ============
    function setRewardRate(uint256 newRate) external onlyBusiness {
        require(newRate >= MIN_REWARD_RATE && newRate <= MAX_REWARD_RATE,
                "Rate must be 10%-200%");
        businesses[msg.sender].rewardRate = newRate;
        emit BusinessRateChanged(msg.sender, newRate);
    }

    function increaseCredit(
        address business, 
        uint256 additionalCredit
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(isRegistered[business], "Business not registered");
        businesses[business].creditLimit += additionalCredit;
        emit CreditIncreased(business, businesses[business].creditLimit);
    }

    function deactivateBusiness(address business) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(isRegistered[business], "Business not registered");
        businesses[business].active = false;
    }

    // ============ Gastar Bunz ============
    function spendBunz(
        address business,
        uint256 amount
    ) external nonReentrant {
        require(isRegistered[business], "Business not registered");
        require(businesses[business].active, "Business inactive");
        require(balanceOf(msg.sender) >= amount, "Insufficient balance");
        require(amount >= 10**18, "Minimum 1 bunz");
        
        // Calcular fee (3% al gastar)
        uint256 fee = (amount * SPEND_FEE) / 10000;
        uint256 netToBusiness = amount - fee;
        
        // Transferir neto al negocio
        _transfer(msg.sender, business, netToBusiness);
        
        // Transferir fee a tesorería
        _transfer(msg.sender, treasuryAddress, fee);
        totalFeesCollected += fee;
        
        emit BunzSpent(msg.sender, business, amount, fee);
    }

    // ============ Treasury Management ============
    function setTreasuryAddress(address newTreasury) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(newTreasury != address(0), "Invalid address");
        treasuryAddress = newTreasury;
        emit TreasuryAddressChanged(newTreasury);
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
            return DAILY_MINT_LIMIT;
        }
        return DAILY_MINT_LIMIT - dailyMinted[business];
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
        override(ERC20Upgradeable, PausableUpgradeable)
    {
        super._beforeTokenTransfer(from, to, amount);
    }

    function _authorizeUpgrade(address newImplementation) internal override onlyRole(UPGRADER_ROLE) {}
}
