import type { Task } from '../../types';

interface ProgressStatsProps {
  tasks: Task[];
}

export function ProgressStats({ tasks }: ProgressStatsProps) {
  let total = 0;
  let completed = 0;
  let inProgress = 0;
  let blocked = 0;
  let notStarted = 0;

  const count = (taskList: Task[]) => {
    taskList.forEach((task) => {
      total++;
      if (task.status === 'completed') completed++;
      else if (task.status === 'in_progress') inProgress++;
      else if (task.status === 'blocked') blocked++;
      else if (task.status === 'not_started') notStarted++;
      if (task.subtasks) count(task.subtasks);
    });
  };

  count(tasks);

  // Calculate weighted progress
  // completed = 100%, in_progress = 50%, blocked = 0%, not_started = 0%
  const weightedProgress = total > 0 
    ? (completed * 100 + inProgress * 50) / total 
    : 0;

  // Calculate segments for the progress bar
  const completedPct = total > 0 ? (completed / total) * 100 : 0;
  const inProgressPct = total > 0 ? (inProgress / total) * 100 : 0;
  const blockedPct = total > 0 ? (blocked / total) * 100 : 0;

  return (
    <>
      <div className="progress-stats">
        <div className="stat-card">
          <div className="stat-value">{total}</div>
          <div className="stat-label">Total</div>
        </div>
        <div className="stat-card">
          <div className="stat-value completed">{completed}</div>
          <div className="stat-label">Done</div>
        </div>
        <div className="stat-card">
          <div className="stat-value in-progress">{inProgress}</div>
          <div className="stat-label">In Progress</div>
        </div>
        <div className="stat-card">
          <div className="stat-value blocked">{blocked}</div>
          <div className="stat-label">Blocked</div>
        </div>
      </div>

      {/* Multi-color progress bar */}
      <div className="progress-bar-container multi">
        <div className="progress-segments">
          {completedPct > 0 && (
            <div 
              className="progress-segment completed" 
              style={{ width: `${completedPct}%` }}
              title={`Completed: ${completedPct.toFixed(1)}%`}
            />
          )}
          {inProgressPct > 0 && (
            <div 
              className="progress-segment in-progress" 
              style={{ width: `${inProgressPct}%` }}
              title={`In Progress: ${inProgressPct.toFixed(1)}%`}
            />
          )}
          {blockedPct > 0 && (
            <div 
              className="progress-segment blocked" 
              style={{ width: `${blockedPct}%` }}
              title={`Blocked: ${blockedPct.toFixed(1)}%`}
            />
          )}
        </div>
      </div>

      <div className="progress-percentage">
        {Math.round(weightedProgress)}% complete
      </div>
    </>
  );
}
