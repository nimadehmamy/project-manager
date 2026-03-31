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

## TODO Task Tracking

Always refer to the project's TODO list on Beast at `{ROOT_JAIL}/TODO/.project_manager/tasks.yml` (where `ROOT_JAIL` comes from `config.py`). At the start of each session, fetch this file via SSH to see the latest priorities. Mark tasks as `in_progress` or `completed` using the `update_task.py` script in the same directory. See the "TODO Task Tracking" section in AGENTS.md for detailed usage.

**Important**: Only focus on subtasks under the "Project Manager" parent task (id `new-1772130085635`). Other top-level tasks (Today, Energy-GPT, BHAttention, etc.) are unrelated projects — do not act on them.
