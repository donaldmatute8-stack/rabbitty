# Rabbitty Smart Contracts - Audit Report

**Contracts Audited:**
- `RabbittyIdentity.sol` — Soulbound Identity NFT
- `BunzToken.sol` — ERC-20 Reward Token

**Date:** 2026-05-23
**Auditor:** Subagent (Sofía / OpenClaw)
**Methodology:** Static code review + manual security analysis + tokenomics modeling

---

## Executive Summary

| Category | Score (1-10) | Status |
|----------|-------------|--------|
| **Security** | 6.5/10 | ⚠️ Multiple MEDIUM/HIGH issues |
| **Gas Efficiency** | 5.5/10 | ⚠️ Significant optimization needed |
| **Tokenomics** | 5/10 | ⚠️ Critical concerns on sustainability |
| **Code Quality** | 7/10 | ✅ Good structure, some issues |
| **Overall** | **6/10** | ⚠️ **NOT production-ready** |

**Verdict:** The contracts have a solid foundation with OpenZeppelin upgradeable patterns, but contain several security vulnerabilities, gas inefficiencies, and **critical tokenomics risks** that must be addressed before mainnet deployment.

---

## 1. SECURITY FINDINGS

### 🔴 CRITICAL

#### C1: Double-Spend Vector in `claimRewardsOnBehalf` — ADMIN ABUSE / MISSING SIGNATURE
**File:** `BunzToken.sol`  
**Function:** `claimRewardsOnBehalf()` (line ~155)

**Issue:** The admin-function `claimRewardsOnBehalf` mints tokens to any user WITHOUT signature verification. The only check is `onlyRole(MINTER_ROLE)`. This means:
- Any compromised MINTER_ROLE key can infinite-mint up to MAX_SUPPLY
- No receipt validation beyond `receiptUsed` mapping
- Backend can be tricked into re-claiming if receiptHash collision or backend bug

**Impact:** HIGH — Complete trust assumption on backend. Compromised minter = unlimited inflation.

**Fix:** Add multi-sig requirement, timelock, or require 2-of-3 signer approval for `claimRewardsOnBehalf`.

```solidity
// RECOMMENDED: Add at least a second signature or timelock
mapping(bytes32 => uint256) public receiptClaimTimelock;
uint256 public constant CLAIM_DELAY = 1 hours;
```

---

#### C2: Signature Replay Across Chains / Contract Versions
**File:** `BunzToken.sol`  
**Function:** `claimRewards()` (line ~120)

**Issue:** The signature scheme `keccak256(abi.encodePacked(msg.sender, amount, affiliateId, receiptHash))` does NOT include:
- `chainId` (EIP-155 not in message)
- `address(this)` (contract address)
- `block.chainid` or any domain separator

**Impact:** HIGH — Same signature valid on:
- Different chains (Polygon, BSC, testnets)
- Future upgraded contract instances
- Forked chains

**Fix:** Implement EIP-712 typed data signing:
```solidity
bytes32 DOMAIN_SEPARATOR = keccak256(abi.encode(
    keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"),
    keccak256(bytes(NAME)),
    keccak256(bytes("1")),
    block.chainid,
    address(this)
));
```

---

#### C3: Uncapped Referral Bonus = Infinite Inflation Risk
**File:** `BunzToken.sol`  
**Function:** `claimRewards()` (line ~135)

**Issue:** Referral bonus is 5% of claim amount. With self-referral or circular referrals (A→B→C→A), users can drain the reward pool. While `setReferrer` has some checks, there's no:
- Maximum referral depth
- Sybil resistance (one user = multiple wallets)
- Cooldown between referrals

**Impact:** MEDIUM-HIGH — Incentive for fake accounts, rapid inflation.

**Fix:**
- Add `MAX_REFERRAL_DEPTH = 3`
- Require identity/NFT for referral eligibility
- Add anti-sybil: referrer must hold tokens for X days

---

### 🟡 HIGH

