#!/usr/bin/env node
/**
 * Terminal Service - Node.js PTY server for Project Manager
 * 
 * Provides VS Code-like terminal experience using node-pty.
 * Supports both new shell sessions and Zellij attachment.
 */

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const pty = require('node-pty');
const cors = require('cors');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  },
  path: '/terminal-socket'
});

const PORT = process.env.TERMINAL_PORT || 3001;

// Store active terminals
const terminals = new Map();

// SSH configuration
const SSH_HOST = process.env.SSH_HOST || '192.168.1.157';
const SSH_USER = process.env.SSH_USER || 'nima';
const SSH_PORT = process.env.SSH_PORT || '2222';
const SSH_KEY = process.env.SSH_KEY || '/home/nima/.ssh/id_rsa_blk';

console.log(`Terminal Service starting...`);
console.log(`SSH target: ${SSH_USER}@${SSH_HOST}:${SSH_PORT}`);

/**
 * Create a new terminal session
 * @param {string} socketId - Socket.IO session ID
 * @param {Object} options - Terminal options
 * @param {string} options.type - 'new' or 'zellij'
 * @param {string} options.path - Working directory path
 * @param {string} options.session - Zellij session name (for type='zellij')
 */
function createTerminal(socketId, options) {
  const { type, path: workDir, session } = options;
  
  // Map local paths to Beast paths
  // Local path /LLM/xxx -> Beast path /home/nima/__work/LLM/xxx
  let beastPath = workDir;
  if (workDir.startsWith('/LLM/') || workDir === '/LLM') {
    beastPath = '/home/nima/__work' + workDir;
  } else if (workDir.startsWith('/project_manager')) {
    beastPath = '/home/nima/__work' + workDir;
  } else if (!workDir.startsWith('/home/nima')) {
    // Default: assume it's relative to /home/nima/__work
    // Handle both /path and path formats
    const relPath = workDir.startsWith('/') ? workDir : '/' + workDir;
    beastPath = '/home/nima/__work' + relPath;
  }
  
  // Build SSH command
  let sshCommand;
  const sshBase = `ssh -t -p ${SSH_PORT} -i ${SSH_KEY} -o IdentitiesOnly=yes ${SSH_USER}@${SSH_HOST}`;
  // Ensure ~/.local/bin is in PATH for zellij
  const pathExport = 'export PATH="$HOME/.local/bin:$PATH"';
  if (type === 'zellij' && session) {
    // Attach to existing Zellij session
    sshCommand = `${sshBase} "${pathExport} && cd ${beastPath} && zellij attach ${session}"`;
  } else {
    // New shell session
    sshCommand = `${sshBase} "cd ${beastPath} && exec bash -l"`;
  }
  
  console.log(`[${socketId}] Creating terminal: ${type}`);
  console.log(`[${socketId}] Local path: ${workDir} -> Beast path: ${beastPath}`);
  console.log(`[${socketId}] Command: ${sshCommand}`);
  
  // Spawn PTY
  const term = pty.spawn('bash', ['-c', sshCommand], {
    name: 'xterm-256color',
    cols: 80,
    rows: 24,
    cwd: process.env.HOME,
    env: {
      ...process.env,
      TERM: 'xterm-256color',
      COLORTERM: 'truecolor'
    }
  });
  
  terminals.set(socketId, {
    terminal: term,
    type: type,
    path: workDir,
    created: new Date()
  });
  
  return term;
}

/**
 * Kill a terminal session
 */
function killTerminal(socketId) {
  const session = terminals.get(socketId);
  if (session) {
    console.log(`[${socketId}] Killing terminal`);
    try {
      session.terminal.kill();
    } catch (e) {
      console.error(`[${socketId}] Error killing terminal:`, e.message);
    }
    terminals.delete(socketId);
  }
}

// Socket.IO connection handling
io.on('connection', (socket) => {
  const socketId = socket.id;
  console.log(`[${socketId}] Client connected`);
  
  // Create new terminal
  socket.on('new_terminal', (data) => {
    try {
      // Kill existing terminal if any
      killTerminal(socketId);
      
      const options = {
        type: 'new',
        path: data.path || '/home/nima',
      };
      
      const term = createTerminal(socketId, options);
      
      // Handle terminal output
      term.onData((data) => {
        socket.emit('output', data);
      });
      
      // Handle terminal exit
      term.onExit(({ exitCode, signal }) => {
        console.log(`[${socketId}] Terminal exited: code=${exitCode}, signal=${signal}`);
        socket.emit('exit', { exitCode, signal });
        terminals.delete(socketId);
      });
      
      // Send ready event
      socket.emit('ready', {
        type: 'new',
        path: options.path,
        pid: term.pid
      });
      
    } catch (error) {
      console.error(`[${socketId}] Error creating terminal:`, error);
      socket.emit('error', { message: error.message });
    }
  });
  
  // Attach to Zellij session
  socket.on('attach_zellij', (data) => {
    try {
      killTerminal(socketId);
      
      const options = {
        type: 'zellij',
        path: data.path || '/home/nima',
        session: data.session
      };
      
      const term = createTerminal(socketId, options);
      
      term.onData((data) => {
        socket.emit('output', data);
      });
      
      term.onExit(({ exitCode, signal }) => {
        console.log(`[${socketId}] Zellij session exited: code=${exitCode}`);
        socket.emit('exit', { exitCode, signal });
        terminals.delete(socketId);
      });
      
      socket.emit('ready', {
        type: 'zellij',
        session: data.session,
        pid: term.pid
      });
      
    } catch (error) {
      console.error(`[${socketId}] Error attaching to zellij:`, error);
      socket.emit('error', { message: error.message });
    }
  });
  
  // Handle terminal input
  socket.on('input', (data) => {
    const session = terminals.get(socketId);
    if (session && session.terminal) {
      try {
        session.terminal.write(data);
      } catch (e) {
        console.error(`[${socketId}] Error writing to terminal:`, e.message);
      }
    }
  });
  
  // Handle resize
  socket.on('resize', (data) => {
    const session = terminals.get(socketId);
    if (session && session.terminal) {
      try {
        session.terminal.resize(data.cols, data.rows);
      } catch (e) {
        console.error(`[${socketId}] Error resizing terminal:`, e.message);
      }
    }
  });
  
  // Handle disconnect
  socket.on('disconnect', () => {
    console.log(`[${socketId}] Client disconnected`);
    killTerminal(socketId);
  });
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    activeTerminals: terminals.size,
    uptime: process.uptime()
  });
});

// Start server
server.listen(PORT, () => {
  console.log(`Terminal service listening on port ${PORT}`);
  console.log(`WebSocket path: /terminal-socket`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down...');
  for (const [socketId] of terminals) {
    killTerminal(socketId);
  }
  server.close(() => {
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down...');
  for (const [socketId] of terminals) {
    killTerminal(socketId);
  }
  server.close(() => {
    process.exit(0);
  });
});
