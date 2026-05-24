# Bunz Token - Smart Contract Specification

## Overview
ERC-20 reward token for Rabbitty ecosystem. Distributed via affiliate transactions.

## Standards
- **ERC-20** - Base token standard
- **ERC-20 Burnable** - Token burning capability
- **ERC-20 Pausable** - Emergency pause
- **ERC-20 Permit** - Gasless approvals (EIP-2612)

## Tokenomics

```solidity
// Basic Info
string public constant name = "Bunz";
string public constant symbol = "BZ";
uint8 public constant decimals = 18;
uint256 public constant INITIAL_SUPPLY = 1_000_000_000 * 10**18; // 1B tokens

// Distribution
uint256 constant ECOSYSTEM_RESERVE = 400_000_000 * 10**18;  // 40% - rewards
uint256 constant TEAM_ALLOCATION = 150_000_000 * 10**18;     // 15% - vesting
uint256 constant COMMUNITY = 200_000_000 * 10**18;          // 20% - airdrops
uint256 constant LIQUIDITY = 150_000_000 * 10**18;          // 15% - DEX
uint256 constant TREASURY = 100_000_000 * 10**18;          // 10% - operations
```

## Core Features

### 1. Minting Control
```solidity
// Only authorized minters (backend) can mint new Bunz
mapping(address => bool) public authorizedMinters;

function mintRewards(address to, uint256 amount) external onlyAuthorizedMinter {
    _mint(to, amount);
    emit RewardsMinted(to, amount, msg.sender);
}

// Cap at 2x initial supply (2B max)
uint256 public constant MAX_SUPPLY = 2_000_000_000 * 10**18;

function mint(address to, uint256 amount) internal {
    require(totalSupply() + amount <= MAX_SUPPLY, "Max supply exceeded");
    _mint(to, amount);
}
```

### 2. Affiliate Claims
```solidity
struct Claim {
    uint256 amount;
    uint256 affiliateId;
    uint256 timestamp;
    bytes32 receiptHash;
    bool claimed;
}

mapping(address => Claim[]) public userClaims;
mapping(bytes32 => bool) public receiptUsed; // Prevent double-claiming

function claimRewards(
    address user,
    uint256 amount,
    uint256 affiliateId,
    bytes32 receiptHash,
    bytes calldata signature
) external {
    require(!receiptUsed[receiptHash], "Already claimed");
    require(_verifyClaim(user, amount, affiliateId, receiptHash, signature), "Invalid signature");
    
    receiptUsed[receiptHash] = true;
    
    // 95% to user, 5% to referrer if exists
    address referrer = referrers[user];
    if (referrer != address(0)) {
        uint256 refBonus = amount * 5 / 100; // 5%
        _mint(user, amount - refBonus);
        _mint(referrer, refBonus);
        emit ReferralReward(referrer, user, refBonus);
    } else {
        _mint(user, amount);
    }
    
    userClaims[user].push(Claim({
        amount: amount,
        affiliateId: affiliateId,
        timestamp: block.timestamp,
        receiptHash: receiptHash,
        claimed: true
    }));
    
    emit RewardsClaimed(user, amount, affiliateId);
}

// Signature verification
function _verifyClaim(...) internal view returns (bool) {
    bytes32 message = keccak256(abi.encodePacked(user, amount, affiliateId, receiptHash));
    bytes32 hash = message.toEthSignedMessageHash();
    return hash.recover(signature) == claimSigner;
}
```

### 3. Referral System
```solidity
mapping(address => address) public referrers; // user => referrer
mapping(address => uint256) public referralCount;

function setReferrer(address user, address referrer) external onlyAuthorized {
    require(referrers[user] == address(0), "Referrer already set");
    require(user != referrer, "Cannot refer self");
    referrers[user] = referrer;
    referralCount[referrer]++;
    emit ReferrerSet(user, referrer);
}
```

### 4. Burning
```solidity
// Users can burn Bunz for perks, discounts, etc.
function burnForPerk(uint256 amount, uint256 perkId) external {
    _burn(msg.sender, amount);
    emit PerkRedeemed(msg.sender, perkId, amount);
}

// Automatic burn on certain actions (deflationary)
uint256 public constant BURN_RATE = 100; // 1% = 100/10000

function _transferWithBurn(address from, address to, uint256 amount) internal {
    uint256 burnAmount = amount * BURN_RATE / 10000;
    uint256 sendAmount = amount - burnAmount;
    
    _burn(from, burnAmount);
    _transfer(from, to, sendAmount);
}
```

### 5. Staking (Future)
```solidity
struct Stake {
    uint256 amount;
    uint256 startTime;
    uint256 duration; // 30, 90, 180 days
    bool withdrawn;
}

mapping(address => Stake[]) public stakes;

function stake(uint256 amount, uint256 duration) external {
    require(duration >= 30 days, "Min 30 days");
    require(transferFrom(msg.sender, address(this), amount), "Transfer failed");
    
    stakes[msg.sender].push(Stake({
        amount: amount,
        startTime: block.timestamp,
        duration: duration,
        withdrawn: false
    }));
    
    emit Staked(msg.sender, amount, duration);
}

function calculateReward(uint256 stakeIndex) public view returns (uint256) {
    Stake memory s = stakes[msg.sender][stakeIndex];
    uint256 apy = s.duration >= 180 days ? 20 : s.duration >= 90 days ? 15 : 10; // % APY
    uint256 timeElapsed = block.timestamp - s.startTime;
    return s.amount * apy * timeElapsed / (365 days * 100);
}
```

## Access Control

```solidity
bytes32 constant MINTER_ROLE = keccak256("MINTER_ROLE");
bytes32 constant PAUSER_ROLE = keccak256("PAUSER_ROLE");
bytes32 constant CLAIM_SIGNER_ROLE = keccak256("CLAIM_SIGNER_ROLE");

// Roles managed by OpenZeppelin AccessControl
```

## Security

1. **ReentrancyGuard** on claim function
2. **Signature replay protection** via receipt hash
3. **Pause capability** for emergencies
4. **Max supply cap** to prevent infinite inflation
5. **Time-locked team allocation** (vesting)

## Events

```solidity
event RewardsMinted(address indexed to, uint256 amount, address indexed minter);
event RewardsClaimed(address indexed user, uint256 amount, uint256 indexed affiliateId);
event ReferralReward(address indexed referrer, address indexed referred, uint256 amount);
event ReferrerSet(address indexed user, address indexed referrer);
event PerkRedeemed(address indexed user, uint256 indexed perkId, uint256 amount);
event Staked(address indexed user, uint256 amount, uint256 duration);
event Unstaked(address indexed user, uint256 amount, uint256 reward);
```

## Gas Optimizations

- Batch claims for multiple transactions
- Claim verification off-chain (signature-based)
- Minimal storage writes
- Use `uint96` for amounts where possible (packs with addresses)

## Polygon Benefits

- **Low gas**: ~$0.001 per transfer
- **Fast finality**: ~2 seconds
- **Eco-friendly**: PoS consensus
- **Large DeFi ecosystem**: Easy liquidity

## Deployment

1. Deploy token contract
2. Mint initial supply to treasury
3. Set up authorized minters (backend wallets)
4. Configure claim signer
5. Distribute allocations (vesting for team)
6. Add liquidity to DEX
