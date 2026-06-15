from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional, List
from decimal import Decimal

class BusinessBase(BaseModel):
    name: str = Field(..., min_length=2, max_length=200)
    type: str = Field(..., min_length=2, max_length=50)
    description: Optional[str] = None
    address: Optional[str] = None
    latitude: Optional[Decimal] = None
    longitude: Optional[Decimal] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    website: Optional[str] = None

class BusinessCreate(BusinessBase):
    owner_id: int
    credit_limit: int = Field(default=100000, ge=1000, le=10000000)
    reward_rate: int = Field(default=20, ge=1, le=100)

class BusinessUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    reward_rate: Optional[int] = Field(None, ge=10, le=200)
    credit_limit: Optional[int] = None
    is_active: Optional[bool] = None

class BusinessResponse(BusinessBase):
    id: int
    owner_id: int
    credit_limit: int
    credit_used: int
    reward_rate: int
    total_transactions: int
    total_customers: int
    total_bunz_given: int
    rating: float
    is_active: bool
    is_verified: bool
    created_at: datetime
    
    class Config:
        from_attributes = True

class BusinessNearbyRequest(BaseModel):
    latitude: Decimal
    longitude: Decimal
    radius: int = 5000  # metros

class BusinessNearbyResponse(BaseModel):
    id: int
    name: str
    type: str
    distance: float
    reward_rate: int
    rating: float
    latitude: Decimal
    longitude: Decimal
