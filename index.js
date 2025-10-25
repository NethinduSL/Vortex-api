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

// Game state route - FIXED
app.get('/game-state/:gameId', (req, res) => {
  const gameId = req.params.gameId;
  
  console.log('Game state request for:', gameId);
  console.log('Available games:', Object.keys(data.games));
  
  if (!data.games[gameId]) {
    console.log('Game not found:', gameId);
    return res.status(404).json({ error: 'Game not found' });
  }
  
  console.log('Returning game state for:', gameId);
  res.json(data.games[gameId].state);
});

// Serve frontend
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/game', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'game.html'));
});

// WebSocket setup for notifications - FIXED
const server = app.listen(PORT, () => {
  console.log(`Vortex Islands server running on port ${PORT}`);
});

const wss = new WebSocket.Server({ 
  server, 
  path: '/notify',
  perMessageDeflate: false
});

wss.on('connection', (ws, req) => {
  try {
    // Extract username from URL path
    const pathname = req.url;
    const username = pathname.split('/').pop();
    
    console.log('WebSocket connection attempt for user:', username);
    
    if (username && data.users[username]) {
      data.users[username].ws = ws;
      data.users[username].online = true;
      data.users[username].lastPing = Date.now();
      
      console.log(`WebSocket connected for user: ${username}`);
      
      // Send immediate confirmation
      ws.send(JSON.stringify({ type: 'connected', message: 'WebSocket connected' }));
      
      ws.on('close', (code, reason) => {
        console.log(`WebSocket closed for ${username}:`, code, reason.toString());
        if (data.users[username]) {
          data.users[username].ws = null;
        }
      });
      
      ws.on('error', (error) => {
        console.error(`WebSocket error for ${username}:`, error);
        if (data.users[username]) {
          data.users[username].ws = null;
        }
      });
      
      // Handle ping/pong for connection health
      ws.on('pong', () => {
        if (data.users[username]) {
          data.users[username].lastPing = Date.now();
        }
      });
      
    } else {
      console.log('Invalid username or user not found:', username);
      ws.close(1008, 'User not found');
    }
  } catch (error) {
    console.error('WebSocket connection error:', error);
    ws.close(1011, 'Server error');
  }
});

// Ping clients every 20 seconds to keep connection alive
setInterval(() => {
  wss.clients.forEach((ws) => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.ping();
    }
  });
}, 20000);

// Cleanup interval
setInterval(cleanupInactiveUsers, 30000);

module.exports = app;
