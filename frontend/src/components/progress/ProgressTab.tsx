import { useState, useCallback, useRef } from 'react';
import { useProgress } from '../../hooks/useProjects';
import { api } from '../../api/client';
import { ProgressHeader } from './ProgressHeader';
import { ProgressStats } from './ProgressStats';
import { TaskList } from './TaskList';
import { AddTaskForm } from './AddTaskForm';
import type { Task } from '../../types';

interface ProgressTabProps {
  projectPath: string | null;
  projectName: string;
}

// Local task with stable ID
interface LocalTask extends Task {
  _localId: string;
}

export function ProgressTab({ projectPath, projectName }: ProgressTabProps) {
  const { data: progressData, isLoading, refetch } = useProgress(projectPath);
  const [isAdding, setIsAdding] = useState(false);
  const [addingToId, setAddingToId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  
  // Local state for optimistic updates
  const [localTasks, setLocalTasks] = useState<LocalTask[]>([]);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const initialized = progressData?.dir_exists && progressData?.found;
  const notInitialized = progressData && !progressData.dir_exists;

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
  const debouncedSave = useCallback((tasks: Task[]) => {
    if (!projectPath) return;
    
    // Clear existing timeout
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    
    setSaving(true);
    
    // Debounce save by 500ms
    saveTimeoutRef.current = setTimeout(async () => {
      try {
        const data = progressData?.data;
        if (data) {
          await api.saveProgress(projectPath, {
            ...data,
            tasks,
          });
        }
      } catch (err) {
        console.error('Failed to save:', err);
      } finally {
        setSaving(false);
      }
    }, 500);
  }, [projectPath, progressData]);

  // Update task - optimistic
  const handleUpdateTask = useCallback((localId: string, updates: Partial<Task>) => {
    setLocalTasks(prev => {
      const updateInTree = (tasks: LocalTask[]): LocalTask[] => {
        return tasks.map(task => {
          if (task._localId === localId) {
            return { ...task, ...updates };
          }
          if (task.subtasks) {
            return { ...task, subtasks: updateInTree(task.subtasks as LocalTask[]) };
          }
          return task;
        });
      };
      
      const newTasks = updateInTree(prev);
      
      // Debounced save
      const cleanTasks = newTasks.map(({ _localId, ...t }) => t);
      debouncedSave(cleanTasks);
      
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
      
      // Immediate save for delete
      const cleanTasks = newTasks.map(({ _localId, ...t }) => t);
      debouncedSave(cleanTasks);
      
      return newTasks;
    });
  }, [debouncedSave]);

  // Add task - optimistic
  const handleAddTask = useCallback((name: string, status: Task['status'], description: string) => {
    const newTask: LocalTask = {
      id: Date.now().toString(),
      _localId: `new-${Date.now()}`,
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
            if (task.subtasks) {
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
      
      // Immediate save
      const cleanTasks = newTasks.map(({ _localId, ...t }) => t);
      debouncedSave(cleanTasks);
      
      return newTasks;
    });

    setIsAdding(false);
    setAddingToId(null);
  }, [addingToId, debouncedSave]);

  // Reorder tasks - optimistic
  const handleReorder = useCallback((tasks: Task[]) => {
    // Rebuild local IDs for new order
    const rebuildIds = (taskList: Task[], parentId = ''): LocalTask[] => {
      return taskList.map((task, index) => {
        const localId = parentId ? `${parentId}-${index}` : `task-${index}`;
        return {
          ...task,
          _localId: localId,
          subtasks: task.subtasks ? rebuildIds(task.subtasks, localId) : [],
        } as LocalTask;
      });
    };
    
    const newLocalTasks = rebuildIds(tasks);
    setLocalTasks(newLocalTasks);
    
    // Immediate save
    debouncedSave(tasks);
  }, [debouncedSave]);

  // Sync local tasks when data loads
  const handleTasksChange = useCallback((tasks: LocalTask[]) => {
    setLocalTasks(tasks);
  }, []);

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
  const displayTasks = localTasks.length > 0 ? localTasks : data.tasks as LocalTask[];

  return (
    <div className="progress-container">
      <ProgressHeader 
        title={data.project.name || projectName}
        saving={saving}
        onAddTask={() => {
          setAddingToId(null);
          setIsAdding(true);
        }}
      />
      
      <ProgressStats tasks={displayTasks.map(({ _localId, ...t }) => t)} />
      
      {isAdding && (
        <AddTaskForm
          onSubmit={handleAddTask}
          onCancel={() => {
            setIsAdding(false);
            setAddingToId(null);
          }}
          isSubtask={!!addingToId}
        />
      )}
      
      <TaskList
        tasks={data.tasks}
        onUpdate={handleUpdateTask}
        onDelete={handleDeleteTask}
        onAddSubtask={(localId) => {
          setAddingToId(localId);
          setIsAdding(true);
        }}
        onReorder={handleReorder}
        onTasksChange={handleTasksChange}
      />
    </div>
  );
}
