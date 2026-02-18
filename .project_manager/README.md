# Project Manager - Agent Guide

This directory contains project tracking information for AI agents working on this project.

## Files

- `tasks.yml` - Main task tracking file
- `README.md` - This file (agent guide)

## Task Format (tasks.yml)

The `tasks.yml` file uses YAML format with the following structure:

```yaml
version: '1.0'
project:
  name: 'Project Name'
  description: 'Project description'
  status: active  # active, paused, archived
tasks:
  - id: '1'
    name: 'Task name'
    status: not_started  # not_started, in_progress, completed, blocked, cancelled
    description: 'Task description'
    created: '2024-01-15T10:30:00'
    subtasks: []
```

### Task Fields

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Unique task identifier (numeric or alphanumeric) |
| `name` | string | Short task title |
| `status` | string | One of: `not_started`, `in_progress`, `completed`, `blocked`, `cancelled` |
| `description` | string | Detailed task description (optional) |
| `created` | string | ISO 8601 timestamp |
| `subtasks` | array | List of subtask objects (same structure) |

### Status Values

- `not_started` - Task hasn't been started yet
- `in_progress` - Currently being worked on
- `completed` - Task is finished
- `blocked` - Cannot proceed (needs external input or dependency)
- `cancelled` - Task was cancelled

### Example Task with Subtasks

```yaml
tasks:
  - id: '1'
    name: 'Implement feature X'
    status: in_progress
    description: 'Add new feature to the codebase'
    created: '2024-01-15T10:30:00'
    subtasks:
      - id: '1.1'
        name: 'Design API'
        status: completed
        description: 'Define the API endpoints'
        created: '2024-01-15T10:30:00'
        subtasks: []
      - id: '1.2'
        name: 'Write tests'
        status: in_progress
        description: 'Add unit tests'
        created: '2024-01-15T10:30:00'
        subtasks: []
```

## Using the Task Helper Script

A helper script `update_task.py` is available to simplify task updates:

```bash
# Mark a task as completed
python .project_manager/update_task.py --task-id 1 --status completed

# Add a new task
python .project_manager/update_task.py --add --name "New task name" --status not_started

# Add a subtask to task 1
python .project_manager/update_task.py --add --parent 1 --name "Subtask name"

# Update task description
python .project_manager/update_task.py --task-id 1 --description "Updated description"
```

### Script Options

| Option | Description |
|--------|-------------|
| `--add` | Add a new task (instead of updating) |
| `--task-id ID` | Task ID to update |
| `--parent ID` | Parent task ID (for subtasks) |
| `--name "Name"` | Task name |
| `--status STATUS` | Task status |
| `--description "Desc"` | Task description |
| `--file PATH` | Path to tasks.yml (default: tasks.yml) |

## Best Practices for Agents

1. **Update status promptly** - When you complete a task, mark it as `completed` immediately
2. **Break down large tasks** - Use subtasks for complex work
3. **Mark blockers** - If you're blocked, mark the task as `blocked` and add a note in description
4. **Add new tasks as needed** - Create tasks for work you identify during the project
5. **Use meaningful names** - Task names should be clear and actionable
6. **Keep descriptions current** - Update descriptions as work evolves

## Manual Editing

You can also edit `tasks.yml` directly:

1. Open `tasks.yml` in your editor
2. Make changes following the format above
3. Save the file
4. Changes will be reflected in the Project Manager UI

Remember: YAML uses indentation (2 spaces recommended) to define structure. Be careful with indentation!
