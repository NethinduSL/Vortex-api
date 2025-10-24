const express = require('express');
const router = express.Router();

module.exports = (data) => {
  // Get or create user by username query parameter
  router.get('/', async (req, res) => {
    try {
      const username = req.query.q;
      
      if (!username) {
        return res.status(400).json({ 
          error: 'Username is required. Use /user?q=username' 
        });
      }

      // Get existing user or create new one
      const user = data.getUser(username);
      
      if (user) {
        // Update last seen time
        data.updateLastSeen(username);
        res.json({ 
          message: 'User found',
          user 
        });
      } else {
        // Add new user
        const newUser = data.addUser(username);
        res.status(201).json({ 
          message: 'New user created',
          user: newUser 
        });
      }
    } catch (error) {
      console.error('Error in /user route:', error);
      res.status(500).json({ 
        error: 'Internal server error in user route',
        message: error.message 
      });
    }
  });

  // Error handler for this specific route
  router.use((error, req, res, next) => {
    console.error('User route error:', error);
    res.status(500).json({ 
      error: 'User route failed',
      message: error.message 
    });
  });

  return router;
};
