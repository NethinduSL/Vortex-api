const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const app = express();
const server = http.createServer(app);

// Get the deployment URL dynamically
const DEPLOYMENT_URL = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000';
console.log('🚀 Deployment URL:', DEPLOYMENT_URL);

// Socket.io configuration
const io = socketIo(server, {
  cors: {
    origin: [DEPLOYMENT_URL, "http://localhost:3000", "http://localhost:8080", "https://vortex-islands.vercel.app"],
    methods: ["GET", "POST"],
    credentials: true
  },
  transports: ['websocket', 'polling']
});

const PORT = process.env.PORT || 3000;

// CORS configuration
app.use(cors({
  origin: [DEPLOYMENT_URL, "http://localhost:3000", "http://localhost:8080", "https://vortex-islands.vercel.app"],
  credentials: true
}));

app.use(express.json());

// Global error handler
app.use((error, req, res, next) => {
  console.error('❌ Global Error:', error);
  res.status(500).json({ error: 'Internal server error' });
});

// Simple in-memory storage with persistence
const gameState = {
  users: {},
  games: {},
  notifications: {}
};

// Game logic helper
function evaluateRPS(choice1, choice2) {
  if (choice1 === choice2) return null;
  const rules = { 'rock': 'officer', 'paper': 'rock', 'officer': 'paper' };
  return rules[choice1] === choice2 ? 'player1' : 'player2';
}

