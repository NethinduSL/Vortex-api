const express = require('express');
const router = express.Router();
const { data } = require('../data');

router.post('/', (req, res) => {
  const { username, sender } = req.body;
  
  if (!data.users[username] || !data.users[sender]) {
    return res.status(404).json({ error: 'User not found' });
  }
  
  // Store notification
  if (!data.notifications[username]) {
    data.notifications[username] = [];
  }
  data.notifications[username].push(sender);
  
  // Send WebSocket notification if available
  if (data.users[username].ws) {
    data.users[username].ws.send(JSON.stringify({
      type: 'game_request',
      from: sender
    }));
  }
  
  res.json({ success: true });
});

module.exports = router;
