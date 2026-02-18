import type { Task } from '../../types';

interface ProgressStatsProps {
  tasks: Task[];
}

export function ProgressStats({ tasks }: ProgressStatsProps) {
  let total = 0;
  let completed = 0;
  let inProgress = 0;

  const count = (taskList: Task[]) => {
    taskList.forEach((task) => {
      total++;
      if (task.status === 'completed') completed++;
      else if (task.status === 'in_progress') inProgress++;
      if (task.subtasks) count(task.subtasks);
    });
  };

  count(tasks);

  const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;

  return (
    <>
      <div className="progress-stats">
        <div className="stat-card">
          <div className="stat-value">{total}</div>
          <div className="stat-label">Total</div>
        </div>
        <div className="stat-card">
          <div className="stat-value" style={{ color: 'var(--accent-green)' }}>
            {completed}
          </div>
          <div className="stat-label">Done</div>
        </div>
        <div className="stat-card">
          <div className="stat-value" style={{ color: 'var(--accent-blue)' }}>
            {inProgress}
          </div>
          <div className="stat-label">In Progress</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{percentage}%</div>
          <div className="stat-label">Complete</div>
        </div>
      </div>

      <div className="progress-bar-container">
        <div className="progress-bar" style={{ width: `${percentage}%` }} />
      </div>
    </>
  );
}
