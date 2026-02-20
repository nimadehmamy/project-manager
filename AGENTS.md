# AGENTS.md - Project Context for AI Assistants

## Project Overview

**Project Manager** is a lightweight web interface for browsing files on a remote server (called "Beast") through a local web server. It's designed to run on a home server and provide secure access to project files.

## Architecture

### Key Distinction: Three-Machine Setup

```
┌─────────────────┐      HTTP/WebSocket     ┌─────────────────┐      SSH/Paramiko       ┌─────────────────┐
│   Your Laptop   │  ═══════════════════►   │  Flask Server   │  ═══════════════════►   │     Beast       │
│   (Browser)     │                         │  (Web + Term)   │                         │  (Projects)     │
│                 │                         │                 │                         │                 │
│  - Web Browser  │                         │  - Flask (8000) │                         │  - Projects     │
│  - Via Tailscale│                         │  - Node (3001)  │                         │  - Zellij       │
└─────────────────┘                         └─────────────────┘                         └─────────────────┘
```

**Important Network Topology Note:**
The web server can run on a different machine than your browser:
- **Your Laptop** - Where you run the web browser (can access via Tailscale/VPN)
- **Flask Server** - Where the web application runs (ports 8000 and 3001)
- **Beast** - Remote server with projects and Zellij (accessed via SSH)

- **Flask Web Server**: Runs on a host machine (may be different from your laptop)
- **Terminal Service**: Also runs on the same host as Flask (port 3001)
- **Beast (Remote Server)**: Where projects and Zellij sessions live (accessed via SSH)
- **Communication**: Browser → Flask (HTTP/WebSocket) → Beast (SSH)

### Stack

- **Backend**: Python Flask application (runs locally on port 8000)
- **Terminal Service**: Node.js + node-pty (runs locally on port 3001)
- **Frontend**: React + TypeScript + Vite (runs locally)  
- **Remote Access**: SSH/SFTP via Paramiko to Beast server
- **AI Agents**: Zellij sessions running ON BEAST, accessed via SSH
- **Security**: Session-based auth, path jail to prevent directory traversal

### Dashboard Layout

Three-panel responsive layout:
1. **Left Sidebar**: Hierarchical project browser - expandable tree of directories
   - Click ▶ to expand subdirectories
   - Click folder name to select project
   - R/T badges show README.md/TODO.md availability
2. **Main Content**: Tabbed interface
   - Summary: Renders `README.md` with markdown
   - Todos: Renders `TODO.md` with markdown  
   - Files: GitHub-style file browser with popup preview
3. **Right Sidebar**: Chat placeholder (future AI integration)

### Configuration

Settings are stored in:
- `settings.json` - Server addresses, paths (not sensitive)
- `.credentials.py` - Passwords, secret keys (gitignored)

Environment variables can override any setting:
- `BEAST_HOST`, `BEAST_USER`, `BEAST_PORT`, `BEAST_KEY_PATH`
- `PM_HOST`, `PM_PORT`, `PM_USERNAME`, `PM_PASSWORD`, `PM_SECRET_KEY`

## Key Files

| File | Purpose |
|------|---------|
| `app.py` | Main Flask application with API endpoints |
| `ssh_pool.py` | SSH connection pool — reuses Paramiko connections across requests |
| `scanner_daemon.py` | Background scanner that caches project data |
| `config.py` | Configuration loader (reads settings.json + .credentials.py) |
| `setup.py` | Interactive setup script for first-time configuration |
| `start-all.sh` | Starts both Flask and Terminal Service |
| `terminal-service/server.js` | Node.js terminal service with node-pty |
| `frontend/src/api/client.ts` | API client (axios) |
| `frontend/src/hooks/useProjects.ts` | React Query hooks including useTreeNode |
| `frontend/src/contexts/SocketContext.tsx` | WebSocket context for real-time updates |
| `frontend/src/components/common/FileTree.tsx` | Recursive file/dir tree component |
| `frontend/src/components/files/FilesTab.tsx` | Split-pane file browser (tree + viewer) |
| `frontend/src/components/files/CodeViewer.tsx` | CodeMirror 6 read-only viewer |
| `frontend/src/components/files/PdfViewer.tsx` | react-pdf inline viewer |
| `frontend/src/components/files/FileViewerPanel.tsx` | Inline file viewer panel |
| `frontend/src/components/terminal/TerminalPanel.tsx` | React terminal component |

## SSH Connection Pool

All API endpoints use the SSH connection pool (`ssh_pool.py`) instead of creating fresh connections:
- `with ssh_pool.get_sftp() as sftp:` — for SFTP-only operations
- `with ssh_pool.get_ssh() as (client, sftp):` — when exec_command is also needed
- Pool maintains up to 3 idle connections with 5-minute timeout
- Terminal/socket handlers use dedicated connections via `get_ssh_client()`

## Real-Time Updates

- When tasks are saved via `POST /api/project/progress`, the backend emits a `task_update` WebSocket event
- Frontend `SocketContext` provides a shared socket.io connection
- `HomeTab` listens for `task_update` events to update project data instantly

