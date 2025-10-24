const express = require('express');
const router = express.Router();
const data = require('../data');

router.get('/', (req, res, next) => {
  try {
    const username = req.query.q;
    if (!username) {
      return res.status(400).json({ error: 'Username query parameter "q" is required' });
    }
    const now = Date.now();
    if (!data.users[username]) {
      data.users[username] = {
        online: true,
        lastPing: now,
        otherStats: {},
        notification: null
      };
    } else {
      data.users[username].online = true;
      data.users[username].lastPing = now;
    }
    const notification = data.notifications[username] || null;
    res.json({ message: `User ${username} is now online`, user: data.users[username], notification });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
