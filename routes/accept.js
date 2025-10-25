const express = require('express');
const { v4: uuidv4 } = require('uuid');
const data = require('../data');

const router = express.Router();

router.post('/', (req, res) => {
  const { username, sender } = req.body;
  if (!username || !sender || !data.users[username] || !data.users[sender]) {
    return res.status(400).json({ error: 'Invalid usernames' });
  }
  const gameId = uuidv4();
  data.games[gameId] = {
    state: {
      playersConnected: 0,
      turn: '',
      scores: { [sender]: 0, [username]: 0 },
      islands: {
        [sender]: { parts: 10, shields: 0 },
        [username]: { parts: 10, shields: 0 }
      },
      moves: [],
      phase: 'rps',
      pendingRPS: {}
    }
  };
  if (data.users[sender].ws) {
    data.users[sender].ws.send(JSON.stringify({ type: 'gameStart', gameId, opponent: username }));
  }
  res.json({ gameId, opponent: sender });
});

module.exports = router;
