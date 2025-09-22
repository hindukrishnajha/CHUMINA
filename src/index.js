// src/index.js
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const express = require('express');
const WebSocket = require('ws');
const { botState } = require('../config/botState');
const { LEARNED_RESPONSES_PATH } = require('../config/constants');
const { startBot, stopBot } = require('./bot/bot');
const { loadCommands } = require('./bot/commands');
const { setupWebSocket } = require('./bot/websocket');
const { setupExpress } = require('./server/app');

let gTTS;
try {
  gTTS = require('gtts');
  console.log('gTTS module loaded successfully');
} catch (err) {
  console.error('Error loading gTTS module:', err.message);
  process.exit(1);
}

let wiegine;
try {
  wiegine = require('fca-mafiya');
  console.log('fca-mafiya module loaded successfully');
} catch (err) {
  console.error('Error loading fca-mafiya module:', err.message);
  process.exit(1);
}

// Initialize bot state
if (!botState.sessions) botState.sessions = {};
if (!botState.lockedGroups) botState.lockedGroups = {};
if (!botState.lockedNicknames) botState.lockedNicknames = {};
if (!botState.nicknameQueues) botState.nicknameQueues = {};
if (!botState.nicknameTimers) botState.nicknameTimers = {};
if (!botState.abuseTargets) botState.abuseTargets = {};
if (!botState.welcomeMessages) botState.welcomeMessages = require('../responses/welcome').welcomeMessages;
if (!botState.goodbyeMessages) botState.goodbyeMessages = require('../responses/goodbye').goodbyeMessages;
if (!botState.memberCache) botState.memberCache = {};
if (!botState.commandCooldowns) botState.commandCooldowns = {};
if (!botState.learnedResponses) botState.learnedResponses = {};
if (!botState.eventProcessed) botState.eventProcessed = {};
if (!botState.chatEnabled) botState.chatEnabled = {};
if (!botState.deleteNotifyEnabled) botState.deleteNotifyEnabled = {};
if (!botState.roastEnabled) botState.roastEnabled = {};
if (!botState.roastTargets) botState.roastTargets = {};
if (!botState.mutedUsers) botState.mutedUsers = {};
if (!botState.roastCooldowns) botState.roastCooldowns = {};
if (!botState.lastNicknameChange) botState.lastNicknameChange = {};
if (!botState.mafiaGames) botState.mafiaGames = {};

