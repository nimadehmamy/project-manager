import { useState, useEffect } from 'react';
import { Folder, File, ChevronRight, Download, Eye, RefreshCw } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { useFiles } from '../../hooks/useProjects';
import { FileViewerModal } from './FileViewerModal';
import type { FileEntry } from '../../types';

interface FilesTabProps {
  projectPath: string | null;
}

export function FilesTab({ projectPath }: FilesTabProps) {
  const [currentPath, setCurrentPath] = useState(projectPath);
  const [viewingFile, setViewingFile] = useState<string | null>(null);
  const { data, isLoading, refetch } = useFiles(currentPath);
  const queryClient = useQueryClient();

  // Update currentPath when projectPath changes (for persistent tabs)
  useEffect(() => {
    if (projectPath && projectPath !== currentPath) {
      setCurrentPath(projectPath);
    }
  }, [projectPath]);

  const handleRefresh = () => {
    // Invalidate and refetch files for current path
    queryClient.invalidateQueries({ queryKey: ['files', currentPath] });
    refetch();
  };

  const handleFileClick = (entry: FileEntry) => {
    if (entry.is_dir) {
      setCurrentPath(entry.path);
    } else {
      // Open in modal
      setViewingFile(entry.path);
    }
  };

  const handleDownload = (e: React.MouseEvent, entry: FileEntry) => {
    e.stopPropagation();
    window.open(`/api/file?path=${encodeURIComponent(entry.path)}&download=true`, '_blank');
  };

  const handleBreadcrumbClick = (path: string) => {
    setCurrentPath(path);
  };

  if (!projectPath) {
    return (
      <div className="empty-state">
        <p>Select a project to browse files</p>
      </div>
    );
  }

  if (isLoading) {
    return <div className="loading">Loading files...</div>;
  }

  const pathParts = currentPath?.split('/').filter(Boolean) || [];

  return (
    <>
      <div className="file-browser">
        <div className="breadcrumb">
          <button onClick={() => handleBreadcrumbClick('/')}>Home</button>
          {pathParts.map((part, index) => {
            const path = '/' + pathParts.slice(0, index + 1).join('/');
            return (
              <span key={index}>
                <ChevronRight size={14} />
                <button onClick={() => handleBreadcrumbClick(path)}>{part}</button>
              </span>
            );
          })}
          <button 
            className="refresh-btn" 
            onClick={handleRefresh} 
            title="Refresh file list"
            disabled={isLoading}
          >
            <RefreshCw size={16} className={isLoading ? 'spinning' : ''} />
          </button>
        </div>

        <div className="file-list">
          <div className="file-list-header">
            <span>Name</span>
            <span>Size</span>
            <span>Modified</span>
            <span>Actions</span>
          </div>

          {data?.parent !== undefined && (
            <div
              className="file-item"
              onClick={() => handleBreadcrumbClick(data.parent || '/')}
            >
              <span className="file-name">
                <Folder size={18} />
                ..
              </span>
              <span>-</span>
              <span>-</span>
              <span></span>
            </div>
          )}

          {data?.entries.map((entry) => (
            <div
              key={entry.path}
              className="file-item"
              onClick={() => handleFileClick(entry)}
            >
              <span className="file-name">
                {entry.is_dir ? <Folder size={18} /> : <File size={18} />}
                {entry.name}
              </span>
              <span>{entry.size ? formatFileSize(entry.size) : '-'}</span>
              <span>{entry.modified}</span>
              <span className="file-actions">
                {!entry.is_dir && (
                  <>
                    <button
                      className="file-action"
                      onClick={(e) => {
                        e.stopPropagation();
                        setViewingFile(entry.path);
                      }}
                      title="View"
                    >
                      <Eye size={16} />
                    </button>
                    <button
                      className="file-action"
                      onClick={(e) => handleDownload(e, entry)}
                      title="Download"
                    >
                      <Download size={16} />
                    </button>
                  </>
                )}
              </span>
            </div>
          ))}
        </div>
      </div>

      <FileViewerModal 
        path={viewingFile} 
        onClose={() => setViewingFile(null)} 
      />
    </>
  );
}

function formatFileSize(bytes: number): string {
  const units = ['B', 'KB', 'MB', 'GB'];
  let size = bytes;
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }

  return `${size.toFixed(1)} ${units[unitIndex]}`;
}
