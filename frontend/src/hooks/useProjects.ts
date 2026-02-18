import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/client';
import type { Project, FileEntry } from '../types';

export const useProjects = (path: string = '/') => {
  return useQuery({
    queryKey: ['projects', path],
    queryFn: async () => {
      const data = await api.getProjects(path);
      return data.projects as Project[];
    },
  });
};

export const useReadme = (projectPath: string | null) => {
  return useQuery({
    queryKey: ['readme', projectPath],
    queryFn: async () => {
      if (!projectPath) return null;
      return api.getReadme(projectPath);
    },
    enabled: !!projectPath,
  });
};

export const useTodo = (projectPath: string | null) => {
  return useQuery({
    queryKey: ['todo', projectPath],
    queryFn: async () => {
      if (!projectPath) return null;
      return api.getTodo(projectPath);
    },
    enabled: !!projectPath,
  });
};

export const useProgress = (projectPath: string | null) => {
  return useQuery({
    queryKey: ['progress', projectPath],
    queryFn: async () => {
      if (!projectPath) return null;
      return api.getProgress(projectPath);
    },
    enabled: !!projectPath,
  });
};

export const useFiles = (path: string | null) => {
  return useQuery({
    queryKey: ['files', path],
    queryFn: async () => {
      if (!path) return null;
      const data = await api.browseDirectory(path);
      return {
        entries: data.entries as FileEntry[],
        parent: data.parent,
        path: data.path,
      };
    },
    enabled: !!path,
  });
};

export const useInvalidateProgress = () => {
  const queryClient = useQueryClient();
  return (projectPath: string) => {
    queryClient.invalidateQueries({ queryKey: ['progress', projectPath] });
  };
};
