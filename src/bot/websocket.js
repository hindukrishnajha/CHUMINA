// src/bot/websocket.js
const WebSocket = require('ws');
const { botState } = require(path.join(__dirname, '../config/botState'));

function initializeWebSocket(server) {
  const wss = new WebSocket.Server({ server });

  wss.on('connection', (ws) => {
    console.log('[WEBSOCKET] Client connected');

    ws.on('message', (message) => {
      try {
        const data = JSON.parse(message);
        if (data.type === 'subscribe') {
          ws.userId = data.userId;
          console.log(`[WEBSOCKET] Client subscribed for user ${data.userId}`);
        }
      } catch (err) {
        console.error('[WEBSOCKET] Error parsing message:', err.message);
      }
    });

    ws.on('close', () => {
      console.log('[WEBSOCKET] Client disconnected');
    });
  });

  function broadcast(message) {
    wss.clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN && (!message.userId || client.userId === message.userId)) {
        client.send(JSON.stringify(message));
      }
    });
  }

  botState.broadcast = broadcast;
}

module.exports = { initializeWebSocket };
