const express = require('express');
const data = require('../data');

const router = express.Router();

router.get('/game-state/:gameId', (req, res) => {
  const { gameId } = req.params;
  if (!data.games[gameId]) {
    return res.status(404).json({ error: 'Game not found' });
  }
  res.json({ state: data.games[gameId].state });
});

router.post('/game-action/:gameId', (req, res) => {
  const { gameId } = req.params;
  const { type, username, state } = req.body;
  if (!data.games[gameId]) {
    return res.status(404).json({ error: 'Game not found' });
  }
  if (!username) {
    return res.status(400).json({ error: 'Username required' });
  }
  if (type === 'join') {
    const players = Object.keys(data.games[gameId].state.scores || {});
    if (!players.includes(username)) {
      return res.status(400).json({ error: 'User not in game' });
    }
    if (data.games[gameId].state.playersConnected < 2) {
      data.games[gameId].state.playersConnected = Math.min((data.games[gameId].state.playersConnected || 0) + 1, 2);
      if (data.games[gameId].state.playersConnected === 2) {
        const players = Object.keys(data.games[gameId].state.scores || {});
        if (players.length === 2 && !data.games[gameId].state.turn) {
          data.games[gameId].state.turn = players[Math.floor(Math.random() * 2)];
        }
      }
      data.games[gameId].state = { ...data.games[gameId].state };
    }
    res.json({ state: data.games[gameId].state });
  } else if (type === 'rps') {
    if (!state || !state.pendingRPS || !state.scores || !state.turn) {
      return res.status(400).json({ error: 'Invalid game state' });
    }
    data.games[gameId].state = state;
    const players = Object.keys(data.games[gameId].state.scores || {});
    const opponent = players.find(u => u !== state.turn);
    const opponentChoice = data.games[gameId].state.pendingRPS && data.games[gameId].state.pendingRPS[opponent];
    const myChoice = data.games[gameId].state.pendingRPS && data.games[gameId].state.pendingRPS[state.turn];
    if (!myChoice || !opponentChoice) {
      res.json({ state: data.games[gameId].state });
      return;
    }
    const result = getRPSResult(myChoice, opponentChoice);
    const newState = JSON.parse(JSON.stringify(data.games[gameId].state));
    if (result === 'win') {
      newState.scores[state.turn] = (newState.scores[state.turn] || 0) + 10;
      newState.moves.push(`${state.turn} won RPS (${myChoice} vs ${opponentChoice})`);
      newState.phase = 'action';
      newState.turn = state.turn;
      newState.winner = state.turn;
    } else if (result === 'lose') {
      newState.scores[opponent] = (newState.scores[opponent] || 0) + 10;
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
    res.json({ state: data.games[gameId].state });
  } else if (type === 'action') {
    if (!state || !state.islands || !state.scores || !state.turn) {
      return res.status(400).json({ error: 'Invalid game state' });
    }
    data.games[gameId].state = state;
    res.json({ state: data.games[gameId].state });
  } else {
    res.status(400).json({ error: 'Invalid action type' });
  }
});

function getRPSResult(playerChoice, opponentChoice) {
  if (playerChoice === opponentChoice) return 'tie';
  if (
    (playerChoice === 'rock' && opponentChoice === 'officer') ||
    (playerChoice === 'paper' && opponentChoice === 'rock') ||
    (playerChoice === 'officer' && opponentChoice === 'paper')
  ) return 'win';
  return 'lose';
}

module.exports = router;
