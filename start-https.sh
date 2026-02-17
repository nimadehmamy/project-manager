#!/bin/bash

# Project Manager - HTTPS Startup Script
# Uses self-signed certificates for encrypted access

cd "$(dirname "$0")"

# Check if certificates exist
if [ ! -f "cert.pem" ] || [ ! -f "key.pem" ]; then
    echo "Generating self-signed certificates..."
    openssl req -x509 -newkey rsa:4096 -keyout key.pem -out cert.pem -days 365 -nodes -subj "/CN=localhost"
    echo ""
    echo "⚠️  Self-signed certificate created."
    echo "   Browsers will show a warning - this is expected and safe for Tailscale use."
    echo "   The connection IS encrypted."
    echo ""
fi

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
export PM_PORT="${PM_PORT:-8443}"

# Generate a random secret key if not set
if [ -z "$PM_SECRET_KEY" ]; then
    export PM_SECRET_KEY="$(openssl rand -hex 32)"
fi

echo ""
echo "====================================="
echo "  Project Manager (HTTPS)"
echo "====================================="
echo "  URL: https://100.104.51.20:${PM_PORT}"
echo "  Note: Self-signed certificate"
echo "        Click 'Advanced' → 'Proceed' in browser"
echo "====================================="
echo ""
echo "Default credentials: admin / changeme"
echo ""

# Run the application with HTTPS
python app.py --https
