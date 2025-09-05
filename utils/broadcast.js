// utils/broadcast.js
module.exports = {
  broadcast: (message) => {
    const wss = global.wss; // Assuming wss is attached globally
    if (!wss || !wss.clients) {
      console.error('[ERROR] WebSocket server (wss) is not initialized');
      return;
    }
    try {
      wss.clients.forEach(client => {
        if (client.readyState === require('ws').OPEN) {
          client.send(JSON.stringify(message));
          console.log(`[DEBUG] Broadcasted message to client: ${JSON.stringify(message)}`);
        }
      });
    } catch (err) {
      console.error('[ERROR] Broadcast error:', err.message);
    }
  }
};
