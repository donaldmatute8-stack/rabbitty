from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List

from app.database import get_db
from app.utils.security import get_current_user
from app.models.business import Business, BusinessCategory
from app.models.user import User

router = APIRouter()

@router.get("/categories")
async def get_categories(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Obtiene todas las categorías de negocios."""
    categories = db.query(BusinessCategory).all()
    
    return {"items": categories}

@router.get("/trending")
async def get_trending(
    current_user: User = Depends(get_current_user),
    limit: int = 10,
    db: Session = Depends(get_db)
):
    """Obtiene los negocios en tendencia."""
    trending = db.query(Business).filter(
        Business.is_active == True
    ).order_by(Business.total_transactions.desc()).limit(limit).all()
    
    return {"items": trending}

@router.get("/nearby")
async def get_nearby_discover(
    current_user: User = Depends(get_current_user),
    lat: float = None,
    lng: float = None,
    radius: int = 5000,
    category: str = None,
    db: Session = Depends(get_db)
):
    """Descubre negocios cercanos con filtros."""
    query = db.query(Business).filter(
        Business.is_active == True,
        Business.latitude.isnot(None),
        Business.longitude.isnot(None)
    )
    
    if category:
        query = query.filter(Business.type == category)
    
    import math
    businesses = query.all()
    
    nearby = []
    for b in businesses:
        if b.latitude and b.longitude:
            lat_diff = float(b.latitude) - lat
            lng_diff = float(b.longitude) - lng
            distance = math.sqrt(lat_diff**2 + lng_diff**2) * 111
            
            if distance <= radius / 1000:
                nearby.append({
                    "id": b.id,
                    "name": b.name,
                    "type": b.type,
                    "distance": round(distance, 1),
                    "reward_rate": b.reward_rate,
                    "rating": b.rating,
                })
    
    nearby.sort(key=lambda x: x['distance'])
    
    return {"items": nearby}

@router.get("/search")
async def search(
    current_user: User = Depends(get_current_user),
    q: str = None,
    db: Session = Depends(get_db)
):
    """Busca negocios por nombre o tipo."""
    results = db.query(Business).filter(
        Business.is_active == True,
        Business.name.ilike(f"%{q}%") | Business.type.ilike(f"%{q}%")
    ).all()
    
    return {"items": results, "query": q}
