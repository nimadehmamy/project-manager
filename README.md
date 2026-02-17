# Project Manager

A secure web interface to browse projects on a remote server via SSH/SFTP.

## Overview

- **Browse projects hierarchically** - Expandable tree view of all directories
- **View README/TODO** - Automatic markdown rendering of project documentation
- **Access remote files** via SSH/SFTP through a web interface
- **Security**: Path traversal protection ensures only configured directory is accessible
- **Authentication**: Simple login system with session management
- **File preview**: View text files with syntax highlighting
- **Download**: Download any file from the workspace
- **Remote access**: Works with Tailscale for secure access from anywhere

## Quick Start

### 1. Install Dependencies

```bash
cd project_manager
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

### 2. Configure

Run the setup script to configure your server and credentials:

```bash
python3 setup.py
```

This will ask for:
- Remote server (IP, hostname, or SSH alias from `~/.ssh/config`)
- Username and SSH key path
- Remote projects directory (absolute path)
- Web interface username and password

Configuration is stored in:
- `settings.json` - General settings (servers, paths)
- `.credentials.py` - Sensitive data (passwords, keys) - **This file is gitignored**

### 3. Run

```bash
./start.sh
```

Then access: `http://localhost:8000`

## Manual Configuration

You can also set configuration via environment variables:

```bash
# Remote server connection
export BEAST_HOST="192.168.1.100"      # Remote server IP or hostname
export BEAST_USER="username"           # SSH username
export BEAST_PORT="22"                 # SSH port
export BEAST_KEY_PATH="~/.ssh/id_rsa"  # SSH private key

# Web application
export PM_HOST="0.0.0.0"               # Web server bind address
export PM_PORT="8000"                  # Web server port
export PM_USERNAME="admin"             # Login username
export PM_PASSWORD="your-password"     # Login password
export PM_SECRET_KEY="random-secret"   # Session encryption key
```

## Remote Access with Tailscale

For secure remote access without port forwarding:

1. Install Tailscale on your server and laptop:
   ```bash
   curl -fsSL https://tailscale.com/install.sh | sh
   sudo tailscale up
   ```

2. Access via Tailscale IP:
   ```
   http://<server-tailscale-ip>:8000
   ```

Benefits:
- No SSH port forwarding needed
- Encrypted mesh network
- Works from anywhere
- No router configuration required

## File Viewer Features

The file viewer popup supports:
- **Markdown files** - Rendered as formatted HTML
- **Code files** - Syntax highlighting for Python, JavaScript, CSS, JSON, YAML, Bash, and more
- **Plain text** - Clean formatting for other files

## HTTPS Support

For HTTPS with self-signed certificates:

```bash
./start-https.sh
# Access: https://localhost:8443
```

## Project Structure

```
project_manager/
├── app.py                 # Main Flask application
├── config.py              # Configuration loader
├── setup.py               # Interactive setup script
├── settings.json          # Your server settings (created by setup)
├── .credentials.py        # Your credentials (gitignored, created by setup)
├── requirements.txt       # Python dependencies
├── start.sh               # Development server
├── start-https.sh         # HTTPS server
├── start-production.sh    # Production server (gunicorn)
├── templates/
│   ├── login.html         # Login page
│   └── index.html         # Dashboard
├── static/
│   ├── css/style.css      # Styles
│   └── js/app.js          # Frontend
├── README.md              # This file
├── TODO.md                # Feature roadmap
└── AGENTS.md              # Context for AI assistants
```

## Security Features

1. **Path Jail**: All file access is restricted to the configured directory
2. **Path Sanitization**: `..` and other traversal attempts are blocked
3. **Authentication**: Session-based login required for all endpoints
4. **SSH Key Auth**: Uses your existing SSH key (no passwords stored)

## Development

### Adding Features

See `TODO.md` for planned features and `AGENTS.md` for technical context.

### Testing Changes

```bash
# Run development server with auto-reload
export PM_DEBUG=true
./start.sh
```

## Troubleshooting

**SSH connection fails:**
- Verify the server is reachable: `ssh <alias>`
- Check SSH key permissions: `chmod 600 ~/.ssh/id_rsa`
- Ensure the key is added to ssh-agent: `ssh-add ~/.ssh/id_rsa`

**Cannot see projects:**
- Verify the remote path exists and is readable
- Check that the SSH user has permissions on that directory

**Port already in use:**
- Change the port: `export PM_PORT=8080` before running

## License

MIT License - See LICENSE file for details
