import { useState, useEffect } from 'react';
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
import { AddTaskForm } from './AddTaskForm';
import type { Task } from '../../types';

interface LocalTask extends Task {
  _localId: string;
}

/** Status accent colors — same palette as Home page segments */
const STATUS_COLORS: Record<string, string> = {
  completed: 'var(--accent-green)',
  in_progress: '#3b82f6',
  blocked: '#ef4444',
  cancelled: '#9ca3af',
  not_started: 'var(--border)',
};

interface TaskItemProps {
  task: LocalTask;
  onUpdate: (localId: string, updates: Partial<Task>) => void;
  onDelete: (localId: string) => void;
  onAddSubtask: (localId: string) => void;
  addingToId: string | null;
  isAdding: boolean;
  onAddTask: (name: string, status: Task['status'], description: string) => void;
  onCancelAdd: () => void;
  depth?: number;
}

function TaskItem({ task, onUpdate, onDelete, onAddSubtask, addingToId, isAdding, onAddTask, onCancelAdd, depth = 0 }: TaskItemProps) {
  const [expanded, setExpanded] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({
    name: task.name,
    status: task.status,
    description: task.description || '',
  });

  // Local state for checkbox to ensure immediate response
  const [localStatus, setLocalStatus] = useState(task.status);

  // Sync local status when task changes from parent
  useEffect(() => {
    setLocalStatus(task.status);
  }, [task.status]);

  // Sync edit form when entering edit mode
  useEffect(() => {
    if (isEditing) {
      setEditForm({
        name: task.name,
        status: task.status,
        description: task.description || '',
      });
    }
  }, [isEditing, task]);

  // Auto-expand when adding a subtask to this task
  useEffect(() => {
    if (addingToId === task._localId) {
      setExpanded(true);
    }
  }, [addingToId, task._localId]);

  const handleSave = () => {
    onUpdate(task._localId, {
      name: editForm.name,
      status: editForm.status as Task['status'],
      description: editForm.description,
    });
    setIsEditing(false);
  };

  const handleCancel = () => {
    setIsEditing(false);
  };

  const handleCheckboxToggle = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.stopPropagation();
    const newStatus = localStatus === 'completed' ? 'not_started' : 'completed';
    setLocalStatus(newStatus);
    onUpdate(task._localId, { status: newStatus });
  };

  const handleStatusChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    e.stopPropagation();
    const newStatus = e.target.value as Task['status'];
    setLocalStatus(newStatus);
    onUpdate(task._localId, { status: newStatus });
  };

  const hasSubtasks = task.subtasks && task.subtasks.length > 0;
  const subtasks = (task.subtasks || []) as LocalTask[];
  const accentColor = STATUS_COLORS[localStatus] || STATUS_COLORS.not_started;
  const showSubtaskForm = isAdding && addingToId === task._localId;

  if (isEditing) {
    return (
      <div
        className="task-card editing"
        style={{ marginLeft: depth > 0 ? `${depth * 24}px` : undefined, '--task-accent': accentColor } as React.CSSProperties}
      >
        <div className="task-edit-form">
          <input
            type="text"
            value={editForm.name}
            onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
            placeholder="Task name..."
            autoFocus
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSave();
              } else if (e.key === 'Escape') {
                handleCancel();
              }
            }}
          />
          <div className="task-edit-row">
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
              placeholder="Description (optional)..."
              rows={2}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && e.ctrlKey) {
                  e.preventDefault();
                  handleSave();
                } else if (e.key === 'Escape') {
                  handleCancel();
                }
              }}
            />
          </div>
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
      <div
        className={`task-card ${localStatus}`}
        style={{ marginLeft: depth > 0 ? `${depth * 24}px` : undefined, '--task-accent': accentColor } as React.CSSProperties}
      >
        {/* Expand/collapse toggle */}
        {hasSubtasks ? (
          <button
            className="task-toggle"
            onClick={() => setExpanded(!expanded)}
          >
            {expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
          </button>
        ) : (
          <span className="task-toggle-spacer" />
        )}

        {/* Checkbox */}
        <input
          type="checkbox"
          className="task-checkbox"
          checked={localStatus === 'completed'}
          onChange={handleCheckboxToggle}
        />

        {/* Task content */}
        <div className="task-main">
          <span className={`task-name ${localStatus === 'completed' ? 'completed' : ''}`}>
            {task.name}
          </span>
          {task.description && (
            <span className="task-description">{task.description}</span>
          )}
        </div>

        {/* Status pill */}
        <select
          className={`task-status-select ${localStatus}`}
          value={localStatus}
          onChange={handleStatusChange}
          onClick={(e) => e.stopPropagation()}
        >
          <option value="not_started">Not Started</option>
          <option value="in_progress">In Progress</option>
          <option value="completed">Completed</option>
          <option value="blocked">Blocked</option>
          <option value="cancelled">Cancelled</option>
        </select>

        {/* Actions */}
        <div className="task-actions">
          <button className="task-btn" onClick={() => setIsEditing(true)} title="Edit">
            <Edit2 size={14} />
          </button>
          <button className="task-btn" onClick={() => onAddSubtask(task._localId)} title="Add Subtask">
            <Plus size={14} />
          </button>
          <button className="task-btn delete" onClick={() => onDelete(task._localId)} title="Delete">
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      {/* Subtasks */}
      {expanded && hasSubtasks && (
        <div className="task-subtasks">
          {subtasks.map((subtask) => (
            <TaskItem
              key={subtask._localId}
              task={subtask}
              onUpdate={onUpdate}
              onDelete={onDelete}
              onAddSubtask={onAddSubtask}
              addingToId={addingToId}
              isAdding={isAdding}
              onAddTask={onAddTask}
              onCancelAdd={onCancelAdd}
              depth={depth + 1}
            />
          ))}
        </div>
      )}

      {/* Inline add-subtask form appears right below this task's subtasks */}
      {showSubtaskForm && (
        <div style={{ marginLeft: `${(depth + 1) * 24}px` }}>
          <AddTaskForm
            onSubmit={onAddTask}
            onCancel={onCancelAdd}
            isSubtask
          />
        </div>
      )}
    </>
  );
}

