import { useState, useEffect, useRef, useCallback } from 'react';
import { RefreshCw } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { FileTree } from '../common/FileTree';
import { FileViewerPanel } from './FileViewerPanel';
import type { TreeEntry } from '../../hooks/useProjects';

interface FilesTabProps {
  projectPath: string | null;
}

const TREE_WIDTH_KEY = 'pm-files-tree-width';
const DEFAULT_TREE_WIDTH = 280;
const MIN_TREE_WIDTH = 180;
const MAX_TREE_WIDTH = 500;

export function FilesTab({ projectPath }: FilesTabProps) {
  const [viewingFile, setViewingFile] = useState<string | null>(null);
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [treeWidth, setTreeWidth] = useState(() => {
    const saved = localStorage.getItem(TREE_WIDTH_KEY);
    return saved ? parseInt(saved, 10) : DEFAULT_TREE_WIDTH;
  });
  const [isResizing, setIsResizing] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();

  // Reset file selection when project changes
  useEffect(() => {
    setViewingFile(null);
    setSelectedPath(null);
  }, [projectPath]);

  const handleRefresh = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['tree'] });
  }, [queryClient]);

  const handleTreeSelect = useCallback((entry: TreeEntry) => {
    setSelectedPath(entry.path);
    if (!entry.is_dir) {
      setViewingFile(entry.path);
    }
  }, []);

  // Resize handler
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);

    const startX = e.clientX;
    const startWidth = treeWidth;

    const handleMouseMove = (e: MouseEvent) => {
      const delta = e.clientX - startX;
      const newWidth = Math.min(MAX_TREE_WIDTH, Math.max(MIN_TREE_WIDTH, startWidth + delta));
      setTreeWidth(newWidth);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      // Persist
      const el = document.querySelector('.files-tree-panel') as HTMLElement;
      if (el) {
        localStorage.setItem(TREE_WIDTH_KEY, String(el.offsetWidth));
      }
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, [treeWidth]);

  if (!projectPath) {
    return (
      <div className="empty-state">
        <p>Select a project to browse files</p>
      </div>
    );
  }

  return (
    <div className="files-split-pane" ref={containerRef}>
      <div className="files-tree-panel" style={{ width: treeWidth }}>
        <div className="files-tree-header">
          <span className="files-tree-title">Files</span>
          <button
            className="btn-icon"
            onClick={handleRefresh}
            title="Refresh file tree"
          >
            <RefreshCw size={14} />
          </button>
        </div>
        <div className="files-tree-body">
          <FileTree
            rootPath={projectPath}
            showFiles={true}
            selectedPath={selectedPath}
            onSelect={handleTreeSelect}
          />
        </div>
      </div>

      <div
        className={`resize-handle resize-handle-files ${isResizing ? 'resizing' : ''}`}
        onMouseDown={handleMouseDown}
      />

      <div className="file-viewer-container">
        <FileViewerPanel
          path={viewingFile}
          onClose={() => setViewingFile(null)}
        />
      </div>
    </div>
  );
}
