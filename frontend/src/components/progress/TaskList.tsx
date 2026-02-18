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

interface SortableTaskItemProps {
  task: Task;
  taskId: string;
  depth?: number;
  onUpdate: (id: string, updates: Partial<Task>) => void;
  onDelete: (id: string) => void;
  onAddSubtask: (id: string) => void;
  isEditing: boolean;
  onStartEdit: (id: string) => void;
  onCancelEdit: () => void;
}

function SortableTaskItem({
  task,
  taskId,
  depth = 0,
  onUpdate,
  onDelete,
  onAddSubtask,
  isEditing,
  onStartEdit,
  onCancelEdit,
}: SortableTaskItemProps) {
  const [expanded, setExpanded] = useState(false);
  const [editForm, setEditForm] = useState({
    name: task.name,
    status: task.status,
    description: task.description || '',
  });

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: taskId });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const hasSubtasks = task.subtasks && task.subtasks.length > 0;

  const handleSave = () => {
    onUpdate(taskId, {
      name: editForm.name,
      status: editForm.status as Task['status'],
      description: editForm.description,
    });
    onCancelEdit();
  };

  if (isEditing) {
    return (
      <li ref={setNodeRef} style={style} className="task-item">
        <div className="task-content editing" style={{ marginLeft: `${depth * 20}px` }}>
          <div className="task-edit-form">
            <input
              type="text"
              value={editForm.name}
              onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
              placeholder="Task name..."
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
              <button className="btn btn-sm" onClick={onCancelEdit}>Cancel</button>
              <button className="btn btn-sm btn-primary" onClick={handleSave}>Save</button>
            </div>
          </div>
        </div>
      </li>
    );
  }

  return (
    <li ref={setNodeRef} style={style} className="task-item">
      <div className="task-content" style={{ marginLeft: `${depth * 20}px` }}>
        <div className="task-drag-handle" {...attributes} {...listeners}>
          <GripVertical size={16} />
        </div>

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
          onChange={(e) => onUpdate(taskId, { status: e.target.checked ? 'completed' : 'not_started' })}
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
          <button className="task-btn" onClick={() => onStartEdit(taskId)} title="Edit">
            <Edit2 size={14} />
          </button>
          <button className="task-btn" onClick={() => onAddSubtask(taskId)} title="Add Subtask">
            <Plus size={14} />
          </button>
          <button className="task-btn delete" onClick={() => onDelete(taskId)} title="Delete">
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      {expanded && hasSubtasks && (
        <ul className="task-sublist">
          {task.subtasks!.map((subtask, idx) => (
            <SortableTaskItem
              key={`${taskId}.${idx}`}
              task={subtask}
              taskId={`${taskId}.${idx}`}
              depth={depth + 1}
              onUpdate={onUpdate}
              onDelete={onDelete}
              onAddSubtask={onAddSubtask}
              isEditing={false}
              onStartEdit={onStartEdit}
              onCancelEdit={onCancelEdit}
            />
          ))}
        </ul>
      )}
    </li>
  );
}

interface TaskListProps {
  tasks: Task[];
  onUpdate: (id: string, updates: Partial<Task>) => void;
  onDelete: (id: string) => void;
  onAddSubtask: (id: string) => void;
  onReorder: (tasks: Task[]) => void;
}

export function TaskList({ tasks, onUpdate, onDelete, onAddSubtask, onReorder }: TaskListProps) {
  const [editingId, setEditingId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = tasks.findIndex((_, i) => i.toString() === active.id);
      const newIndex = tasks.findIndex((_, i) => i.toString() === over.id);
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
              taskId={index.toString()}
              onUpdate={onUpdate}
              onDelete={onDelete}
              onAddSubtask={onAddSubtask}
              isEditing={editingId === index.toString()}
              onStartEdit={setEditingId}
              onCancelEdit={() => setEditingId(null)}
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
