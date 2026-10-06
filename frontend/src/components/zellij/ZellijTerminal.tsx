import { useCallback, useEffect, useRef, useState } from 'react';
import { Terminal } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import { WebLinksAddon } from 'xterm-addon-web-links';
import { io, Socket } from 'socket.io-client';
import 'xterm/css/xterm.css';
import { api } from '../../api/client';
import { useSocket } from '../../contexts/SocketContext';
import { useTheme } from '../../contexts/ThemeContext';
import { Monitor, Unlink, Plus, AlertCircle, Terminal as TerminalIcon, FolderOpen, ArrowLeft } from 'lucide-react';

interface ZellijTerminalProps {
  projectPath: string | null;
  focused?: boolean;
  autoConnect?: 'new' | string;
  onBack?: () => void;
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

const DARK_THEME = {
  background: '#1e1e1e',
  foreground: '#d4d4d4',
  cursor: '#d4d4d4',
  selectionBackground: '#264f78',
};

const LIGHT_THEME = {
  background: '#ffffff',
  foreground: '#24292f',
  cursor: '#24292f',
  selectionBackground: '#b6d6fd',
};

/** Wait for the Nerd Font to be loaded before creating the terminal */
async function waitForFont(): Promise<void> {
  try {
    await document.fonts.load(`14px "JetBrains Mono NF"`);
    await document.fonts.ready;
  } catch {
    // Fallback — continue without the Nerd Font
  }
}

export function ZellijTerminal({ projectPath, focused, autoConnect, onBack }: ZellijTerminalProps) {
  const terminalRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const socketRef = useRef<Socket | null>(null);
  const inputHandlerRef = useRef<{ dispose: () => void } | null>(null);

  const [zellijAvailable, setZellijAvailable] = useState<boolean | null>(null);
  const [sessions, setSessions] = useState<ZellijSession[]>([]);
  const [projectSession, setProjectSession] = useState<ZellijSession | null>(null);
  const [connected, setConnected] = useState(false);
  const [connectedSession, setConnectedSession] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [terminalReady, setTerminalReady] = useState(false);

  const { socket: appSocket } = useSocket();
  const { theme } = useTheme();

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
        theme: theme === 'dark' ? DARK_THEME : LIGHT_THEME,
        allowProposedApi: true,
        rightClickSelectsWord: true,
      });

      const fitAddon = new FitAddon();
      term.loadAddon(fitAddon);
      term.loadAddon(new WebLinksAddon((_, uri) => window.open(uri, '_blank')));
      term.open(terminalRef.current);

      // Clipboard: copy selection on Ctrl+Shift+C, paste on Ctrl+Shift+V
      term.attachCustomKeyEventHandler((e) => {
        if (e.type !== 'keydown') return true;
        // Ctrl+Shift+C → copy selection
        if (e.ctrlKey && e.shiftKey && e.code === 'KeyC') {
          const sel = term.getSelection();
          if (sel) navigator.clipboard.writeText(sel);
          return false;
        }
        // Ctrl+Shift+V → paste from clipboard
        if (e.ctrlKey && e.shiftKey && e.code === 'KeyV') {
          navigator.clipboard.readText().then(text => {
            if (socketRef.current?.connected) {
              socketRef.current.emit('input', text);
            }
          });
          return false;
        }
        return true;
      });

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

    // Suppress browser shortcuts when terminal is focused — only preventDefault,
    // NOT stopImmediatePropagation, so xterm.js still receives the keystroke.
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('.xterm-container')) return;

      // Allow Ctrl+Shift+C/V for clipboard (handled by xterm custom handler)
      if (e.ctrlKey && e.shiftKey && (e.code === 'KeyC' || e.code === 'KeyV')) return;

      // Block browser action for Ctrl+<key> combos that conflict
      if (e.ctrlKey && !e.shiftKey && !e.altKey) {
        e.preventDefault();
        return;
      }

      // Block browser action for all Alt combos (zellij uses Alt extensively)
      if (e.altKey) {
        e.preventDefault();
        return;
      }
    };
    document.addEventListener('keydown', handleKeyDown, true);

    return () => {
      cancelled = true;
      window.removeEventListener('resize', handleResize);
      document.removeEventListener('keydown', handleKeyDown, true);
    };
  }, [terminalReady]);

  // Update terminal theme when app theme changes
  useEffect(() => {
    if (xtermRef.current) {
      xtermRef.current.options.theme = theme === 'dark' ? DARK_THEME : LIGHT_THEME;
    }
  }, [theme]);

  // Focus terminal and refit when focused prop changes
  useEffect(() => {
    if (focused && xtermRef.current) {
      setTimeout(() => {
        fitAddonRef.current?.fit();
        xtermRef.current?.focus();
        if (socketRef.current?.connected && xtermRef.current) {
          socketRef.current.emit('resize', {
            cols: xtermRef.current.cols,
            rows: xtermRef.current.rows,
          });
        }
      }, 50);
    }
  }, [focused]);

  // Track connected state in a ref for auto-connect logic
  const connectedRef = useRef(connected);
  connectedRef.current = connected;

  // Auto-connect when autoConnect prop changes
  useEffect(() => {
    if (!autoConnect || !projectPath) return;

    const timer = setTimeout(() => {
      if (connectedRef.current) {
        // Already connected: disconnect first, then reconnect
        disconnect();
        setTimeout(() => {
          if (autoConnect === 'new') {
            openNewTerminal();
          } else {
            connectToSession(autoConnect);
          }
        }, 200);
      } else {
        if (autoConnect === 'new') {
          openNewTerminal();
        } else {
          connectToSession(autoConnect);
        }
      }
    }, 100);

    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoConnect, projectPath]);

  const connectToTerminalService = (event: string, data: object, sessionName?: string) => {
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
      setConnectedSession(sessionName || null);
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
      setConnectedSession(null);
    });

    socket.on('disconnect', () => {
      setConnected(false);
      setConnectedSession(null);
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
    }, sessionName);
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
    setConnectedSession(null);
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
      {onBack && (
        <div className="zellij-mobile-header">
          <button className="zellij-back-btn" onClick={onBack}>
            <ArrowLeft size={16} />
            Back
          </button>
        </div>
      )}

      {error && (
        <div className="zellij-error">
          <AlertCircle size={14} />
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
                    <Monitor size={16} />
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

      <div className="zellij-session-bar">
        <div className="zellij-session-tabs">
          {sessions.map((session) => (
            <button
              key={session.name}
              className={`session-tab ${connectedSession === session.name ? 'connected' : ''} ${session.name === projectSession?.name ? 'project' : ''}`}
              onClick={() => connectToSession(session.name)}
              title={session.agent_type ? `${session.name} (${session.agent_type})` : session.name}
            >
              <Monitor size={12} />
              <span className="session-tab-name">{session.name}</span>
              {session.agent_type && <span className="agent-tag">{session.agent_type}</span>}
              {session.is_active && <span className="status-dot" />}
            </button>
          ))}
        </div>
        <div className="zellij-bar-actions">
          <button
            className="btn btn-sm btn-secondary"
            onClick={openNewTerminal}
            disabled={loading || !projectPath}
          >
            <FolderOpen size={12} />
            New Terminal
          </button>
          {connected && (
            <button className="btn btn-sm" onClick={disconnect}>
              <Unlink size={12} />
              Disconnect
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
