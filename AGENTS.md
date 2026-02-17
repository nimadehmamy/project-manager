# AGENTS.md - Project Context for AI Assistants

## Project Overview

**Project Manager** is a lightweight web interface for browsing files on a remote server (Beast) through a local web server. It's designed to run on a home server and provide secure access to project files.

## Architecture

- **Backend**: Python Flask application
- **Frontend**: Vanilla JavaScript with modern CSS
- **Remote Access**: SSH/SFTP via Paramiko to Beast server
- **Security**: Session-based auth, path jail to prevent directory traversal

### Dashboard Layout

Three-panel responsive layout:
1. **Left Sidebar**: Hierarchical project browser - expandable tree of directories in `__work/`
   - Click ▶ to expand subdirectories
   - Click folder name to select project
   - R/T badges show README.md/TODO.md availability
2. **Main Content**: Tabbed interface
   - Summary: Renders `README.md` with markdown
   - Todos: Renders `TODO.md` with markdown  
   - Files: GitHub-style file browser with popup preview
3. **Right Sidebar**: Chat placeholder (future AI integration)

### Key API Endpoints

| Endpoint | Description |
|----------|-------------|
| `GET /api/projects` | List all projects (directories) with metadata |
| `GET /api/project/readme?project=/path` | Get README.md content for a project |
| `GET /api/project/todo?project=/path` | Get TODO.md content for a project |
| `GET /api/browse?path=/path` | Browse directory contents |
| `GET /api/file?path=/path` | Download/view a file |

## Key Files

| File | Purpose |
|------|---------|
| `app.py` | Main Flask application with API endpoints |
| `config.py` | Configuration settings |
| `templates/index.html` | Main file browser UI |
| `static/js/app.js` | Frontend JavaScript |
| `static/css/style.css` | Styling |

## Environment

- **Remote Server**: Beast (192.168.1.157:2222, user: nima)
- **Root Jail**: `/home/nima/__work/` - Only this directory is accessible
- **SSH Key**: `~/.ssh/id_rsa_blk` (configured in ~/.ssh/config)

## Security Model

1. All paths are sanitized via `sanitize_path()` in `app.py`
2. Path traversal attempts (..) are blocked
3. Only authenticated users can access any endpoint
4. SSH connection uses existing key-based auth

## Development Commands

```bash
# Development mode
./start.sh

# Production mode (gunicorn)
./start-production.sh

# Set custom password
export PM_PASSWORD="secure_pass"
./start.sh
```

## Coding Conventions

- Follow PEP 8 for Python code
- Use async/await for frontend where applicable
- Keep authentication checks on all new endpoints
- Log all security-relevant events

## Notes for AI Assistants

- When adding new endpoints, always use `@require_auth` decorator
- Path handling must go through `sanitize_path()` to maintain security
- Beast connection is via SSH - test SSH connectivity before debugging
- This is a home server tool - prioritize simplicity over enterprise features
- **No sudo access**: I cannot run commands with sudo. Ask the user to run sudo commands manually
- Server is Ubuntu 24.04, user is `nima`, home directory is `/home/nima`
