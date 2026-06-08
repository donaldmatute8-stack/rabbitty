from sqlalchemy.orm import Session
from app.models import User, Transaction
from datetime import datetime, timezone

class WalletService:
    """Service for managing user wallets and points."""
    
    @staticmethod
    def add_points(user_id: int, points: float, reason: str, db: Session) -> bool:
        """Add points to user balance."""
        user = db.query(User).filter(User.id == user_id).first()
        if not user:
            return False
        
        user.points += points
        user.last_active = datetime.now(timezone.utc)
        db.commit()
        return True
    
    @staticmethod
    def deduct_points(user_id: int, points: float, db: Session) -> bool:
        """Deduct points from user balance."""
        user = db.query(User).filter(User.id == user_id).first()
        if not user or user.points < points:
            return False
        
        user.points -= points
        user.last_active = datetime.now(timezone.utc)
        db.commit()
        return True
    
    @staticmethod
    def add_bunz(user_id: int, amount: float, db: Session) -> bool:
        """Add BUNZ tokens to user wallet."""
        user = db.query(User).filter(User.id == user_id).first()
        if not user:
            return False
        
        user.bunz_balance += amount
        user.last_active = datetime.now(timezone.utc)
        db.commit()
        return True
    
    @staticmethod
    def deduct_bunz(user_id: int, amount: float, db: Session) -> bool:
        """Deduct BUNZ tokens from user wallet."""
        user = db.query(User).filter(User.id == user_id).first()
        if not user or user.bunz_balance < amount:
            return False
        
        user.bunz_balance -= amount
        user.last_active = datetime.now(timezone.utc)
        db.commit()
        return True
    
    @staticmethod
    def get_balance(user_id: int, db: Session) -> dict:
        """Get user balances."""
        user = db.query(User).filter(User.id == user_id).first()
        if not user:
            return {"points": 0, "bunz": 0.0}
        
        return {
            "points": user.points,
            "bunz": user.bunz_balance
        }
    
    @staticmethod
    def calculate_reward_points(amount: float, reward_percentage: float) -> float:
        """Calculate points earned for a transaction."""
        return round(amount * (reward_percentage / 100), 2)
