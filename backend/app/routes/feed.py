from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List

from app.database import get_db
from app.utils.security import decode_token
from app.models.feed import FeedPost, FeedLike, FeedComment
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

@router.get("/")
async def get_feed(
    token: str,
    tab: str = "bunz'in",
    skip: int = 0,
    limit: int = 50,
    db: Session = Depends(get_db)
):
    """Obtiene el feed social/público."""
    get_current_user(token, db)
    
    # Obtener posts
    posts = db.query(FeedPost).order_by(FeedPost.created_at.desc()).offset(skip).limit(limit).all()
    
    return {"items": posts}

@router.post("/{post_id}/like")
async def like_post(
    post_id: int,
    token: str,
    db: Session = Depends(get_db)
):
    """Da like a un post."""
    user = get_current_user(token, db)
    
    # Verificar si ya dio like
    existing = db.query(FeedLike).filter(
        FeedLike.post_id == post_id,
        FeedLike.user_id == user.id
    ).first()
    
    if existing:
        # Quitar like
        db.delete(existing)
        post = db.query(FeedPost).filter(FeedPost.id == post_id).first()
        if post:
            post.likes_count -= 1
        db.commit()
        return {"liked": False}
    
    # Agregar like
    like = FeedLike(post_id=post_id, user_id=user.id)
    db.add(like)
    
    post = db.query(FeedPost).filter(FeedPost.id == post_id).first()
    if post:
        post.likes_count += 1
    
    db.commit()
    return {"liked": True}

@router.post("/{post_id}/comment")
async def comment_post(
    post_id: int,
    content: str,
    token: str,
    db: Session = Depends(get_db)
):
    """Comenta en un post."""
    user = get_current_user(token, db)
    
    comment = FeedComment(
        post_id=post_id,
        user_id=user.id,
        content=content
    )
    
    db.add(comment)
    
    post = db.query(FeedPost).filter(FeedPost.id == post_id).first()
    if post:
        post.comments_count += 1
    
    db.commit()
    db.refresh(comment)
    
    return {"comment": comment}