// Serve HTML pages directly from strings
app.get('/', (req, res) => {
  console.log('📄 Serving index.html');
  res.send(`
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Vortex Islands - Lobby</title>
    <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700&display=swap" rel="stylesheet">
    <link href="https://fonts.googleapis.com/icon?family=Material+Icons" rel="stylesheet">
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'Poppins', sans-serif; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); min-height: 100vh; padding: 20px; color: #333; }
        .container { max-width: 800px; margin: 0 auto; background: white; border-radius: 20px; box-shadow: 0 20px 40px rgba(0,0,0,0.1); overflow: hidden; }
        .header { background: linear-gradient(135deg, #00aaff, #0088cc); color: white; padding: 30px; text-align: center; }
        .header h1 { font-size: 2.5em; font-weight: 700; margin-bottom: 10px; }
        .content { padding: 30px; }
        .section { margin-bottom: 30px; padding: 25px; background: #f8f9fa; border-radius: 15px; border-left: 4px solid #00aaff; }
        .section h2 { color: #00aaff; margin-bottom: 15px; font-weight: 600; }
        .input-group { display: flex; gap: 10px; margin-bottom: 15px; }
        input { flex: 1; padding: 12px 15px; border: 2px solid #e1e5e9; border-radius: 10px; font-size: 16px; font-family: 'Poppins'; }
        input:focus { outline: none; border-color: #00aaff; }
        button { background: #00aaff; color: white; border: none; padding: 12px 25px; border-radius: 10px; font-size: 16px; font-family: 'Poppins'; font-weight: 500; cursor: pointer; transition: all 0.3s; }
        button:hover { background: #0088cc; transform: translateY(-2px); box-shadow: 0 5px 15px rgba(0,170,255,0.3); }
        button:disabled { background: #ccc; cursor: not-allowed; transform: none; box-shadow: none; }
        .btn-orange { background: #ff4500; }
        .btn-orange:hover { background: #e03d00; }
        .user-list { list-style: none; }
        .user-item { display: flex; justify-content: space-between; align-items: center; padding: 15px; background: white; margin-bottom: 10px; border-radius: 10px; box-shadow: 0 2px 5px rgba(0,0,0,0.1); }
        .user-name { flex: 1; font-weight: 500; }
        .status { display: inline-flex; align-items: center; gap: 5px; padding: 5px 10px; border-radius: 15px; font-size: 0.9em; margin-right: 10px; }
        .status.online { background: #e8f5e8; color: #2e7d32; }
        .notification { background: #fff3cd; border: 1px solid #ffeaa7; border-radius: 10px; padding: 15px; margin-bottom: 15px; display: flex; justify-content: space-between; align-items: center; }
        .error { background: #f8d7da; color: #721c24; padding: 10px 15px; border-radius: 10px; margin-bottom: 15px; border: 1px solid #f5c6cb; }
        .success { background: #d4edda; color: #155724; padding: 10px 15px; border-radius: 10px; margin-bottom: 15px; border: 1px solid #c3e6cb; }
        .hidden { display: none; }
        .debug-info { background: #e9ecef; padding: 10px; border-radius: 5px; margin-top: 10px; font-size: 0.8em; color: #666; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>Vortex Islands</h1>
            <p>Real-time Multiplayer Strategy Game</p>
        </div>
        
        <div class="content">
            <div class="section" id="usernameSection">
                <h2>Enter Your Username</h2>
                <div class="input-group">
                    <input type="text" id="usernameInput" placeholder="Choose a username (max 20 characters)" maxlength="20">
                    <button onclick="setUsername()">Join Game</button>
                </div>
                <div class="debug-info" id="debugInfo">Status: Not connected</div>
            </div>
            
            <div class="section hidden" id="onlineSection">
                <h2>Online Players</h2>
                <div id="userList" class="user-list">
                    <div>Loading online users...</div>
                </div>
            </div>
            
            <div class="section hidden" id="notificationsSection">
                <h2>Game Requests</h2>
                <div id="notificationsList"></div>
            </div>
            
            <div id="statusMessage"></div>
        </div>
    </div>

    <script src="https://cdn.socket.io/4.7.5/socket.io.min.js"></script>
    <script>
        let currentUsername = '';
        let socket = null;
        
        function setUsername() {
            const usernameInput = document.getElementById('usernameInput');
            const username = usernameInput.value.trim();
            
            if (!username) {
                showError('Please enter a username');
                return;
            }
            
            // First register the user via API
            fetch('/user?q=' + encodeURIComponent(username), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
            })
            .then(response => response.json())
            .then(data => {
                if (data.error) {
                    showError(data.error);
                } else {
                    currentUsername = username;
                    showSuccess('Welcome, ' + username + '! Connecting to game server...');
                    document.getElementById('usernameSection').classList.add('hidden');
                    document.getElementById('onlineSection').classList.remove('hidden');
                    document.getElementById('notificationsSection').classList.remove('hidden');
                    
                    // Initialize Socket.io connection
                    initializeSocket();
                }
            })
            .catch(error => {
                showError('Failed to set username. Please try again.');
                console.error('Registration error:', error);
            });
        }
        
        function initializeSocket() {
            console.log('🔗 Initializing socket connection...');
            updateDebugInfo('Connecting to server...');
            
            // Connect to the current server
            const socketUrl = window.location.origin;
            console.log('Connecting to:', socketUrl);
            
            socket = io(socketUrl, {
                transports: ['websocket', 'polling']
            });
            
            socket.on('connect', () => {
                console.log('✅ Connected to server with ID:', socket.id);
                updateDebugInfo('Connected: ' + socket.id);
                
                // Register user with socket
                socket.emit('register', currentUsername);
            });
            
            socket.on('connected', (data) => {
                console.log('✅ Server connection confirmed:', data);
                updateDebugInfo('Server ready');
            });
            
            socket.on('registered', (data) => {
                console.log('✅ User registered with socket:', data);
                updateDebugInfo('Registered as: ' + currentUsername);
                loadOnlineUsers();
            });
            
            socket.on('game_request', (data) => {
                console.log('📨 Game request received:', data);
                showNotification(data.from);
            });
            
            socket.on('game_start', (data) => {
                console.log('🎮 Game start received:', data);
                window.location.href = '/game?gameId=' + data.gameId + '&username=' + currentUsername;
            });
            
            socket.on('online_users_update', (users) => {
                console.log('👥 Online users update:', users);
                updateOnlineUsers(users);
            });
            
            socket.on('error', (data) => {
                console.error('❌ Socket error:', data);
                showError(data.message);
            });
            
            socket.on('disconnect', (reason) => {
                console.log('🔌 Disconnected:', reason);
                updateDebugInfo('Disconnected: ' + reason);
                showError('Disconnected from server. Reconnecting...');
            });
            
            socket.on('connect_error', (error) => {
                console.error('❌ Connection error:', error);
                updateDebugInfo('Connection failed: ' + error.message);
                showError('Connection failed: ' + error.message);
            });
        }
        
        function loadOnlineUsers() {
            fetch('/online')
                .then(response => response.json())
                .then(users => {
                    console.log('📋 Online users from API:', users);
                    updateOnlineUsers(users);
                })
                .catch(error => {
                    console.error('Failed to load online users:', error);
                    document.getElementById('userList').innerHTML = '<div class="error">Failed to load online users</div>';
                });
        }
        
        function updateOnlineUsers(users) {
            const userList = document.getElementById('userList');
            userList.innerHTML = '';
            
            const otherUsers = users.filter(user => user !== currentUsername);
            
            if (otherUsers.length === 0) {
                userList.innerHTML = '<div>No other players online</div>';
                return;
            }
            
            otherUsers.forEach(user => {
                const userItem = document.createElement('div');
                userItem.className = 'user-item';
                userItem.innerHTML = '<span class="user-name">' + user + '</span><span class="status online">Online</span><button onclick="sendGameRequest(\\'' + user + '\\')">Play</button>';
                userList.appendChild(userItem);
            });
        }
        
        function sendGameRequest(opponent) {
            console.log('🎯 Sending game request to:', opponent);
            socket.emit('send_game_request', {
                username: opponent,
                sender: currentUsername
            });
            showSuccess('Game request sent to ' + opponent);
        }
        
        function showNotification(sender) {
            const notificationsList = document.getElementById('notificationsList');
            const existingNotification = Array.from(notificationsList.children).find(
                child => child.textContent.includes(sender)
            );
            
            if (existingNotification) return;
            
            const notification = document.createElement('div');
            notification.className = 'notification';
            notification.innerHTML = '<span>Game request from <strong>' + sender + '</strong></span><button class="btn-orange" onclick="acceptGameRequest(\\'' + sender + '\\')">Accept</button>';
            notificationsList.appendChild(notification);
        }
        
        function acceptGameRequest(sender) {
            console.log('✅ Accepting game request from:', sender);
            socket.emit('accept_game_request', {
                username: currentUsername,
                sender: sender
            });
            
            // Remove notification
            const notificationsList = document.getElementById('notificationsList');
            Array.from(notificationsList.children).forEach(child => {
                if (child.textContent.includes(sender)) {
                    child.remove();
                }
            });
            
            showSuccess('Accepted game request from ' + sender);
        }
        
        function showError(message) {
            const statusDiv = document.getElementById('statusMessage');
            statusDiv.innerHTML = '<div class="error">' + message + '</div>';
            setTimeout(() => { statusDiv.innerHTML = ''; }, 5000);
        }
        
        function showSuccess(message) {
            const statusDiv = document.getElementById('statusMessage');
            statusDiv.innerHTML = '<div class="success">' + message + '</div>';
            setTimeout(() => { statusDiv.innerHTML = ''; }, 3000);
        }
        
        function updateDebugInfo(message) {
            const debugElement = document.getElementById('debugInfo');
            if (debugElement) {
                debugElement.textContent = 'Status: ' + message;
            }
        }
        
        // Test server connection on load
        window.addEventListener('load', () => {
            fetch('/health')
                .then(response => response.json())
                .then(data => {
                    console.log('❤️ Server health:', data);
                    updateDebugInfo('Server is online');
                })
                .catch(error => {
                    console.error('❌ Server health check failed:', error);
                    updateDebugInfo('Server offline');
                });
        });
    </script>
</body>
</html>
  `);
});

