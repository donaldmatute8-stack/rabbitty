#!/bin/bash

echo "🐰 Rabbitty Deployment Script"
echo "==============================="
echo ""

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}Step 1: Installing backend dependencies...${NC}"
cd src/backend
python3 -m venv venv 2>/dev/null || true
source venv/bin/activate
pip install -r requirements.txt
echo -e "${GREEN}✓ Backend ready${NC}"
echo ""

cd ../..

echo -e "${BLUE}Step 2: Installing frontend dependencies...${NC}"
cd src/frontend
npm install
echo -e "${GREEN}✓ Frontend ready${NC}"
echo ""

cd ../..

echo -e "${BLUE}Step 3: Building frontend...${NC}"
cd src/frontend
npm run build
echo -e "${GREEN}✓ Build complete${NC}"
echo ""

cd ../..

echo -e "${BLUE}Step 4: Starting services...${NC}"
echo ""
echo "Backend: http://localhost:3000"
echo "Frontend: http://localhost:5173"
echo ""
echo "Press Ctrl+C to stop all services"
echo ""

# Start both in background and wait
trap 'kill %1 %2' SIGINT
cd src/backend && python server.py &
cd src/frontend && npm run dev &

wait
