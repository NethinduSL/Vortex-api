const express = require('express');
const { v4: uuidv4 } = require('uuid');
const router = express.Router();
const { data, updateUserOnlineStatus } = require('../data');

router.get('/', (req, res) => {
  const username = req.query.username;
  
  console.log('Accept GET request for user:', username);
  
  if (!username || !data.users[username]) {
    console.log('User not found during accept check:', username);
    return res.status(404).json({ error: 'User not found' });
  }
  
  updateUserOnlineStatus(username);
  
  // Check if user has any pending game requests
  const pendingRequests = data.notifications[username] || [];
  
  console.log(`Pending requests for ${username}:`, pendingRequests);
  
  // Check if user is already in a game
  let currentGame = null;
  Object.keys(data.games).forEach(gameId => {
    const game = data.games[gameId];
    if (game.state.players && 
        (game.state.players[0] === username || game.state.players[1] === username)) {
      currentGame = {
        gameId,
        opponent: game.state.players[0] === username ? game.state.players[1] : game.state.players[0],
        playersConnected: game.state.playersConnected
      };
      console.log(`Found existing game for ${username}:`, currentGame);
    }
  });
  
  res.json({
    requests: pendingRequests,
    currentGame
  });
});

router.post('/', (req, res) => {
  const { username, sender } = req.body;
  
  console.log('Accept POST request - creating game:', { username, sender });
  
  if (!data.users[username] || !data.users[sender]) {
    console.log('User not found during game creation:', { username, sender });
    return res.status(404).json({ error: 'User not found' });
  }
  
  // Remove notification
  if (data.notifications[username]) {
    const originalLength = data.notifications[username].length;
    data.notifications[username] = data.notifications[username].filter(s => s !== sender);
    console.log(`Removed notification from ${sender} to ${username}. Was ${originalLength}, now ${data.notifications[username].length}`);
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
  
  console.log(`Game created: ${gameId} for ${sender} and ${username}`);
  console.log('All active games:', Object.keys(data.games));
  
  // Update both users' online status
  updateUserOnlineStatus(username);
  updateUserOnlineStatus(sender);
  
  // Notify sender via WebSocket if available
  let wsNotificationSent = false;
  if (data.users[sender] && data.users[sender].ws) {
    try {
      // Check if WebSocket is actually connected
      if (data.users[sender].ws.readyState === 1) { // 1 = OPEN
        data.users[sender].ws.send(JSON.stringify({
          type: 'game_start',
          gameId,
          opponent: username,
          timestamp: Date.now()
        }));
        wsNotificationSent = true;
        console.log(`WebSocket notification successfully sent to ${sender}`);
      } else {
        console.log(`WebSocket for ${sender} is not open (state: ${data.users[sender].ws.readyState})`);
      }
    } catch (error) {
      console.error(`Failed to send WebSocket to ${sender}:`, error.message);
      // Mark WebSocket as broken
      data.users[sender].ws = null;
    }
  } else {
    console.log(`No active WebSocket available for ${sender}`);
  }
  
  // Also notify the acceptor via WebSocket if they're still on the lobby page
  if (data.users[username] && data.users[username].ws) {
    try {
      if (data.users[username].ws.readyState === 1) {
        data.users[username].ws.send(JSON.stringify({
          type: 'game_start',
          gameId,
          opponent: sender,
          timestamp: Date.now()
        }));
        console.log(`WebSocket notification also sent to acceptor ${username}`);
      }
    } catch (error) {
      console.error(`Failed to send WebSocket to acceptor ${username}:`, error.message);
      data.users[username].ws = null;
    }
  }
  
  const response = {
    gameId,
    opponent: sender,
    wsNotificationSent
  };
  
  console.log('Sending response:', response);
  res.json(response);
});

module.exports = router;
