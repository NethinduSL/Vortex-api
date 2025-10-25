const express = require('express');
const { v4: uuidv4 } = require('uuid');
const router = express.Router();
const { data, updateUserOnlineStatus } = require('../data');

router.get('/', (req, res) => {
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

router.post('/', (req, res) => {
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
      moves: [`Game created between ${sender} and ${username}`],
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

module.exports = router;
