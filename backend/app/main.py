from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer
from contextlib import asynccontextmanager

from app.routes import auth, users, businesses, transactions, referrals, feed, discover, analytics
from app.database import engine, Base
from app.config import settings

# Create tables
Base.metadata.create_all(bind=engine)

security = HTTPBearer()

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    print("🚀 Rabbitty API starting...")
    yield
    # Shutdown
    print("👋 Rabbitty API shutting down...")

app = FastAPI(
    title="Rabbitty API",
    description="Backend API para Rabbitty Mini App",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # En producción, especificar dominios
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
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
