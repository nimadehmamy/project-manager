"""Project Manager - Secure file browser for remote server."""

import json
import os
import stat
import time
from datetime import datetime
from functools import wraps
from pathlib import Path

import paramiko
import yaml
from flask import (
    Flask,
    Response,
    abort,
    jsonify,
    redirect,
    render_template,
    request,
    send_from_directory,
    session,
    stream_with_context,
)

import ssl
import sys

from config import (
    AUTH_PASSWORD,
    AUTH_USERNAME,
    BEAST_HOST,
    BEAST_KEY_PATH,
    BEAST_PORT,
    BEAST_USER,
    DEBUG,
    HOST,
    PORT,
    ROOT_JAIL,
    SECRET_KEY,
)

from zellij_manager import get_zellij_manager

app = Flask(__name__)
app.secret_key = SECRET_KEY

# Initialize SocketIO for WebSocket support
from flask_socketio import SocketIO, emit
try:
    import eventlet
    async_mode = 'eventlet'
except ImportError:
    async_mode = 'threading'

socketio = SocketIO(app, async_mode=async_mode, cors_allowed_origins="*", ping_timeout=60)


def get_ssh_client():
    """Create and return an SSH client connected to remote server."""
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    client.connect(
        hostname=BEAST_HOST,
        port=BEAST_PORT,
        username=BEAST_USER,
        key_filename=BEAST_KEY_PATH,
    )
    return client


def require_auth(f):
    """Decorator to require authentication."""

    @wraps(f)
    def decorated(*args, **kwargs):
        if not session.get('authenticated'):
            return redirect('/login')
        return f(*args, **kwargs)

    return decorated


def sanitize_path(user_path):
    """
    Sanitize and validate the user-provided path.
    Returns the absolute path if valid, None otherwise.
    Ensures path traversal outside ROOT_JAIL is impossible.
    """
    if not user_path:
        user_path = '/'

    # Normalize the path
    user_path = os.path.normpath(user_path)

    # Remove any .. attempts explicitly
    if '..' in user_path.split(os.sep):
        return None

    # Construct full path on Beast
    full_path = os.path.join(ROOT_JAIL, user_path.lstrip('/'))
    full_path = os.path.normpath(full_path)

    # Ensure the resolved path is within ROOT_JAIL
    real_root = os.path.normpath(ROOT_JAIL)
    if not full_path.startswith(real_root):
        return None

    return full_path


def get_file_info(sftp, path, name):
    """Get file/directory information."""
    full_path = f"{path}/{name}"
    try:
        stat_info = sftp.stat(full_path)
        is_dir = stat.S_ISDIR(stat_info.st_mode)
        size = stat_info.st_size if not is_dir else None
        mtime = datetime.fromtimestamp(stat_info.st_mtime).strftime('%Y-%m-%d %H:%M')

        return {
            'name': name,
            'path': full_path.replace(ROOT_JAIL, '') or '/',
            'is_dir': is_dir,
            'size': size,
            'modified': mtime,
        }
    except Exception as e:
        app.logger.error(f"Error getting info for {full_path}: {e}")
        return None


@app.route('/login', methods=['GET', 'POST'])
def login():
    """Handle login."""
    if request.method == 'POST':
        username = request.form.get('username', '').strip()
        password = request.form.get('password', '').strip()

        if username == AUTH_USERNAME and password == AUTH_PASSWORD:
            session['authenticated'] = True
            return redirect('/')
        else:
            return render_template('login.html', error='Invalid credentials')

    return render_template('login.html')


@app.route('/logout')
def logout():
    """Handle logout."""
    session.pop('authenticated', None)
    return redirect('/login')


@app.route('/')
@require_auth
def index():
    """Main page - serve React app."""
    return send_from_directory('static/react', 'index.html')


@app.route('/static/<path:path>')
def static_files(path):
    """Serve static files including React build."""
    return send_from_directory('static', path)


