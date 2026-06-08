# Rabbitty Identity NFT - Smart Contract Specification

## Overview
Soulbound (non-transferable) dynamic NFT for user identity on Polygon.

## Standards
- **ERC-721** base with **ERC-5192** (minimal soulbound) extension
- **ERC-4907** (rental NFT) - not applicable since soulbound
- **ERC-2981** (royalties) - not applicable

## Core Features

### 1. Soulbound (Non-Transferable)
```solidity
// All transfer functions revert
function _beforeTokenTransfer(...) internal override {
    require(from == address(0) || to == address(0), "Soulbound: non-transferable");
}

// ERC-5192 interface
function locked(uint256 tokenId) external view returns (bool);
```

### 2. Dynamic Metadata
```solidity
struct IdentityData {
    string username;          // Unique, immutable
    uint256 level;            // Starts at 1
    uint256 experience;       // XP points
    uint256 power;            // Calculated score
    uint256[] equippedAccessories; // Token IDs of accessories
    string[] achievements;    // Earned badges
    uint256 createdAt;
    uint256 lastUpdated;
}

mapping(uint256 => IdentityData) public identities;
```

### 3. Accessory System
```solidity
struct Accessory {
    uint256 id;
    string name;
    AccessoryType accessoryType; // enum
    uint8 rarity;               // 1-5
    uint256 powerBonus;
    bool soulbound;
    string metadataURI;
}

enum AccessoryType { BADGE, FRAME, EFFECT, HEADWEAR, BACKGROUND }

// Accessory registry
mapping(uint256 => Accessory) public accessories;
mapping(uint256 => uint256) public accessoryToIdentity; // Which identity owns it

// Events
event AccessoryEquipped(uint256 indexed identityId, uint256 indexed accessoryId);
event AccessoryUnequipped(uint256 indexed identityId, uint256 indexed accessoryId);
```

### 4. Level & XP System
```solidity
uint256 constant XP_PER_LEVEL = 1000;

function addExperience(uint256 identityId, uint256 xp) external onlyAuthorized {
    IdentityData storage identity = identities[identityId];
    identity.experience += xp;
    
    // Check level up
    uint256 newLevel = (identity.experience / XP_PER_LEVEL) + 1;
    if (newLevel > identity.level) {
        identity.level = newLevel;
        emit LevelUp(identityId, newLevel);
    }
    
    // Recalculate power
    _updatePower(identityId);
}

function _updatePower(uint256 identityId) internal {
    IdentityData storage identity = identities[identityId];
    uint256 basePower = 100;
    uint256 accessoryPower = 0;
    
    for (uint i = 0; i < identity.equippedAccessories.length; i++) {
        accessoryPower += accessories[identity.equippedAccessories[i]].powerBonus;
    }
    
    uint256 levelBonus = (identity.level - 1) * 10;
    identity.power = basePower + accessoryPower + levelBonus;
}
```

### 5. Username Registry
```solidity
mapping(string => uint256) public usernameToIdentity; // username -> tokenId
mapping(uint256 => string) public identityToUsername;

function mintIdentity(string calldata username, address to) external returns (uint256) {
    require(bytes(username).length >= 3 && bytes(username).length <= 20, "Invalid length");
    require(usernameToIdentity[username] == 0, "Username taken");
    require(balanceOf(to) == 0, "Already has identity"); // One per wallet
    
    uint256 tokenId = _tokenIdCounter.current();
    _tokenIdCounter.increment();
    
    _safeMint(to, tokenId);
    
    identities[tokenId] = IdentityData({
        username: username,
        level: 1,
        experience: 0,
        power: 100,
        equippedAccessories: new uint256[](0),
        achievements: new string[](0),
        createdAt: block.timestamp,
        lastUpdated: block.timestamp
    });
    
    usernameToIdentity[username] = tokenId;
    identityToUsername[tokenId] = username;
    
    emit IdentityMinted(to, tokenId, username);
    return tokenId;
}
```

### 6. Metadata URI (Dynamic)
```solidity
function tokenURI(uint256 tokenId) public view override returns (string memory) {
    require(_exists(tokenId), "Nonexistent token");
    
    IdentityData memory identity = identities[tokenId];
    
    // Return IPFS URI that points to JSON with current state
    // The JSON is generated off-chain but pinned to IPFS
    return string(abi.encodePacked(
        "ipfs://",
        _metadataHashes[tokenId]
    ));
}

// Only owner or authorized minter can update metadata hash
function updateMetadataHash(uint256 tokenId, string calldata newHash) external onlyAuthorized {
    require(_exists(tokenId), "Nonexistent token");
    _metadataHashes[tokenId] = newHash;
    identities[tokenId].lastUpdated = block.timestamp;
    emit MetadataUpdated(tokenId, newHash);
}
```

## Access Control

```solidity
// Roles
bytes32 constant MINTER_ROLE = keccak256("MINTER_ROLE");
bytes32 constant XP_MANAGER_ROLE = keccak256("XP_MANAGER_ROLE");
bytes32 constant METADATA_MANAGER_ROLE = keccak256("METADATA_MANAGER_ROLE");

// Trusted backend can:
// - Mint identities
// - Add XP
// - Equip/unequip accessories
// - Update metadata hash
```

## Security Considerations

1. **ReentrancyGuard** on all state-changing functions
2. **Pausable** for emergency stops
3. **UUPS Upgradeable** for future improvements
4. **One identity per wallet** enforced
5. **Username uniqueness** enforced on-chain

## Gas Optimizations

- Pack struct fields efficiently
- Use `uint256` over smaller types (cheaper on 32-byte EVM)
- Batch accessory equipping
- Accessory data stored once, referenced by ID

## Events

```solidity
event IdentityMinted(address indexed owner, uint256 indexed tokenId, string username);
event LevelUp(uint256 indexed tokenId, uint256 newLevel);
event ExperienceGained(uint256 indexed tokenId, uint256 amount);
event AccessoryEquipped(uint256 indexed identityId, uint256 indexed accessoryId);
event AccessoryUnequipped(uint256 indexed identityId, uint256 indexed accessoryId);
event AchievementUnlocked(uint256 indexed tokenId, string achievement);
event MetadataUpdated(uint256 indexed tokenId, string newHash);
```

## Polygon Deployment

- **Network**: Polygon Amoy (testnet) → Polygon Mainnet
- **Gas**: ~150,000 gas for mint
- **Cost**: ~$0.01-0.05 per transaction

## Future Extensions

- Governance voting power based on identity
- Cross-chain identity bridging
- Verifiable credentials integration
- Social recovery for lost wallets
