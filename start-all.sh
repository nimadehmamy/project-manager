#!/bin/bash
# Start both Flask and Terminal Service
# Usage: ./start-all.sh
# This script starts both the Flask web server (port 8000) and the Node.js terminal service (port 3001)
# Both services must be running for the Project Manager to work correctly

# Terminal Service
if ! pgrep -f "node.*server.js" > /dev/null; then
    echo "Starting Terminal Service on port 3001..."
    cd /home/nima/__work/project_manager/project_manager/terminal-service
    nohup node server.js > /tmp/terminal.log 2>&1 &
    sleep 2
fi

# Flask App
cd /home/nima/__work/project_manager/project_manager
source venv/bin/activate
if ! pgrep -f "python.*app.py" > /dev/null; then
    echo "Starting Flask App on port 8000..."
    nohup python -u app.py > /tmp/pm.log 2>&1 &
    sleep 3
fi

echo ""
echo "Services Status:"
echo "================"
curl -s http://localhost:3001/health 2>/dev/null || echo "Terminal Service: NOT RESPONDING"
echo "Flask App: http://localhost:8000 (check manually)"
echo ""
echo "PIDs:"
echo "  Terminal Service: $(pgrep -f 'node.*server.js' 2>/dev/null | tr '\n' ' ' || echo 'not running')"
echo "  Flask App: $(pgrep -f 'python.*app.py' 2>/dev/null | tr '\n' ' ' || echo 'not running')"
