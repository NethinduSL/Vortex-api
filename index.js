// index.js
const express = require('express');
const path = require('path');
const app = express();
const port = process.env.PORT || 3000;

// Middleware to parse JSON
app.use(express.json());

// Serve static files (for index.html)
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
  // Update statuses on every request (since serverless, no background tasks)
  updateUserStatuses();
  next();
});

app.use('/user', require('./routes/user'));
app.use('/online', require('./routes/online'));

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).send('Something broke!');
});

// Serve index.html at root for testing
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});

module.exports = app; // For Vercel
