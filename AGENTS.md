# AGENTS.md - Project Context for AI Assistants

## Project Overview

**Project Manager** is a lightweight web interface for browsing files on a remote server through a local web server. It's designed to run on a home server and provide secure access to project files.

## Architecture

- **Backend**: Python Flask application
- **Frontend**: Vanilla JavaScript with modern CSS
- **Remote Access**: SSH/SFTP via Paramiko to remote server
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
| `config.py` | Configuration loader (reads settings.json + .credentials.py) |
| `setup.py` | Interactive setup script for first-time configuration |
| `templates/index.html` | Main dashboard UI |
| `static/js/app.js` | Frontend JavaScript |
| `static/css/style.css` | Styling |

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

# Development mode
./start.sh

# Production mode (gunicorn)
./start-production.sh

# HTTPS mode
./start-https.sh
```

## Coding Conventions

- Follow PEP 8 for Python code
- Use async/await for frontend where applicable
- Keep authentication checks on all new endpoints
- Log all security-relevant events
- Sanitize personal info before committing

## Notes for AI Assistants

- When adding new endpoints, always use `@require_auth` decorator
- Path handling must go through `sanitize_path()` to maintain security
- Remote connection is via SSH - test SSH connectivity before debugging
- This is a home server tool - prioritize simplicity over enterprise features
- **No sudo access**: I cannot run commands with sudo. Ask the user to run sudo commands manually
- Server is Ubuntu 24.04
