const express = require('express');
const router = express.Router();
const { data, evaluateRPS } = require('../data');

router.post('/:gameId', (req, res) => {
  const gameId = req.params.gameId;
  const { type, username, choice, action } = req.body;
  
  console.log(`Game action received - Game: ${gameId}, Type: ${type}, User: ${username}`);
  
  if (!data.games[gameId]) {
    console.log('Game not found:', gameId);
    return res.status(404).json({ error: 'Game not found' });
  }
  
  const game = data.games[gameId];
  const state = game.state;
  
  console.log('Current game state:', {
    players: state.players,
    playersConnected: state.playersConnected,
    phase: state.phase,
    turn: state.turn,
    pendingRPS: state.pendingRPS
  });
  
  try {
    switch (type) {
      case 'join':
        console.log(`Join request from ${username} for game ${gameId}`);
        console.log('Current playersConnected:', state.playersConnected);
        
        if (state.playersConnected < 2) {
          state.playersConnected++;
          state.moves.push(`${username} joined the game`);
          
          console.log(`Player ${username} joined. Now ${state.playersConnected}/2 players`);
          
          if (state.playersConnected === 2) {
            // Both players joined, randomly assign first turn
            state.turn = state.players[Math.floor(Math.random() * 2)];
            state.moves.push(`Both players connected! ${state.turn} goes first.`);
            console.log(`Game ${gameId} started! First turn: ${state.turn}`);
          }
        }
        break;
        
      case 'rps':
        console.log(`RPS choice from ${username}: ${choice}`);
        
        if (state.phase !== 'rps') {
          console.log('Wrong phase for RPS');
          return res.status(400).json({ error: 'Not in RPS phase' });
        }
        
        if (state.turn !== username) {
          console.log(`Not ${username}'s turn. Current turn: ${state.turn}`);
          return res.status(400).json({ error: 'Not your turn' });
        }
        
        if (!['rock', 'paper', 'officer'].includes(choice)) {
          console.log('Invalid RPS choice:', choice);
          return res.status(400).json({ error: 'Invalid RPS choice' });
        }
        
        state.pendingRPS[username] = choice;
        state.moves.push(`${username} chose ${choice}`);
        
        console.log('Pending RPS choices:', state.pendingRPS);
        
        // Switch turn to other player
        state.turn = state.players.find(p => p !== username);
        
        // Check if both players have made RPS choices
        const players = state.players;
        if (state.pendingRPS[players[0]] && state.pendingRPS[players[1]]) {
          const player1Choice = state.pendingRPS[players[0]];
          const player2Choice = state.pendingRPS[players[1]];
          const result = evaluateRPS(player1Choice, player2Choice);
          
          console.log(`RPS evaluation: ${player1Choice} vs ${player2Choice} = ${result}`);
          
          if (result === null) {
            // Tie
            state.moves.push(`Tie! Both chose ${player1Choice}. Replaying RPS.`);
            state.pendingRPS = {};
            // Keep turn random for replay
            state.turn = players[Math.floor(Math.random() * 2)];
            console.log('RPS tie, replaying. New turn:', state.turn);
          } else {
            // Winner determined
            const winner = result === 'player1' ? players[0] : players[1];
            const loser = result === 'player1' ? players[1] : players[0];
            
            state.winner = winner;
            state.scores[winner] += 10;
            state.phase = 'action';
            state.turn = winner;
            
            state.moves.push(
              `${winner} won RPS (${state.pendingRPS[winner]} vs ${state.pendingRPS[loser]}) and gained 10 points!`
            );
            state.pendingRPS = {};
            console.log(`RPS winner: ${winner}, phase changed to action`);
          }
        } else {
          console.log(`Waiting for other player's RPS choice. Current turn: ${state.turn}`);
        }
        break;
        
      case 'action':
        console.log(`Action from ${username}: ${action}`);
        
        if (state.phase !== 'action') {
          console.log('Wrong phase for action');
          return res.status(400).json({ error: 'Not in action phase' });
        }
        
        if (state.turn !== username || state.winner !== username) {
          console.log(`Not ${username}'s action phase. Winner: ${state.winner}, Turn: ${state.turn}`);
          return res.status(400).json({ error: 'Not your action phase' });
        }
        
        const opponent = state.players.find(p => p !== username);
        
        switch (action) {
          case 'mortar':
            if (state.islands[opponent].shields > 0) {
              state.islands[opponent].shields--;
              state.moves.push(`${username} used Mortar! ${opponent}'s shields reduced to ${state.islands[opponent].shields}`);
            } else {
              state.moves.push(`${username} used Mortar! ${opponent} has no shields to reduce`);
            }
            break;
            
          case 'shield':
            if (state.islands[username].shields < 3) {
              state.islands[username].shields++;
              state.moves.push(`${username} bought Shield! Shields increased to ${state.islands[username].shields}`);
            } else {
              state.moves.push(`${username} tried to buy Shield but already at maximum (3)`);
            }
            break;
            
          case 'slicer':
            if (state.islands[opponent].shields === 0) {
              state.islands[opponent].parts--;
              state.moves.push(`${username} used Slicer! ${opponent}'s island parts reduced to ${state.islands[opponent].parts}`);
              
              // Check for game end
              if (state.islands[opponent].parts <= 0) {
                state.gameOver = true;
                state.moves.push(`Game over! ${username} destroyed ${opponent}'s island!`);
                console.log(`Game over! ${username} wins!`);
              }
            } else {
              state.moves.push(`${username} used Slicer but ${opponent} has shields! No damage dealt.`);
            }
            break;
            
          default:
            console.log('Invalid action:', action);
            return res.status(400).json({ error: 'Invalid action' });
        }
        
        // Switch back to RPS phase
        if (!state.gameOver) {
          state.phase = 'rps';
          state.winner = null;
          state.turn = opponent;
          console.log(`Action completed. Phase changed to RPS. New turn: ${state.turn}`);
        }
        break;
        
      default:
        console.log('Invalid action type:', type);
        return res.status(400).json({ error: 'Invalid action type' });
    }
    
    console.log('Updated game state:', {
      playersConnected: state.playersConnected,
      phase: state.phase,
      turn: state.turn,
      pendingRPS: state.pendingRPS,
      winner: state.winner,
      gameOver: state.gameOver
    });
    
    res.json({ success: true, state });
  } catch (error) {
    console.error('Game action error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
