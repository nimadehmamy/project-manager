#!/usr/bin/env python3
"""
Task update helper script for Project Manager.

This script simplifies updating tasks in the tasks.yml file.
"""

import argparse
import os
import sys
from datetime import datetime
from pathlib import Path

try:
    import yaml
except ImportError:
    print("Error: PyYAML is required. Install with: pip install pyyaml")
    sys.exit(1)


def load_tasks(file_path: str) -> dict:
    """Load tasks from YAML file."""
    if not os.path.exists(file_path):
        # Return default structure
        return {
            'version': '1.0',
            'project': {
                'name': 'Unnamed Project',
                'description': '',
                'status': 'active'
            },
            'tasks': []
        }
    
    with open(file_path, 'r') as f:
        return yaml.safe_load(f) or {'tasks': []}


def save_tasks(file_path: str, data: dict):
    """Save tasks to YAML file."""
    with open(file_path, 'w') as f:
        yaml.dump(data, f, default_flow_style=False, allow_unicode=True, sort_keys=False)


def trigger_cache_refresh():
    """Trigger the scanner daemon to refresh its cache."""
    trigger_file = Path('/tmp/pm_cache/refresh.trigger')
    try:
        trigger_file.touch()
        print("   (Cache refresh triggered)")
    except Exception:
        pass  # Ignore errors, the daemon will refresh on its schedule anyway


def find_task(tasks: list, task_id: str) -> tuple:
    """
    Find a task by ID. Returns (task, parent_list, index) or (None, None, -1).
    parent_list is the list containing the task (tasks list or parent.subtasks).
    """
    for i, task in enumerate(tasks):
        if task.get('id') == task_id:
            return task, tasks, i
        # Search subtasks recursively
        if task.get('subtasks'):
            result, parent, idx = find_task(task['subtasks'], task_id)
            if result:
                return result, parent, idx
    return None, None, -1


def generate_task_id(tasks: list, parent_id: str = None) -> str:
    """Generate a new task ID."""
    if parent_id:
        # Find the highest subtask number for this parent
        parent_task, _, _ = find_task(tasks, parent_id)
        if parent_task and parent_task.get('subtasks'):
            subtasks = parent_task['subtasks']
            max_num = 0
            for st in subtasks:
                try:
                    num = int(st.get('id', '').split('.')[-1])
                    max_num = max(max_num, num)
                except (ValueError, IndexError):
                    pass
            return f"{parent_id}.{max_num + 1}"
        return f"{parent_id}.1"
    else:
        # Find highest top-level task number
        max_num = 0
        for task in tasks:
            try:
                num = int(task.get('id', '0'))
                max_num = max(max_num, num)
            except ValueError:
                pass
        return str(max_num + 1)


def add_task(tasks_data: dict, name: str, status: str = 'not_started', 
             description: str = '', parent_id: str = None) -> str:
    """Add a new task. Returns the new task ID."""
    task_id = generate_task_id(tasks_data['tasks'], parent_id)
    
    new_task = {
        'id': task_id,
        'name': name,
        'status': status,
        'description': description,
        'created': datetime.now().isoformat(),
        'subtasks': []
    }
    
    if parent_id:
        parent_task, _, _ = find_task(tasks_data['tasks'], parent_id)
        if parent_task:
            if 'subtasks' not in parent_task:
                parent_task['subtasks'] = []
            parent_task['subtasks'].append(new_task)
        else:
            print(f"Error: Parent task {parent_id} not found")
            sys.exit(1)
    else:
        tasks_data['tasks'].append(new_task)
    
    return task_id


def update_task(tasks_data: dict, task_id: str, **updates) -> bool:
    """Update an existing task. Returns True if found and updated."""
    task, _, _ = find_task(tasks_data['tasks'], task_id)
    if not task:
        return False
    
    for key, value in updates.items():
        if value is not None:
            task[key] = value
    
    return True


