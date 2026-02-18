"""Project Manager - Secure file browser for remote server."""

import os
import stat
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

app = Flask(__name__)
app.secret_key = SECRET_KEY


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


if __name__ == '__main__':
    use_https = '--https' in sys.argv
    
    if use_https:
        # Create SSL context with self-signed cert
        context = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
        context.load_cert_chain('cert.pem', 'key.pem')
        print(f"Starting Project Manager on https://{HOST}:{PORT}")
        print(f"Remote server: {BEAST_HOST}:{BEAST_PORT}")
        print(f"Projects path: {ROOT_JAIL}")
        app.run(host=HOST, port=PORT, debug=DEBUG, ssl_context=context)
    else:
        print(f"Starting Project Manager on https://{HOST}:{PORT}")
        print(f"Remote server: {BEAST_HOST}:{BEAST_PORT}")
        print(f"Projects path: {ROOT_JAIL}")
        app.run(host=HOST, port=PORT, debug=DEBUG)
