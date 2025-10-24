const express = require('express');
const path = require('path');
const data = require('./data');

const app = express();
const PORT = 3000;

// Middleware
app.use(express.json());
app.use(express.static('public'));

// Serve HTML file at root
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Route loader with individual error handling
const loadRoute = (routePath, routeFile, routeName) => {
  try {
    const route = require(routeFile);
    app.use(routePath, route(data));
    console.log(`✓ ${routeName} route loaded successfully at ${routePath}`);
  } catch (error) {
    console.error(`✗ Failed to load ${routeName} route:`, error.message);
    
    // Create a fallback error route
    app.use(routePath, (req, res) => {
      res.status(503).json({
        error: `${routeName} route is currently unavailable`,
        message: 'This route failed to load. Other routes may still be working.'
      });
    });
  }
};

// Load routes individually with error handling
loadRoute('/user', './routes/user', 'User');
loadRoute('/online', './routes/online', 'Online');
loadRoute('/users/all', './routes/allUsers', 'All Users');

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok',
    message: 'Server is running',
    timestamp: new Date().toISOString()
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ 
    error: 'Route not found',
    availableRoutes: ['/user?q=username', '/online', '/users/all', '/health']
  });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('Unexpected error:', err);
  res.status(500).json({ 
    error: 'Internal server error',
    message: 'An unexpected error occurred, but the server is still running'
  });
});

// Graceful error handling for server startup
const server = app.listen(PORT, () => {
  console.log('\n🎮 Game API Server Started');
  console.log(`📡 Server running on http://localhost:${PORT}`);
  console.log('\n📋 Available Routes:');
  console.log('  GET /user?q=username  - Get or create user');
  console.log('  GET /online           - Get all online users');
  console.log('  GET /users/all        - Get all users (debug)');
  console.log('  GET /health           - Server health check');
  console.log('\n');
}).on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`Port ${PORT} is already in use. Please try a different port.`);
  } else {
    console.error('Server error:', err);
  }
  process.exit(1);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, closing server gracefully...');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('\nSIGINT received, closing server gracefully...');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});
