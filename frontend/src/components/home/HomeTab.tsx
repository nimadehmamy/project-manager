import { useState, useEffect, useCallback } from 'react';
import { ChevronDown, ChevronRight, RefreshCw, Folder, CheckCircle2, Circle, Clock } from 'lucide-react';
import { api } from '../../api/client';
import { useSocket } from '../../contexts/SocketContext';
import type { ManagedProject, Task } from '../../types';

interface HomeTabProps {
  onProjectSelect: (path: string, name: string) => void;
}

/** Normalize path for comparison — strip leading slash */
function normPath(p: string): string {
  return p.replace(/^\/+/, '');
}

export function HomeTab({ onProjectSelect }: HomeTabProps) {
  const [projects, setProjects] = useState<ManagedProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedProjects, setExpandedProjects] = useState<Set<string>>(new Set());
  const { socket } = useSocket();

  const fetchProjects = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.getManagedProjects();
      setProjects(data.projects || []);
    } catch (err) {
      setError('Failed to load projects');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProjects();
    const interval = setInterval(fetchProjects, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  // Listen for real-time task_update events via WebSocket
  const handleTaskUpdate = useCallback((data: {
    path: string;
    name: string;
    status: string;
    total_tasks: number;
    completed: number;
    in_progress: number;
    blocked: number;
    progress: number;
    tasks: Task[];
    has_more_tasks: boolean;
  }) => {
    setProjects(prev => {
      const incomingNorm = normPath(data.path);
      const idx = prev.findIndex(p => normPath(p.path) === incomingNorm);
      const updated: ManagedProject = {
        path: data.path,
        name: data.name || data.path.split('/').pop() || '',
        status: (data.status as ManagedProject['status']) || 'active',
        total_tasks: data.total_tasks,
        completed: data.completed,
        in_progress: data.in_progress,
        blocked: data.blocked || 0,
        progress: data.progress,
        tasks: data.tasks,
        has_more_tasks: data.has_more_tasks,
      };
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = updated;
        return next;
      }
      return [...prev, updated];
    });
  }, []);

  useEffect(() => {
    if (!socket) return;
    socket.on('task_update', handleTaskUpdate);
    return () => { socket.off('task_update', handleTaskUpdate); };
  }, [socket, handleTaskUpdate]);

  const toggleProject = (path: string) => {
    setExpandedProjects(prev => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  };

  // Match Progress tab's segment colors exactly
  const SEGMENT_COLORS = {
    completed: 'var(--accent-green)',   // green
    in_progress: '#3b82f6',             // blue
    blocked: '#ef4444',                 // red
    not_started: 'var(--text-muted)',   // gray
  };

  /** Dominant accent color for the percentage text */
  const getDominantAccent = (project: ManagedProject) => {
    if (project.progress === 100) return SEGMENT_COLORS.completed;
    if ((project.blocked || 0) > 0) return SEGMENT_COLORS.blocked;
    if (project.in_progress > 0) return SEGMENT_COLORS.in_progress;
    if (project.completed > 0) return SEGMENT_COLORS.completed;
    return SEGMENT_COLORS.not_started;
  };

  const getStatusIcon = (status: Task['status']) => {
    switch (status) {
      case 'completed':
        return <CheckCircle2 size={16} className="status-completed" />;
      case 'in_progress':
        return <Clock size={16} className="status-in-progress" />;
      default:
        return <Circle size={16} className="status-not-started" />;
    }
  };

  if (loading && projects.length === 0) {
    return (
      <div className="home-tab">
        <div className="home-header">
          <h2>Project Dashboard</h2>
          <div className="progress-actions">
            <button className="btn btn-secondary" disabled>
              <RefreshCw size={16} className="spin" />
            </button>
          </div>
        </div>
        <div className="home-loading">Loading projects...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="home-tab">
        <div className="home-header">
          <h2>Project Dashboard</h2>
          <div className="progress-actions">
            <button className="btn btn-secondary" onClick={fetchProjects}>
              <RefreshCw size={16} />
            </button>
          </div>
        </div>
        <div className="home-error">{error}</div>
      </div>
    );
  }

  return (
    <div className="home-tab">
      <div className="home-header">
        <h2>Project Dashboard</h2>
        <div className="home-header-right">
          <span className="home-project-count">{projects.length} projects</span>
          <button
            className="btn btn-secondary"
            onClick={fetchProjects}
            disabled={loading}
            title="Refresh projects"
          >
            <RefreshCw size={16} className={loading ? 'spin' : ''} />
          </button>
        </div>
      </div>

      {projects.length === 0 ? (
        <div className="home-empty">
          <Folder size={48} />
          <p>No projects with task tracking found</p>
          <p className="hint">
            Create a task tracker in any project to see it here
          </p>
        </div>
      ) : (
        <div className="home-projects-list">
          {projects.map(project => {
            const isExpanded = expandedProjects.has(project.path);
            const accent = getDominantAccent(project);
            const total = project.total_tasks || 1;
            const completedPct = (project.completed / total) * 100;
            const inProgressPct = (project.in_progress / total) * 100;
            const blockedPct = ((project.blocked || 0) / total) * 100;

            return (
              <div
                key={project.path}
                className={`home-project-band ${isExpanded ? 'expanded' : ''}`}
                style={{ '--progress-accent': accent } as React.CSSProperties}
              >
                {/* Multi-segment background fill matching Progress tab */}
                <div className="home-band-fills">
                  {completedPct > 0 && (
                    <div
                      className="home-band-segment"
                      style={{ width: `${completedPct}%`, backgroundColor: SEGMENT_COLORS.completed }}
                    />
                  )}
                  {inProgressPct > 0 && (
                    <div
                      className="home-band-segment"
                      style={{ width: `${inProgressPct}%`, backgroundColor: SEGMENT_COLORS.in_progress }}
                    />
                  )}
                  {blockedPct > 0 && (
                    <div
                      className="home-band-segment"
                      style={{ width: `${blockedPct}%`, backgroundColor: SEGMENT_COLORS.blocked }}
                    />
                  )}
                </div>

                <div
                  className="home-band-content"
                  onClick={() => toggleProject(project.path)}
                >
                  <div className="home-band-left">
                    <button className="expand-btn">
                      {isExpanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                    </button>
                    <div className="home-band-info">
                      <span className="home-band-name">{project.name}</span>
                      <span className="home-band-path">{project.path}</span>
                    </div>
                  </div>

                  <div className="home-band-right">
                    <div className="home-band-stats">
                      <span className="home-band-fraction">
                        {project.completed}<span className="home-band-sep">/</span>{project.total_tasks}
                      </span>
                      {project.in_progress > 0 && (
                        <span className="home-band-wip">
                          {project.in_progress} active
                        </span>
                      )}
                    </div>
                    <span className="home-band-pct">{Math.round(project.progress)}%</span>
                    <button
                      className="btn btn-sm btn-secondary home-open-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        const fullPath = project.path.startsWith('/') ? project.path : '/' + project.path;
                        onProjectSelect(fullPath, project.name);
                      }}
                    >
                      Open
                    </button>
                  </div>
                </div>

                {isExpanded && (
                  <div className="home-band-tasks">
                    {project.tasks.length === 0 ? (
                      <div className="no-tasks">No tasks yet</div>
                    ) : (
                      <>
                        {project.tasks.map((task, idx) => (
                          <div
                            key={idx}
                            className={`task-preview task-${task.status}`}
                          >
                            {getStatusIcon(task.status)}
                            <span className="task-name">{task.name}</span>
                          </div>
                        ))}
                        {project.has_more_tasks && (
                          <div className="more-tasks">
                            +{project.total_tasks - 10} more tasks
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
