const express = require('express');
const router = express.Router();

module.exports = (data) => {
  // Get all online users
  router.get('/', async (req, res) => {
    try {
      const onlineUsers = data.getOnlineUsers();
      const usernames = onlineUsers.map(user => user.username);
      
      res.json({
        count: onlineUsers.length,
        users: usernames,
        details: onlineUsers
      });
    } catch (error) {
      console.error('Error in /online route:', error);
      res.status(500).json({ 
        error: 'Internal server error in online route',
        message: error.message 
      });
    }
  });

  // Error handler for this specific route
  router.use((error, req, res, next) => {
    console.error('Online route error:', error);
    res.status(500).json({ 
      error: 'Online route failed',
      message: error.message 
    });
  });

  return router;
};
