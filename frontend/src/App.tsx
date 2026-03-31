import { useState, useCallback, useEffect, useRef } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Home, Terminal } from 'lucide-react';
import { ProjectBrowser } from './components/project-browser/ProjectBrowser';
import { TabBar } from './components/layout/TabBar';
import { ResizeHandle } from './components/layout/ResizeHandle';
import { CollapseTag } from './components/layout/CollapseTag';
import { HomeTab } from './components/home/HomeTab';
import { SummaryTab } from './components/project-browser/SummaryTab';
import { TodosTab } from './components/project-browser/TodosTab';
import { ProgressTab } from './components/progress/ProgressTab';
import { FilesTab } from './components/files/FilesTab';
import { ProfilePage } from './components/profile/ProfilePage';
import { ChatTab } from './components/chat/ChatTab';
import type { TabType } from './types';

const MIN_SIDEBAR_WIDTH = 200;
const MAX_SIDEBAR_WIDTH = 600;
const DEFAULT_LEFT_WIDTH = 280;
const MIN_BOTTOM_HEIGHT = 100;
const DEFAULT_BOTTOM_HEIGHT = 300;

// Persistent tab wrapper - renders all tabs but only shows active one
function PersistentTabs({
  activeTab,
  selectedProject,
  projectName,
  onProjectSelect
}: {
  activeTab: TabType;
  selectedProject: string | null;
  projectName: string;
  onProjectSelect: (path: string, name: string) => void;
}) {
  return (
    <>
      {/* Home Tab */}
      <div
        className={`tab-panel ${activeTab === 'home' ? 'tab-active' : 'tab-hidden'}`}
      >
        <HomeTab onProjectSelect={onProjectSelect} />
      </div>

      {/* Summary Tab */}
      <div
        className={`tab-panel ${activeTab === 'summary' ? 'tab-active' : 'tab-hidden'}`}
      >
        <SummaryTab projectPath={selectedProject} />
      </div>

      {/* Todos Tab */}
      <div
        className={`tab-panel ${activeTab === 'todos' ? 'tab-active' : 'tab-hidden'}`}
      >
        <TodosTab projectPath={selectedProject} />
      </div>

      {/* Progress Tab */}
      <div
        className={`tab-panel ${activeTab === 'progress' ? 'tab-active' : 'tab-hidden'}`}
      >
        <ProgressTab
          projectPath={selectedProject}
          projectName={projectName}
        />
      </div>

      {/* Files Tab */}
      <div
        className={`tab-panel ${activeTab === 'files' ? 'tab-active' : 'tab-hidden'}`}
      >
        <FilesTab projectPath={selectedProject} />
      </div>

      {/* Profile Tab */}
      <div
        className={`tab-panel ${activeTab === 'profile' ? 'tab-active' : 'tab-hidden'}`}
      >
        <ProfilePage />
      </div>
    </>
  );
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30000,
      retry: 1,
    },
  },
});

