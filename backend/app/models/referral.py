from sqlalchemy import Column, Integer, String, BigInteger, DateTime, Boolean, Enum
from sqlalchemy.sql import func
import enum
from app.database import Base

class ReferralTier(str, enum.Enum):
    BRONZE = "bronze"
    SILVER = "silver"
    GOLD = "gold"
    PLATINUM = "platinum"

class Referral(Base):
    __tablename__ = "referrals"
    
    id = Column(Integer, primary_key=True, index=True)
    
    # Referrer (quien invita)
    referrer_id = Column(Integer, index=True)
    
    # Referred (quien se une)
    referred_id = Column(Integer, index=True)
    
    # Code used
    referral_code = Column(String(20), index=True)
    
    # Reward
    bonus_amount = Column(BigInteger, default=50)
    is_claimed = Column(Boolean, default=False)
    claimed_at = Column(DateTime(timezone=True), nullable=True)
    
    # Tier
    tier = Column(Enum(ReferralTier), default=ReferralTier.BRONZE)
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    completed_at = Column(DateTime(timezone=True), nullable=True)

class ReferralTierConfig(Base):
    __tablename__ = "referral_tier_configs"
    
    id = Column(Integer, primary_key=True)
    tier = Column(Enum(ReferralTier), unique=True)
    min_referrals = Column(Integer)
    bonus_amount = Column(BigInteger)
    description = Column(String(200))