# Catch-all route for React Router
@app.route('/<path:path>')
@require_auth
def catch_all(path):
    """Serve React app for all routes (React Router handles client-side routing)."""
    # Check if it's a file request
    if '.' in path:
        return send_from_directory('static/react', path)
    return send_from_directory('static/react', 'index.html')


@app.route('/api/browse')
@require_auth
def api_browse():
    """API endpoint to browse directories."""
    path = request.args.get('path', '/')
    safe_path = sanitize_path(path)

    if safe_path is None:
        return jsonify({'error': 'Access denied - path outside allowed directory'}), 403

    try:
        client = get_ssh_client()
        sftp = client.open_sftp()

        # Verify path exists and is a directory
        try:
            stat_info = sftp.stat(safe_path)
            if not stat.S_ISDIR(stat_info.st_mode):
                sftp.close()
                client.close()
                return jsonify({'error': 'Not a directory'}), 400
        except FileNotFoundError:
            sftp.close()
            client.close()
            return jsonify({'error': 'Directory not found'}), 404

        # List directory contents
        entries = []
        for entry in sftp.listdir(safe_path):
            info = get_file_info(sftp, safe_path, entry)
            if info:
                entries.append(info)

        # Sort: directories first, then by name
        entries.sort(key=lambda x: (not x['is_dir'], x['name'].lower()))

        sftp.close()
        client.close()

        # Calculate parent path for navigation
        parent_path = None
        if safe_path != ROOT_JAIL:
            rel_path = safe_path.replace(ROOT_JAIL, '') or '/'
            parent_path = str(Path(rel_path).parent)
            if parent_path == '.':
                parent_path = '/'

        return jsonify({
            'path': path,
            'entries': entries,
            'parent': parent_path,
        })

    except Exception as e:
        app.logger.error(f"Error browsing {path}: {e}")
        return jsonify({'error': f'Failed to browse directory: {str(e)}'}), 500


@app.route('/api/file')
@require_auth
def api_file():
    """API endpoint to view/download a file."""
    path = request.args.get('path', '')
    download = request.args.get('download', 'false').lower() == 'true'

    if not path:
        return jsonify({'error': 'No file specified'}), 400

    safe_path = sanitize_path(path)
    if safe_path is None:
        return jsonify({'error': 'Access denied'}), 403

    try:
        client = get_ssh_client()
        sftp = client.open_sftp()

        # Verify it's a file, not a directory
        try:
            stat_info = sftp.stat(safe_path)
            if stat.S_ISDIR(stat_info.st_mode):
                sftp.close()
                client.close()
                return jsonify({'error': 'Cannot download a directory'}), 400
        except FileNotFoundError:
            sftp.close()
            client.close()
            return jsonify({'error': 'File not found'}), 404

        # Stream the file
        filename = os.path.basename(safe_path)

        def generate():
            with sftp.file(safe_path, 'rb') as f:
                while True:
                    chunk = f.read(8192)
                    if not chunk:
                        break
                    yield chunk
            sftp.close()
            client.close()

        # Guess content type
        content_type = 'application/octet-stream'
        if filename.endswith(('.txt', '.md', '.py', '.js', '.html', '.css', '.json', '.yaml', '.yml')):
            content_type = 'text/plain'

        headers = {}
        if download:
            headers['Content-Disposition'] = f'attachment; filename="{filename}"'

        return Response(
            stream_with_context(generate()),
            content_type=content_type,
            headers=headers,
        )

    except Exception as e:
        app.logger.error(f"Error reading file {path}: {e}")
        return jsonify({'error': f'Failed to read file: {str(e)}'}), 500


