// In-memory user storage
const users = {};

// Check and update online status every 10 seconds
setInterval(() => {
  const now = Date.now();
  const OFFLINE_THRESHOLD = 30000; // 30 seconds

  for (const username in users) {
    const timeSinceLastSeen = now - users[username].lastSeen;
    if (timeSinceLastSeen > OFFLINE_THRESHOLD && users[username].status === 'online') {
      users[username].status = 'offline';
      console.log(`User ${username} set to offline due to inactivity`);
    }
  }
}, 10000);

module.exports = {
  users,
  
  getUser(username) {
    return users[username];
  },
  
  addUser(username) {
    if (!users[username]) {
      users[username] = {
        username,
        status: 'online',
        lastSeen: Date.now(),
        createdAt: new Date().toISOString(),
        score: 0,
        level: 1,
        gamesPlayed: 0
      };
      console.log(`New user created: ${username}`);
    } else {
      // Update existing user
      users[username].status = 'online';
      users[username].lastSeen = Date.now();
      console.log(`User ${username} is back online`);
    }
    return users[username];
  },
  
  updateLastSeen(username) {
    if (users[username]) {
      users[username].lastSeen = Date.now();
      if (users[username].status === 'offline') {
        users[username].status = 'online';
      }
    }
  },
  
  getOnlineUsers() {
    return Object.values(users).filter(user => user.status === 'online');
  },
  
  getAllUsers() {
    return Object.values(users);
  }
};