#### H1: Reentrancy in `equipAccessory` / `unequipAccessory`
**File:** `RabbittyIdentity.sol`  
**Functions:** `equipAccessory()`, `unequipAccessory()`

**Issue:** Both functions have `nonReentrant` modifier BUT they emit events AFTER state changes. More critically, `accessoryToIdentity` mapping is updated but no reentrancy guard on external calls if metadata URI fetch is added later. Currently safe, but fragile.

**Status:** Currently safe (no external calls), but `nonReentrant` is correctly placed. ✅

**However:** `_updatePower()` is called after external state changes. If future upgrades add hooks, reentrancy becomes possible.

**Fix:** Keep `nonReentrant`, but also follow Checks-Effects-Interactions pattern strictly.

---

#### H2: Missing `nonReentrant` on `mintIdentity`
**File:** `RabbittyIdentity.sol`  
**Function:** `mintIdentity()`

**Issue:** `_safeMint` calls `onERC721Received` on the recipient (if contract). This is an external call BEFORE all state is written:
```solidity
_safeMint(to, tokenId);  // external callback here
// ... state updates AFTER
```

**Impact:** MEDIUM — If `to` is a malicious contract, it could reenter. While `_safeMint` has some guards, the state inconsistency window exists.

**Fix:** Use `_mint` instead of `_safeMint` OR add `nonReentrant` modifier.

---

#### H3: No Rate Limiting on XP/Claims
**File:** Both contracts

**Issue:** XP_MANAGER_ROLE and MINTER_ROLE can:
- Add unlimited XP to any identity
- Mint unlimited rewards (up to MAX_SUPPLY)
- No daily caps, no per-user limits, no cooldowns

**Impact:** MEDIUM — Admin abuse or compromised key = economic damage

**Fix:** Add rate limiters:
```solidity
mapping(uint256 => uint256) public lastXpUpdate;
uint256 public constant XP_COOLDOWN = 1 hours;
```

---

### 🟢 MEDIUM

#### M1: `transfer` / `transferFrom` Burn Logic is Broken
**File:** `BunzToken.sol`  
**Functions:** `transfer()`, `transferFrom()`

**Issue:** The override subtracts burnAmount from `amount`, then calls `super.transfer(to, sendAmount)`. But `super.transfer` ALSO calls `_transfer` which triggers `_beforeTokenTransfer` hooks. The allowance reduction in `transferFrom` is custom and bypasses `ERC20._spendAllowance`.

**Specific bugs:**
1. `transferFrom` manually does `_approve(from, msg.sender, currentAllowance - amount)` instead of using `_spendAllowance`. This is non-standard and could break with OpenZeppelin updates.
2. The burn is done with `_burn(msg.sender, ...)` in `transferFrom` but should be `_burn(from, ...)`.

**Code:**
```solidity
// BUG: In transferFrom, burns from msg.sender instead of 'from'
_burn(msg.sender, burnAmount);  // ❌ Should be _burn(from, burnAmount)
```

**Impact:** MEDIUM — Incorrect burn source in `transferFrom`. Could burn from wrong account.

**Fix:**
```solidity
function transferFrom(address from, address to, uint256 amount) public virtual override returns (bool) {
    uint256 burnAmount = (amount * BURN_RATE) / 10000;
    uint256 sendAmount = amount - burnAmount;
    
    _spendAllowance(from, msg.sender, amount);  // Use OZ standard
    
    if (burnAmount > 0) {
        _burn(from, burnAmount);  // Burn from 'from', not msg.sender
        totalBurned += burnAmount;
    }
    
    _transfer(from, to, sendAmount);
    return true;
}
```

---

#### M2: Username Length Check Inefficient
**File:** `RabbittyIdentity.sol`  
**Function:** `mintIdentity()`

**Issue:** `bytes(username).length >= 3 && bytes(username).length <= 20` uses `bytes()` which counts UTF-8 bytes, not characters. Emoji or multi-byte chars count as multiple bytes.

**Impact:** LOW — User experience issue. "A" (1 char) = 1 byte, "🐰" (1 char) = 4 bytes.

