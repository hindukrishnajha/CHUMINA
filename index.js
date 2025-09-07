require('dotenv').config();
const fs = require('fs');
const path = require('path');
const express = require('express');
const WebSocket = require('ws');
const axios = require('axios');
const ytdl = require('ytdl-core');
const search = require('yt-search');
const timeout = require('connect-timeout');

// fca-mafiya loading
let wiegine;
try {
  wiegine = require('fca-mafiya');
  console.log('fca-mafiya module loaded successfully');
} catch (err) {
  console.error('Error loading fca-mafiya module:', err.message);
  process.exit(1);
}

// Configurations
const botConfig = require('./config/botConfig').botConfig;
const { botState } = require('./config/botState');
const { MASTER_ID, MASTER_FB_LINK, LEARNED_RESPONSES_PATH } = require('./config/constants');

// Responses
const adminTagReplies = require('./responses/adminTagReplies');
const autoreplies = require('./responses/autoreplies');
const favoriteStickers = require('./responses/favoriteStickers');
const goodbyeMessages = require('./responses/goodbye');
const randomBotReplies = require('./responses/randomBotReplies');
const welcomeMessages = require('./responses/welcome');
const masterReplies = require('./responses/masterReplies');

// Utils
const { broadcast } = require('./utils/broadcast');
const { loadAbuseMessages, loadWelcomeMessages, saveFile } = require('./utils/fileUtils');
const { processNicknameChange } = require('./utils/nicknameUtils');

// Dynamic command loading
const commands = new Map();
const commandFolders = ['admin', 'user', 'master'];
for (const folder of commandFolders) {
  const commandFiles = fs.readdirSync(`./commands/${folder}`).filter(file => file.endsWith('.js'));
  for (const file of commandFiles) {
    try {
      const command = require(`./commands/${folder}/${file}`);
      commands.set(command.name, command);
      if (command.aliases) {
        command.aliases.forEach(alias => commands.set(alias, command));
      }
    } catch (err) {
      console.error(`Error loading command ${file} from ${folder}:`, err.message);
    }
  }
}

// botState initialize
if (!botState.sessions) botState.sessions = {};
if (!botState.nicknameTimers) botState.nicknameTimers = {};
if (!botState.nicknameQueues) botState.nicknameQueues = {};
if (!botState.stickerSpam) botState.stickerSpam = {};
if (!botState.lockedGroups) botState.lockedGroups = {};
if (!botState.abuseTargets) botState.abuseTargets = {};
if (!botState.welcomeMessages) botState.welcomeMessages = welcomeMessages;
if (!botState.memberCache) botState.memberCache = {};
if (!botState.adminList) botState.adminList = [MASTER_ID];
if (!botState.commandCooldowns) botState.commandCooldowns = {};
if (!botState.learnedResponses) botState.learnedResponses = {};

// Load learned responses (user-specific)
try {
  if (fs.existsSync(LEARNED_RESPONSES_PATH)) {
    botState.learnedResponses = JSON.parse(fs.readFileSync(LEARNED_RESPONSES_PATH, 'utf8'));
    botState.adminList = botState.learnedResponses.adminList || [MASTER_ID];
    Object.keys(botState.sessions).forEach(userId => {
      if (!botState.learnedResponses[userId]) {
        botState.learnedResponses[userId] = { triggers: [] };
      }
    });
  } else {
    botState.learnedResponses = { adminList: [MASTER_ID] };
    fs.writeFileSync(LEARNED_RESPONSES_PATH, JSON.stringify(botState.learnedResponses, null, 2));
  }
} catch (err) {
  console.error('Error loading learned_responses.json:', err.message);
}

// Express app
const app = express();
const PORT = process.env.PORT || 3000;

app.use(timeout('60s'));

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
  res.status(200).json({
    status: 'active',
    bot: 'शेलेन्द्र हिन्दू का गुलाम बोट राम इंडिया एफ',
    version: '10.0.0',
    activeSessions: Object.keys(botState.sessions).length
  });
});

app.get('/keepalive', (req, res) => {
  res.status(200).json({ status: 'alive' });
});

// Environment variables load
if (process.env.ABUSE_BASE64) {
  try {
    const abuseContent = Buffer.from(process.env.ABUSE_BASE64, 'base64').toString('utf-8');
    fs.writeFileSync('abuse.txt', abuseContent);
  } catch (err) {
    console.error('Error creating abuse file:', err.message);
  }
}

