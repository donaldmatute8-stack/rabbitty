from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional, List

# Re-export User schemas
from .user import UserBase, UserCreate, UserUpdate, UserResponse, UserStats, UserLogin

# Re-export Business schemas
from .business import BusinessBase, BusinessCreate, BusinessUpdate, BusinessResponse, BusinessNearbyRequest, BusinessNearbyResponse

# Re-export Transaction schemas
from .transaction import TransactionBase, TransactionCreate, TransactionResponse, QRScanRequest, PayRequest, TransactionStats

# Re-export Referral schemas
from .referral import ReferralBase, ReferralCreate, ReferralResponse, ReferralStats, ReferralTierConfig

# Unique authentication schemas
class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int = 86400  # 24 hours

class TokenPayload(BaseModel):
    sub: str  # telegram_id
    exp: Optional[datetime] = None

class TelegramAuthRequest(BaseModel):
    init_data: str = Field(..., description="Telegram WebApp initData string")
