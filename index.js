const express = require('express');
const WebSocket = require('ws');
const cors = require('cors');
const path = require('path');
const { data, cleanupInactiveUsers } = require('./data');

const app = express();
const PORT = process.env.PORT || 3000;

// CORS configuration
app.use(cors({
  origin: ['http://localhost:3000', 'http://localhost:8080'],
  credentials: true
}));

app.use(express.json());
app.use(express.static('public'));

// Import routes
const userRoutes = require('./routes/user');
const onlineRoutes = require('./routes/online');
const notifyRoutes = require('./routes/notify');
const acceptRoutes = require('./routes/accept');
const gameRoutes = require('./routes/game');

// Use routes with proper paths
app.use('/user', userRoutes);
app.use('/online', onlineRoutes);
app.use('/notify', notifyRoutes);
app.use('/accept', acceptRoutes);
app.use('/game-action', gameRoutes);

// Game state route - SIMPLE AND WORKING
app.get('/game-state/:gameId', (req, res) => {
  const gameId = req.params.gameId;
  
  if (!data.games[gameId]) {
    return res.status(404).json({ error: 'Game not found' });
  }
  
  res.json(data.games[gameId].state);
});

// Serve frontend
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/game', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'game.html'));
});

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    users: Object.keys(data.users).length,
    games: Object.keys(data.games).length,
    timestamp: Date.now()
  });
});

// WebSocket setup - SIMPLIFIED AND WORKING
const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Vortex Islands server running on port ${PORT}`);
  console.log(`📱 Access the game at: http://localhost:${PORT}`);
});

const wss = new WebSocket.Server({ 
  server,
  path: '/ws'
});

// Simple WebSocket handling
wss.on('connection', (ws, req) => {
  console.log('🔗 New WebSocket connection');
  
  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message);
      
      if (data.type === 'register') {
        // Register user with WebSocket
        const username = data.username;
        if (username && data.users[username]) {
          data.users[username].ws = ws;
          data.users[username].online = true;
          data.users[username].lastPing = Date.now();
          console.log(`✅ WebSocket registered for user: ${username}`);
          
          ws.send(JSON.stringify({
            type: 'registered',
            message: 'WebSocket connected successfully'
          }));
        }
      } else if (data.type === 'ping') {
        ws.send(JSON.stringify({ type: 'pong' }));
      }
    } catch (error) {
      console.log('WebSocket message error:', error.message);
    }
  });
  
  ws.on('close', () => {
    console.log('🔌 WebSocket disconnected');
  });
  
  ws.on('error', (error) => {
    console.log('WebSocket error:', error.message);
  });
  
  // Send welcome message
  ws.send(JSON.stringify({
    type: 'connected',
    message: 'Welcome to Vortex Islands!'
  }));
});

// Simple cleanup every 30 seconds
setInterval(() => {
  cleanupInactiveUsers();
}, 30000);

console.log('✅ Server initialized successfully');

module.exports = app;
