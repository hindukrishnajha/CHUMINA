require('dotenv').config();
const fs = require('fs');
const path = require('path');
const express = require('express');
const WebSocket = require('ws');
const axios = require('axios');
const play = require('play-dl');
const search = require('yt-search');
const timeout = require('connect-timeout');
const { processNicknameChange, sendMessageWithCooldown, retryNicknameChange, ensureThreadHasMessage } = require('./utils/nicknameUtils');
const { getAIResponse } = require('./utils/aichat');
const messageStore = require('./utils/messageStore');

process.stdout.setEncoding('utf8');
process.stderr.setEncoding('utf8');

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

const botConfig = require('./config/botConfig').botConfig;
const { botState } = require('./config/botState');
const { MASTER_ID, MASTER_FB_LINK, LEARNED_RESPONSES_PATH } = require('./config/constants');

const adminTagReplies = require('./responses/adminTagReplies');
const autoreplies = require('./responses/autoreplies');
const favoriteStickers = require('./responses/favoriteStickers');
const goodbyeMessages = require('./responses/goodbye').goodbyeMessages;
const randomBotReplies = require('./responses/randomBotReplies');
const welcomeMessages = require('./responses/welcome').welcomeMessages;
const masterReplies = require('./responses/masterReplies');

const { broadcast } = require('./utils/broadcast');
const { loadAbuseMessages, loadWelcomeMessages, saveFile } = require('./utils/fileUtils');

const commands = new Map();
const commandFolders = ['admin', 'user', 'master'];
for (const folder of commandFolders) {
  const commandFiles = fs.readdirSync(`./commands/${folder}`).filter(file => file.endsWith('.js'));
  console.log(`[DEBUG] Scanning folder: ${folder}, found files: ${commandFiles}`);
  for (const file of commandFiles) {
    try {
      const command = require(`./commands/${folder}/${file}`);
      console.log(`[DEBUG] Loading command: ${command.name} from ${file}`);
      commands.set(command.name, command);
      if (command.aliases) {
        command.aliases.forEach(alias => {
          console.log(`[DEBUG] Loading alias: ${alias} for command ${command.name}`);
          commands.set(alias, command);
        });
      }
    } catch (err) {
      console.error(`Error loading command ${file} from ${folder}:`, err.message);
    }
  }
}
console.log('[DEBUG] All loaded commands:', Array.from(commands.keys()));