**Fix:** Document this behavior or use character-count library.

---

#### M3: Missing Input Validation on `createAccessory`
**File:** `RabbittyIdentity.sol`  
**Function:** `createAccessory()`

**Issue:** No validation on:
- `powerBonus` (could be extremely high)
- `name` length or content
- `metadataURI` format

**Impact:** LOW — Could create game-breaking accessories with insane power.

**Fix:** Add:
```solidity
require(powerBonus <= 10000, "Power bonus too high");
require(bytes(name).length > 0 && bytes(name).length <= 50, "Invalid name");
```

---

#### M4: `_exists()` Deprecated in OpenZeppelin v5
**File:** `RabbittyIdentity.sol`

**Issue:** OpenZeppelin v5 renamed `_exists()` to `_exists`. Using older versions works, but upgrade path needs care.

**Impact:** LOW — Compilation issue on upgrade.

**Fix:** Pin OpenZeppelin version: `^4.9.3` or update to v5 and use `_ownerOf(tokenId) != address(0)`.

---

#### M5: No Events for Critical State Changes
**File:** `BunzToken.sol`

**Issue:** `setClaimSigner()`, `pause()`, `unpause()` emit no events.

**Fix:** Add events for all admin actions.

---

## 2. GAS OPTIMIZATION FINDINGS

### 🔴 CRITICAL

#### GC1: Storage Loops in `_updatePower` and `unlockAchievement`
**File:** `RabbittyIdentity.sol`

**Issue:** `_updatePower()` iterates over `equippedAccessories` array in STORAGE. For each accessory, it reads from `accessories` mapping (storage → SLOAD = 2100 gas cold, 100 warm). If a user has 20 accessories, that's 20+ SLOADs.

**unlockAchievement** loops through ALL achievements to check duplicates. O(n) storage loop.

**Impact:** HIGH — Gas costs scale linearly with accessories/achievements. Could hit block gas limit.

**Fix:**
```solidity
// Use mapping for O(1) achievement check
mapping(uint256 => mapping(bytes32 => bool)) public hasAchievement;

// Cache storage array in memory
uint256[] memory equipped = identity.equippedAccessories;
for (uint i = 0; i < equipped.length; i++) {
    // reads from memory, not storage
}
```

---

#### GC2: Dynamic Arrays in Struct (Storage Layout)
**File:** `RabbittyIdentity.sol`

**Issue:** `IdentityData` struct contains:
```solidity
uint256[] equippedAccessories;  // dynamic array in struct = slot hash
string[] achievements;         // another dynamic array
```

These dynamic arrays are stored in separate storage slots (keccak256 hash of slot). Every push/pop is expensive.

**Fix:** Consider limiting max accessories (e.g., 10) and using fixed-size arrays, or store accessories in a separate mapping.

---

### 🟡 HIGH

#### GH1: Redundant `onlyIdentityOwner` Modifier
**File:** `RabbittyIdentity.sol`

**Issue:** `onlyIdentityOwner` calls `ownerOf(tokenId)` which does an SLOAD. Then the function does `_exists(tokenId)` which is another check. These can be combined.

**Fix:**
```solidity
modifier onlyIdentityOwner(uint256 tokenId) {
    require(_exists(tokenId), "Identity does not exist");
    require(ownerOf(tokenId) == msg.sender, "Not owner");
    _;
}
```

---

#### GH2: `batchMintRewards` Double-Loop
**File:** `BunzToken.sol`

**Issue:** First loop sums amounts, second loop mints. Could be single loop with running total.

**Fix:**
```solidity
uint256 totalAmount = 0;
for (uint i = 0; i < recipients.length; i++) {
    totalAmount += amounts[i];
    require(totalSupply() + totalAmount <= MAX_SUPPLY, "Max supply exceeded");
    _mint(recipients[i], amounts[i]);
}
```

---

#### GH3: `abi.encodePacked` in Signature = Gas Inefficient + Unsafe
**File:** `BunzToken.sol`

