from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List

from app.database import get_db
from app.utils.security import decode_token
from app.schemas.transaction import TransactionCreate, TransactionResponse, QRScanRequest, PayRequest, TransactionStats
from app.models.transaction import Transaction, TransactionType, TransactionStatus
from app.models.business import Business
from app.models.user import User

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

@router.post("/scan")
async def scan_qr(
    scan_data: QRScanRequest,
    token: str,
    db: Session = Depends(get_db)
):
    """Registra un escaneo QR y otorga recompensa."""
    user = get_current_user(token, db)
    
    # Verificar negocio
    business = db.query(Business).filter(Business.id == scan_data.business_id).first()
    if not business:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Business not found")
    
    if not business.is_active:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Business is not active")
    
    # Calcular recompensa
    reward_amount = int(scan_data.purchase_amount * (business.reward_rate / 100))
    
    # Verificar crédito disponible
    if business.credit_used + reward_amount > business.credit_limit:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Business credit limit exceeded")
    
    # Generar hash de recibo
    import hashlib
    receipt_hash = hashlib.sha256(
        f"{user.id}:{business.id}:{scan_data.purchase_amount}:{scan_data.qr_data}".encode()
    ).hexdigest()
    
    # Crear transacción
    transaction = Transaction(
        user_id=user.id,
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
    
    # Actualizar stats
    business.credit_used += reward_amount
    business.total_bunz_given += reward_amount
    business.total_transactions += 1
    
    if not db.query(Transaction).filter(
        Transaction.user_id == user.id,
        Transaction.business_id == business.id
    ).first():
        business.total_customers += 1
    
    user.total_bunz_earned += reward_amount
    
    db.commit()
    db.refresh(transaction)
    
    return {
        "transaction": TransactionResponse.from_orm(transaction),
        "reward_amount": reward_amount,
        "new_balance": user.total_bunz_earned - user.total_bunz_spent,
    }

@router.post("/pay")
async def pay_with_bunz(
    pay_data: PayRequest,
    token: str,
    db: Session = Depends(get_db)
):
    """Paga con bunz en un negocio."""
    user = get_current_user(token, db)
    
    # Verificar saldo
    balance = user.total_bunz_earned - user.total_bunz_spent
    if balance < pay_data.amount:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Insufficient bunz balance")
    
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
        f"{user.id}:{business.id}:{pay_data.amount}:{func.now()}".encode()
    ).hexdigest()
    
    # Crear transacción
    transaction = Transaction(
        user_id=user.id,
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
    
    # Actualizar stats
    user.total_bunz_spent += pay_data.amount
    db.commit()
    db.refresh(transaction)
    
    return {
        "transaction": TransactionResponse.from_orm(transaction),
        "net_amount": net_amount,
        "protocol_fee": protocol_fee,
        "affiliate_fee": affiliate_fee,
        "new_balance": balance - pay_data.amount,
    }

@router.get("/stats")
async def get_transaction_stats(token: str, db: Session = Depends(get_db)):
    """Obtiene estadísticas de transacciones del usuario."""
    user = get_current_user(token, db)
    
    from datetime import datetime, timedelta
    
    # Totales
    total_earned = db.query(func.sum(Transaction.amount)).filter(
        Transaction.user_id == user.id,
        Transaction.type == TransactionType.EARNED
    ).scalar() or 0
    
    total_spent = db.query(func.sum(Transaction.amount)).filter(
        Transaction.user_id == user.id,
        Transaction.type == TransactionType.SPENT
    ).scalar() or 0
    
    # Este mes
    first_day = datetime.now().replace(day=1)
    this_month_earned = db.query(func.sum(Transaction.amount)).filter(
        Transaction.user_id == user.id,
        Transaction.type == TransactionType.EARNED,
        Transaction.created_at >= first_day
    ).scalar() or 0
    
    this_month_spent = db.query(func.sum(Transaction.amount)).filter(
        Transaction.user_id == user.id,
        Transaction.type == TransactionType.SPENT,
        Transaction.created_at >= first_day
    ).scalar() or 0
    
    return TransactionStats(
        total_earned=total_earned,
        total_spent=total_spent,
        total_transactions=db.query(Transaction).filter(Transaction.user_id == user.id).count(),
        this_month_earned=this_month_earned,
        this_month_spent=this_month_spent,
    )
