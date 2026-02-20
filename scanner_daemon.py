#!/usr/bin/env python3
"""
Background scanner daemon for Project Manager.

Scans the directory structure periodically and maintains cached indexes
for fast access by the web application.
"""

import json
import os
import stat
import time
import threading
from pathlib import Path
from datetime import datetime

import paramiko
import yaml
from config import BEAST_HOST, BEAST_PORT, BEAST_USER, BEAST_KEY_PATH, ROOT_JAIL

# Cache files
CACHE_DIR = Path('/tmp/pm_cache')
PROJECTS_CACHE = CACHE_DIR / 'projects.json'
DIR_TREE_CACHE = CACHE_DIR / 'directory_tree.json'
MANAGED_PROJECTS_CACHE = CACHE_DIR / 'managed_projects.json'
LAST_SCAN_TIME = CACHE_DIR / 'last_scan.txt'

# Scan interval (seconds)
SCAN_INTERVAL = 300  # 5 minutes

# Exclude patterns
EXCLUDE_DIRS = {'wandb', '.git', '.venv', 'venv', 'node_modules', 
                'results', 'logs', '__pycache__', '.pytest_cache',
                'dist', 'build', '.vscode', '.idea', '.git', '.claude'}


def get_ssh_client():
    """Create SSH connection to Beast."""
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    client.connect(
        hostname=BEAST_HOST,
        port=BEAST_PORT,
        username=BEAST_USER,
        key_filename=BEAST_KEY_PATH,
    )
    return client


def scan_directory_tree(sftp, root_path):
    """Scan directory tree using BFS and return structured data."""
    tree = {
        'path': '/',
        'name': os.path.basename(root_path) or 'root',
        'is_dir': True,
        'children': [],
        'has_project_manager': False,
        'modified': None
    }
    
    # Queue: (path, parent_node)
    queue = [(root_path, tree)]
    visited = set()
    
    while queue:
        current_path, parent_node = queue.pop(0)
        
        if current_path in visited:
            continue
        visited.add(current_path)
        
        try:
            # Check for .project_manager
            has_pm = False
            try:
                sftp.stat(f"{current_path}/.project_manager")
                has_pm = True
            except FileNotFoundError:
                pass
            
            # List directory contents
            entries = []
            for entry in sftp.listdir_attr(current_path):
                name = entry.filename
                
                # Skip hidden and excluded
                if name.startswith('.') and name != '.project_manager':
                    continue
                if name in EXCLUDE_DIRS:
                    continue
                
                full_path = f"{current_path}/{name}"
                is_dir = stat.S_ISDIR(entry.st_mode)
                
                rel_path = full_path[len(root_path):].lstrip('/')
                if not rel_path:
                    rel_path = name
                
                entry_data = {
                    'path': '/' + rel_path if not rel_path.startswith('/') else rel_path,
                    'name': name,
                    'is_dir': is_dir,
                    'modified': datetime.fromtimestamp(entry.st_mtime).strftime('%Y-%m-%d'),
                    'has_project_manager': False,
                    'children': [] if is_dir else None
                }
                
                if is_dir:
                    # Check if this subdir has .project_manager
                    try:
                        sftp.stat(f"{full_path}/.project_manager")
                        entry_data['has_project_manager'] = True
                    except FileNotFoundError:
                        pass
                    
                    entries.append((full_path, entry_data))
                
                parent_node['children'].append(entry_data)
            
            # Add subdirectories to queue for further scanning
            for subdir_path, entry_data in entries:
                if len(subdir_path.split('/')) - len(root_path.split('/')) < 5:
                    queue.append((subdir_path, entry_data))
                    
        except Exception as e:
            print(f"Error scanning {current_path}: {e}")
            continue
    
    return tree