**Issue:** `abi.encodePacked` with dynamic types (`address`, `uint256`) can have collision issues. Also less gas efficient than `abi.encode` for fixed types.

**Fix:** Use `abi.encode` + EIP-712 (see C2 fix).

---

### 🟢 MEDIUM

#### GM1: `calldata` vs `memory` Params
**File:** Both contracts

**Issue:** Functions like `mintIdentity(address to, string calldata username)` correctly use `calldata` for strings. But `getIdentityByUsername(string calldata username)` then looks up `usernameToIdentity[username]` — the mapping key hashing reads from calldata, which is fine.

**Status:** Mostly correct. ✅

---

#### GM2: No Packing in `IdentityData` Struct
**File:** `RabbittyIdentity.sol`

**Issue:** Struct fields:
```solidity
string username;      // slot 0 (dynamic)
uint256 level;        // slot 1
uint256 experience;   // slot 2
uint256 power;        // slot 3
uint256[] equipped;   // slot 4 (dynamic)
string[] achievements;// slot 5 (dynamic)
uint256 createdAt;    // slot 6
uint256 lastUpdated;  // slot 7
```

`level` could be `uint16` (max 65,535 levels — enough). `power` could be `uint32` or `uint64`. This would allow packing.

**Fix:**
```solidity
struct IdentityData {
    string username;
    uint16 level;        // packs with below if reordered
    uint64 power;        // 
    uint256 experience;  // needs full slot
    uint256 createdAt;
    uint256 lastUpdated;
    uint256[] equippedAccessories;
    string[] achievements;
}
```

---

## 3. TOKENOMICS ANALYSIS (CRITICAL)

### Supply Mechanics

| Parameter | Value | Assessment |
|-----------|-------|------------|
| **INITIAL_SUPPLY** | 1,000,000,000 BZ | 50% of max, reasonable |
| **MAX_SUPPLY** | 2,000,000,000 BZ | Hard cap, good |
| **Burn Rate** | 1% per transfer | Weak deflationary pressure |
| **Base Reward** | 20% of purchase | EXTREMELY HIGH |
| **Level Bonus** | +2% per level | Capped only by MAX_SUPPLY |
| **Referral** | 5% of claim | Circular risk |

### 🔴 CRITICAL: 20% Base Reward Rate is Unsustainable

**Math:**
- User spends $100 → gets $20 worth of BZ
- To maintain value, platform needs 20% margin MINIMUM just to break even on rewards
- With level 10 user: 20% + 18% = 38% reward
- With referral: +5% = 43% effective reward

**Comparison:**
- Credit card cashback: 1-5%
- Typical loyalty points: 1-10%
- Axie Infinity SLP (failed): uncapped, crashed
- Stepn GST (failed): high rewards, crashed

**Impact:** CRITICAL — This is a ponzi-like velocity. Early users drain the reward pool. Late users get nothing. Token price collapses.

**Recommendation:**
```
BASE_RATE: 2000 (20%) → 500 (5%)
LEVEL_BONUS_RATE: 200 (2%) → 100 (1%)
REFERRAL_BONUS_RATE: 500 (5%) → 250 (2.5%)
```

---

### 🔴 CRITICAL: No Daily/Weekly Mint Cap

**Issue:** `mintRewards` and `claimRewards` have no time-based limits. The entire MAX_SUPPLY can be minted in a single transaction (batch) or over a few days.

**Impact:** Flash inflation. If there's a bug or exploit, all 2B tokens can be minted instantly.

**Fix:**
```solidity
uint256 public dailyMintCap = 10_000_000 * 10**18; // 10M/day
uint256 public lastMintReset;
uint256 public dailyMinted;

function mintRewards(...) {
    if (block.timestamp > lastMintReset + 1 days) {
        lastMintReset = block.timestamp;
        dailyMinted = 0;
    }
    require(dailyMinted + amount <= dailyMintCap, "Daily cap exceeded");
    dailyMinted += amount;
    // ... rest
}
```

---