app.get('/game', (req, res) => {
  console.log('🎮 Serving game.html');
  const gameId = req.query.gameId;
  const username = req.query.username;
  
  res.send(`
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Vortex Islands - Game</title>
    <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700&display=swap" rel="stylesheet">
    <link href="https://fonts.googleapis.com/icon?family=Material+Icons" rel="stylesheet">
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'Poppins', sans-serif; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); min-height: 100vh; padding: 20px; color: #333; }
        .container { max-width: 1200px; margin: 0 auto; background: white; border-radius: 20px; box-shadow: 0 20px 40px rgba(0,0,0,0.1); overflow: hidden; }
        .header { background: linear-gradient(135deg, #00aaff, #0088cc); color: white; padding: 20px 30px; display: flex; justify-content: space-between; align-items: center; }
        .header h1 { font-size: 2em; font-weight: 700; }
        .game-info { display: flex; gap: 20px; font-size: 0.9em; }
        .content { padding: 30px; display: grid; grid-template-columns: 1fr 1fr; gap: 30px; }
        @media (max-width: 768px) { .content { grid-template-columns: 1fr; } }
        .island { background: #f8f9fa; border-radius: 15px; padding: 25px; text-align: center; border: 3px solid #e1e5e9; transition: all 0.3s; }
        .island.active { border-color: #00aaff; box-shadow: 0 5px 20px rgba(0,170,255,0.2); }
        .island.player { border-color: #00aaff; }
        .island.opponent { border-color: #ff4500; }
        .island-image { width: 100%; height: 150px; background: linear-gradient(135deg, #74b9ff, #0984e3); border-radius: 10px; margin: 15px 0; display: flex; align-items: center; justify-content: center; color: white; font-weight: 600; font-size: 1.2em; }
        .island.opponent .island-image { background: linear-gradient(135deg, #fab1a0, #e17055); }
        .stats { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin: 15px 0; }
        .stat { background: white; padding: 10px; border-radius: 8px; font-weight: 500; }
        .stat.parts { color: #00aaff; } .stat.shields { color: #ff4500; } .stat.score { grid-column: 1 / -1; color: #00b894; }
        .controls { background: #f8f9fa; border-radius: 15px; padding: 25px; grid-column: 1 / -1; }
        .phase { margin-bottom: 20px; }
        .phase h3 { color: #00aaff; margin-bottom: 10px; display: flex; align-items: center; gap: 10px; }
        .buttons { display: flex; gap: 15px; flex-wrap: wrap; }
        button { flex: 1; min-width: 120px; padding: 15px 20px; border: none; border-radius: 10px; font-size: 16px; font-family: 'Poppins'; font-weight: 500; cursor: pointer; transition: all 0.3s; display: flex; align-items: center; justify-content: center; gap: 8px; }
        button:disabled { background: #ccc !important; cursor: not-allowed; transform: none !important; box-shadow: none !important; }
        .rps-btn { background: #ff4500; color: white; }
        .rps-btn:hover:not(:disabled) { background: #e03d00; transform: translateY(-2px); box-shadow: 0 5px 15px rgba(255,69,0,0.3); }
        .action-btn { background: #00aaff; color: white; }
        .action-btn:hover:not(:disabled) { background: #0088cc; transform: translateY(-2px); box-shadow: 0 5px 15px rgba(0,170,255,0.3); }
        .log { background: #f8f9fa; border-radius: 15px; padding: 25px; grid-column: 1 / -1; max-height: 200px; overflow-y: auto; }
        .log h3 { color: #00aaff; margin-bottom: 15px; }
        .log-messages { display: flex; flex-direction: column; gap: 8px; }
        .log-message { padding: 8px 12px; background: white; border-radius: 8px; border-left: 3px solid #00aaff; font-size: 0.9em; }
        .connection-status { display: flex; align-items: center; gap: 10px; padding: 10px 15px; background: #fff3cd; border: 1px solid #ffeaa7; border-radius: 10px; margin-bottom: 20px; grid-column: 1 / -1; }
        .status-connected { background: #d4edda; border-color: #c3e6cb; color: #155724; }
        .game-over { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.8); display: flex; align-items: center; justify-content: center; z-index: 1000; }
        .game-over-content { background: white; padding: 40px; border-radius: 20px; text-align: center; max-width: 400px; width: 90%; }
        .game-over h2 { font-size: 2em; margin-bottom: 20px; color: #ff4500; }
        .hidden { display: none; }
        .error-message { background: #f8d7da; color: #721c24; padding: 10px 15px; border-radius: 10px; margin-bottom: 15px; border: 1px solid #f5c6cb; grid-column: 1 / -1; }
        .status { margin-top: 10px; font-weight: 500; color: #666; }
        .debug-info { background: #e9ecef; padding: 8px; border-radius: 5px; font-size: 0.8em; color: #666; margin-top: 5px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>Vortex Islands</h1>
            <div class="game-info">
                <div id="playerInfo">Player: Loading...</div>
                <div id="gamePhase">Phase: Loading...</div>
            </div>
        </div>
        
        <div class="content">
            <div class="connection-status" id="connectionStatus">
                <span>🔗 Connecting to game...</span>
            </div>
            <div class="debug-info" id="debugInfo">Socket: Not connected</div>
            
            <div class="error-message hidden" id="errorMessage"></div>
            
            <div class="island player" id="playerIsland">
                <h2 id="playerName">Your Island</h2>
                <div class="island-image"><span>Your Fortress</span></div>
                <div class="stats">
                    <div class="stat parts" id="playerParts">Parts: 10</div>
                    <div class="stat shields" id="playerShields">Shields: 0</div>
                    <div class="stat score" id="playerScore">Score: 0</div>
                </div>
                <div class="status" id="playerStatus">Waiting...</div>
            </div>
            
            <div class="island opponent" id="opponentIsland">
                <h2 id="opponentName">Opponent Island</h2>
                <div class="island-image"><span>Enemy Fortress</span></div>
                <div class="stats">
                    <div class="stat parts" id="opponentParts">Parts: 10</div>
                    <div class="stat shields" id="opponentShields">Shields: 0</div>
                    <div class="stat score" id="opponentScore">Score: 0</div>
                </div>
                <div class="status" id="opponentStatus">Waiting...</div>
            </div>
            
            <div class="controls">
                <div class="phase" id="rpsPhase">
                    <h3><span class="material-icons">sports_handball</span>Rock-Paper-Officer Phase</h3>
                    <div class="buttons">
                        <button class="rps-btn" onclick="makeRPSChoice('rock')" id="rockBtn"><span class="material-icons">landscape</span>Rock</button>
                        <button class="rps-btn" onclick="makeRPSChoice('paper')" id="paperBtn"><span class="material-icons">description</span>Paper</button>
                        <button class="rps-btn" onclick="makeRPSChoice('officer')" id="officerBtn"><span class="material-icons">military_tech</span>Officer</button>
                    </div>
                </div>
                
                <div class="phase hidden" id="actionPhase">
                    <h3><span class="material-icons">construction</span>Action Phase</h3>
                    <div class="buttons">
                        <button class="action-btn" onclick="makeAction('mortar')" id="mortarBtn"><span class="material-icons">explosion</span>Buy Mortar</button>
                        <button class="action-btn" onclick="makeAction('shield')" id="shieldBtn"><span class="material-icons">shield</span>Buy Shield</button>
                        <button class="action-btn" onclick="makeAction('slicer')" id="slicerBtn"><span class="material-icons">content_cut</span>Buy Slicer</button>
                    </div>
                </div>
            </div>
            
            <div class="log">
                <h3>Game Log</h3>
                <div class="log-messages" id="gameLog"><div class="log-message">Game starting...</div></div>
            </div>
        </div>
    </div>
    
    <div class="game-over hidden" id="gameOverModal">
        <div class="game-over-content">
            <h2 id="gameOverTitle">Game Over</h2>
            <p id="gameOverMessage">Game over message will appear here</p>
            <button onclick="location.href = '/'" style="margin-top: 20px;">Return to Lobby</button>
        </div>
    </div>

    <script src="https://cdn.socket.io/4.7.5/socket.io.min.js"></script>
    <script>
        const urlParams = new URLSearchParams(window.location.search);
        const gameId = urlParams.get('gameId');
        const username = urlParams.get('username');
        let socket = null;
        let currentState = null;

        console.log('🎮 Game initialization:', { gameId, username });

        function updateDebugInfo(message) {
            const debugElement = document.getElementById('debugInfo');
            if (debugElement) {
                debugElement.textContent = 'Socket: ' + message;
            }
        }

        function showError(message) {
            const errorElement = document.getElementById('errorMessage');
            if (errorElement) {
                errorElement.textContent = message;
                errorElement.classList.remove('hidden');
            }
            console.error('❌ Game Error:', message);
        }

        function hideError() {
            const errorElement = document.getElementById('errorMessage');
            if (errorElement) {
                errorElement.classList.add('hidden');
            }
        }

        document.addEventListener('DOMContentLoaded', () => {
            if (!gameId || !username) {
                showError('Missing game ID or username. Redirecting...');
                setTimeout(() => window.location.href = '/', 3000);
                return;
            }
            
            console.log('✅ Starting game with:', { gameId, username });
            document.getElementById('playerName').textContent = username + "'s Island";
            document.getElementById('playerInfo').textContent = 'Player: ' + username;
            
            initializeSocket();
        });

        function initializeSocket() {
            console.log('🔗 Initializing game socket...');
            updateDebugInfo('Connecting...');
            
            const socketUrl = window.location.origin;
            console.log('Connecting to:', socketUrl);
            
            socket = io(socketUrl, {
                transports: ['websocket', 'polling']
            });
            
            socket.on('connect', () => {
                console.log('✅ Game socket connected:', socket.id);
                updateDebugInfo('Connected: ' + socket.id);
                updateConnectionStatus('✅ Connected - Joining game...');
                
                // Join the game
                socket.emit('join_game', { gameId, username });
            });
            
            socket.on('connected', (data) => {
                console.log('✅ Game server confirmed:', data);
                updateDebugInfo('Server ready');
            });
            
            socket.on('game_state_update', (state) => {
                console.log('🎮 Game state updated:', state);
                hideError();
                updateGameState(state);
            });
            
            socket.on('error', (data) => {
                console.error('❌ Game socket error:', data);
                showError(data.message);
                updateDebugInfo('Error: ' + data.message);
            });
            
            socket.on('disconnect', (reason) => {
                console.log('🔌 Game socket disconnected:', reason);
                showError('Disconnected: ' + reason);
                updateDebugInfo('Disconnected');
            });
            
            socket.on('connect_error', (error) => {
                console.error('❌ Game connection error:', error);
                showError('Connection failed: ' + error.message);
                updateDebugInfo('Connection failed');
            });
        }

        function updateConnectionStatus(message) {
            const statusElement = document.getElementById('connectionStatus');
            if (statusElement) {
                statusElement.innerHTML = message;
                if (message.includes('✅')) {
                    statusElement.classList.add('status-connected');
                }
            }
        }

        function updateGameState(state) {
            if (!state) {
                console.error('❌ No state provided to updateGameState');
                return;
            }
            
            currentState = state;
            console.log('🔄 Updating game UI with state:', state);
            
            // Update connection status
            if (state.playersConnected === 2) {
                updateConnectionStatus('✅ Connected - Game Ready!');
            } else if (state.playersConnected === 1) {
                updateConnectionStatus('⏳ Waiting for opponent...');
            }
            
            // Update game phase
            const gamePhaseElement = document.getElementById('gamePhase');
            if (gamePhaseElement) {
                gamePhaseElement.textContent = 'Phase: ' + (state.phase ? state.phase.toUpperCase() : 'LOADING');
            }
            
            // Update islands
            if (state.islands && state.islands[username]) {
                updateIslandDisplay('player', state.islands[username], state.scores ? state.scores[username] : 0);
            }
            
            const opponent = state.players ? state.players.find(p => p !== username) : null;
            if (opponent && state.islands && state.islands[opponent]) {
                const opponentNameElement = document.getElementById('opponentName');
                if (opponentNameElement) {
                    opponentNameElement.textContent = opponent + "'s Island";
                }
                updateIslandDisplay('opponent', state.islands[opponent], state.scores ? state.scores[opponent] : 0);
            }
            
            // Update game log
            if (state.moves) {
                updateGameLog(state.moves);
            }
            
            // Update controls
            updateControls(state, opponent);
            
            // Check for game over
            if (state.gameOver) {
                showGameOver(state);
            }
        }

        function updateIslandDisplay(type, island, score) {
            const partsElement = document.getElementById(type + 'Parts');
            const shieldsElement = document.getElementById(type + 'Shields');
            const scoreElement = document.getElementById(type + 'Score');
            
            if (partsElement) partsElement.textContent = 'Parts: ' + (island.parts || 10);
            if (shieldsElement) shieldsElement.textContent = 'Shields: ' + (island.shields || 0);
            if (scoreElement) scoreElement.textContent = 'Score: ' + (score || 0);
        }

        function updateGameLog(moves) {
            const logElement = document.getElementById('gameLog');
            if (!logElement) return;
            
            logElement.innerHTML = '';
            
            // Show latest moves first (last 10 moves)
            const recentMoves = moves.slice(-10).reverse();
            recentMoves.forEach(move => {
                const message = document.createElement('div');
                message.className = 'log-message';
                message.textContent = move;
                logElement.appendChild(message);
            });
        }

        function updateControls(state, opponent) {
            if (!state) return;
            
            const isMyTurn = state.turn === username;
            const isRPSPhase = state.phase === 'rps';
            const isActionPhase = state.phase === 'action';
            const isWinner = state.winner === username;
            const hasChosenRPS = state.pendingRPS && state.pendingRPS[username];
            
            // Show/hide phases
            const rpsPhase = document.getElementById('rpsPhase');
            const actionPhase = document.getElementById('actionPhase');
            if (rpsPhase) rpsPhase.style.display = isRPSPhase ? 'block' : 'none';
            if (actionPhase) actionPhase.style.display = isActionPhase ? 'block' : 'none';
            
            // Enable/disable RPS buttons
            const canChooseRPS = isRPSPhase && isMyTurn && !hasChosenRPS && state.playersConnected === 2;
            const rockBtn = document.getElementById('rockBtn');
            const paperBtn = document.getElementById('paperBtn');
            const officerBtn = document.getElementById('officerBtn');
            if (rockBtn) rockBtn.disabled = !canChooseRPS;
            if (paperBtn) paperBtn.disabled = !canChooseRPS;
            if (officerBtn) officerBtn.disabled = !canChooseRPS;
            
            // Enable/disable action buttons
            const canTakeAction = isActionPhase && isMyTurn && isWinner && state.playersConnected === 2;
            const mortarBtn = document.getElementById('mortarBtn');
            const shieldBtn = document.getElementById('shieldBtn');
            const slicerBtn = document.getElementById('slicerBtn');
            if (mortarBtn) mortarBtn.disabled = !canTakeAction;
            if (shieldBtn) shieldBtn.disabled = !canTakeAction;
            if (slicerBtn) slicerBtn.disabled = !canTakeAction;
            
            // Update status messages
            const playerStatus = document.getElementById('playerStatus');
            const opponentStatus = document.getElementById('opponentStatus');
            if (playerStatus) playerStatus.textContent = getStatusMessage(state, username, true);
            if (opponentStatus && opponent) opponentStatus.textContent = getStatusMessage(state, opponent, false);
            
            // Highlight active islands
            const playerIsland = document.getElementById('playerIsland');
            const opponentIsland = document.getElementById('opponentIsland');
            if (playerIsland) playerIsland.classList.toggle('active', isMyTurn);
            if (opponentIsland) opponentIsland.classList.toggle('active', !isMyTurn && opponent);
        }

        function getStatusMessage(state, player, isSelf) {
            if (!state || !player) return 'Waiting...';
            
            const isTheirTurn = state.turn === player;
            const hasChosenRPS = state.pendingRPS && state.pendingRPS[player];
            
            if (state.phase === 'rps') {
                if (isTheirTurn) {
                    return hasChosenRPS ? '✅ Choice made!' : '🎯 Your turn! Choose RPS!';
                } else {
                    return hasChosenRPS ? '✅ Choice made' : '⏳ Waiting for choice...';
                }
            } else if (state.phase === 'action') {
                return isTheirTurn ? '🎯 Your turn! Take action!' : '⏳ Waiting for action...';
            }
            return '⏳ Waiting...';
        }

        function makeRPSChoice(choice) {
            console.log('🎲 Making RPS choice:', choice);
            if (!socket || !socket.connected) {
                showError('Not connected to server');
                return;
            }
            
            // Disable buttons immediately
            const rockBtn = document.getElementById('rockBtn');
            const paperBtn = document.getElementById('paperBtn');
            const officerBtn = document.getElementById('officerBtn');
            if (rockBtn) rockBtn.disabled = true;
            if (paperBtn) paperBtn.disabled = true;
            if (officerBtn) officerBtn.disabled = true;
            
            socket.emit('make_rps_choice', { gameId, username, choice });
        }

        function makeAction(action) {
            console.log('⚡ Making action:', action);
            if (!socket || !socket.connected) {
                showError('Not connected to server');
                return;
            }
            
            // Disable buttons immediately
            const mortarBtn = document.getElementById('mortarBtn');
            const shieldBtn = document.getElementById('shieldBtn');
            const slicerBtn = document.getElementById('slicerBtn');
            if (mortarBtn) mortarBtn.disabled = true;
            if (shieldBtn) shieldBtn.disabled = true;
            if (slicerBtn) slicerBtn.disabled = true;
            
            socket.emit('make_action', { gameId, username, action });
        }

        function showGameOver(state) {
            console.log('🎯 Game over:', state);
            const opponent = state.players ? state.players.find(p => p !== username) : 'Opponent';
            const playerWon = state.islands && state.islands[username] && state.islands[username].parts > 0;
            
            const modal = document.getElementById('gameOverModal');
            const title = document.getElementById('gameOverTitle');
            const message = document.getElementById('gameOverMessage');
            
            if (modal && title && message) {
                title.textContent = playerWon ? '🎉 Victory!' : '💥 Defeat';
                message.textContent = playerWon ? 
                    'You destroyed ' + opponent + "'s island! Congratulations!" : 
                    opponent + ' destroyed your island! Better luck next time!';
                
                modal.classList.remove('hidden');
            }
        }
    </script>
</body>
</html>
  `);
});