if (process.env.WELCOME_BASE64) {
  try {
    const welcomeContent = Buffer.from(process.env.WELCOME_BASE64, 'base64').toString('utf-8');
    fs.writeFileSync('welcome.txt', welcomeContent);
    botState.welcomeMessages = welcomeContent.split('\n').map(line => line.trim()).filter(line => line.length > 0);
  } catch (err) {
    console.error('Error creating welcome file:', err.message);
  }
}

// Stop bot function
function stopBot(userId) {
  if (!botState.sessions[userId]) {
    broadcast({ type: 'log', message: `No active session for user ${userId}`, userId });
    return;
  }

  botState.sessions[userId].manualStop = true;

  // Delete learned responses for this user
  if (botState.learnedResponses[userId]) {
    delete botState.learnedResponses[userId];
    try {
      fs.writeFileSync(LEARNED_RESPONSES_PATH, JSON.stringify(botState.learnedResponses, null, 2));
      console.log(`Deleted learned responses for user ${userId}`);
    } catch (err) {
      console.error(`Error saving learned_responses.json after deleting user ${userId} responses: ${err.message}`);
    }
  }

  Object.keys(botState.nicknameTimers).forEach(threadID => {
    if (botState.nicknameQueues[threadID]?.botUserId === userId) {
      clearTimeout(botState.nicknameTimers[threadID]);
      delete botState.nicknameTimers[threadID];
      delete botState.nicknameQueues[threadID];
    }
  });

  Object.keys(botState.stickerSpam).forEach(threadID => {
    if (botState.stickerSpam[threadID]) {
      botState.stickerSpam[threadID].active = false;
      delete botState.stickerSpam[threadID];
    }
  });

  Object.keys(botState.abuseTargets).forEach(threadID => {
    if (botState.abuseTargets[threadID]) {
      delete botState.abuseTargets[threadID];
    }
  });

  Object.keys(botState.memberCache).forEach(threadID => {
    if (botState.memberCache[threadID]) {
      delete botState.memberCache[threadID];
    }
  });

  if (botState.sessions[userId].api) {
    try {
      botState.sessions[userId].api.logout(() => {});
    } catch (err) {
      console.error(`Logout error for ${userId}: ${err.message}`);
    }
    botState.sessions[userId].api = null;
  }

  delete botState.sessions[userId];
  broadcast({ type: 'log', message: `Bot stopped for user ${userId}`, userId });
  broadcast({ type: 'status', userId, running: false });
}

