const express = require('express');
const cors = require('cors');
const path = require('path');
const { data, cleanupInactiveUsers, cleanupOldSessions } = require('./data');

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

// Use routes
app.use('/user', userRoutes);
app.use('/online', onlineRoutes);
app.use('/notify', notifyRoutes);
app.use('/accept', acceptRoutes);
app.use('/game-action', gameRoutes);

// Game state route
app.get('/game-state/:gameId', (req, res) => {
  const gameId = req.params.gameId;
  
  if (!data.games[gameId]) {
    return res.status(404).json({ error: 'Game not found' });
  }
  
  res.json(data.games[gameId].state);
});

// Game session status
app.get('/game-status/:gameId', (req, res) => {
  const gameId = req.params.gameId;
  const username = req.query.username;
  
  if (!data.games[gameId]) {
    return res.status(404).json({ error: 'Game not found' });
  }
  
  const game = data.games[gameId];
  const session = data.sessions[gameId];
  
  if (username && session) {
    session.lastActivity = Date.now();
    if (!session.connected.includes(username)) {
      session.connected.push(username);
    }
  }
  
  res.json({
    playersConnected: game.state.playersConnected,
    sessionActive: !!session,
    connectedPlayers: session ? session.connected : []
  });
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
    sessions: Object.keys(data.sessions).length,
    timestamp: Date.now()
  });
});

// Start server
const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`🎮 Vortex Islands Server running on port ${PORT}`);
  console.log(`📱 Access: http://localhost:${PORT}`);
});

// Cleanup intervals
setInterval(() => {
  cleanupInactiveUsers();
  cleanupOldSessions();
}, 30000); // Every 30 seconds

console.log('✅ Server ready - Using polling-based communication');

module.exports = app;
