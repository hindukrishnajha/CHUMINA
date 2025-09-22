// src/bot/bot.js
const fs = require('fs');
const path = require('path');
const wiegine = require('fca-mafiya');
const { botState } = require(path.join(__dirname, '../../config/botState'));
const { botConfig } = require(path.join(__dirname, '../../config/botConfig'));
const { LEARNED_RESPONSES_PATH, MASTER_ID } = require(path.join(__dirname, '../../config/constants'));
const { loadAbuseMessages, loadWelcomeMessages, saveFile } = require(path.join(__dirname, '../../utils/fileUtils'));
const { listenEvents } = require('./message');
const { broadcast } = require(path.join(__dirname, '../../utils/broadcast'));

function stopBot(userId) {
  if (!botState.sessions[userId]) {
    broadcast({ type: 'log', message: `No active session for user ${userId}`, userId });
    return;
  }

  botState.sessions[userId].manualStop = true;

  if (botState.learnedResponses[userId]) {
    delete botState.learnedResponses[userId];
    try {
      fs.writeFileSync(LEARNED_RESPONSES_PATH, JSON.stringify(botState.learnedResponses, null, 2), 'utf8');
      console.log(`Deleted learned responses for user ${userId}`);
    } catch (err) {
      console.error(`Error saving learned_responses.json after deleting user ${userId} responses: ${err.message}`);
    }
  }

  if (botState.sessions[userId].api) {
    try {
      botState.sessions[userId].api.logout(() => {});
    } catch (err) {
      console.error(`Logout error for ${userId}:`, err.message);
    }
    botState.sessions[userId].api = null;
  }

  delete botState.sessions[userId];
  broadcast({ type: 'log', message: `Bot stopped for user ${userId}`, userId });
  broadcast({ type: 'status', userId, running: false });
}

function startBot(userId, cookieContent, prefix, adminID) {
  console.log(`[SAFE] Starting bot for user ${userId}`);
  if (botState.sessions[userId]) {
    stopBot(userId);
  }

  botState.sessions[userId] = {
    running: true,
    prefix: prefix || '#',
    adminID: adminID || '',
    api: null,
    cookieContent,
    botConfig: { autoSpamAccept: false, autoMessageAccept: false, antiOut: botConfig.botConfig.antiOut },
    manualStop: false,
    safeMode: false
  };

  if (!botState.learnedResponses[userId]) {
    botState.learnedResponses[userId] = { triggers: [] };
    fs.writeFileSync(LEARNED_RESPONSES_PATH, JSON.stringify(botState.learnedResponses, null, 2), 'utf8');
  }

  const tryLogin = (attempt = 1, maxAttempts = 1) => {
    if (botState.sessions[userId]?.manualStop) {
      console.log(`Manual stop detected for ${userId}, no retry`);
      return;
    }
    if (attempt > maxAttempts) {
      console.error(`Login failed for ${userId} after ${maxAttempts} attempts`);
      botState.sessions[userId].safeMode = true;
      botState.sessions[userId].running = true;
      botState.sessions[userId].api = null;
      broadcast({ type: 'log', message: `Login failed – switched to SAFE MODE. Bot server alive, but no FB actions. Update cookies & restart!`, userId });
      return;
    }

    try {
      const cookieFile = `cookies_${userId}.txt`;
      if (!fs.existsSync(cookieFile)) {
        fs.writeFileSync(cookieFile, Buffer.from(cookieContent, 'base64').toString('utf8'), 'utf8');
      }

      wiegine.login(cookieContent, {}, (err, api) => {
        if (err || !api) {
          console.error(`[SAFE] Login failed for user ${userId} (attempt ${attempt}):`, err?.message || err);
          botState.sessions[userId].safeMode = true;
          botState.sessions[userId].running = true;
          botState.sessions[userId].api = null;
          broadcast({ type: 'log', message: `Single login attempt failed. SAFE MODE activated to protect ID. Update cookies!`, userId });
          return;
        }

        botState.sessions[userId].api = api;
        botState.sessions[userId].botID = api.getCurrentUserID();
        botState.sessions[userId].safeMode = false;
        api.setOptions({ listenEvents: true, autoMarkRead: true });

        try {
          botState.welcomeMessages = loadWelcomeMessages();
        } catch (err) {
          saveFile('welcome.txt', botState.welcomeMessages.join('\n'));
        }

        listenEvents(api, userId);
      });
    } catch (err) {
      console.error(`Error in startBot for ${userId}:`, err.message);
      botState.sessions[userId].safeMode = true;
      botState.sessions[userId].running = true;
    }
  };
  tryLogin();
}

module.exports = { startBot, stopBot };
