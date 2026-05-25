from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional, List

class UserBase(BaseModel):
    telegram_id: int = Field(..., description="Telegram user ID")
    username: Optional[str] = None
    first_name: str
    last_name: Optional[str] = None
    photo_url: Optional[str] = None
    wallet_address: Optional[str] = None
    referral_code: str = Field(..., description="Unique referral code")
    referred_by: Optional[str] = None
    points: int = Field(default=0, description="Total loyalty points")
    bunz_balance: float = Field(default=0.0, description="BUNZ token balance")
    created_at: datetime
    last_active: datetime

class UserResponse(UserBase):
    id: int

    class Config:
        from_attributes = True

class UserUpdate(BaseModel):
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    photo_url: Optional[str] = None

class TelegramAuthRequest(BaseModel):
    init_data: str = Field(..., description="Telegram WebApp initData string")

class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int = 86400  # 24 hours

class TokenPayload(BaseModel):
    sub: str  # telegram_id
    exp: Optional[datetime] = None

class BusinessBase(BaseModel):
    name: str
    description: Optional[str] = None
    address: str
    phone: Optional[str] = None
    email: Optional[str] = None
    photo_url: Optional[str] = None
    category: str  # restaurant, cafe, retail, etc.
    subcategory: Optional[str] = None
    rating: float = Field(default=0.0, ge=0, le=5)
    review_count: int = Field(default=0)
    latitude: float
    longitude: float
    reward_percentage: float = Field(default=5.0, ge=0, le=100, description="Percentage of purchase returned as points")
    is_active: bool = Field(default=True)
    opens_at: Optional[str] = None  # "09:00"
    closes_at: Optional[str] = None  # "21:00"
    owner_id: int

class BusinessResponse(BusinessBase):
    id: int
    created_at: datetime
    distance_km: Optional[float] = None  # populated for nearby queries

    class Config:
        from_attributes = True

class BusinessListResponse(BaseModel):
    businesses: List[BusinessResponse]
    total: int
    page: int
    per_page: int

class BusinessUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    address: Optional[str] = None
    phone: Optional[str] = None
    reward_percentage: Optional[float] = None
    is_active: Optional[bool] = None

class TransactionBase(BaseModel):
    user_id: int
    business_id: int
    amount: float
    points_earned: float
    points_redeemed: float = Field(default=0.0)
    transaction_type: str  # "earn", "redeem", "bonus"
    status: str = Field(default="completed", description="pending, completed, cancelled")
    qr_code: Optional[str] = None

class TransactionResponse(TransactionBase):
    id: int
    created_at: datetime
    business_name: Optional[str] = None  # joined field
    business_photo: Optional[str] = None  # joined field

    class Config:
        from_attributes = True

class TransactionHistoryResponse(BaseModel):
    transactions: List[TransactionResponse]
    total: int
    page: int
    per_page: int
    total_earned: float
    total_redeemed: float

class ScanQRRequest(BaseModel):
    qr_data: str = Field(..., description="QR code data string")
    latitude: Optional[float] = None
    longitude: Optional[float] = None

class PaymentRequest(BaseModel):
    business_id: int
    amount: float
    points_to_redeem: float = Field(default=0.0, description="Points to use for payment")

class PaymentResponse(BaseModel):
    transaction_id: int
    amount_paid: float
    points_redeemed: float
    remaining_balance: float
    status: str

class ReceiptResponse(BaseModel):
    transaction_id: int
    user_name: str
    business_name: str
    amount: float
    points_earned: float
    points_redeemed: float
    date: datetime
    qr_code: Optional[str] = None

class ReferralBase(BaseModel):
    referrer_id: int
    referred_id: int
    referrer_code: str
    points_awarded: float = Field(default=50.0, description="Points given to referrer")
    is_claimed: bool = Field(default=False)

class ReferralResponse(ReferralBase):
    id: int
    created_at: datetime
    referred_user: Optional[UserResponse] = None

    class Config:
        from_attributes = True

class ReferralListResponse(BaseModel):
    referrals: List[ReferralResponse]
    total_referrals: int
    total_points_earned: float
    referral_code: str

class CreateReferralRequest(BaseModel):
    custom_code: Optional[str] = Field(None, min_length=4, max_length=20)

class FeedPost(BaseModel):
    id: int
    type: str  # "transaction", "referral", "achievement", "promotion"
    user_id: Optional[int] = None
    user_name: Optional[str] = None
    user_photo: Optional[str] = None
    business_id: Optional[int] = None
    business_name: Optional[str] = None
    business_photo: Optional[str] = None
    content: str
    points: Optional[float] = None
    likes: int = Field(default=0)
    comments: int = Field(default=0)
    created_at: datetime

class FeedResponse(BaseModel):
    posts: List[FeedPost]
    total: int
    page: int
    per_page: int

class NearbyRequest(BaseModel):
    latitude: float = Field(..., ge=-90, le=90)
    longitude: float = Field(..., ge=-180, le=180)
    radius_km: float = Field(default=5.0, gt=0, le=50)
    category: Optional[str] = None

class LeaderboardEntry(BaseModel):
    rank: int
    user_id: int
    user_name: str
    user_photo: Optional[str] = None
    points: int
    is_current_user: bool = False

class LeaderboardResponse(BaseModel):
    entries: List[LeaderboardEntry]
    user_rank: Optional[int] = None
    total_users: int
