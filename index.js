const express = require('express');
const path = require('path');
const cors = require('cors');
const { WebSocketServer } = require('ws');
const http = require('http');
const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

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

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something broke!' });
});

wss.on('connection', (ws, req) => {
  const urlParts = req.url.split('/');
  const type = urlParts[1];
  if (type === 'game') {
    const gameId = urlParts[2];
    if (!data.games[gameId]) {
      ws.close();
      return;
    }
    data.games[gameId].players.push(ws);
    ws.on('message', (message) => {
      const parsed = JSON.parse(message);
      data.games[gameId].state = parsed.state || data.games[gameId].state;
      data.games[gameId].players.forEach(client => {
        if (client !== ws && client.readyState === client.OPEN) {
          client.send(JSON.stringify({ type: parsed.type || 'gameUpdate', state: data.games[gameId].state }));
        }
      });
    });
    ws.on('close', () => {
      data.games[gameId].players = data.games[gameId].players.filter(client => client !== ws);
      if (data.games[gameId].players.length === 0) {
        delete data.games[gameId];
      }
    });
  } else if (type === 'notify') {
    const username = urlParts[2];
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
