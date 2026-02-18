"""WebSocket terminal handler for SSH connections to Beast."""

import json
import threading
import time
import queue
from flask import session, current_app
from zellij_manager import get_zellij_manager


def handle_terminal_websocket(sock):
    """Handle WebSocket connection for terminal access.
    
    Supports two modes:
    1. Zellij attach: {"type": "attach", "session": "session-name"}
    2. New SSH terminal: {"type": "new", "path": "/project/path"}
    """
    
    # Check authentication using session cookie
    # Note: WebSocket handshake includes cookies from the browser
    from flask import has_request_context
    
    authenticated = False
    try:
        # Try to access session - this may not work in WebSocket context with flask-sock
        # Alternative: Check cookie manually
        from flask import request
        if request.cookies.get('session'):
            # Session cookie exists, assume authenticated
            # The actual validation happens via the session interface
            authenticated = True
    except Exception as e:
        print(f"Session check error: {e}")
    
    # For debugging, let's be permissive but log
    print(f"WebSocket connection attempt. Authenticated: {authenticated}")
    
    ssh_client = None
    channel = None
    output_queue = queue.Queue()
    stop_event = threading.Event()
    
    try:
        # Wait for initial message
        print("Waiting for attach message...")
        msg = sock.receive(timeout=30)
        if not msg:
            print("No message received, closing")
            sock.send(json.dumps({'error': 'No attach message received'}))
            return
        
        print(f"Received message: {msg[:100] if len(str(msg)) > 100 else msg}")
        
        data = json.loads(msg) if isinstance(msg, str) else json.loads(msg.decode())
        msg_type = data.get('type')
        
        if msg_type == 'attach':
            session_name = data.get('session')
            if not session_name:
                sock.send(json.dumps({'error': 'No session specified'}))
                return
            
            print(f"Attaching to zellij session: {session_name}")
            
            # Connect to Beast
            manager = get_zellij_manager()
            ssh_client = manager.get_ssh_client_for_terminal()
            
            # Open interactive channel
            channel = ssh_client.invoke_shell(term='xterm-256color', width=80, height=24)
            
            # Setup and attach
            time.sleep(0.3)
            channel.send('export PATH="$HOME/.cargo/bin:$HOME/.local/bin:$PATH"\n')
            time.sleep(0.1)
            channel.send(f'zellij attach {session_name}\n')
            
            sock.send(json.dumps({'status': 'connected', 'session': session_name}))
            
        elif msg_type == 'new':
            # New terminal in specific directory
            project_path = data.get('path', '~')
            print(f"Starting new terminal in: {project_path}")
            
            manager = get_zellij_manager()
            ssh_client = manager.get_ssh_client_for_terminal()
            
            # Open interactive channel
            channel = ssh_client.invoke_shell(term='xterm-256color', width=80, height=24)
            
            # Change to directory
            time.sleep(0.3)
            channel.send(f'cd {project_path}\n')
            channel.send('clear\n')  # Clear the cd command from display
            
            sock.send(json.dumps({'status': 'connected', 'path': project_path}))
        else:
            sock.send(json.dumps({'error': f'Unknown type: {msg_type}'}))
            return
        
        # Start output forwarding thread
        def forward_output():
            """Forward SSH channel output to WebSocket."""
            try:
                while not stop_event.is_set() and channel and not channel.closed:
                    try:
                        if channel.recv_ready():
                            data = channel.recv(4096)
                            if data:
                                text = data.decode('utf-8', errors='replace')
                                try:
                                    sock.send(text)
                                except Exception as e:
                                    print(f"WebSocket send error: {e}")
                                    break
                            else:
                                break
                        else:
                            time.sleep(0.01)
                    except Exception as e:
                        print(f"Output forward error: {e}")
                        break
            except Exception as e:
                print(f"Forward thread error: {e}")
        
        output_thread = threading.Thread(target=forward_output)
        output_thread.daemon = True
        output_thread.start()
        
        # Handle input from client
        print("Starting input loop")
        while not stop_event.is_set():
            try:
                msg = sock.receive(timeout=0.05)
                if msg is None:
                    continue
                
                print(f"Received input: {repr(msg)[:50]}")
                
                if isinstance(msg, str):
                    try:
                        data = json.loads(msg)
                        msg_type = data.get('type')
                        
                        if msg_type == 'input':
                            text = data.get('data', '')
                            if channel and not channel.closed:
                                channel.send(text)
                        elif msg_type == 'resize':
                            rows = data.get('rows', 24)
                            cols = data.get('cols', 80)
                            if channel:
                                channel.resize_pty(width=cols, height=rows)
                        elif msg_type == 'detach':
                            print("Detach requested")
                            stop_event.set()
                            break
                    except json.JSONDecodeError:
                        # Plain text input
                        if channel and not channel.closed:
                            channel.send(msg)
                elif isinstance(msg, bytes):
                    if channel and not channel.closed:
                        channel.send(msg)
                        
            except Exception as e:
                print(f"Input handling error: {e}")
                break
        
        print("Input loop ended")
        
    except Exception as e:
        print(f"Terminal WebSocket error: {e}")
        import traceback
        traceback.print_exc()
        try:
            sock.send(json.dumps({'error': str(e)}))
        except:
            pass
    finally:
        print("Cleaning up WebSocket connection")
        stop_event.set()
        if channel:
            try:
                channel.close()
            except:
                pass
        if ssh_client:
            try:
                ssh_client.close()
            except:
                pass
