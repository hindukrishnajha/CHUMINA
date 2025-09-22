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
  const status = firstSession?.safeMode ? 'SAFE MODE (ID Protected)' : 'active';
  res.status(200).json({
    status: status,
    bot: 'शेलेन्द्र हिन्दू का गुलाम राम किशोर बोट नम्बर 1',
    version: '10.0.0',
    activeSessions: Object.keys(botState.sessions).length
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
  console.log(`🚀 Bot server running on port ${PORT}`);
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
      const messageStr = Buffer.isBuffer(message) ? message.toString('utf8') : message;
      let data;
      try {
        data = JSON.parse(messageStr);
      } catch (parseErr) {
        console.error('Invalid WebSocket message:', parseErr.message);
        ws.send(JSON.stringify({ type: 'log', message: `Invalid message format: ${parseErr.message}` }));
        return;
      }

      if (data.type === 'heartbeat') {
        ws.isAlive = true;
        return;
      }

      if (data.type === 'start') {
        if (!data.userId || !data.cookieContent) {
          ws.send(JSON.stringify({ type: 'log', message: 'Missing userId or cookieContent' }));
          return;
        }
        if (botState.sessions[data.userId]?.running) {
          ws.send(JSON.stringify({ type: 'log', message: `Bot already running for ${data.userId}. Skipping login to avoid suspension.` }));
          return;
        }
        startBot(data.userId, data.cookieContent, data.prefix, data.adminId, botState, eventHandler);
      } else if (data.type === 'stop') {
        if (data.userId && botState.sessions[data.userId]) {
          stopBot(data.userId, botState);
          ws.send(JSON.stringify({ type: 'log', message: `Bot stopped for user ${data.userId}`, userId: data.userId }));
          ws.send(JSON.stringify({ type: 'status', userId: data.userId, running: false }));
        } else {
          ws.send(JSON.stringify({ type: 'log', message: `No active session for user ${data.userId}` }));
        }
      } else if (data.type === 'checkStatus') {
        const userId = data.userId;
        const running = !!botState.sessions[userId] && botState.sessions[userId].running;
        const safeMode = botState.sessions[userId]?.safeMode || false;
        ws.send(JSON.stringify({
          type: 'status',
          userId,
          running,
          safeMode
        }));
      } else {
        ws.send(JSON.stringify({ type: 'log', message: `Unknown message type: ${data.type}` }));
      }
    } catch (err) {
      console.error('WebSocket message handling error:', err.message);
      ws.send(JSON.stringify({ type: 'log', message: `Error processing message: ${err.message}` }));
    }
  });

  ws.on('close', () => {
    clearInterval(heartbeat);
    console.log('WebSocket client disconnected');
  });
});

// Keep-alive for Render
setInterval(() => {
  require('axios').get(`https://${process.env.RENDER_SERVICE_NAME || 'your-render-service'}.onrender.com/health`).catch(err => {
    console.error('Keep-alive request failed:', err.message);
  });
}, 5000);

console.log('✅ Modular index.js loaded successfully');
