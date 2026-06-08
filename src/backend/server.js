const express = require('express');
const cors = require('cors');
const { ethers } = require('ethers');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(cors());

// Contract ABIs (placeholder - would be populated after deployment)
const BUNZ_TOKEN_ABI = [
  "function balanceOf(address owner) view returns (uint256)",
  "function transfer(address to, uint256 amount) returns (bool)",
  "function mint(address to, uint256 amount)",
  "function burn(uint256 amount)",
  "event Transfer(address indexed from, address indexed to, uint256 value)"
];

const IDENTITY_NFT_ABI = [
  "function createIdentity(string username, string metadataURI) returns (uint256)",
  "function equipAccessory(uint256 tokenId, uint256 accessoryId)",
  "function unequipAccessory(uint256 tokenId, uint256 accessoryIndex)",
  "function getIdentity(uint256 tokenId) view returns (tuple(string,uint256,uint256,uint256,bool,string), tuple(string,string,string,uint256,uint256,bool,uint256)[])",
  "function getIdentityByWallet(address wallet) view returns (uint256, tuple(string,uint256,uint256,uint256,bool,string), tuple(string,string,string,uint256,uint256,bool,uint256)[])",
  "function userToTokenId(address) view returns (uint256)",
  "function hasIdentity(address) view returns (bool)",
  "function calculatePower(uint256 tokenId) view returns (uint256)",
  "function addExperience(uint256 tokenId, uint256 amount)",
  "function registerAccessory(string name, string accessoryType, string visualAsset, uint256 rarity, uint256 power, bool soulbound) returns (uint256)"
];

// In-memory database (would be PostgreSQL in production)
const db = {
  users: new Map(),
  transactions: [],
  affiliates: [
    { id: 1, name: 'Bunz Coffee', category: 'Food', rewards: '5 BZ per order', wallet: '0x1234...', verified: true },
    { id: 2, name: 'Rabbit Gym', category: 'Health', rewards: '10 BZ per session', wallet: '0x5678...', verified: true },
    { id: 3, name: 'Tech Supplies MX', category: 'Electronics', rewards: '2 BZ per $100', wallet: '0x9abc...', verified: true },
  ],
  rewards: new Map(), // user -> accumulated rewards
  identities: new Map(), // user -> identity data
  accessories: new Map() // accessoryId -> accessory data
};

// Initialize default accessories
const defaultAccessories = [
  { id: 1, name: "Newbie Badge", type: "badge", visualAsset: "ipfs://badge1", rarity: 1, power: 10, soulbound: true },
  { id: 2, name: "Bronze Frame", type: "frame", visualAsset: "ipfs://frame1", rarity: 1, power: 5, soulbound: false },
  { id: 3, name: "Early Adopter", type: "badge", visualAsset: "ipfs://badge2", rarity: 2, power: 25, soulbound: true },
  { id: 4, name: "Silver Glow", type: "effect", visualAsset: "ipfs://effect1", rarity: 2, power: 15, soulbound: false },
  { id: 5, name: "Gold Crown", type: "headwear", visualAsset: "ipfs://crown1", rarity: 3, power: 50, soulbound: false },
];

defaultAccessories.forEach(acc => db.accessories.set(acc.id, acc));

// Web3 provider (Polygon Mumbai testnet)
const provider = new ethers.JsonRpcProvider(process.env.POLYGON_RPC_URL || 'https://rpc-mumbai.maticvigil.com');

// Contract instances (would be initialized after deployment)
let bunzTokenContract = null;
let identityContract = null;

function initializeContracts() {
  if (process.env.BUNZ_TOKEN_ADDRESS) {
    bunzTokenContract = new ethers.Contract(
      process.env.BUNZ_TOKEN_ADDRESS,
      BUNZ_TOKEN_ABI,
      provider
    );
  }
  if (process.env.IDENTITY_NFT_ADDRESS) {
    identityContract = new ethers.Contract(
      process.env.IDENTITY_NFT_ADDRESS,
      IDENTITY_NFT_ABI,
      provider
    );
  }
}

// Routes

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    network: 'Polygon Mumbai',
    bunzToken: process.env.BUNZ_TOKEN_ADDRESS ? 'connected' : 'not deployed',
    identityNFT: process.env.IDENTITY_NFT_ADDRESS ? 'connected' : 'not deployed'
  });
});

