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
  const [addingToId, setAddingToId] = useState<string | null>(null);
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

  const handleAddTask = useCallback(async (name: string, status: Task['status'], description: string, parentId?: string) => {
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

    if (parentId) {
      // Add as subtask
      const parent = findTask(updatedData.tasks, parentId);
      if (parent) {
        parent.subtasks = [...(parent.subtasks || []), newTask];
      }
    } else {
      // Add as top-level
      updatedData.tasks = [...updatedData.tasks, newTask];
    }

    setSaving(true);
    try {
      await api.saveProgress(projectPath, updatedData);
      refetch();
    } finally {
      setSaving(false);
      setIsAdding(false);
      setAddingToId(null);
    }
  }, [projectPath, progressData, refetch]);

  const handleUpdateTask = useCallback(async (taskId: string, updates: Partial<Task>) => {
    if (!projectPath || !progressData?.data) return;

    const updatedData = { ...progressData.data };
    const task = findTask(updatedData.tasks, taskId);
    
    if (task) {
      Object.assign(task, updates);
      setSaving(true);
      try {
        await api.saveProgress(projectPath, updatedData);
        refetch();
      } finally {
        setSaving(false);
      }
    }
  }, [projectPath, progressData, refetch]);

  const handleDeleteTask = useCallback(async (taskId: string) => {
    if (!projectPath || !progressData?.data) return;

    const updatedData = { ...progressData.data };
    deleteTaskById(updatedData.tasks, taskId);

    setSaving(true);
    try {
      await api.saveProgress(projectPath, updatedData);
      refetch();
    } finally {
      setSaving(false);
    }
  }, [projectPath, progressData, refetch]);

  const handleReorderTasks = useCallback(async (tasks: Task[]) => {
    if (!projectPath || !progressData?.data) return;

    const updatedData = { ...progressData.data, tasks };
    setSaving(true);
    try {
      await api.saveProgress(projectPath, updatedData);
      refetch();
    } finally {
      setSaving(false);
    }
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
        onAddTask={() => setIsAdding(true)}
      />
      
      <ProgressStats tasks={data.tasks} />
      
      {isAdding && (
        <AddTaskForm
          onSubmit={(name, status, desc) => handleAddTask(name, status, desc, addingToId || undefined)}
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
        onAddSubtask={(parentId) => {
          setAddingToId(parentId);
          setIsAdding(true);
        }}
        onReorder={handleReorderTasks}
      />
    </div>
  );
}

// Helper functions
function findTask(tasks: Task[], taskId: string): Task | null {
  const indices = taskId.split('.').map(Number);
  let current: Task | undefined = tasks[indices[0]];
  
  for (let i = 1; i < indices.length && current; i++) {
    current = current.subtasks?.[indices[i]];
  }
  
  return current || null;
}

function deleteTaskById(tasks: Task[], taskId: string): void {
  const indices = taskId.split('.').map(Number);
  
  if (indices.length === 1) {
    tasks.splice(indices[0], 1);
    return;
  }
  
  let current = tasks;
  for (let i = 0; i < indices.length - 1; i++) {
    current = current[indices[i]].subtasks || [];
  }
  
  current.splice(indices[indices.length - 1], 1);
}
