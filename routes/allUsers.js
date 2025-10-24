const express = require('express');
const router = express.Router();

module.exports = (data) => {
  // Get all users (debug route)
  router.get('/', async (req, res) => {
    try {
      const allUsers = data.getAllUsers();
      res.json({
        count: allUsers.length,
        users: allUsers
      });
    } catch (error) {
      console.error('Error in /users/all route:', error);
      res.status(500).json({ 
        error: 'Internal server error in all users route',
        message: error.message 
      });
    }
  });

  // Error handler for this specific route
  router.use((error, req, res, next) => {
    console.error('All users route error:', error);
    res.status(500).json({ 
      error: 'All users route failed',
      message: error.message 
    });
  });

  return router;
};
