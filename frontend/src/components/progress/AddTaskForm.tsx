import { useState } from 'react';
import type { Task } from '../../types';

interface AddTaskFormProps {
  onSubmit: (name: string, status: Task['status'], description: string) => void;
  onCancel: () => void;
  isSubtask?: boolean;
}

export function AddTaskForm({ onSubmit, onCancel, isSubtask }: AddTaskFormProps) {
  const [name, setName] = useState('');
  const [status, setStatus] = useState<Task['status']>('not_started');
  const [description, setDescription] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim()) {
      onSubmit(name.trim(), status, description.trim());
    }
  };

  return (
    <form className="add-task-form" onSubmit={handleSubmit}>
      <h4>{isSubtask ? 'Add Subtask' : 'Add New Task'}</h4>
      <div className="form-row">
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Task name..."
          style={{ flex: 2 }}
          autoFocus
        />
        <select value={status} onChange={(e) => setStatus(e.target.value as Task['status'])}>
          <option value="not_started">Not Started</option>
          <option value="in_progress">In Progress</option>
          <option value="completed">Completed</option>
          <option value="blocked">Blocked</option>
        </select>
      </div>
      <div className="form-row">
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Description (optional)..."
          rows={2}
        />
      </div>
      <div className="form-row" style={{ justifyContent: 'flex-end' }}>
        <button type="button" className="btn" onClick={onCancel}>
          Cancel
        </button>
        <button type="submit" className="btn btn-primary">
          Add
        </button>
      </div>
    </form>
  );
}
