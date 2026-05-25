# Rabbitty Backend API

FastAPI-based backend for the Rabbitty loyalty platform.

## 🚀 Quick Start

### Prerequisites
- Docker & Docker Compose
- Python 3.11+ (for local development)

### Using Docker (Recommended)

```bash
# 1. Clone and enter directory
cd backend/

# 2. Copy environment file
cp .env.example .env

# 3. Edit .env with your values
# BOT_TOKEN=your-telegram-bot-token
# SECRET_KEY=your-secret-key

# 4. Start services
docker-compose up -d

# 5. Run migrations
docker-compose exec backend alembic upgrade head

# 6. Access API at http://localhost:8000
# Swagger UI: http://localhost:8000/docs
```

### Local Development

```bash
# 1. Create virtual environment
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate

# 2. Install dependencies
pip install -r requirements.txt

# 3. Set up PostgreSQL locally or use Docker for DB only
docker-compose up -d db

# 4. Copy and configure environment
cp .env.example .env

# 5. Run migrations
alembic upgrade head

# 6. Start development server
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

## 📚 API Documentation

Once running, access:
- **Swagger UI**: http://localhost:8000/docs
- **ReDoc**: http://localhost:8000/redoc
- **OpenAPI Schema**: http://localhost:8000/openapi.json

## 🔐 Authentication

All endpoints (except health check) require Bearer token authentication:

1. Get token via `POST /api/v1/auth/telegram`
   - Send Telegram WebApp `initData` in body
   - Returns access_token and refresh_token

2. Use token in headers:
   ```
   Authorization: Bearer eyJhbGciOiJIUzI1NiIs...
   ```

## 🏗️ Architecture

```
backend/
├── app/
│   ├── main.py              # FastAPI app entry
│   ├── config.py            # Settings & env vars
│   ├── database.py          # SQLAlchemy setup
│   ├── models/              # SQLAlchemy models
│   ├── schemas/             # Pydantic schemas
│   ├── routes/              # API endpoints
│   └── services/            # Business logic
├── alembic/                 # Database migrations
├── Dockerfile
├── docker-compose.yml
└── requirements.txt
```

## 📋 API Endpoints

### Authentication
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/auth/telegram` | Login with Telegram |
| POST | `/api/v1/auth/refresh` | Refresh token |

### Users
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/users/me` | Get profile |
| PATCH | `/api/v1/users/me` | Update profile |
| GET | `/api/v1/users/me/stats` | User statistics |
| GET | `/api/v1/users/me/referrals` | Referral list |
| POST | `/api/v1/users/me/referrals` | Create referral code |

### Businesses
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/businesses` | List businesses |
| GET | `/api/v1/businesses/nearby` | Nearby businesses |
| GET | `/api/v1/businesses/{id}` | Business details |
| PATCH | `/api/v1/businesses/{id}/rate` | Update reward % |

### Transactions
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/transactions/scan` | Scan QR code |
| POST | `/api/v1/transactions/pay` | Make payment |
| GET | `/api/v1/transactions/history` | Transaction history |
| GET | `/api/v1/transactions/{id}/receipt` | Get receipt |

### Feed
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/feed` | Public feed |
| GET | `/api/v1/feed/personal` | Personal feed |
| GET | `/api/v1/feed/leaderboard` | Points leaderboard |

## 🛡️ Security Features

- JWT authentication with refresh tokens
- Telegram initData validation with HMAC
- Rate limiting (100 req/min per IP)
- CORS protection
- SQL injection prevention via SQLAlchemy
- Input validation via Pydantic schemas

## 🗄️ Database Schema

### Tables
- **users** - Telegram users
- **businesses** - Business profiles
- **transactions** - Payment transactions
- **referrals** - Referral tracking
- **feed_events** - Activity feed
- **qr_codes** - QR code tracking
- **refresh_tokens** - Token storage

## 🧪 Testing

```bash
# Install test dependencies
pip install pytest pytest-asyncio httpx

# Run tests
pytest
```

## 📝 License

Private - Bull's Lab
