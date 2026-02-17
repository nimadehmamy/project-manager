"""Configuration for Project Manager.

Reads from:
1. settings.json - General settings (server addresses, paths)
2. .credentials.py - Sensitive credentials (auto-generated, gitignored)
3. Environment variables - Override any setting
"""
import json
import os
from pathlib import Path

# Load settings from JSON file
SETTINGS_FILE = Path(__file__).parent / 'settings.json'
CREDENTIALS_FILE = Path(__file__).parent / '.credentials.py'

def load_settings():
    """Load settings from settings.json or return defaults."""
    defaults = {
        "server": {
            "host": "localhost",
            "port": 22,
            "user": os.environ.get('USER', 'user'),
            "key_path": "~/.ssh/id_rsa"
        },
        "remote_path": f"/home/{os.environ.get('USER', 'user')}/projects",
        "web": {
            "host": "0.0.0.0",
            "port": 8000
        }
    }
    
    if SETTINGS_FILE.exists():
        try:
            with open(SETTINGS_FILE) as f:
                loaded = json.load(f)
                # Merge with defaults
                for key, value in loaded.items():
                    if isinstance(value, dict) and key in defaults:
                        defaults[key].update(value)
                    else:
                        defaults[key] = value
        except Exception as e:
            print(f"Warning: Could not load settings.json: {e}")
    
    return defaults

def load_credentials():
    """Load credentials from .credentials.py if it exists."""
    creds = {
        'AUTH_USERNAME': 'admin',
        'AUTH_PASSWORD': 'changeme',
        'SECRET_KEY': 'dev-key-change-in-production'
    }
    
    if CREDENTIALS_FILE.exists():
        try:
            # Execute the credentials file in a restricted namespace
            namespace = {}
            with open(CREDENTIALS_FILE) as f:
                exec(f.read(), namespace)
            
            for key in creds.keys():
                if key in namespace:
                    creds[key] = namespace[key]
        except Exception as e:
            print(f"Warning: Could not load .credentials.py: {e}")
    
    return creds

# Load configuration files
settings = load_settings()
credentials = load_credentials()

# Server configuration (SSH to remote machine)
BEAST_HOST = os.environ.get('BEAST_HOST', settings['server']['host'])
BEAST_PORT = int(os.environ.get('BEAST_PORT', settings['server']['port']))
BEAST_USER = os.environ.get('BEAST_USER', settings['server']['user'])
BEAST_KEY_PATH = os.environ.get('BEAST_KEY_PATH', 
    os.path.expanduser(settings['server']['key_path']))
BEAST_WORK_DIR = os.environ.get('BEAST_WORK_DIR', 
    settings['remote_path'].rstrip('/').split('/')[-1])

# Web application configuration
HOST = os.environ.get('PM_HOST', settings['web']['host'])
PORT = int(os.environ.get('PM_PORT', settings['web']['port']))
DEBUG = os.environ.get('PM_DEBUG', 'false').lower() == 'true'

# Security credentials (can be overridden by environment variables)
SECRET_KEY = os.environ.get('PM_SECRET_KEY', credentials['SECRET_KEY'])
AUTH_USERNAME = os.environ.get('PM_USERNAME', credentials['AUTH_USERNAME'])
AUTH_PASSWORD = os.environ.get('PM_PASSWORD', credentials['AUTH_PASSWORD'])

# Security: Root jail - only files under this path are accessible
ROOT_JAIL = settings['remote_path']