// Health check with debug info
app.get('/health', (req, res) => {
  const healthInfo = {
    status: 'OK',
    deploymentUrl: DEPLOYMENT_URL,
    users: Object.keys(gameState.users).length,
    games: Object.keys(gameState.games).length,
    notifications: Object.keys(gameState.notifications).length,
    userDetails: gameState.users,
    timestamp: Date.now()
  };
  console.log('❤️ Health check:', healthInfo);
  res.json(healthInfo);
});

// API Routes
app.post('/user', (req, res) => {
  const username = req.query.q;
  console.log('👤 User registration attempt:', username);
  
  if (!username || username.length > 20) {
    console.log('❌ Invalid username:', username);
    return res.status(400).json({ error: 'Username must be 1-20 characters' });
  }
  
  if (gameState.users[username] && gameState.users[username].online) {
    console.log('❌ Username taken:', username);
    return res.status(409).json({ error: 'Username already taken' });
  }
  
  gameState.users[username] = {
    online: true,
    socketId: null,
    lastSeen: Date.now()
  };
  
  console.log('✅ User registered:', username);
  console.log('📊 Current users:', Object.keys(gameState.users));
  
  res.json({ success: true, username });
});

app.get('/online', (req, res) => {
  const onlineUsers = Object.keys(gameState.users).filter(username => 
    gameState.users[username].online
  );
  console.log('📋 Online users request:', onlineUsers);
  res.json(onlineUsers);
});

