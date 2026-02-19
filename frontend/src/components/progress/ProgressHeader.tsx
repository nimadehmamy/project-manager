import { Plus, Loader2, RefreshCw } from 'lucide-react';

interface ProgressHeaderProps {
  title: string;
  saving: boolean;
  onAddTask: () => void;
  onRefresh: () => void;
  isLoading?: boolean;
}

export function ProgressHeader({ title, saving, onAddTask, onRefresh, isLoading }: ProgressHeaderProps) {
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
        <button 
          className="btn btn-secondary" 
          onClick={onRefresh} 
          title="Refresh progress"
          disabled={isLoading}
        >
          <RefreshCw size={16} className={isLoading ? 'spin' : ''} />
        </button>
        <button className="btn btn-primary" onClick={onAddTask}>
          <Plus size={16} />
          Add Task
        </button>
      </div>
    </div>
  );
}
