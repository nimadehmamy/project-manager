#!/bin/bash

# Project Manager - Production Startup Script
# Uses gunicorn for better performance

cd "$(dirname "$0")"

# Check if virtual environment exists
if [ ! -d "venv" ]; then
    echo "Creating virtual environment..."
    python3 -m venv venv
fi

# Activate virtual environment
source venv/bin/activate

# Install/update dependencies
echo "Installing dependencies..."
pip install -q -r requirements.txt

# Install gunicorn if not present
pip install -q gunicorn 2>/dev/null || true

# Set default environment variables if not already set
export PM_HOST="${PM_HOST:-0.0.0.0}"
export PM_PORT="${PM_PORT:-8000}"

# Generate a random secret key if not set
if [ -z "$PM_SECRET_KEY" ]; then
    export PM_SECRET_KEY="$(openssl rand -hex 32)"
fi

# Create logs directory
mkdir -p logs

echo ""
echo "====================================="
echo "  Project Manager (Production)"
echo "====================================="
echo "  URL: http://localhost:${PM_PORT}"
echo "====================================="
echo ""

# Run with gunicorn
exec gunicorn \
    --bind "${PM_HOST}:${PM_PORT}" \
    --workers 2 \
    --threads 4 \
    --timeout 120 \
    --access-logfile logs/access.log \
    --error-logfile logs/error.log \
    --capture-output \
    app:app
