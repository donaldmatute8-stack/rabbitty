// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * @title RabbittyTreasury
 * @dev Tesorería que respalda el valor de Bunz
 * Mantiene reservas en stablecoins (USDC/USDT)
 * Permite a negocios comprar Bunz con stablecoins
 * Permite a usuarios canjear Bunz por stablecoins
 */
contract RabbittyTreasury is 
    AccessControlUpgradeable,
    ReentrancyGuardUpgradeable,
    PausableUpgradeable,
    UUPSUpgradeable 
{
    // ============ Roles ============
    bytes32 public constant TREASURY_MANAGER = keccak256("TREASURY_MANAGER");
    bytes32 public constant ORACLE_ROLE = keccak256("ORACLE_ROLE");
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");
    bytes32 public constant UPGRADER_ROLE = keccak256("UPGRADER_ROLE");

    // ============ Token References ============
    address public bunzToken;           // Dirección del contrato BunzTokenV2
    address public feeCollector;        // Multisig/Timelock para fees del protocolo

    // ============ Reserves ============
    mapping(address => uint256) public stablecoinReserves;  // stablecoin => amount
    mapping(address => bool) public acceptedStablecoins;
    address[] public stablecoinList;
    
    uint256 public totalReserves;       // Total en USD (18 decimals)
    uint256 public targetRatio;         // 3000 = 30% (target reserve ratio)
    uint256 public minRatio;            // 1500 = 15% (minimum before alert)
    uint256 public maxRatio;            // 5000 = 50% (maximum)

    // ============ Exchange Rate ============
    uint256 public exchangeRate;        // 1 BZ = X USD (18 decimals)
    uint256 public lastRateUpdate;
    uint256 public constant RATE_UPDATE_INTERVAL = 1 hours;

    // ============ Limits ============
    uint256 public dailyRedemptionLimit;    // Límite diario de canje
    uint256 public dailyRedeemed;           // Canjeado hoy
    uint256 public lastRedemptionReset;
    
    uint256 public maxRedemptionPerUser;    // Máximo por usuario por transacción
    uint256 public minRedemptionAmount;     // Mínimo para canjear

    // ============ Deposits Tracking ============
    struct Deposit {
        address business;
        address stablecoin;
        uint256 amount;
        uint256 bunzReceived;
        uint256 timestamp;
    }
    
    Deposit[] public deposits;
    mapping(address => uint256) public totalDepositedByBusiness;

    // ============ Events ============
    event ReserveAdded(address indexed stablecoin, uint256 amount, uint256 bunzMinted);
    event BusinessDeposit(
        address indexed business, 
        address indexed stablecoin, 
        uint256 amount, 
        uint256 bunzReceived
    );
    event ReserveRatioUpdated(uint256 newTargetRatio, uint256 newMinRatio);
    event ExchangeRateUpdated(uint256 oldRate, uint256 newRate);
    event UserRedemption(
        address indexed user, 
        uint256 bunzBurned, 
        address indexed stablecoin, 
        uint256 stableAmount
    );
    event FeesWithdrawn(address indexed to, uint256 amount);
    event StablecoinAdded(address indexed stablecoin);
    event StablecoinRemoved(address indexed stablecoin);
    event DailyLimitUpdated(uint256 newLimit);

    // ============ Modifiers ============
    modifier onlyAcceptedStablecoin(address stablecoin) {
        require(acceptedStablecoins[stablecoin], "Stablecoin not accepted");
        _;
    }

    modifier updateRate() {
        _updateExchangeRate();
        _;
    }

    // ============ Initialize ============
    function initialize(
        address _bunzToken,
        address _feeCollector
    ) public initializer {
        __AccessControl_init();
        __ReentrancyGuard_init();
        __Pausable_init();
        __UUPSUpgradeable_init();

        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(TREASURY_MANAGER, msg.sender);
        _grantRole(ORACLE_ROLE, msg.sender);
        _grantRole(PAUSER_ROLE, msg.sender);
        _grantRole(UPGRADER_ROLE, msg.sender);

        bunzToken = _bunzToken;
        feeCollector = _feeCollector;

        // Parámetros iniciales
        targetRatio = 3000;  // 30%
        minRatio = 1500;     // 15%
        maxRatio = 5000;     // 50%
        exchangeRate = 1 * 10**18; // 1 BZ = $1 USD inicial
        lastRateUpdate = block.timestamp;

        dailyRedemptionLimit = 100_000 * 10**18; // 100K BZ/día
        maxRedemptionPerUser = 10_000 * 10**18; // 10K BZ
        minRedemptionAmount = 100 * 10**18; // 100 BZ mínimo

        lastRedemptionReset = block.timestamp;
    }

    // ============ Stablecoin Management ============
    /**
     * @dev Agregar stablecoin aceptada
     */
    function addStablecoin(address stablecoin) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(!acceptedStablecoins[stablecoin], "Already accepted");
        require(stablecoin != address(0), "Invalid address");
        
        acceptedStablecoins[stablecoin] = true;
        stablecoinList.push(stablecoin);
        
        emit StablecoinAdded(stablecoin);
    }

    /**
     * @dev Remover stablecoin
     */
    function removeStablecoin(address stablecoin) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(acceptedStablecoins[stablecoin], "Not accepted");
        require(stablecoinReserves[stablecoin] == 0, "Reserve not empty");
        
        acceptedStablecoins[stablecoin] = false;
        
        // Remover del array
        for (uint i = 0; i < stablecoinList.length; i++) {
            if (stablecoinList[i] == stablecoin) {
                stablecoinList[i] = stablecoinList[stablecoinList.length - 1];
                stablecoinList.pop();
                break;
            }
        }
        
        emit StablecoinRemoved(stablecoin);
    }

    // ============ Business Deposit (Buy Bunz) ============
    /**
     * @dev Negocio deposita stablecoins para comprar Bunz
     * @param stablecoin Dirección del stablecoin (USDC/USDT)
     * @param amount Monto en stablecoins
     */
    function depositForBunz(
        address stablecoin,
        uint256 amount
    ) external nonReentrant whenNotPaused onlyAcceptedStablecoin(stablecoin) updateRate {
        require(amount >= 100 * 10**18, "Minimum $100 deposit"); // Asumiendo 18 decimals
        require(bunzToken != address(0), "Bunz token not set");
        
        // Transferir stablecoins del negocio al treasury
        IERC20(stablecoin).transferFrom(msg.sender, address(this), amount);
        
        // Calcular Bunz a entregar
        uint256 bunzAmount = (amount * 10**18) / exchangeRate;
        
        // Actualizar reservas
        stablecoinReserves[stablecoin] += amount;
        totalReserves += amount;
        
        // Mintear Bunz al negocio (a través del contrato BunzTokenV2)
        // Esto requiere que el treasury tenga TREASURY_ROLE en BunzTokenV2
        (bool success, ) = bunzToken.call(
            abi.encodeWithSignature("treasuryMint(uint256)", bunzAmount)
        );
        require(success, "Mint failed");
        
        // Transferir Bunz al negocio
        IERC20(bunzToken).transfer(msg.sender, bunzAmount);
        
        // Registrar depósito
        deposits.push(Deposit({
            business: msg.sender,
            stablecoin: stablecoin,
            amount: amount,
            bunzReceived: bunzAmount,
            timestamp: block.timestamp
        }));
        
        totalDepositedByBusiness[msg.sender] += amount;
        
        emit BusinessDeposit(msg.sender, stablecoin, amount, bunzAmount);
    }

    // ============ User Redemption (Sell Bunz) ============
    /**
     * @dev Usuario canjea Bunz por stablecoins
     * @param bunzAmount Cantidad de Bunz a canjear
     * @param stablecoin Stablecoin deseado
     */
    function redeemBunz(
        uint256 bunzAmount,
        address stablecoin
    ) external nonReentrant whenNotPaused onlyAcceptedStablecoin(stablecoin) updateRate {
        require(bunzAmount >= minRedemptionAmount, "Below minimum");
        require(bunzAmount <= maxRedemptionPerUser, "Exceeds max per transaction");
        require(IERC20(bunzToken).balanceOf(msg.sender) >= bunzAmount, "Insufficient Bunz");
        
        // Verificar límite diario
        if (block.timestamp > lastRedemptionReset + 1 days) {
            lastRedemptionReset = block.timestamp;
            dailyRedeemed = 0;
        }
        require(dailyRedeemed + bunzAmount <= dailyRedemptionLimit, "Daily limit exceeded");
        
        // Calcular stablecoins a entregar
        uint256 stableAmount = (bunzAmount * exchangeRate) / 10**18;
        
        // Verificar reservas
        require(stablecoinReserves[stablecoin] >= stableAmount, "Insufficient reserves");
        require(totalReserves >= stableAmount, "Total reserves insufficient");
        
        // Verificar ratio de reservas después del canje
        uint256 remainingSupply = IERC20(bunzToken).totalSupply() - bunzAmount;
        uint256 newRatio = (totalReserves - stableAmount) * 10000 / remainingSupply;
        require(newRatio >= minRatio, "Would break minimum reserve ratio");
        
        // Quemar Bunz del usuario (a través de BunzTokenV2)
        // El usuario debe haber aprobado el gasto
        IERC20(bunzToken).transferFrom(msg.sender, address(this), bunzAmount);
        (bool success, ) = bunzToken.call(
            abi.encodeWithSignature("burn(uint256)", bunzAmount)
        );
        require(success, "Burn failed");
        
        // Actualizar estado
        stablecoinReserves[stablecoin] -= stableAmount;
        totalReserves -= stableAmount;
        dailyRedeemed += bunzAmount;
        
        // Transferir stablecoins al usuario
        IERC20(stablecoin).transfer(msg.sender, stableAmount);
        
        emit UserRedemption(msg.sender, bunzAmount, stablecoin, stableAmount);
    }

    // ============ Exchange Rate Management ============
    /**
     * @dev Actualizar tasa de cambio basada en reservas
     */
    function _updateExchangeRate() internal {
        if (block.timestamp < lastRateUpdate + RATE_UPDATE_INTERVAL) {
            return;
        }
        
        uint256 oldRate = exchangeRate;
        uint256 supply = IERC20(bunzToken).totalSupply();
        
        if (supply > 0) {
            // Tasa = Reservas / Supply
            uint256 newRate = (totalReserves * 10**18) / supply;
            
            // Limitar cambio máximo (anti-manipulación)
            uint256 maxChange = oldRate * 10 / 100; // 10% máximo
            if (newRate > oldRate + maxChange) {
                newRate = oldRate + maxChange;
            } else if (newRate < oldRate - maxChange) {
                newRate = oldRate - maxChange;
            }
            
            exchangeRate = newRate;
        }
        
        lastRateUpdate = block.timestamp;
        emit ExchangeRateUpdated(oldRate, exchangeRate);
    }

    /**
     * @dev Oracle actualiza tasa manualmente (con restricciones)
     */
    function updateExchangeRate(uint256 newRate) external onlyRole(ORACLE_ROLE) {
        require(newRate > 0, "Rate must be positive");
        require(
            newRate <= exchangeRate * 110 / 100 && newRate >= exchangeRate * 90 / 100,
            "Change exceeds 10%"
        );
        
        uint256 oldRate = exchangeRate;
        exchangeRate = newRate;
        lastRateUpdate = block.timestamp;
        
        emit ExchangeRateUpdated(oldRate, newRate);
    }

    // ============ Reserve Management ============
    /**
     * @dev Actualizar ratios objetivo
     */
    function setReserveRatios(
        uint256 _target,
        uint256 _min,
        uint256 _max
    ) external onlyRole(TREASURY_MANAGER) {
        require(_min < _target && _target < _max, "Invalid ratios");
        require(_min >= 500 && _max <= 10000, "Out of range"); // 5%-100%
        
        targetRatio = _target;
        minRatio = _min;
        maxRatio = _max;
        
        emit ReserveRatioUpdated(_target, _min);
    }

    /**
     * @dev Retirar fees del protocolo (solo a feeCollector)
     */
    function withdrawFees(
        address stablecoin, 
        uint256 amount
    ) external onlyRole(TREASURY_MANAGER) nonReentrant {
        require(stablecoinReserves[stablecoin] >= amount, "Insufficient reserves");
        
        stablecoinReserves[stablecoin] -= amount;
        totalReserves -= amount;
        
        IERC20(stablecoin).transfer(feeCollector, amount);
        
        emit FeesWithdrawn(feeCollector, amount);
    }

    // ============ Limits Management ============
    function setDailyRedemptionLimit(uint256 limit) external onlyRole(TREASURY_MANAGER) {
        dailyRedemptionLimit = limit;
        emit DailyLimitUpdated(limit);
    }

    function setMaxRedemptionPerUser(uint256 max) external onlyRole(TREASURY_MANAGER) {
        maxRedemptionPerUser = max;
    }

    function setMinRedemptionAmount(uint256 min) external onlyRole(TREASURY_MANAGER) {
        minRedemptionAmount = min;
    }

    // ============ View Functions ============
    function getExchangeRate() external view returns (uint256) {
        return exchangeRate;
    }

    function getReserveRatio() external view returns (uint256) {
        uint256 supply = IERC20(bunzToken).totalSupply();
        if (supply == 0) return 10000; // 100%
        return (totalReserves * 10000) / supply;
    }

    function getStablecoinReserve(address stablecoin) external view returns (uint256) {
        return stablecoinReserves[stablecoin];
    }

    function getHealthStatus() external view returns (
        uint256 ratio,
        bool healthy,
        bool undercapitalized,
        bool overcapitalized
    ) {
        uint256 supply = IERC20(bunzToken).totalSupply();
        if (supply == 0) {
            return (10000, true, false, false);
        }
        
        ratio = (totalReserves * 10000) / supply;
        healthy = ratio >= targetRatio;
        undercapitalized = ratio < minRatio;
        overcapitalized = ratio > maxRatio;
        
        return (ratio, healthy, undercapitalized, overcapitalized);
    }

    function getRemainingDailyRedemption() external view returns (uint256) {
        if (block.timestamp > lastRedemptionReset + 1 days) {
            return dailyRedemptionLimit;
        }
        return dailyRedemptionLimit - dailyRedeemed;
    }

    // ============ Pausable ============
    function pause() external onlyRole(PAUSER_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(PAUSER_ROLE) {
        _unpause();
    }

    // ============ Emergency ============
    /**
     * @dev En emergencia, admin puede transferir tokens (con timelock en producción)
     */
    function emergencyTransfer(
        address token,
        address to,
        uint256 amount
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        IERC20(token).transfer(to, amount);
    }

    // ============ Required Overrides ============
    function _authorizeUpgrade(address newImplementation) internal override onlyRole(UPGRADER_ROLE) {}
}