// Sortable wrapper for top-level tasks
interface SortableTaskItemProps {
  task: LocalTask;
  onUpdate: (localId: string, updates: Partial<Task>) => void;
  onDelete: (localId: string) => void;
  onAddSubtask: (localId: string) => void;
  addingToId: string | null;
  isAdding: boolean;
  onAddTask: (name: string, status: Task['status'], description: string) => void;
  onCancelAdd: () => void;
}

function SortableTaskItem({ task, onUpdate, onDelete, onAddSubtask, addingToId, isAdding, onAddTask, onCancelAdd }: SortableTaskItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: task._localId });

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
      <div className="task-item-body">
        <TaskItem
          task={task}
          onUpdate={onUpdate}
          onDelete={onDelete}
          onAddSubtask={onAddSubtask}
          addingToId={addingToId}
          isAdding={isAdding}
          onAddTask={onAddTask}
          onCancelAdd={onCancelAdd}
          depth={0}
        />
      </div>
    </li>
  );
}

interface TaskListProps {
  tasks: LocalTask[];
  onUpdate: (localId: string, updates: Partial<Task>) => void;
  onDelete: (localId: string) => void;
  onAddSubtask: (localId: string) => void;
  onReorder: (tasks: Task[]) => void;
  isAdding: boolean;
  addingToId: string | null;
  onAddTask: (name: string, status: Task['status'], description: string) => void;
  onCancelAdd: () => void;
}

export function TaskList({ tasks, onUpdate, onDelete, onAddSubtask, onReorder, isAdding, addingToId, onAddTask, onCancelAdd }: TaskListProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = tasks.findIndex(t => t._localId === active.id);
      const newIndex = tasks.findIndex(t => t._localId === over.id);

      if (oldIndex !== -1 && newIndex !== -1) {
        const newTasks = arrayMove(tasks, oldIndex, newIndex);
        const cleanTasks = newTasks.map(({ _localId, ...task }) => task);
        onReorder(cleanTasks);
      }
    }
  };

  if (tasks.length === 0 && !isAdding) {
    return (
      <div className="progress-empty">
        <p>No tasks yet. Click "Add Task" to get started!</p>
      </div>
    );
  }

  // Show inline form at bottom for top-level adds (addingToId === null)
  const showBottomForm = isAdding && addingToId === null;

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={tasks.map(t => t._localId)} strategy={verticalListSortingStrategy}>
        <ul className="task-list">
          {tasks.map((task) => (
            <SortableTaskItem
              key={task._localId}
              task={task}
              onUpdate={onUpdate}
              onDelete={onDelete}
              onAddSubtask={onAddSubtask}
              addingToId={addingToId}
              isAdding={isAdding}
              onAddTask={onAddTask}
              onCancelAdd={onCancelAdd}
            />
          ))}
        </ul>
      </SortableContext>

      {showBottomForm && (
        <AddTaskForm
          onSubmit={onAddTask}
          onCancel={onCancelAdd}
        />
      )}
    </DndContext>
  );
}
