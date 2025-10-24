// routes/online.js
const express = require('express');
const router = express.Router();
const data = require('../data');

router.get('/', (req, res, next) => {
  try {
    const onlineUsers = Object.keys(data.users).filter(username => data.users[username].online);
    res.json({ onlineUsers });
  } catch (err) {
    next(err); // Pass to error handler
  }
});

module.exports = router;
