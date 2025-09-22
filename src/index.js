// src/index.js
require('dotenv').config();
const { startServer } = require('./server/app');
const { initializeWebSocket } = require('./server/websocket');
const { startBot } = require('./bot/bot');

console.log('Starting CHUMINA Bot...');

// Start Express server
const server = startServer();

// Initialize WebSocket
initializeWebSocket(server);

// Start bot (you can pass userId, cookieContent, prefix, adminId if needed)
startBot(process.env.USER_ID, process.env.COOKIE_CONTENT, process.env.PREFIX, process.env.ADMIN_ID);

// Handle uncaught errors
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err.message);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});
