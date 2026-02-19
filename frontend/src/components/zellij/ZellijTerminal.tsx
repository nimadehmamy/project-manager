import { useCallback, useEffect, useRef, useState } from 'react';
import { Terminal } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import { WebLinksAddon } from 'xterm-addon-web-links';
import { io, Socket } from 'socket.io-client';
import 'xterm/css/xterm.css';
import { api } from '../../api/client';
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

  // Callback ref to know when terminal container is mounted
  const setTerminalContainer = useCallback((el: HTMLDivElement | null) => {
    terminalRef.current = el;
    if (el && !xtermRef.current) {
      setTerminalReady(true);
    }
  }, []);

  // Check Zellij status
  useEffect(() => {
    const checkStatus = async () => {
      try {
        const status = await api.getZellijStatus();
        setZellijAvailable(status.available);
        if (status.available) loadSessions();
      } catch (err) {
        setZellijAvailable(false);
      }
    };
    checkStatus();
    const interval = setInterval(checkStatus, 5000);
    return () => clearInterval(interval);
  }, []);

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
      setSessions(data.sessions || []);
    } catch (err) {
      console.error('Failed to load sessions:', err);
    }
  };

  const loadProjectSession = async () => {
    if (!projectPath) return;
    try {
      const data = await api.getProjectZellijSession(projectPath);
      setProjectSession(data.found ? data.session : null);
    } catch (err) {
      setProjectSession(null);
    }
  };

  // Initialize terminal when container is ready
  useEffect(() => {
    console.log(`Init terminal - ready: ${terminalReady}, ref: ${!!terminalRef.current}`);
    if (!terminalReady || !terminalRef.current) {
      return;
    }
    
    // Check if already initialized
    if (xtermRef.current) {
      console.log('Terminal already exists, skipping creation');
      return;
    }

    console.log('Creating terminal...');
    const term = new Terminal({
      cursorBlink: true,
      fontSize: 14,
      fontFamily: '"JetBrains Mono", "Fira Code", "Hack", "DejaVu Sans Mono", "SF Mono", "Monaco", "Menlo", monospace',
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
    
    // Delay fit to ensure container has dimensions
    setTimeout(() => {
      fitAddon.fit();
      console.log(`Terminal fitted: ${term.cols}x${term.rows}`);
      // Write test to verify rendering
      term.write('\r\n[Terminal initialized]\r\n');
    }, 100);

    xtermRef.current = term;
    fitAddonRef.current = fitAddon;
    
    console.log('Terminal created, waiting for fit...');
    
    // Debug: check container dimensions
    setTimeout(() => {
      const el = terminalRef.current;
      if (el) {
        const rect = el.getBoundingClientRect();
        console.log(`Container size: ${rect.width}x${rect.height}`);
      }
    }, 200);

    const handleResize = () => {
      fitAddonRef.current?.fit();
      // Send resize to server if connected
      if (socketRef.current?.connected && xtermRef.current) {
        socketRef.current.emit('resize', {
          cols: xtermRef.current.cols,
          rows: xtermRef.current.rows
        });
      }
    };
    window.addEventListener('resize', handleResize);

    // Handle keyboard events to suppress browser shortcuts when terminal is focused
    const handleKeyDown = (e: KeyboardEvent) => {
      // Only suppress if terminal is focused
      const target = e.target as HTMLElement;
      if (!target.closest('.xterm-container')) return;

      // Suppress browser shortcuts that should go to terminal
      const suppressKeys = [
        'KeyT', // Ctrl+T (new tab)
        'KeyW', // Ctrl+W (close tab)
        'KeyN', // Ctrl+N (new window)
        'KeyR', // Ctrl+R (reload)
        'KeyP', // Ctrl+P (print)
        'KeyF', // Ctrl+F (find)
        'KeyG', // Ctrl+G (find next)
        'KeyH', // Ctrl+H (history)
        'KeyJ', // Ctrl+J (downloads)
        'Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5', // Ctrl+1-9 (switch tabs)
        'Digit6', 'Digit7', 'Digit8', 'Digit9', 'Digit0',
        'Tab',  // Ctrl+Tab
      ];

      if (e.ctrlKey && suppressKeys.includes(e.code)) {
        e.preventDefault();
        return false;
      }

      // Suppress Alt+ shortcuts (menu access)
      if (e.altKey) {
        e.preventDefault();
        return false;
      }
    };

    document.addEventListener('keydown', handleKeyDown, true);

    return () => {
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
    console.log(`Connecting to terminal service: ${event}`);

    disconnect();

    // Connect to Node.js terminal service
    const socket = io(TERMINAL_SERVICE_URL, {
      path: '/terminal-socket',
      transports: ['websocket'],
      reconnection: false,
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('Connected to terminal service');
      socket.emit(event, data);
    });

    socket.on('ready', (data) => {
      console.log(`Terminal ready: ${JSON.stringify(data)}`);
      setConnected(true);
      setLoading(false);
      
      // Set up terminal input handling
      if (inputHandlerRef.current) {
        inputHandlerRef.current.dispose();
      }
      
      console.log(`xtermRef exists: ${!!xtermRef.current}`);
      if (xtermRef.current) {
        // Test write to verify terminal is working
        console.log('Writing test message to terminal...');
        xtermRef.current.write('\r\n[Terminal connected - waiting for output...]\r\n');
        
        // Send initial resize
        socket.emit('resize', {
          cols: xtermRef.current.cols,
          rows: xtermRef.current.rows
        });
        
        // Handle input
        inputHandlerRef.current = xtermRef.current.onData((inputData) => {
          if (socket.connected) {
            socket.emit('input', inputData);
          }
        });
        
        // Focus terminal
        xtermRef.current.focus();
      }
    });
    
    // Add output debug logging
    socket.on('output', (data) => {
      console.log(`Received ${data.length} chars of output`);
      if (xtermRef.current) {
        xtermRef.current.write(data);
        // Force render
        xtermRef.current.refresh(0, xtermRef.current.rows - 1);
      }
    });

    socket.on('error', (data) => {
      console.log(`Error: ${data.message}`);
      setError(data.message);
      setLoading(false);
    });

    socket.on('exit', (data) => {
      console.log(`Terminal exited: ${JSON.stringify(data)}`);
      setConnected(false);
    });

    socket.on('disconnect', (reason) => {
      console.log(`Disconnected: ${reason}`);
      setConnected(false);
    });

    socket.on('connect_error', (err) => {
      console.log(`Connect error: ${err.message}`);
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
      await api.createZellijSession(projectPath, agentType);
      await loadSessions();
      await loadProjectSession();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to create session');
    } finally {
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
