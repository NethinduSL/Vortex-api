// In-memory data store
const data = {
  users: {},
  games: {},
  notifications: {}
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
    if (now - data.users[username].lastPing > 30000) { // 30 seconds
      data.users[username].online = false;
    }
  });
}

function getOnlineUsers() {
  cleanupInactiveUsers();
  return Object.keys(data.users).filter(username => data.users[username].online);
}

function evaluateRPS(choice1, choice2) {
  if (choice1 === choice2) return null; // tie
  
  const rules = {
    'rock': 'officer',
    'paper': 'rock', 
    'officer': 'paper'
  };
  
  return rules[choice1] === choice2 ? 'player1' : 'player2';
}

module.exports = {
  data,
  updateUserOnlineStatus,
  cleanupInactiveUsers,
  getOnlineUsers,
  evaluateRPS
};
