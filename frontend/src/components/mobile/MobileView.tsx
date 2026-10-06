import { useState, useEffect, useCallback } from 'react';
import { FileTree } from '../common/FileTree';
import { ZellijTerminal } from '../zellij/ZellijTerminal';
import { api } from '../../api/client';
import type { TreeEntry } from '../../hooks/useProjects';
import { Home, ArrowLeft, Terminal, Monitor, Plus, Loader2 } from 'lucide-react';

interface ZellijSession {
  name: string;
  is_active: boolean;
  attached_clients: number;
  created_at: string;
  project_path?: string;
  agent_type?: string;
}

export function MobileView() {
  const [view, setView] = useState<'browse' | 'terminal'>('browse');
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [selectedName, setSelectedName] = useState<string>('');
  const [autoConnect, setAutoConnect] = useState<'new' | string | undefined>();
  const [sessions, setSessions] = useState<ZellijSession[]>([]);
  const [projectSession, setProjectSession] = useState<ZellijSession | null>(null);
  const [zellijAvailable, setZellijAvailable] = useState<boolean | null>(null);
  const [creating, setCreating] = useState(false);

  // Check zellij status
  useEffect(() => {
    const check = async () => {
      try {
        const status = await api.getZellijStatus();
        setZellijAvailable(status.available);
      } catch {
        setZellijAvailable(false);
      }
    };
    check();
    const interval = setInterval(check, 30_000);
    return () => clearInterval(interval);
  }, []);

  // Load sessions when selected path changes
  useEffect(() => {
    if (!selectedPath || !zellijAvailable) {
      setSessions([]);
      setProjectSession(null);
      return;
    }

    const load = async () => {
      try {
        const data = await api.getZellijSessions();
        const list = (data.sessions || []) as ZellijSession[];
        setSessions(list.sort((a, b) => a.name.localeCompare(b.name)));
      } catch {
        setSessions([]);
      }

      try {
        const data = await api.getProjectZellijSession(selectedPath);
        setProjectSession(data.found ? (data.session as ZellijSession) : null);
      } catch {
        setProjectSession(null);
      }
    };
    load();
  }, [selectedPath, zellijAvailable]);

  const handleSelect = useCallback((entry: TreeEntry) => {
    if (entry.is_dir) {
      setSelectedPath(entry.path);
      setSelectedName(entry.name);
    }
  }, []);

  const handleHome = useCallback(() => {
    setSelectedPath(null);
    setSelectedName('');
  }, []);

  const openTerminal = useCallback(() => {
    setAutoConnect('new');
    setView('terminal');
  }, []);

  const connectToSession = useCallback((sessionName: string) => {
    setAutoConnect(sessionName);
    setView('terminal');
  }, []);

  const createAgent = useCallback(async () => {
    if (!selectedPath) return;
    setCreating(true);
    try {
      const result = await api.createZellijSession(selectedPath, 'claude');
      if (result.session_name) {
        setAutoConnect(result.session_name);
        setView('terminal');
      }
    } catch {
      // error handled by ZellijTerminal
    } finally {
      setCreating(false);
    }
  }, [selectedPath]);

  const handleBack = useCallback(() => {
    setAutoConnect(undefined);
    setView('browse');
  }, []);

  return (
    <div className="mobile-view">
      {/* Browse Screen */}
      <div
        className="mobile-browse-screen"
        style={{ display: view === 'browse' ? 'flex' : 'none' }}
      >
        <div className="mobile-browse-header">
          <h2>Projects</h2>
          {selectedPath && (
            <button className="mobile-home-btn" onClick={handleHome} title="Reset selection">
              <Home size={18} />
            </button>
          )}
        </div>

        <div className="mobile-browse-tree">
          <FileTree
            rootPath="/"
            showFiles={false}
            selectedPath={selectedPath}
            onSelect={handleSelect}
          />
        </div>

        {selectedPath && (
          <div className="mobile-action-bar">
            <div className="mobile-action-main">
              <button
                className="mobile-action-btn mobile-action-primary"
                onClick={openTerminal}
                disabled={!zellijAvailable}
              >
                <Terminal size={16} />
                New Terminal
              </button>

              {projectSession ? (
                <button
                  className="mobile-action-btn mobile-action-secondary"
                  onClick={() => connectToSession(projectSession.name)}
                  disabled={!zellijAvailable}
                >
                  <Monitor size={16} />
                  {projectSession.name}
                </button>
              ) : (
                <button
                  className="mobile-action-btn mobile-action-secondary"
                  onClick={createAgent}
                  disabled={!zellijAvailable || creating}
                >
                  {creating ? <Loader2 size={16} className="spin" /> : <Plus size={16} />}
                  AI Agent
                </button>
              )}
            </div>

            {sessions.length > 0 && (
              <div className="mobile-session-list">
                {sessions.map((session) => (
                  <button
                    key={session.name}
                    className="mobile-session-chip"
                    onClick={() => connectToSession(session.name)}
                    disabled={!zellijAvailable}
                  >
                    <Monitor size={12} />
                    <span>{session.name}</span>
                    {session.agent_type && (
                      <span className="mobile-session-tag">{session.agent_type}</span>
                    )}
                    {session.is_active && <span className="mobile-session-dot" />}
                  </button>
                ))}
              </div>
            )}

            {zellijAvailable === false && (
              <div className="mobile-action-hint">
                Terminal service unavailable
              </div>
            )}
          </div>
        )}
      </div>

      {/* Terminal Screen */}
      <div
        className="mobile-terminal-screen"
        style={{ display: view === 'terminal' ? 'flex' : 'none' }}
      >
        <div className="mobile-terminal-header">
          <button className="mobile-back-btn" onClick={handleBack}>
            <ArrowLeft size={18} />
            <span>Back</span>
          </button>
          <span className="mobile-terminal-title">{selectedName || 'Terminal'}</span>
        </div>
        <div className="mobile-terminal-body">
          <ZellijTerminal
            projectPath={selectedPath}
            focused={view === 'terminal'}
            autoConnect={autoConnect}
            onBack={handleBack}
          />
        </div>
      </div>
    </div>
  );
}
