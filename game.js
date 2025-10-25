const { WebSocketServer } = require('ws');
const data = require('./data');

function setupGameWebSocket(server) {
  const wss = new WebSocketServer({ server, path: '/game' });
  wss.on('connection', (ws, req) => {
    const gameId = req.url.split('/').pop();
    if (!data.games[gameId]) {
      ws.close();
      return;
    }
    data.games[gameId].players.push(ws);
    ws.on('message', (message) => {
      const parsed = JSON.parse(message);
      if (parsed.type === 'join') {
        data.games[gameId].state.playersConnected = (data.games[gameId].state.playersConnected || 0) + 1;
        if (data.games[gameId].state.playersConnected === 2 && !data.games[gameId].state.turn) {
          const players = Object.keys(data.games[gameId].state.scores);
          data.games[gameId].state.turn = players[Math.floor(Math.random() * 2)];
        }
        data.games[gameId].players.forEach(client => {
          if (client.readyState === client.OPEN) {
            client.send(JSON.stringify({ type: 'join', state: data.games[gameId].state }));
          }
        });
      } else if (parsed.type === 'rps') {
        data.games[gameId].state = parsed.state;
        const players = Object.keys(data.games[gameId].state.scores);
        const opponent = players.find(u => u !== parsed.state.turn);
        const opponentChoice = data.games[gameId].state.pendingRPS && data.games[gameId].state.pendingRPS[opponent];
        const myChoice = data.games[gameId].state.pendingRPS && data.games[gameId].state.pendingRPS[parsed.state.turn];
        if (!myChoice || !opponentChoice) {
          data.games[gameId].players.forEach(client => {
            if (client.readyState === client.OPEN) {
              client.send(JSON.stringify({ type: 'rps', state: data.games[gameId].state }));
            }
          });
          return;
        }
        const result = getRPSResult(myChoice, opponentChoice);
        const newState = JSON.parse(JSON.stringify(data.games[gameId].state));
        if (result === 'win') {
          newState.scores[parsed.state.turn] += 10;
          newState.moves.push(`${parsed.state.turn} won RPS (${myChoice} vs ${opponentChoice})`);
          newState.phase = 'action';
          newState.turn = parsed.state.turn;
          newState.winner = parsed.state.turn;
        } else if (result === 'lose') {
          newState.scores[opponent] += 10;
          newState.moves.push(`${opponent} won RPS (${opponentChoice} vs ${myChoice})`);
          newState.phase = 'action';
          newState.turn = opponent;
          newState.winner = opponent;
        } else {
          newState.moves.push(`RPS tie (${myChoice} vs ${opponentChoice})`);
          newState.phase = 'rps';
          newState.turn = players[Math.floor(Math.random() * 2)];
          newState.winner = null;
        }
        newState.pendingRPS = {};
        data.games[gameId].state = newState;
        data.games[gameId].players.forEach(client => {
          if (client.readyState === client.OPEN) {
            client.send(JSON.stringify({ type: 'rpsResult', state: data.games[gameId].state }));
          }
        });
      } else {
        data.games[gameId].state = parsed.state || data.games[gameId].state;
        data.games[gameId].players.forEach(client => {
          if (client !== ws && client.readyState === client.OPEN) {
            client.send(JSON.stringify({ type: parsed.type || 'gameUpdate', state: data.games[gameId].state }));
          }
        });
      }
    });
    ws.on('close', () => {
      data.games[gameId].players = data.games[gameId].players.filter(client => client !== ws);
      if (data.games[gameId].players.length === 0) {
        delete data.games[gameId];
      }
    });
  });
}

function getRPSResult(playerChoice, opponentChoice) {
  if (playerChoice === opponentChoice) return 'tie';
  if (
    (playerChoice === 'rock' && opponentChoice === 'scissors') ||
    (playerChoice === 'paper' && opponentChoice === 'rock') ||
    (playerChoice === 'scissors' && opponentChoice === 'paper')
  ) return 'win';
  return 'lose';
}

module.exports = { setupGameWebSocket };
