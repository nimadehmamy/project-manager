import { useState, useRef, useEffect } from 'react';
import { Plus, X } from 'lucide-react';
import type { Task } from '../../types';

interface AddTaskFormProps {
  onSubmit: (name: string, status: Task['status'], description: string) => void;
  onCancel: () => void;
  isSubtask?: boolean;
}

export function AddTaskForm({ onSubmit, onCancel, isSubtask }: AddTaskFormProps) {
  const [name, setName] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSubmit = () => {
    if (name.trim()) {
      onSubmit(name.trim(), 'not_started', '');
      setName('');
      inputRef.current?.focus();
    }
  };

  return (
    <div className="add-task-inline">
      <div className="add-task-inline-icon">
        <Plus size={16} />
      </div>
      <input
        ref={inputRef}
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder={isSubtask ? 'New subtask...' : 'New task...'}
        className="add-task-inline-input"
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            handleSubmit();
          } else if (e.key === 'Escape') {
            onCancel();
          }
        }}
      />
      <button
        className="btn btn-sm btn-primary add-task-inline-btn"
        onClick={handleSubmit}
        disabled={!name.trim()}
      >
        Add
      </button>
      <button
        className="add-task-inline-close"
        onClick={onCancel}
        title="Cancel"
      >
        <X size={14} />
      </button>
    </div>
  );
}
