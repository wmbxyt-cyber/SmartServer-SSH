import { WebSocketServer } from 'ws';
import { Client } from 'ssh2';

const wss = new WebSocketServer({ port: 3001 });

console.log('Real SSH Proxy Server running on ws://localhost:3001');

wss.on('connection', (ws) => {
  console.log('Client connected to WebSocket');
  const conn = new Client();
  let stream = null;

  // Handle WebSocket errors gracefully
  ws.on('error', (error) => {
    console.error('WebSocket error:', error);
    conn.end();
  });

  ws.on('message', (message) => {
    try {
        const data = JSON.parse(message);

        // Initial Connection
        if (data.type === 'connect') {
        console.log(`Attempting to connect to ${data.host}:${data.port || 22}...`);
        
        conn.on('ready', () => {
            console.log('SSH Connection Ready');
            ws.send(JSON.stringify({ type: 'status', status: 'connected' }));
            
            // Start interactive shell
            conn.shell((err, s) => {
            if (err) {
                ws.send(JSON.stringify({ type: 'error', message: 'Shell error: ' + err.message }));
                return;
            }
            
            stream = s;
            
            // Forward SSH output to Browser
            stream.on('data', (d) => {
                ws.send(JSON.stringify({ type: 'data', data: d.toString('binary') }));
            });

            stream.on('close', () => {
                conn.end();
                ws.send(JSON.stringify({ type: 'status', status: 'disconnected' }));
            });
            });
        })
        .on('error', (err) => {
            console.error('SSH Error:', err);
            // Check if socket is still open before sending
            if (ws.readyState === 1) { 
                ws.send(JSON.stringify({ type: 'error', message: err.message }));
                ws.close();
            }
        })
        .on('end', () => {
             if (ws.readyState === 1) {
                ws.send(JSON.stringify({ type: 'status', status: 'disconnected' }));
             }
        })
        .connect({
            host: data.host,
            port: parseInt(data.port) || 22,
            username: data.username,
            password: data.password,
            readyTimeout: 30000 // 30s timeout
        });
        }

        // Key input from browser
        if (data.type === 'input' && stream) {
           stream.write(data.data);
        }
        
        // Resize terminal
        if (data.type === 'resize' && stream) {
            stream.setWindow(data.rows, data.cols, data.height, data.width);
        }

    } catch (e) {
        console.error("Failed to parse message:", e);
    }
  });

  ws.on('close', () => {
    conn.end();
    console.log('Client disconnected');
  });
});