// Debug endpoint to see current state
app.get('/debug', (req, res) => {
  res.json({
    users: gameState.users,
    games: gameState.games,
    notifications: gameState.notifications,
    deploymentUrl: DEPLOYMENT_URL
  });
});

// Socket.io Connection Handling
io.on('connection', (socket) => {
  console.log('🔗 New socket connection:', socket.id);
  
  // Send immediate connection confirmation
  socket.emit('connected', { 
    message: 'Connected to server', 
    socketId: socket.id,
    timestamp: Date.now() 
  });

  // Register user with socket
  socket.on('register', (username) => {
    console.log('📝 Registration attempt:', { username, socketId: socket.id });
    
    if (!username) {
      socket.emit('error', { message: 'Username required' });
      return;
    }
    
    if (!gameState.users[username]) {
      console.log('❌ User not found in registry:', username);
      socket.emit('error', { message: 'User not registered. Please refresh and try again.' });
      return;
    }
    
    // Update user with socket ID
    gameState.users[username].socketId = socket.id;
    gameState.users[username].online = true;
    gameState.users[username].lastSeen = Date.now();
    
    console.log(`✅ User ${username} registered with socket ${socket.id}`);
    console.log('📊 Updated users:', gameState.users);
    
    socket.emit('registered', { 
      success: true, 
      username: username,
      onlineUsers: Object.keys(gameState.users).filter(u => gameState.users[u].online && u !== username)
    });
    
    // Notify about pending game requests
    if (gameState.notifications[username] && gameState.notifications[username].length > 0) {
      console.log('📨 Sending pending notifications to:', username, gameState.notifications[username]);
      gameState.notifications[username].forEach(sender => {
        socket.emit('game_request', { from: sender });
      });
    }
    
    // Broadcast updated online users to everyone
    broadcastOnlineUsers();
  });

  // Send game request
  socket.on('send_game_request', (data) => {
    console.log('🎯 Game request:', data);
    const { username, sender } = data;
    
    if (!username || !sender) {
      socket.emit('error', { message: 'Invalid request data' });
      return;
    }
    
    if (!gameState.notifications[username]) {
      gameState.notifications[username] = [];
    }
    gameState.notifications[username].push(sender);
    
    console.log(`📨 Notification stored for ${username}:`, gameState.notifications[username]);
    
    // Notify the recipient if they're online
    const recipient = gameState.users[username];
    if (recipient && recipient.socketId) {
      console.log(`📤 Sending real-time notification to ${username}`);
      io.to(recipient.socketId).emit('game_request', { from: sender });
    } else {
      console.log(`📭 User ${username} is offline, notification stored`);
    }
  });

  // Accept game request
  socket.on('accept_game_request', (data) => {
    console.log('✅ Accept game request:', data);
    const { username, sender } = data;
    
    // Remove notification
    if (gameState.notifications[username]) {
      const before = gameState.notifications[username].length;
      gameState.notifications[username] = gameState.notifications[username].filter(s => s !== sender);
      console.log(`🗑️ Removed notification. Before: ${before}, After: ${gameState.notifications[username].length}`);
    }
    
    // Create game
    const gameId = uuidv4();
    gameState.games[gameId] = {
      players: [sender, username],
      sockets: {},
      state: {
        playersConnected: 0,
        scores: { [sender]: 0, [username]: 0 },
        islands: {
          [sender]: { parts: 10, shields: 0 },
          [username]: { parts: 10, shields: 0 }
        },
        moves: [`Game created between ${sender} and ${username}`],
        phase: 'rps',
        turn: null,
        pendingRPS: {},
        winner: null,
        gameOver: false
      }
    };
    
    console.log(`🎮 Game created: ${gameId} - ${sender} vs ${username}`);
    console.log('📊 Current games:', Object.keys(gameState.games));
    
    // Notify both players
    const senderUser = gameState.users[sender];
    const acceptorUser = gameState.users[username];
    
    if (senderUser && senderUser.socketId) {
      console.log(`📤 Notifying sender ${sender}`);
      io.to(senderUser.socketId).emit('game_start', { 
        gameId, 
        opponent: username 
      });
    }
    
    if (acceptorUser && acceptorUser.socketId) {
      console.log(`📤 Notifying acceptor ${username}`);
      io.to(acceptorUser.socketId).emit('game_start', { 
        gameId, 
        opponent: sender 
      });
    }
  });

  // Join game
  socket.on('join_game', (data) => {
    console.log('🔗 Join game:', data);
    const { gameId, username } = data;
    
    if (!gameState.games[gameId]) {
      console.log('❌ Game not found:', gameId);
      socket.emit('error', { message: 'Game not found' });
      return;
    }
    
    const game = gameState.games[gameId];
    
    // Store socket for this game
    game.sockets[username] = socket.id;
    
    if (game.state.playersConnected < 2) {
      game.state.playersConnected++;
      game.state.moves.push(`${username} joined the game`);
      
      console.log(`👥 Player ${username} joined. Now ${game.state.playersConnected}/2 players`);
      
      if (game.state.playersConnected === 2) {
        // Both players joined, start the game
        game.state.turn = game.players[Math.floor(Math.random() * 2)];
        game.state.moves.push(`🎮 Both players connected! ${game.state.turn} goes first.`);
        
        console.log(`✅ Game ${gameId} started with both players`);
      }
      
      // Broadcast updated game state to all players in this game
      broadcastGameState(gameId);
    }
  });

  // Make RPS choice
  socket.on('make_rps_choice', (data) => {
    console.log('🎲 RPS choice:', data);
    const { gameId, username, choice } = data;
    
    if (!gameState.games[gameId]) {
      socket.emit('error', { message: 'Game not found' });
      return;
    }
    
    const game = gameState.games[gameId];
    const state = game.state;
    
    if (state.phase !== 'rps') {
      socket.emit('error', { message: 'Not in RPS phase' });
      return;
    }
    
    if (state.turn !== username) {
      socket.emit('error', { message: 'Not your turn' });
      return;
    }
    
    state.pendingRPS[username] = choice;
    state.moves.push(`${username} chose ${choice}`);
    
    // Switch turn to other player
    state.turn = game.players.find(p => p !== username);
    
    // Check if both players have made RPS choices
    if (state.pendingRPS[game.players[0]] && state.pendingRPS[game.players[1]]) {
      const player1Choice = state.pendingRPS[game.players[0]];
      const player2Choice = state.pendingRPS[game.players[1]];
      const result = evaluateRPS(player1Choice, player2Choice);
      
      console.log(`⚖️ RPS evaluation: ${player1Choice} vs ${player2Choice} = ${result}`);
      
      if (result === null) {
        // Tie
        state.moves.push(`⚖️ Tie! Replaying RPS.`);
        state.pendingRPS = {};
        state.turn = game.players[Math.floor(Math.random() * 2)];
      } else {
        // Winner determined
        const winner = result === 'player1' ? game.players[0] : game.players[1];
        state.winner = winner;
        state.scores[winner] += 10;
        state.phase = 'action';
        state.turn = winner;
        
        state.moves.push(`🎉 ${winner} won RPS and gained 10 points!`);
        state.pendingRPS = {};
      }
    }
    
    // Broadcast updated game state
    broadcastGameState(gameId);
  });

  // Make action
  socket.on('make_action', (data) => {
    console.log('⚡ Action:', data);
    const { gameId, username, action } = data;
    
    if (!gameState.games[gameId]) {
      socket.emit('error', { message: 'Game not found' });
      return;
    }
    
    const game = gameState.games[gameId];
    const state = game.state;
    
    if (state.phase !== 'action') {
      socket.emit('error', { message: 'Not in action phase' });
      return;
    }
    
    if (state.turn !== username || state.winner !== username) {
      socket.emit('error', { message: 'Not your action phase' });
      return;
    }
    
    const opponent = game.players.find(p => p !== username);
    
    switch (action) {
      case 'mortar':
        if (state.islands[opponent].shields > 0) {
          state.islands[opponent].shields--;
          state.moves.push(`💥 ${username} used Mortar!`);
        } else {
          state.moves.push(`💥 ${username} used Mortar! No shields to reduce.`);
        }
        break;
        
      case 'shield':
        if (state.islands[username].shields < 3) {
          state.islands[username].shields++;
          state.moves.push(`🛡️ ${username} bought Shield!`);
        } else {
          state.moves.push(`🛡️ ${username} tried to buy Shield but at maximum.`);
        }
        break;
        
      case 'slicer':
        if (state.islands[opponent].shields === 0) {
          state.islands[opponent].parts--;
          state.moves.push(`🔪 ${username} used Slicer!`);
          
          if (state.islands[opponent].parts <= 0) {
            state.gameOver = true;
            state.moves.push(`🎯 Game over! ${username} wins!`);
          }
        } else {
          state.moves.push(`🔪 ${username} used Slicer but shields blocked it!`);
        }
        break;
    }
    
    // Switch back to RPS phase if game not over
    if (!state.gameOver) {
      state.phase = 'rps';
      state.winner = null;
      state.turn = opponent;
    }
    
    // Broadcast updated game state
    broadcastGameState(gameId);
  });

  // Request game state
  socket.on('get_game_state', (data) => {
    const { gameId } = data;
    
    if (!gameState.games[gameId]) {
      socket.emit('error', { message: 'Game not found' });
      return;
    }
    
    socket.emit('game_state_update', gameState.games[gameId].state);
  });

  // Helper function to broadcast game state to all players in a game
  function broadcastGameState(gameId) {
    const game = gameState.games[gameId];
    if (!game) return;
    
    console.log(`📤 Broadcasting game state for ${gameId} to players:`, game.players);
    
    game.players.forEach(player => {
      const playerSocketId = game.sockets[player];
      if (playerSocketId) {
        io.to(playerSocketId).emit('game_state_update', game.state);
        console.log(`📨 Sent update to ${player}`);
      } else {
        console.log(`❌ No socket found for player ${player}`);
      }
    });
  }

  // Helper function to broadcast online users to everyone
  function broadcastOnlineUsers() {
    const onlineUsers = Object.keys(gameState.users).filter(username => 
      gameState.users[username].online
    );
    console.log('📢 Broadcasting online users:', onlineUsers);
    io.emit('online_users_update', onlineUsers);
  }

  // Handle disconnection
  socket.on('disconnect', (reason) => {
    console.log('🔌 User disconnected:', socket.id, 'Reason:', reason);
    
    // Mark user as offline
    Object.keys(gameState.users).forEach(username => {
      if (gameState.users[username].socketId === socket.id) {
        gameState.users[username].online = false;
        gameState.users[username].socketId = null;
        console.log(`📴 User ${username} went offline`);
        
        // Broadcast updated online users
        broadcastOnlineUsers();
      }
    });
  });

  // Handle connection errors
  socket.on('connect_error', (error) => {
    console.log('❌ Socket connection error:', error);
  });
});

// Cleanup inactive users every minute
setInterval(() => {
  const now = Date.now();
  let cleaned = 0;
  
  Object.keys(gameState.users).forEach(username => {
    if (gameState.users[username].online && now - gameState.users[username].lastSeen > 300000) { // 5 minutes
      gameState.users[username].online = false;
      cleaned++;
      console.log(`🧹 Cleaned up inactive user: ${username}`);
    }
  });
  
  if (cleaned > 0) {
    console.log(`🧹 Cleaned up ${cleaned} inactive users`);
  }
}, 60000);

// Start server
server.listen(PORT, () => {
  console.log(`🎮 Vortex Islands Server running on port ${PORT}`);
  console.log(`🌐 Deployment URL: ${DEPLOYMENT_URL}`);
  console.log('✅ Single-file solution ready!');
  console.log('📁 No external HTML files needed');
});

module.exports = app;
