"""WebSocket terminal using eventlet WebSocket."""

import json
import time
import eventlet
from eventlet import wsgi, websocket
from flask import Flask

app = Flask(__name__)

# Store connected clients
clients = {}

@websocket.WebSocketWSGI
def ws_terminal_handler(ws):
    """Handle WebSocket connections."""
    print(f"WebSocket client connected: {ws}")
    
    try:
        # Wait for first message
        msg = ws.wait()
        print(f"Received: {msg}")
        
        if not msg:
            return
        
        data = json.loads(msg)
        msg_type = data.get('type')
        
        if msg_type == 'new':
            project_path = data.get('path', '~')
            print(f"New terminal in {project_path}")
            
            # For now, just echo back
            ws.send(json.dumps({'status': 'connected', 'path': project_path}))
            
            # Simple echo loop
            while True:
                msg = ws.wait()
                if msg is None:
                    break
                print(f"Echo: {msg}")
                ws.send(f"Echo: {msg}")
                
    except Exception as e:
        print(f"WS Error: {e}")
    finally:
        print("WebSocket client disconnected")


@app.route('/')
def index():
    return '''
    <!DOCTYPE html>
    <html>
    <body>
        <h1>Eventlet WebSocket Test</h1>
        <div id="log"></div>
        <input id="msg" type="text" placeholder="Type message...">
        <button onclick="send()">Send</button>
        <script>
            const log = (m) => document.getElementById('log').innerHTML += '<br>' + m;
            const ws = new WebSocket('ws://' + window.location.host + '/ws/terminal');
            ws.onopen = () => {
                log('Connected!');
                ws.send(JSON.stringify({type: 'new', path: '/tmp'}));
            };
            ws.onmessage = (e) => log('Received: ' + e.data);
            ws.onclose = (e) => log('Closed: ' + e.code);
            ws.onerror = (e) => log('Error!');
            function send() {
                const m = document.getElementById('msg').value;
                ws.send(m);
            }
        </script>
    </body>
    </html>
    '''


if __name__ == '__main__':
    print("Starting on http://localhost:8002")
    # Use eventlet's wsgi server with WebSocket support
    listener = eventlet.listen(('0.0.0.0', 8002))
    
    def site(env, start_response):
        path = env.get('PATH_INFO', '')
        if path == '/ws/terminal':
            return ws_terminal_handler(env, start_response)
        return app(env, start_response)
    
    wsgi.server(listener, site)
