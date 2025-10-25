const express = require('express');
const WebSocket = require('ws');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// CORS configuration
app.use(cors({
  origin: [
    'https://vortex-islands-api.vercel.app',
    'http://localhost:3000',
    'http://localhost:8080',
    undefined // for server-to-server
  ],
  credentials: true
}));

app.use(express.json());
app.use(express.static('public'));

// In-memory data store
const data = {
  users: {},
  games: {},
  notifications: {}
};

// Helper functions
function updateUserOnlineStatus(username) {
  if (data.users[username]) {
    data.users[username].lastPing = Date.now();
    data.users[username].online = true;
  }
}

function cleanupInactiveUsers() {
  const now = Date.now();
  Object.keys(data.users).forEach(username => {
    if (now - data.users[username].lastPing > 30000) { // 30 seconds
      data.users[username].online = false;
    }
  });
}

function getOnlineUsers() {
  cleanupInactiveUsers();
  return Object.keys(data.users).filter(username => data.users[username].online);
}

function evaluateRPS(choice1, choice2) {
  if (choice1 === choice2) return null; // tie
  
  const rules = {
    'rock': 'officer',
    'paper': 'rock', 
    'officer': 'paper'
  };
  
  return rules[choice1] === choice2 ? 'player1' : 'player2';
}

// Routes
app.post('/user', (req, res) => {
  const username = req.query.q;
  
  if (!username || username.length > 20) {
    return res.status(400).json({ error: 'Username must be 1-20 characters' });
  }
  
  if (data.users[username] && data.users[username].online) {
    return res.status(409).json({ error: 'Username already taken' });
  }
  
  data.users[username] = {
    online: true,
    lastPing: Date.now(),
    ws: null
  };
  
  res.json({ success: true, username });
});

app.get('/user', (req, res) => {
  const username = req.query.q;
  
  if (!data.users[username]) {
    return res.status(404).json({ error: 'User not found' });
  }
  
  updateUserOnlineStatus(username);
  res.json({ online: data.users[username].online });
});

app.get('/online', (req, res) => {
  const onlineUsers = getOnlineUsers();
  res.json(onlineUsers);
});

app.post('/notify', (req, res) => {
  const { username, sender } = req.body;
  
  if (!data.users[username] || !data.users[sender]) {
    return res.status(404).json({ error: 'User not found' });
  }
  
  // Store notification
  if (!data.notifications[username]) {
    data.notifications[username] = [];
  }
  data.notifications[username].push(sender);
  
  // Send WebSocket notification if available
  if (data.users[username].ws) {
    data.users[username].ws.send(JSON.stringify({
      type: 'game_request',
      from: sender
    }));
  }
  
  res.json({ success: true });
});

app.get('/accept', (req, res) => {
  const username = req.query.username;
  
  if (!username || !data.users[username]) {
    return res.status(404).json({ error: 'User not found' });
  }
  
  updateUserOnlineStatus(username);
  
  // Check if user has any pending game requests
  const pendingRequests = data.notifications[username] || [];
  
  // Check if user is already in a game
  let currentGame = null;
  Object.keys(data.games).forEach(gameId => {
    const game = data.games[gameId];
    if (game.state.players && 
        (game.state.players[0] === username || game.state.players[1] === username)) {
      currentGame = {
        gameId,
        opponent: game.state.players[0] === username ? game.state.players[1] : game.state.players[0]
      };
    }
  });
  
  res.json({
    requests: pendingRequests,
    currentGame
  });
});

app.post('/accept', (req, res) => {
  const { username, sender } = req.body;
  
  if (!data.users[username] || !data.users[sender]) {
    return res.status(404).json({ error: 'User not found' });
  }
  
  // Remove notification
  if (data.notifications[username]) {
    data.notifications[username] = data.notifications[username].filter(s => s !== sender);
  }
  
  // Create game
  const gameId = uuidv4();
  data.games[gameId] = {
    state: {
      players: [sender, username],
      playersConnected: 0,
      scores: { [sender]: 0, [username]: 0 },
      islands: {
        [sender]: { parts: 10, shields: 0 },
        [username]: { parts: 10, shields: 0 }
      },
      moves: [],
      phase: 'rps',
      turn: null,
      pendingRPS: {},
      winner: null,
      gameOver: false
    }
  };
  
  // Notify sender via WebSocket if available
  if (data.users[sender].ws) {
    data.users[sender].ws.send(JSON.stringify({
      type: 'game_start',
      gameId,
      opponent: username
    }));
  }
  
  res.json({ gameId, opponent: sender });
});

