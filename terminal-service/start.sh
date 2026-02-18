#!/bin/bash
# Start the terminal service

cd "$(dirname "$0")"

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
    echo "Installing dependencies..."
    npm install
fi

# Set SSH config from environment or defaults
export SSH_HOST="${BEAST_HOST:-192.168.1.157}"
export SSH_USER="${BEAST_USER:-nima}"
export SSH_PORT="${BEAST_PORT:-2222}"
export TERMINAL_PORT="${TERMINAL_PORT:-3001}"

echo "Starting terminal service..."
echo "SSH: $SSH_USER@$SSH_HOST:$SSH_PORT"
echo "Port: $TERMINAL_PORT"

npm start
