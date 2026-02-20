import { useCallback, useEffect, useRef, useState } from 'react';
import { Terminal } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import { WebLinksAddon } from 'xterm-addon-web-links';
import { io, Socket } from 'socket.io-client';
import 'xterm/css/xterm.css';
import { api } from '../../api/client';
import { useSocket } from '../../contexts/SocketContext';
import { Monitor, Link2, Unlink, Plus, AlertCircle, Terminal as TerminalIcon, FolderOpen } from 'lucide-react';

interface ZellijTerminalProps {
  projectPath: string | null;
  projectName: string;
}

interface ZellijSession {
  name: string;
  is_active: boolean;
  attached_clients: number;
  created_at: string;
  project_path?: string;
  agent_type?: string;
}

// Terminal service URL
const TERMINAL_SERVICE_URL = import.meta.env.VITE_TERMINAL_URL ||
  `${window.location.protocol}//${window.location.hostname}:3001`;

const NERD_FONT_FAMILY = '"JetBrains Mono NF", "JetBrains Mono", "Fira Code", monospace';

/** Wait for the Nerd Font to be loaded before creating the terminal */
async function waitForFont(): Promise<void> {
  try {
    await document.fonts.load(`14px "JetBrains Mono NF"`);
    await document.fonts.ready;
  } catch {
    // Fallback — continue without the Nerd Font
  }
}

