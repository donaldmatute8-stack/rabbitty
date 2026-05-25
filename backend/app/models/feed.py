from sqlalchemy import Column, Integer, String, BigInteger, DateTime, Boolean, Text
from sqlalchemy.sql import func
from app.database import Base

class FeedPost(Base):
    __tablename__ = "feed_posts"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, index=True)
    
    # Content
    content = Column(Text)
    image_url = Column(String(500))
    label = Column(String(100))
    
    # Business reference
    business_id = Column(Integer, nullable=True)
    business_name = Column(String(200))
    
    # Bunz earned
    bunz_amount = Column(BigInteger, default=0)
    
    # Engagement
    likes_count = Column(Integer, default=0)
    comments_count = Column(Integer, default=0)
    shares_count = Column(Integer, default=0)
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())

class FeedLike(Base):
    __tablename__ = "feed_likes"
    
    id = Column(Integer, primary_key=True)
    post_id = Column(Integer, index=True)
    user_id = Column(Integer, index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

class FeedComment(Base):
    __tablename__ = "feed_comments"
    
    id = Column(Integer, primary_key=True)
    post_id = Column(Integer, index=True)
    user_id = Column(Integer, index=True)
    content = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
