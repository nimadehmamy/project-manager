import { useCallback } from 'react';
import { FileTree } from '../common/FileTree';
import type { TreeEntry } from '../../hooks/useProjects';

interface ProjectBrowserProps {
  selectedProject: string | null;
  onSelect: (path: string, name: string) => void;
}

export function ProjectBrowser({ selectedProject, onSelect }: ProjectBrowserProps) {
  const handleSelect = useCallback((entry: TreeEntry) => {
    if (entry.is_dir) {
      onSelect(entry.path, entry.name);
    }
  }, [onSelect]);

  return (
    <div className="project-list">
      <FileTree
        rootPath="/"
        showFiles={false}
        selectedPath={selectedProject}
        onSelect={handleSelect}
      />
    </div>
  );
}
