// routes/user.js
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
        otherStats: {} // Add any other user variables/stats here
      };
    } else {
      data.users[username].online = true;
      data.users[username].lastPing = now;
    }
    
    res.json({ message: `User ${username} is now online`, user: data.users[username] });
  } catch (err) {
    next(err); // Pass to error handler
  }
});

module.exports = router;