## Environment

- **Remote Server**: Configurable SSH host
- **Root Jail**: Configurable directory - Only this directory is accessible
- **SSH Key**: Configurable path in settings

## Security Model

1. All paths are sanitized via `sanitize_path()` in `app.py`
2. Path traversal attempts (..) are blocked
3. Only authenticated users can access any endpoint
4. SSH connection uses key-based auth

## Development Commands

```bash
# First time setup
python3 setup.py

# Start all services (Flask + Terminal Service) - RECOMMENDED
./start-all.sh

# Development mode (Flask only)
./start.sh

# Production mode (gunicorn)
./start-production.sh

# HTTPS mode
./start-https.sh
```

> **Note:** Always use `./start-all.sh` to start both the Flask web server (port 8000) and the Node.js terminal service (port 3001). Both services must be running for full functionality including terminals and Zellij integration.

## Coding Conventions

- Follow PEP 8 for Python code
- Use async/await for frontend where applicable
- Keep authentication checks on all new endpoints
- Log all security-relevant events
- Sanitize personal info before committing

## Terminal Service Architecture

### Two-Service Design

The system uses **two separate services** for better terminal emulation:

```
User Browser ──► Flask (port 8000) ──► SSH ──► Beast ──► Zellij Session
         │
         └── WebSocket ──► Node Terminal Service (port 3001)
                                     └──► SSH ──► Beast ──► bash/zellij
```

1. **Flask (port 8000)**: Web UI, API endpoints, session management
2. **Terminal Service (port 3001)**: Node.js + node-pty for real PTY terminals

### Why Two Services?

- **Python struggles with PTY**: Eventlet/asyncio don't handle real PTY well
- **node-pty**: Native Node.js module provides proper PTY allocation
- **SSH -t flag**: Critical for TTY allocation on remote Beast server
- **Full Terminal**: ANSI escape codes, colors, interactive programs work correctly

### Terminal Service (Node.js)

**Location**: `terminal-service/`
**Port**: 3001
**Key Features**:
- Spawns real PTY using `node-pty`
- WebSocket communication via Socket.IO
- SSH to Beast with automatic project path CD
- Session management with cleanup

**Commands**:
```bash
# Start terminal service
cd terminal-service && node server.js

# Or use PM2 for production
cd terminal-service && pm2 start ecosystem.config.js
```

**Health Check**:
```bash
curl http://localhost:3001/health
```

### Flask Integration

Flask provides API endpoints to list/create Zellij sessions:
- `GET /api/zellij/status` - Service health check
- `GET /api/zellij/sessions` - List Zellij sessions on Beast
- `POST /api/zellij/sessions` - Create new Zellij session
- `POST /api/zellij/sessions/<name>/kill` - Kill a session

### Frontend Terminal Component

**Location**: `frontend/src/components/terminal/TerminalPanel.tsx`

Connects to Node service on port 3001 via Socket.IO:
```typescript
const socket = io('http://localhost:3001');
socket.emit('start_session', { 
  type: 'zellij',      // or 'new' for standalone terminal
  projectPath: '/path/to/project',
  sessionName: 'pm-project'
});
```

### Session Naming Convention

For automatic project binding, name your Zellij sessions on Beast:
```bash
# If project is at /home/nima/projects/my-project
zellij --session pm-my-project
```

### Quick Start

```bash
# Start both services
./start-all.sh

# Or manually:
# Terminal 1: Terminal Service
cd terminal-service && node server.js

# Terminal 2: Flask App
source venv/bin/activate && python app.py
```

### Common Issues

1. **Terminal shows no output**: Check if terminal service is running on port 3001
2. **SSH key errors**: Verify `terminal-service/config.js` has correct key path
3. **CORS errors**: Ensure terminal service allows connections from Flask origin
4. **Mouse tracking in terminal**: Zellij enables mouse tracking by default. If hovering writes characters to the terminal, this is Zellij's mouse mode. To disable it in Zellij: press `Ctrl+G` → Options → uncheck "Enable Mouse Mode"
5. **Powerline fonts not showing**: The terminal uses Nerd Fonts for special characters. These must be installed on the machine running the browser (your laptop), not the server. The browser loads these fonts to render the terminal.

## Notes for AI Assistants

- When adding new endpoints, always use `@require_auth` decorator
- Path handling must go through `sanitize_path()` to maintain security
- Remote connection is via SSH - test SSH connectivity before debugging
- This is a home server tool - prioritize simplicity over enterprise features
- **No sudo access**: I cannot run commands with sudo. Ask the user to run sudo commands manually
- Server is Ubuntu 24.04
- **TWO MACHINE ARCHITECTURE**: Flask is local, projects and Zellij are on Beast

## Git Workflow

When making changes to the project, periodically commit and push to git:

```bash
# Check status
git status

# Add changes
git add -A

# Commit with descriptive message
git commit -m "Description of changes"

# Push to remote
git push
```

**Note**: Always rebuild the frontend (`npm run build` in `frontend/`) before committing if you made changes to the React code. This updates the static files in `static/react/`.
