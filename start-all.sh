#!/bin/bash
# Start Project Manager services
# Usage: ./start-all.sh
# This script starts Flask (port 8000), Terminal Service (port 3001), and Scanner Daemon

PM_DIR="/home/nima/__work/project_manager/project_manager"

# Terminal Service
if ! pgrep -f "node.*terminal-service/server.js" > /dev/null; then
    echo "Starting Terminal Service on port 3001..."
    cd "$PM_DIR/terminal-service"
    nohup node server.js > /tmp/terminal.log 2>&1 &
    sleep 2
fi

# Flask App
cd "$PM_DIR"
source venv/bin/activate
if ! pgrep -f "project_manager.*app\.py" > /dev/null; then
    echo "Starting Flask App on port 8000..."
    nohup python -u app.py > /tmp/pm.log 2>&1 &
    sleep 3
fi

# Scanner Daemon (background indexer for fast project browsing)
if ! pgrep -f "project_manager.*scanner_daemon\.py" > /dev/null; then
    echo "Starting Scanner Daemon..."
    nohup python scanner_daemon.py > /tmp/scanner.log 2>&1 &
    sleep 1
fi

echo ""
echo "Services Status:"
echo "================"
curl -s http://localhost:3001/health 2>/dev/null || echo "Terminal Service: NOT RESPONDING"
echo "Flask App: http://localhost:8000 (check manually)"
echo ""
echo "PIDs:"
echo "  Terminal Service: $(pgrep -f 'node.*terminal-service/server.js' 2>/dev/null | tr '\n' ' ' || echo 'not running')"
echo "  Flask App: $(pgrep -f 'project_manager.*app\.py' 2>/dev/null | tr '\n' ' ' || echo 'not running')"
echo "  Scanner Daemon: $(pgrep -f 'project_manager.*scanner_daemon\.py' 2>/dev/null | tr '\n' ' ' || echo 'not running')"
