from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional

class UserBase(BaseModel):
    telegram_id: int
    username: Optional[str] = None
    first_name: str
    last_name: Optional[str] = None
    photo_url: Optional[str] = None

class UserCreate(UserBase):
    pass

class UserUpdate(BaseModel):
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    photo_url: Optional[str] = None
    wallet_address: Optional[str] = None

class UserResponse(UserBase):
    id: int
    wallet_address: Optional[str] = None
    referral_code: Optional[str] = None
    total_bunz_earned: int = 0
    total_bunz_spent: int = 0
    total_referrals: int = 0
    is_active: bool = True
    is_premium: bool = False
    created_at: datetime
    last_login: Optional[datetime] = None
    
    class Config:
        from_attributes = True

class UserStats(BaseModel):
    total_bunz_earned: int
    total_bunz_spent: int
    total_referrals: int
    businesses_visited: int
    current_balance: int

class UserLogin(BaseModel):
    init_data: str
