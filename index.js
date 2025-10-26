const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: ["http://localhost:3000", "http://localhost:8080"],
    methods: ["GET", "POST"]
  }
});

const PORT = process.env.PORT || 3000;

// CORS configuration
app.use(cors({
  origin: ['http://localhost:3000', 'http://localhost:8080'],
  credentials: true
}));

app.use(express.json());
app.use(express.static('public'));

// Simple in-memory storage
const gameState = {
  users: {},
  games: {},
  notifications: {}
};

// Game logic helper
function evaluateRPS(choice1, choice2) {
  if (choice1 === choice2) return null;
  const rules = { 'rock': 'officer', 'paper': 'rock', 'officer': 'paper' };
  return rules[choice1] === choice2 ? 'player1' : 'player2';
}

// Serve frontend
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/game', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'game.html'));
});

// API Routes (for initial setup)
app.post('/user', (req, res) => {
  const username = req.query.q;
  
  if (!username || username.length > 20) {
    return res.status(400).json({ error: 'Username must be 1-20 characters' });
  }
  
  if (gameState.users[username] && gameState.users[username].online) {
    return res.status(409).json({ error: 'Username already taken' });
  }
  
  gameState.users[username] = {
    online: true,
    socketId: null
  };
  
  res.json({ success: true, username });
});

app.get('/online', (req, res) => {
  const onlineUsers = Object.keys(gameState.users).filter(username => 
    gameState.users[username].online
  );
  res.json(onlineUsers);
});

