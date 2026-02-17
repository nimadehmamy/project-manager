"""Configuration example for Project Manager.

Copy this file to config.py and update with your actual values.
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

# Beast SSH configuration
BEAST_HOST = '192.168.1.XXX'  # Your Beast server IP
BEAST_USER = 'your-username'
BEAST_PORT = 2222
BEAST_KEY_PATH = '~/.ssh/your-key'
BEAST_WORK_DIR = '__work'

# Security: Root jail - only files under this path are accessible
ROOT_JAIL = f'/home/{BEAST_USER}/{BEAST_WORK_DIR}'
