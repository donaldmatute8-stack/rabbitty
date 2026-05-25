from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List

from app.database import get_db
from app.utils.security import decode_token
from app.schemas.user import UserResponse, UserUpdate, UserStats
from app.models.user import User
from app.models.transaction import Transaction
from app.models.business import Business

router = APIRouter()

def get_current_user(token: str, db: Session) -> User:
    """Obtiene el usuario actual del token JWT."""
    payload = decode_token(token)
    
    if not payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token"
        )
    
    user_id = int(payload.get('sub'))
    user = db.query(User).filter(User.id == user_id).first()
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    return user

@router.get("/me")
async def get_me(token: str, db: Session = Depends(get_db)):
    """Obtiene el perfil del usuario actual."""
    user = get_current_user(token, db)
    return UserResponse.from_orm(user)

@router.patch("/me")
async def update_me(
    user_update: UserUpdate,
    token: str,
    db: Session = Depends(get_db)
):
    """Actualiza el perfil del usuario."""
    user = get_current_user(token, db)
    
    if user_update.first_name:
        user.first_name = user_update.first_name
    if user_update.last_name:
        user.last_name = user_update.last_name
    if user_update.photo_url:
        user.photo_url = user_update.photo_url
    if user_update.wallet_address:
        user.wallet_address = user_update.wallet_address
    
    db.commit()
    db.refresh(user)
    
    return UserResponse.from_orm(user)

@router.get("/me/balance")
async def get_balance(token: str, db: Session = Depends(get_db)):
    """Obtiene el balance actual de bunz del usuario."""
    user = get_current_user(token, db)
    
    # Calcular balance
    earned = db.query(func.sum(Transaction.amount)).filter(
        Transaction.user_id == user.id,
        Transaction.type == 'earned'
    ).scalar() or 0
    
    spent = db.query(func.sum(Transaction.amount)).filter(
        Transaction.user_id == user.id,
        Transaction.type == 'spent'
    ).scalar() or 0
    
    balance = earned - spent
    
    return {"balance": balance, "earned": earned, "spent": spent}

@router.get("/me/stats")
async def get_stats(token: str, db: Session = Depends(get_db)):
    """Obtiene estadísticas del usuario."""
    user = get_current_user(token, db)
    
    earned = db.query(func.sum(Transaction.amount)).filter(
        Transaction.user_id == user.id,
        Transaction.type == 'earned'
    ).scalar() or 0
    
    spent = db.query(func.sum(Transaction.amount)).filter(
        Transaction.user_id == user.id,
        Transaction.type == 'spent'
    ).scalar() or 0
    
    businesses_visited = db.query(func.count(Transaction.business_id.distinct())).filter(
        Transaction.user_id == user.id
    ).scalar() or 0
    
    balance = earned - spent
    
    return UserStats(
        total_bunz_earned=earned,
        total_bunz_spent=spent,
        total_referrals=user.total_referrals,
        businesses_visited=businesses_visited,
        current_balance=balance,
    )

@router.get("/me/feed")
async def get_feed(token: str, tab: str = "bunz'in", db: Session = Depends(get_db)):
    """Obtiene el feed personalizado del usuario."""
    user = get_current_user(token, db)
    
    # Lógica de feed según tab
    if tab == "bunz'in":
        # Negocios con recompensas activas
        businesses = db.query(Business).filter(
            Business.is_active == True,
            Business.reward_rate > 0
        ).all()
        return {"items": businesses}
    
    elif tab == "Stock":
        # Negocios donde se puede gastar
        businesses = db.query(Business).filter(
            Business.is_active == True
        ).all()
        return {"items": businesses}
    
    else:  # Freehands
        # Todos los negocios con tags
        businesses = db.query(Business).filter(
            Business.is_active == True
        ).all()
        return {"items": businesses}

@router.get("/me/history")
async def get_history(
    token: str,
    limit: int = 50,
    offset: int = 0,
    type: str = None,
    db: Session = Depends(get_db)
):
    """Obtiene el historial de transacciones del usuario."""
    user = get_current_user(token, db)
    
    query = db.query(Transaction).filter(Transaction.user_id == user.id)
    
    if type:
        query = query.filter(Transaction.type == type)
    
    transactions = query.order_by(Transaction.created_at.desc()).offset(offset).limit(limit).all()
    
    return {"items": transactions, "total": query.count()}
