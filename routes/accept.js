const express = require('express');
const router = express.Router();
const data = require('../data');
const { v4: uuidv4 } = require('uuid');

router.post('/', (req, res) => {
  const { username, sender } = req.body;
  if (!username || !sender || !data.notifications[username] || data.notifications[username].sender !== sender) {
    return res.status(400).json({ error: 'Invalid or no pending notification' });
  }
  const gameId = uuidv4();
  data.games[gameId] = {
    players: [],
    state: {
      turn: sender,
      moves: [],
      scores: { [sender]: 0, [username]: 0 },
      islands: {
        [sender]: { parts: 4, shields: 0 },
        [username]: { parts: 4, shields: 0 }
      }
    }
  };
  data.notifications[username] = { gameId };
  data.notifications[sender] = { gameId };
  if (data.users[username]?.ws) {
    data.users[username].ws.send(JSON.stringify({ type: 'gameStart', gameId }));
  }
  if (data.users[sender]?.ws) {
    data.users[sender].ws.send(JSON.stringify({ type: 'gameStart', gameId }));
  }
  res.json({ gameId, message: `Game started between ${sender} and ${username}` });
});

module.exports = router;
