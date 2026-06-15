import logging
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import func
from datetime import datetime, timedelta

from app.database import get_db
from app.utils.security import get_current_user
from app.models.user import User
from app.models.transaction import Transaction, TransactionType
from app.models.business import Business
from app.services.auth import rate_limit

logger = logging.getLogger(__name__)

router = APIRouter()

@router.post("/track")
async def track_event(
    event: str,
    properties: dict = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Rastrea un evento de analytics."""
    logger.info("Analytics: %s", event)
    return {"tracked": True}

@router.get("/dashboard")
async def get_dashboard(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Obtiene métricas del dashboard."""
    total_users = db.query(User).count()
    active_today = (
        db.query(User)
        .filter(
            User.last_login
            >= datetime.utcnow().replace(hour=0, minute=0, second=0)
        )
        .count()
    )

    total_transactions = db.query(Transaction).count()
    transactions_today = (
        db.query(Transaction)
        .filter(Transaction.created_at >= datetime.utcnow().replace(hour=0, minute=0, second=0))
        .count()
    )

    total_bunz_earned = (
        db.query(func.sum(Transaction.amount))
        .filter(Transaction.type == TransactionType.EARNED)
        .scalar()
        or 0
    )

    total_businesses = db.query(Business).count()
    active_businesses = db.query(Business).filter(Business.is_active == True).count()

    return {
        "users": {
            "total": total_users,
            "active_today": active_today,
        },
        "transactions": {
            "total": total_transactions,
            "today": transactions_today,
            "total_bunz": total_bunz_earned,
        },
        "businesses": {
            "total": total_businesses,
            "active": active_businesses,
        },
    }

@router.get("/user/{user_id}")
async def get_user_analytics(
    user_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Obtiene analytics detallados de un usuario."""
    months = []
    for i in range(6):
        month_start = datetime.utcnow().replace(day=1) - timedelta(days=i * 30)
        month_end = month_start + timedelta(days=30)

        earned = (
            db.query(func.sum(Transaction.amount))
            .filter(
                Transaction.user_id == user_id,
                Transaction.type == TransactionType.EARNED,
                Transaction.created_at >= month_start,
                Transaction.created_at < month_end,
            )
            .scalar()
            or 0
        )

        spent = (
            db.query(func.sum(Transaction.amount))
            .filter(
                Transaction.user_id == user_id,
                Transaction.type == TransactionType.SPENT,
                Transaction.created_at >= month_start,
                Transaction.created_at < month_end,
            )
            .scalar()
            or 0
        )

        months.append(
            {
                "month": month_start.strftime("%B"),
                "earned": earned,
                "spent": spent,
            }
        )

    categories = (
        db.query(Transaction.category, func.count(Transaction.id))
        .filter(
            Transaction.user_id == user_id,
            Transaction.category.isnot(None),
        )
        .group_by(Transaction.category)
        .order_by(func.count(Transaction.id).desc())
        .limit(5)
        .all()
    )

    return {
        "monthly_activity": months,
        "top_categories": [
            {"category": cat, "count": count} for cat, count in categories
        ],
    }
