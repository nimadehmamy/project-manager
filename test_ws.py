#!/usr/bin/env python3
"""Simple WebSocket test server using eventlet."""

import eventlet
from eventlet import wsgi
from flask import Flask
from flask_sock import Sock

app = Flask(__name__)
sock = Sock(app)

@sock.route('/echo')
def echo(sock):
    """Simple echo WebSocket."""
    print(f"ECHO: Client connected!")
    try:
        while True:
            msg = sock.receive()
            print(f"ECHO: Received: {msg}")
            if msg:
                sock.send(f"Echo: {msg}")
            else:
                break
    except Exception as e:
        print(f"ECHO: Error: {e}")
    finally:
        print(f"ECHO: Client disconnected")

@app.route('/')
def index():
    return '''
    <!DOCTYPE html>
    <html>
    <body>
        <h1>WebSocket Test</h1>
        <div id="log"></div>
        <input id="msg" type="text" placeholder="Type message...">
        <button onclick="send()">Send</button>
        <script>
            const log = (m) => document.getElementById('log').innerHTML += '<br>' + m;
            const ws = new WebSocket('ws://' + window.location.host + '/echo');
            ws.onopen = () => log('Connected!');
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
    print("Starting test server on http://localhost:8001")
    print("Open http://localhost:8001 in your browser")
    # Use eventlet's wsgi server
    listener = eventlet.listen(('0.0.0.0', 8001))
    wsgi.server(listener, app)
