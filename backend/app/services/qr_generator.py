import qrcode
import io
import base64
import uuid
from datetime import datetime, timedelta, timezone
from sqlalchemy.orm import Session
from app.models import QRCode

class QRGeneratorService:
    """Service for generating and validating QR codes."""
    
    @staticmethod
    def generate_business_qr(business_id: int, expiry_hours: int = 24) -> dict:
        """Generate a QR code for a business."""
        qr_uuid = str(uuid.uuid4())
        code = f"BUNZ:{business_id}:{qr_uuid}"
        
        # Generate QR image
        qr = qrcode.QRCode(
            version=1,
            error_correction=qrcode.constants.ERROR_CORRECT_H,
            box_size=10,
            border=4,
        )
        qr.add_data(code)
        qr.make(fit=True)
        
        img = qr.make_image(fill_color="black", back_color="white")
        
        # Convert to base64
        buffer = io.BytesIO()
        img.save(buffer, format='PNG')
        img_base64 = base64.b64encode(buffer.getvalue()).decode()
        
        return {
            "code": code,
            "image_base64": f"data:image/png;base64,{img_base64}",
            "expires_at": (datetime.now(timezone.utc) + timedelta(hours=expiry_hours)).isoformat()
        }
    
    @staticmethod
    def generate_payment_qr(user_id: int, amount: float, business_id: int = None) -> dict:
        """Generate a payment QR code."""
        qr_uuid = str(uuid.uuid4())
        code = f"PAY:{user_id}:{amount}:{qr_uuid}"
        
        if business_id:
            code = f"PAY:{user_id}:{business_id}:{amount}:{qr_uuid}"
        
        qr = qrcode.QRCode(
            version=1,
            error_correction=qrcode.constants.ERROR_CORRECT_H,
            box_size=10,
            border=4,
        )
        qr.add_data(code)
        qr.make(fit=True)
        
        img = qr.make_image(fill_color="black", back_color="white")
        
        buffer = io.BytesIO()
        img.save(buffer, format='PNG')
        img_base64 = base64.b64encode(buffer.getvalue()).decode()
        
        return {
            "code": code,
            "image_base64": f"data:image/png;base64,{img_base64}",
            "amount": amount
        }
    
    @staticmethod
    def store_qr_code(code: str, business_id: int, user_id: int = None, 
                     points_value: float = 0.0, expiry_hours: int = 24,
                     db: Session = None) -> QRCode:
        """Store a QR code in the database."""
        qr = QRCode(
            code=code,
            business_id=business_id,
            user_id=user_id,
            points_value=points_value,
            expires_at=datetime.now(timezone.utc) + timedelta(hours=expiry_hours) if expiry_hours else None
        )
        if db:
            db.add(qr)
            db.commit()
            db.refresh(qr)
        return qr
    
    @staticmethod
    def validate_qr_code(code: str, db: Session) -> dict:
        """Validate a QR code."""
        qr = db.query(QRCode).filter(
            QRCode.code == code,
            QRCode.is_used == False
        ).first()
        
        if not qr:
            return {"valid": False, "reason": "QR code not found or already used"}
        
        if qr.expires_at and qr.expires_at < datetime.now(timezone.utc):
            return {"valid": False, "reason": "QR code expired"}
        
        return {
            "valid": True,
            "business_id": qr.business_id,
            "user_id": qr.user_id,
            "points_value": qr.points_value
        }
