from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import update as sa_update
from typing import List

from app.database import get_db
from app.utils.security import get_current_user
from app.models.feed import FeedPost, FeedLike, FeedComment
from app.models.user import User

router = APIRouter()

@router.get("/")
async def get_feed(
    current_user: User = Depends(get_current_user),
    tab: str = "bunz'in",
    skip: int = 0,
    limit: int = 50,
    db: Session = Depends(get_db)
):
    """Obtiene el feed social/público."""
    posts = db.query(FeedPost).order_by(FeedPost.created_at.desc()).offset(skip).limit(limit).all()
    
    return {"items": posts}

@router.post("/{post_id}/like")
async def like_post(
    post_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Da like a un post."""
    # Verificar si ya dio like
    existing = db.query(FeedLike).filter(
        FeedLike.post_id == post_id,
        FeedLike.user_id == current_user.id
    ).first()
    
    if existing:
        # Quitar like atómicamente
        db.delete(existing)
        db.execute(
            sa_update(FeedPost)
            .where(FeedPost.id == post_id)
            .values(likes_count=FeedPost.likes_count - 1)
        )
        db.commit()
        return {"liked": False}
    
    # Agregar like atómicamente
    like = FeedLike(post_id=post_id, user_id=current_user.id)
    db.add(like)
    db.execute(
        sa_update(FeedPost)
        .where(FeedPost.id == post_id)
        .values(likes_count=FeedPost.likes_count + 1)
    )
    
    db.commit()
    return {"liked": True}

@router.post("/{post_id}/comment")
async def comment_post(
    post_id: int,
    content: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Comenta en un post."""
    comment = FeedComment(
        post_id=post_id,
        user_id=current_user.id,
        content=content
    )
    
    db.add(comment)
    
    db.execute(
        sa_update(FeedPost)
        .where(FeedPost.id == post_id)
        .values(comments_count=FeedPost.comments_count + 1)
    )
    
    db.commit()
    db.refresh(comment)
    
    return {"comment": comment}
