# Project Manager

A simple, secure web interface to browse files on your Beast server through this machine.

## Overview

- **Browse projects hierarchically** - Expandable tree view of all directories in `__work/`
- **View README/TODO** - Automatic markdown rendering of project documentation
- **Access Beast files** via SSH/SFTP through a web interface
- **Security**: Path traversal protection ensures only `__work/` directory is accessible
- **Authentication**: Simple login system with session management
- **File preview**: View text files directly in the browser
- **Download**: Download any file from the workspace

## Quick Start

### 1. Configure

Copy the example config and update with your values:

```bash
cd project_manager
cp config.example.py config.py
# Edit config.py with your Beast server details
```

Or use environment variables (recommended):

```bash
export BEAST_HOST="192.168.1.XXX"  # Your Beast IP
export BEAST_USER="your-username"
export BEAST_PORT="2222"
export BEAST_KEY_PATH="~/.ssh/your-key"
export PM_PASSWORD="your-secure-password"
```

### 2. Run

```bash
./start.sh
```

Then access: `http://localhost:8000`

Default credentials (if not set via env):
- Username: `admin`
- Password: `changeme`

## Remote Access (Tailscale)

The server can be accessed via Tailscale (configured separately).

To get your Tailscale IP, run `tailscale status` on the server.

**On your laptop:**
```bash
# Install Tailscale
curl -fsSL https://tailscale.com/install.sh | sh
sudo systemctl enable --now tailscaled
sudo tailscale up

# Then access:
http://100.104.51.20:8000
```

Benefits:
- No SSH port forwarding needed
- Works from anywhere (even behind restrictive firewalls)
- Encrypted mesh network (even with HTTP URL!)
- No router configuration required

**Note on HTTPS:** With Tailscale, your traffic is encrypted by the WireGuard tunnel, so HTTP is actually secure. However, if you want the browser to show a lock icon:

```bash
# Start with self-signed HTTPS certificate
./start-https.sh
# Access: https://100.104.51.20:8443
# (browser will warn about self-signed cert - click Advanced → Proceed)

## Configuration

Set environment variables to customize:

| Variable | Default | Description |
|----------|---------|-------------|
| `PM_HOST` | `0.0.0.0` | Server bind address |
| `PM_PORT` | `8000` | Server port |
| `PM_USERNAME` | `admin` | Login username |
| `PM_PASSWORD` | `changeme` | Login password |
| `PM_SECRET_KEY` | (random) | Flask session key |
| `PM_DEBUG` | `false` | Debug mode |

Example:
```bash
export PM_PASSWORD="my_secure_password"
export PM_PORT=8080
./start.sh
```

## SSH Access

The app uses the SSH config from `~/.ssh/config` to connect to Beast:
- Host: `192.168.1.157`
- Port: `2222`
- User: `nima`
- Key: `~/.ssh/id_rsa_blk`

## Security Features

1. **Path Jail**: All file access is restricted to `/home/nima/__work/` on Beast
2. **Path Sanitization**: `..` and other traversal attempts are blocked
3. **Authentication**: Session-based login required for all endpoints
4. **SSH Key Auth**: Uses your existing SSH key (no passwords stored)

## Future Improvements

- Add file upload capability
- Add file/directory creation
- Add search functionality
- Add multiple user support
- Add HTTPS support
- Add project bookmarks/notes
