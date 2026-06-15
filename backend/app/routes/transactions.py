from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import func, update as sa_update
from typing import List

from app.database import get_db
from app.utils.security import get_current_user
from app.schemas.transaction import TransactionCreate, TransactionResponse, QRScanRequest, PayRequest, TransactionStats
from app.models.transaction import Transaction, TransactionType, TransactionStatus
from app.models.business import Business
from app.models.user import User
from app.services.auth import rate_limit

router = APIRouter()

@router.post("/scan")
async def scan_qr(
    scan_data: QRScanRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    _=Depends(rate_limit)
):
    """Registra un escaneo QR y otorga recompensa."""
    # Verificar negocio
    business = db.query(Business).filter(Business.id == scan_data.business_id).first()
    if not business:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Business not found")
    
    if not business.is_active:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Business is not active")
    
    # Calcular recompensa
    reward_amount = int(scan_data.purchase_amount * (business.reward_rate / 100))
    
    # Generar hash de recibo
    import hashlib
    receipt_hash = hashlib.sha256(
        f"{current_user.id}:{business.id}:{scan_data.purchase_amount}:{scan_data.qr_data}".encode()
    ).hexdigest()
    
    # Actualizar crédito del negocio atómicamente (race-condition safe)
    result = db.execute(
        sa_update(Business)
        .where(Business.id == scan_data.business_id)
        .where(Business.credit_used + reward_amount <= Business.credit_limit)
        .values(
            credit_used=Business.credit_used + reward_amount,
            total_bunz_given=Business.total_bunz_given + reward_amount,
            total_transactions=Business.total_transactions + 1,
        )
    )
    if result.rowcount == 0:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Business credit limit exceeded")
    
    # Actualizar user atómicamente
    db.execute(
        sa_update(User)
        .where(User.id == current_user.id)
        .values(total_bunz_earned=User.total_bunz_earned + reward_amount)
    )
    
    # Crear transacción
    transaction = Transaction(
        user_id=current_user.id,
        business_id=business.id,
        type=TransactionType.EARNED,
        amount=reward_amount,
        purchase_amount=scan_data.purchase_amount,
        reward_amount=reward_amount,
        receipt_hash=receipt_hash,
        qr_data=scan_data.qr_data,
        description=f"Compra en {business.name}",
        category=business.type,
    )
    
    db.add(transaction)
    db.commit()
    db.refresh(transaction)
    
    return {
        "transaction": TransactionResponse.from_orm(transaction),
        "reward_amount": reward_amount,
        "new_balance": (current_user.total_bunz_earned + reward_amount) - current_user.total_bunz_spent,
    }

@router.post("/pay")
async def pay_with_bunz(
    pay_data: PayRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    _=Depends(rate_limit)
):
    """Paga con bunz en un negocio."""
    # Verificar negocio
    business = db.query(Business).filter(Business.id == pay_data.business_id).first()
    if not business:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Business not found")
    
    # Calcular fees
    protocol_fee = int(pay_data.amount * 0.03)  # 3%
    affiliate_fee = int(pay_data.amount * 0.06)  # 6%
    net_amount = pay_data.amount - protocol_fee - affiliate_fee
    
    # Generar hash
    import hashlib
    receipt_hash = hashlib.sha256(
        f"{current_user.id}:{business.id}:{pay_data.amount}:{func.now()}".encode()
    ).hexdigest()
    
    # Actualizar saldo atómicamente (race-condition safe)
    result = db.execute(
        sa_update(User)
        .where(User.id == current_user.id)
        .where(User.total_bunz_earned - User.total_bunz_spent >= pay_data.amount)
        .values(total_bunz_spent=User.total_bunz_spent + pay_data.amount)
    )
    if result.rowcount == 0:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Insufficient bunz balance")
    
    # Crear transacción
    transaction = Transaction(
        user_id=current_user.id,
        business_id=business.id,
        type=TransactionType.SPENT,
        amount=pay_data.amount,
        protocol_fee=protocol_fee,
        affiliate_fee=affiliate_fee,
        receipt_hash=receipt_hash,
        description=f"Pago en {business.name}",
        category=business.type,
    )
    
    db.add(transaction)
    db.commit()
    db.refresh(transaction)
    
    return {
        "transaction": TransactionResponse.from_orm(transaction),
        "net_amount": net_amount,
        "protocol_fee": protocol_fee,
        "affiliate_fee": affiliate_fee,
        "new_balance": (current_user.total_bunz_earned - current_user.total_bunz_spent) - pay_data.amount,
    }

@router.get("/stats")
async def get_transaction_stats(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Obtiene estadísticas de transacciones del usuario."""
    from datetime import datetime, timedelta
    
    # Totales
    total_earned = db.query(func.sum(Transaction.amount)).filter(
        Transaction.user_id == current_user.id,
        Transaction.type == TransactionType.EARNED
    ).scalar() or 0
    
    total_spent = db.query(func.sum(Transaction.amount)).filter(
        Transaction.user_id == current_user.id,
        Transaction.type == TransactionType.SPENT
    ).scalar() or 0
    
    # Este mes
    first_day = datetime.now().replace(day=1)
    this_month_earned = db.query(func.sum(Transaction.amount)).filter(
        Transaction.user_id == current_user.id,
        Transaction.type == TransactionType.EARNED,
        Transaction.created_at >= first_day
    ).scalar() or 0
    
    this_month_spent = db.query(func.sum(Transaction.amount)).filter(
        Transaction.user_id == current_user.id,
        Transaction.type == TransactionType.SPENT,
        Transaction.created_at >= first_day
    ).scalar() or 0
    
    return TransactionStats(
        total_earned=total_earned,
        total_spent=total_spent,
        total_transactions=db.query(Transaction).filter(Transaction.user_id == current_user.id).count(),
        this_month_earned=this_month_earned,
        this_month_spent=this_month_spent,
    )
