// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts-upgradeable/token/ERC20/ERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/extensions/ERC20BurnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/extensions/ERC20PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";

/**
 * @title BunzToken
 * @dev ERC-20 reward token for Rabbitty ecosystem
 * Features: Mintable rewards, burnable, pausable, permit (gasless approvals)
 * UUPS upgradeable
 */
contract BunzToken is 
    ERC20Upgradeable, 
    ERC20BurnableUpgradeable,
    ERC20PausableUpgradeable,
    AccessControlUpgradeable,
    UUPSUpgradeable 
{
    using ECDSA for bytes32;
    using MessageHashUtils for bytes32;

    // ============ Roles ============
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");
    bytes32 public constant CLAIM_SIGNER_ROLE = keccak256("CLAIM_SIGNER_ROLE");
    bytes32 public constant UPGRADER_ROLE = keccak256("UPGRADER_ROLE");

    // ============ Token Info ============
    string public constant NAME = "Bunz";
    string public constant SYMBOL = "BZ";
    uint8 public constant DECIMALS = 18;
    uint256 public constant INITIAL_SUPPLY = 1_000_000_000 * 10**18; // 1B tokens
    uint256 public constant MAX_SUPPLY = 2_000_000_000 * 10**18; // 2B max

    // ============ Reward Rates ============
    uint256 public constant BASE_RATE = 2000; // 20% = 2000/10000
    uint256 public constant LEVEL_BONUS_RATE = 200; // 2% per level = 200/10000
    uint256 public constant REFERRAL_BONUS_RATE = 500; // 5% = 500/10000
    uint256 public constant BURN_RATE = 100; // 1% burn on transfers = 100/10000

    // ============ State ============
    
    // Referral tracking
    mapping(address => address) public referrers; // user => referrer
    mapping(address => uint256) public referralCount;
    mapping(address => uint256) public totalReferralEarnings;
    
    // Claims tracking (prevent double claiming)
    mapping(bytes32 => bool) public receiptUsed;
    mapping(address => Claim[]) public userClaims;
    
    // Authorized claim signers
    mapping(address => bool) public isClaimSigner;
    
    // Total burned
    uint256 public totalBurned;

    struct Claim {
        uint256 amount;
        uint256 affiliateId;
        uint256 timestamp;
        bytes32 receiptHash;
        bool claimed;
    }

    // ============ Events ============
    event RewardsMinted(address indexed to, uint256 amount, address indexed minter);
    event RewardsClaimed(address indexed user, uint256 amount, uint256 indexed affiliateId);
    event ReferralReward(address indexed referrer, address indexed referred, uint256 amount);
    event ReferrerSet(address indexed user, address indexed referrer);
    event PerkRedeemed(address indexed user, uint256 indexed perkId, uint256 amount);
    event TokensBurned(address indexed from, uint256 amount, string reason);

    // ============ Initialize ============
    function initialize() public initializer {
        __ERC20_init(NAME, SYMBOL);
        __ERC20Burnable_init();
        __ERC20Pausable_init();
        __AccessControl_init();
        __UUPSUpgradeable_init();

        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(MINTER_ROLE, msg.sender);
        _grantRole(PAUSER_ROLE, msg.sender);
        _grantRole(CLAIM_SIGNER_ROLE, msg.sender);
        _grantRole(UPGRADER_ROLE, msg.sender);

        isClaimSigner[msg.sender] = true;

        // Mint initial supply to treasury
        _mint(msg.sender, INITIAL_SUPPLY);
    }

    // ============ Minting Rewards ============
    /**
     * @dev Mint rewards to a user (authorized minters only)
     * @param to Address to mint to
     * @param amount Amount of tokens to mint
     */
    function mintRewards(address to, uint256 amount) external onlyRole(MINTER_ROLE) {
        require(totalSupply() + amount <= MAX_SUPPLY, "Max supply exceeded");
        _mint(to, amount);
        emit RewardsMinted(to, amount, msg.sender);
    }

    /**
     * @dev Batch mint rewards to multiple users
     */
    function batchMintRewards(address[] calldata recipients, uint256[] calldata amounts) external onlyRole(MINTER_ROLE) {
        require(recipients.length == amounts.length, "Length mismatch");
        
        uint256 totalAmount = 0;
        for (uint i = 0; i < amounts.length; i++) {
            totalAmount += amounts[i];
        }
        require(totalSupply() + totalAmount <= MAX_SUPPLY, "Max supply exceeded");

        for (uint i = 0; i < recipients.length; i++) {
            _mint(recipients[i], amounts[i]);
            emit RewardsMinted(recipients[i], amounts[i], msg.sender);
        }
    }

    // ============ Referral System ============
    /**
     * @dev Set referrer for a user (authorized only)
     * @param user The new user
     * @param referrer The referrer address
     */
    function setReferrer(address user, address referrer) external onlyRole(MINTER_ROLE) {
        require(user != address(0), "Invalid user");
        require(referrer != address(0), "Invalid referrer");
        require(user != referrer, "Cannot refer self");
        require(referrers[user] == address(0), "Referrer already set");
        require(balanceOf(referrer) > 0 || hasRole(MINTER_ROLE, referrer), "Referrer must have tokens");

        referrers[user] = referrer;
        referralCount[referrer]++;

        emit ReferrerSet(user, referrer);
    }

    /**
     * @dev Get referrer for a user
     */
    function getReferrer(address user) external view returns (address) {
        return referrers[user];
    }

    /**
     * @dev Check if user has a referrer
     */
    function hasReferrer(address user) external view returns (bool) {
        return referrers[user] != address(0);
    }

    // ============ Reward Calculation ============
    /**
     * @dev Calculate Bunz reward based on purchase amount and user level
     * @param amount Purchase amount (in wei equivalent)
     * @param level User level (1+)
     * @return rewardAmount Amount of Bunz to reward
     */
    function calculateReward(uint256 amount, uint256 level) public pure returns (uint256) {
        uint256 baseReward = (amount * BASE_RATE) / 10000;
        uint256 levelBonus = (amount * LEVEL_BONUS_RATE * (level - 1)) / 10000;
        return baseReward + levelBonus;
    }

    /**
     * @dev Calculate referral bonus
     */
    function calculateReferralBonus(uint256 amount) public pure returns (uint256) {
        return (amount * REFERRAL_BONUS_RATE) / 10000;
    }

    // ============ Claims (Signature-based) ============
    /**
     * @dev Claim rewards with signature verification
     * @param amount Amount to claim
     * @param affiliateId Affiliate ID where purchase was made
     * @param receiptHash Hash of receipt (prevents double claiming)
     * @param signature Signature from authorized claim signer
     */
    function claimRewards(
        uint256 amount,
        uint256 affiliateId,
        bytes32 receiptHash,
        bytes calldata signature
    ) external whenNotPaused {
        require(amount > 0, "Amount must be > 0");
        require(!receiptUsed[receiptHash], "Already claimed");
        require(totalSupply() + amount <= MAX_SUPPLY, "Max supply exceeded");

        // Verify signature
        bytes32 message = keccak256(abi.encodePacked(msg.sender, amount, affiliateId, receiptHash));
        bytes32 ethSignedMessage = message.toEthSignedMessageHash();
        address signer = ethSignedMessage.recover(signature);
        require(isClaimSigner[signer] || hasRole(CLAIM_SIGNER_ROLE, signer), "Invalid signature");

        receiptUsed[receiptHash] = true;

        // Handle referral bonus
        address referrer = referrers[msg.sender];
        if (referrer != address(0)) {
            uint256 refBonus = calculateReferralBonus(amount);
            uint256 userAmount = amount - refBonus;
            
            _mint(msg.sender, userAmount);
            _mint(referrer, refBonus);
            totalReferralEarnings[referrer] += refBonus;
            
            emit ReferralReward(referrer, msg.sender, refBonus);
        } else {
            _mint(msg.sender, amount);
        }

        // Record claim
        userClaims[msg.sender].push(Claim({
            amount: amount,
            affiliateId: affiliateId,
            timestamp: block.timestamp,
            receiptHash: receiptHash,
            claimed: true
        }));

        emit RewardsClaimed(msg.sender, amount, affiliateId);
    }

    /**
     * @dev Admin can claim on behalf of user (for backend integration)
     */
    function claimRewardsOnBehalf(
        address user,
        uint256 amount,
        uint256 affiliateId,
        bytes32 receiptHash
    ) external onlyRole(MINTER_ROLE) whenNotPaused {
        require(amount > 0, "Amount must be > 0");
        require(!receiptUsed[receiptHash], "Already claimed");
        require(totalSupply() + amount <= MAX_SUPPLY, "Max supply exceeded");

        receiptUsed[receiptHash] = true;
        _mint(user, amount);

        userClaims[user].push(Claim({
            amount: amount,
            affiliateId: affiliateId,
            timestamp: block.timestamp,
            receiptHash: receiptHash,
            claimed: true
        }));

        emit RewardsClaimed(user, amount, affiliateId);
    }

    /**
     * @dev Get claim history for a user
     */
    function getClaimHistory(address user) external view returns (Claim[] memory) {
        return userClaims[user];
    }

    /**
     * @dev Check if a receipt has been used
     */
    function isReceiptUsed(bytes32 receiptHash) external view returns (bool) {
        return receiptUsed[receiptHash];
    }

    // ============ Burning ============
    /**
     * @dev Burn tokens for a perk (governance, discounts, etc.)
     * @param amount Amount to burn
     * @param perkId ID of the perk being redeemed
     */
    function burnForPerk(uint256 amount, uint256 perkId) external whenNotPaused {
        require(amount > 0, "Amount must be > 0");
        require(balanceOf(msg.sender) >= amount, "Insufficient balance");

        _burn(msg.sender, amount);
        totalBurned += amount;

        emit PerkRedeemed(msg.sender, perkId, amount);
        emit TokensBurned(msg.sender, amount, "perk");
    }

    /**
     * @dev Admin burn (for treasury management)
     */
    function adminBurn(address from, uint256 amount) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _burn(from, amount);
        totalBurned += amount;
        emit TokensBurned(from, amount, "admin");
    }

    // ============ Transfer with Burn ============
    /**
     * @dev Override transfer to add burn fee
     */
    function transfer(address to, uint256 amount) public virtual override returns (bool) {
        uint256 burnAmount = (amount * BURN_RATE) / 10000;
        uint256 sendAmount = amount - burnAmount;

        if (burnAmount > 0) {
            _burn(msg.sender, burnAmount);
            totalBurned += burnAmount;
        }

        return super.transfer(to, sendAmount);
    }

    /**
     * @dev Override transferFrom to add burn fee
     */
    function transferFrom(address from, address to, uint256 amount) public virtual override returns (bool) {
        uint256 burnAmount = (amount * BURN_RATE) / 10000;
        uint256 sendAmount = amount - burnAmount;

        if (burnAmount > 0) {
            _burn(from, burnAmount);
            totalBurned += burnAmount;
        }

        // Adjust allowance
        uint256 currentAllowance = allowance(from, msg.sender);
        require(currentAllowance >= amount, "ERC20: insufficient allowance");
        _approve(from, msg.sender, currentAllowance - amount);

        return super.transferFrom(from, to, sendAmount);
    }

    // ============ Signer Management ============
    /**
     * @dev Add/remove authorized claim signers
     */
    function setClaimSigner(address signer, bool authorized) external onlyRole(DEFAULT_ADMIN_ROLE) {
        isClaimSigner[signer] = authorized;
    }

    // ============ Pausable ============
    /**
     * @dev Pause token transfers (emergency)
     */
    function pause() external onlyRole(PAUSER_ROLE) {
        _pause();
    }

    /**
     * @dev Unpause token transfers
     */
    function unpause() external onlyRole(PAUSER_ROLE) {
        _unpause();
    }

    // ============ View Functions ============
    /**
     * @dev Get total supply minus burned (circulating)
     */
    function circulatingSupply() external view returns (uint256) {
        return totalSupply();
    }

    /**
     * @dev Get remaining mintable amount
     */
    function remainingMintable() external view returns (uint256) {
        if (totalSupply() >= MAX_SUPPLY) return 0;
        return MAX_SUPPLY - totalSupply();
    }

    /**
     * @dev Get user stats
     */
    function getUserStats(address user) external view returns (
        uint256 balance,
        address referrer,
        uint256 claimCount,
        uint256 totalClaimed
    ) {
        balance = balanceOf(user);
        referrer = referrers[user];
        claimCount = userClaims[user].length;
        
        uint256 total = 0;
        for (uint i = 0; i < userClaims[user].length; i++) {
            total += userClaims[user][i].amount;
        }
        totalClaimed = total;
    }

    // ============ Upgrade Authorization ============
    function _authorizeUpgrade(address newImplementation) internal override onlyRole(UPGRADER_ROLE) {}

    // ============ Required Overrides ============
    function _beforeTokenTransfer(address from, address to, uint256 amount)
        internal
        override(ERC20Upgradeable, ERC20PausableUpgradeable)
    {
        super._beforeTokenTransfer(from, to, amount);
    }

    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(AccessControlUpgradeable)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }
}