try {
  if (fs.existsSync(LEARNED_RESPONSES_PATH)) {
    botState.learnedResponses = JSON.parse(fs.readFileSync(LEARNED_RESPONSES_PATH, 'utf8'));
    botState.adminList = Array.isArray(botState.learnedResponses.adminList) && botState.learnedResponses.adminList.length > 0 
      ? botState.learnedResponses.adminList.concat([require('../config/constants').MASTER_ID]).filter((v, i, a) => a.indexOf(v) === i) 
      : [require('../config/constants').MASTER_ID];
    botState.chatEnabled = botState.learnedResponses.chatEnabled || {};
    botState.deleteNotifyEnabled = botState.learnedResponses.deleteNotifyEnabled || {};
    botState.roastEnabled = botState.learnedResponses.roastEnabled || {};
    botState.roastTargets = botState.learnedResponses.roastTargets || {};
    botState.mutedUsers = botState.learnedResponses.mutedUsers || {};
    botState.lockedGroups = botState.learnedResponses.lockedGroups || {};
    botState.lockedNicknames = botState.learnedResponses.lockedNicknames || {};
    botState.nicknameQueues = botState.learnedResponses.nicknameQueues || {};
    botState.lastNicknameChange = botState.learnedResponses.lastNicknameChange || {};
    botState.mafiaGames = botState.learnedResponses.mafiaGames || {};
    console.log('Loaded adminList:', botState.adminList, 'chatEnabled:', botState.chatEnabled, 'deleteNotifyEnabled:', botState.deleteNotifyEnabled);
    Object.keys(botState.sessions).forEach(userId => {
      if (!botState.learnedResponses[userId]) {
        botState.learnedResponses[userId] = { triggers: [] };
      }
    });
    Object.keys(botState.mafiaGames).forEach(gameID => {
      const game = botState.mafiaGames[gameID];
      if (game && Array.isArray(game.alive)) {
        game.alive = new Set(game.alive);
      }
    });
  } else {
    botState.learnedResponses = { 
      adminList: [require('../config/constants').MASTER_ID], 
      chatEnabled: {}, 
      deleteNotifyEnabled: {}, 
      roastEnabled: {}, 
      roastTargets: {}, 
      mutedUsers: {}, 
      lockedGroups: {}, 
      lockedNicknames: {},
      nicknameQueues: {},
      lastNicknameChange: {},
      mafiaGames: {}
    };
    fs.writeFileSync(LEARNED_RESPONSES_PATH, JSON.stringify(botState.learnedResponses, null, 2), 'utf8');
    botState.adminList = [require('../config/constants').MASTER_ID];
    botState.chatEnabled = {};
    botState.deleteNotifyEnabled = {};
    botState.roastEnabled = {};
    botState.roastTargets = {};
    botState.mutedUsers = {};
    botState.lockedGroups = {};
    botState.lockedNicknames = {};
    botState.nicknameQueues = {};
    botState.lastNicknameChange = {};
    botState.mafiaGames = {};
    console.log('Initialized learned_responses.json with adminList:', botState.adminList);
  }
} catch (err) {
  console.error('Error loading learned_responses.json:', err.message);
  botState.learnedResponses = { 
    adminList: [require('../config/constants').MASTER_ID], 
    chatEnabled: {}, 
    deleteNotifyEnabled: {}, 
    roastEnabled: {}, 
    roastTargets: {}, 
    mutedUsers: {}, 
    lockedGroups: {}, 
    lockedNicknames: {},
    nicknameQueues: {},
    lastNicknameChange: {},
    mafiaGames: {}
  };
  botState.adminList = [require('../config/constants').MASTER_ID];
  botState.chatEnabled = {};
  botState.deleteNotifyEnabled = {};
  botState.roastEnabled = {};
  botState.roastTargets = {};
  botState.mutedUsers = {};
  botState.lockedGroups = {};
  botState.lockedNicknames = {};
  botState.nicknameQueues = {};
  botState.lastNicknameChange = {};
  botState.mafiaGames = {};
  fs.writeFileSync(LEARNED_RESPONSES_PATH, JSON.stringify(botState.learnedResponses, null, 2), 'utf8');
}

botState.autoConvo = false;

// Initialize Express and WebSocket
const app = express();
const PORT = process.env.PORT || 3000;
let server;
try {
  server = app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
} catch (err) {
  console.error('Error starting Express server:', err.message);
  process.exit(1);
}

// Setup Express routes
setupExpress(app);

// Setup WebSocket
let wss;
try {
  if (server) {
    wss = new WebSocket.Server({ server });
    setupWebSocket(wss, startBot, stopBot);
  } else {
    console.error('Cannot initialize WebSocket server: Express server not running');
    process.exit(1);
  }
} catch (err) {
  console.error('Error initializing WebSocket server:', err.message);
  process.exit(1);
}

// Load commands
loadCommands();

// Memory cleanup and keep-alive
const axios = require('axios');
const keepAlive = setInterval(() => {
  axios.get(`https://${process.env.RENDER_SERVICE_NAME || 'your-render-service'}.onrender.com/health`).catch(err => {
    console.error('Keep-alive request failed:', err.message);
  });
}, 5000);

setInterval(() => {
  const used = process.memoryUsage().heapUsed / 1024 / 1024;
  if (used > 150) {
    botState.memberCache = {};
    botState.abuseTargets = {};
    botState.lockedNicknames = {};
    botState.nicknameQueues = {};
    botState.nicknameTimers = {};
    botState.commandCooldowns = {};
    botState.roastCooldowns = {};
    if (Object.keys(botState.eventProcessed).length > 0) {
      botState.eventProcessed = {};
    }
    require('./utils/messageStore').clearAll();
    console.log('Cleared memory caches due to high usage');
  }
}, 30000);

// Handle process exit
process.on('exit', () => {
  botState.mafiaGames = {};
  try {
    fs.writeFileSync(LEARNED_RESPONSES_PATH, JSON.stringify(botState, null, 2), 'utf8');
    console.log('[DEBUG] Cleared mafiaGames on exit, state saved');
  } catch (err) {
    console.error(`[ERROR] Failed to save state on exit: ${err.message}`);
  }
});

// Error handling
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err.message);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});
