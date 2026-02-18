import { useState, useCallback } from 'react';
import { ChevronRight, ChevronDown, Folder, FolderOpen } from 'lucide-react';
import { useProjects } from '../../hooks/useProjects';
import type { Project } from '../../types';

interface ProjectTreeItemProps {
  project: Project;
  selectedProject: string | null;
  onSelect: (path: string, name: string) => void;
  depth?: number;
}

function ProjectTreeItem({ project, selectedProject, onSelect, depth = 0 }: ProjectTreeItemProps) {
  const [expanded, setExpanded] = useState(false);
  const isSelected = selectedProject === project.path;
  const hasChildren = project.has_children;
  
  const { data: children, isLoading } = useProjects(expanded ? project.path : null);

  const handleClick = () => {
    onSelect(project.path, project.name);
  };

  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (hasChildren) {
      setExpanded(!expanded);
    }
  };

  return (
    <div className="tree-item">
      <div
        className={`tree-content ${isSelected ? 'selected' : ''}`}
        style={{ paddingLeft: `${8 + depth * 12}px` }}
        onClick={handleClick}
      >
        <span 
          className={`tree-toggle ${hasChildren ? (expanded ? 'expanded' : 'collapsed') : 'leaf'}`}
          onClick={handleToggle}
        >
          {hasChildren && (expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />)}
        </span>
        
        <span className="tree-icon">
          {isSelected || expanded ? <FolderOpen size={18} /> : <Folder size={18} />}
        </span>
        
        <div className="tree-info">
          <div className="tree-label">{project.name}</div>
          <div className="tree-meta">
            <span className="tree-date">{project.modified}</span>
            <div className="tree-indicators">
              {project.has_readme && <span className="indicator has-readme">R</span>}
              {project.has_todo && <span className="indicator has-todo">T</span>}
            </div>
          </div>
        </div>
      </div>

      {expanded && hasChildren && (
        <div className="tree-children">
          {isLoading ? (
            <div className="loading-children">Loading...</div>
          ) : (
            children?.map((child) => (
              <ProjectTreeItem
                key={child.path}
                project={child}
                selectedProject={selectedProject}
                onSelect={onSelect}
                depth={depth + 1}
              />
            ))
          )}
        </div>
      )}
    </div>
  );
}

interface ProjectBrowserProps {
  selectedProject: string | null;
  onSelect: (path: string, name: string) => void;
}

export function ProjectBrowser({ selectedProject, onSelect }: ProjectBrowserProps) {
  const { data: projects, isLoading, error } = useProjects('/');

  if (isLoading) {
    return <div className="loading">Loading projects...</div>;
  }

  if (error) {
    return <div className="error">Failed to load projects</div>;
  }

  if (!projects || projects.length === 0) {
    return <div className="empty">No projects found</div>;
  }

  return (
    <div className="project-list">
      {projects.map((project) => (
        <ProjectTreeItem
          key={project.path}
          project={project}
          selectedProject={selectedProject}
          onSelect={onSelect}
        />
      ))}
    </div>
  );
}
