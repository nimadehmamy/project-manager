#!/usr/bin/env python3
"""Test Flask-SocketIO with eventlet."""

import eventlet
from flask import Flask, render_template_string
from flask_socketio import SocketIO, emit

app = Flask(__name__)
app.config['SECRET_KEY'] = 'test'

# Use eventlet async mode
socketio = SocketIO(app, async_mode='eventlet', cors_allowed_origins="*")

HTML = '''
<!DOCTYPE html>
<html>
<head>
    <script src="https://cdn.socket.io/4.5.4/socket.io.min.js"></script>
</head>
<body>
    <h1>SocketIO Test</h1>
    <div id="log"></div>
    <input id="msg" type="text" placeholder="Type message...">
    <button onclick="send()">Send</button>
    <script>
        const log = (m) => document.getElementById('log').innerHTML += '<br>' + m;
        const socket = io();
        socket.on('connect', () => log('Connected!'));
        socket.on('message', (data) => log('Received: ' + data));
        socket.on('disconnect', () => log('Disconnected'));
        function send() {
            const m = document.getElementById('msg').value;
            socket.emit('message', m);
        }
    </script>
</body>
</html>
'''

@app.route('/')
def index():
    return render_template_string(HTML)

@socketio.on('connect')
def handle_connect():
    print('Client connected')
    emit('message', 'Welcome!')

@socketio.on('disconnect')
def handle_disconnect():
    print('Client disconnected')

@socketio.on('message')
def handle_message(data):
    print(f'Received: {data}')
    emit('message', f'Echo: {data}')

if __name__ == '__main__':
    print("Starting on http://localhost:8003")
    socketio.run(app, host='0.0.0.0', port=8003)