// Get user profile with Bunz balance and Identity
app.get('/api/user/:wallet', async (req, res) => {
  const { wallet } = req.params;
  
  if (!db.users.has(wallet)) {
    // Create new user
    db.users.set(wallet, {
      wallet,
      createdAt: new Date().toISOString(),
      totalEarned: 0,
      totalSpent: 0,
      transactions: [],
      identityTokenId: null,
      referralCode: generateReferralCode(wallet)
    });
  }
  
  const user = db.users.get(wallet);
  
  // Get Bunz balance from blockchain
  let bunzBalance = '0';
  if (bunzTokenContract) {
    try {
      const balance = await bunzTokenContract.balanceOf(wallet);
      bunzBalance = ethers.formatEther(balance);
    } catch (e) {
      console.error('Error fetching Bunz balance:', e);
    }
  }
  
  // Get Identity from blockchain
  let identity = null;
  if (identityContract) {
    try {
      const hasIdentity = await identityContract.hasIdentity(wallet);
      if (hasIdentity) {
        const tokenId = await identityContract.userToTokenId(wallet);
        const [identityData, accessories] = await identityContract.getIdentity(tokenId);
        const power = await identityContract.calculatePower(tokenId);
        identity = {
          tokenId: tokenId.toString(),
          username: identityData[0],
          level: identityData[1].toString(),
          experience: identityData[2].toString(),
          createdAt: identityData[3].toString(),
          active: identityData[4],
          metadataURI: identityData[5],
          accessories: accessories.map((acc, i) => ({
            index: i,
            name: acc[0],
            type: acc[1],
            visualAsset: acc[2],
            rarity: acc[3].toString(),
            power: acc[4].toString(),
            soulbound: acc[5],
            equippedAt: acc[6].toString()
          })),
          power: power.toString()
        };
      }
    } catch (e) {
      console.error('Error fetching identity:', e);
    }
  }
  
  res.json({
    ...user,
    bunzBalance,
    identity: identity || db.identities.get(wallet) || null
  });
});

// Create Identity NFT
app.post('/api/identity/create', async (req, res) => {
  const { wallet, username, metadataURI } = req.body;
  
  if (!wallet || !username) {
    return res.status(400).json({ error: 'Wallet and username required' });
  }
  
  // In production, this would be a blockchain transaction
  // For now, mock the creation
  const tokenId = Date.now().toString();
  
  const identity = {
    tokenId,
    username,
    level: 1,
    experience: 0,
    createdAt: Date.now(),
    active: true,
    metadataURI: metadataURI || `ipfs://rabbitty/identity/${tokenId}`,
    accessories: [],
    power: 100 // Base power
  };
  
  db.identities.set(wallet, identity);
  
  // Auto-equip newbie badge
  const newbieBadge = db.accessories.get(1);
  identity.accessories.push({
    ...newbieBadge,
    index: 0,
    equippedAt: Date.now().toString()
  });
  
  res.json({ success: true, identity });
});

// Equip accessory
app.post('/api/identity/equip', async (req, res) => {
  const { wallet, accessoryId } = req.body;
  
  const identity = db.identities.get(wallet);
  if (!identity) {
    return res.status(404).json({ error: 'Identity not found' });
  }
  
  const accessory = db.accessories.get(parseInt(accessoryId));
  if (!accessory) {
    return res.status(404).json({ error: 'Accessory not found' });
  }
  
  // Check if already equipped
  const exists = identity.accessories.some(a => a.id === accessory.id);
  if (exists) {
    return res.status(400).json({ error: 'Accessory already equipped' });
  }
  
  identity.accessories.push({
    ...accessory,
    index: identity.accessories.length,
    equippedAt: Date.now().toString()
  });
  
  // Recalculate power
  identity.power = 100 + identity.accessories.reduce((sum, a) => sum + a.power, 0);
  
  res.json({ success: true, identity });
});

// Unequip accessory
app.post('/api/identity/unequip', async (req, res) => {
  const { wallet, accessoryIndex } = req.body;
  
  const identity = db.identities.get(wallet);
  if (!identity) {
    return res.status(404).json({ error: 'Identity not found' });
  }
  
  const accessory = identity.accessories[accessoryIndex];
  if (!accessory) {
    return res.status(404).json({ error: 'Accessory not found' });
  }
  
  if (accessory.soulbound) {
    return res.status(400).json({ error: 'Cannot unequip soulbound accessory' });
  }
  
  identity.accessories.splice(accessoryIndex, 1);
  
  // Recalculate power
  identity.power = 100 + identity.accessories.reduce((sum, a) => sum + a.power, 0);
  
  res.json({ success: true, identity });
});

// Add experience (called after earning/spending Bunz)
app.post('/api/identity/xp', (req, res) => {
  const { wallet, amount } = req.body;
  
  const identity = db.identities.get(wallet);
  if (!identity) {
    return res.status(404).json({ error: 'Identity not found' });
  }
  
  const oldLevel = identity.level;
  identity.experience += amount;
  
  // Level up formula: level = (xp / 1000) + 1
  const newLevel = Math.floor(identity.experience / 1000) + 1;
  
  if (newLevel > oldLevel) {
    identity.level = newLevel;
    // Grant level up reward
    const reward = newLevel * 10; // 10 BZ per level
    addReward(wallet, reward, 'level_up');
  }
  
  res.json({ success: true, identity, leveledUp: newLevel > oldLevel });
});

