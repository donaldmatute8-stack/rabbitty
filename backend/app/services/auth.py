from fastapi import Depends, HTTPException, status, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import JWTError, jwt
from datetime import datetime, timedelta, timezone
from typing import Optional, Dict, Any
import hmac
import hashlib
import urllib.parse
import json

from app.config import settings
from app.schemas import TokenPayload
from app.database import get_db
from sqlalchemy.orm import Session
from app.models import User, RefreshToken

security = HTTPBearer()

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    """Create a new JWT access token."""
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + (expires_delta or timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES))
    to_encode.update({"exp": expire, "type": "access"})
    return jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)

def create_refresh_token(user_id: int, db: Session) -> str:
    """Create a new refresh token and store it in DB."""
    token = jwt.encode(
        {"sub": str(user_id), "exp": datetime.now(timezone.utc) + timedelta(days=7), "type": "refresh"},
        settings.SECRET_KEY,
        algorithm=settings.ALGORITHM
    )
    
    refresh = RefreshToken(
        token=token,
        user_id=user_id,
        expires_at=datetime.now(timezone.utc) + timedelta(days=7)
    )
    db.add(refresh)
    db.commit()
    
    return token

def verify_token(token: str, token_type: str = "access") -> TokenPayload:
    """Verify a JWT token and return payload."""
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        if payload.get("type") != token_type:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail=f"Invalid token type. Expected {token_type}.",
                headers={"WWW-Authenticate": "Bearer"},
            )
        telegram_id: str = payload.get("sub")
        if telegram_id is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token: missing subject",
                headers={"WWW-Authenticate": "Bearer"},
            )
        exp = datetime.fromtimestamp(payload["exp"], tz=timezone.utc)
        return TokenPayload(sub=telegram_id, exp=exp)
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
            headers={"WWW-Authenticate": "Bearer"},
        )

def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db)
) -> User:
    """Dependency to get current authenticated user."""
    token = credentials.credentials
    payload = verify_token(token, "access")
    
    user = db.query(User).filter(User.telegram_id == int(payload.sub)).first()
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User account is deactivated"
        )
    
    return user

def get_current_user_optional(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
    db: Session = Depends(get_db)
) -> Optional[User]:
    """Optional auth - returns user if authenticated, None otherwise."""
    if not credentials:
        return None
    try:
        return get_current_user(credentials, db)
    except HTTPException:
        return None

def validate_telegram_init_data(init_data: str) -> Dict[str, Any]:
    """Validate Telegram WebApp initData hash."""
    try:
        parsed = dict(urllib.parse.parse_qsl(init_data))
        
        if "hash" not in parsed:
            raise ValueError("Missing hash in initData")
        
        received_hash = parsed.pop("hash")
        
        # Create data_check_string
        data_check_string = "\n".join(
            f"{k}={v}" for k, v in sorted(parsed.items())
        )
        
        # Calculate secret key
        secret_key = hmac.new(
            b"WebAppData",
            settings.BOT_TOKEN.encode(),
            hashlib.sha256
        ).digest()
        
        # Calculate hash
        calculated_hash = hmac.new(
            secret_key,
            data_check_string.encode(),
            hashlib.sha256
        ).hexdigest()
        
        if not hmac.compare_digest(calculated_hash, received_hash):
            raise ValueError("Invalid hash signature")
        
        # Check auth_date is recent (within 24 hours)
        auth_date = int(parsed.get("auth_date", 0))
        if datetime.now(timezone.utc).timestamp() - auth_date > 86400:
            raise ValueError("Auth date too old")
        
        # Parse user data
        user_data = json.loads(parsed.get("user", "{}"))
        
        return {
            "telegram_id": user_data.get("id"),
            "username": user_data.get("username"),
            "first_name": user_data.get("first_name"),
            "last_name": user_data.get("last_name"),
            "photo_url": user_data.get("photo_url"),
            "is_premium": user_data.get("is_premium", False),
        }
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid Telegram auth data: {str(e)}"
        )

def generate_referral_code(telegram_id: int, length: int = 8) -> str:
    """Generate a unique referral code."""
    import secrets
    import string
    
    # Combine telegram_id with random chars for uniqueness
    alphabet = string.ascii_uppercase + string.digits
    random_part = ''.join(secrets.choice(alphabet) for _ in range(length))
    return f"RB{telegram_id}{random_part}"

class RateLimiter:
    """Simple in-memory rate limiter."""
    def __init__(self, requests_per_minute: int = 100):
        self.requests_per_minute = requests_per_minute
        self.requests: Dict[str, list] = {}
    
    def is_allowed(self, key: str) -> bool:
        now = datetime.now(timezone.utc)
        if key not in self.requests:
            self.requests[key] = []
        
        # Remove requests older than 1 minute
        self.requests[key] = [
            req_time for req_time in self.requests[key]
            if (now - req_time).total_seconds() < 60
        ]
        
        if len(self.requests[key]) >= self.requests_per_minute:
            return False
        
        self.requests[key].append(now)
        return True

rate_limiter = RateLimiter()

def rate_limit(request: Request):
    """Rate limit dependency. Respects X-Forwarded-For behind reverse proxy."""
    forwarded = request.headers.get("X-Forwarded-For")
    if forwarded:
        client_ip = forwarded.split(",")[0].strip()
    else:
        client_ip = request.client.host if request.client else "unknown"
    if not rate_limiter.is_allowed(client_ip):
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Rate limit exceeded. Try again later."
        )
