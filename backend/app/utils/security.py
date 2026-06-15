import hmac
import hashlib
import time
from datetime import datetime, timedelta, timezone
from typing import Optional
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer
from sqlalchemy.orm import Session
from jose import JWTError, jwt
from passlib.context import CryptContext
from app.config import settings
from app.database import get_db

security_scheme = HTTPBearer()

async def get_current_user(
    credentials = Depends(security_scheme),
    db: Session = Depends(get_db),
) -> "User":
    """Obtiene el usuario autenticado desde el Bearer token JWT."""
    from app.models.user import User

    payload = decode_token(credentials.credentials)
    if not payload:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")

    user_id = int(payload.get("sub"))
    user = db.query(User).filter(User.id == user_id).first()

    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    return user

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def verify_telegram_webapp_data(init_data: str, bot_token: str) -> bool:
    """Verifica la firma de los datos de Telegram WebApp."""
    try:
        parsed = {}
        for param in init_data.split('&'):
            key, value = param.split('=', 1)
            import urllib.parse
            parsed[key] = urllib.parse.unquote(value)
        
        hash_value = parsed.pop('hash', None)
        if not hash_value:
            return False
        
        # Validar auth_date (máximo 24 horas)
        auth_date = parsed.get('auth_date')
        if auth_date:
            try:
                auth_ts = int(auth_date)
                if time.time() - auth_ts > 86400:
                    return False
            except (ValueError, TypeError):
                return False
        
        data_check_string = '\n'.join(
            f"{k}={v}" for k, v in sorted(parsed.items())
        )
        
        secret_key = hmac.new(
            b"WebAppData",
            bot_token.encode(),
            hashlib.sha256
        ).digest()
        
        computed_hash = hmac.new(
            secret_key,
            data_check_string.encode(),
            hashlib.sha256
        ).hexdigest()
        
        return hmac.compare_digest(computed_hash, hash_value)
    except Exception:
        return False

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    """Crea un JWT token."""
    to_encode = data.copy()
    now = datetime.now(timezone.utc)
    
    if expires_delta:
        expire = now + expires_delta
    else:
        expire = now + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    
    to_encode.update({"exp": expire, "iat": now})
    
    return jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)

def create_refresh_token(data: dict):
    """Crea un refresh token."""
    now = datetime.now(timezone.utc)
    to_encode = data.copy()
    expire = now + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)
    to_encode.update({"exp": expire, "iat": now, "type": "refresh"})
    
    return jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)

def decode_token(token: str) -> Optional[dict]:
    """Decodifica un JWT token."""
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        return payload
    except JWTError:
        return None

def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verifica una contraseña."""
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password: str) -> str:
    """Genera un hash de contraseña."""
    return pwd_context.hash(password)

def generate_referral_code(user_id: int) -> str:
    """Genera un código de referido único (criptográficamente seguro)."""
    import secrets
    import string
    
    chars = string.ascii_uppercase + string.digits
    random_part = ''.join(secrets.choice(chars) for _ in range(10))
    return f"RB{random_part}"
