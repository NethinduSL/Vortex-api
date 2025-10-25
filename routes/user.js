const express = require('express');
const router = express.Router();
const { data, updateUserOnlineStatus } = require('../data');

router.post('/', (req, res) => {
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

router.get('/', (req, res) => {
  const username = req.query.q;
  
  if (!data.users[username]) {
    return res.status(404).json({ error: 'User not found' });
  }
  
  updateUserOnlineStatus(username);
  res.json({ online: data.users[username].online });
});

module.exports = router;
