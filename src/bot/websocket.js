// src/bot/websocket.js
function setupWebSocket(wss, startBot, stopBot) {
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
          console.error('Invalid WebSocket message:', parseErr
