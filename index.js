const express = require('express');
const path = require('path');
const cors = require('cors');
const app = express();

const corsOptions = {
  origin: (origin, callback) => {
    const allowedOrigins = [
      'https://vortex-islands-api.vercel.app',
      'http://localhost:8080',
      'http://localhost:3000'
    ];
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, origin || '*');
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type'],
};

app.use(cors(corsOptions));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const data = require('./data');

function updateUserStatuses() {
  const now = Date.now();
  for (const username in data.users) {
    if (now - data.users[username].lastPing > 30000) {
      data.users[username].online = false;
    }
  }
}

app.use((req, res, next) => {
  updateUserStatuses();
  next();
});

app.use('/user', require('./routes/user'));
app.use('/online', require('./routes/online'));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something broke!' });
});

module.exports = app;
