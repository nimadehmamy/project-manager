import { useState, useCallback } from 'react';
import { ChevronRight, ChevronDown, Folder, FolderOpen, File, FileText, FileCode, Image, FileSpreadsheet } from 'lucide-react';
import { useTreeNode, type TreeEntry } from '../../hooks/useProjects';

// File type icon mapping
const CODE_EXTS = new Set([
  'py', 'js', 'jsx', 'ts', 'tsx', 'rs', 'go', 'java', 'c', 'cpp', 'h', 'hpp',
  'cs', 'rb', 'php', 'swift', 'kt', 'scala', 'lua', 'r', 'sh', 'bash',
  'html', 'htm', 'css', 'scss', 'vue', 'svelte',
]);
const IMAGE_EXTS = new Set(['png', 'jpg', 'jpeg', 'gif', 'bmp', 'webp', 'svg', 'ico']);
const DATA_EXTS = new Set(['json', 'yaml', 'yml', 'toml', 'xml', 'csv', 'tsv']);

function getFileIcon(name: string, isDir: boolean, isOpen: boolean) {
  if (isDir) {
    return isOpen ? <FolderOpen size={16} /> : <Folder size={16} />;
  }
  const ext = name.split('.').pop()?.toLowerCase() || '';
  if (CODE_EXTS.has(ext)) return <FileCode size={16} />;
  if (IMAGE_EXTS.has(ext)) return <Image size={16} />;
  if (DATA_EXTS.has(ext)) return <FileSpreadsheet size={16} />;
  if (ext === 'md' || ext === 'txt' || ext === 'pdf') return <FileText size={16} />;
  return <File size={16} />;
}

interface FileTreeNodeProps {
  entry: TreeEntry;
  depth: number;
  showFiles: boolean;
  showHidden: boolean;
  selectedPath: string | null;
  onSelect: (entry: TreeEntry) => void;
}

function FileTreeNode({ entry, depth, showFiles, showHidden, selectedPath, onSelect }: FileTreeNodeProps) {
  const [expanded, setExpanded] = useState(false);
  const isSelected = selectedPath === entry.path;

  // Only fetch children when expanded
  const { data: children, isLoading } = useTreeNode(expanded ? entry.path : null, showHidden);

  const handleToggle = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    if (entry.is_dir) {
      setExpanded(prev => !prev);
    }
  }, [entry.is_dir]);

  const handleClick = useCallback(() => {
    if (entry.is_dir) {
      setExpanded(prev => !prev);
    }
    onSelect(entry);
  }, [entry, onSelect]);

  // Filter children based on showFiles prop
  const visibleChildren = children?.filter(c => showFiles || c.is_dir) || [];

  return (
    <div className="file-tree-node">
      <div
        className={`file-tree-row ${isSelected ? 'selected' : ''}`}
        style={{ paddingLeft: `${8 + depth * 16}px` }}
        onClick={handleClick}
      >
        <span className="file-tree-toggle" onClick={handleToggle}>
          {entry.is_dir && entry.has_children !== false ? (
            expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />
          ) : (
            <span style={{ width: 14, display: 'inline-block' }} />
          )}
        </span>
        <span className={`file-tree-icon ${entry.is_dir ? 'dir-icon' : 'file-icon'}`}>
          {getFileIcon(entry.name, entry.is_dir, expanded)}
        </span>
        <span className="file-tree-name" title={entry.name}>{entry.name}</span>
      </div>

      {expanded && entry.is_dir && (
        <div className="file-tree-children">
          {isLoading ? (
            <div className="file-tree-loading" style={{ paddingLeft: `${24 + depth * 16}px` }}>
              Loading...
            </div>
          ) : (
            visibleChildren.map(child => (
              <FileTreeNode
                key={child.path}
                entry={child}
                depth={depth + 1}
                showFiles={showFiles}
                showHidden={showHidden}
                selectedPath={selectedPath}
                onSelect={onSelect}
              />
            ))
          )}
        </div>
      )}
    </div>
  );
}

interface FileTreeProps {
  rootPath: string;
  showFiles?: boolean;
  showHidden?: boolean;
  selectedPath?: string | null;
  onSelect: (entry: TreeEntry) => void;
}

export function FileTree({ rootPath, showFiles = true, showHidden = false, selectedPath = null, onSelect }: FileTreeProps) {
  const { data: entries, isLoading, error } = useTreeNode(rootPath, showHidden);

  if (isLoading) {
    return <div className="file-tree-loading">Loading...</div>;
  }

  if (error) {
    return <div className="file-tree-error">Failed to load</div>;
  }

  const visibleEntries = entries?.filter(e => showFiles || e.is_dir) || [];

  if (visibleEntries.length === 0) {
    return <div className="file-tree-empty">No items</div>;
  }

  return (
    <div className="file-tree">
      {visibleEntries.map(entry => (
        <FileTreeNode
          key={entry.path}
          entry={entry}
          depth={0}
          showFiles={showFiles}
          showHidden={showHidden}
          selectedPath={selectedPath}
          onSelect={onSelect}
        />
      ))}
    </div>
  );
}
