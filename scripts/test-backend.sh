#!/bin/bash

echo "🐰 Rabbitty Backend Test"
echo "========================"
echo ""

cd src/backend

# Check if dependencies installed
if [ ! -d "venv" ]; then
    echo "Creating virtual environment..."
    python3 -m venv venv
fi

source venv/bin/activate

echo "Installing dependencies..."
pip install -q fastapi uvicorn pydantic

echo ""
echo "Starting server on http://localhost:3000"
echo "Press Ctrl+C to stop"
echo ""

python server.py
