from pydantic_settings import BaseSettings
from functools import lru_cache

class Settings(BaseSettings):
    # Database
    DATABASE_URL: str = "sqlite:///./rabbitty.db"
    
    # PostgreSQL (producción)
    # DATABASE_URL: str = "postgresql://postgres:postgres@localhost:5432/rabbitty"
    
    # Redis
    REDIS_URL: str = "redis://localhost:6379/0"
    
    # Security
    SECRET_KEY: str = "your-secret-key-change-in-production"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24  # 24 horas
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7
    
    # Telegram
    BOT_TOKEN: str = ""
    
    # Blockchain
    BUNZ_CONTRACT_ADDRESS: str = ""
    RPC_URL: str = "https://polygon-rpc.com"
    CHAIN_ID: int = 137
    
    # Rate Limiting
    RATE_LIMIT_PER_MINUTE: int = 100
    
    # Features
    ENABLE_WEBSOCKETS: bool = True
    ENABLE_PUSH_NOTIFICATIONS: bool = False
    
    class Config:
        env_file = ".env"

@lru_cache()
def get_settings() -> Settings:
    return Settings()

settings = get_settings()