def scan_directory(sftp, base_path, rel_path=""):
    """Recursively scan a directory for subdirectories."""
    entries = []
    full_base = f"{base_path}/{rel_path}".rstrip('/')
    
    try:
        for entry in sftp.listdir(full_base):
            # Skip hidden files
            if entry.startswith('.'):
                continue
                
            full_path = f"{full_base}/{entry}"
            entry_rel_path = f"{rel_path}/{entry}" if rel_path else f"/{entry}"
            
            try:
                stat_info = sftp.stat(full_path)
                if stat.S_ISDIR(stat_info.st_mode):
                    # Check for README.md
                    has_readme = False
                    try:
                        sftp.stat(f"{full_path}/README.md")
                        has_readme = True
                    except FileNotFoundError:
                        pass

                    # Check for TODO.md
                    has_todo = False
                    try:
                        sftp.stat(f"{full_path}/TODO.md")
                        has_todo = True
                    except FileNotFoundError:
                        pass

                    mtime = datetime.fromtimestamp(stat_info.st_mtime).strftime('%Y-%m-%d')
                    
                    # Check if this directory has subdirectories
                    children = []
                    try:
                        subdirs = [d for d in sftp.listdir(full_path) 
                                  if not d.startswith('.') and stat.S_ISDIR(sftp.stat(f"{full_path}/{d}").st_mode)]
                        # Don't scan deeper than 2 levels initially, just mark if children exist
                        has_children = len(subdirs) > 0
                    except:
                        has_children = False
                    
                    entries.append({
                        'name': entry,
                        'path': entry_rel_path,
                        'modified': mtime,
                        'has_readme': has_readme,
                        'has_todo': has_todo,
                        'has_children': has_children,
                        'children': []  # Loaded on demand
                    })
            except Exception:
                pass
    except Exception:
        pass
    
    # Sort by name
    entries.sort(key=lambda x: x['name'].lower())
    return entries


@app.route('/api/projects')
@require_auth
def api_projects():
    """List all projects (directories in configured path)."""
    path = request.args.get('path', '/')
    safe_path = sanitize_path(path)
    
    if safe_path is None:
        return jsonify({'error': 'Access denied'}), 403
    
    try:
        client = get_ssh_client()
        sftp = client.open_sftp()

        # Get relative path from ROOT_JAIL
        rel_path = safe_path.replace(ROOT_JAIL, '')
        entries = scan_directory(sftp, ROOT_JAIL, rel_path)

        sftp.close()
        client.close()

        return jsonify({'projects': entries, 'path': path})

    except Exception as e:
        app.logger.error(f"Error listing projects: {e}")
        return jsonify({'error': str(e)}), 500


@app.route('/api/project/readme')
@require_auth
def api_project_readme():
    """Get README.md content for a project."""
    project = request.args.get('project', '')
    if not project:
        return jsonify({'error': 'No project specified'}), 400

    safe_path = sanitize_path(project)
    if safe_path is None:
        return jsonify({'error': 'Access denied'}), 403

    readme_path = f"{safe_path}/README.md"

    try:
        client = get_ssh_client()
        sftp = client.open_sftp()

        try:
            with sftp.file(readme_path, 'r') as f:
                content = f.read().decode('utf-8')
            sftp.close()
            client.close()
            return jsonify({'content': content, 'found': True})
        except FileNotFoundError:
            sftp.close()
            client.close()
            return jsonify({'content': '', 'found': False})

    except Exception as e:
        app.logger.error(f"Error reading README: {e}")
        return jsonify({'error': str(e)}), 500


@app.route('/api/project/todo')
@require_auth
def api_project_todo():
    """Get TODO.md content for a project."""
    project = request.args.get('project', '')
    if not project:
        return jsonify({'error': 'No project specified'}), 400

    safe_path = sanitize_path(project)
    if safe_path is None:
        return jsonify({'error': 'Access denied'}), 403

    todo_path = f"{safe_path}/TODO.md"

    try:
        client = get_ssh_client()
        sftp = client.open_sftp()

        try:
            with sftp.file(todo_path, 'r') as f:
                content = f.read().decode('utf-8')
            sftp.close()
            client.close()
            return jsonify({'content': content, 'found': True})
        except FileNotFoundError:
            sftp.close()
            client.close()
            return jsonify({'content': '', 'found': False})

    except Exception as e:
        app.logger.error(f"Error reading TODO: {e}")
        return jsonify({'error': str(e)}), 500


