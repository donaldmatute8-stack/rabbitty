from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List

from app.database import get_db
from app.utils.security import verify_telegram_webapp_data, create_access_token, create_refresh_token, decode_token
from app.schemas.user import UserLogin, UserResponse, UserCreate
from app.models.user import User, UserSession
from app.config import settings

router = APIRouter()

@router.post("/telegram")
async def login_with_telegram(login_data: UserLogin, db: Session = Depends(get_db)):
    """Autentica un usuario con datos de Telegram WebApp."""
    
    # Verificar firma de Telegram
    if not verify_telegram_webapp_data(login_data.init_data, settings.BOT_TOKEN):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid Telegram signature"
        )
    
    # Extraer usuario de init_data
    import urllib.parse
    parsed = {}
    for param in login_data.init_data.split('&'):
        key, value = param.split('=', 1)
        parsed[key] = urllib.parse.unquote(value)
    
    user_data = parsed.get('user', '{}')
    import json
    tg_user = json.loads(user_data)
    
    if not tg_user or 'id' not in tg_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid user data"
        )
    
    # Buscar o crear usuario
    user = db.query(User).filter(User.telegram_id == tg_user['id']).first()
    
    if not user:
        # Crear nuevo usuario
        from app.utils.security import generate_referral_code
        
        user = User(
            telegram_id=tg_user['id'],
            username=tg_user.get('username'),
            first_name=tg_user.get('first_name', ''),
            last_name=tg_user.get('last_name'),
            photo_url=tg_user.get('photo_url'),
            referral_code=generate_referral_code(tg_user['id']),
        )
        db.add(user)
        db.commit()
        db.refresh(user)
    
    # Actualizar last_login
    from datetime import datetime
    user.last_login = datetime.utcnow()
    db.commit()
    
    # Generar tokens
    token_data = {"sub": str(user.id), "telegram_id": user.telegram_id}
    access_token = create_access_token(token_data)
    refresh_token = create_refresh_token(token_data)
    
    # Guardar sesión
    session = UserSession(
        user_id=user.id,
        token=access_token,
        refresh_token=refresh_token,
    )
    db.add(session)
    db.commit()
    
    return {
        "token": access_token,
        "refresh_token": refresh_token,
        "user": UserResponse.from_orm(user)
    }

@router.post("/refresh")
async def refresh_token(refresh_token: str, db: Session = Depends(get_db)):
    """Refresca un token de acceso."""
    
    payload = decode_token(refresh_token)
    
    if not payload or payload.get('type') != 'refresh':
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid refresh token"
        )
    
    user_id = int(payload.get('sub'))
    
    # Verificar sesión activa
    session = db.query(UserSession).filter(
        UserSession.user_id == user_id,
        UserSession.refresh_token == refresh_token,
        UserSession.is_active == True
    ).first()
    
    if not session:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Session not found"
        )
    
    # Generar nuevos tokens
    token_data = {"sub": str(user_id)}
    new_access_token = create_access_token(token_data)
    new_refresh_token = create_refresh_token(token_data)
    
    # Actualizar sesión
    session.token = new_access_token
    session.refresh_token = new_refresh_token
    db.commit()
    
    return {"token": new_access_token, "refresh_token": new_refresh_token}

@router.post("/logout")
async def logout(token: str, db: Session = Depends(get_db)):
    """Cierra la sesión del usuario."""
    
    session = db.query(UserSession).filter(UserSession.token == token).first()
    
    if session:
        session.is_active = False
        db.commit()
    
    return {"message": "Logged out successfully"}
