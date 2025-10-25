const express = require('express');
const data = require('../data');

const router = express.Router();

router.post('/', (req, res) => {
  const { q: username } = req.query;
  if (!username) {
    return res.status(400).json({ error: 'Username required' });
  }
  if (data.users[username]) {
    return res.status(400).json({ error: 'Username already taken' });
  }
  data.users[username] = { online: true, lastPing: Date.now(), ws: null };
  res.json({ success: true });
});

router.get('/', (req, res) => {
  const { q: username } = req.query;
  if (!username) {
    return res.status(400).json({ error: 'Username required' });
  }
  if (data.users[username]) {
    data.users[username].lastPing = Date.now();
    data.users[username].online = true;
    res.json({ success: true });
  } else {
    res.status(404).json({ error: 'User not found' });
  }
});

module.exports = router;
