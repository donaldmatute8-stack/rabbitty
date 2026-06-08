#!/usr/bin/env python3
"""
Rabbitty API Server - FastAPI backend for Rabbitty dApp
Handles identity, Bunz tokens, affiliates, and Web3 interactions
"""

import os
import json
import hashlib
from datetime import datetime, timedelta
from typing import Optional, Dict, List, Any
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, BackgroundTasks, Header
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
import uvicorn

# ─── Configuration ─────────────────────────────────────────────
RPC_URL = os.getenv("RPC_URL", "https://rpc-amoy.polygon.technology")
BUNZ_TOKEN_ADDRESS = os.getenv("BUNZ_TOKEN", "0x0000000000000000000000000000000000000000")
IDENTITY_NFT_ADDRESS = os.getenv("IDENTITY_NFT", "0x0000000000000000000000000000000000000000")

# ─── Pydantic Models ─────────────────────────────────────────────

class CreateIdentityRequest(BaseModel):
    wallet: str
    username: str = Field(..., min_length=3, max_length=20, pattern="^[a-zA-Z0-9_]+$")

class EquipAccessoryRequest(BaseModel):
    wallet: str
    accessoryId: int

class TransactionRecord(BaseModel):
    id: int
    amount: float
    type: str
    description: str
    date: str
    tx_hash: Optional[str] = None

class Accessory(BaseModel):
    id: int
    name: str
    type: str
    rarity: int
    power: int
    soulbound: bool
    visualAsset: str

class Identity(BaseModel):
    tokenId: str
    username: str
    level: int = 1
    experience: int = 0
    power: int = 100
    accessories: List[Accessory] = []
    achievements: List[str] = []
    createdAt: str
    metadataUri: Optional[str] = None

class UserResponse(BaseModel):
    wallet: str
    bunzBalance: str
    identity: Optional[Identity] = None
    transactions: List[TransactionRecord] = []
    referrals: int = 0
    referralCode: str
    createdAt: str

class Affiliate(BaseModel):
    id: int
    name: str
    category: str
    rewards: str
    wallet: str
    verified: bool
    location: Optional[Dict] = None
    logoUrl: Optional[str] = None

class ScanRequest(BaseModel):
    wallet: str
    affiliateId: int
    amount: float
    receiptData: Optional[Dict] = None

# ─── In-Memory Database ─────────────────
db = {
    "users": {},
    "affiliates": {},
    "accessories": {},
    "transactions": [],
    "referrals": {}
}

SAMPLE_AFFILIATES = [
    Affiliate(id=1, name="Café Cultura", category="Food", rewards="25% Bunz back", wallet="0xAFF001", verified=True, location={"lat": 19.4326, "lng": -99.1332}),
    Affiliate(id=2, name="Gimnasio Power", category="Health", rewards="20% Bunz back", wallet="0xAFF002", verified=True),
    Affiliate(id=3, name="TechZone MX", category="Electronics", rewards="15% Bunz back", wallet="0xAFF003", verified=True),
    Affiliate(id=4, name="Pizza Napoli", category="Food", rewards="30% Bunz back", wallet="0xAFF004", verified=True),
    Affiliate(id=5, name="Libros Universo", category="Retail", rewards="18% Bunz back", wallet="0xAFF005", verified=False),
]

SAMPLE_ACCESSORIES = [
    Accessory(id=1, name="Early Adopter Badge", type="badge", rarity=4, power=50, soulbound=True, visualAsset="badge_early.png"),
    Accessory(id=2, name="Silver Glow", type="effect", rarity=3, power=30, soulbound=False, visualAsset="glow_silver.png"),
    Accessory(id=3, name="Epic Frame", type="frame", rarity=4, power=45, soulbound=False, visualAsset="frame_epic.png"),
    Accessory(id=4, name="Gold Crown", type="headwear", rarity=5, power=100, soulbound=True, visualAsset="crown_gold.png"),
    Accessory(id=5, name="Cosmic Background", type="background", rarity=5, power=80, soulbound=False, visualAsset="bg_cosmic.png"),
    Accessory(id=6, name="Community Star", type="badge", rarity=3, power=25, soulbound=True, visualAsset="badge_community.png"),
]

