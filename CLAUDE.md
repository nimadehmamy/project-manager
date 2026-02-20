# Claude Code Configuration

See [AGENTS.md](./AGENTS.md) for full project context, architecture, and coding conventions.

## Quick Reference

- **Backend**: `app.py` (Flask + SocketIO on port 8000)
- **SSH Pool**: `ssh_pool.py` — all API endpoints use `ssh_pool.get_sftp()` context manager
- **Frontend**: `frontend/` (React + TypeScript + Vite)
- **Build**: `cd frontend && npm run build` (copies to `static/react/`)
- **Start**: `./start-all.sh` (Flask + Terminal Service)

## Key Patterns

- Use `with ssh_pool.get_sftp() as sftp:` for SFTP operations in endpoints
- Use `with ssh_pool.get_ssh() as (client, sftp):` when exec_command is needed
- All endpoints require `@require_auth` decorator
- All paths must go through `sanitize_path()`
- WebSocket events via `socketio.emit()` for real-time updates