def scan_managed_projects(sftp, root_path):
    """Scan for all projects with .project_manager and their progress."""
    projects = []
    
    # BFS to find all .project_manager directories
    queue = [root_path]
    visited = set()
    
    while queue:
        current_dir = queue.pop(0)
        
        if current_dir in visited:
            continue
        visited.add(current_dir)
        
        try:
            # Check if this directory has .project_manager
            try:
                sftp.stat(f"{current_dir}/.project_manager")
                # Found a project!
                project_path = current_dir
                rel_path = project_path[len(root_path):].lstrip('/')
                if not rel_path:
                    rel_path = os.path.basename(project_path)
                project_name = os.path.basename(project_path)
                
                # Read tasks.yml
                try:
                    with sftp.file(f"{current_dir}/.project_manager/tasks.yml", 'r') as f:
                        content = f.read().decode('utf-8')
                        data = yaml.safe_load(content) or {}
                    
                    tasks = data.get('tasks', [])
                    total = len(tasks)
                    completed = sum(1 for t in tasks if t.get('status') == 'completed')
                    in_progress = sum(1 for t in tasks if t.get('status') == 'in_progress')
                    blocked = sum(1 for t in tasks if t.get('status') == 'blocked')
                    progress = (completed / total * 100) if total > 0 else 0

                    projects.append({
                        'path': rel_path,
                        'name': data.get('project', {}).get('name', project_name),
                        'status': data.get('project', {}).get('status', 'active'),
                        'total_tasks': total,
                        'completed': completed,
                        'in_progress': in_progress,
                        'blocked': blocked,
                        'progress': round(progress, 1),
                        'tasks': tasks[:10] if tasks else [],
                        'has_more_tasks': len(tasks) > 10,
                    })
                except Exception:
                    # No valid tasks.yml
                    projects.append({
                        'path': rel_path,
                        'name': project_name,
                        'status': 'active',
                        'total_tasks': 0,
                        'completed': 0,
                        'in_progress': 0,
                        'blocked': 0,
                        'progress': 0,
                        'tasks': [],
                        'has_more_tasks': False,
                    })
            except FileNotFoundError:
                pass
            
            # List subdirectories and add to queue
            if len(current_dir.split('/')) - len(root_path.split('/')) < 10:
                for entry in sftp.listdir_attr(current_dir):
                    if stat.S_ISDIR(entry.st_mode):
                        name = entry.filename
                        if name not in EXCLUDE_DIRS and not name.startswith('.'):
                            full_path = f"{current_dir}/{name}"
                            queue.append(full_path)
                            
        except Exception as e:
            print(f"Error scanning {current_dir}: {e}")
            continue
    
    # Sort by completion status
    projects.sort(key=lambda p: (p['completed'] == p['total_tasks'], -p['progress']))
    
    return projects


def save_cache(data, cache_file):
    """Save data to cache file atomically."""
    temp_file = str(cache_file) + '.tmp'
    with open(temp_file, 'w') as f:
        json.dump(data, f)
    os.rename(temp_file, cache_file)


def perform_scan():
    """Perform full scan and update caches."""
    print(f"[{datetime.now()}] Starting scan...")
    
    try:
        client = get_ssh_client()
        sftp = client.open_sftp()
        
        # Scan directory tree
        print("  Scanning directory tree...")
        tree = scan_directory_tree(sftp, ROOT_JAIL)
        save_cache(tree, DIR_TREE_CACHE)
        
        # Scan managed projects
        print("  Scanning managed projects...")
        projects = scan_managed_projects(sftp, ROOT_JAIL)
        save_cache({'count': len(projects), 'projects': projects}, MANAGED_PROJECTS_CACHE)
        
        sftp.close()
        client.close()
        
        # Update last scan time
        with open(LAST_SCAN_TIME, 'w') as f:
            f.write(str(time.time()))
        
        print(f"[{datetime.now()}] Scan complete. Found {len(projects)} projects.")
        
    except Exception as e:
        print(f"[{datetime.now()}] Scan error: {e}")


TRIGGER_FILE = CACHE_DIR / 'refresh.trigger'

def check_trigger():
    """Check if a refresh trigger file exists."""
    if TRIGGER_FILE.exists():
        try:
            TRIGGER_FILE.unlink()
            return True
        except Exception:
            pass
    return False

def run_daemon():
    """Run the scanner daemon loop."""
    print(f"Starting Project Manager Scanner Daemon")
    print(f"Cache directory: {CACHE_DIR}")
    print(f"Scan interval: {SCAN_INTERVAL} seconds")
    print(f"Root path: {ROOT_JAIL}")
    
    # Ensure cache directory exists
    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    
    # Do initial scan immediately
    perform_scan()
    
    # Schedule periodic scans
    elapsed = 0
    check_interval = 5  # Check for triggers every 5 seconds
    while True:
        time.sleep(check_interval)
        elapsed += check_interval
        
        # Check for trigger file (immediate refresh request)
        if check_trigger():
            print(f"[{datetime.now()}] Triggered refresh requested")
            perform_scan()
            elapsed = 0
        # Regular periodic scan
        elif elapsed >= SCAN_INTERVAL:
            perform_scan()
            elapsed = 0


def run_once():
    """Run a single scan and exit."""
    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    perform_scan()


if __name__ == '__main__':
    import sys
    
    if len(sys.argv) > 1 and sys.argv[1] == '--once':
        run_once()
    else:
        run_daemon()
