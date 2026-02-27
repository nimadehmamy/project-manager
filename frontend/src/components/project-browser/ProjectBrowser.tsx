import { useCallback } from 'react';
import { RefreshCw } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { FileTree } from '../common/FileTree';
import type { TreeEntry } from '../../hooks/useProjects';

interface ProjectBrowserProps {
  selectedProject: string | null;
  onSelect: (path: string, name: string) => void;
}

export function ProjectBrowser({ selectedProject, onSelect }: ProjectBrowserProps) {
  const queryClient = useQueryClient();

  const handleSelect = useCallback((entry: TreeEntry) => {
    if (entry.is_dir) {
      onSelect(entry.path, entry.name);
    }
  }, [onSelect]);

  const handleRefresh = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['tree'] });
  }, [queryClient]);

  return (
    <div className="project-list">
      <div className="project-list-toolbar">
        <button
          className="btn-icon"
          onClick={handleRefresh}
          title="Refresh projects"
        >
          <RefreshCw size={14} />
        </button>
      </div>
      <FileTree
        rootPath="/"
        showFiles={false}
        selectedPath={selectedProject}
        onSelect={handleSelect}
      />
    </div>
  );
}
