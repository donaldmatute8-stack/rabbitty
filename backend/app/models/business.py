from sqlalchemy import Column, Integer, String, BigInteger, DateTime, Boolean, Float, Text, Numeric
from sqlalchemy.sql import func
from app.database import Base

class Business(Base):
    __tablename__ = "businesses"
    
    id = Column(Integer, primary_key=True, index=True)
    owner_id = Column(Integer, index=True)
    
    # Info
    name = Column(String(200), index=True)
    type = Column(String(50), index=True)
    description = Column(Text)
    logo_url = Column(String(500))
    
    # Location
    address = Column(String(500))
    latitude = Column(Numeric(10, 8))
    longitude = Column(Numeric(11, 8))
    
    # Contact
    phone = Column(String(20))
    email = Column(String(100))
    website = Column(String(200))
    
    # Credit & Rewards
    credit_limit = Column(BigInteger, default=0)
    credit_used = Column(BigInteger, default=0)
    reward_rate = Column(Integer, default=20)  # Porcentaje
    
    # Stats
    total_transactions = Column(Integer, default=0)
    total_customers = Column(Integer, default=0)
    total_bunz_given = Column(BigInteger, default=0)
    rating = Column(Float, default=5.0)
    
    # Status
    is_active = Column(Boolean, default=True)
    is_verified = Column(Boolean, default=False)
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

class BusinessCategory(Base):
    __tablename__ = "business_categories"
    
    id = Column(Integer, primary_key=True)
    name = Column(String(50), unique=True)
    icon = Column(String(50))
    description = Column(String(200))
