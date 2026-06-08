from sqlalchemy import Column, Integer, String, BigInteger, DateTime, Boolean, Float, Text
from sqlalchemy.sql import func
from app.database import Base

class User(Base):
    __tablename__ = "users"
    
    id = Column(Integer, primary_key=True, index=True)
    telegram_id = Column(BigInteger, unique=True, index=True)
    username = Column(String(50), index=True)
    first_name = Column(String(100))
    last_name = Column(String(100))
    photo_url = Column(String(500))
    wallet_address = Column(String(42), unique=True, index=True)
    referral_code = Column(String(20), unique=True, index=True)
    referred_by = Column(Integer, nullable=True)
    
    # Stats
    total_bunz_earned = Column(BigInteger, default=0)
    total_bunz_spent = Column(BigInteger, default=0)
    total_referrals = Column(Integer, default=0)
    
    # Status
    is_active = Column(Boolean, default=True)
    is_premium = Column(Boolean, default=False)
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    last_login = Column(DateTime(timezone=True))

class UserSession(Base):
    __tablename__ = "user_sessions"
    
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, index=True)
    token = Column(String(500))
    refresh_token = Column(String(500))
    expires_at = Column(DateTime(timezone=True))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    is_active = Column(Boolean, default=True)
