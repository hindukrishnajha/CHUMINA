// src/index.js
const path = require('path');
const { startServer } = require('./server/app');
const { startBot } = require('./bot/bot');
const { initializeWebSocket } = require('./bot/websocket');
const { botState } = require(path.join(__dirname, '../config/botState'));
const { botConfig } = require(path.join(__dirname, '../config/botConfig'));
const { MASTER_ID } = require(path.join(__dirname, '../config/constants'));

const server = startServer();
initializeWebSocket(server);

// Start bot with environment variables
const userId = process.env.USER_ID || MASTER_ID;
const cookieContent = process.env.COOKIE_BASE64 || '';
const prefix = process.env.PREFIX || '#';
const adminID = process.env.ADMIN_ID || 'SHALENDER.HINDU.BAAP.JI.HERE.1';

if (!cookieContent) {
  console.error('[ERROR] COOKIE_BASE64 not provided in environment variables');
  process.exit(1);
}

startBot(userId, cookieContent, prefix, adminID);

setInterval(() => {
  console.log('[KEEPALIVE] Bot is running...');
}, 300000);