# Progress/Tasks API endpoints
PROGRESS_DIR = '.project_manager'
PROGRESS_FILE = 'tasks.yml'

DEFAULT_TASKS_STRUCTURE = {
    'version': '1.0',
    'project': {
        'name': '',
        'description': '',
        'status': 'active'  # active, paused, archived
    },
    'tasks': []
}


@app.route('/api/project/progress')
@require_auth
def api_project_progress():
    """Get progress/tasks data for a project."""
    project = request.args.get('project', '')
    if not project:
        return jsonify({'error': 'No project specified'}), 400

    safe_path = sanitize_path(project)
    if safe_path is None:
        return jsonify({'error': 'Access denied'}), 403

    progress_dir = f"{safe_path}/{PROGRESS_DIR}"
    progress_file = f"{progress_dir}/{PROGRESS_FILE}"

    try:
        client = get_ssh_client()
        sftp = client.open_sftp()

        # Check if .project_manager directory exists
        try:
            sftp.stat(progress_dir)
            dir_exists = True
        except FileNotFoundError:
            dir_exists = False

        if not dir_exists:
            sftp.close()
            client.close()
            return jsonify({
                'found': False,
                'dir_exists': False,
                'data': DEFAULT_TASKS_STRUCTURE
            })

        # Check if tasks.yml exists
        try:
            with sftp.file(progress_file, 'r') as f:
                content = f.read().decode('utf-8')
                data = yaml.safe_load(content) or DEFAULT_TASKS_STRUCTURE
            sftp.close()
            client.close()
            return jsonify({
                'found': True,
                'dir_exists': True,
                'data': data
            })
        except FileNotFoundError:
            sftp.close()
            client.close()
            return jsonify({
                'found': False,
                'dir_exists': True,
                'data': DEFAULT_TASKS_STRUCTURE
            })

    except Exception as e:
        app.logger.error(f"Error reading progress: {e}")
        return jsonify({'error': str(e)}), 500


@app.route('/api/project/progress', methods=['POST'])
@require_auth
def api_project_progress_update():
    """Update progress/tasks data for a project."""
    project = request.json.get('project', '')
    data = request.json.get('data', {})
    
    if not project:
        return jsonify({'error': 'No project specified'}), 400

    safe_path = sanitize_path(project)
    if safe_path is None:
        return jsonify({'error': 'Access denied'}), 403

    progress_dir = f"{safe_path}/{PROGRESS_DIR}"
    progress_file = f"{progress_dir}/{PROGRESS_FILE}"

    try:
        client = get_ssh_client()
        sftp = client.open_sftp()

        # Create directory if it doesn't exist
        try:
            sftp.mkdir(progress_dir)
        except IOError:
            pass  # Directory already exists

        # Write tasks.yml
        yaml_content = yaml.dump(data, default_flow_style=False, 
                                  allow_unicode=True, sort_keys=False)
        
        with sftp.file(progress_file, 'w') as f:
            f.write(yaml_content)
        
        # Check if README.md and update_task.py exist, if not copy them
        local_pm_dir = Path(__file__).parent / '.project_manager'
        
        # Copy README.md if missing
        try:
            sftp.stat(f"{progress_dir}/README.md")
        except FileNotFoundError:
            readme_local = local_pm_dir / 'README.md'
            if readme_local.exists():
                with open(readme_local, 'r') as f:
                    readme_content = f.read()
                with sftp.file(f"{progress_dir}/README.md", 'w') as f:
                    f.write(readme_content)
        
        # Copy update_task.py if missing
        try:
            sftp.stat(f"{progress_dir}/update_task.py")
        except FileNotFoundError:
            script_local = local_pm_dir / 'update_task.py'
            if script_local.exists():
                with open(script_local, 'r') as f:
                    script_content = f.read()
                with sftp.file(f"{progress_dir}/update_task.py", 'w') as f:
                    f.write(script_content)
        
        sftp.close()
        client.close()
        
        return jsonify({'success': True, 'message': 'Progress saved'})

    except Exception as e:
        app.logger.error(f"Error saving progress: {e}")
        return jsonify({'error': str(e)}), 500


