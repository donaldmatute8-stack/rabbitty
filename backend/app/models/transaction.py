from sqlalchemy import Column, Integer, String, BigInteger, DateTime, Boolean, Numeric, Enum, Text
from sqlalchemy.sql import func
import enum
from app.database import Base

class TransactionType(str, enum.Enum):
    EARNED = "earned"
    SPENT = "spent"
    REFERRAL = "referral"
    BONUS = "bonus"

class TransactionStatus(str, enum.Enum):
    PENDING = "pending"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"

class Transaction(Base):
    __tablename__ = "transactions"
    
    id = Column(Integer, primary_key=True, index=True)
    
    # Parties
    user_id = Column(Integer, index=True)
    business_id = Column(Integer, index=True, nullable=True)
    
    # Transaction details
    type = Column(Enum(TransactionType))
    status = Column(Enum(TransactionStatus), default=TransactionStatus.COMPLETED)
    amount = Column(BigInteger)
    
    # For purchases
    purchase_amount = Column(Numeric(20, 2), nullable=True)
    reward_amount = Column(BigInteger, nullable=True)
    
    # Fees
    protocol_fee = Column(BigInteger, default=0)
    affiliate_fee = Column(BigInteger, default=0)
    
    # Receipt
    receipt_hash = Column(String(64), unique=True, index=True)
    qr_data = Column(String(500))
    
    # Metadata
    description = Column(String(200))
    category = Column(String(50))
    
    # Blockchain
    tx_hash = Column(String(66), nullable=True)
    block_number = Column(Integer, nullable=True)
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    completed_at = Column(DateTime(timezone=True), nullable=True)
