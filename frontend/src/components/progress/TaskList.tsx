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
import type { Task } from '../../types';

// Local state management - independent of YAML
interface LocalTask extends Task {
  _localId: string; // Stable ID for React keys
}

interface TaskItemProps {
  task: LocalTask;
  onUpdate: (localId: string, updates: Partial<Task>) => void;
  onDelete: (localId: string) => void;
  onAddSubtask: (localId: string) => void;
  depth?: number;
  allTasks: LocalTask[]; // For finding parent
}

function TaskItem({ task, onUpdate, onDelete, onAddSubtask, depth = 0, allTasks }: TaskItemProps) {
  const [expanded, setExpanded] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({
    name: task.name,
    status: task.status,
    description: task.description || '',
  });

  const hasSubtasks = task.subtasks && task.subtasks.length > 0;
  const subtasks = (task.subtasks || []) as LocalTask[];

  // Reset edit form when task data changes
  useEffect(() => {
    setEditForm({
      name: task.name,
      status: task.status,
      description: task.description || '',
    });
  }, [task.name, task.status, task.description]);

  const handleSave = () => {
    onUpdate(task._localId, {
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
      <div className="task-content editing" style={{ marginLeft: `${depth * 24}px` }}>
        <div className="task-edit-form" style={{ flex: 1 }}>
          <input
            type="text"
            value={editForm.name}
            onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
            placeholder="Task name..."
            style={{ fontSize: '0.9375rem' }}
            autoFocus
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
      <div className="task-content" style={{ marginLeft: `${depth * 24}px` }}>
        {/* Drag handle - inside the box */}
        {depth === 0 && (
          <span className="task-drag-handle">
            <GripVertical size={16} />
          </span>
        )}
        {depth > 0 && <span className="task-drag-handle" style={{ visibility: 'hidden' }}><GripVertical size={16} /></span>}

        {/* Expand/collapse toggle */}
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

        {/* Checkbox */}
        <input
          type="checkbox"
          className="task-checkbox"
          checked={task.status === 'completed'}
          onChange={(e) => onUpdate(task._localId, { status: e.target.checked ? 'completed' : 'not_started' })}
        />

        {/* Task content */}
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
        <div className="task-sublist">
          {subtasks.map((subtask) => (
            <TaskItem
              key={subtask._localId}
              task={subtask}
              onUpdate={onUpdate}
              onDelete={onDelete}
              onAddSubtask={onAddSubtask}
              depth={depth + 1}
              allTasks={allTasks}
            />
          ))}
        </div>
      )}
    </>
  );
}

// Sortable wrapper for top-level tasks only
interface SortableTaskItemProps {
  task: LocalTask;
  onUpdate: (localId: string, updates: Partial<Task>) => void;
  onDelete: (localId: string) => void;
  onAddSubtask: (localId: string) => void;
  allTasks: LocalTask[];
}

function SortableTaskItem({ task, onUpdate, onDelete, onAddSubtask, allTasks }: SortableTaskItemProps) {
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
    <li ref={setNodeRef} style={style} className="task-item sortable">
      {/* Drag handle is part of the sortable wrapper, not inside TaskItem */}
      <div className="sortable-drag-handle" {...attributes} {...listeners}>
        <GripVertical size={16} />
      </div>
      <div className="task-item-content">
        <TaskItem
          task={task}
          onUpdate={onUpdate}
          onDelete={onDelete}
          onAddSubtask={onAddSubtask}
          depth={0}
          allTasks={allTasks}
        />
      </div>
    </li>
  );
}

interface TaskListProps {
  tasks: Task[];
  onUpdate: (localId: string, updates: Partial<Task>) => void;
  onDelete: (localId: string) => void;
  onAddSubtask: (localId: string) => void;
  onReorder: (tasks: Task[]) => void;
  onTasksChange?: (tasks: LocalTask[]) => void; // For parent to track local state
}

export function TaskList({ tasks, onUpdate, onDelete, onAddSubtask, onReorder, onTasksChange }: TaskListProps) {
  // Convert to local tasks with stable IDs
  const [localTasks, setLocalTasks] = useState<LocalTask[]>([]);
  
  // Initialize from props
  useEffect(() => {
    const addLocalIds = (taskList: Task[], parentId = ''): LocalTask[] => {
      return taskList.map((task, index) => {
        const localId = parentId ? `${parentId}-${index}` : `task-${index}`;
        return {
          ...task,
          _localId: localId,
          subtasks: task.subtasks ? addLocalIds(task.subtasks, localId) : [],
        };
      });
    };
    
    const newLocalTasks = addLocalIds(tasks);
    setLocalTasks(newLocalTasks);
    onTasksChange?.(newLocalTasks);
  }, [tasks, onTasksChange]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = localTasks.findIndex(t => t._localId === active.id);
      const newIndex = localTasks.findIndex(t => t._localId === over.id);
      
      if (oldIndex !== -1 && newIndex !== -1) {
        const newTasks = arrayMove(localTasks, oldIndex, newIndex);
        
        // Update local state immediately (optimistic)
        setLocalTasks(newTasks);
        
        // Call parent with updated tasks (without _localId)
        const cleanTasks = newTasks.map(({ _localId, ...task }) => task);
        onReorder(cleanTasks);
      }
    }
  };

  if (localTasks.length === 0) {
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
        items={localTasks.map(t => t._localId)}
        strategy={verticalListSortingStrategy}
      >
        <ul className="task-list">
          {localTasks.map((task) => (
            <SortableTaskItem
              key={task._localId}
              task={task}
              onUpdate={onUpdate}
              onDelete={onDelete}
              onAddSubtask={onAddSubtask}
              allTasks={localTasks}
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