### 🟡 HIGH: 1% Burn is Insufficient

**Analysis:**
- To offset 20% minting, you need 20x the transfer volume in burns
- At 1% burn, you need 2000% of reward value in transfers just to break even
- This is impossible unless token has massive utility

**Recommendation:**
- Increase burn to 2-3% OR
- Reduce rewards to 5% OR
- Add additional sinks (perks, governance, staking)

---

### 🟡 HIGH: MAX_SUPPLY = 2B May Be Too High

**Analysis:**
- 1B initial + 1B for rewards
- At 20% base rate, 1B reward pool = $5B in purchases (if BZ = $1)
- If BZ price drops to $0.01, that's $50B in purchases
- This assumes the token holds value, which it won't at these rates

**Recommendation:**
- Consider lower MAX_SUPPLY (500M-1B)
- Or make MAX_SUPPLY adjustable by governance (with timelock)
- Or add halving mechanism (reward rates halve every X tokens minted)

---

### 🟢 MEDIUM: No Staking / Locking Mechanism

**Issue:** Users can dump rewards immediately. No vesting, no staking, no lock-up.

**Fix:** Add minimum lock-up period or staking multiplier:
```solidity
function claimRewards(...) {
    // Mint to staking contract instead of wallet
    stakingContract.stake(msg.sender, amount, 30 days);
}
```

---

## 4. FUNCTIONALITY ANALYSIS

### Soulbound Implementation

**Status:** ✅ Correctly implemented

- `_beforeTokenTransfer` allows only mint (from=0) and burn (to=0)
- `locked()` always returns true
- Complies with ERC-5192 minimal soulbound

**Improvement:** Add explicit `burn` function for user-initiated identity deletion (with cooldown).

---

### XP/Leveling System

**Issue:** Linear level curve `(experience / 1000) + 1`. This means:
- Level 1: 0 XP
- Level 2: 1,000 XP
- Level 10: 9,000 XP
- Level 100: 99,000 XP

**Assessment:** Very fast progression. Should be exponential:
```solidity
// Exponential: level^2 * 1000
uint256 requiredXp = (level * level) * 1000;
```

This makes high levels meaningful and rare.

---

### Signature Verification

**Status:** ⚠️ Functional but flawed (see C2)

- Uses `toEthSignedMessageHash` — correct
- Uses `ECDSA.recover` — correct
- Missing EIP-712 domain separator — CRITICAL
- No signature expiration (nonce/timestamp) — HIGH

**Fix:**
```solidity
struct ClaimRequest {
    address user;
    uint256 amount;
    uint256 affiliateId;
    bytes32 receiptHash;
    uint256 deadline;  // signature expiration
    uint256 nonce;     // prevent replay
}
```

---

### Pausable Functionality

**Status:** ✅ Correctly implemented

- `whenNotPaused` on claims and transfers
- Separate PAUSER_ROLE
- No critical functions left unpauseable

---

### Upgrade Pattern (UUPS)

**Status:** ⚠️ Functional but risky

- `_authorizeUpgrade` checks `UPGRADER_ROLE` — good
- But: Single address with UPGRADER_ROLE = centralization risk
- No timelock on upgrades
- No upgrade event emission

**Fix:**
- Add 2-day timelock for upgrades
- Require multi-sig for UPGRADER_ROLE
- Emit `UpgradeScheduled` / `UpgradeExecuted` events

---

## 5. REWARDS SYSTEM ANALYSIS

### Claim Double-Spending Prevention

**Status:** ✅ Correct

- `receiptUsed[receiptHash]` mapping prevents double claims
- `userClaims` array provides audit trail

**Improvement:** Add receipt hash generation documentation to prevent backend collisions.

---

### Backend Integration Points

**Vulnerabilities:**
1. `claimRewardsOnBehalf` has no signature requirement — backend compromise = total loss
2. No rate limiting on backend claims
3. No IP whitelist for backend minter

