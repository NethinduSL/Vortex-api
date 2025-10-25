const express = require('express');
const WebSocket = require('ws');
const cors = require('cors');
const path = require('path');
const { data, cleanupInactiveUsers } = require('./data');

const app = express();
const PORT = process.env.PORT || 3000;

// CORS configuration
app.use(cors({
  origin: [
    'https://vortex-islands-api.vercel.app',
    'http://localhost:3000',
    'http://localhost:8080',
    undefined
  ],
  credentials: true
}));

app.use(express.json());
app.use(express.static('public'));

// Routes
app.use('/user', require('./routes/user'));
app.use('/online', require('./routes/online'));
app.use('/notify', require('./routes/notify'));
app.use('/accept', require('./routes/accept'));
app.use('/game-action', require('./routes/game'));

// Serve frontend
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/game', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'game.html'));
});

// WebSocket setup for notifications
const server = app.listen(PORT, () => {
  console.log(`Vortex Islands server running on port ${PORT}`);
});

const wss = new WebSocket.Server({ server, path: '/notify' });

wss.on('connection', (ws, req) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const username = url.pathname.split('/').pop();
  
  if (username && data.users[username]) {
    data.users[username].ws = ws;
    data.users[username].online = true;
    data.users[username].lastPing = Date.now();
    
    ws.on('close', () => {
      if (data.users[username]) {
        data.users[username].ws = null;
      }
    });
    
    ws.on('error', (error) => {
      if (data.users[username]) {
        data.users[username].ws = null;
      }
    });
  } else {
    ws.close();
  }
});

// Cleanup interval
setInterval(cleanupInactiveUsers, 30000);

module.exports = app;