@app.route('/api/project/progress/init', methods=['POST'])
@require_auth
def api_project_progress_init():
    """Initialize .project_manager directory and tasks.yml."""
    project = request.json.get('project', '')
    project_name = request.json.get('name', 'Unnamed Project')
    
    if not project:
        return jsonify({'error': 'No project specified'}), 400

    safe_path = sanitize_path(project)
    if safe_path is None:
        return jsonify({'error': 'Access denied'}), 403

    progress_dir = f"{safe_path}/{PROGRESS_DIR}"
    progress_file = f"{progress_dir}/{PROGRESS_FILE}"

    try:
        client = get_ssh_client()
        sftp = client.open_sftp()

        # Create .project_manager directory
        try:
            sftp.mkdir(progress_dir)
        except IOError:
            pass  # Directory already exists

        # Create default tasks.yml
        default_data = DEFAULT_TASKS_STRUCTURE.copy()
        default_data['project']['name'] = project_name
        default_data['tasks'] = [
            {
                'id': '1',
                'name': 'Getting started',
                'status': 'not_started',
                'description': 'Define project goals and initial tasks',
                'created': datetime.now().isoformat(),
                'subtasks': []
            }
        ]
        
        yaml_content = yaml.dump(default_data, default_flow_style=False,
                                  allow_unicode=True, sort_keys=False)
        
        with sftp.file(progress_file, 'w') as f:
            f.write(yaml_content)
        
        # Copy README.md and update_task.py from local template
        local_pm_dir = Path(__file__).parent / '.project_manager'
        
        # Copy README.md
        readme_local = local_pm_dir / 'README.md'
        if readme_local.exists():
            with open(readme_local, 'r') as f:
                readme_content = f.read()
            with sftp.file(f"{progress_dir}/README.md", 'w') as f:
                f.write(readme_content)
        
        # Copy update_task.py
        script_local = local_pm_dir / 'update_task.py'
        if script_local.exists():
            with open(script_local, 'r') as f:
                script_content = f.read()
            with sftp.file(f"{progress_dir}/update_task.py", 'w') as f:
                f.write(script_content)
        
        sftp.close()
        client.close()
        
        return jsonify({
            'success': True, 
            'message': 'Project tracking initialized',
            'data': default_data
        })

    except Exception as e:
        app.logger.error(f"Error initializing progress: {e}")
        return jsonify({'error': str(e)}), 500


