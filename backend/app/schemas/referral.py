from pydantic import BaseModel
from datetime import datetime
from typing import Optional, Literal

class ReferralBase(BaseModel):
    referrer_id: int
    referred_id: int
    referral_code: str
    bonus_amount: int = 50

class ReferralCreate(BaseModel):
    referral_code: str

class ReferralResponse(ReferralBase):
    id: int
    is_claimed: bool
    claimed_at: Optional[datetime] = None
    tier: str
    created_at: datetime
    completed_at: Optional[datetime] = None
    
    class Config:
        from_attributes = True

class ReferralStats(BaseModel):
    total_referrals: int
    total_earned: int
    pending_claims: int
    current_tier: str
    next_tier: Optional[str] = None
    referrals_to_next_tier: int = 0

class ReferralTierConfig(BaseModel):
    tier: str
    min_referrals: int
    bonus_amount: int
    description: str
