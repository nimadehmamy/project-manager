import { Plus, Loader2 } from 'lucide-react';

interface ProgressHeaderProps {
  title: string;
  saving: boolean;
  onAddTask: () => void;
}

export function ProgressHeader({ title, saving, onAddTask }: ProgressHeaderProps) {
  return (
    <div className="progress-header">
      <h2 className="progress-title">📊 {title} Progress</h2>
      <div className="progress-actions">
        {saving && (
          <span className="saving-indicator">
            <Loader2 className="spin" size={16} />
            Saving...
          </span>
        )}
        <button className="btn btn-primary" onClick={onAddTask}>
          <Plus size={16} />
          Add Task
        </button>
      </div>
    </div>
  );
}