@app.route('/api/projects/managed')
@require_auth
def api_managed_projects():
    """Get all projects with .project_manager directory and their task progress."""
    cache_file = '/tmp/pm_managed_projects.json'
    cache_max_age = 300  # 5 minutes
    
    # Check if we have a recent cache
    try:
        if os.path.exists(cache_file):
            cache_age = time.time() - os.path.getmtime(cache_file)
            if cache_age < cache_max_age:
                with open(cache_file, 'r') as f:
                    return jsonify(json.load(f))
    except Exception:
        pass
    
    # Scan for projects using BFS from ROOT_JAIL
    try:
        client = get_ssh_client()
        sftp = client.open_sftp()
        
        # BFS to find all .project_manager directories
        # Exclude common non-project directories
        exclude_dirs = {'wandb', '.git', '.venv', 'venv', 'node_modules', 
                       'results', 'logs', '__pycache__', '.pytest_cache',
                       'dist', 'build', '.vscode', '.idea', '.git'}
        
        pm_dirs = []
        visited = set()
        queue = [ROOT_JAIL]
        
        while queue:
            current_dir = queue.pop(0)
            if current_dir in visited:
                continue
            visited.add(current_dir)
            
            try:
                # Check if this directory has .project_manager
                try:
                    sftp.stat(f"{current_dir}/.project_manager")
                    pm_dirs.append(f"{current_dir}/.project_manager")
                except FileNotFoundError:
                    pass
                
                # List subdirectories and add to queue (BFS)
                if len(current_dir.split('/')) - len(ROOT_JAIL.split('/')) < 10:  # Max depth
                    for entry in sftp.listdir_attr(current_dir):
                        if stat.S_ISDIR(entry.st_mode):
                            name = entry.filename
                            if name not in exclude_dirs and not name.startswith('.'):
                                full_path = f"{current_dir}/{name}"
                                queue.append(full_path)
            except Exception:
                continue
        
        projects = []
        for pm_dir in pm_dirs:
            project_path = os.path.dirname(pm_dir)
            # Get relative path from ROOT_JAIL
            rel_path = project_path[len(ROOT_JAIL):].lstrip('/')
            if not rel_path:
                rel_path = os.path.basename(project_path)
            project_name = os.path.basename(project_path)
            
            # Try to read tasks.yml
            try:
                with sftp.file(f"{pm_dir}/tasks.yml", 'r') as f:
                    content = f.read().decode('utf-8')
                    data = yaml.safe_load(content) or {}
                    
                tasks = data.get('tasks', [])
                total = len(tasks)
                completed = sum(1 for t in tasks if t.get('status') == 'completed')
                in_progress = sum(1 for t in tasks if t.get('status') == 'in_progress')
                
                # Calculate progress percentage
                progress = (completed / total * 100) if total > 0 else 0
                
                projects.append({
                    'path': rel_path,  # Use relative path
                    'name': data.get('project', {}).get('name', project_name),
                    'status': data.get('project', {}).get('status', 'active'),
                    'total_tasks': total,
                    'completed': completed,
                    'in_progress': in_progress,
                    'progress': round(progress, 1),
                    'tasks': tasks[:10] if tasks else [],  # Limit tasks for preview
                    'has_more_tasks': len(tasks) > 10,
                })
            except Exception:
                # Project has .project_manager but no valid tasks.yml
                projects.append({
                    'path': rel_path,
                    'name': project_name,
                    'status': 'active',
                    'total_tasks': 0,
                    'completed': 0,
                    'in_progress': 0,
                    'progress': 0,
                    'tasks': [],
                    'has_more_tasks': False,
                })
        
        sftp.close()
        client.close()
        
        # Sort by progress (incomplete first)
        projects.sort(key=lambda p: (p['completed'] == p['total_tasks'], -p['progress']))
        
        result = {'projects': projects, 'count': len(projects)}
        
        # Cache result
        try:
            with open(cache_file, 'w') as f:
                json.dump(result, f)
        except Exception:
            pass
        
        return jsonify(result)
        
    except Exception as e:
        app.logger.error(f"Error scanning managed projects: {e}")
        return jsonify({'error': str(e), 'projects': [], 'count': 0}), 500


@app.route('/api/stats')
@require_auth
def api_stats():
    """Get quick stats about the workspace."""
    try:
        client = get_ssh_client()
        sftp = client.open_sftp()

        # Count directories and files
        stdin, stdout, stderr = client.exec_command(
            f'find {ROOT_JAIL} -type d | wc -l && '
            f'find {ROOT_JAIL} -type f | wc -l && '
            f'du -sh {ROOT_JAIL} | cut -f1'
        )
        lines = stdout.read().decode().strip().split('\n')

        sftp.close()
        client.close()

        return jsonify({
            'directories': int(lines[0]) if len(lines) > 0 else 0,
            'files': int(lines[1]) if len(lines) > 1 else 0,
            'total_size': lines[2] if len(lines) > 2 else 'unknown',
        })

    except Exception as e:
        app.logger.error(f"Error getting stats: {e}")
        return jsonify({'error': str(e)}), 500


