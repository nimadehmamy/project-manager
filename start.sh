#!/bin/bash

# Project Manager Startup Script

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

# Set default environment variables if not already set
export PM_HOST="${PM_HOST:-0.0.0.0}"
export PM_PORT="${PM_PORT:-8000}"

# Generate a random secret key if not set
if [ -z "$PM_SECRET_KEY" ]; then
    export PM_SECRET_KEY="$(openssl rand -hex 32)"
fi

echo ""
echo "====================================="
echo "  Project Manager Starting"
echo "====================================="
echo "  Local URL: http://localhost:${PM_PORT}"
echo "  Network:   http://0.0.0.0:${PM_PORT}"
echo "====================================="
echo ""
echo "Run 'python3 setup.py' first if you haven't configured"
echo ""

# Run the application
python app.py
