// Project Manager Types

export interface Project {
  name: string;
  path: string;
  modified: string;
  has_readme: boolean;
  has_todo: boolean;
  has_children: boolean;
}

export interface FileEntry {
  name: string;
  path: string;
  is_dir: boolean;
  size: number | null;
  modified: string;
}

export interface Task {
  id: string;
  name: string;
  status: 'not_started' | 'in_progress' | 'completed' | 'blocked' | 'cancelled';
  description?: string;
  created: string;
  subtasks: Task[];
}

export interface ProjectProgress {
  version: string;
  project: {
    name: string;
    description: string;
    status: 'active' | 'paused' | 'archived';
  };
  tasks: Task[];
}

export interface ProjectStats {
  directories: number;
  files: number;
  total_size: string;
}

export interface ManagedProject {
  path: string;
  name: string;
  status: 'active' | 'paused' | 'archived';
  total_tasks: number;
  completed: number;
  in_progress: number;
  blocked: number;
  progress: number;
  tasks: Task[];
  has_more_tasks: boolean;
  expanded?: boolean;
}

export type TabType = 'home' | 'progress' | 'summary' | 'todos' | 'files' | 'graph' | 'profile';

export interface User {
  username: string;
  authenticated: boolean;
}