def list_tasks(tasks: list, indent: int = 0):
    """Print a list of all tasks."""
    for task in tasks:
        status = task.get('status', 'unknown')
        name = task.get('name', 'Unnamed')
        task_id = task.get('id', '?')
        
        # Status emoji
        emoji = {
            'not_started': '⭕',
            'in_progress': '🔄',
            'completed': '✅',
            'blocked': '🚫',
            'cancelled': '❌'
        }.get(status, '❓')
        
        print(f"{'  ' * indent}{emoji} [{task_id}] {name} ({status})")
        
        # Print subtasks
        if task.get('subtasks'):
            list_tasks(task['subtasks'], indent + 1)


def main():
    parser = argparse.ArgumentParser(
        description='Update tasks in Project Manager tasks.yml',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # List all tasks
  %(prog)s --list

  # Add a new task
  %(prog)s --add --name "Implement feature X" --status in_progress

  # Add a subtask
  %(prog)s --add --parent 1 --name "Write tests"

  # Mark task as completed
  %(prog)s --task-id 1 --status completed

  # Update task description
  %(prog)s --task-id 1 --description "Updated description"
        """
    )
    
    parser.add_argument('--file', '-f', default='tasks.yml',
                       help='Path to tasks.yml (default: tasks.yml)')
    parser.add_argument('--add', '-a', action='store_true',
                       help='Add a new task instead of updating')
    parser.add_argument('--task-id', '-t',
                       help='Task ID to update')
    parser.add_argument('--parent', '-p',
                       help='Parent task ID (for subtasks)')
    parser.add_argument('--name', '-n',
                       help='Task name')
    parser.add_argument('--status', '-s',
                       choices=['not_started', 'in_progress', 'completed', 'blocked', 'cancelled'],
                       help='Task status')
    parser.add_argument('--description', '-d',
                       help='Task description')
    parser.add_argument('--list', '-l', action='store_true',
                       help='List all tasks')
    
    args = parser.parse_args()
    
    # If file is relative, look in .project_manager directory
    if not os.path.isabs(args.file) and not os.path.exists(args.file):
        pm_dir = Path(__file__).parent
        alt_path = pm_dir / args.file
        if alt_path.exists():
            args.file = str(alt_path)
    
    # Load tasks
    tasks_data = load_tasks(args.file)
    
    # Ensure required structure
    if 'tasks' not in tasks_data:
        tasks_data['tasks'] = []
    if 'project' not in tasks_data:
        tasks_data['project'] = {'name': 'Unnamed', 'description': '', 'status': 'active'}
    if 'version' not in tasks_data:
        tasks_data['version'] = '1.0'
    
    # List tasks
    if args.list:
        print(f"Project: {tasks_data['project'].get('name', 'Unnamed')}")
        print(f"Status: {tasks_data['project'].get('status', 'active')}")
        print(f"\nTasks:")
        if tasks_data['tasks']:
            list_tasks(tasks_data['tasks'])
        else:
            print("  No tasks yet")
        return
    
    # Add new task
    if args.add:
        if not args.name:
            print("Error: --name is required when adding a task")
            sys.exit(1)
        
        task_id = add_task(
            tasks_data,
            name=args.name,
            status=args.status or 'not_started',
            description=args.description or '',
            parent_id=args.parent
        )
        
        save_tasks(args.file, tasks_data)
        print(f"✅ Added task [{task_id}]: {args.name}")
        trigger_cache_refresh()
        return
    
    # Update existing task
    if args.task_id:
        updates = {}
        if args.name:
            updates['name'] = args.name
        if args.status:
            updates['status'] = args.status
        if args.description:
            updates['description'] = args.description
        
        if not updates:
            print("Error: No updates specified. Use --name, --status, or --description")
            sys.exit(1)
        
        if update_task(tasks_data, args.task_id, **updates):
            save_tasks(args.file, tasks_data)
            print(f"✅ Updated task [{args.task_id}]")
            for key, value in updates.items():
                print(f"   {key}: {value}")
            trigger_cache_refresh()
        else:
            print(f"Error: Task {args.task_id} not found")
            sys.exit(1)
        return
    
    # If no action specified, show help
    parser.print_help()


if __name__ == '__main__':
    main()
