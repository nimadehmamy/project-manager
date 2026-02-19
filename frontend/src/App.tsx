import { useState, useCallback } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Home } from 'lucide-react';
import { ProjectBrowser } from './components/project-browser/ProjectBrowser';
import { TabBar } from './components/layout/TabBar';
import { ResizeHandle } from './components/layout/ResizeHandle';
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

// Persistent tab wrapper - renders all tabs but only shows active one
// Uses visibility instead of display to maintain layout calculations
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
      
      {/* Chat Tab - fully persistent */}
      <div 
        className={`tab-panel tab-chat ${activeTab === 'chat' ? 'tab-active' : 'tab-hidden'}`}
      >
        <ChatTab 
          projectPath={selectedProject}
          projectName={projectName}
        />
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
  const [selectedProject, setSelectedProject] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabType>('progress');
  const [projectName, setProjectName] = useState<string>('');
  
  // Sidebar width with localStorage persistence
  const [leftWidth, setLeftWidth] = useState(() => {
    const saved = localStorage.getItem('pm-left-sidebar-width');
    return saved ? parseInt(saved, 10) : DEFAULT_LEFT_WIDTH;
  });

  const handleLeftResize = useCallback((delta: number) => {
    setLeftWidth(prev => {
      const newWidth = Math.max(MIN_SIDEBAR_WIDTH, Math.min(MAX_SIDEBAR_WIDTH, prev + delta));
      localStorage.setItem('pm-left-sidebar-width', newWidth.toString());
      return newWidth;
    });
  }, []);

  const handleProjectSelect = (path: string, name: string) => {
    setSelectedProject(path);
    setProjectName(name);
    setActiveTab('progress');
  };

  return (
    <div className="dashboard" style={{
      gridTemplateColumns: `${leftWidth}px 4px 1fr`
    }}>
      <aside className="sidebar-left">
        <div className="panel-header">
          <h3>Projects</h3>
          <button 
            className="home-icon-btn"
            onClick={() => setActiveTab('home')}
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

      <main className="main-content">
        <TabBar activeTab={activeTab} onTabChange={setActiveTab} />
        
        <div className="tab-content-container">
          <PersistentTabs 
            activeTab={activeTab}
            selectedProject={selectedProject}
            projectName={projectName}
            onProjectSelect={handleProjectSelect}
          />
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