export function ZellijTerminal({ projectPath, projectName }: ZellijTerminalProps) {
  const terminalRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const socketRef = useRef<Socket | null>(null);
  const inputHandlerRef = useRef<{ dispose: () => void } | null>(null);

  const [zellijAvailable, setZellijAvailable] = useState<boolean | null>(null);
  const [sessions, setSessions] = useState<ZellijSession[]>([]);
  const [projectSession, setProjectSession] = useState<ZellijSession | null>(null);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [terminalReady, setTerminalReady] = useState(false);

  const { socket: appSocket } = useSocket();

  // Callback ref to know when terminal container is mounted
  const setTerminalContainer = useCallback((el: HTMLDivElement | null) => {
    terminalRef.current = el;
    if (el && !xtermRef.current) {
      setTerminalReady(true);
    }
  }, []);

  // Sort sessions by name for stable ordering
  const sortSessions = (list: ZellijSession[]) =>
    [...list].sort((a, b) => a.name.localeCompare(b.name));

  // Check Zellij status — 30s poll instead of 5s
  useEffect(() => {
    const checkStatus = async () => {
      try {
        const status = await api.getZellijStatus();
        setZellijAvailable(status.available);
        if (status.available) loadSessions();
      } catch {
        setZellijAvailable(false);
      }
    };
    checkStatus();
    const interval = setInterval(checkStatus, 30_000);
    return () => clearInterval(interval);
  }, []);

  // Listen for real-time session change events from backend
  useEffect(() => {
    if (!appSocket) return;
    const handleSessionsChanged = () => {
      loadSessions();
      if (projectPath) loadProjectSession();
    };
    appSocket.on('zellij_sessions_changed', handleSessionsChanged);
    return () => { appSocket.off('zellij_sessions_changed', handleSessionsChanged); };
  }, [appSocket, projectPath]);

  // Load project session
  useEffect(() => {
    if (projectPath && zellijAvailable) {
      loadProjectSession();
      disconnect();
    }
  }, [projectPath, zellijAvailable]);

  const loadSessions = async () => {
    try {
      const data = await api.getZellijSessions();
      setSessions(sortSessions(data.sessions || []));
    } catch {
      console.error('Failed to load sessions');
    }
  };

  const loadProjectSession = async () => {
    if (!projectPath) return;
    try {
      const data = await api.getProjectZellijSession(projectPath);
      setProjectSession(data.found ? data.session : null);
    } catch {
      setProjectSession(null);
    }
  };

  // Initialize terminal when container is ready — wait for font first
  useEffect(() => {
    if (!terminalReady || !terminalRef.current) return;
    if (xtermRef.current) return;

    let cancelled = false;

    (async () => {
      await waitForFont();
      if (cancelled || !terminalRef.current) return;

      const term = new Terminal({
        cursorBlink: true,
        fontSize: 14,
        fontFamily: NERD_FONT_FAMILY,
        theme: {
          background: '#1e1e1e',
          foreground: '#d4d4d4',
          cursor: '#d4d4d4',
          selectionBackground: '#264f78',
        },
        allowProposedApi: true,
      });

      const fitAddon = new FitAddon();
      term.loadAddon(fitAddon);
      term.loadAddon(new WebLinksAddon());
      term.open(terminalRef.current);

      setTimeout(() => {
        fitAddon.fit();
        term.write('\r\n[Terminal initialized]\r\n');
      }, 100);

      xtermRef.current = term;
      fitAddonRef.current = fitAddon;
    })();

    const handleResize = () => {
      fitAddonRef.current?.fit();
      if (socketRef.current?.connected && xtermRef.current) {
        socketRef.current.emit('resize', {
          cols: xtermRef.current.cols,
          rows: xtermRef.current.rows
        });
      }
    };
    window.addEventListener('resize', handleResize);

    // Suppress browser shortcuts when terminal is focused
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('.xterm-container')) return;

      const suppressKeys = [
        'KeyT', 'KeyW', 'KeyN', 'KeyR', 'KeyP', 'KeyF', 'KeyG', 'KeyH', 'KeyJ',
        'Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5',
        'Digit6', 'Digit7', 'Digit8', 'Digit9', 'Digit0', 'Tab',
      ];
      if (e.ctrlKey && suppressKeys.includes(e.code)) {
        e.preventDefault();
        return false;
      }
      if (e.altKey) {
        e.preventDefault();
        return false;
      }
    };
    document.addEventListener('keydown', handleKeyDown, true);

    return () => {
      cancelled = true;
      window.removeEventListener('resize', handleResize);
      document.removeEventListener('keydown', handleKeyDown, true);
    };
  }, [terminalReady]);

  const connectToTerminalService = (event: string, data: object) => {
    if (!projectPath) {
      setError('No project selected');
      return;
    }

    setLoading(true);
    setError(null);

    disconnect();

    const socket = io(TERMINAL_SERVICE_URL, {
      path: '/terminal-socket',
      transports: ['websocket'],
      reconnection: false,
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      socket.emit(event, data);
    });

    socket.on('ready', () => {
      setConnected(true);
      setLoading(false);

      if (inputHandlerRef.current) {
        inputHandlerRef.current.dispose();
      }

      if (xtermRef.current) {
        socket.emit('resize', {
          cols: xtermRef.current.cols,
          rows: xtermRef.current.rows
        });

        inputHandlerRef.current = xtermRef.current.onData((inputData) => {
          if (socket.connected) {
            socket.emit('input', inputData);
          }
        });

        xtermRef.current.focus();
      }
    });

    socket.on('output', (data) => {
      if (xtermRef.current) {
        xtermRef.current.write(data);
      }
    });

    socket.on('error', (data) => {
      setError(data.message);
      setLoading(false);
    });

    socket.on('exit', () => {
      setConnected(false);
    });

    socket.on('disconnect', () => {
      setConnected(false);
    });

    socket.on('connect_error', (err) => {
      setError(`Cannot connect to terminal service: ${err.message}`);
      setLoading(false);
    });
  };

  const openNewTerminal = () => {
    connectToTerminalService('new_terminal', { path: projectPath });
  };

  const connectToSession = (sessionName: string) => {
    connectToTerminalService('attach_zellij', {
      path: projectPath,
      session: sessionName
    });
  };

  const disconnect = () => {
    if (inputHandlerRef.current) {
      inputHandlerRef.current.dispose();
      inputHandlerRef.current = null;
    }
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
    }
    setConnected(false);
  };

  const createSession = async (agentType: string = 'claude') => {
    if (!projectPath) {
      setError('No project selected');
      return;
    }
    setLoading(true);
    try {
      const result = await api.createZellijSession(projectPath, agentType);
      await loadSessions();
      await loadProjectSession();
      // Auto-connect to the newly created session
      if (result.session_name) {
        connectToSession(result.session_name);
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to create session');
      setLoading(false);
    }
  };

  if (zellijAvailable === null) {
    return <div className="zellij-loading">Checking Zellij...</div>;
  }

  return (
    <div className="zellij-terminal">
      <div className="zellij-toolbar">
        <div className="zellij-session-info">
          {projectSession ? (
            <>
              <span className="session-badge active">
                <Monitor size={14} />
                {projectSession.name}
              </span>
              {projectSession.agent_type && (
                <span className="agent-badge">{projectSession.agent_type}</span>
              )}
            </>
          ) : (
            <span className="no-session">No zellij session for {projectName}</span>
          )}
        </div>

        <div className="zellij-actions">
          <button
            className="btn btn-sm btn-secondary"
            onClick={openNewTerminal}
            disabled={loading || !projectPath || connected}
          >
            <FolderOpen size={14} />
            New Terminal
          </button>

          {projectSession && !connected && (
            <button
              className="btn btn-sm btn-primary"
              onClick={() => connectToSession(projectSession.name)}
              disabled={loading}
            >
              <Link2 size={14} />
              Connect Zellij
            </button>
          )}

          {connected && (
            <button className="btn btn-sm" onClick={disconnect}>
              <Unlink size={14} />
              Disconnect
            </button>
          )}

          {!projectSession && (
            <button
              className="btn btn-sm btn-primary"
              onClick={() => createSession('claude')}
              disabled={loading || !projectPath}
            >
              <Plus size={14} />
              Create Session
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="zellij-error">
          <AlertCircle size={16} />
          {error}
        </div>
      )}

      <div className="zellij-terminal-container">
        <div ref={setTerminalContainer} className="xterm-container" />

        {!connected && !loading && (
          <div className="zellij-overlay">
            <div className="zellij-setup">
              <p>Connect to an AI agent or open a terminal</p>
              <div className="zellij-buttons">
                <button
                  className="btn btn-primary"
                  onClick={openNewTerminal}
                  disabled={!projectPath}
                >
                  <TerminalIcon size={16} />
                  New Terminal
                </button>

                {projectSession ? (
                  <button
                    className="btn btn-secondary"
                    onClick={() => connectToSession(projectSession.name)}
                  >
                    <Link2 size={16} />
                    Connect to {projectSession.name}
                  </button>
                ) : (
                  <button
                    className="btn btn-secondary"
                    onClick={() => createSession('claude')}
                    disabled={!projectPath}
                  >
                    <Plus size={16} />
                    Create AI Agent Session
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {loading && (
          <div className="zellij-overlay">
            <div className="loading-spinner">Connecting...</div>
          </div>
        )}
      </div>

      {sessions.length > 0 && (
        <div className="zellij-sessions-list">
          <h4>All Zellij Sessions</h4>
          <div className="sessions-grid">
            {sessions.map((session) => (
              <button
                key={session.name}
                className={`session-item ${session.name === projectSession?.name ? 'active' : ''}`}
                onClick={() => connectToSession(session.name)}
              >
                <Monitor size={14} />
                <span className="session-name">{session.name}</span>
                {session.agent_type && <span className="agent-tag">{session.agent_type}</span>}
                {session.is_active && <span className="status-dot" />}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
