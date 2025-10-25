const express = require('express');
const path = require('path');
const cors = require('cors');
const { WebSocketServer } = require('ws');
const http = require('http');
const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });
const gameRouter = require('./routes/game');

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
app.use('/notify', require('./routes/notify'));
app.use('/accept', require('./routes/accept'));
app.use('/game-action', gameRouter);

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.use((err, req, res, next) => {
  console.error('Express error:', err.stack);
  res.status(500).json({ error: 'Something broke!' });
});

wss.on('connection', (ws, req) => {
  const urlParts = req.url.split('/');
  const type = urlParts[1];
  if (type === 'notify') {
    const username = decodeURIComponent(urlParts[2]);
    if (!data.users[username]) {
      ws.close();
      return;
    }
    data.users[username].ws = ws;
    ws.on('close', () => {
      if (data.users[username]) {
        data.users[username].ws = null;
      }
    });
  }
});

server.listen(process.env.PORT || 3000);
module.exports = app;