// Get available accessories
app.get('/api/accessories', (req, res) => {
  const accessories = Array.from(db.accessories.values());
  res.json(accessories);
});

// Get affiliates
app.get('/api/affiliates', (req, res) => {
  res.json(db.affiliates);
});

// Get specific affiliate
app.get('/api/affiliates/:id', (req, res) => {
  const affiliate = db.affiliates.find(a => a.id === parseInt(req.params.id));
  if (!affiliate) {
    return res.status(404).json({ error: 'Affiliate not found' });
  }
  res.json(affiliate);
});

// Earn Bunz (give to get)
app.post('/api/earn', (req, res) => {
  const { userId, amount, businessId, description } = req.body;
  
  const affiliate = db.affiliates.find(a => a.id === businessId);
  if (!affiliate) {
    return res.status(404).json({ error: 'Business not found' });
  }
  
  // Calculate Bunz reward (20% of spend as base)
  const baseReward = amount * 0.20;
  
  // Multiplier based on business tier
  const tierMultiplier = affiliate.verified ? 1.5 : 1.0;
  
  // Network effect: if user has referrals
  const user = db.users.get(userId);
  const referralBonus = user && user.referrals ? user.referrals.length * 0.05 : 1.0;
  
  const totalReward = baseReward * tierMultiplier * referralBonus;
  
  // Add reward
  addReward(userId, totalReward, `purchase_${businessId}`, description);
  
  // Add experience
  if (db.identities.has(userId)) {
    const identity = db.identities.get(userId);
    identity.experience += Math.floor(totalReward);
    const newLevel = Math.floor(identity.experience / 1000) + 1;
    if (newLevel > identity.level) {
      identity.level = newLevel;
    }
  }
  
  // Record transaction
  const transaction = {
    id: Date.now(),
    userId,
    amount: totalReward,
    type: 'earn',
    businessId,
    description: description || `Purchase at ${affiliate.name}`,
    date: new Date().toISOString()
  };
  db.transactions.push(transaction);
  
  res.json({
    status: 'success',
    earned: totalReward,
    newBalance: (db.rewards.get(userId) || 0),
    transaction
  });
});

// Spend Bunz
app.post('/api/spend', (req, res) => {
  const { userId, amount, businessId, description } = req.body;
  
  const currentBalance = db.rewards.get(userId) || 0;
  
  if (currentBalance < amount) {
    return res.status(400).json({ error: 'Insufficient balance' });
  }
  
  // Deduct Bunz
  db.rewards.set(userId, currentBalance - amount);
  
  // Record transaction
  const transaction = {
    id: Date.now(),
    userId,
    amount: -amount,
    type: 'spend',
    businessId,
    description: description || 'Bunz redemption',
    date: new Date().toISOString()
  };
  db.transactions.push(transaction);
  
  res.json({
    status: 'success',
    spent: amount,
    newBalance: db.rewards.get(userId),
    transaction
  });
});

// Get transaction history
app.get('/api/transactions/:userId', (req, res) => {
  const userTransactions = db.transactions
    .filter(t => t.userId === req.params.userId)
    .sort((a, b) => new Date(b.date) - new Date(a.date));
  res.json(userTransactions);
});

// Generate referral code
function generateReferralCode(wallet) {
  return 'RAB' + wallet.slice(2, 8).toUpperCase();
}

// Add reward helper
function addReward(userId, amount, source, description = '') {
  const current = db.rewards.get(userId) || 0;
  db.rewards.set(userId, current + amount);
  
  // Update user totals
  const user = db.users.get(userId);
  if (user) {
    user.totalEarned += amount;
  }
}

// Leaderboard
app.get('/api/leaderboard', (req, res) => {
  const sorted = Array.from(db.users.entries())
    .map(([wallet, user]) => ({
      wallet: wallet.slice(0, 6) + '...' + wallet.slice(-4),
      totalEarned: user.totalEarned,
      identity: db.identities.get(wallet)?.username || 'Anonymous'
    }))
    .sort((a, b) => b.totalEarned - a.totalEarned)
    .slice(0, 10);
  
  res.json(sorted);
});

// Start server
app.listen(PORT, () => {
  console.log(`🐰 Rabbitty Backend running on port ${PORT}`);
  console.log(`   Network: Polygon Mumbai`);
  console.log(`   Contracts: ${process.env.BUNZ_TOKEN_ADDRESS ? 'Bunz ✓' : 'Bunz ✗'}`);
  console.log(`              ${process.env.IDENTITY_NFT_ADDRESS ? 'Identity ✓' : 'Identity ✗'}`);
  initializeContracts();
});
