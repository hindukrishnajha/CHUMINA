// src/server/websocket.js
const WebSocket = require('ws');
const { startBot, stopBot } = require('../bot/bot');
const { botState } = require('../config/botState');

function initializeWebSocket(server) {
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
          startBot(data.userId, data.cookieContent, data.prefix, data.adminId);
        } else if (data.type === 'stop') {
          if (data.userId && botState.sessions[data.userId]) {
            stopBot(data.userId);
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

  return wss;
}

module.exports = { initializeWebSocket };
