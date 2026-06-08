// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Counters.sol";
import "@openzeppelin/contracts/utils/Base64.sol";
import "@openzeppelin/contracts/utils/Strings.sol";

/**
 * @title RabbittyIdentityNFT
 * @dev Dynamic NFT for user identity with attachable accessories/artifacts
 * Each user has a unique, evolving identity that can be customized with accessories
 * 
 * Security: 
 * - Only the NFT owner can equip/unequip accessories
 * - Accessories are soulbound once equipped (cannot be transferred separately)
 * - Identity is non-transferable (soulbound) - tied to the wallet
 */
contract RabbittyIdentityNFT is ERC721URIStorage, ERC721Enumerable, Ownable {
    using Counters for Counters.Counter;
    using Strings for uint256;
    using Strings for address;

    Counters.Counter private _tokenIds;

    // Identity data structure
    struct Identity {
        string username;
        uint256 level;
        uint256 experience;
        uint256 createdAt;
        bool active;
        string metadataURI; // Off-chain metadata (IPFS/Arweave)
    }

    // Accessory/Artifact structure
    struct Accessory {
        string name;
        string accessoryType; // "badge", "frame", "background", "effect", etc.
        string visualAsset;   // IPFS hash or URL to asset
        uint256 rarity;       // 1=Common, 2=Uncommon, 3=Rare, 4=Epic, 5=Legendary
        uint256 power;        // Game mechanic value
        bool soulbound;       // Cannot be unequipped
        uint256 equippedAt;
    }

    // Mappings
    mapping(uint256 => Identity) public identities;
    mapping(uint256 => Accessory[]) public equippedAccessories;
    mapping(address => uint256) public userToTokenId;
    mapping(uint256 => mapping(string => uint256)) public accessoryIndex; // tokenId -> accessoryType -> index
    mapping(address => bool) public hasIdentity;
    mapping(string => bool) public usernameExists;

    // Registry of available accessories (can be minted/managed by admin)
    mapping(uint256 => Accessory) public accessoryRegistry;
    Counters.Counter private _accessoryIds;

    // Events
    event IdentityCreated(address indexed owner, uint256 tokenId, string username);
    event AccessoryEquipped(uint256 indexed tokenId, string accessoryName, string accessoryType);
    event AccessoryUnequipped(uint256 indexed tokenId, string accessoryName);
    event ExperienceGained(uint256 indexed tokenId, uint256 amount, uint256 newLevel);
    event LevelUp(uint256 indexed tokenId, uint256 newLevel);
    event MetadataUpdated(uint256 indexed tokenId);

    // Errors
    error IdentityAlreadyExists();
    error UsernameTaken();
    error IdentityNotFound();
    error NotIdentityOwner();
    error AccessoryAlreadyEquipped();
    error AccessoryNotEquipped();
    error SoulboundAccessory();
    error InvalidAccessoryType();
    error MaxAccessoriesReached();

    // Constants
    uint256 public constant MAX_ACCESSORIES_PER_TYPE = 5;
    uint256 public constant XP_PER_LEVEL = 1000;

    constructor() ERC721("Rabbitty Identity", "RIDENT") Ownable(msg.sender) {}

    /**
     * @dev Create a new identity for the caller
     * @param _username Unique username for the identity
     * @param _metadataURI Off-chain metadata URI (IPFS preferred)
     */
    function createIdentity(string memory _username, string memory _metadataURI) 
        external 
        returns (uint256)
    {
        if (hasIdentity[msg.sender]) revert IdentityAlreadyExists();
        if (usernameExists[_username]) revert UsernameTaken();
        if (bytes(_username).length == 0 || bytes(_username).length > 20) 
            revert InvalidAccessoryType();

        _tokenIds.increment();
        uint256 newTokenId = _tokenIds.current();

        // Mint the NFT
        _safeMint(msg.sender, newTokenId);

        // Create identity data
        identities[newTokenId] = Identity({
            username: _username,
            level: 1,
            experience: 0,
            createdAt: block.timestamp,
            active: true,
            metadataURI: _metadataURI
        });

        // Mappings
        userToTokenId[msg.sender] = newTokenId;
        hasIdentity[msg.sender] = true;
        usernameExists[_username] = true;

        emit IdentityCreated(msg.sender, newTokenId, _username);

        return newTokenId;
    }

    /**
     * @dev Equip an accessory to the identity
     * @param _tokenId Identity token ID
     * @param _accessoryId ID of the accessory from registry
     */
    function equipAccessory(uint256 _tokenId, uint256 _accessoryId) external {
        if (ownerOf(_tokenId) != msg.sender) revert NotIdentityOwner();

        Accessory memory accessory = accessoryRegistry[_accessoryId];
        if (bytes(accessory.name).length == 0) revert AccessoryNotEquipped();

        // Check if already has this type
        if (accessoryIndex[_tokenId][accessory.accessoryType] > 0) {
            revert AccessoryAlreadyEquipped();
        }

        // Check max accessories per type
        uint256 count = 0;
        for (uint i = 0; i < equippedAccessories[_tokenId].length; i++) {
            if (keccak256(bytes(equippedAccessories[_tokenId][i].accessoryType)) 
                == keccak256(bytes(accessory.accessoryType))) {
                count++;
            }
        }
        if (count >= MAX_ACCESSORIES_PER_TYPE) revert MaxAccessoriesReached();

        // Equip the accessory
        accessory.equippedAt = block.timestamp;
        equippedAccessories[_tokenId].push(accessory);
        accessoryIndex[_tokenId][accessory.accessoryType] = equippedAccessories[_tokenId].length;

        emit AccessoryEquipped(_tokenId, accessory.name, accessory.accessoryType);
        emit MetadataUpdated(_tokenId);
    }

    /**
     * @dev Unequip an accessory
     * @param _tokenId Identity token ID
     * @param _accessoryIndex Index in the equipped accessories array
     */
    function unequipAccessory(uint256 _tokenId, uint256 _accessoryIndex) external {
        if (ownerOf(_tokenId) != msg.sender) revert NotIdentityOwner();

        Accessory storage accessory = equippedAccessories[_tokenId][_accessoryIndex];
        
        if (bytes(accessory.name).length == 0) revert AccessoryNotEquipped();
        if (accessory.soulbound) revert SoulboundAccessory();

        string memory accessoryName = accessory.name;

        // Remove from mapping
        delete accessoryIndex[_tokenId][accessory.accessoryType];

        // Remove from array (swap and pop for gas efficiency)
        uint256 lastIndex = equippedAccessories[_tokenId].length - 1;
        if (_accessoryIndex != lastIndex) {
            equippedAccessories[_tokenId][_accessoryIndex] = equippedAccessories[_tokenId][lastIndex];
        }
        equippedAccessories[_tokenId].pop();

        emit AccessoryUnequipped(_tokenId, accessoryName);
        emit MetadataUpdated(_tokenId);
    }

    /**
     * @dev Add experience points (called by game/business logic)
     * @param _tokenId Identity token ID
     * @param _amount Amount of XP to add
     */
    function addExperience(uint256 _tokenId, uint256 _amount) external onlyOwner {
        Identity storage identity = identities[_tokenId];
        identity.experience += _amount;

        // Check for level up
        uint256 newLevel = (identity.experience / XP_PER_LEVEL) + 1;
        if (newLevel > identity.level) {
            identity.level = newLevel;
            emit LevelUp(_tokenId, newLevel);
        }

        emit ExperienceGained(_tokenId, _amount, identity.level);
    }

    /**
     * @dev Admin function to register a new accessory type
     */
    function registerAccessory(
        string memory _name,
        string memory _accessoryType,
        string memory _visualAsset,
        uint256 _rarity,
        uint256 _power,
        bool _soulbound
    ) external onlyOwner returns (uint256) {
        _accessoryIds.increment();
        uint256 accessoryId = _accessoryIds.current();

        accessoryRegistry[accessoryId] = Accessory({
            name: _name,
            accessoryType: _accessoryType,
            visualAsset: _visualAsset,
            rarity: _rarity,
            power: _power,
            soulbound: _soulbound,
            equippedAt: 0
        });

        return accessoryId;
    }

    /**
     * @dev Update metadata URI (for dynamic updates)
     */
    function updateMetadata(uint256 _tokenId, string memory _newURI) external {
        if (ownerOf(_tokenId) != msg.sender) revert NotIdentityOwner();
        identities[_tokenId].metadataURI = _newURI;
        emit MetadataUpdated(_tokenId);
    }

    /**
     * @dev Generate dynamic token URI with on-chain data
     */
    function tokenURI(uint256 _tokenId) 
        public 
        view 
        override(ERC721, ERC721URIStorage) 
        returns (string memory) 
    {
        require(_exists(_tokenId), "Token does not exist");

        Identity memory identity = identities[_tokenId];
        
        // Build JSON metadata
        string memory json = Base64.encode(bytes(string(abi.encodePacked(
            '{',
            '"name": "', identity.username, ' | Rabbitty Identity",',
            '"description": "Dynamic NFT identity for Rabbitty ecosystem",',
            '"image": "', _generateImageURI(_tokenId), '",',
            '"attributes": [',
                '{"trait_type": "Level", "value": ', uint256(identity.level).toString(), '},',
                '{"trait_type": "Experience", "value": ', uint256(identity.experience).toString(), '},',
                '{"trait_type": "Created", "display_type": "date", "value": ', uint256(identity.createdAt).toString(), '},',
                '{"trait_type": "Accessories", "value": ', uint256(equippedAccessories[_tokenId].length).toString(), '}',
            '],',
            '"external_url": "https://rabbitty.io/identity/', uint256(_tokenId).toString(), '"',
            '}'
        ))));

        return string(abi.encodePacked('data:application/json;base64,', json));
    }

    /**
     * @dev Generate image URI (would be replaced with actual image generation or IPFS)
     */
    function _generateImageURI(uint256 _tokenId) internal view returns (string memory) {
        // In production, this would return an IPFS hash or URL to a dynamically generated image
        // For now, return the stored metadata URI
        return identities[_tokenId].metadataURI;
    }

    /**
     * @dev Get full identity data
     */
    function getIdentity(uint256 _tokenId) 
        external 
        view 
        returns (Identity memory, Accessory[] memory) 
    {
        return (identities[_tokenId], equippedAccessories[_tokenId]);
    }

    /**
     * @dev Get identity by wallet address
     */
    function getIdentityByWallet(address _wallet) 
        external 
        view 
        returns (uint256, Identity memory, Accessory[] memory) 
    {
        uint256 tokenId = userToTokenId[_wallet];
        return (tokenId, identities[tokenId], equippedAccessories[tokenId]);
    }

    /**
     * @dev Override required functions
     */
    function _beforeTokenTransfer(address from, address to, uint256 tokenId, uint256 batchSize)
        internal
        override(ERC721, ERC721Enumerable)
    {
        super._beforeTokenTransfer(from, to, tokenId, batchSize);
        
        // Soulbound: Prevent transfers (except mint and burn)
        if (from != address(0) && to != address(0)) {
            revert("Identity is soulbound and non-transferable");
        }
    }

    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(ERC721, ERC721Enumerable, ERC721URIStorage)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }

    function _burn(uint256 tokenId) internal override(ERC721, ERC721URIStorage) {
        super._burn(tokenId);
    }

    /**
     * @dev Get all accessory types currently equipped
     */
    function getEquippedAccessoryTypes(uint256 _tokenId) 
        external 
        view 
        returns (string[] memory) 
    {
        Accessory[] memory accessories = equippedAccessories[_tokenId];
        string[] memory types = new string[](accessories.length);
        
        for (uint i = 0; i < accessories.length; i++) {
            types[i] = accessories[i].accessoryType;
        }
        
        return types;
    }

    /**
     * @dev Calculate total power score from all accessories
     */
    function calculatePower(uint256 _tokenId) external view returns (uint256) {
        uint256 totalPower = identities[_tokenId].level * 100;
        
        Accessory[] memory accessories = equippedAccessories[_tokenId];
        for (uint i = 0; i < accessories.length; i++) {
            totalPower += accessories[i].power;
        }
        
        return totalPower;
    }
}