app.get('/game-state/:gameId', (req, res) => {
  const gameId = req.params.gameId;
  
  if (!data.games[gameId]) {
    return res.status(404).json({ error: 'Game not found' });
  }
  
  res.json(data.games[gameId].state);
});

app.post('/game-action/:gameId', (req, res) => {
  const gameId = req.params.gameId;
  const { type, username, choice, action } = req.body;
  
  if (!data.games[gameId]) {
    return res.status(404).json({ error: 'Game not found' });
  }
  
  const game = data.games[gameId];
  const state = game.state;
  
  try {
    switch (type) {
      case 'join':
        if (state.playersConnected < 2) {
          state.playersConnected++;
          
          if (state.playersConnected === 2) {
            // Both players joined, randomly assign first turn
            state.turn = state.players[Math.floor(Math.random() * 2)];
            state.moves.push(`Game started! ${state.turn} goes first.`);
          }
        }
        break;
        
      case 'rps':
        if (state.phase !== 'rps' || state.turn !== username) {
          return res.status(400).json({ error: 'Not your turn or wrong phase' });
        }
        
        if (!['rock', 'paper', 'officer'].includes(choice)) {
          return res.status(400).json({ error: 'Invalid RPS choice' });
        }
        
        state.pendingRPS[username] = choice;
        state.moves.push(`${username} chose ${choice}`);
        
        // Check if both players have made RPS choices
        const players = state.players;
        if (state.pendingRPS[players[0]] && state.pendingRPS[players[1]]) {
          const result = evaluateRPS(
            state.pendingRPS[players[0]],
            state.pendingRPS[players[1]]
          );
          
          if (result === null) {
            // Tie
            state.moves.push(`Tie! Both chose ${state.pendingRPS[players[0]]}. Replaying RPS.`);
            state.pendingRPS = {};
            // Keep turn random for replay
            state.turn = players[Math.floor(Math.random() * 2)];
          } else {
            // Winner determined
            const winner = result === 'player1' ? players[0] : players[1];
            const loser = result === 'player1' ? players[1] : players[0];
            
            state.winner = winner;
            state.scores[winner] += 10;
            state.phase = 'action';
            state.turn = winner;
            
            state.moves.push(
              `${winner} won RPS (${state.pendingRPS[winner]} vs ${state.pendingRPS[loser]}) and gained 10 points!`
            );
            state.pendingRPS = {};
          }
        } else {
          // Switch turn to other player
          state.turn = state.players.find(p => p !== username);
        }
        break;
        
      case 'action':
        if (state.phase !== 'action' || state.turn !== username || state.winner !== username) {
          return res.status(400).json({ error: 'Not your action phase' });
        }
        
        const opponent = state.players.find(p => p !== username);
        
        switch (action) {
          case 'mortar':
            if (state.islands[opponent].shields > 0) {
              state.islands[opponent].shields--;
              state.moves.push(`${username} used Mortar! ${opponent}'s shields reduced to ${state.islands[opponent].shields}`);
            } else {
              state.moves.push(`${username} used Mortar! ${opponent} has no shields to reduce`);
            }
            break;
            
          case 'shield':
            if (state.islands[username].shields < 3) {
              state.islands[username].shields++;
              state.moves.push(`${username} bought Shield! Shields increased to ${state.islands[username].shields}`);
            } else {
              state.moves.push(`${username} tried to buy Shield but already at maximum (3)`);
            }
            break;
            
          case 'slicer':
            if (state.islands[opponent].shields === 0) {
              state.islands[opponent].parts--;
              state.moves.push(`${username} used Slicer! ${opponent}'s island parts reduced to ${state.islands[opponent].parts}`);
              
              // Check for game end
              if (state.islands[opponent].parts <= 0) {
                state.gameOver = true;
                state.moves.push(`Game over! ${username} destroyed ${opponent}'s island!`);
              }
            } else {
              state.moves.push(`${username} used Slicer but ${opponent} has shields! No damage dealt.`);
            }
            break;
            
          default:
            return res.status(400).json({ error: 'Invalid action' });
        }
        
        // Switch back to RPS phase
        if (!state.gameOver) {
          state.phase = 'rps';
          state.winner = null;
          state.turn = opponent;
        }
        break;
        
      default:
        return res.status(400).json({ error: 'Invalid action type' });
    }
    
    res.json({ success: true, state });
  } catch (error) {
    console.error('Game action error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

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
      console.error('WebSocket error:', error);
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
