from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List
import math

from app.database import get_db
from app.utils.security import get_current_user
from app.schemas.business import BusinessCreate, BusinessUpdate, BusinessResponse, BusinessNearbyRequest
from app.models.business import Business
from app.models.user import User
from app.services.auth import rate_limit

router = APIRouter()

@router.get("/")
async def list_businesses(
    current_user: User = Depends(get_current_user),
    skip: int = 0,
    limit: int = 100,
    category: str = None,
    db: Session = Depends(get_db),
    _=Depends(rate_limit)
):
    """Lista todos los negocios."""
    query = db.query(Business).filter(Business.is_active == True)
    
    if category:
        query = query.filter(Business.type == category)
    
    businesses = query.offset(skip).limit(limit).all()
    total = query.count()
    
    return {"items": businesses, "total": total}

@router.get("/nearby")
async def get_nearby(
    current_user: User = Depends(get_current_user),
    lat: float = None,
    lng: float = None,
    radius: int = 5000,
    db: Session = Depends(get_db)
):
    """Obtiene negocios cercanos a una ubicación."""
    businesses = db.query(Business).filter(
        Business.is_active == True,
        Business.latitude.isnot(None),
        Business.longitude.isnot(None)
    ).all()
    
    nearby = []
    for b in businesses:
        if b.latitude and b.longitude:
            lat_diff = float(b.latitude) - lat
            lng_diff = float(b.longitude) - lng
            distance = math.sqrt(lat_diff**2 + lng_diff**2) * 111
            
            if distance <= radius / 1000:
                nearby.append({
                    **BusinessResponse.from_orm(b).dict(),
                    "distance": round(distance, 1)
                })
    
    nearby.sort(key=lambda x: x['distance'])
    
    return {"items": nearby}

@router.get("/{business_id}")
async def get_business(
    business_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Obtiene detalles de un negocio."""
    business = db.query(Business).filter(Business.id == business_id).first()
    
    if not business:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Business not found")
    
    return BusinessResponse.from_orm(business)

@router.post("/")
async def create_business(
    business: BusinessCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Registra un nuevo negocio."""
    new_business = Business(
        owner_id=current_user.id,
        name=business.name,
        type=business.type,
        description=business.description,
        address=business.address,
        latitude=business.latitude,
        longitude=business.longitude,
        phone=business.phone,
        email=business.email,
        website=business.website,
        credit_limit=business.credit_limit,
        reward_rate=business.reward_rate,
    )
    
    db.add(new_business)
    db.commit()
    db.refresh(new_business)
    
    return BusinessResponse.from_orm(new_business)

@router.patch("/{business_id}/rate")
async def update_reward_rate(
    business_id: int,
    rate: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Actualiza el porcentaje de recompensa de un negocio."""
    business = db.query(Business).filter(
        Business.id == business_id,
        Business.owner_id == current_user.id
    ).first()
    
    if not business:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to update this business"
        )
    
    business.reward_rate = rate
    db.commit()
    db.refresh(business)
    
    return {"reward_rate": business.reward_rate}

@router.get("/{business_id}/analytics")
async def get_analytics(
    business_id: int,
    current_user: User = Depends(get_current_user),
    period: str = "30d",
    db: Session = Depends(get_db)
):
    """Obtiene analytics de un negocio."""
    business = db.query(Business).filter(
        Business.id == business_id,
        Business.owner_id == current_user.id
    ).first()
    
    if not business:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized")
    
    from app.models.transaction import Transaction
    
    transactions = db.query(Transaction).filter(
        Transaction.business_id == business_id
    ).count()
    
    customers = db.query(Transaction.user_id).filter(
        Transaction.business_id == business_id
    ).distinct().count()
    
    bunz_given = db.query(func.sum(Transaction.reward_amount)).filter(
        Transaction.business_id == business_id
    ).scalar() or 0
    
    return {
        "total_transactions": transactions,
        "total_customers": customers,
        "total_bunz_given": bunz_given,
        "credit_used": business.credit_used,
        "credit_limit": business.credit_limit,
        "reward_rate": business.reward_rate,
    }
