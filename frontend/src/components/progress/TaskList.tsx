import { useState } from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, ChevronRight, ChevronDown, Edit2, Trash2, Plus } from 'lucide-react';
import type { Task } from '../../types';

// Generate unique ID for each task including nested ones
function generateTaskId(path: number[]): string {
  return path.join('.');
}

interface TaskItemProps {
  task: Task;
  path: number[];
  onUpdate: (path: number[], updates: Partial<Task>) => void;
  onDelete: (path: number[]) => void;
  onAddSubtask: (path: number[]) => void;
}

function TaskItem({ task, path, onUpdate, onDelete, onAddSubtask }: TaskItemProps) {
  const [expanded, setExpanded] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({
    name: task.name,
    status: task.status,
    description: task.description || '',
  });

  const taskId = generateTaskId(path);
  const hasSubtasks = task.subtasks && task.subtasks.length > 0;
  const depth = path.length - 1;

  const handleSave = () => {
    onUpdate(path, {
      name: editForm.name,
      status: editForm.status as Task['status'],
      description: editForm.description,
    });
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditForm({
      name: task.name,
      status: task.status,
      description: task.description || '',
    });
    setIsEditing(false);
  };

  if (isEditing) {
    return (
      <div className="task-content editing" style={{ marginLeft: `${depth * 20}px` }}>
        <div className="task-edit-form" style={{ flex: 1 }}>
          <input
            type="text"
            value={editForm.name}
            onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
            placeholder="Task name..."
            style={{ fontSize: '0.9375rem' }}
          />
          <select
            value={editForm.status}
            onChange={(e) => setEditForm({ ...editForm, status: e.target.value as Task['status'] })}
          >
            <option value="not_started">Not Started</option>
            <option value="in_progress">In Progress</option>
            <option value="completed">Completed</option>
            <option value="blocked">Blocked</option>
            <option value="cancelled">Cancelled</option>
          </select>
          <textarea
            value={editForm.description}
            onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
            placeholder="Description..."
            rows={2}
          />
          <div className="task-edit-actions">
            <button className="btn btn-sm" onClick={handleCancel}>Cancel</button>
            <button className="btn btn-sm btn-primary" onClick={handleSave}>Save</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="task-content" style={{ marginLeft: `${depth * 20}px` }}>
        <span className="task-toggle" style={{ visibility: 'hidden' }}>
          <GripVertical size={16} />
        </span>

        {hasSubtasks ? (
          <button
            className="task-toggle"
            onClick={() => setExpanded(!expanded)}
          >
            {expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
          </button>
        ) : (
          <span className="task-toggle leaf" />
        )}

        <input
          type="checkbox"
          className="task-checkbox"
          checked={task.status === 'completed'}
          onChange={(e) => onUpdate(path, { status: e.target.checked ? 'completed' : 'not_started' })}
        />

        <div className="task-main">
          <div className="task-header">
            <span className={`task-name ${task.status === 'completed' ? 'completed' : ''}`}>
              {task.name}
            </span>
            <span className={`task-status-badge ${task.status}`}>
              {formatStatus(task.status)}
            </span>
          </div>
          {task.description && (
            <div className="task-description">{task.description}</div>
          )}
        </div>

        <div className="task-actions">
          <button className="task-btn" onClick={() => setIsEditing(true)} title="Edit">
            <Edit2 size={14} />
          </button>
          <button className="task-btn" onClick={() => onAddSubtask(path)} title="Add Subtask">
            <Plus size={14} />
          </button>
          <button className="task-btn delete" onClick={() => onDelete(path)} title="Delete">
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      {expanded && hasSubtasks && (
        <div className="task-sublist">
          {task.subtasks!.map((subtask, idx) => (
            <TaskItem
              key={`${taskId}-${idx}`}
              task={subtask}
              path={[...path, idx]}
              onUpdate={onUpdate}
              onDelete={onDelete}
              onAddSubtask={onAddSubtask}
            />
          ))}
        </div>
      )}
    </>
  );
}

// Sortable wrapper for top-level tasks only
interface SortableTaskItemProps {
  task: Task;
  index: number;
  onUpdate: (path: number[], updates: Partial<Task>) => void;
  onDelete: (path: number[]) => void;
  onAddSubtask: (path: number[]) => void;
}

function SortableTaskItem({ task, index, onUpdate, onDelete, onAddSubtask }: SortableTaskItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: index.toString() });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <li ref={setNodeRef} style={style} className="task-item">
      <div className="task-drag-handle" {...attributes} {...listeners}>
        <GripVertical size={16} />
      </div>
      <TaskItem
        task={task}
        path={[index]}
        onUpdate={onUpdate}
        onDelete={onDelete}
        onAddSubtask={onAddSubtask}
      />
    </li>
  );
}

interface TaskListProps {
  tasks: Task[];
  onUpdate: (path: number[], updates: Partial<Task>) => void;
  onDelete: (path: number[]) => void;
  onAddSubtask: (path: number[]) => void;
  onReorder: (tasks: Task[]) => void;
}

export function TaskList({ tasks, onUpdate, onDelete, onAddSubtask, onReorder }: TaskListProps) {
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = parseInt(active.id as string);
      const newIndex = parseInt(over.id as string);
      onReorder(arrayMove(tasks, oldIndex, newIndex));
    }
  };

  if (tasks.length === 0) {
    return (
      <div className="progress-empty">
        <p>No tasks yet. Click "Add Task" to get started!</p>
      </div>
    );
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <SortableContext
        items={tasks.map((_, i) => i.toString())}
        strategy={verticalListSortingStrategy}
      >
        <ul className="task-list">
          {tasks.map((task, index) => (
            <SortableTaskItem
              key={index}
              task={task}
              index={index}
              onUpdate={onUpdate}
              onDelete={onDelete}
              onAddSubtask={onAddSubtask}
            />
          ))}
        </ul>
      </SortableContext>
    </DndContext>
  );
}

function formatStatus(status: string): string {
  const labels: Record<string, string> = {
    not_started: 'Not Started',
    in_progress: 'In Progress',
    completed: 'Completed',
    blocked: 'Blocked',
    cancelled: 'Cancelled',
  };
  return labels[status] || status;
}
