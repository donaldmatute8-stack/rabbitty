from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List

from app.database import get_db
from app.utils.security import decode_token, generate_referral_code
from app.schemas.referral import ReferralResponse, ReferralStats, ReferralCreate
from app.models.referral import Referral, ReferralTier, ReferralTierConfig
from app.models.user import User
from app.services.auth import rate_limit

router = APIRouter()

def get_current_user(token: str, db: Session) -> User:
    """Obtiene el usuario actual del token JWT."""
    payload = decode_token(token)
    if not payload:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")
    
    user_id = int(payload.get('sub'))
    user = db.query(User).filter(User.id == user_id).first()
    
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    
    return user

@router.post("/")
async def create_referral(
    referral_data: ReferralCreate,
    token: str,
    db: Session = Depends(get_db)
):
    """Registra un nuevo referido usando un código."""
    user = get_current_user(token, db)
    
    # Buscar al referrer
    referrer = db.query(User).filter(User.referral_code == referral_data.referral_code).first()
    
    if not referrer:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Invalid referral code")
    
    if referrer.id == user.id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Cannot refer yourself")
    
    # Verificar si ya fue referido
    existing = db.query(Referral).filter(Referral.referred_id == user.id).first()
    if existing:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Already referred")
    
    # Determinar tier
    referrer_count = db.query(Referral).filter(Referral.referrer_id == referrer.id).count()
    
    tier = ReferralTier.BRONZE
    if referrer_count >= 50:
        tier = ReferralTier.PLATINUM
    elif referrer_count >= 15:
        tier = ReferralTier.GOLD
    elif referrer_count >= 5:
        tier = ReferralTier.SILVER
    
    # Obtener bonus del tier
    tier_config = db.query(ReferralTierConfig).filter(ReferralTierConfig.tier == tier).first()
    bonus = tier_config.bonus_amount if tier_config else 50
    
    # Crear referido
    referral = Referral(
        referrer_id=referrer.id,
        referred_id=user.id,
        referral_code=referral_data.referral_code,
        bonus_amount=bonus,
        tier=tier,
    )
    
    db.add(referral)
    
    # Actualizar contador
    referrer.total_referrals += 1
    db.commit()
    db.refresh(referral)
    
    return ReferralResponse.from_orm(referral)

@router.get("/me")
async def get_my_referrals(token: str, db: Session = Depends(get_db)):
    """Obtiene los referidos del usuario actual."""
    user = get_current_user(token, db)
    
    referrals = db.query(Referral).filter(Referral.referrer_id == user.id).all()
    
    # Calcular stats
    total_earned = db.query(func.sum(Referral.bonus_amount)).filter(
        Referral.referrer_id == user.id,
        Referral.is_claimed == True
    ).scalar() or 0
    
    pending = db.query(Referral).filter(
        Referral.referrer_id == user.id,
        Referral.is_claimed == False
    ).count()
    
    # Determinar tier actual
    count = len(referrals)
    current_tier = ReferralTier.BRONZE
    next_tier = ReferralTier.SILVER
    referrals_to_next = 5 - count
    
    if count >= 50:
        current_tier = ReferralTier.PLATINUM
        next_tier = None
        referrals_to_next = 0
    elif count >= 15:
        current_tier = ReferralTier.GOLD
        next_tier = ReferralTier.PLATINUM
        referrals_to_next = 50 - count
    elif count >= 5:
        current_tier = ReferralTier.SILVER
        next_tier = ReferralTier.GOLD
        referrals_to_next = 15 - count
    
    return {
        "referrals": referrals,
        "stats": ReferralStats(
            total_referrals=count,
            total_earned=total_earned,
            pending_claims=pending,
            current_tier=current_tier.value,
            next_tier=next_tier.value if next_tier else None,
            referrals_to_next_tier=referrals_to_next,
        ),
        "referral_code": user.referral_code,
    }

@router.post("/{referral_id}/claim")
async def claim_referral_bonus(
    referral_id: int,
    token: str,
    db: Session = Depends(get_db)
):
    """Reclama el bonus de un referido."""
    user = get_current_user(token, db)
    
    referral = db.query(Referral).filter(
        Referral.id == referral_id,
        Referral.referrer_id == user.id
    ).first()
    
    if not referral:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Referral not found")
    
    if referral.is_claimed:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Bonus already claimed")
    
    # Marcar como reclamado
    from datetime import datetime
    referral.is_claimed = True
    referral.claimed_at = datetime.utcnow()
    
    db.commit()
    
    return {"claimed": True, "amount": referral.bonus_amount}