@app.route('/api/zellij/status')
@require_auth
def api_zellij_status():
    """Check if Zellij is available."""
    manager = get_zellij_manager()
    return jsonify({
        'available': manager.is_zellij_available()
    })


@app.route('/api/zellij/sessions')
@require_auth
def api_zellij_sessions():
    """List all Zellij sessions."""
    manager = get_zellij_manager()
    
    if not manager.is_zellij_available():
        return jsonify({'error': 'Zellij is not installed or not in PATH'}), 503
    
    sessions = manager.list_sessions()
    return jsonify({
        'sessions': [s.to_dict() for s in sessions]
    })


@app.route('/api/zellij/project-session')
@require_auth
def api_zellij_project_session():
    """Get the Zellij session for a specific project."""
    project = request.args.get('project', '')
    
    if not project:
        return jsonify({'error': 'No project specified'}), 400
    
    safe_path = sanitize_path(project)
    if safe_path is None:
        return jsonify({'error': 'Access denied'}), 403
    
    manager = get_zellij_manager()
    
    if not manager.is_zellij_available():
        return jsonify({'error': 'Zellij is not installed'}), 503
    
    session = manager.get_project_session(safe_path)
    
    if session:
        return jsonify({
            'found': True,
            'session': session.to_dict()
        })
    else:
        return jsonify({
            'found': False,
            'session': None
        })


@app.route('/api/zellij/bind', methods=['POST'])
@require_auth
def api_zellij_bind():
    """Bind a project to a Zellij session."""
    data = request.get_json() or {}
    project = data.get('project', '')
    session_name = data.get('session_name', '')
    
    if not project or not session_name:
        return jsonify({'error': 'Project and session_name are required'}), 400
    
    safe_path = sanitize_path(project)
    if safe_path is None:
        return jsonify({'error': 'Access denied'}), 403
    
    manager = get_zellij_manager()
    
    if not manager.is_zellij_available():
        return jsonify({'error': 'Zellij is not installed'}), 503
    
    success = manager.bind_session(safe_path, session_name)
    
    if success:
        return jsonify({
            'success': True,
            'message': f'Project bound to session {session_name}'
        })
    else:
        return jsonify({'error': 'Failed to bind session'}), 500


@app.route('/api/zellij/create', methods=['POST'])
@require_auth
def api_zellij_create():
    """Create a new Zellij session for a project."""
    data = request.get_json() or {}
    project = data.get('project', '')
    agent_type = data.get('agent_type', 'claude')
    
    if not project:
        return jsonify({'error': 'No project specified'}), 400
    
    safe_path = sanitize_path(project)
    if safe_path is None:
        return jsonify({'error': 'Access denied'}), 403
    
    manager = get_zellij_manager()
    
    if not manager.is_zellij_available():
        return jsonify({'error': 'Zellij is not installed'}), 503
    
    session_name = manager.create_session(safe_path, agent_type)
    
    if session_name:
        return jsonify({
            'success': True,
            'session_name': session_name,
            'message': f'Session {session_name} created'
        })
    else:
        return jsonify({'error': 'Failed to create session'}), 500


# SocketIO terminal handlers (default namespace)
@socketio.on('connect')
def handle_connect():
    """Handle client connection."""
    print(f"Client connected: {request.sid}")


@socketio.on('disconnect')
def handle_disconnect():
    """Handle client disconnection."""
    print(f"Client disconnected: {request.sid}")


# Global store for SSH channels (keyed by socket session ID)
ssh_channels = {}

