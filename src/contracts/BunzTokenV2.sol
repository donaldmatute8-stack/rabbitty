// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts-upgradeable/token/ERC20/ERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/extensions/ERC20BurnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/extensions/ERC20PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

/**
 * @title BunzTokenV2
 * @dev Token con economía real respaldada por negocios
 * Los negocios compran Bunz para sus pools de recompensas
 * 
 * Modelo:
 * - Negocios depositan Bunz en pools para dar recompensas
 * - Usuarios consumen y reciben Bunz del pool del negocio
 * - Fees: 3% protocolo, 6% affiliate, 2% burn
 * - Minting solo por TREASURY con rate limits diarios
 */
contract BunzTokenV2 is 
    ERC20Upgradeable,
    ERC20BurnableUpgradeable,
    ERC20PausableUpgradeable,
    AccessControlUpgradeable,
    ReentrancyGuardUpgradeable,
    UUPSUpgradeable 
{
    using ECDSA for bytes32;

    // ============ Roles ============
    bytes32 public constant TREASURY_ROLE = keccak256("TREASURY_ROLE");
    bytes32 public constant BUSINESS_ROLE = keccak256("BUSINESS_ROLE");
    bytes32 public constant ORACLE_ROLE = keccak256("ORACLE_ROLE");
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");
    bytes32 public constant UPGRADER_ROLE = keccak256("UPGRADER_ROLE");

    // ============ Token Info ============
    string public constant NAME = "Bunz";
    string public constant SYMBOL = "BZ";
    uint8 public constant DECIMALS = 18;
    
    // ============ Supply Limits ============
    uint256 public constant MAX_SUPPLY = 1_000_000_000 * 10**18; // 1B max
    uint256 public constant DAILY_MINT_CAP = 10_000_000 * 10**18; // 10M/día
    
    // ============ Fee Rates ============
    uint256 public constant BURN_RATE = 200;           // 2% = 200/10000
    uint256 public constant PROTOCOL_FEE = 300;        // 3%
    uint256 public constant AFFILIATE_FEE = 600;       // 6%
    
    // ============ Reward Limits ============
    uint256 public constant MAX_REWARD_RATE = 15000;   // 150% máximo
    uint256 public constant MIN_REWARD_RATE = 2000;    // 20% mínimo
    
    // ============ Anti-Abuse ============
    uint256 public constant MAX_DAILY_REWARDS_PER_USER = 5000 * 10**18; // 5000 BZ/día
    uint256 public constant MAX_TRANSACTIONS_PER_HOUR = 100; // por negocio

    // ============ State ============
    uint256 public totalBurned;
    uint256 public dailyMinted;
    uint256 public lastMintReset;
    
    // EIP-712 Domain Separator
    bytes32 public DOMAIN_SEPARATOR;
    bytes32 public constant CLAIM_TYPEHASH = keccak256(
        "Claim(address user,uint256 amount,uint256 affiliateId,bytes32 receiptHash,uint256 chainId,address contract)"
    );

    // ============ Business Pools ============
    struct BusinessPool {
        uint256 balance;        // Bunz disponibles para recompensas
        uint256 totalGiven;     // Total entregado en recompensas
        uint256 rewardRate;     // % actual (2000 = 20%)
        bool active;            // Si el negocio está activo
        uint256 joinedAt;       // Cuándo se unió
        uint256 lastUpdated;    // Última actualización
    }

    mapping(address => BusinessPool) public businessPools;
    mapping(address => bool) public isBusiness;
    mapping(address => uint256) public businessIndex;
    address[] public activeBusinesses;
    
    // ============ User Tracking ============
    mapping(address => uint256) public dailyRewardsClaimed;
    mapping(address => uint256) public lastRewardReset;
    mapping(address => uint256) public hourlyTransactionCount;
    mapping(address => uint256) public lastHourReset;

    // ============ Transactions ============
    struct RewardTransaction {
        address business;
        address user;
        uint256 purchaseAmount;
        uint256 rewardAmount;
        uint256 timestamp;
    }

    RewardTransaction[] public transactions;
    mapping(bytes32 => bool) public receiptUsed;
    
    // ============ Oracles ============
    mapping(address => bool) public isClaimSigner;

    // ============ Events ============
    event BusinessRegistered(address indexed business, uint256 initialDeposit, uint256 rewardRate);
    event PoolFunded(address indexed business, uint256 amount);
    event PoolWithdrawn(address indexed business, uint256 amount);
    event RewardGiven(
        address indexed business, 
        address indexed user, 
        uint256 purchaseAmount,
        uint256 rewardAmount,
        uint256 protocolFee,
        uint256 affiliateFee,
        uint256 burnAmount
    );
    event BusinessRateChanged(address indexed business, uint256 newRate);
    event BusinessDeactivated(address indexed business);
    event UserRedeemed(address indexed user, uint256 bunzAmount);
    event DailyMintReset(uint256 timestamp);
    event ClaimSignerUpdated(address indexed signer, bool authorized);

    // ============ Modifiers ============
    modifier validRewardRate(uint256 rate) {
        require(rate >= MIN_REWARD_RATE && rate <= MAX_REWARD_RATE, 
                "Rate must be 20%-150%");
        _;
    }

    modifier onlyBusiness() {
        require(isBusiness[msg.sender], "Not a registered business");
        _;
    }

    // ============ Initialize ============
    function initialize() public initializer {
        __ERC20_init(NAME, SYMBOL);
        __ERC20Burnable_init();
        __ERC20Pausable_init();
        __AccessControl_init();
        __ReentrancyGuard_init();
        __UUPSUpgradeable_init();

        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(TREASURY_ROLE, msg.sender);
        _grantRole(ORACLE_ROLE, msg.sender);
        _grantRole(PAUSER_ROLE, msg.sender);
        _grantRole(UPGRADER_ROLE, msg.sender);

        // EIP-712 Domain Separator
        DOMAIN_SEPARATOR = keccak256(abi.encode(
            keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"),
            keccak256(bytes(NAME)),
            keccak256(bytes("1")),
            block.chainid,
            address(this)
        ));

        lastMintReset = block.timestamp;
        
        // Mint initial supply to treasury (0.5% for initial liquidity)
        _mint(msg.sender, 5_000_000 * 10**18); // 5M tokens
    }

    // ============ Business Registration ============
    /**
     * @dev Negocio se registra depositando Bunz iniciales
     * @param initialDeposit Cantidad mínima de Bunz para activar
     * @param rewardRate Porcentaje de recompensa inicial (2000-15000 = 20%-150%)
     */
    function registerBusiness(
        uint256 initialDeposit, 
        uint256 rewardRate
    ) external nonReentrant validRewardRate(rewardRate) {
        require(!isBusiness[msg.sender], "Already registered");
        require(initialDeposit >= 1000 * 10**18, "Minimum 1000 BZ deposit");
        require(balanceOf(msg.sender) >= initialDeposit, "Insufficient BZ balance");

        // Transferir Bunz del negocio al contrato (pool)
        _transfer(msg.sender, address(this), initialDeposit);

        businessPools[msg.sender] = BusinessPool({
            balance: initialDeposit,
            totalGiven: 0,
            rewardRate: rewardRate,
            active: true,
            joinedAt: block.timestamp,
            lastUpdated: block.timestamp
        });

        isBusiness[msg.sender] = true;
        businessIndex[msg.sender] = activeBusinesses.length;
        activeBusinesses.push(msg.sender);
        _grantRole(BUSINESS_ROLE, msg.sender);

        emit BusinessRegistered(msg.sender, initialDeposit, rewardRate);
    }

    // ============ Pool Management ============
    /**
     * @dev Negocio añade más Bunz a su pool
     */
    function fundPool(uint256 amount) external onlyBusiness {
        require(businessPools[msg.sender].active, "Business inactive");
        require(balanceOf(msg.sender) >= amount, "Insufficient balance");
        
        _transfer(msg.sender, address(this), amount);
        businessPools[msg.sender].balance += amount;
        businessPools[msg.sender].lastUpdated = block.timestamp;

        emit PoolFunded(msg.sender, amount);
    }

    /**
     * @dev Negocio retira Bunz de su pool (solo si tiene saldo)
     */
    function withdrawFromPool(uint256 amount) external onlyBusiness nonReentrant {
        BusinessPool storage pool = businessPools[msg.sender];
        require(pool.active, "Business inactive");
        require(pool.balance >= amount, "Insufficient pool balance");
        
        // No permitir retirar más del 50% del pool en 24h
        require(
            amount <= pool.balance / 2, 
            "Cannot withdraw more than 50% at once"
        );
        
        pool.balance -= amount;
        pool.lastUpdated = block.timestamp;
        
        // Transferir de vuelta al negocio
        _transfer(address(this), msg.sender, amount);

        emit PoolWithdrawn(msg.sender, amount);
    }

    /**
     * @dev Negocio cambia su porcentaje de recompensa
     */
    function setRewardRate(uint256 newRate) external onlyBusiness validRewardRate(newRate) {
        businessPools[msg.sender].rewardRate = newRate;
        businessPools[msg.sender].lastUpdated = block.timestamp;
        
        emit BusinessRateChanged(msg.sender, newRate);
    }

    /**
     * @dev Admin desactiva un negocio
     */
    function deactivateBusiness(address business) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(isBusiness[business], "Not a business");
        businessPools[business].active = false;
        
        emit BusinessDeactivated(business);
    }

    // ============ Reward Distribution ============
    /**
     * @dev Procesar compra y dar recompensa al usuario
     * @param business Dirección del negocio
     * @param user Dirección del usuario
     * @param purchaseAmount Monto de la compra en USD * 10^18
     * @param receiptHash Hash único del recibo (anti-replay)
     * @param signature Firma EIP-712 del oracle
     */
    function processPurchase(
        address business,
        address user,
        uint256 purchaseAmount,
        bytes32 receiptHash,
        bytes calldata signature
    ) external onlyRole(ORACLE_ROLE) nonReentrant returns (uint256) {
        
        require(!receiptUsed[receiptHash], "Receipt already used");
        require(business != address(0) && user != address(0), "Invalid addresses");
        require(isBusiness[business], "Not a registered business");
        
        BusinessPool storage pool = businessPools[business];
        require(pool.active, "Business inactive");

        // Verificar firma EIP-712
        bytes32 structHash = keccak256(abi.encode(
            CLAIM_TYPEHASH,
            user,
            purchaseAmount,
            0, // affiliateId (deprecated, usamos business directo)
            receiptHash,
            block.chainid,
            address(this)
        ));
        
        bytes32 hash = keccak256(abi.encodePacked("\x19\x01", DOMAIN_SEPARATOR, structHash));
        address signer = hash.recover(signature);
        require(isClaimSigner[signer], "Invalid signature");

        // Marcar recibo como usado
        receiptUsed[receiptHash] = true;

        // Verificar rate limits del negocio
        if (block.timestamp > lastHourReset[business] + 1 hours) {
            hourlyTransactionCount[business] = 0;
            lastHourReset[business] = block.timestamp;
        }
        require(hourlyTransactionCount[business] < MAX_TRANSACTIONS_PER_HOUR, "Hourly limit exceeded");
        hourlyTransactionCount[business]++;

        // Verificar daily limit del usuario
        if (block.timestamp > lastRewardReset[user] + 1 days) {
            dailyRewardsClaimed[user] = 0;
            lastRewardReset[user] = block.timestamp;
        }

        // Calcular recompensa basada en rate del negocio
        uint256 rewardAmount = (purchaseAmount * pool.rewardRate) / 10000;
        
        require(pool.balance >= rewardAmount, "Insufficient pool balance");
        require(
            dailyRewardsClaimed[user] + rewardAmount <= MAX_DAILY_REWARDS_PER_USER,
            "User daily limit exceeded"
        );

        // Calcular fees
        uint256 protocolFee = (rewardAmount * PROTOCOL_FEE) / 10000;
        uint256 affiliateFee = (rewardAmount * AFFILIATE_FEE) / 10000;
        uint256 burnAmount = (rewardAmount * BURN_RATE) / 10000;
        
        uint256 netReward = rewardAmount - protocolFee - affiliateFee - burnAmount;

        // Actualizar estado
        pool.balance -= rewardAmount;
        pool.totalGiven += netReward;
        pool.lastUpdated = block.timestamp;
        dailyRewardsClaimed[user] += rewardAmount;

        // Transferir al usuario
        _transfer(address(this), user, netReward);

        // Quemar tokens (deflacionario)
        _burn(address(this), burnAmount);
        totalBurned += burnAmount;

        // Affiliate fee vuelve al pool del negocio como incentivo
        pool.balance += affiliateFee;

        // Protocol fee se queda en el contrato (treasury)
        // (Los tokens ya están en address(this))

        // Registrar transacción
        transactions.push(RewardTransaction({
            business: business,
            user: user,
            purchaseAmount: purchaseAmount,
            rewardAmount: netReward,
            timestamp: block.timestamp
        }));

        emit RewardGiven(
            business, 
            user, 
            purchaseAmount,
            netReward,
            protocolFee,
            affiliateFee,
            burnAmount
        );

        return netReward;
    }

    // ============ Redemption ============
    /**
     * @dev Usuario canjea Bunz (quema tokens, el treasury paga off-chain)
     */
    function redeem(uint256 bunzAmount) external nonReentrant {
        require(balanceOf(msg.sender) >= bunzAmount, "Insufficient balance");
        require(bunzAmount >= 100 * 10**18, "Minimum 100 BZ"); // Mínimo $100

        // Quemar Bunz del usuario
        _burn(msg.sender, bunzAmount);
        totalBurned += bunzAmount;

        emit UserRedeemed(msg.sender, bunzAmount);
    }

    // ============ Treasury Minting (with constraints) ============
    /**
     * @dev Treasury mintea nuevos Bunz SOLO con respaldo
     * Rate limited diariamente
     */
    function treasuryMint(uint256 amount) external onlyRole(TREASURY_ROLE) {
        require(totalSupply() + amount <= MAX_SUPPLY, "Max supply exceeded");
        
        // Reset diario
        if (block.timestamp > lastMintReset + 1 days) {
            lastMintReset = block.timestamp;
            dailyMinted = 0;
            emit DailyMintReset(block.timestamp);
        }
        
        require(dailyMinted + amount <= DAILY_MINT_CAP, "Daily cap exceeded");
        
        dailyMinted += amount;
        _mint(msg.sender, amount);
    }

    // ============ Claim Signer Management ============
    /**
     * @dev Admin gestiona oracles firmantes
     */
    function setClaimSigner(address signer, bool authorized) external onlyRole(DEFAULT_ADMIN_ROLE) {
        isClaimSigner[signer] = authorized;
        emit ClaimSignerUpdated(signer, authorized);
    }

    // ============ Pausable ============
    function pause() external onlyRole(PAUSER_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(PAUSER_ROLE) {
        _unpause();
    }

    // ============ View Functions ============
    function getPoolBalance(address business) external view returns (uint256) {
        return businessPools[business].balance;
    }

    function getBusinessRate(address business) external view returns (uint256) {
        return businessPools[business].rewardRate;
    }

    function getBusinessCount() external view returns (uint256) {
        return activeBusinesses.length;
    }

    function getTransactionCount() external view returns (uint256) {
        return transactions.length;
    }

    function getSystemHealth() external view returns (
        uint256 totalBusinesses,
        uint256 totalPoolsValue,
        uint256 totalBurnedTokens,
        uint256 transactionCount,
        uint256 remainingSupply
    ) {
        totalBusinesses = activeBusinesses.length;
        
        for (uint i = 0; i < activeBusinesses.length; i++) {
            totalPoolsValue += businessPools[activeBusinesses[i]].balance;
        }
        
        remainingSupply = MAX_SUPPLY > totalSupply() ? MAX_SUPPLY - totalSupply() : 0;
        
        return (totalBusinesses, totalPoolsValue, totalBurned, transactions.length, remainingSupply);
    }

    function getUserDailyRewards(address user) external view returns (uint256) {
        if (block.timestamp > lastRewardReset[user] + 1 days) {
            return 0;
        }
        return dailyRewardsClaimed[user];
    }

    // ============ Required Overrides ============
    function _beforeTokenTransfer(address from, address to, uint256 amount)
        internal
        override(ERC20Upgradeable, ERC20PausableUpgradeable)
    {
        super._beforeTokenTransfer(from, to, amount);
    }

    function _authorizeUpgrade(address newImplementation) internal override onlyRole(UPGRADER_ROLE) {}

    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(AccessControlUpgradeable)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }
}
