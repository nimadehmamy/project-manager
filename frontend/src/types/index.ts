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

export type TabType = 'summary' | 'todos' | 'progress' | 'files' | 'graph' | 'chat';

export interface User {
  username: string;
  authenticated: boolean;
}
