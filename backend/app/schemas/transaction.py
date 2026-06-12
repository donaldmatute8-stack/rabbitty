from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional, Literal

class TransactionBase(BaseModel):
    user_id: int
    business_id: Optional[int] = None
    type: Literal["earned", "spent", "referral", "bonus"]
    amount: int
    description: Optional[str] = None
    category: Optional[str] = None

class TransactionCreate(TransactionBase):
    purchase_amount: Optional[float] = None
    reward_amount: Optional[int] = None
    qr_data: Optional[str] = None

class TransactionResponse(TransactionBase):
    id: int
    status: str
    purchase_amount: Optional[float] = None
    reward_amount: Optional[int] = None
    protocol_fee: int
    affiliate_fee: int
    receipt_hash: str
    tx_hash: Optional[str] = None
    created_at: datetime
    completed_at: Optional[datetime] = None
    
    class Config:
        from_attributes = True

class QRScanRequest(BaseModel):
    business_id: int
    qr_data: str = Field(..., max_length=2000)
    purchase_amount: float = Field(..., gt=0, le=1_000_000)

class PayRequest(BaseModel):
    business_id: int
    amount: int = Field(..., gt=0, le=1_000_000)

class TransactionStats(BaseModel):
    total_earned: int
    total_spent: int
    total_transactions: int
    this_month_earned: int
    this_month_spent: int