if (!botState.sessions) botState.sessions = {};
if (!botState.lockedGroups) botState.lockedGroups = {};
if (!botState.lockedNicknames) botState.lockedNicknames = {};
if (!botState.nicknameQueues) botState.nicknameQueues = {};
if (!botState.nicknameTimers) botState.nicknameTimers = {};
if (!botState.abuseTargets) botState.abuseTargets = {};
if (!botState.welcomeMessages) botState.welcomeMessages = welcomeMessages;
if (!botState.goodbyeMessages) botState.goodbyeMessages = goodbyeMessages;
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
      ? botState.learnedResponses.adminList.concat([MASTER_ID]).filter((v, i, a) => a.indexOf(v) === i) 
      : [MASTER_ID];
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
    // Restore Sets for mafiaGames alive after load
    Object.keys(botState.mafiaGames).forEach(gameID => {
      const game = botState.mafiaGames[gameID];
      if (game && Array.isArray(game.alive)) {
        game.alive = new Set(game.alive);
      }
    });
  } else {
    botState.learnedResponses = { 
      adminList: [MASTER_ID], 
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
    botState.adminList = [MASTER_ID];
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
    adminList: [MASTER_ID], 
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
  botState.adminList = [MASTER_ID];
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

const app = express();
const PORT = process.env.PORT || 3000;

// EJS सेटअप
const ejs = require('ejs');
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(timeout('60s'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));

// Mafia गेम रूट्स
app.get('/mafia/:gameID', (req, res) => {
  const gameID = req.params.gameID;
  const game = botState.mafiaGames[gameID];
  
  if (!game || !game.active) {
    return res.render('error', { message: '🚫 गेम नहीं मिला या खत्म हो चुका है! 🕉️' });
  }

  res.render('loading', { gameID });
});

app.post('/mafia/:gameID/auth', (req, res) => {
  const gameID = req.params.gameID;
  let userID = req.body.userID ? req.body.userID.trim() : '';  // Trim UID
  const game = botState.mafiaGames[gameID];

  console.log(`[DEBUG] Auth request: gameID=${gameID}, userID=${userID}, players keys=${JSON.stringify(Object.keys(game.players || {}))}`);  // Debug log

  if (!game || !game.active) {
    return res.render('error', { message: '🚫 गेम नहीं मिला या खत्म हो चुका है! 🕉️' });
  }

  if (!userID || !game.players[userID]) {
    return res.render('error', { message: '🚫 गलत UID या यूजर गेम में नहीं है! 🕉️' });
  }

  res.redirect(`/mafia/${gameID}/role?uid=${userID}`);
});

app.get('/mafia/:gameID/role', (req, res) => {
  const gameID = req.params.gameID;
  const userID = req.query.uid;
  const game = botState.mafiaGames[gameID];

  if (!game || !game.active) {
    return res.render('error', { message: '🚫 गेम नहीं मिला या खत्म हो चुका है! 🕉️' });
  }

  if (!userID || !game.players[userID]) {
    return res.render('error', { message: '🚫 गलत UID या यूजर गेम में नहीं है! 🕉️' });
  }

  const player = game.players[userID];
  const isAlive = game.alive.has(userID);
  const roleActions = {
    Mafia: { action: 'eliminate', description: 'किसी को मारने के लिए चुनें। 😈' },
    Doctor: { action: 'save', description: 'किसी को बचाने के लिए चुनें। 🩺' },
    Detective: { action: 'check', description: 'किसी की भूमिका जाँचने के लिए चुनें। 🔎' },
    Villager: { action: null, description: 'आपका काम यहाँ नहीं, ग्रुप में है। ग्रुप में रहकर अपने दिमाग से पता लगाओ माफिया कौन है और सबको convince करो कि ये माफिया हो सकता है ताकि सब वोट देकर उसे eliminate कर दें। 🧑' }
  };
  const currentAction = roleActions[player.role];

  const validPlayers = Object.keys(game.players)
    .filter(id => id !== userID && game.alive.has(id))
    .map(id => ({ id, name: game.players[id].name || `Player_${id}` }));

  const actionResult = game.results && game.results[userID] ? game.results[userID] : null;

  res.render('role', {
    gameID,
    userID,
    role: player.role,
    name: player.name || `Player_${userID}`,
    isAlive,
    phase: game.phase,
    action: currentAction.action,
    actionDescription: currentAction.description,
    players: validPlayers,
    botState,
    message: actionResult || null
  });
});

app.post('/mafia/:gameID/action', (req, res) => {
  const gameID = req.params.gameID;
  const userID = req.body.userID;
  const targetID = req.body.targetID;
  const game = botState.mafiaGames[gameID];

  if (!game || !game.active) {
    return res.json({ success: false, message: '🚫 गेम नहीं मिला या खत्म हो चुका है! 🕉️' });
  }

  if (!userID || !game.players[userID] || !game.alive.has(userID)) {
    return res.json({ success: false, message: '🚫 यूजर गेम में नहीं है या मर चुका है! 🕉️' });
  }

  if (game.phase !== 'night') {
    return res.json({ success: false, message: '🚫 अभी नाइट फेज नहीं है! 🕉️' });
  }

  const player = game.players[userID];
  game.results = game.results || {};

  if (player.role === 'Mafia') {
    game.actions.mafia = game.actions.mafia || [];
    game.actions.mafia.push(targetID);
    game.results[userID] = `😈 तुमने ${game.players[targetID].name || `Player_${targetID}`} को मारने का प्लान बनाया।`;
  } else if (player.role === 'Doctor') {
    game.actions.doctor = targetID;
    game.results[userID] = `🩺 आपने ${game.players[targetID].name || `Player_${targetID}`} को आज रात के लिए save कर दिया। आज माफिया इसे नहीं मार पाएगा।`;
  } else if (player.role === 'Detective') {
    const checkedRole = game.players[targetID].role === 'Mafia' ? 'Mafia है' : 'Mafia नहीं है';
    game.actions.detective = targetID;
    game.results[userID] = `🔎 ${game.players[targetID].name || `Player_${targetID}`} ${checkedRole}।`;
  } else {
    return res.json({ success: false, message: '🚫 गलत एक्शन या रोल! 🕉️' });
  }

  try {
    fs.writeFileSync(LEARNED_RESPONSES_PATH, JSON.stringify(botState, null, 2), 'utf8');
    console.log(`[DEBUG] Action recorded for ${userID} in game ${gameID}`);
  } catch (err) {
    console.error(`[ERROR] Failed to save action state: ${err.message}`);
  }
  res.json({ success: true, message: '✅ एक्शन रजिस्टर हो गया! रिजल्ट नीचे देखें। 🕉️' });
});

app.get('/', (req, res) => {
  if (req.timedout) return res.status(504).send('Server timeout');
  const filePath = path.join(__dirname, 'index.html');
  if (fs.existsSync(filePath)) {
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

if (!fs.existsSync('abuse.txt') && process.env.ABUSE_BASE64) {
  try {
    const abuseContent = Buffer.from(process.env.ABUSE_BASE64, 'base64').toString('utf-8');
    fs.writeFileSync('abuse.txt', abuseContent, 'utf8');
  } catch (err) {
    console.error('Error creating abuse file from BASE64:', err.message);
  }
} else if (!fs.existsSync('abuse.txt')) {
  console.warn('No abuse.txt found and no ABUSE_BASE64 set. Attempting to load default from root folder.');
  try {
    const defaultAbusePath = path.join(__dirname, 'abuse.txt');
    if (fs.existsSync(defaultAbusePath)) {
      console.log('Default abuse.txt loaded from root folder.');
    } else {
      console.warn('No default abuse.txt found in root folder.');
      fs.writeFileSync('abuse.txt', '', 'utf8');
    }
  } catch (err) {
    console.error('Error handling default abuse.txt:', err.message);
  }
}

if (!fs.existsSync('welcome.txt') && process.env.WELCOME_BASE64) {
  try {
    const welcomeContent = Buffer.from(process.env.WELCOME_BASE64, 'base64').toString('utf-8');
    fs.writeFileSync('welcome.txt', welcomeContent, 'utf8');
    botState.welcomeMessages = welcomeContent.split('\n').map(line => line.trim()).filter(line => line.length > 0);
  } catch (err) {
    console.error('Error creating welcome file:', err.message);
  }
}

function sendBotMessage(api, message, threadID, replyToMessageID = null, mentions = [], callback = null) {
  const userId = Object.keys(botState.sessions).find(id => botState.sessions[id].api === api);
  if (botState.sessions[userId]?.safeMode) {
    console.log(`SAFE MODE: Skipping message to ${threadID}`);
    if (callback && typeof callback === 'function') callback(null, null);
    return;
  }
  const randomDelay = Math.floor(Math.random() * 1000) + 1000;
  setTimeout(() => {
    const msgObj = typeof message === 'string' ? { body: message, mentions } : { ...message, mentions };
    if (replyToMessageID && replyToMessageID !== undefined) {  // Fix: Check undefined
      msgObj.messageReply = { messageID: replyToMessageID };
    }
    api.sendMessage(msgObj, threadID, (err, messageInfo) => {
      if (err) {
        console.error(`[SEND-ERROR] Failed to send with reply: ${err.message}. Trying without reply...`);
        const fallbackMsgObj = typeof message === 'string' ? { body: message, mentions } : { ...message, mentions };
        api.sendMessage(fallbackMsgObj, threadID, (fallbackErr, fallbackInfo) => {
          if (fallbackErr) {
            console.error(`[SEND-ERROR] Fallback failed: ${fallbackErr.message}`);
          } else if (fallbackInfo?.messageID) {
            messageStore.storeBotMessage(fallbackInfo.messageID, typeof message === 'string' ? message : JSON.stringify(message), threadID, replyToMessageID);
          }
          if (callback && typeof callback === 'function') callback(fallbackErr, fallbackInfo);
        });
      } else if (messageInfo?.messageID) {
        messageStore.storeBotMessage(messageInfo.messageID, typeof message === 'string' ? message : JSON.stringify(message), threadID, replyToMessageID);
      }
      if (callback && typeof callback === 'function') callback(err, messageInfo);
    });
  }, randomDelay);
}

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
    botConfig: { autoSpamAccept: false, autoMessageAccept: false, antiOut: botConfig.antiOut },
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
        fs.writeFileSync(cookieFile, cookieContent, 'utf8');
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

        let abuseMessages = [];
        try {
          abuseMessages = loadAbuseMessages();
        } catch (err) {
          console.error('Abuse file error:', err.message);
        }

        try {
          botState.welcomeMessages = loadWelcomeMessages();
        } catch (err) {
          saveFile('welcome.txt', botState.welcomeMessages.join('\n'));
        }

        const listenMqtt = (mqttAttempt = 1, maxMqttAttempts = 1) => {
          if (!botState.sessions[userId]?.running || botState.sessions[userId]?.manualStop) {
            console.log(`Session not running or manually stopped for ${userId}`);
            return;
          }

          const userRateLimits = {};

          setInterval(() => {
            if (Object.keys(botState.eventProcessed).length > 0) {
              Object.keys(botState.eventProcessed).forEach(messageID => {
                if (Date.now() - botState.eventProcessed[messageID].timestamp > 60000) {
                  delete botState.eventProcessed[messageID];
                }
              });
              console.log('[MEMORY] Cleared old eventProcessed entries');
            }
            if (Object.keys(userRateLimits).length > 0) {
              Object.keys(userRateLimits).forEach(user => delete userRateLimits[user]);
              console.log('[MEMORY] Cleared userRateLimits');
            }
            Object.keys(botState.roastCooldowns).forEach(senderID => {
              if (Date.now() - botState.roastCooldowns[senderID] > 60000) {
                delete botState.roastCooldowns[senderID];
              }
            });
            Object.keys(botState.commandCooldowns).forEach(threadID => {
              Object.keys(botState.commandCooldowns[threadID]).forEach(command => {
                if (Date.now() - botState.commandCooldowns[threadID][command].timestamp > 10000) {
                  delete botState.commandCooldowns[threadID][command];
                }
              });
              if (Object.keys(botState.commandCooldowns[threadID]).length === 0) {
                delete botState.commandCooldowns[threadID];
              }
            });
            console.log('[DEBUG] Cleared old commandCooldowns');
            cleanupMafiaGames(botState);  // Periodic cleanup every 5 min
          }, 300000);  // 5 min interval for cleanup

          api.listenMqtt(async (err, event) => {
            if (err) {
              console.error(`Listen error for ${userId} (attempt ${mqttAttempt}):`, err?.message || err);
              botState.sessions[userId].safeMode = true;
              broadcast({ type: 'log', message: `Connection lost – SAFE MODE activated. Bot alive, update cookies.`, userId });
              return;
            }

            if (event.type === 'read_receipt' || event.type === 'presence' || event.type === 'typ') {
              console.log(`[DEBUG] Skipping ${event.type} event for threadID=${event.threadID}`);
              return;
            }

            if (event.messageID && botState.eventProcessed[event.messageID]) {
              console.log(`[DEBUG] Skipping duplicate event: ${event.messageID}`);
              return;
            }
            if (event.messageID) {
              if (Object.keys(botState.eventProcessed).length > 100) {
                botState.eventProcessed = {};
                console.log('[MEMORY] Cleared eventProcessed due to size limit');
              }
              botState.eventProcessed[event.messageID] = { timestamp: Date.now() };
            }

            try {
              const senderID = event.senderID || event.author || null;
              const isMaster = senderID === MASTER_ID;
              const isAdmin = Array.isArray(botState.adminList) && (botState.adminList.includes(senderID) || isMaster);
              console.log(`[DEBUG] isAdmin check: senderID=${senderID}, isMaster=${isMaster}, adminList=${JSON.stringify(botState.adminList)}, isAdmin=${isAdmin}`);
              const isGroup = event.threadID !== senderID;
              const botID = botState.sessions[userId].botID;
              const threadID = event.threadID;
              const messageID = event.messageID;

              if (botState.mutedUsers && botState.mutedUsers[threadID] && botState.mutedUsers[threadID].includes(senderID)) {
                console.log(`[MUTE] Ignoring message from muted user ${senderID} in thread ${threadID}`);
                return;
              }

              console.log(`[DEBUG] Processing event for threadID: ${threadID}, senderID: ${senderID}, eventType: ${event.type}, body: "${event.body || 'undefined'}", isReply: ${!!event.messageReply}, replyMessageID: ${event.messageReply?.messageID || 'none'}`);

              if (event.type === 'message' || event.type === 'message_reply') {
                const content = event.body ? event.body.trim() : (event.attachments && event.attachments.length > 0 ? '[attachment: ' + event.attachments[0].type + ']' : '');
                if (!content) {
                  console.log('[DEBUG] Empty message content, skipping');
                  return;
                }
                const attachment = event.attachments && event.attachments.length > 0 ? event.attachments[0] : null;
                messageStore.storeMessage(messageID, content, senderID, threadID, attachment);

                if (isGroup && !content.startsWith(botState.sessions[userId].prefix) && !isMaster && !isAdmin) {
                  const roastEnabled = botState.roastEnabled[threadID] || false;
                  const isTargeted = botState.roastTargets && botState.roastTargets[threadID] && botState.roastTargets[threadID][senderID];
                  console.log(`[ROAST-DEBUG] Checking roast: roastEnabled=${roastEnabled}, isTargeted=${isTargeted}, senderID=${senderID}`);
                  if (roastEnabled || isTargeted) {
                    const now = Date.now();
                    if (!botState.roastCooldowns[senderID] || now - botState.roastCooldowns[senderID] >= 30000) {
                      botState.roastCooldowns[senderID] = now;
                      const roastMsg = await getAIResponse(content, true);
                      sendBotMessage(api, roastMsg, threadID, messageID);
                      console.log(`[ROAST] Sent roast to ${senderID} for message: ${content}`);
                    } else {
                      console.log(`[ROAST] Cooldown active for ${senderID}, skipping`);
                    }
                  }
                }

                if (content.toLowerCase().startsWith('#delete') && isAdmin) {
                  const action = content.toLowerCase().split(' ')[1];
                  if (action === 'on') {
                    botState.deleteNotifyEnabled[threadID] = true;
                    botState.learnedResponses.deleteNotifyEnabled = botState.deleteNotifyEnabled;
                    fs.writeFileSync(LEARNED_RESPONSES_PATH, JSON.stringify(botState.learnedResponses, null, 2), 'utf8');
                    sendBotMessage(api, '✅ डिलीट नोटिफिकेशन चालू कर दिया गया।', threadID, messageID);
                  } else if (action === 'off') {
                    botState.deleteNotifyEnabled[threadID] = false;
                    botState.learnedResponses.deleteNotifyEnabled = botState.deleteNotifyEnabled;
                    fs.writeFileSync(LEARNED_RESPONSES_PATH, JSON.stringify(botState.learnedResponses, null, 2), 'utf8');
                    sendBotMessage(api, '✅ डिलीट नोटिफिकेशन बंद कर दिया गया।', threadID, messageID);
                  } else {
                    sendBotMessage(api, '❌ यूज: #delete on या #delete off', threadID, messageID);
                  }
                  return;
                }

                if (content.toLowerCase().startsWith('#chat') && isAdmin) {
                  const action = content.toLowerCase().split(' ')[1];
                  if (action === 'on') {
                    botState.chatEnabled[threadID] = true;
                    botState.learnedResponses.chatEnabled = botState.chatEnabled;
                    fs.writeFileSync(LEARNED_RESPONSES_PATH, JSON.stringify(botState.learnedResponses, null, 2), 'utf8');
                    sendBotMessage(api, '✅ AI चैट चालू कर दिया गया।', threadID, messageID);
                  } else if (action === 'off') {
                    botState.chatEnabled[threadID] = false;
                    botState.learnedResponses.chatEnabled = botState.chatEnabled;
                    fs.writeFileSync(LEARNED_RESPONSES_PATH, JSON.stringify(botState.learnedResponses, null, 2), 'utf8');
                    sendBotMessage(api, '✅ AI चैट बंद कर दिया गया।', threadID, messageID);
                  } else {
                    sendBotMessage(api, '❌ यूज: #chat on या #chat off', threadID, messageID);
                  }
                  return;
                }

                if (content.toLowerCase().startsWith('#roast') && isAdmin) {
                  const action = content.toLowerCase().split(' ')[1];
                  if (action === 'on') {
                    botState.roastEnabled[threadID] = true;
                    botState.learnedResponses.roastEnabled = botState.roastEnabled;
                    fs.writeFileSync(LEARNED_RESPONSES_PATH, JSON.stringify(botState.learnedResponses, null, 2), 'utf8');
                    sendBotMessage(api, '✅ रोस्ट चालू कर दिया गया।', threadID, messageID);
                  } else if (action === 'off') {
                    botState.roastEnabled[threadID] = false;
                    botState.learnedResponses.roastEnabled = botState.roastEnabled;
                    fs.writeFileSync(LEARNED_RESPONSES_PATH, JSON.stringify(botState.learnedResponses, null, 2), 'utf8');
                    sendBotMessage(api, '✅ रोस्ट बंद कर दिया गया।', threadID, messageID);
                  } else {
                    sendBotMessage(api, '❌ यूज: #roast on या #roast off', threadID, messageID);
                  }
                  return;
                }

                if (content.toLowerCase().startsWith('#loder stop') && isAdmin) {
                  if (botState.abuseTargets[threadID]) {
                    if (Object.keys(event.mentions).length > 0) {
                      const targetID = Object.keys(event.mentions)[0];
                      if (botState.abuseTargets[threadID][targetID]) {
                        api.getUserInfo(targetID, (err, ret) => {
                          if (err || !ret || !ret[targetID]) {
                            sendBotMessage(api, '⚠️ यूजर जानकारी लाने में असफल। 🕉️', threadID, messageID);
                            return;
                          }
                          const name = ret[targetID].name || 'User';
                          delete botState.abuseTargets[threadID][targetID];
                          sendBotMessage(api, `🎯 ${name} का #pel/#loder टारगेट हटा दिया गया! अब गालियां नहीं आएंगी। 🕉️`, threadID, messageID);
                        });
                      } else {
                        sendBotMessage(api, '❌ ये यूजर टारगेटेड नहीं है। 🕉️', threadID, messageID);
                      }
                    } else {
                      delete botState.abuseTargets[threadID];
                      sendBotMessage(api, '🛑 सारी टारगेटिंग बंद कर दी गई। 🕉️', threadID, messageID);
                    }
                  } else {
                    sendBotMessage(api, '⚠️ कोई टारगेटिंग चल नहीं रही। 🕉️', threadID, messageID);
                  }
                  return;
                }

                if (content.startsWith(botState.sessions[userId].prefix)) {
                  const fullCommand = content.split(' ')[0].toLowerCase();
                  const cleanArgs = content.split(' ').slice(1);
                  const command = fullCommand.slice(botState.sessions[userId].prefix.length).toLowerCase();
                  console.log(`[DEBUG] Command detected: ${command}, cleanArgs: ${cleanArgs}, mentions keys: ${Object.keys(event.mentions || {})}, isReply: ${!!event.messageReply}, replyMessageID: ${event.messageReply?.messageID || 'none'}`);
                  if (isMaster) {
                    api.setMessageReaction('😍', messageID, (err) => {});
                  }

                  const cmd = commands.get(command);
                  if (cmd) {
                    if (botState.commandCooldowns[threadID]?.[command]?.timestamp && Date.now() - botState.commandCooldowns[threadID][command].timestamp < 10000) {
                      console.log(`[DEBUG] Command ${command} on cooldown for thread ${threadID}`);
                      sendBotMessage(api, '⚠️ कूलडाउन: 10 सेकंड बाद ट्राई करें।', threadID, messageID);
                      return;
                    }
                    try {
                      if (['stickerspam', 'antiout', 'groupnamelock', 'nicknamelock', 'unsend', 'roast', 'mute', 'unmute'].includes(cmd.name) && !isAdmin) {
                        sendBotMessage(api, "🚫 ये कमांड सिर्फ एडमिन्स या मास्टर के लिए है! 🕉️", threadID, messageID);
                        console.log(`[DEBUG] Command ${cmd.name} rejected: Sender ${senderID} is not admin`);
                      } else if (['stopall', 'status', 'removeadmin', 'masterid', 'mastercommand', 'listadmins', 'list', 'kick', 'addadmin'].includes(cmd.name) && !isMaster) {
                        sendBotMessage(api, "🚫 ये कमांड सिर्फ मास्टर के लिए है! 🕉️", threadID, messageID);
                        console.log(`[DEBUG] Command ${cmd.name} rejected: Sender ${senderID} is not master`);
                      } else {
                        cmd.execute(api, threadID, cleanArgs, event, botState, isMaster, botID, stopBot);
                        if (!botState.commandCooldowns[threadID]) botState.commandCooldowns[threadID] = {};
                        botState.commandCooldowns[threadID][command] = { timestamp: Date.now() };
                        setTimeout(() => delete botState.commandCooldowns[threadID][command], 10000);
                      }
                    } catch (err) {
                      console.error(`[ERROR] Command ${command} error:`, err.message);
                      sendBotMessage(api, `❌ कमांड चलाने में गलती: ${err.message} 🕉️`, threadID, messageID);
                    }
                  } else {
                    if (command === 'learn') {
                      const fullMsg = event.body;
                      const match = fullMsg.match(/#learn\s*\(\s*([^)]+)\s*\)\s*\{\s*([^}]+)\s*\}/i);
                      if (match && isAdmin) {
                        const trigger = match[1].trim();
                        const response = match[2].trim();
                        if (trigger && response) {
                          if (!botState.learnedResponses[userId]) {
                            botState.learnedResponses[userId] = { triggers: [] };
                          }
                          let existingIndex = -1;
                          botState.learnedResponses[userId].triggers.forEach((entry, index) => {
                            if (entry.trigger.toLowerCase().trim() === trigger.toLowerCase().trim()) {
                              existingIndex = index;
                            }
                          });
                          if (existingIndex !== -1) {
                            botState.learnedResponses[userId].triggers[existingIndex].responses.push(response);
                            sendBotMessage(api, `✅ ट्रिगर "${trigger}" अपडेट हो गया! नया रिस्पॉन्स: ${response} 🕉️`, threadID, messageID);
                          } else {
                            botState.learnedResponses[userId].triggers.push({
                              trigger: trigger,
                              responses: [response]
                            });
                            sendBotMessage(api, `✅ नया रिस्पॉन्स सीखा गया!\nट्रिगर: ${trigger}\nरिस्पॉन्स: ${response} 🕉️`, threadID, messageID);
                          }
                          fs.writeFileSync(LEARNED_RESPONSES_PATH, JSON.stringify(botState.learnedResponses, null, 2), 'utf8');
                        } else {
                          sendBotMessage(api, '❌ ट्रिगर को ( ) में डालें, जैसे: #learn (trigger) {response} 🕉️', threadID, messageID);
                        }
                      } else if (!isAdmin) {
                        sendBotMessage(api, "🚫 ये कमांड सिर्फ एडमिन्स या मास्टर के लिए है! 🕉️", threadID, messageID);
                      } else {
                        sendBotMessage(api, `❌ गलत कमांड "${command}"। यूज: ${botState.sessions[userId].prefix}help 🕉️`, threadID, messageID);
                      }
                    } else {
                      console.log(`[DEBUG] Command not found: ${command}`);
                      sendBotMessage(api, `❌ गलत कमांड "${command}"। यूज: ${botState.sessions[userId].prefix}help 🕉️`, threadID, messageID);
                    }
                  }
                  return;
                }
              }

              // FIXED DELETE COMMAND SECTION - YAHI CHANGE KIYA HAI
              if (event.type === 'message_unsend' && botState.deleteNotifyEnabled[threadID]) {
                console.log(`[DEBUG] Processing message_unsend event: messageID=${event.messageID}, threadID=${threadID}`);
                
                // Use the correct messageID from the unsend event
                const unsentMessageID = event.messageID;
                
                api.getThreadInfo(threadID, (err, info) => {
                  if (err) {
                    console.error('[ERROR] Failed to fetch thread info for unsend:', err.message);
                    return; // Don't send message if we can't get thread info
                  }

                  const isBotAdmin = Array.isArray(info.adminIDs) && info.adminIDs.some(admin => admin.id === botID);
                  if (!isBotAdmin) {
                    console.log(`[DEBUG] Bot (ID: ${botID}) is not admin in thread ${threadID} for unsend notification`);
                    // Don't send message if bot is not admin to avoid spam
                    return;
                  }

                  const deletedMsg = messageStore.getMessage(unsentMessageID);
                  if (deletedMsg) {
                    api.getUserInfo(deletedMsg.senderID, (err, userInfo) => {
                      let senderName = 'Unknown';
                      if (!err && userInfo && userInfo[deletedMsg.senderID]) {
                        senderName = userInfo[deletedMsg.senderID].name || 'Unknown';
                      }
                      
                      // Create the notification message
                      const notificationMsg = `${senderName} ने मैसेज डिलीट किया:\n"${deletedMsg.content || '(attachment or empty message)'}"`;
                      
                      // Send notification first
                      sendBotMessage(api, notificationMsg, threadID, null, [], (err, msgInfo) => {
                        if (err) {
                          console.error('[ERROR] Failed to send delete notification:', err.message);
                          return;
                        }
                        
                        // If there's an attachment, resend it separately
                        if (deletedMsg.attachment && deletedMsg.attachment.url) {
                          setTimeout(() => {
                            sendBotMessage(api, { url: deletedMsg.attachment.url }, threadID);
                          }, 1000);
                        }
                        
                        // Clean up the stored message
                        delete messageStore.messages[unsentMessageID];
                      });
                    });
                  } else {
                    console.log(`[DEBUG] No message found for unsend event: messageID=${unsentMessageID}`);
                    // Don't send "message not found" notification to avoid spam
                  }
                });
                return;
              }

              if (!senderID && !['log:thread-name', 'log:thread-admins', 'typ', 'presence'].includes(event.type)) {
                console.warn(`[DEBUG] senderID is undefined for event in thread ${event.threadID || 'undefined'}. Event type: ${event.type}`);
                return;
              }

              if (event.type === 'message' && senderID && botState.chatEnabled[threadID] && (event.body?.toLowerCase().startsWith('#ai') || event.body?.toLowerCase().startsWith('@ai'))) {
                const now = Date.now();
                if (userRateLimits[senderID] && now - userRateLimits[senderID] < 120000) {
                  sendBotMessage(api, '🚫 किंग के नियमों का पालन करो, भाई! 🕉️ एक मिनट में सिर्फ एक सवाल पूछ सकते हो, ताकि तुम किंग की महानता, शूरवीरता, दानवीरता और परमवीरता पर विचार कर सको। सोचो, वो कितने महान हैं! 🌟 जय श्री राम! 🙏', threadID, messageID);
                  return;
                }
                userRateLimits[senderID] = now;
                const userMessage = event.body.replace(/#ai|@ai/gi, '').trim();
                const groqResponse = await getAIResponse(userMessage || 'अरे भाई, कुछ मस्ती करो ना! 😎');
                sendBotMessage(api, groqResponse, threadID, messageID);
                return;
              }

              if (isGroup && senderID !== botID) {
                if (!botState.memberCache[threadID]) {
                  botState.memberCache[threadID] = new Set();
                }
                botState.memberCache[threadID].add(senderID);
                if (botState.memberCache[threadID].size > 50) {
                  botState.memberCache[threadID].clear();
                }
              }

              if (event.mentions && typeof event.mentions === 'object' && Object.keys(event.mentions).length > 0) {
                if (!botState.memberCache[threadID]) {
                  botState.memberCache[threadID] = new Set();
                }
                Object.keys(event.mentions).forEach(id => {
                  if (id !== botID) {
                    botState.memberCache[threadID].add(id);
                    if (botState.memberCache[threadID].size > 50) {
                      botState.memberCache[threadID].clear();
                    }
                  }
                });
              }

              if (event.logMessageType === 'log:subscribe') {
                const addedIDs = Array.isArray(event.logMessageData?.addedParticipants) ? event.logMessageData.addedParticipants.map(p => p.userFbId) : [];
                if (!botState.memberCache[threadID]) {
                  botState.memberCache[threadID] = new Set();
                }
                addedIDs.forEach(id => {
                  if (botState.mutedUsers && botState.mutedUsers[threadID] && botState.mutedUsers[threadID].includes(id)) {
                    console.log(`[MUTE] Skipping welcome for muted user ${id}`);
                    return;
                  }
                  if (id === botID) {
                    sendBotMessage(api, `🍒💙•••Ɓ❍ʈ Ƈøɳɳɛƈʈɛɗ•••💞🌿
🕊️🌸...Ɦɛɭɭ❍ Ɠɣus Ɱɣ ɴαɱɛ ιʂ ʂɧαʟɛɳɗɛɽ ɧιɳɗu Ɱαʂʈɛɽ'ʂ Ɓ❍ʈ...🌸🕊️
🛠️...use #help for commands...🛠️`, threadID, messageID);
                  } else {
                    botState.memberCache[threadID].add(id);
                    try {
                      api.getUserInfo(id, (err, ret) => {
                        if (err || !ret || !ret[id]) {
                          sendBotMessage(api, botState.welcomeMessages[Math.floor(Math.random() * botState.welcomeMessages.length)].replace('{name}', 'User'), threadID, messageID);
                          return;
                        }
                        const name = ret[id].name || 'User';
                        const welcomeMsg = botState.welcomeMessages[Math.floor(Math.random() * botState.welcomeMessages.length)].replace('{name}', name);
                        sendBotMessage(api, welcomeMsg, threadID, messageID);
                      });
                    } catch (err) {
                      sendBotMessage(api, botState.welcomeMessages[Math.floor(Math.random() * botState.welcomeMessages.length)].replace('{name}', 'User'), threadID, messageID);
                    }
                  }
                });
              }

              if (isMaster && event.type === 'message') {
                api.setMessageReaction('😍', messageID, (err) => {});
              }

              if (botConfig.autoSpamAccept && event.type === 'message_request') {
                api.handleMessageRequest(event.threadID, true, (err) => {
                  if (!err) {
                    sendBotMessage(api, "🚀 ऑटो-एक्सेप्ट किया गया मैसेज रिक्वेस्ट!", threadID, messageID);
                  }
                });
              }

              if (event.type === 'message') {
                const msg = event.body?.toLowerCase() || '';
                if (!msg) return;

                const lowerMsg = msg.trim().toLowerCase();
                let responseSent = false;

                const specialTags = ['#ai', '@ai'];
                if (!responseSent && specialTags.some(tag => lowerMsg.includes(tag))) {
                  if (botState.chatEnabled[threadID] === true) {
                    const userMessage = event.body.replace(/#ai|@ai/gi, '').trim();
                    const groqResponse = await getAIResponse(userMessage || 'अरे भाई, कुछ मस्ती करो ना! 😎');
                    sendBotMessage(api, groqResponse, threadID, messageID);
                    responseSent = true;
                    if (messageID && botState.eventProcessed[messageID]) {
                      delete botState.eventProcessed[messageID];
                      console.log(`[MEMORY] Cleared eventProcessed for messageID: ${messageID}`);
                    }
                    if (senderID && userRateLimits[senderID]) {
                      delete userRateLimits[senderID];
                      console.log(`[MEMORY] Cleared userRateLimits for senderID: ${senderID}`);
                    }
                  } else {
                    sendBotMessage(api, '❌ मालिक, चैट ऑफ है! पहले #chat on करो। 🕉️', threadID, messageID);
                    responseSent = true;
                  }
                  return;
                }

                if (isMaster) {
                  if (masterReplies.generalCalls.triggers.some(trigger => lowerMsg === trigger || lowerMsg.includes(trigger))) {
                    const randomReply = masterReplies.generalCalls.replies[Math.floor(Math.random() * masterReplies.generalCalls.replies.length)];
                    sendBotMessage(api, randomReply, threadID, messageID);
                    responseSent = true;
                    return;
                  }

                  if (masterReplies.morningGreetings.triggers.some(trigger => lowerMsg === trigger || lowerMsg.includes(trigger))) {
                    const randomReply = masterReplies.morningGreetings.replies[Math.floor(Math.random() * masterReplies.morningGreetings.replies.length)];
                    sendBotMessage(api, randomReply, threadID, messageID);
                    responseSent = true;
                    return;
                  }

                  if (masterReplies.ramGreetings.triggers.some(trigger => lowerMsg === trigger || lowerMsg.includes(trigger))) {
                    const randomReply = masterReplies.ramGreetings.replies[Math.floor(Math.random() * masterReplies.ramGreetings.replies.length)];
                    sendBotMessage(api, randomReply, threadID, messageID);
                    responseSent = true;
                    return;
                  }

                  if (masterReplies.pelCommands.triggers.some(trigger => lowerMsg.includes(trigger)) && event.mentions && Object.keys(event.mentions).length > 0) {
                    const targetID = Object.keys(event.mentions)[0];
                    if (Array.isArray(botState.adminList) && botState.adminList.includes(targetID)) {
                      const randomAdminAbuseReply = masterReplies.adminAbuseReplies.replies[Math.floor(Math.random() * masterReplies.adminAbuseReplies.replies.length)];
                      sendBotMessage(api, randomAdminAbuseReply, threadID, messageID);
                      responseSent = true;
                      return;
                    }
                    if (!botState.abuseTargets[threadID]) {
                      botState.abuseTargets[threadID] = {};
                    }
                    if (!botState.abuseTargets[threadID][targetID] && abuseMessages.length > 0) {
                      botState.abuseTargets[threadID][targetID] = true;
                      try {
                        api.getUserInfo(targetID, (err, ret) => {
                          if (err || !ret || !ret[targetID]) {
                            sendBotMessage(api, '⚠️ यूजर जानकारी लाने में असफल। 🕉️', threadID, messageID);
                            return;
                          }
                          const name = ret[targetID].name || 'User';
                          const randomPelReply = masterReplies.pelCommands.replies[Math.floor(Math.random() * masterReplies.pelCommands.replies.length)];
                          sendBotMessage(api, randomPelReply, threadID, messageID);
                          const spamLoop = async () => {
                            while (botState.abuseTargets[threadID]?.[targetID] && abuseMessages.length > 0) {
                              if (!botState.abuseTargets[threadID]?.[targetID]) break;
                              try {
                                const randomMsg = abuseMessages[Math.floor(Math.random() * abuseMessages.length)];
                                const mentionTag = `${name.split(' ')[0]}`;
                                await sendBotMessage(api, `${mentionTag} ${randomMsg}`, threadID);
                                if (!botState.abuseTargets[threadID]?.[targetID]) break;
                              } catch (err) {
                                console.error('Pel command abuse loop error:', err.message);
                                break;
                              }
                              await new Promise(r => setTimeout(r, 120000));
                            }
                            console.log('[DEBUG] Pel spam loop ended for target:', targetID);
                          };
                          spamLoop();
                        });
                      } catch (err) {
                        sendBotMessage(api, '⚠️ यूजर जानकारी लाने में असफल। 🕉️', threadID, messageID);
                      }
                    }
                    responseSent = true;
                    return;
                  }

                  for (const question in masterReplies.questionReplies) {
                    if (lowerMsg.includes(question)) {
                      let reply = masterReplies.questionReplies[question];
                      if (Array.isArray(reply)) {
                        reply = reply[Math.floor(Math.random() * reply.length)];
                      }
                      sendBotMessage(api, reply, threadID, messageID);
                      responseSent = true;
                      return;
                    }
                  }
                }

                if (botState.learnedResponses[userId]?.triggers) {
                  for (const triggerEntry of botState.learnedResponses[userId].triggers) {
                    const triggerLower = triggerEntry.trigger.toLowerCase().trim();
                    if (lowerMsg === triggerLower || lowerMsg.includes(triggerLower)) {
                      const responses = triggerEntry.responses;
                      if (responses && responses.length > 0) {
                        const randomResponse = responses[Math.floor(Math.random() * responses.length)];
                        sendBotMessage(api, randomResponse, threadID, messageID);
                        responseSent = true;
                        break;
                      }
                    }
                  }
                }
                if (responseSent) return;

                if (isMaster && event.mentions && Array.isArray(botState.adminList) && Object.keys(event.mentions).some(id => botState.adminList.includes(id))) {
                  const randomAdminTagReply = masterReplies.adminTagReplies.replies[Math.floor(Math.random() * masterReplies.adminTagReplies.replies.length)];
                  sendBotMessage(api, randomAdminTagReply, threadID, messageID);
                  responseSent = true;
                  return;
                }

                const replyList = autoreplies.autoreplies;
                for (let key in replyList) {
                  if (lowerMsg.includes(key.toLowerCase())) {
                    const responses = Array.isArray(replyList[key]) ? [replyList[key]] : [replyList[key]];
                    const randomReply = responses[Math.floor(Math.random() * responses.length)];
                    sendBotMessage(api, randomReply, threadID, messageID);
                    responseSent = true;
                    return;
                  }
                }

                const badWords = [
                  'gandu', 'chutia', 'chutiya', 'lodu', 'lavdi', 'jhatu', 'gandwa', 'gandvi', 'bhosdiwala', 'chinal', 'chapri',
                  'namoona', 'jokar', 'ullu', 'jhat ka baal', 'bhosdiwala', 'bsdk', 'loda lele', 'b gand de',
                  'bc', 'mc', 'lode', 'lode k baal', 'abe lode', 'abe lund', 'abe chutiye', 'abe gandu',
                  'chup lodu', 'chup gandu', 'chup chutiye', 'chup chinal', 'chup lodi', 'chup jhatu',
                  'chup lvdi', 'chup lvda', 'lvda', 'lavdi', 'hijda', 'kinnri', 'chinaal'
                ];

                const isBadWithShalender = (lowerMsg.includes('@shalender') || lowerMsg.includes('shalender')) && badWords.some(word => lowerMsg.includes(word));
                const isBadWithAdminOrMaster = (event.mentions && Array.isArray(botState.adminList) && Object.keys(event.mentions).some(id => id === MASTER_ID || botState.adminList.includes(id))) && badWords.some(word => lowerMsg.includes(word));

                if (isBadWithShalender || (isBadWithAdminOrMaster && !isMaster)) {
                  const abuserID = senderID;
                  if (abuserID === MASTER_ID) return;
                  if (!botState.abuseTargets[threadID]) {
                    botState.abuseTargets[threadID] = {};
                  }
                  if (!botState.abuseTargets[threadID][abuserID] && abuseMessages.length > 0) {
                    botState.abuseTargets[threadID][abuserID] = true;
                    try {
                      api.getUserInfo(abuserID, (err, ret) => {
                        if (err || !ret || !ret[abuserID]) {
                          sendBotMessage(api, '⚠️ यूजर जानकारी लाने में असफल। 🕉️', threadID, messageID);
                          return;
                        }
                        const name = ret[abuserID].name || 'User';
                        const targetMsg = isBadWithShalender 
                          ? `😡 ${name} तूने मालिक शेलेन्द्र को गाली दी? अब हर 2 मिनट में गालियां आएंगी! 🕉️`
                          : `😡 ${name} तूने मास्टर या एडमिन को गाली दी? अब हर 2 मिनट में गालियां आएंगी! 🕉️`;
                        sendBotMessage(api, targetMsg, threadID, messageID);
                        const spamLoop = async () => {
                          while (botState.abuseTargets[threadID]?.[abuserID] && abuseMessages.length > 0) {
                            if (!botState.abuseTargets[threadID]?.[abuserID]) break;
                            try {
                              const randomMsg = abuseMessages[Math.floor(Math.random() * abuseMessages.length)];
                              const mentionTag = `${name.split(' ')[0]}`;
                              await sendBotMessage(api, `${mentionTag} ${randomMsg}`, threadID);
                              if (!botState.abuseTargets[threadID]?.[abuserID]) break;
                            } catch (err) {
                              console.error('Auto-target abuse loop error:', err.message);
                              break;
                            }
                            await new Promise(r => setTimeout(r, 120000));
                          }
                          console.log('[DEBUG] Auto abuse loop ended for abuser:', abuserID);
                        };
                        spamLoop();
                      });
                    } catch (err) {
                      sendBotMessage(api, '⚠️ यूजर जानकारी लाने में असफल। 🕉️', threadID, messageID);
                    }
                  }
                  responseSent = true;
                  return;
                }

                if (event.mentions && Object.keys(event.mentions).includes(botState.sessions[userId].adminID)) {
                  const reply = adminTagReplies[Math.floor(Math.random() * adminTagReplies.length)];
                  const stickerID = favoriteStickers.favoriteStickers[Math.floor(Math.random() * favoriteStickers.favoriteStickers.length)];
                  sendBotMessage(api, reply, threadID, messageID);
                  sendBotMessage(api, { sticker: stickerID }, threadID, messageID);
                  responseSent = true;
                  return;
                }

                if (lowerMsg === 'autoconvo on' && isAdmin) {
                  botState.autoConvo = true;
                  sendBotMessage(api, '🔥 ऑटो कॉन्वो चालू हो गया! 🕉️', threadID, messageID);
                  broadcast({
                    type: 'settings',
                    autoSpamAccept: botConfig.autoSpamAccept,
                    autoMessageAccept: botConfig.autoMessageAccept,
                    autoConvo: botState.autoConvo,
                    antiOut: botConfig.antiOut,
                    userId
                  });
                  responseSent = true;
                  return;
                }
                if (lowerMsg === 'autoconvo off' && isAdmin) {
                  botState.autoConvo = false;
                  sendBotMessage(api, '✅ ऑटो कॉन्वो बंद हो गया! 🕉️', threadID, messageID);
                  broadcast({
                    type: 'settings',
                    autoSpamAccept: botConfig.autoSpamAccept,
                    autoMessageAccept: botConfig.autoMessageAccept,
                    autoConvo: botState.autoConvo,
                    antiOut: botConfig.antiOut,
                    userId
                  });
                  responseSent = true;
                  return;
                }

                const triggerWords = ['bc', 'mc', 'bkl', 'bhenchod', 'madarchod', 'lund', 'gandu', 'chutiya', 'randi', 'motherchod', 'fuck', 'bhosda', 'kinnar', 'saali', 'lodi', 'lavdi', 'chinal', 'chinaal', 'gandwa', 'gandva', 'jhatu', 'hijda', 'hijde', 'kinnri'];
                const isAbusive = triggerWords.some(word => lowerMsg.includes(word));
                const isMentioningBot = lowerMsg.includes('bot') || event.mentions?.[botID];

                if ((isAbusive && isMentioningBot) || (isAbusive && botState.autoConvo)) {
                  const abuserID = senderID;
                  if (abuserID === MASTER_ID) return;
                  if (!botState.abuseTargets[threadID]) {
                    botState.abuseTargets[threadID] = {};
                  }
                  if (!botState.abuseTargets[threadID][abuserID] && abuseMessages.length > 0) {
                    botState.abuseTargets[threadID][abuserID] = true;
                    try {
                      api.getUserInfo(abuserID, (err, ret) => {
                        if (err || !ret || !ret[abuserID]) {
                          sendBotMessage(api, '⚠️ यूजर जानकारी लाने में असफल। 🕉️', threadID, messageID);
                          return;
                        }
                        const name = ret[abuserID].name || 'User';
                        sendBotMessage(api, `😡 ${name} तूने मुझे गाली दी? अब हर 2 मिनट में गालियां आएंगी! 🕉️`, threadID, messageID);
                        const spamLoop = async () => {
                          while (botState.abuseTargets[threadID]?.[abuserID] && abuseMessages.length > 0) {
                            if (!botState.abuseTargets[threadID]?.[abuserID]) break;
                            try {
                              const randomMsg = abuseMessages[Math.floor(Math.random() * abuseMessages.length)];
                              const mentionTag = `${name.split(' ')[0]}`;
                              await sendBotMessage(api, `${mentionTag} ${randomMsg}`, threadID);
                              if (!botState.abuseTargets[threadID]?.[abuserID]) break;
                            } catch (err) {
                              console.error('Auto-convo abuse loop error:', err.message);
                              break;
                            }
                            await new Promise(r => setTimeout(r, 120000));
                          }
                          console.log('[DEBUG] Auto-convo abuse loop ended for abuser:', abuserID);
                        };
                        spamLoop();
                      });
                    } catch (err) {
                      sendBotMessage(api, '⚠️ यूजर जानकारी लाने में असफल। 🕉️', threadID, messageID);
                    }
                  }
                  responseSent = true;
                  return;
                }

                if (botState.abuseTargets?.[threadID]?.[senderID]) {
                  const lower = lowerMsg;
                  if (lower.includes('sorry babu') || lower.includes('sorry mikky')) {
                    delete botState.abuseTargets[threadID][senderID];
                    sendBotMessage(api, '😏 ठीक है बेटा! अब तुझे नहीं गाली देंगे। 🕉️', threadID, messageID);
                    responseSent = true;
                    return;
                  }
                }

                if (lowerMsg.includes('bot') && isGroup) {
                  const randomResponse = randomBotReplies[Math.floor(Math.random() * randomBotReplies.length)];
                  sendBotMessage(api, randomResponse, threadID, messageID);
                  responseSent = true;
                  return;
                }
              }

              if (event.logMessageType === 'log:unsubscribe') {
                const leftID = event.logMessageData?.leftParticipantFbId;
                if (!leftID) {
                  broadcast({ type: 'log', message: `Missing leftParticipantFbId in thread ${threadID}`, userId });
                  return;
                }

                if (botState.mutedUsers && botState.mutedUsers[threadID] && botState.mutedUsers[threadID].includes(leftID)) {
                  console.log(`[MUTE] Skipping goodbye for muted user ${leftID}`);
                  return;
                }

                if (leftID === botID && event.author !== botID) {
                  stopBot(userId);
                  return;
                }

                try {
                  api.getThreadInfo(threadID, (err, info) => {
                    if (err || !info) {
                      console.error(`Error fetching thread info for ${threadID}: ${err?.message || 'Unknown error'}`);
                      sendBotMessage(api, botState.goodbyeMessages.member[Math.floor(Math.random() * botState.goodbyeMessages.member.length)].replace('{name}', 'User'), threadID, messageID);
                      return;
                    }

                    const isAdminAction = event.author && Array.isArray(info.adminIDs) && info.adminIDs.some(admin => admin.id === event.author);
                    const messagePool = isAdminAction ? botState.goodbyeMessages.admin : botState.goodbyeMessages.member;

                    api.getUserInfo(leftID, (err, ret) => {
                      if (err || !ret || !ret[leftID]) {
                        console.error(`Error fetching user info for ID ${leftID}: ${err?.message || 'Unknown error'}`);
                        sendBotMessage(api, messagePool[Math.floor(Math.random() * messagePool.length)].replace('{name}', 'User'), threadID, messageID);
                        return;
                      }

                      const name = ret[leftID].name || 'User';
                      const goodbyeMsg = messagePool[Math.floor(Math.random() * messagePool.length)].replace('{name}', name);
                      sendBotMessage(api, goodbyeMsg, threadID, messageID);
                    });

                    if (botConfig.antiOut && !isAdminAction && leftID !== botID) {
                      api.addUserToGroup(leftID, threadID, (err) => {
                        if (err) {
                          console.error(`Error adding user back to group ${threadID}: ${err.message}`);
                          sendBotMessage(api, '⚠️ यूजर को वापस जोड़ने में असफल। 🕉️', threadID, messageID);
                        } else {
                          api.getUserInfo(leftID, (err, ret) => {
                            if (err || !ret || !ret[leftID]) {
                              sendBotMessage(api, '😈 यूजर भागने की कोशिश कर रहा था, लेकिन मैंने उसे वापस खींच लिया! 😈 🕉️', threadID, messageID);
                              return;
                            }
                            const name = ret[leftID].name || 'User';
                            sendBotMessage(api, `😈 ${name} भागने की कोशिश कर रहा था, लेकिन मैंने उसे वापस खींच लिया! 😈 🕉️`, threadID, messageID);
                          });
                        }
                      });
                    }
                  });
                } catch (err) {
                  console.error(`Exception in unsubscribe handler for ID ${leftID}: ${err.message}`);
                  sendBotMessage(api, botState.goodbyeMessages.member[Math.floor(Math.random() * botState.goodbyeMessages.member.length)].replace('{name}', 'User'), threadID, messageID);
                }
              }

              if (event.logMessageType === 'log:thread-name' && botState.lockedGroups[threadID]) {
                const lockedName = botState.lockedGroups[threadID];
                api.setTitle(lockedName, threadID, (err) => {
                  if (err) {
                    console.error(`[ERROR] Failed to restore group name: ${err.message}`);
                    sendBotMessage(api, `⚠️ ग्रुप नाम रिस्टोर करने में असफल (API इश्यू)। बॉट को एडमिन परमिशन चाहिए।`, threadID);
                  } else {
                    sendBotMessage(api, `🔒 ग्रुप नाम रिस्टोर किया गया: ${lockedName} 🕉️`, threadID);
                  }
                });
              }

              if (event.logMessageType === 'log:thread-admins' && event.logMessageData?.TARGET_ID) {
                const targetID = event.logMessageData.TARGET_ID;
                if (targetID === botID && event.logMessageData.ADMIN_EVENT === 'remove_admin') {
                  sendBotMessage(api, '😡 मुझे एडमिन से हटाया गया! 🕉️', threadID, messageID);
                }
              }

              if (event.logMessageType === 'log:user-nickname') {
                console.log(`[DEBUG] Nickname change event: threadID=${threadID}, userID=${event.logMessageData.participant_id}`);
                const changedUserID = event.logMessageData.participant_id;
                if (!changedUserID || changedUserID === botID) {
                  console.log(`[DEBUG] Ignoring nickname change for botID ${botID} or invalid userID`);
                  return;
                }
                processNicknameChange(api, threadID, changedUserID, botState);
              }
            } catch (e) {
              console.error('Event processing error:', e.message);
            }
          });
        };
        listenMqtt();
      });
    } catch (err) {
      console.error(`Error in startBot for user ${userId}:`, err.message);
      botState.sessions[userId].safeMode = true;
      botState.sessions[userId].running = true;
    }
  };
  tryLogin();
}

let server;
try {
  server = app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
} catch (err) {
  console.error('Error starting Express server:', err.message);
  process.exit(1);
}

let wss;
try {
  if (server) {
    wss = new WebSocket.Server({ server });
  } else {
    console.error('Cannot initialize WebSocket server: Express server not running');
    process.exit(1);
  }
} catch (err) {
  console.error('Error initializing WebSocket server:', err.message);
  process.exit(1);
}

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
    messageStore.clearAll();
    console.log('Cleared memory caches due to high usage');
  }
}, 30000);

// Clear mafiaGames on bot shutdown
process.on('exit', () => {
  botState.mafiaGames = {};
  try {
    fs.writeFileSync(LEARNED_RESPONSES_PATH, JSON.stringify(botState, null, 2), 'utf8');
    console.log('[DEBUG] Cleared mafiaGames on exit, state saved');
  } catch (err) {
    console.error(`[ERROR] Failed to save state on exit: ${err.message}`);
  }
});

process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err.message);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

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
