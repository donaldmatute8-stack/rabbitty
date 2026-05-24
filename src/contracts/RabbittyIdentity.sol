// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts-upgradeable/token/ERC721/ERC721Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts/utils/Strings.sol";

/**
 * @title RabbittyIdentity
 * @dev Soulbound, dynamic Identity NFT for Rabbitty ecosystem
 * ERC-721 with ERC-5192 (minimal soulbound) extension
 * UUPS upgradeable pattern
 */
contract RabbittyIdentity is 
    ERC721Upgradeable, 
    AccessControlUpgradeable, 
    ReentrancyGuardUpgradeable,
    UUPSUpgradeable 
{
    using Strings for uint256;

    // ============ Roles ============
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    bytes32 public constant XP_MANAGER_ROLE = keccak256("XP_MANAGER_ROLE");
    bytes32 public constant METADATA_MANAGER_ROLE = keccak256("METADATA_MANAGER_ROLE");
    bytes32 public constant UPGRADER_ROLE = keccak256("UPGRADER_ROLE");

    // ============ Structs ============
    struct IdentityData {
        string username;
        uint256 level;
        uint256 experience;
        uint256 power;
        uint256[] equippedAccessories;
        string[] achievements;
        uint256 createdAt;
        uint256 lastUpdated;
    }

    struct Accessory {
        uint256 id;
        string name;
        AccessoryType accessoryType;
        uint8 rarity; // 1-5
        uint256 powerBonus;
        bool soulbound;
        string metadataURI;
    }

    enum AccessoryType { BADGE, FRAME, EFFECT, HEADWEAR, BACKGROUND }

    // ============ State ============
    uint256 private _tokenIdCounter;
    
    // Identity data
    mapping(uint256 => IdentityData) public identities;
    mapping(string => uint256) public usernameToIdentity;
    mapping(uint256 => string) public identityToUsername;
    mapping(address => uint256) public walletToIdentity;
    
    // Accessories
    mapping(uint256 => Accessory) public accessories;
    mapping(uint256 => uint256) public accessoryToIdentity;
    uint256 private _accessoryIdCounter;
    
    // Metadata hashes (IPFS)
    mapping(uint256 => string) private _metadataHashes;
    
    // Constants
    uint256 public constant XP_PER_LEVEL = 1000;
    uint256 public constant BASE_POWER = 100;

    // ============ Events ============
    event IdentityMinted(address indexed owner, uint256 indexed tokenId, string username);
    event LevelUp(uint256 indexed tokenId, uint256 newLevel);
    event ExperienceGained(uint256 indexed tokenId, uint256 amount);
    event AccessoryEquipped(uint256 indexed identityId, uint256 indexed accessoryId);
    event AccessoryUnequipped(uint256 indexed identityId, uint256 indexed accessoryId);
    event AchievementUnlocked(uint256 indexed tokenId, string achievement);
    event MetadataUpdated(uint256 indexed tokenId, string newHash);

    // ============ Modifiers ============
    modifier onlyIdentityOwner(uint256 tokenId) {
        require(ownerOf(tokenId) == msg.sender, "Not identity owner");
        _;
    }

    // ============ Initialize ============
    function initialize() public initializer {
        __ERC721_init("Rabbitty Identity", "RID");
        __AccessControl_init();
        __ReentrancyGuard_init();
        __UUPSUpgradeable_init();

        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(MINTER_ROLE, msg.sender);
        _grantRole(XP_MANAGER_ROLE, msg.sender);
        _grantRole(METADATA_MANAGER_ROLE, msg.sender);
        _grantRole(UPGRADER_ROLE, msg.sender);

        _tokenIdCounter = 1;
        _accessoryIdCounter = 1;
    }

    // ============ Minting ============
    /**
     * @dev Mint a new identity NFT (soulbound)
     * @param to Address to mint to
     * @param username Unique username
     * @return tokenId The minted token ID
     */
    function mintIdentity(address to, string calldata username) external onlyRole(MINTER_ROLE) returns (uint256) {
        require(bytes(username).length >= 3 && bytes(username).length <= 20, "Invalid username length");
        require(usernameToIdentity[username] == 0, "Username taken");
        require(walletToIdentity[to] == 0, "Wallet already has identity");

        uint256 tokenId = _tokenIdCounter++;
        
        _safeMint(to, tokenId);

        uint256[] memory emptyAccessories = new uint256[](0);
        string[] memory emptyAchievements = new string[](0);

        identities[tokenId] = IdentityData({
            username: username,
            level: 1,
            experience: 0,
            power: BASE_POWER,
            equippedAccessories: emptyAccessories,
            achievements: emptyAchievements,
            createdAt: block.timestamp,
            lastUpdated: block.timestamp
        });

        usernameToIdentity[username] = tokenId;
        identityToUsername[tokenId] = username;
        walletToIdentity[to] = tokenId;

        emit IdentityMinted(to, tokenId, username);

        return tokenId;
    }

    // ============ Soulbound Logic ============
    /**
     * @dev Override _beforeTokenTransfer to enforce soulbound
     * Only allows mint (from=0) and burn (to=0)
     */
    function _beforeTokenTransfer(
        address from,
        address to,
        uint256 tokenId,
        uint256 batchSize
    ) internal virtual override {
        super._beforeTokenTransfer(from, to, tokenId, batchSize);
        
        // Soulbound: only allow mint (from=0) and burn (to=0)
        require(from == address(0) || to == address(0), "Soulbound: non-transferable");
    }

    // ============ XP & Leveling ============
    /**
     * @dev Add experience points to an identity
     * @param tokenId Identity token ID
     * @param xp Amount of XP to add
     */
    function addExperience(uint256 tokenId, uint256 xp) external onlyRole(XP_MANAGER_ROLE) {
        require(_exists(tokenId), "Identity does not exist");
        
        IdentityData storage identity = identities[tokenId];
        identity.experience += xp;
        
        // Check for level up
        uint256 newLevel = (identity.experience / XP_PER_LEVEL) + 1;
        if (newLevel > identity.level) {
            identity.level = newLevel;
            emit LevelUp(tokenId, newLevel);
        }
        
        // Recalculate power
        _updatePower(tokenId);
        
        identity.lastUpdated = block.timestamp;
        
        emit ExperienceGained(tokenId, xp);
    }

    /**
     * @dev Recalculate power based on level and accessories
     */
    function _updatePower(uint256 tokenId) internal {
        IdentityData storage identity = identities[tokenId];
        uint256 accessoryPower = 0;
        
        for (uint i = 0; i < identity.equippedAccessories.length; i++) {
            uint256 accessoryId = identity.equippedAccessories[i];
            accessoryPower += accessories[accessoryId].powerBonus;
        }
        
        uint256 levelBonus = (identity.level - 1) * 10;
        identity.power = BASE_POWER + accessoryPower + levelBonus;
    }

    // ============ Achievements ============
    /**
     * @dev Unlock an achievement for an identity
     */
    function unlockAchievement(uint256 tokenId, string calldata achievement) external onlyRole(XP_MANAGER_ROLE) {
        require(_exists(tokenId), "Identity does not exist");
        
        IdentityData storage identity = identities[tokenId];
        
        // Check if already unlocked
        for (uint i = 0; i < identity.achievements.length; i++) {
            require(keccak256(bytes(identity.achievements[i])) != keccak256(bytes(achievement)), "Achievement already unlocked");
        }
        
        identity.achievements.push(achievement);
        identity.lastUpdated = block.timestamp;
        
        emit AchievementUnlocked(tokenId, achievement);
    }

    // ============ Accessory System ============
    /**
     * @dev Create a new accessory type (admin only)
     */
    function createAccessory(
        string calldata name,
        AccessoryType accessoryType,
        uint8 rarity,
        uint256 powerBonus,
        bool isSoulbound,
        string calldata metadataURI
    ) external onlyRole(DEFAULT_ADMIN_ROLE) returns (uint256) {
        require(rarity >= 1 && rarity <= 5, "Rarity must be 1-5");
        
        uint256 accessoryId = _accessoryIdCounter++;
        
        accessories[accessoryId] = Accessory({
            id: accessoryId,
            name: name,
            accessoryType: accessoryType,
            rarity: rarity,
            powerBonus: powerBonus,
            soulbound: isSoulbound,
            metadataURI: metadataURI
        });
        
        return accessoryId;
    }

    /**
     * @dev Equip an accessory to an identity
     */
    function equipAccessory(uint256 tokenId, uint256 accessoryId) external onlyIdentityOwner(tokenId) nonReentrant {
        require(_exists(tokenId), "Identity does not exist");
        require(accessories[accessoryId].id != 0, "Accessory does not exist");
        require(accessoryToIdentity[accessoryId] == 0, "Accessory already equipped");
        
        IdentityData storage identity = identities[tokenId];
        
        // Check if already equipped (shouldn't happen with accessoryToIdentity check)
        for (uint i = 0; i < identity.equippedAccessories.length; i++) {
            require(identity.equippedAccessories[i] != accessoryId, "Already equipped");
        }
        
        identity.equippedAccessories.push(accessoryId);
        accessoryToIdentity[accessoryId] = tokenId;
        
        _updatePower(tokenId);
        identity.lastUpdated = block.timestamp;
        
        emit AccessoryEquipped(tokenId, accessoryId);
    }

    /**
     * @dev Unequip an accessory (only if not soulbound)
     */
    function unequipAccessory(uint256 tokenId, uint256 accessoryId) external onlyIdentityOwner(tokenId) nonReentrant {
        require(_exists(tokenId), "Identity does not exist");
        require(!accessories[accessoryId].soulbound, "Cannot unequip soulbound accessory");
        
        IdentityData storage identity = identities[tokenId];
        
        // Find and remove accessory
        bool found = false;
        for (uint i = 0; i < identity.equippedAccessories.length; i++) {
            if (identity.equippedAccessories[i] == accessoryId) {
                // Swap with last element and pop
                identity.equippedAccessories[i] = identity.equippedAccessories[identity.equippedAccessories.length - 1];
                identity.equippedAccessories.pop();
                found = true;
                break;
            }
        }
        require(found, "Accessory not equipped");
        
        accessoryToIdentity[accessoryId] = 0;
        
        _updatePower(tokenId);
        identity.lastUpdated = block.timestamp;
        
        emit AccessoryUnequipped(tokenId, accessoryId);
    }

    // ============ Metadata ============
    /**
     * @dev Returns the metadata URI for an identity
     * Points to IPFS hash stored in _metadataHashes
     */
    function tokenURI(uint256 tokenId) public view virtual override returns (string memory) {
        require(_exists(tokenId), "ERC721: URI query for nonexistent token");
        
        string memory hash = _metadataHashes[tokenId];
        if (bytes(hash).length > 0) {
            return string(abi.encodePacked("ipfs://", hash));
        }
        
        return "";
    }

    /**
     * @dev Update the metadata hash (IPFS) for an identity
     */
    function updateMetadataHash(uint256 tokenId, string calldata newHash) external onlyRole(METADATA_MANAGER_ROLE) {
        require(_exists(tokenId), "Identity does not exist");
        
        _metadataHashes[tokenId] = newHash;
        identities[tokenId].lastUpdated = block.timestamp;
        
        emit MetadataUpdated(tokenId, newHash);
    }

    // ============ View Functions ============
    /**
     * @dev Get full identity data
     */
    function getIdentity(uint256 tokenId) external view returns (IdentityData memory) {
        require(_exists(tokenId), "Identity does not exist");
        return identities[tokenId];
    }

    /**
     * @dev Get identity by username
     */
    function getIdentityByUsername(string calldata username) external view returns (IdentityData memory) {
        uint256 tokenId = usernameToIdentity[username];
        require(tokenId != 0, "Username not found");
        return identities[tokenId];
    }

    /**
     * @dev Check if an address has an identity
     */
    function hasIdentity(address wallet) external view returns (bool) {
        return walletToIdentity[wallet] != 0;
    }

    /**
     * @dev Get identity token ID for wallet
     */
    function getIdentityByWallet(address wallet) external view returns (uint256) {
        return walletToIdentity[wallet];
    }

    /**
     * @dev Get all accessories for an identity
     */
    function getEquippedAccessories(uint256 tokenId) external view returns (uint256[] memory) {
        require(_exists(tokenId), "Identity does not exist");
        return identities[tokenId].equippedAccessories;
    }

    // ============ ERC-5192 (Soulbound) ============
    /**
     * @dev ERC-5192: Check if token is locked (soulbound)
     */
    function locked(uint256 tokenId) external view returns (bool) {
        require(_exists(tokenId), "Token does not exist");
        return true; // Always locked (soulbound)
    }

    // ============ Upgrade Authorization ============
    function _authorizeUpgrade(address newImplementation) internal override onlyRole(UPGRADER_ROLE) {}

    // ============ Required Overrides ============
    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(ERC721Upgradeable, AccessControlUpgradeable)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }
}
