const express = require('express');
const router = express.Router();
const { getOnlineUsers } = require('../data');

router.get('/', (req, res) => {
  const onlineUsers = getOnlineUsers();
  res.json(onlineUsers);
});

module.exports = router;