function AppContent() {
  // URL handling - parse project from URL hash
  const getProjectFromUrl = () => {
    const hash = window.location.hash.slice(1); // Remove #
    if (hash.startsWith('project/')) {
      return decodeURIComponent(hash.slice(8)); // Remove 'project/'
    }
    return null;
  };

  const urlProject = getProjectFromUrl();
  const [selectedProject, setSelectedProject] = useState<string | null>(urlProject);
  const [activeTab, setActiveTab] = useState<TabType>(urlProject ? 'progress' : 'home');
  const [projectName, setProjectName] = useState<string>('');

  // Sidebar width with localStorage persistence
  const [leftWidth, setLeftWidth] = useState(() => {
    const saved = localStorage.getItem('pm-left-sidebar-width');
    return saved ? parseInt(saved, 10) : DEFAULT_LEFT_WIDTH;
  });

  // Sidebar collapsed state
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    return localStorage.getItem('pm-sidebar-collapsed') === 'true';
  });

  // Bottom panel state
  const [bottomOpen, setBottomOpen] = useState(() => {
    return localStorage.getItem('pm-bottom-open') === 'true';
  });
  const [bottomHeight, setBottomHeight] = useState(() => {
    const saved = localStorage.getItem('pm-bottom-height');
    return saved ? parseInt(saved, 10) : DEFAULT_BOTTOM_HEIGHT;
  });
  const [bottomMaximized, setBottomMaximized] = useState(false);
  const bottomResizing = useRef(false);
  const mainRef = useRef<HTMLElement>(null);

  // Handle URL changes
  useEffect(() => {
    const handleHashChange = () => {
      const project = getProjectFromUrl();
      if (project !== selectedProject) {
        setSelectedProject(project);
        if (project) {
          setActiveTab('progress');
        }
      }
    };

    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, [selectedProject]);

  const handleLeftResize = useCallback((delta: number) => {
    setLeftWidth(prev => {
      const newWidth = Math.max(MIN_SIDEBAR_WIDTH, Math.min(MAX_SIDEBAR_WIDTH, prev + delta));
      localStorage.setItem('pm-left-sidebar-width', newWidth.toString());
      return newWidth;
    });
  }, []);

  const toggleSidebar = useCallback(() => {
    setSidebarCollapsed(prev => {
      const next = !prev;
      localStorage.setItem('pm-sidebar-collapsed', String(next));
      return next;
    });
  }, []);

  const toggleBottom = useCallback((open: boolean) => {
    setBottomOpen(open);
    localStorage.setItem('pm-bottom-open', String(open));
    if (!open) setBottomMaximized(false);
  }, []);

  const toggleBottomMaximize = useCallback(() => {
    setBottomMaximized(prev => !prev);
  }, []);

  const handleBottomResize = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    bottomResizing.current = true;
    setBottomMaximized(false);
    const startY = e.clientY;
    const startHeight = bottomHeight;
    // Reserve space for tab bar (~45px) + resize handle (4px)
    const maxHeight = mainRef.current ? mainRef.current.clientHeight - 49 : 9999;

    const onMouseMove = (ev: MouseEvent) => {
      const delta = startY - ev.clientY;
      const newHeight = Math.max(MIN_BOTTOM_HEIGHT, Math.min(maxHeight, startHeight + delta));
      setBottomHeight(newHeight);
    };

    const onMouseUp = () => {
      bottomResizing.current = false;
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      setBottomHeight(h => {
        localStorage.setItem('pm-bottom-height', String(h));
        return h;
      });
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  }, [bottomHeight]);

  const handleProjectSelect = (path: string, name: string) => {
    setSelectedProject(path);
    setProjectName(name);
    setActiveTab('progress');
    // Update URL
    window.location.hash = `project/${encodeURIComponent(path)}`;
  };

  const handleHomeSelect = () => {
    setActiveTab('home');
    setSelectedProject(null);
    window.location.hash = '';
  };

  return (
    <div className="dashboard" style={{
      gridTemplateColumns: sidebarCollapsed
        ? '0px 0px 1fr'
        : `${leftWidth}px 4px 1fr`
    }}>
      {sidebarCollapsed ? (
        <>
          <div />
          <div />
        </>
      ) : (
        <>
          <aside className="sidebar-left">
            <div className="panel-header">
              <h3>Projects</h3>
              <button
                className="home-icon-btn"
                onClick={handleHomeSelect}
                title="Go to Home Dashboard"
              >
                <Home size={18} />
              </button>
            </div>
            <ProjectBrowser
              selectedProject={selectedProject}
              onSelect={handleProjectSelect}
            />
          </aside>
          <ResizeHandle side="left" onResize={handleLeftResize} />
        </>
      )}

      <main className="main-content" style={{ position: 'relative' }} ref={mainRef}>
        <CollapseTag
          collapsed={sidebarCollapsed}
          onToggle={toggleSidebar}
          side="left"
        />
        <TabBar activeTab={activeTab} onTabChange={setActiveTab} />

        <div className="main-upper" style={bottomOpen && bottomMaximized ? { display: 'none' } : undefined}>
          <div className="tab-content-container">
            <PersistentTabs
              activeTab={activeTab}
              selectedProject={selectedProject}
              projectName={projectName}
              onProjectSelect={handleProjectSelect}
            />
          </div>
        </div>

        {bottomOpen && !bottomMaximized && (
          <div className="resize-handle-bottom" onMouseDown={handleBottomResize} />
        )}

        <div
          className="bottom-panel"
          style={bottomOpen ? { height: bottomMaximized ? undefined : bottomHeight, flex: bottomMaximized ? 1 : undefined } : undefined}
        >
          {!bottomOpen && (
            <div className="bottom-panel-bar">
              <button onClick={() => toggleBottom(true)}>
                <Terminal size={14} />
                Terminal
              </button>
            </div>
          )}
          <div style={bottomOpen ? { display: 'flex', flexDirection: 'column', height: '100%' } : { display: 'none' }}>
            <ChatTab
              projectPath={selectedProject}
              projectName={projectName}
              onCollapse={() => toggleBottom(false)}
              maximized={bottomMaximized}
              onToggleMaximize={toggleBottomMaximize}
            />
          </div>
        </div>
      </main>
    </div>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AppContent />
    </QueryClientProvider>
  );
}

export default App;