for aff in SAMPLE_AFFILIATES:
    db["affiliates"][aff.id] = aff

for acc in SAMPLE_ACCESSORIES:
    db["accessories"][acc.id] = acc

# ─── Helper Functions ───────────────────────────────────────────

def generate_referral_code(wallet: str) -> str:
    return f"BUNZ{hashlib.sha256(wallet.encode()).hexdigest()[:6].upper()}"

def calculate_bunz_reward(mxn_amount: float, level: int) -> float:
    base_rate = 0.20
    level_bonus = (level - 1) * 0.02
    return round(mxn_amount * (base_rate + level_bonus), 2)

def calculate_xp(mxn_amount: float) -> int:
    return int(mxn_amount * 0.5)

def level_up_check(current_xp: int, current_level: int) -> tuple[int, int]:
    xp_needed = current_level * 1000
    while current_xp >= xp_needed:
        current_level += 1
        current_xp -= xp_needed
        xp_needed = current_level * 1000
    return current_level, current_xp

# ─── FastAPI App ─────────────────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    print("🚀 Rabbitty API starting...")
    yield
    print("🛑 Rabbitty API shutting down...")

app = FastAPI(
    title="Rabbitty API",
    description="Backend for Rabbitty dApp - Bunz tokens and Identity NFTs",
    version="1.0.0",
    lifespan=lifespan
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─── Routes ──────────────────────────────────────────────────────

@app.get("/")
async def root():
    return {
        "name": "Rabbitty API",
        "version": "1.0.0",
        "status": "running",
        "network": "Polygon Amoy Testnet"
    }

@app.get("/api/health")
async def health():
    return {"status": "ok", "timestamp": datetime.now().isoformat()}

# ─── User Routes ─────────────────────────────────────────────────

@app.get("/api/user/{wallet}", response_model=UserResponse)
async def get_user(wallet: str):
    if wallet not in db["users"]:
        db["users"][wallet] = {
            "wallet": wallet,
            "bunzBalance": "0.00",
            "identity": None,
            "transactions": [],
            "referrals": 0,
            "referralCode": generate_referral_code(wallet),
            "createdAt": datetime.now().isoformat()
        }
    return db["users"][wallet]

@app.post("/api/identity/create")
async def create_identity(req: CreateIdentityRequest):
    user = await get_user(req.wallet)
    
    if user["identity"]:
        raise HTTPException(400, "Identity already exists")
    
    for u in db["users"].values():
        if u.get("identity") and u["identity"]["username"] == req.username:
            raise HTTPException(400, "Username taken")
    
    token_id = hashlib.sha256(f"{req.wallet}{datetime.now()}".encode()).hexdigest()[:16]
    
    identity = {
        "tokenId": token_id,
        "username": req.username,
        "level": 1,
        "experience": 0,
        "power": 100,
        "accessories": [],
        "achievements": ["identity_created"],
        "createdAt": datetime.now().isoformat(),
        "metadataUri": f"ipfs://rabbitty/identity/{token_id}.json"
    }
    
    db["users"][req.wallet]["identity"] = identity
    db["users"][req.wallet]["bunzBalance"] = "100.00"
    
    db["users"][req.wallet]["transactions"].insert(0, {
        "id": len(db["transactions"]),
        "amount": 100.00,
        "type": "earn",
        "description": "Identity created - Welcome bonus",
        "date": datetime.now().isoformat(),
        "tx_hash": None
    })
    
    return {"success": True, "identity": identity}

@app.post("/api/identity/equip")
async def equip_accessory(req: EquipAccessoryRequest):
    user = await get_user(req.wallet)
    
    if not user["identity"]:
        raise HTTPException(400, "No identity found")
    
    accessory = db["accessories"].get(req.accessoryId)
    if not accessory:
        raise HTTPException(404, "Accessory not found")
    
    current = user["identity"]["accessories"]
    if any(a["id"] == req.accessoryId for a in current):
        raise HTTPException(400, "Accessory already equipped")
    
    user["identity"]["accessories"].append(accessory.dict())
    user["identity"]["power"] += accessory.power
    
    return {"success": True, "identity": user["identity"]}

# ─── Transaction Routes ─────────────────────────────────────────

@app.post("/api/scan")
async def scan_affiliate(req: ScanRequest):
    user = await get_user(req.wallet)
    affiliate = db["affiliates"].get(req.affiliateId)
    
    if not affiliate:
        raise HTTPException(404, "Affiliate not found")
    
    if not affiliate.verified:
        raise HTTPException(400, "Affiliate not verified")
    
    level = user["identity"]["level"] if user["identity"] else 1
    bunz_reward = calculate_bunz_reward(req.amount, level)
    xp_gain = calculate_xp(req.amount)
    
    current = float(user["bunzBalance"])
    user["bunzBalance"] = str(round(current + bunz_reward, 2))
    
    new_level = level
    if user["identity"]:
        user["identity"]["experience"] += xp_gain
        new_level, new_xp = level_up_check(user["identity"]["experience"], user["identity"]["level"])
        user["identity"]["level"] = new_level
        user["identity"]["experience"] = new_xp
    
    tx = {
        "id": len(db["transactions"]),
        "amount": bunz_reward,
        "type": "earn",
        "description": f"{bunz_reward} Bunz earned at {affiliate.name}",
        "date": datetime.now().isoformat(),
        "tx_hash": None
    }
    
    user["transactions"].insert(0, tx)
    db["transactions"].append(tx)
    
    if len(user["transactions"]) == 1 and user["identity"]:
        if "first_visit" not in user["identity"]["achievements"]:
            user["identity"]["achievements"].append("first_visit")
    
    return {
        "success": True,
        "earned": bunz_reward,
        "newBalance": user["bunzBalance"],
        "xpGained": xp_gain,
        "levelUp": new_level > level if user["identity"] else False
    }

# ─── Affiliate Routes ───────────────────────────────────────────

@app.get("/api/affiliates", response_model=List[Affiliate])
async def get_affiliates(category: Optional[str] = None):
    affs = list(db["affiliates"].values())
    if category and category != "All":
        affs = [a for a in affs if a.category == category]
    return affs

@app.get("/api/affiliates/{affiliate_id}")
async def get_affiliate(affiliate_id: int):
    aff = db["affiliates"].get(affiliate_id)
    if not aff:
        raise HTTPException(404, "Affiliate not found")
    return aff

# ─── Accessory Routes ───────────────────────────────────────────

@app.get("/api/accessories", response_model=List[Accessory])
async def get_accessories(rarity: Optional[int] = None, type: Optional[str] = None):
    accs = list(db["accessories"].values())
    if rarity:
        accs = [a for a in accs if a.rarity == rarity]
    if type:
        accs = [a for a in accs if a.type == type]
    return accs

# ─── Web3 Routes ────────────────────────────────────────────────

@app.get("/api/web3/token-info")
async def token_info():
    return {
        "name": "Bunz",
        "symbol": "BZ",
        "decimals": 18,
        "totalSupply": "1000000000",
        "contractAddress": BUNZ_TOKEN_ADDRESS,
        "network": "Polygon Amoy Testnet"
    }

@app.get("/api/web3/identity-nft/{token_id}")
async def get_nft_metadata(token_id: str):
    for user in db["users"].values():
        if user.get("identity") and user["identity"]["tokenId"] == token_id:
            identity = user["identity"]
            return {
                "name": f"Rabbitty Identity - {identity['username']}",
                "description": f"Level {identity['level']} Rabbitty Identity NFT",
                "image": f"https://api.rabbitty.io/nft/image/{token_id}.png",
                "attributes": [
                    {"trait_type": "Level", "value": identity["level"], "display_type": "number"},
                    {"trait_type": "Power", "value": identity["power"], "display_type": "number"},
                    {"trait_type": "Username", "value": identity["username"]},
                    {"trait_type": "Soulbound", "value": True},
                ] + [
                    {"trait_type": "Accessory", "value": a["name"]} 
                    for a in identity["accessories"]
                ]
            }
    raise HTTPException(404, "NFT not found")

# ─── Run ─────────────────────────────────────────────────────────

if __name__ == "__main__":
    port = int(os.getenv("PORT", 3000))
    uvicorn.run(app, host="0.0.0.0", port=port, log_level="info")
