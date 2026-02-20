import { useState, useCallback, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useProgress } from '../../hooks/useProjects';
import { api } from '../../api/client';
import { ProgressHeader } from './ProgressHeader';
import { ProgressStats } from './ProgressStats';
import { TaskList } from './TaskList';
import type { Task } from '../../types';

interface ProgressTabProps {
  projectPath: string | null;
  projectName: string;
}

// Local task with stable ID
interface LocalTask extends Task {
  _localId: string;
}

// Generate unique local ID
let idCounter = 0;
const generateLocalId = () => `local-${Date.now()}-${idCounter++}`;

// Convert server tasks to local tasks with stable IDs
const toLocalTasks = (tasks: Task[]): LocalTask[] => {
  return tasks.map(task => ({
    ...task,
    _localId: task.id ? `task-${task.id}` : generateLocalId(),
    subtasks: task.subtasks ? toLocalTasks(task.subtasks) : [],
  }));
};

// Convert local tasks back to server format
const toServerTasks = (tasks: LocalTask[]): Task[] => {
  return tasks.map(({ _localId, ...task }) => ({
    ...task,
    subtasks: task.subtasks ? toServerTasks(task.subtasks as LocalTask[]) : [],
  }));
};

export function ProgressTab({ projectPath, projectName }: ProgressTabProps) {
  const queryClient = useQueryClient();
  const { data: progressData, isLoading, refetch } = useProgress(projectPath);
  const [isAdding, setIsAdding] = useState(false);
  const [addingToId, setAddingToId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  
  // Local state for optimistic updates
  const [localTasks, setLocalTasks] = useState<LocalTask[]>([]);

  // Refetch when component mounts to get fresh data
  useEffect(() => {
    if (projectPath) {
      refetch();
    }
  }, [projectPath, refetch]);

  const initialized = progressData?.dir_exists && progressData?.found;
  const notInitialized = progressData && !progressData.dir_exists;

  // Sync localTasks when data loads from server
  useEffect(() => {
    if (progressData?.data?.tasks) {
      setLocalTasks(toLocalTasks(progressData.data.tasks));
    } else {
      setLocalTasks([]);
    }
  }, [progressData?.data?.tasks]);

  const handleInit = async () => {
    if (!projectPath) return;
    setSaving(true);
    try {
      await api.initProgress(projectPath, projectName);
      refetch();
    } finally {
      setSaving(false);
    }
  };

  // Debounced save to backend
  const debouncedSave = useCallback(async (tasks: Task[]) => {
    if (!projectPath || !progressData?.data) return;
    
    setSaving(true);
    try {
      await api.saveProgress(projectPath, {
        ...progressData.data,
        tasks,
      });
      // Invalidate cache so next visit gets fresh data
      queryClient.invalidateQueries({ queryKey: ['progress', projectPath] });
    } catch (err) {
      console.error('Failed to save:', err);
    } finally {
      setSaving(false);
    }
  }, [projectPath, progressData?.data, queryClient]);

  // Update task - optimistic
  const handleUpdateTask = useCallback((localId: string, updates: Partial<Task>) => {
    setLocalTasks(prev => {
      const updateInTree = (tasks: LocalTask[]): LocalTask[] => {
        return tasks.map(task => {
          if (task._localId === localId) {
            return { ...task, ...updates };
          }
          if (task.subtasks && task.subtasks.length > 0) {
            return { ...task, subtasks: updateInTree(task.subtasks as LocalTask[]) };
          }
          return task;
        });
      };
      
      const newTasks = updateInTree(prev);
      
      // Save to server
      debouncedSave(toServerTasks(newTasks));
      
      return newTasks;
    });
  }, [debouncedSave]);

  // Delete task - optimistic
  const handleDeleteTask = useCallback((localId: string) => {
    setLocalTasks(prev => {
      const deleteFromTree = (tasks: LocalTask[]): LocalTask[] => {
        return tasks
          .filter(task => task._localId !== localId)
          .map(task => {
            if (task.subtasks && task.subtasks.length > 0) {
              return { ...task, subtasks: deleteFromTree(task.subtasks as LocalTask[]) };
            }
            return task;
          });
      };
      
      const newTasks = deleteFromTree(prev);
      debouncedSave(toServerTasks(newTasks));
      return newTasks;
    });
  }, [debouncedSave]);

  // Add task - optimistic
  const handleAddTask = useCallback((name: string, status: Task['status'], description: string) => {
    const newTask: LocalTask = {
      id: `new-${Date.now()}`,
      _localId: generateLocalId(),
      name,
      status,
      description,
      created: new Date().toISOString(),
      subtasks: [],
    };

    setLocalTasks(prev => {
      let newTasks: LocalTask[];
      
      if (addingToId) {
        // Add as subtask
        const addToParent = (tasks: LocalTask[]): LocalTask[] => {
          return tasks.map(task => {
            if (task._localId === addingToId) {
              return {
                ...task,
                subtasks: [...(task.subtasks || []), newTask],
              };
            }
            if (task.subtasks && task.subtasks.length > 0) {
              return { ...task, subtasks: addToParent(task.subtasks as LocalTask[]) };
            }
            return task;
          });
        };
        newTasks = addToParent(prev);
      } else {
        // Add as top-level
        newTasks = [...prev, newTask];
      }
      
      debouncedSave(toServerTasks(newTasks));
      return newTasks;
    });

    setIsAdding(false);
    setAddingToId(null);
  }, [addingToId, debouncedSave]);

  // Reorder tasks - optimistic
  const handleReorder = useCallback((tasks: Task[]) => {
    // Convert back to local tasks with IDs
    const newLocalTasks = toLocalTasks(tasks);
    setLocalTasks(newLocalTasks);
    debouncedSave(tasks);
  }, [debouncedSave]);

  if (isLoading) {
    return <div className="loading">Loading progress...</div>;
  }

  if (notInitialized) {
    return (
      <div className="progress-init">
        <div className="progress-init-icon">📊</div>
        <h3>Track Your Progress</h3>
        <p>Create a task tracker for "{projectName}"</p>
        <button 
          className="btn btn-primary" 
          onClick={handleInit}
          disabled={saving}
        >
          {saving ? 'Creating...' : 'Create Task Tracker'}
        </button>
      </div>
    );
  }

  if (!initialized || !progressData?.data) {
    return (
      <div className="empty-state">
        <p>Select a project to view progress</p>
      </div>
    );
  }

  const data = progressData.data;
  // Convert local tasks to plain tasks for child components
  const displayTasks = toServerTasks(localTasks);

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ['progress', projectPath] });
    refetch();
  };

  return (
    <div className="progress-container">
      <ProgressHeader 
        title={data.project.name || projectName}
        saving={saving}
        onAddTask={() => {
          setAddingToId(null);
          setIsAdding(true);
        }}
        onRefresh={handleRefresh}
        isLoading={isLoading}
      />
      
      <ProgressStats tasks={displayTasks} />

      <TaskList
        tasks={localTasks}
        onUpdate={handleUpdateTask}
        onDelete={handleDeleteTask}
        onAddSubtask={(localId) => {
          setAddingToId(localId);
          setIsAdding(true);
        }}
        onReorder={handleReorder}
        isAdding={isAdding}
        addingToId={addingToId}
        onAddTask={handleAddTask}
        onCancelAdd={() => {
          setIsAdding(false);
          setAddingToId(null);
        }}
      />
    </div>
  );
}
