import { useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ProjectBrowser } from './components/project-browser/ProjectBrowser';
import { TabBar } from './components/layout/TabBar';
import { SummaryTab } from './components/project-browser/SummaryTab';
import { TodosTab } from './components/project-browser/TodosTab';
import { ProgressTab } from './components/progress/ProgressTab';
import { FilesTab } from './components/files/FilesTab';
import { ChatPanel } from './components/chat/ChatPanel';
import type { TabType } from './types';

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
  const [activeTab, setActiveTab] = useState<TabType>('summary');
  const [projectName, setProjectName] = useState<string>('');

  const handleProjectSelect = (path: string, name: string) => {
    setSelectedProject(path);
    setProjectName(name);
    setActiveTab('summary');
  };

  return (
    <div className="dashboard">
      <aside className="sidebar-left">
        <div className="panel-header">
          <h3>Projects</h3>
        </div>
        <ProjectBrowser 
          selectedProject={selectedProject}
          onSelect={handleProjectSelect}
        />
      </aside>

      <main className="main-content">
        <TabBar activeTab={activeTab} onTabChange={setActiveTab} />
        
        <div className="tab-content-container">
          {activeTab === 'summary' && (
            <SummaryTab projectPath={selectedProject} />
          )}
          {activeTab === 'todos' && (
            <TodosTab projectPath={selectedProject} />
          )}
          {activeTab === 'progress' && (
            <ProgressTab 
              projectPath={selectedProject} 
              projectName={projectName}
            />
          )}
          {activeTab === 'files' && (
            <FilesTab projectPath={selectedProject} />
          )}
        </div>
      </main>

      <aside className="sidebar-right">
        <ChatPanel />
      </aside>
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
