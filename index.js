// index.js
const express = require('express');
const path = require('path');
const cors = require('cors'); // Add CORS package
const app = express();

// CORS configuration
const corsOptions = {
  origin: process.env.NODE_ENV === 'production'
    ? 'https://vortex-islands-api.vercel.app' // Your Vercel app URL in production
    : ['http://localhost:8080', 'http://localhost:3000'], // Allow local dev origins
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type'],
};

// Apply CORS middleware
app.use(cors(corsOptions));

// Middleware to parse JSON
app.use(express.json());

// Serve static files from the public directory
app.use(express.static(path.join(__dirname, 'public')));

// Data module
const data = require('./data');

// Function to update all user statuses based on last ping time
function updateUserStatuses() {
  const now = Date.now();
  for (const username in data.users) {
    if (now - data.users[username].lastPing > 30000) {
      data.users[username].online = false;
    }
  }
}

// Routes
app.use((req, res, next) => {
  updateUserStatuses();
  next();
});

app.use('/user', require('./routes/user'));
app.use('/online', require('./routes/online'));

// Serve index.html at root for testing
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something broke!' });
});

// Export for Vercel serverless function
module.exports = app;
