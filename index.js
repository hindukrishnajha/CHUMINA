// Crash protection at top
process.on('uncaughtException', (error) => {
    console.log('🛑 Error but continuing:', error.message);
});

process.on('unhandledRejection', (reason, promise) => {
    console.log('🛑 Promise rejection but continuing:', reason);
});

require('dotenv').config();
const express = require('express');
const WebSocket = require('ws');
const path = require('path');

// Import modules
const { botState } = require('./config/botState');
const eventHandler = require('./handlers/eventHandler');
const { startBot, stopBot } = require('./utils/botManager');

const app = express();
const PORT = process.env.PORT || 3000;

// Basic setup
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));

// EJS setup
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Routes
app.get('/', (req, res) => {
  const filePath = path.join(__dirname, 'index.html');
  if (require('fs').existsSync(filePath)) {
    res.sendFile(filePath);
  } else {
    res.status(404).send('Cannot GET: index.html not found.');
  }
});

app.get('/health', (req, res) => {
  const firstSession = Object.values(botState.sessions)[0];
  const status = firstSession?.safeMode ? 'SAFE MODE' : 'active';
  res.status(200).json({
    status: status,
    bot: 'Shalender Bot',
    version: '10.0.0'
  });
});

app.get('/keepalive', (req, res) => {
  res.status(200).json({ status: 'alive' });
});

// Mafia game routes
app.get('/mafia/:gameID', (req, res) => {
  const mafiaHandler = require('./events/mafiaHandler');
  mafiaHandler.renderGamePage(req, res, botState);
});

app.post('/mafia/:gameID/auth', (req, res) => {
  const mafiaHandler = require('./events/mafiaHandler');
  mafiaHandler.handleAuth(req, res, botState);
});

app.get('/mafia/:gameID/role', (req, res) => {
  const mafiaHandler = require('./events/mafiaHandler');
  mafiaHandler.renderRolePage(req, res, botState);
});

app.post('/mafia/:gameID/action', (req, res) => {
  const mafiaHandler = require('./events/mafiaHandler');
  mafiaHandler.handleAction(req, res, botState);
});

// WebSocket for bot control
const server = app.listen(PORT, () => {
  console.log(`🚀 Bot running on port ${PORT}`);
});

const wss = new WebSocket.Server({ server });

wss.on('connection', (ws) => {
  ws.isAlive = true;

  const heartbeat = setInterval(() => {
    if (ws.isAlive === false) {
      clearInterval(heartbeat);
      return ws.terminate();
    }
    ws.isAlive = false;
    ws.send(JSON.stringify({ type: 'heartbeat' }));
  }, 10000);

  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message);
      
      if (data.type === 'heartbeat') {
        ws.isAlive = true;
        return;
      }

      if (data.type === 'start') {
        if (!data.userId || !data.cookieContent) return;
        if (botState.sessions[data.userId]?.running) return;
        startBot(data.userId, data.cookieContent, data.prefix, data.adminId, botState, eventHandler);
      } else if (data.type === 'stop') {
        if (data.userId && botState.sessions[data.userId]) {
          stopBot(data.userId, botState);
        }
      }
    } catch (err) {
      console.log('WebSocket error:', err.message);
    }
  });

  ws.on('close', () => {
    console.log('WebSocket disconnected');
  });
});

// Simple keep-alive
setInterval(() => {
  require('axios').get('https://shelendr-hinduu-kaa-gulaam-raam-kishor.onrender.com/health').catch(() => {});
}, 240000);

console.log('✅ Bot started');