**Recommendations:**
- Use dedicated `BACKEND_ROLE` separate from `MINTER_ROLE`
- Add IP-based access control (if possible)
- Require HMAC or secondary signature for `claimRewardsOnBehalf`

---

### Gasless vs On-Chain Tradeoffs

**Current Design:** Hybrid
- Signature-based claims (gasless for user, backend pays)
- Admin `claimRewardsOnBehalf` (fully backend-paid)

**Issue:** Users still need gas for:
- First token receive (no account abstraction)
- Transfers
- `burnForPerk`

**Recommendation:** Consider ERC-4337 account abstraction or meta-transactions (ERC-2771) for true gasless experience.

---

## 6. RECOMMENDED CHANGES BEFORE DEPLOY

### Must Fix (Blocking)

| # | Issue | Priority | Effort |
|---|-------|----------|--------|
| 1 | Implement EIP-712 for signatures | CRITICAL | Medium |
| 2 | Fix `transferFrom` burn source (`_burn(from, ...)`) | CRITICAL | Low |
| 3 | Add rate limits / daily mint caps | CRITICAL | Medium |
| 4 | Reduce BASE_RATE from 20% to 5% | CRITICAL | Low |
| 5 | Add signature requirement to `claimRewardsOnBehalf` | CRITICAL | Medium |
| 6 | Add chainId + contract address to signature | HIGH | Low |
| 7 | Fix storage loops (cache in memory, use mappings) | HIGH | Medium |
| 8 | Add anti-sybil to referral system | HIGH | Medium |

### Should Fix (Important)

| # | Issue | Priority | Effort |
|---|-------|----------|--------|
| 9 | Add upgrade timelock | HIGH | Low |
| 10 | Add events to admin functions | MEDIUM | Low |
| 11 | Add `nonReentrant` to `mintIdentity` | MEDIUM | Low |
| 12 | Add input validation on `createAccessory` | MEDIUM | Low |
| 13 | Optimize `IdentityData` struct packing | MEDIUM | Low |
| 14 | Add vesting/lock-up to rewards | MEDIUM | Medium |
| 15 | Add signature expiration (deadline) | MEDIUM | Low |

### Nice to Have

| # | Issue | Priority | Effort |
|---|-------|----------|--------|
| 16 | Add batch equip/unequip | LOW | Medium |
| 17 | Add achievement categories/weights | LOW | Medium |
| 18 | Consider ERC-4337 for gasless | LOW | High |
| 19 | Add on-chain governance for params | LOW | High |

---

## 7. DEPLOYMENT CHECKLIST

- [ ] All CRITICAL fixes implemented
- [ ] Re-audit after fixes
- [ ] Deploy to testnet (Sepolia/Amoy)
- [ ] Run fuzz tests (Echidna/Foundry)
- [ ] Run slither / mythril static analysis
- [ ] Test signature replay across chains
- [ ] Test reentrancy with malicious ERC721 receiver
- [ ] Simulate tokenomics over 1 year
- [ ] Set up multi-sig for admin roles
- [ ] Add timelock contract for upgrades
- [ ] Deploy proxy + implementation separately
- [ ] Verify contracts on Etherscan
- [ ] Document all backend integration points
- [ ] Set up monitoring / alerting

---

## 8. CONCLUSION

**Overall Security Score: 6/10**

The Rabbitty contracts demonstrate good architectural choices (UUPS, OpenZeppelin, AccessControl) but have significant issues in three areas:

1. **Security:** Signature replay, missing chain validation, broken `transferFrom` burn logic, and admin abuse vectors are all serious.

2. **Gas:** Storage loops and unoptimized structs will cause pain at scale.

3. **Tokenomics:** The 20% base reward rate is the biggest threat. It will drain the reward pool rapidly, create unsustainable sell pressure, and likely collapse the token price. This needs immediate reduction to 5% or less.

**Recommendation:** Do NOT deploy to mainnet without addressing all CRITICAL and HIGH issues. Budget 2-3 weeks for fixes + re-audit.

---

*Report generated by OpenClaw Subagent*  
*For questions, escalate to security review team*
