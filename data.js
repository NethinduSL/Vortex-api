// Simple in-memory database
const data = {
  users: {},
  games: {},
  notifications: {},
  sessions: {} // Track active game sessions
};

// Helper functions
function updateUserOnlineStatus(username) {
  if (data.users[username]) {
    data.users[username].lastPing = Date.now();
    data.users[username].online = true;
  }
}

function cleanupInactiveUsers() {
  const now = Date.now();
  Object.keys(data.users).forEach(username => {
    if (now - data.users[username].lastPing > 60000) { // 1 minute
      data.users[username].online = false;
    }
  });
}

function getOnlineUsers() {
  cleanupInactiveUsers();
  return Object.keys(data.users).filter(username => data.users[username].online);
}

function evaluateRPS(choice1, choice2) {
  if (choice1 === choice2) return null;
  
  const rules = {
    'rock': 'officer',
    'paper': 'rock', 
    'officer': 'paper'
  };
  
  return rules[choice1] === choice2 ? 'player1' : 'player2';
}

// Session management
function createGameSession(gameId, player1, player2) {
  data.sessions[gameId] = {
    players: [player1, player2],
    lastActivity: Date.now(),
    connected: [player1] // Track who's connected
  };
}

function updateSessionActivity(gameId, username) {
  if (data.sessions[gameId]) {
    data.sessions[gameId].lastActivity = Date.now();
    if (!data.sessions[gameId].connected.includes(username)) {
      data.sessions[gameId].connected.push(username);
    }
  }
}

function cleanupOldSessions() {
  const now = Date.now();
  Object.keys(data.sessions).forEach(gameId => {
    if (now - data.sessions[gameId].lastActivity > 300000) { // 5 minutes
      delete data.sessions[gameId];
      delete data.games[gameId];
    }
  });
}

module.exports = {
  data,
  updateUserOnlineStatus,
  cleanupInactiveUsers,
  getOnlineUsers,
  evaluateRPS,
  createGameSession,
  updateSessionActivity,
  cleanupOldSessions
};
