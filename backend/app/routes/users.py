from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List

from app.database import get_db
from app.utils.security import get_current_user
from app.schemas.user import UserResponse, UserUpdate, UserStats
from app.models.user import User
from app.models.transaction import Transaction
from app.models.business import Business
from app.services.auth import rate_limit

router = APIRouter()

@router.get("/me")
async def get_me(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    _=Depends(rate_limit)
):
    """Obtiene el perfil del usuario actual."""
    return UserResponse.from_orm(current_user)

@router.patch("/me")
async def update_me(
    user_update: UserUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    _=Depends(rate_limit)
):
    """Actualiza el perfil del usuario."""
    if user_update.first_name:
        current_user.first_name = user_update.first_name
    if user_update.last_name:
        current_user.last_name = user_update.last_name
    if user_update.photo_url:
        current_user.photo_url = user_update.photo_url
    if user_update.wallet_address:
        current_user.wallet_address = user_update.wallet_address
    
    db.commit()
    db.refresh(current_user)
    
    return UserResponse.from_orm(current_user)

@router.get("/me/balance")
async def get_balance(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Obtiene el balance actual de bunz del usuario."""
    earned = db.query(func.sum(Transaction.amount)).filter(
        Transaction.user_id == current_user.id,
        Transaction.type == 'earned'
    ).scalar() or 0
    
    spent = db.query(func.sum(Transaction.amount)).filter(
        Transaction.user_id == current_user.id,
        Transaction.type == 'spent'
    ).scalar() or 0
    
    balance = earned - spent
    
    return {"balance": balance, "earned": earned, "spent": spent}

@router.get("/me/stats")
async def get_stats(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Obtiene estadísticas del usuario."""
    earned = db.query(func.sum(Transaction.amount)).filter(
        Transaction.user_id == current_user.id,
        Transaction.type == 'earned'
    ).scalar() or 0
    
    spent = db.query(func.sum(Transaction.amount)).filter(
        Transaction.user_id == current_user.id,
        Transaction.type == 'spent'
    ).scalar() or 0
    
    businesses_visited = db.query(func.count(Transaction.business_id.distinct())).filter(
        Transaction.user_id == current_user.id
    ).scalar() or 0
    
    balance = earned - spent
    
    return UserStats(
        total_bunz_earned=earned,
        total_bunz_spent=spent,
        total_referrals=current_user.total_referrals,
        businesses_visited=businesses_visited,
        current_balance=balance,
    )

@router.get("/me/feed")
async def get_feed(
    current_user: User = Depends(get_current_user),
    tab: str = "bunz'in",
    db: Session = Depends(get_db)
):
    """Obtiene el feed personalizado del usuario."""
    # Lógica de feed según tab
    if tab == "bunz'in":
        businesses = db.query(Business).filter(
            Business.is_active == True,
            Business.reward_rate > 0
        ).all()
        return {"items": businesses}
    
    elif tab == "Stock":
        businesses = db.query(Business).filter(
            Business.is_active == True
        ).all()
        return {"items": businesses}
    
    else:
        businesses = db.query(Business).filter(
            Business.is_active == True
        ).all()
        return {"items": businesses}

@router.get("/me/history")
async def get_history(
    current_user: User = Depends(get_current_user),
    limit: int = 50,
    offset: int = 0,
    type: str = None,
    db: Session = Depends(get_db)
):
    """Obtiene el historial de transacciones del usuario."""
    query = db.query(Transaction).filter(Transaction.user_id == current_user.id)
    
    if type:
        query = query.filter(Transaction.type == type)
    
    transactions = query.order_by(Transaction.created_at.desc()).offset(offset).limit(limit).all()
    
    return {"items": transactions, "total": query.count()}
