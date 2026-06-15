import logging
from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer
from contextlib import asynccontextmanager

from app.routes import auth, users, businesses, transactions, referrals, feed, discover, analytics
from app.database import engine, Base
from app.config import settings

logger = logging.getLogger(__name__)

# Create tables (DEV only — en producción usar Alembic: alembic upgrade head)
if settings.DATABASE_URL and settings.DATABASE_URL.startswith("sqlite"):
    Base.metadata.create_all(bind=engine)

security = HTTPBearer()

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    logger.info("Rabbitty API starting...")
    yield
    # Shutdown
    logger.info("Rabbitty API shutting down...")

app = FastAPI(
    title="Rabbitty API",
    description="Backend API para Rabbitty Mini App",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS
ALLOWED_ORIGINS = [
    "https://rabbitty.me",
    "https://admin.rabbitty.me",
    "https://pos.rabbitty.me",
    "https://telegram-miniapp-lyart-gamma.vercel.app",
    "http://localhost:3000",
    "http://localhost:3001",
    "http://localhost:3002",
]
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PATCH", "PUT", "DELETE"],
    allow_headers=["Authorization", "Content-Type"],
)

# Include routers
app.include_router(auth.router, prefix="/auth", tags=["Authentication"])
app.include_router(users.router, prefix="/users", tags=["Users"])
app.include_router(businesses.router, prefix="/businesses", tags=["Businesses"])
app.include_router(transactions.router, prefix="/transactions", tags=["Transactions"])
app.include_router(referrals.router, prefix="/referrals", tags=["Referrals"])
app.include_router(feed.router, prefix="/feed", tags=["Feed"])
app.include_router(discover.router, prefix="/discover", tags=["Discover"])
app.include_router(analytics.router, prefix="/analytics", tags=["Analytics"])

@app.get("/")
async def root():
    return {
        "message": "🐰 Rabbitty API",
        "version": "1.0.0",
        "status": "running",
        "docs": "/docs",
    }

@app.get("/health")
async def health_check():
    return {"status": "healthy"}
