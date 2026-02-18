"""WebSocket routes using simple-websocket with eventlet."""

import json
import threading
import time
from flask import request
from simple_websocket import Server
from zellij_manager import get_zellij_manager


def handle_ws_terminal(environ, start_response):
    """WSGI handler for WebSocket terminal connections."""
    # Check if it's a WebSocket request
    if environ.get('HTTP_UPGRADE', '').lower() != 'websocket':
        start_response('400 Bad Request', [('Content-Type', 'text/plain')])
        return [b'Not a WebSocket request']
    
    # Create WebSocket server from environ
    try:
        ws = Server(environ)
    except Exception as e:
        start_response('500 Internal Server Error', [('Content-Type', 'text/plain')])
        return [f'WebSocket error: {e}'.encode()]
    
    # Accept the connection
    start_response('101 Switching Protocols', [
        ('Upgrade', 'websocket'),
        ('Connection', 'Upgrade'),
    ])
    
    # Handle the WebSocket connection
    def handle_connection():
        ssh_client = None
        channel = None
        stop_event = threading.Event()
        
        try:
            # Wait for first message
            msg = ws.receive(timeout=30)
            if not msg:
                return
            
            data = json.loads(msg)
            msg_type = data.get('type')
            
            if msg_type == 'attach':
                session_name = data.get('session')
                manager = get_zellij_manager()
                ssh_client = manager.get_ssh_client_for_terminal()
                channel = ssh_client.invoke_shell(term='xterm-256color', width=80, height=24)
                
                time.sleep(0.3)
                channel.send('export PATH="$HOME/.cargo/bin:$PATH"\n')
                time.sleep(0.1)
                channel.send(f'zellij attach {session_name}\n')
                ws.send(json.dumps({'status': 'connected'}))
                
            elif msg_type == 'new':
                project_path = data.get('path', '~')
                manager = get_zellij_manager()
                ssh_client = manager.get_ssh_client_for_terminal()
                channel = ssh_client.invoke_shell(term='xterm-256color', width=80, height=24)
                
                time.sleep(0.3)
                channel.send(f'cd {project_path}\n')
                channel.send('clear\n')
                ws.send(json.dumps({'status': 'connected'}))
            else:
                return
            
            # Forward output
            def forward():
                while not stop_event.is_set():
                    if channel and channel.recv_ready():
                        try:
                            data = channel.recv(4096)
                            if data:
                                ws.send(data.decode('utf-8', errors='replace'))
                        except:
                            break
                    else:
                        time.sleep(0.01)
            
            t = threading.Thread(target=forward)
            t.daemon = True
            t.start()
            
            # Input loop
            while not stop_event.is_set():
                try:
                    msg = ws.receive(timeout=0.05)
                    if msg:
                        data = json.loads(msg)
                        if data.get('type') == 'input':
                            channel.send(data.get('data', ''))
                        elif data.get('type') == 'detach':
                            break
                except:
                    pass
                    
        except Exception as e:
            print(f"WS Error: {e}")
        finally:
            stop_event.set()
            if channel:
                channel.close()
            if ssh_client:
                ssh_client.close()
            ws.close()
    
    # Run the handler
    handle_connection()
    return []