// Start bot function
function startBot(userId, cookieContent, prefix, adminID) {
  console.log(`Starting bot for user ${userId}`);
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
    manualStop: false
  };

  if (!botState.learnedResponses[userId]) {
    botState.learnedResponses[userId] = { triggers: [] };
    fs.writeFileSync(LEARNED_RESPONSES_PATH, JSON.stringify(botState.learnedResponses, null, 2));
  }

  const tryLogin = (attempt = 1, maxAttempts = 3) => {
    if (botState.sessions[userId]?.manualStop) {
      console.log(`Manual stop detected for ${userId}, no retry`);
      return;
    }
    if (attempt > maxAttempts) {
      console.error(`Login failed for ${userId} after ${maxAttempts} attempts`);
      stopBot(userId);
      broadcast({ type: 'log', message: `Login failed after ${maxAttempts} attempts`, userId });
      return;
    }

    try {
      const cookieFile = `cookies_${userId}.txt`;
      if (!fs.existsSync(cookieFile)) {
        fs.writeFileSync(cookieFile, cookieContent);
      }

      wiegine.login(cookieContent, {}, (err, api) => {
        if (err || !api) {
          console.error(`Login failed for user ${userId} (attempt ${attempt}):`, err?.message || err);
          setTimeout(() => tryLogin(attempt + 1, maxAttempts), 5000);
          return;
        }

        botState.sessions[userId].api = api;
        botState.sessions[userId].botID = api.getCurrentUserID();
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

        const listenMqtt = (mqttAttempt = 1, maxMqttAttempts = 3) => {
          if (!botState.sessions[userId]?.running || botState.sessions[userId]?.manualStop) {
            console.log(`Session not running or manually stopped for ${userId}`);
            return;
          }

          api.listenMqtt(async (err, event) => {
            if (err) {
              console.error(`Listen error for ${userId} (attempt ${mqttAttempt}):`, err?.message || err);
              if (mqttAttempt < maxMqttAttempts && !botState.sessions[userId]?.manualStop) {
                setTimeout(() => listenMqtt(mqttAttempt + 1, maxMqttAttempts), 5000);
              } else {
                console.error(`Max MQTT attempts or manual stop for ${userId}, keeping bot running`);
                return;
              }
              return;
            }

            try {
              const isMaster = event.senderID === MASTER_ID;
              const isAdmin = botState.adminList.includes(event.senderID) || isMaster;
              const isGroup = event.threadID !== event.senderID;
              const botID = botState.sessions[userId].botID;
              const threadID = event.threadID;
              const messageID = event.messageID;

              // Debug: Log userId and session
              console.log(`Processing event for userId: ${userId}, threadID: ${threadID}, senderID: ${event.senderID}`);

              // Member caching
              if (isGroup && event.senderID && event.senderID !== botID) {
                if (!botState.memberCache[threadID]) {
                  botState.memberCache[threadID] = new Set();
                }
                botState.memberCache[threadID].add(event.senderID);
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
                const addedIDs = event.logMessageData?.addedParticipants?.map(p => p.userFbId) || [];
                if (!botState.memberCache[threadID]) {
                  botState.memberCache[threadID] = new Set();
                }
                addedIDs.forEach(id => {
                  if (id === botID) {
                    api.sendMessage(`🍒💙•••Ɓ❍ʈ Ƈøɳɳɛƈʈɛɗ•••💞🌿
🕊️🌸...Ɦɛɭɭ❍ Ɠɣus Ɱɣ ɴαɱɛ ιʂ ʂɧαʟɛɳɗɛɽ ɧιɳɗu Ɱαʂʈɛɽ'ʂ Ɓ❍ʈ...🌸🕊️
🛠️...use #help for commands...🛠️`, threadID);
                  } else {
                    botState.memberCache[threadID].add(id);
                    try {
                      api.getUserInfo(id, (err, ret) => {
                        if (err || !ret || !ret[id] || !ret[id].name) {
                          api.sendMessage({
                            body: welcomeMessages[Math.floor(Math.random() * welcomeMessages.length)].replace('{name}', 'User'),
                            mentions: id ? [{ tag: 'User', id }] : []
                          }, threadID);
                          return;
                        }
                        const name = ret[id].name || 'User';
                        const welcomeMsg = welcomeMessages[Math.floor(Math.random() * welcomeMessages.length)].replace('{name}', name);
                        api.sendMessage({
                          body: welcomeMsg,
                          mentions: [{ tag: name, id }]
                        }, threadID);
                        if (botState.nicknameQueues[threadID]?.active) {
                          processNicknameChange(api, { threadID, logMessageData: { participant_id: id } }, botState, threadID, botID);
                        }
                      });
                    } catch (err) {
                      api.sendMessage({
                        body: welcomeMessages[Math.floor(Math.random() * welcomeMessages.length)].replace('{name}', 'User'),
                        mentions: id ? [{ tag: 'User', id }] : []
                      }, threadID);
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
                    api.sendMessage("🚀 ऑटो-एक्सेप्ट किया गया मैसेज रिक्वेस्ट!", event.threadID);
                  }
                });
              }

              if (event.type === 'message') {
                const msg = event.body?.toLowerCase() || '';
                if (!msg) return;

                const lowerMsg = msg.trim().toLowerCase();
                let responseSent = false;

                // Check user-specific learned responses
                console.log(`Checking learned responses for userId: ${userId}, message: ${lowerMsg}`);
                if (botState.learnedResponses[userId]?.triggers) {
                  console.log(`Available triggers for userId ${userId}:`, botState.learnedResponses[userId].triggers);
                  for (const triggerEntry of botState.learnedResponses[userId].triggers) {
                    const triggerLower = triggerEntry.trigger.toLowerCase().trim();
                    console.log(`Comparing message "${lowerMsg}" with trigger "${triggerLower}"`);
                    if (lowerMsg === triggerLower || lowerMsg.includes(triggerLower)) {
                      const responses = triggerEntry.responses;
                      if (responses && responses.length > 0) {
                        const randomResponse = responses[Math.floor(Math.random() * responses.length)];
                        console.log(`Trigger matched: ${triggerLower}, sending response: ${randomResponse}`);
                        api.sendMessage(randomResponse, threadID, messageID);
                        responseSent = true;
                        break;
                      }
                    }
                  }
                } else {
                  console.log(`No learned responses found for userId: ${userId}`);
                }
                if (responseSent) return;

                if (isMaster && event.mentions && Object.keys(event.mentions).some(id => botState.adminList.includes(id))) {
                  const badWords = [
                    'gandu', 'chutia', 'chutiya', 'lodu', 'lavdi', 'jhatu', 'gandwa', 'gandvi', 'chinal', 'chapri',
                    'namoona', 'jokar', 'ullu', 'jhat ka baal', 'bhosdiwala', 'bsdk', 'loda lele', 'gand de',
                    'bc', 'mc', 'lode', 'lode k baal', 'abe lode', 'abe lund', 'abe chutiye', 'abe gandu',
                    'chup lodu', 'chup gandu', 'chup chutiye', 'chup chinal', 'chup lodi', 'chup jhatu',
                    'chup lvdi', 'chup lvda', 'lvda', 'lavdi'
                  ];
                  if (badWords.some(word => lowerMsg.includes(word))) {
                    const randomAdminAbuseReply = masterReplies.adminAbuseReplies.replies[Math.floor(Math.random() * masterReplies.adminAbuseReplies.replies.length)];
                    api.sendMessage(randomAdminAbuseReply, threadID, messageID);
                    return;
                  }
                }

                if (isMaster && event.mentions && Object.keys(event.mentions).some(id => botState.adminList.includes(id))) {
                  const randomAdminTagReply = masterReplies.adminTagReplies.replies[Math.floor(Math.random() * masterReplies.adminTagReplies.replies.length)];
                  api.sendMessage(randomAdminTagReply, threadID, messageID);
                  return;
                }

                if (isMaster) {
                  if (masterReplies.generalCalls.triggers.some(trigger => lowerMsg === trigger || lowerMsg.includes(trigger))) {
                    const randomReply = masterReplies.generalCalls.replies[Math.floor(Math.random() * masterReplies.generalCalls.replies.length)];
                    api.sendMessage(randomReply, threadID, messageID);
                    return;
                  }

                  if (masterReplies.morningGreetings.triggers.some(trigger => lowerMsg === trigger || lowerMsg.includes(trigger))) {
                    const randomReply = masterReplies.morningGreetings.replies[Math.floor(Math.random() * masterReplies.morningGreetings.replies.length)];
                    api.sendMessage(randomReply, threadID, messageID);
                    return;
                  }

                  if (masterReplies.ramGreetings.triggers.some(trigger => lowerMsg === trigger || lowerMsg.includes(trigger))) {
                    const randomReply = masterReplies.ramGreetings.replies[Math.floor(Math.random() * masterReplies.ramGreetings.replies.length)];
                    api.sendMessage(randomReply, threadID, messageID);
                    return;
                  }

                  if (masterReplies.pelCommands.triggers.some(trigger => lowerMsg.includes(trigger)) && event.mentions && Object.keys(event.mentions).length > 0) {
                    const targetID = Object.keys(event.mentions)[0];
                    if (botState.adminList.includes(targetID)) {
                      const randomAdminAbuseReply = masterReplies.adminAbuseReplies.replies[Math.floor(Math.random() * masterReplies.adminAbuseReplies.replies.length)];
                      api.sendMessage(randomAdminAbuseReply, threadID, messageID);
                      return;
                    }
                    if (!botState.abuseTargets[threadID]) {
                      botState.abuseTargets[threadID] = {};
                    }
                    if (!botState.abuseTargets[threadID][targetID] && abuseMessages.length > 0) {
                      botState.abuseTargets[threadID][targetID] = true;
                      try {
                        api.getUserInfo(targetID, (err, ret) => {
                          if (err || !ret || !ret[targetID] || !ret[targetID].name) {
                            api.sendMessage('⚠️ यूजर जानकारी लाने में असफल।', threadID);
                            return;
                          }
                          const name = ret[targetID].name || 'User';
                          const randomPelReply = masterReplies.pelCommands.replies[Math.floor(Math.random() * masterReplies.pelCommands.replies.length)];
                          api.sendMessage(randomPelReply, threadID, messageID);
                          const spamLoop = async () => {
                            let attempts = 0;
                            const maxAttempts = 10;
                            while (botState.abuseTargets[threadID]?.[targetID] && attempts < maxAttempts && abuseMessages.length > 0) {
                              try {
                                const randomMsg = abuseMessages[Math.floor(Math.random() * abuseMessages.length)];
                                const mentionTag = `@${name.split(' ')[0]}`;
                                await api.sendMessage({
                                  body: `${mentionTag} ${randomMsg}`,
                                  mentions: [{ tag: mentionTag, id: targetID }]
                                }, threadID);
                                attempts++;
                                await new Promise(r => setTimeout(r, 120000));
                              } catch (err) {
                                console.error('Pel command abuse loop error:', err.message);
                                break;
                              }
                            }
                            if (attempts >= maxAttempts) {
                              delete botState.abuseTargets[threadID][targetID];
                              api.sendMessage(`🎯 ${name} का टारगेट खत्म, 20 मिनट हो गए!`, threadID);
                            }
                          };
                          spamLoop();
                        });
                      } catch (err) {
                        api.sendMessage('⚠️ यूजर जानकारी लाने में असफल।', threadID);
                      }
                    }
                    return;
                  }

                  for (const question in masterReplies.questionReplies) {
                    if (lowerMsg.includes(question)) {
                      let reply = masterReplies.questionReplies[question];
                      if (Array.isArray(reply)) {
                        reply = reply[Math.floor(Math.random() * reply.length)];
                      }
                      api.sendMessage(reply, threadID, messageID);
                      return;
                    }
                  }
                }

                const replyList = autoreplies;
                for (let key in replyList) {
                  if (lowerMsg.includes(key.toLowerCase())) {
                    const responses = Array.isArray(replyList[key]) ? [replyList[key]] : [replyList[key]];
                    const randomReply = responses[Math.floor(Math.random() * responses.length)];
                    api.sendMessage(randomReply, threadID, messageID);
                    return;
                  }
                }

                const badWords = [
                  'gandu', 'chutia', 'chutiya', 'lodu', 'lavdi', 'jhatu', 'gandwa', 'gandvi', 'chinal', 'chapri',
                  'namoona', 'jokar', 'ullu', 'jhat ka baal', 'bhosdiwala', 'bsdk', 'loda lele', 'gand de',
                  'bc', 'mc', 'lode', 'lode k baal', 'abe lode', 'abe lund', 'abe chutiye', 'abe gandu',
                  'chup lodu', 'chup gandu', 'chup chutiye', 'chup chinal', 'chup lodi', 'chup jhatu',
                  'chup lvdi', 'chup lvda', 'lvda', 'lavdi'
                ];

                const isBadWithShalender = (lowerMsg.includes('@shalender') || lowerMsg.includes('shalender')) && badWords.some(word => lowerMsg.includes(word));

                const isBadWithAdminOrMaster = (event.mentions && Object.keys(event.mentions).some(id => id === MASTER_ID || botState.adminList.includes(id))) && badWords.some(word => lowerMsg.includes(word));

                if (isBadWithShalender || (isBadWithAdminOrMaster && !isMaster)) {
                  const abuserID = event.senderID;
                  if (abuserID === MASTER_ID) return;
                  if (!botState.abuseTargets[threadID]) {
                    botState.abuseTargets[threadID] = {};
                  }
                  if (!botState.abuseTargets[threadID][abuserID] && abuseMessages.length > 0) {
                    botState.abuseTargets[threadID][abuserID] = true;

                    try {
                      api.getUserInfo(abuserID, (err, ret) => {
                        if (err || !ret || !ret[abuserID] || !ret[abuserID].name) {
                          api.sendMessage('⚠️ यूजर जानकारी लाने में असफल।', threadID);
                          return;
                        }
                        const name = ret[abuserID].name || 'User';
                        
                        const targetMsg = isBadWithShalender 
                          ? `😡 ${name} तूने मालिक शेलेन्द्र को गाली दी? अब हर 2 मिनट में गालियां आएंगी!`
                          : `😡 ${name} तूने मास्टर या एडमिन को गाली दी? अब हर 2 मिनट में गालियां आएंगी!`;

                        api.sendMessage(targetMsg, threadID);

                        const spamLoop = async () => {
                          let attempts = 0;
                          const maxAttempts = 10;
                          while (botState.abuseTargets[threadID]?.[abuserID] && attempts < maxAttempts && abuseMessages.length > 0) {
                            try {
                              const randomMsg = abuseMessages[Math.floor(Math.random() * abuseMessages.length)];
                              const mentionTag = `@${name.split(' ')[0]}`;
                              await api.sendMessage({
                                body: `${mentionTag} ${randomMsg}`,
                                mentions: [{ tag: mentionTag, id: abuserID }]
                              }, threadID);
                              attempts++;
                              await new Promise(r => setTimeout(r, 120000));
                            } catch (err) {
                              console.error('Auto-target abuse loop error:', err.message);
                              break;
                            }
                          }
                          if (attempts >= maxAttempts) {
                            delete botState.abuseTargets[threadID][abuserID];
                            api.sendMessage(`🎯 ${name} का टारगेट खत्म, 20 मिनट हो गए!`, threadID);
                          }
                        };
                        spamLoop();
                      });
                    } catch (err) {
                      api.sendMessage('⚠️ यूजर जानकारी लाने में असफल।', threadID);
                    }
                  }
                  return;
                }

                if (event.mentions && Object.keys(event.mentions).includes(botState.sessions[userId].adminID)) {
                  const reply = adminTagReplies[Math.floor(Math.random() * adminTagReplies.length)];
                  const stickerID = favoriteStickers.favoriteStickers[Math.floor(Math.random() * favoriteStickers.favoriteStickers.length)];
                  api.sendMessage(reply, threadID, messageID);
                  api.sendMessage({ sticker: stickerID }, threadID);
                }

                const args = msg.split(' ').filter(arg => arg.trim() !== '');
                if (msg.startsWith(botState.sessions[userId].prefix)) {
                  const command = args[0].slice(botState.sessions[userId].prefix.length).toLowerCase();
                  if (isMaster) {
                    api.setMessageReaction('😍', messageID, (err) => {});
                  }

                  const cmd = commands.get(command);
                  if (cmd) {
                    try {
                      if (['stickerspam', 'antiout', 'groupnamelock', 'nicknamelock'].includes(cmd.name) && !isAdmin) {
                        api.sendMessage("🚫 ये कमांड सिर्फ एडमिन्स या मास्टर के लिए है!", threadID);
                      } else if (['stopall', 'status', 'removeadmin', 'masterid', 'mastercommand', 'listadmins', 'list', 'kick', 'addadmin'].includes(cmd.name) && !isMaster) {
                        api.sendMessage("🚫 ये कमांड सिर्फ मास्टर के लिए है!", threadID);
                      } else {
                        cmd.execute(api, threadID, args, event, botState, isMaster, botID, stopBot, broadcast);
                      }
                    } catch (err) {
                      api.sendMessage(`❌ कमांड चलाने में गलती: ${err.message}`, threadID);
                    }
                  } else {
                    api.sendMessage(`❌ गलत कमांड "${command}"। यूज: ${botState.sessions[userId].prefix}help`, threadID);
                  }
                  return;
                }

                if (lowerMsg === 'autoconvo on' && isAdmin) {
                  botState.autoConvo = true;
                  api.sendMessage('🔥 ऑटो कॉन्वो चालू हो गया!', threadID);
                  broadcast({
                    type: 'settings',
                    autoSpamAccept: botConfig.autoSpamAccept,
                    autoMessageAccept: botConfig.autoMessageAccept,
                    autoConvo: botState.autoConvo,
                    antiOut: botConfig.antiOut,
                    userId
                  });
                  return;
                }
                if (lowerMsg === 'autoconvo off' && isAdmin) {
                  botState.autoConvo = false;
                  api.sendMessage('✅ ऑटो कॉन्वो बंद हो गया!', threadID);
                  broadcast({
                    type: 'settings',
                    autoSpamAccept: botConfig.autoSpamAccept,
                    autoMessageAccept: botConfig.autoMessageAccept,
                    autoConvo: botState.autoConvo,
                    antiOut: botConfig.antiOut,
                    userId
                  });
                  return;
                }

                const triggerWords = ['bc', 'mc', 'bkl', 'bhenchod', 'madarchod', 'lund', 'gandu', 'chutiya', 'randi', 'motherchod', 'fuck', 'bhosda', 'kinnar', 'saali', 'lodi', 'lavdi', 'chinal', 'chinaal', 'gandwa', 'gandva', 'jhatu'];
                const isAbusive = triggerWords.some(word => lowerMsg.includes(word));
                const isMentioningBot = lowerMsg.includes('bot') || event.mentions?.[botID];

                if ((isAbusive && isMentioningBot) || (isAbusive && botState.autoConvo)) {
                  const abuserID = event.senderID;
                  if (abuserID === MASTER_ID) return;
                  if (!botState.abuseTargets[threadID]) {
                    botState.abuseTargets[threadID] = {};
                  }

                  if (!botState.abuseTargets[threadID][abuserID] && abuseMessages.length > 0) {
                    botState.abuseTargets[threadID][abuserID] = true;

                    try {
                      api.getUserInfo(abuserID, (err, ret) => {
                        if (err || !ret || !ret[abuserID] || !ret[abuserID].name) {
                          api.sendMessage('⚠️ यूजर जानकारी लाने में असफल।', threadID);
                          return;
                        }
                        const name = ret[abuserID].name || 'User';

                        api.sendMessage(`😡 ${name} तूने मुझे गाली दी? अब हर 2 मिनट में गालियां आएंगी!`, threadID);

                        const spamLoop = async () => {
                          let attempts = 0;
                          const maxAttempts = 10;
                          while (botState.abuseTargets[threadID]?.[abuserID] && attempts < maxAttempts && abuseMessages.length > 0) {
                            try {
                              const randomMsg = abuseMessages[Math.floor(Math.random() * abuseMessages.length)];
                              const mentionTag = `@${name.split(' ')[0]}`;
                              await api.sendMessage({
                                body: `${mentionTag} ${randomMsg}`,
                                mentions: [{ tag: mentionTag, id: abuserID }]
                              }, threadID);
                              attempts++;
                              await new Promise(r => setTimeout(r, 120000));
                            } catch (err) {
                              console.error('Auto-convo abuse loop error:', err.message);
                              break;
                            }
                          }
                          if (attempts >= maxAttempts) {
                            delete botState.abuseTargets[threadID][abuserID];
                            api.sendMessage(`🎯 ${name} का टारगेट खत्म, 20 मिनट हो गए!`, threadID);
                          }
                        };
                        spamLoop();
                      });
                    } catch (err) {
                      api.sendMessage('⚠️ यूजर जानकारी लाने में असफल।', threadID);
                    }
                  }
                  return;
                }

                if (botState.abuseTargets?.[threadID]?.[event.senderID]) {
                  const lower = lowerMsg;
                  if (lower.includes('sorry babu') || lower.includes('sorry mikky')) {
                    delete botState.abuseTargets[threadID][event.senderID];
                    api.sendMessage('😏 ठीक है बेटा! अब तुझे नहीं गाली देंगे।', threadID);
                    return;
                  }
                }

                if (lowerMsg.includes('bot') && isGroup) {
                  const randomResponse = randomBotReplies[Math.floor(Math.random() * randomBotReplies.length)];
                  setTimeout(() => {
                    api.sendMessage(randomResponse, threadID);
                  }, 5000);
                }
              }

              if (event.logMessageType === 'log:unsubscribe') {
                const leftID = event.logMessageData?.leftParticipantFbId;
                if (!leftID) {
                  broadcast({ type: 'log', message: `Missing leftParticipantFbId in thread ${threadID}`, userId });
                  return;
                }

                if (leftID === botID && event.author !== botID) {
                  stopBot(userId);
                  return;
                }

                try {
                  api.getThreadInfo(threadID, (err, info) => {
                    if (err || !info) {
                      api.sendMessage('⚠️ थ्रेड जानकारी लाने में असफल।', threadID);
                      return;
                    }

                    const isAdminAction = event.author && info.adminIDs?.some(admin => admin.id === event.author);
                    const messagePool = isAdminAction ? goodbyeMessages.admin : goodbyeMessages.member;

                    api.getUserInfo(leftID, (err, ret) => {
                      if (err || !ret || !ret[leftID] || !ret[leftID].name) {
                        api.sendMessage({
                          body: messagePool[Math.floor(Math.random() * messagePool.length)].replace('{name}', 'User'),
                          mentions: leftID ? [{ tag: 'User', id: leftID }] : []
                        }, threadID);
                        return;
                      }

                      const name = ret[leftID].name || 'User';
                      const goodbyeMsg = messagePool[Math.floor(Math.random() * messagePool.length)].replace('{name}', name);
                      api.sendMessage({
                        body: goodbyeMsg,
                        mentions: [{ tag: name, id: leftID }]
                      }, threadID);
                    });

                    if (botConfig.antiOut && !isAdminAction && leftID !== botID) {
                      api.addUserToGroup(leftID, threadID, (err) => {
                        if (err) {
                          api.sendMessage('⚠️ यूजर को वापस जोड़ने में असफल।', threadID);
                        } else {
                          api.getUserInfo(leftID, (err, ret) => {
                            if (err || !ret || !ret[leftID] || !ret[leftID].name) {
                              api.sendMessage({
                                body: '😈 यूजर भागने की कोशिश कर रहा था, लेकिन मैंने उसे वापस खींच लिया! 😈',
                                mentions: leftID ? [{ tag: 'User', id: leftID }] : []
                              }, threadID);
                              return;
                            }
                            const name = ret[leftID].name || 'User';
                            api.sendMessage({
                              body: `😈 ${name} भागने की कोशिश कर रहा था, लेकिन मैंने उसे वापस खींच लिया! 😈`,
                              mentions: [{ tag: name, id: leftID }]
                            }, threadID);
                          });
                        }
                      });
                    }
                  });
                } catch (err) {
                  api.sendMessage('⚠️ थ्रेड जानकारी लाने में असफल।', threadID);
                }
              }

              if (event.logMessageType === 'log:thread-name' && botState.lockedGroups[threadID]) {
                const lockedName = botState.lockedGroups[threadID];
                api.setTitle(lockedName, threadID, (err) => {
                  if (err) {
                    api.sendMessage('⚠️ ग्रुप नाम रिस्टोर करने में असफल।', threadID);
                  } else {
                    api.sendMessage(`🔒 ग्रुप नाम रिस्टोर किया गया: ${lockedName}`, threadID);
                  }
                });
              }

              if (event.logMessageType === 'log:thread-admins' && event.logMessageData?.TARGET_ID) {
                const targetID = event.logMessageData.TARGET_ID;
                if (targetID === botID && event.logMessageData.ADMIN_EVENT === 'remove_admin') {
                  api.sendMessage('😡 मुझे एडमिन से हटाया गया!', threadID);
                }
              }

              if (event.logMessageType === 'log:user-nickname') {
                try {
                  processNicknameChange(api, event, botState, threadID, botID);
                } catch (e) {
                  api.sendMessage('⚠️ निकनेम चेंज प्रोसेसिंग में गलती।', threadID);
                }
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
      botState.sessions[userId].running = false;
    }
  };
  tryLogin();
}

// Express server
let server;
try {
  server = app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
} catch (err) {
  console.error('Error starting Express server:', err.message);
  process.exit(1);
}

// WebSocket server
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

// Keep-alive
const keepAlive = setInterval(() => {
  axios.get(`https://${process.env.RENDER_SERVICE_NAME}.onrender.com/health`).catch(err => {});
}, 30000);

// Memory monitoring
setInterval(() => {
  const used = process.memoryUsage().heapUsed / 1024 / 1024;
  if (used > 300) {
    botState.memberCache = {};
    botState.abuseTargets = {};
    console.log('Cleared memory caches');
  }
}, 30000);

// Uncaught exceptions
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err.message);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

// WebSocket connection
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
      const data = JSON.parse(message.toString('utf8'));
      if (data.type === 'heartbeat') {
        ws.isAlive = true;
        return;
      }

      if (data.type === 'start') {
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
        ws.send(JSON.stringify({ type: 'status', userId, running }));
      } else if (data.type === 'uploadAbuse') {
        try {
          saveFile('abuse.txt', data.content);
          ws.send(JSON.stringify({ type: 'log', message: 'Abuse messages updated successfully' }));
        } catch (err) {
          ws.send(JSON.stringify({ type: 'log', message: `Failed to update abuse messages: ${err.message}` }));
        }
      } else if (data.type === 'saveWelcome') {
        try {
          saveFile('welcome.txt', data.content);
          botState.welcomeMessages = data.content.split('\n').map(line => line.trim()).filter(line => line.length > 0);
          ws.send(JSON.stringify({ type: 'log', message: 'Welcome messages updated successfully' }));
        } catch (err) {
          ws.send(JSON.stringify({ type: 'log', message: `Failed to update welcome messages: ${err.message}` }));
        }
      } else if (data.type === 'saveSettings') {
        botConfig.autoSpamAccept = data.autoSpamAccept;
        botConfig.autoMessageAccept = data.autoMessageAccept;
        botConfig.antiOut = data.antiOut;
        botState.autoConvo = data.autoConvo;
        ws.send(JSON.stringify({ type: 'log', message: 'Settings saved successfully' }));
        ws.send(JSON.stringify({
          type: 'settings',
          autoSpamAccept: botConfig.autoSpamAccept,
          autoMessageAccept: botConfig.autoMessageAccept,
          autoConvo: botState.autoConvo,
          antiOut: botConfig.antiOut
        }));
      }
    } catch (err) {
      ws.send(JSON.stringify({ type: 'log', message: `Error processing WebSocket message: ${err.message}` }));
    }
  });

  ws.on('close', (code, reason) => {
    clearInterval(heartbeat);
  });

  ws.send(JSON.stringify({
    type: 'settings',
    autoSpamAccept: botConfig.autoSpamAccept,
    autoMessageAccept: botConfig.autoMessageAccept,
    autoConvo: botState.autoConvo,
    antiOut: botConfig.antiOut
  }));

  const activeUsers = Object.keys(botState.sessions);
  ws.send(JSON.stringify({ type: 'activeUsers', users: activeUsers }));
});