// Socket.io Connection Handling
io.on('connection', (socket) => {
  console.log('🔗 User connected:', socket.id);

  // Register user with socket
  socket.on('register', (username) => {
    if (gameState.users[username]) {
      gameState.users[username].socketId = socket.id;
      gameState.users[username].online = true;
      console.log(`✅ User ${username} registered with socket ${socket.id}`);
      
      // Send back registration confirmation
      socket.emit('registered', { success: true });
      
      // Notify about pending game requests
      if (gameState.notifications[username]) {
        gameState.notifications[username].forEach(sender => {
          socket.emit('game_request', { from: sender });
        });
      }
    }
  });

  // Send game request
  socket.on('send_game_request', (data) => {
    const { username, sender } = data;
    
    if (!gameState.notifications[username]) {
      gameState.notifications[username] = [];
    }
    gameState.notifications[username].push(sender);
    
    // Notify the recipient if they're online
    const recipient = gameState.users[username];
    if (recipient && recipient.socketId) {
      io.to(recipient.socketId).emit('game_request', { from: sender });
    }
    
    console.log(`🎯 Game request sent from ${sender} to ${username}`);
  });

  // Accept game request
  socket.on('accept_game_request', (data) => {
    const { username, sender } = data;
    
    // Remove notification
    if (gameState.notifications[username]) {
      gameState.notifications[username] = gameState.notifications[username].filter(s => s !== sender);
    }
    
    // Create game
    const gameId = uuidv4();
    gameState.games[gameId] = {
      players: [sender, username],
      sockets: {},
      state: {
        playersConnected: 0,
        scores: { [sender]: 0, [username]: 0 },
        islands: {
          [sender]: { parts: 10, shields: 0 },
          [username]: { parts: 10, shields: 0 }
        },
        moves: [`Game created between ${sender} and ${username}`],
        phase: 'rps',
        turn: null,
        pendingRPS: {},
        winner: null,
        gameOver: false
      }
    };
    
    console.log(`🎮 Game created: ${gameId} - ${sender} vs ${username}`);
    
    // Notify both players
    const senderUser = gameState.users[sender];
    const acceptorUser = gameState.users[username];
    
    if (senderUser && senderUser.socketId) {
      io.to(senderUser.socketId).emit('game_start', { 
        gameId, 
        opponent: username 
      });
    }
    
    if (acceptorUser && acceptorUser.socketId) {
      io.to(acceptorUser.socketId).emit('game_start', { 
        gameId, 
        opponent: sender 
      });
    }
  });

  // Join game
  socket.on('join_game', (data) => {
    const { gameId, username } = data;
    
    if (!gameState.games[gameId]) {
      socket.emit('error', { message: 'Game not found' });
      return;
    }
    
    const game = gameState.games[gameId];
    
    // Store socket for this game
    game.sockets[username] = socket.id;
    
    if (game.state.playersConnected < 2) {
      game.state.playersConnected++;
      game.state.moves.push(`${username} joined the game`);
      
      if (game.state.playersConnected === 2) {
        // Both players joined, start the game
        game.state.turn = game.players[Math.floor(Math.random() * 2)];
        game.state.moves.push(`🎮 Both players connected! ${game.state.turn} goes first.`);
        
        console.log(`✅ Game ${gameId} started with both players`);
      }
      
      // Broadcast updated game state to all players in this game
      broadcastGameState(gameId);
    }
  });

  // Make RPS choice
  socket.on('make_rps_choice', (data) => {
    const { gameId, username, choice } = data;
    
    if (!gameState.games[gameId]) {
      socket.emit('error', { message: 'Game not found' });
      return;
    }
    
    const game = gameState.games[gameId];
    const state = game.state;
    
    if (state.phase !== 'rps' || state.turn !== username) {
      socket.emit('error', { message: 'Not your turn or wrong phase' });
      return;
    }
    
    state.pendingRPS[username] = choice;
    state.moves.push(`${username} chose ${choice}`);
    
    // Switch turn to other player
    state.turn = game.players.find(p => p !== username);
    
    // Check if both players have made RPS choices
    if (state.pendingRPS[game.players[0]] && state.pendingRPS[game.players[1]]) {
      const result = evaluateRPS(
        state.pendingRPS[game.players[0]],
        state.pendingRPS[game.players[1]]
      );
      
      if (result === null) {
        // Tie
        state.moves.push(`⚖️ Tie! Replaying RPS.`);
        state.pendingRPS = {};
        state.turn = game.players[Math.floor(Math.random() * 2)];
      } else {
        // Winner determined
        const winner = result === 'player1' ? game.players[0] : game.players[1];
        state.winner = winner;
        state.scores[winner] += 10;
        state.phase = 'action';
        state.turn = winner;
        
        state.moves.push(`🎉 ${winner} won RPS and gained 10 points!`);
        state.pendingRPS = {};
      }
    }
    
    // Broadcast updated game state
    broadcastGameState(gameId);
  });

  // Make action
  socket.on('make_action', (data) => {
    const { gameId, username, action } = data;
    
    if (!gameState.games[gameId]) {
      socket.emit('error', { message: 'Game not found' });
      return;
    }
    
    const game = gameState.games[gameId];
    const state = game.state;
    
    if (state.phase !== 'action' || state.turn !== username || state.winner !== username) {
      socket.emit('error', { message: 'Not your action phase' });
      return;
    }
    
    const opponent = game.players.find(p => p !== username);
    
    switch (action) {
      case 'mortar':
        if (state.islands[opponent].shields > 0) {
          state.islands[opponent].shields--;
          state.moves.push(`💥 ${username} used Mortar!`);
        } else {
          state.moves.push(`💥 ${username} used Mortar! No shields to reduce.`);
        }
        break;
        
      case 'shield':
        if (state.islands[username].shields < 3) {
          state.islands[username].shields++;
          state.moves.push(`🛡️ ${username} bought Shield!`);
        } else {
          state.moves.push(`🛡️ ${username} tried to buy Shield but at maximum.`);
        }
        break;
        
      case 'slicer':
        if (state.islands[opponent].shields === 0) {
          state.islands[opponent].parts--;
          state.moves.push(`🔪 ${username} used Slicer!`);
          
          if (state.islands[opponent].parts <= 0) {
            state.gameOver = true;
            state.moves.push(`🎯 Game over! ${username} wins!`);
          }
        } else {
          state.moves.push(`🔪 ${username} used Slicer but shields blocked it!`);
        }
        break;
    }
    
    // Switch back to RPS phase if game not over
    if (!state.gameOver) {
      state.phase = 'rps';
      state.winner = null;
      state.turn = opponent;
    }
    
    // Broadcast updated game state
    broadcastGameState(gameId);
  });

  // Request game state
  socket.on('get_game_state', (data) => {
    const { gameId } = data;
    
    if (!gameState.games[gameId]) {
      socket.emit('error', { message: 'Game not found' });
      return;
    }
    
    socket.emit('game_state_update', gameState.games[gameId].state);
  });

  // Helper function to broadcast game state to all players in a game
  function broadcastGameState(gameId) {
    const game = gameState.games[gameId];
    if (!game) return;
    
    game.players.forEach(player => {
      const playerSocketId = game.sockets[player];
      if (playerSocketId) {
        io.to(playerSocketId).emit('game_state_update', game.state);
      }
    });
  }

  // Handle disconnection
  socket.on('disconnect', () => {
    console.log('🔌 User disconnected:', socket.id);
    
    // Mark user as offline
    Object.keys(gameState.users).forEach(username => {
      if (gameState.users[username].socketId === socket.id) {
        gameState.users[username].online = false;
        gameState.users[username].socketId = null;
        console.log(`📴 User ${username} went offline`);
      }
    });
  });
});

// Start server
server.listen(PORT, '0.0.0.0', () => {
  console.log(`🎮 Vortex Islands Server running on port ${PORT}`);
  console.log(`📱 Access: http://localhost:${PORT}`);
  console.log('✅ Using Socket.io for real-time communication');
});

module.exports = app;
