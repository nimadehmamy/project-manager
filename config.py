"""Configuration for Project Manager.

Values can be set via environment variables or directly in this file.
Environment variables take precedence.
"""
import os

# Server configuration
HOST = os.environ.get('PM_HOST', '0.0.0.0')
PORT = int(os.environ.get('PM_PORT', '8000'))
DEBUG = os.environ.get('PM_DEBUG', 'false').lower() == 'true'

# Security - CHANGE THESE! Use environment variables in production
SECRET_KEY = os.environ.get('PM_SECRET_KEY', 'dev-key-change-in-production')
AUTH_USERNAME = os.environ.get('PM_USERNAME', 'admin')
AUTH_PASSWORD = os.environ.get('PM_PASSWORD', 'changeme')

# Beast SSH configuration
# Set these via environment variables or update below
BEAST_HOST = os.environ.get('BEAST_HOST', '192.168.1.XXX')  # Update this
BEAST_USER = os.environ.get('BEAST_USER', 'nima')
BEAST_PORT = int(os.environ.get('BEAST_PORT', '2222'))
BEAST_KEY_PATH = os.environ.get('BEAST_KEY_PATH', os.path.expanduser('~/.ssh/id_rsa_blk'))
BEAST_WORK_DIR = os.environ.get('BEAST_WORK_DIR', '__work')

# Security: Root jail - only files under this path are accessible
ROOT_JAIL = f'/home/{BEAST_USER}/{BEAST_WORK_DIR}'
