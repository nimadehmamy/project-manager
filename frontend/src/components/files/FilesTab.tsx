import { useState } from 'react';
import { Folder, File, ChevronRight, Download } from 'lucide-react';
import { useFiles } from '../../hooks/useProjects';
import type { FileEntry } from '../../types';

interface FilesTabProps {
  projectPath: string | null;
}

export function FilesTab({ projectPath }: FilesTabProps) {
  const [currentPath, setCurrentPath] = useState(projectPath);
  const { data, isLoading } = useFiles(currentPath);

  const handleFileClick = (entry: FileEntry) => {
    if (entry.is_dir) {
      setCurrentPath(entry.path);
    } else {
      // Preview file (could open modal)
      window.open(`/api/file?path=${encodeURIComponent(entry.path)}`, '_blank');
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
      </div>

      <div className="file-list">
        <div className="file-list-header">
          <span>Name</span>
          <span>Size</span>
          <span>Modified</span>
          <span></span>
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
            <span>
              {!entry.is_dir && (
                <button
                  className="file-action"
                  onClick={(e) => handleDownload(e, entry)}
                  title="Download"
                >
                  <Download size={16} />
                </button>
              )}
            </span>
          </div>
        ))}
      </div>
    </div>
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
