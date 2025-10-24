const express = require('express');
const router = express.Router();
const data = require('../data');

router.post('/', (req, res) => {
  const { sender, receiver } = req.body;
  if (!sender || !receiver || !data.users[receiver]) {
    return res.status(400).json({ error: 'Invalid sender or receiver' });
  }
  data.notifications[receiver] = { sender, timestamp: Date.now() };
  res.json({ message: `Notification sent to ${receiver}` });
});

module.exports = router;
