import { useState, useEffect } from 'react';
import { ChevronDown, ChevronRight, RefreshCw, Folder, CheckCircle2, Circle, Clock } from 'lucide-react';
import { api } from '../../api/client';
import type { ManagedProject, Task } from '../../types';

interface HomeTabProps {
  onProjectSelect: (path: string, name: string) => void;
}

export function HomeTab({ onProjectSelect }: HomeTabProps) {
  const [projects, setProjects] = useState<ManagedProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedProjects, setExpandedProjects] = useState<Set<string>>(new Set());

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
    // Auto-refresh every 5 minutes
    const interval = setInterval(fetchProjects, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const toggleProject = (path: string) => {
    setExpandedProjects(prev => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  };

  const getProgressColor = (progress: number) => {
    if (progress === 100) return 'var(--accent-green, #22c55e)';
    if (progress >= 50) return 'var(--accent-blue, #3b82f6)';
    if (progress > 0) return 'var(--folder-color, #f59e0b)';
    return 'var(--text-muted, #6b7280)';
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
          <h2>📊 Project Dashboard</h2>
          <button className="refresh-btn" disabled>
            <RefreshCw size={18} className="spin" />
          </button>
        </div>
        <div className="home-loading">Loading projects...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="home-tab">
        <div className="home-header">
          <h2>📊 Project Dashboard</h2>
          <button className="refresh-btn" onClick={fetchProjects}>
            <RefreshCw size={18} />
          </button>
        </div>
        <div className="home-error">{error}</div>
      </div>
    );
  }

  return (
    <div className="home-tab">
      <div className="home-header">
        <h2>📊 Project Dashboard</h2>
        <div className="home-stats">
          <span>{projects.length} projects</span>
          <button 
            className="refresh-btn" 
            onClick={fetchProjects}
            disabled={loading}
            title="Refresh projects"
          >
            <RefreshCw size={18} className={loading ? 'spin' : ''} />
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
        <div className="projects-list">
          {projects.map(project => {
            const isExpanded = expandedProjects.has(project.path);
            const progressColor = getProgressColor(project.progress);

            return (
              <div 
                key={project.path} 
                className={`project-bar ${isExpanded ? 'expanded' : ''}`}
              >
                <div 
                  className="project-header"
                  onClick={() => toggleProject(project.path)}
                >
                  <button className="expand-btn">
                    {isExpanded ? (
                      <ChevronDown size={20} />
                    ) : (
                      <ChevronRight size={20} />
                    )}
                  </button>

                  <div className="project-info">
                    <span className="project-name">{project.name}</span>
                    <span className="project-path">{project.path}</span>
                  </div>

                  <div className="project-stats">
                    <span className="task-count">
                      {project.completed}/{project.total_tasks} tasks
                    </span>
                    {project.in_progress > 0 && (
                      <span className="in-progress-badge">
                        {project.in_progress} in progress
                      </span>
                    )}
                  </div>

                  <div className="project-progress">
                    <div className="progress-bar">
                      <div 
                        className="progress-fill"
                        style={{ 
                          width: `${project.progress}%`,
                          backgroundColor: progressColor
                        }}
                      />
                    </div>
                    <span className="progress-text">{project.progress}%</span>
                  </div>

                  <button 
                    className="open-project-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      onProjectSelect(project.path, project.name);
                    }}
                  >
                    Open
                  </button>
                </div>

                {isExpanded && (
                  <div className="project-tasks">
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