@socketio.on('new_terminal')
def handle_new_terminal(data):
    """Create a new SSH terminal in a directory."""
    import threading
    import time
    
    project_path = data.get('path', '~')
    print(f"New terminal requested for: {project_path}")
    
    try:
        manager = get_zellij_manager()
        ssh_client = manager.get_ssh_client_for_terminal()
        channel = ssh_client.invoke_shell(term='xterm-256color', width=80, height=24)
        
        # Store channel for input handling
        ssh_channels[request.sid] = {'channel': channel, 'client': ssh_client}
        
        time.sleep(0.5)
        channel.send(f'cd {project_path}\n')
        # Don't clear - let user see the prompt
        
        emit('status', {'status': 'connected', 'path': project_path})
        print(f"Terminal connected to {project_path}, sid={request.sid}")
        
        # Start output forwarding in background thread
        def forward_output():
            try:
                while True:
                    if channel and not channel.closed and channel.recv_ready():
                        try:
                            data = channel.recv(4096)
                            if data:
                                socketio.emit('output', {'data': data.decode('utf-8', errors='replace')}, 
                                            room=request.sid)
                            else:
                                break
                        except Exception as e:
                            print(f"Recv error: {e}")
                            break
                    elif channel.closed:
                        break
                    else:
                        time.sleep(0.01)
            except Exception as e:
                print(f"Forward thread error: {e}")
            finally:
                print(f"Forward thread ended for {request.sid}")
                if request.sid in ssh_channels:
                    del ssh_channels[request.sid]
                try:
                    channel.close()
                    ssh_client.close()
                except:
                    pass
        
        t = threading.Thread(target=forward_output)
        t.daemon = True
        t.start()
        
    except Exception as e:
        print(f"New terminal error: {e}")
        import traceback
        traceback.print_exc()
        emit('error', {'error': str(e)})


@socketio.on('input')
def handle_input(data):
    """Handle terminal input."""
    sid = request.sid
    input_data = data.get('data', '')
    
    if sid in ssh_channels:
        channel = ssh_channels[sid]['channel']
        try:
            channel.send(input_data)
        except Exception as e:
            print(f"Input error: {e}")
    else:
        print(f"No channel found for sid={sid}")


@socketio.on('attach')
def handle_attach(data):
    """Attach to a Zellij session."""
    import threading
    import time
    
    session_name = data.get('session')
    print(f"Attach requested to session: {session_name}")
    
    try:
        manager = get_zellij_manager()
        ssh_client = manager.get_ssh_client_for_terminal()
        channel = ssh_client.invoke_shell(term='xterm-256color', width=80, height=24)
        
        time.sleep(0.3)
        channel.send('export PATH="$HOME/.cargo/bin:$PATH"\n')
        time.sleep(0.1)
        channel.send(f'zellij attach {session_name}\n')
        
        emit('status', {'status': 'connected', 'session': session_name})
        print(f"Attached to {session_name}")
        
        # Start output forwarding
        def forward_output():
            try:
                while True:
                    if channel and channel.recv_ready():
                        try:
                            data = channel.recv(4096)
                            if data:
                                socketio.emit('output', {'data': data.decode('utf-8', errors='replace')}, 
                                            room=request.sid)
                            else:
                                break
                        except:
                            break
                    else:
                        time.sleep(0.01)
            except Exception as e:
                print(f"Forward error: {e}")
        
        t = threading.Thread(target=forward_output)
        t.daemon = True
        t.start()
        
    except Exception as e:
        print(f"Attach error: {e}")
        emit('error', {'error': str(e)})


@socketio.on('input')
def handle_input(data):
    """Handle terminal input."""
    # TODO: Implement input handling with session storage
    print(f"Input received: {data}")


# Debug ping/pong
@socketio.on('ping_test')
def handle_ping(data):
    """Debug ping handler."""
    print(f"Ping received: {data}")
    emit('pong_test', {'received': data, 'server_time': str(datetime.now())})


if __name__ == '__main__':
    use_https = '--https' in sys.argv
    
    print(f"Starting Project Manager on https://{HOST}:{PORT}")
    print(f"Remote server: {BEAST_HOST}:{BEAST_PORT}")
    print(f"Projects path: {ROOT_JAIL}")
    
    # Use SocketIO's run method which handles WebSockets properly
    if use_https:
        socketio.run(app, host=HOST, port=PORT, certfile='cert.pem', keyfile='key.pem')
    else:
        socketio.run(app, host=HOST, port=PORT)
