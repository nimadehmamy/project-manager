"""Configuration example for Project Manager.

Copy this file to config.py and update with your actual values,
Or use environment variables (recommended for production).
"""

# Server configuration
HOST = '0.0.0.0'
PORT = 8000
DEBUG = False

# Security - CHANGE THESE!
SECRET_KEY = 'your-random-secret-key-here'
AUTH_USERNAME = 'admin'
AUTH_PASSWORD = 'changeme'

# Remote SSH server configuration
REMOTE_HOST = '192.168.1.XXX'  # Remote server IP or SSH alias
REMOTE_USER = 'your-username'
REMOTE_PORT = 22
REMOTE_KEY_PATH = '~/.ssh/id_rsa'
REMOTE_WORK_DIR = 'projects'

# Security: Root jail - only files under this path are accessible
ROOT_JAIL = f'/home/{REMOTE_USER}/{REMOTE_WORK_DIR}'
