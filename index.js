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

// Game state route
app.get('/game-state/:gameId', (req, res) => {
  const gameId = req.params.gameId;
  
  console.log('Game state request for:', gameId);
  
  if (!data.games[gameId]) {
    console.log('Game not found:', gameId);
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

// WebSocket setup for notifications - STABLE VERSION
const server = app.listen(PORT, () => {
  console.log(`Vortex Islands server running on port ${PORT}`);
});

const wss = new WebSocket.Server({ 
  server, 
  path: '/notify',
  perMessageDeflate: false,
  clientTracking: true
});

// Store active connections for better management
const activeConnections = new Map();

wss.on('connection', (ws, req) => {
  let username = null;
  
  try {
    // Extract username from URL path
    const pathname = req.url;
    username = pathname.split('/').pop();
    
    console.log('WebSocket connection attempt for user:', username);
    
    if (username && data.users[username]) {
      // Store connection
      activeConnections.set(username, ws);
      data.users[username].ws = ws;
      data.users[username].online = true;
      data.users[username].lastPing = Date.now();
      
      console.log(`WebSocket connected for user: ${username}. Active connections: ${activeConnections.size}`);
      
      // Send immediate confirmation
      ws.send(JSON.stringify({ 
        type: 'connected', 
        message: 'WebSocket connected successfully',
        timestamp: Date.now()
      }));
      
      // Handle messages from client
      ws.on('message', (message) => {
        try {
          const msg = message.toString();
          
          // Handle ping messages from client
          if (msg === 'ping') {
            ws.send('pong');
            data.users[username].lastPing = Date.now();
            return;
          }
          
          // Handle other messages if needed
          try {
            const parsed = JSON.parse(msg);
            console.log('Received WebSocket message:', parsed);
          } catch (e) {
            // Not JSON, ignore
          }
        } catch (error) {
          console.error('Error handling WebSocket message:', error);
        }
      });
      
      ws.on('close', (code, reason) => {
        console.log(`WebSocket closed for ${username}: Code ${code}, Reason: ${reason?.toString() || 'No reason'}`);
        activeConnections.delete(username);
        if (data.users[username]) {
          data.users[username].ws = null;
          // Don't set online to false immediately - let the ping system handle it
        }
      });
      
      ws.on('error', (error) => {
        console.error(`WebSocket error for ${username}:`, error.message);
        activeConnections.delete(username);
        if (data.users[username]) {
          data.users[username].ws = null;
        }
      });
      
      // Set up heartbeat detection
      ws.isAlive = true;
      ws.on('pong', () => {
        ws.isAlive = true;
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
    if (username) {
      activeConnections.delete(username);
    }
    ws.close(1011, 'Server error');
  }
});

// Heartbeat interval - check connection health every 20 seconds
const heartbeatInterval = setInterval(() => {
  const now = Date.now();
  let aliveCount = 0;
  let deadCount = 0;
  
  wss.clients.forEach((ws) => {
    if (ws.isAlive === false) {
      deadCount++;
      console.log('Terminating dead WebSocket connection');
      return ws.terminate();
    }
    
    ws.isAlive = false;
    aliveCount++;
    
    try {
      // Send ping with timeout
      const pingTimeout = setTimeout(() => {
        if (ws.isAlive === false) {
          console.log('Ping timeout - terminating connection');
          ws.terminate();
        }
      }, 5000);
      
      ws.ping(() => {
        clearTimeout(pingTimeout);
      });
      
    } catch (error) {
      console.error('Error sending ping:', error);
      ws.terminate();
    }
  });
  
  if (deadCount > 0) {
    console.log(`Heartbeat: ${aliveCount} alive, ${deadCount} dead connections terminated`);
  }
}, 20000);

// Clean up inactive users every 30 seconds
const cleanupInterval = setInterval(() => {
  const now = Date.now();
  let cleanedCount = 0;
  
  Object.keys(data.users).forEach(username => {
    const user = data.users[username];
    if (user.online && now - user.lastPing > 60000) { // 60 seconds timeout
      console.log(`User ${username} marked as offline due to inactivity (last ping: ${now - user.lastPing}ms ago)`);
      user.online = false;
      user.ws = null;
      activeConnections.delete(username);
      cleanedCount++;
    }
  });
  
  if (cleanedCount > 0) {
    console.log(`Cleaned up ${cleanedCount} inactive users`);
  }
}, 30000);

// Clean up notifications periodically
const notificationCleanupInterval = setInterval(() => {
  const now = Date.now();
  let cleanedNotifications = 0;
  
  Object.keys(data.notifications).forEach(username => {
    // Remove notifications older than 1 hour
    const originalLength = data.notifications[username]?.length || 0;
    if (data.notifications[username]) {
      // For simplicity, we'll just clear all notifications periodically
      // In a real app, you'd track notification timestamps
      if (originalLength > 0) {
        cleanedNotifications += originalLength;
        data.notifications[username] = [];
      }
    }
  });
  
  if (cleanedNotifications > 0) {
    console.log(`Cleaned up ${cleanedNotifications} old notifications`);
  }
}, 3600000); // 1 hour

// Clean up old games (older than 24 hours)
const gameCleanupInterval = setInterval(() => {
  const now = Date.now();
  let cleanedGames = 0;
  
  Object.keys(data.games).forEach(gameId => {
    const game = data.games[gameId];
    // Simple cleanup: remove games that are over
    if (game.state.gameOver) {
      delete data.games[gameId];
      cleanedGames++;
    }
  });
  
  if (cleanedGames > 0) {
    console.log(`Cleaned up ${cleanedGames} finished games`);
  }
}, 3600000); // 1 hour

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('Received SIGTERM, shutting down gracefully...');
  
  clearInterval(heartbeatInterval);
  clearInterval(cleanupInterval);
  clearInterval(notificationCleanupInterval);
  clearInterval(gameCleanupInterval);
  
  // Close all WebSocket connections
  wss.clients.forEach((ws) => {
    ws.close(1001, 'Server shutdown');
  });
  
  server.close(() => {
    console.log('Server shut down gracefully');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('Received SIGINT, shutting down gracefully...');
  
  clearInterval(heartbeatInterval);
  clearInterval(cleanupInterval);
  clearInterval(notificationCleanupInterval);
  clearInterval(gameCleanupInterval);
  
  wss.clients.forEach((ws) => {
    ws.close(1001, 'Server shutdown');
  });
  
  server.close(() => {
    console.log('Server shut down gracefully');
    process.exit(0);
  });
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  // Don't exit the process, just log the error
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  // Don't exit the process, just log the error
});

console.log('WebSocket server initialized with heartbeat system');
console.log('Active intervals:');
console.log('  - Heartbeat check: 20 seconds');
console.log('  - User cleanup: 30 seconds');
console.log('  - Notification cleanup: 1 hour');
console.log('  - Game cleanup: 1 hour');

module.exports = app;
