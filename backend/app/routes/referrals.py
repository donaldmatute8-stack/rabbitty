from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import func, update as sa_update
from typing import List

from app.database import get_db
from app.utils.security import decode_token, generate_referral_code, get_current_user
from app.schemas.referral import ReferralResponse, ReferralStats, ReferralCreate
from app.models.referral import Referral, ReferralTier, ReferralTierConfig
from app.models.user import User
from app.services.auth import rate_limit

router = APIRouter()

@router.post("/")
async def create_referral(
    referral_data: ReferralCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Registra un nuevo referido usando un código."""
    # Buscar al referrer
    referrer = db.query(User).filter(User.referral_code == referral_data.referral_code).first()
    
    if not referrer:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Invalid referral code")
    
    if referrer.id == current_user.id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Cannot refer yourself")
    
    # Verificar si ya fue referido
    existing = db.query(Referral).filter(Referral.referred_id == current_user.id).first()
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
        referred_id=current_user.id,
        referral_code=referral_data.referral_code,
        bonus_amount=bonus,
        tier=tier,
    )
    
    db.add(referral)
    
    # Actualizar contador atómicamente
    db.execute(
        sa_update(User)
        .where(User.id == referrer.id)
        .values(total_referrals=User.total_referrals + 1)
    )
    db.commit()
    db.refresh(referral)
    
    return ReferralResponse.from_orm(referral)

@router.get("/me")
async def get_my_referrals(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Obtiene los referidos del usuario actual."""
    referrals = db.query(Referral).filter(Referral.referrer_id == current_user.id).all()
    
    # Calcular stats
    total_earned = db.query(func.sum(Referral.bonus_amount)).filter(
        Referral.referrer_id == current_user.id,
        Referral.is_claimed == True
    ).scalar() or 0
    
    pending = db.query(Referral).filter(
        Referral.referrer_id == current_user.id,
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
        "referral_code": current_user.referral_code,
    }

@router.post("/{referral_id}/claim")
async def claim_referral_bonus(
    referral_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Reclama el bonus de un referido."""
    referral = db.query(Referral).filter(
        Referral.id == referral_id,
        Referral.referrer_id == current_user.id
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
