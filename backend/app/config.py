from pydantic_settings import BaseSettings
from functools import lru_cache

class Settings(BaseSettings):
    # Database
    DATABASE_URL: str = "postgresql://postgres:postgres@localhost:5432/rabbitty"
    
    # SQLite (dev local)
    # DATABASE_URL: str = "sqlite:///./rabbitty.db"
    
    # Redis
    REDIS_URL: str = "redis://localhost:6379/0"
    
    # Security
    SECRET_KEY: str = ""
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60  # 1 hora
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7
    
    # Telegram
    BOT_TOKEN: str = ""
    
    # Blockchain — Sepolia testnet (cambiar a Polygon mainnet para producción)
    BUNZ_CONTRACT_ADDRESS: str = ""
    RPC_URL: str = "https://ethereum-sepolia-rpc.publicnode.com"
    CHAIN_ID: int = 11155111
    
    # Rate Limiting
    RATE_LIMIT_PER_MINUTE: int = 100
    
    # Features
    ENABLE_WEBSOCKETS: bool = True
    ENABLE_PUSH_NOTIFICATIONS: bool = False
    
    class Config:
        env_file = ".env"
        extra = "ignore"

    @classmethod
    def validate_secret_key(cls, v: str) -> str:
        if not v or len(v) < 32:
            import warnings
            warnings.warn(
                "SECRET_KEY no está configurada o es muy corta. "
                "Genera una con: openssl rand -base64 32"
            )
        return v

@lru_cache()
def get_settings() -> Settings:
    return Settings()

settings = get_settings()
