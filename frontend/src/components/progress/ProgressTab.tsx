import { useState, useCallback } from 'react';
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

export function ProgressTab({ projectPath, projectName }: ProgressTabProps) {
  const { data: progressData, isLoading, refetch } = useProgress(projectPath);
  const [isAdding, setIsAdding] = useState(false);
  const [addingToPath, setAddingToPath] = useState<number[] | null>(null);
  const [saving, setSaving] = useState(false);

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

  // Update task at specific path
  const handleUpdateTask = useCallback((path: number[], updates: Partial<Task>) => {
    if (!projectPath || !progressData?.data) return;

    const updatedData = { ...progressData.data };
    const task = getTaskAtPath(updatedData.tasks, path);
    
    if (task) {
      Object.assign(task, updates);
      
      setSaving(true);
      api.saveProgress(projectPath, updatedData)
        .then(() => refetch())
        .finally(() => setSaving(false));
    }
  }, [projectPath, progressData, refetch]);

  // Delete task at specific path
  const handleDeleteTask = useCallback((path: number[]) => {
    if (!projectPath || !progressData?.data) return;

    const updatedData = { ...progressData.data };
    deleteTaskAtPath(updatedData.tasks, path);

    setSaving(true);
    api.saveProgress(projectPath, updatedData)
      .then(() => refetch())
      .finally(() => setSaving(false));
  }, [projectPath, progressData, refetch]);

  // Add task
  const handleAddTask = useCallback((name: string, status: Task['status'], description: string) => {
    if (!projectPath || !progressData?.data) return;

    const newTask: Task = {
      id: Date.now().toString(),
      name,
      status,
      description,
      created: new Date().toISOString(),
      subtasks: [],
    };

    const updatedData = { ...progressData.data };

    if (addingToPath) {
      // Add as subtask
      const parent = getTaskAtPath(updatedData.tasks, addingToPath);
      if (parent) {
        if (!parent.subtasks) parent.subtasks = [];
        parent.subtasks.push(newTask);
      }
    } else {
      // Add as top-level
      updatedData.tasks.push(newTask);
    }

    setSaving(true);
    setIsAdding(false);
    setAddingToPath(null);
    
    api.saveProgress(projectPath, updatedData)
      .then(() => refetch())
      .finally(() => setSaving(false));
  }, [projectPath, progressData, addingToPath, refetch]);

  // Reorder top-level tasks
  const handleReorder = useCallback((tasks: Task[]) => {
    if (!projectPath || !progressData?.data) return;

    const updatedData = { ...progressData.data, tasks };
    
    setSaving(true);
    api.saveProgress(projectPath, updatedData)
      .then(() => refetch())
      .finally(() => setSaving(false));
  }, [projectPath, progressData, refetch]);

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

  return (
    <div className="progress-container">
      <ProgressHeader 
        title={data.project.name || projectName}
        saving={saving}
        onAddTask={() => {
          setAddingToPath(null);
          setIsAdding(true);
        }}
      />
      
      <ProgressStats tasks={data.tasks} />
      
      {isAdding && (
        <AddTaskForm
          onSubmit={handleAddTask}
          onCancel={() => {
            setIsAdding(false);
            setAddingToPath(null);
          }}
          isSubtask={!!addingToPath}
        />
      )}
      
      <TaskList
        tasks={data.tasks}
        onUpdate={handleUpdateTask}
        onDelete={handleDeleteTask}
        onAddSubtask={(path) => {
          setAddingToPath(path);
          setIsAdding(true);
        }}
        onReorder={handleReorder}
      />
    </div>
  );
}

// Helper: Get task at path [0, 1, 2] means tasks[0].subtasks[1].subtasks[2]
function getTaskAtPath(tasks: Task[], path: number[]): Task | null {
  let current: Task | undefined = tasks[path[0]];
  
  for (let i = 1; i < path.length && current; i++) {
    current = current.subtasks?.[path[i]];
  }
  
  return current || null;
}

// Helper: Delete task at path
function deleteTaskAtPath(tasks: Task[], path: number[]): void {
  if (path.length === 1) {
    tasks.splice(path[0], 1);
    return;
  }
  
  const parent = getTaskAtPath(tasks, path.slice(0, -1));
  if (parent && parent.subtasks) {
    parent.subtasks.splice(path[path.length - 1], 1);
  }
}
