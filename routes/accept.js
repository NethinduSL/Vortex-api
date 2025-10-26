const express = require('express');
const { v4: uuidv4 } = require('uuid');
const router = express.Router();
const { data, updateUserOnlineStatus, createGameSession } = require('../data');

router.get('/', (req, res) => {
  const username = req.query.username;
  
  if (!username || !data.users[username]) {
    return res.status(404).json({ error: 'User not found' });
  }
  
  updateUserOnlineStatus(username);
  
  // Check pending game requests
  const pendingRequests = data.notifications[username] || [];
  
  // Check if user is already in a game
  let currentGame = null;
  Object.keys(data.games).forEach(gameId => {
    const game = data.games[gameId];
    if (game.state.players.includes(username)) {
      currentGame = {
        gameId,
        opponent: game.state.players.find(p => p !== username),
        playersConnected: game.state.playersConnected
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
  
  // Create game session
  createGameSession(gameId, sender, username);
  
  console.log(`🎯 Game created: ${gameId} - ${sender} vs ${username}`);
  
  res.json({ 
    gameId, 
    opponent: sender,
    message: 'Game created successfully' 
  });
});

module.exports = router;
