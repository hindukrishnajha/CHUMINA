require('dotenv').config();
const fs = require('fs');
const path = require('path');
const express = require('express');
const WebSocket = require('ws');
const axios = require('axios');
const ytdl = require('ytdl-core');
const search = require('yt-search');

// fca-mafiya लोडिंग
let wiegine;
try {
  wiegine = require('fca-mafiya');
  console.log('fca-mafiya module loaded successfully');
} catch (err) {
  console.error('Error loading fca-mafiya module:', err.message);
  process.exit(1);
}

// कॉन्फिगरेशन्स
const botConfig = require('./config/botConfig');
const { botState } = require('./config/botState');
const { MASTER_ID, MASTER_FB_LINK, LEARNED_RESPONSES_PATH } = require('./config/constants');

// रिस्पॉन्स
const adminTagReplies = require('./responses/adminTagReplies');
const autoreplies = require('./responses/autoreplies');
const favoriteStickers = require('./responses/favoriteStickers');
const goodbyeMessages = require('./responses/goodbye');
const randomBotReplies = require('./responses/randomBotReplies');
const welcomeMessages = require('./responses/welcome');

// यूटिल्स
const { broadcast } = require('./utils/broadcast');
const { loadAbuseMessages, loadWelcomeMessages, saveFile } = require('./utils/fileUtils');
const { processNicknameChange } = require('./utils/nicknameUtils');

// डायनामिक कमांड लोडिंग
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
      console.log(`कमांड लोड हुआ: ${command.name}`);
    } catch (err) {
      console.error(`Error loading command ${file} from ${folder}:`, err.message);
    }
  }
}

// botState इनिशियलाइज
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
console.log('botState initialized:', JSON.stringify(botState, null, 2));

// Express ऐप
const app = express();
const PORT = process.env.PORT || 10000;

app.get('/', (req, res) => {
  const filePath = path.join(__dirname, 'index.html');
  if (fs.existsSync(filePath)) {
    res.sendFile(filePath);
  } else {
    console.error('Error: index.html not found at:', filePath);
    res.status(404).send('Cannot GET: index.html not found.');
  }
});

app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'active',
    bot: 'शेलेन्द्र हिन्दू का गुलाम बोट राम इंडिया एफ',
    version: '10.0.0'
  });
});

app.get('/keepalive', (req, res) => {
  console.log('Keep-alive endpoint hit');
  res.status(200).json({ status: 'alive' });
});

// Environment variables लोड
if (process.env.ABUSE_BASE64) {
  try {
    const abuseContent = Buffer.from(process.env.ABUSE_BASE64, 'base64').toString('utf-8');
    fs.writeFileSync('abuse.txt', abuseContent);
    console.log('Abuse file created from environment variable');
  } catch (err) {
    console.error('Error creating abuse file:', err.message);
  }
}

if (process.env.WELCOME_BASE64) {
  try {
    const welcomeContent = Buffer.from(process.env.WELCOME_BASE64, 'base64').toString('utf-8');
    fs.writeFileSync('welcome.txt', welcomeContent);
    botState.welcomeMessages = welcomeContent.split('\n').map(line => line.trim()).filter(line => line.length > 0);
    console.log('Welcome messages loaded from environment variable');
  } catch (err) {
    console.error('Error creating welcome file:', err.message);
  }
}

// Learned responses लोड
let learnedResponses = { triggers: [], adminList: [MASTER_ID] };
try {
  if (fs.existsSync(LEARNED_RESPONSES_PATH)) {
    learnedResponses = JSON.parse(fs.readFileSync(LEARNED_RESPONSES_PATH, 'utf8'));
    botState.adminList = learnedResponses.adminList || [MASTER_ID];
  } else {
    fs.writeFileSync(LEARNED_RESPONSES_PATH, JSON.stringify({ triggers: [], adminList: [MASTER_ID] }, null, 2));
  }
} catch (err) {
  console.error('Error loading learned_responses.json:', err.message);
}

// Stop bot फंक्शन
function stopBot(userId) {
  console.log(`Attempting to stop bot for user ${userId}`);
  if (!botState.sessions[userId]) {
    console.log(`[DEBUG] No active session for user ${userId}`);
    broadcast({ type: 'log', message: `No active session for user ${userId}`, userId });
    return;
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
      clearInterval(botState.stickerSpam[threadID].interval);
      delete botState.stickerSpam[threadID];
    }
  });

  Object.keys(botState.lockedGroups).forEach(threadID => {
    if (botState.lockedGroups[threadID]) {
      delete botState.lockedGroups[threadID];
    }
  });

  if (botState.sessions[userId].api) {
    try {
      botState.sessions[userId].api.logout(() => {
        console.log(`API logged out for user ${userId}`);
      });
    } catch (err) {
      console.error(`Error during logout for user ${userId}:`, err.message);
    }
    botState.sessions[userId].api = null;
  }

  learnedResponses.triggers = [];
  fs.writeFileSync(LEARNED_RESPONSES_PATH, JSON.stringify({ triggers: [], adminList: botState.adminList }, null, 2));

  delete botState.sessions[userId];
  console.log(`Session stopped for user ${userId}`);
  broadcast({ type: 'log', message: `Bot stopped for user ${userId}`, userId });
  broadcast({ type: 'status', userId, running: false, message: `Bot stopped for user ${userId}` });
}

// Start bot फंक्शन
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
    botConfig: { autoSpamAccept: false, autoMessageAccept: false }
  };

  const tryLogin = (attempt = 1, maxAttempts = 5) => {
    try {
      const cookieFile = `cookies_${userId}.txt`;
      fs.writeFileSync(cookieFile, cookieContent);
      console.log(`Cookie file saved for user ${userId}`);
      wiegine.login(cookieContent, {}, (err, api) => {
        if (err || !api) {
          console.error(`Login failed for user ${userId} (attempt ${attempt}):`, err?.message || err);
          if (attempt < maxAttempts) {
            setTimeout(() => tryLogin(attempt + 1, maxAttempts), 10000 * attempt);
          } else {
            console.error(`Max login attempts reached for user ${userId}`);
            botState.sessions[userId].running = false;
            delete botState.sessions[userId];
          }
          return;
        }

        botState.sessions[userId].api = api;
        console.log(`Bot logged in for user ${userId}`);
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

        const listenMqtt = (mqttAttempt = 1, maxMqttAttempts = 15) => {
          if (!botState.sessions[userId]?.running) {
            console.log(`[DEBUG] Session not running for user ${userId}`);
            return;
          }
          api.listenMqtt(async (err, event) => {
            if (err) {
              console.error(`Listen error for user ${userId} (attempt ${mqttAttempt}):`, err?.message || err);
              if (botState.sessions[userId]?.running && mqttAttempt < maxMqttAttempts) {
                setTimeout(() => listenMqtt(mqttAttempt + 1, maxMqttAttempts), 10000 * mqttAttempt);
              } else {
                console.error(`Max MQTT reconnection attempts reached for user ${userId}`);
                startBot(userId, cookieContent, prefix, adminID);
              }
              return;
            }

            try {
              const isMaster = event.senderID === MASTER_ID;
              const isAdmin = botState.adminList.includes(event.senderID) || isMaster;
              const isGroup = event.threadID !== event.senderID;
              const botID = api.getCurrentUserID();
              const threadID = event.threadID;
              const messageID = event.messageID;

              // मेंबर कैशिंग
              if (isGroup && event.senderID && event.senderID !== botID) {
                if (!botState.memberCache[threadID]) {
                  botState.memberCache[threadID] = new Set();
                }
                botState.memberCache[threadID].add(event.senderID);
                console.log(`[DEBUG] Cached member ${event.senderID} for thread ${threadID}`);
              }

              if (event.mentions && typeof event.mentions === 'object' && Object.keys(event.mentions).length > 0) {
                if (!botState.memberCache[threadID]) {
                  botState.memberCache[threadID] = new Set();
                }
                Object.keys(event.mentions).forEach(id => {
                  if (id !== botID) {
                    botState.memberCache[threadID].add(id);
                    console.log(`[DEBUG] Cached mentioned member ${id} for thread ${threadID}`);
                  }
                });
              }

              if (event.logMessageType === 'log:subscribe') {
                const addedIDs = event.logMessageData.addedParticipants?.map(p => p.userFbId) || [];
                if (!botState.memberCache[threadID]) {
                  botState.memberCache[threadID] = new Set();
                }
                addedIDs.forEach(id => {
                  if (id !== botID) {
                    botState.memberCache[threadID].add(id);
                    console.log(`[DEBUG] Cached new member ${id} for thread ${threadID}`);
                    // नए मेंबर के लिए निकनेम लॉक
                    if (botState.nicknameQueues[threadID]?.active) {
                      api.changeNickname(botState.nicknameQueues[threadID].nickname, threadID, id, (err) => {
                        if (!err) {
                          console.log(`[DEBUG] Set nickname for new member ${id} to "${botState.nicknameQueues[threadID].nickname}"`);
                        }
                      });
                    }
                  }
                });
              }

              console.log(`[DEBUG] Processing event: ${event.type}, command: ${event.body}, threadID: ${threadID}, senderID: ${event.senderID}`);

              if (isMaster && event.type === 'message') {
                api.setMessageReaction('😍', messageID, (err) => {
                  if (err) console.error('Error setting love reaction:', err.message);
                });
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
                for (const { trigger, response } of learnedResponses.triggers) {
                  if (lowerMsg.includes(trigger.toLowerCase().trim())) {
                    api.sendMessage(response, threadID, messageID);
                    responseSent = true;
                  }
                }
                if (responseSent) return;

                const replyList = autoreplies;
                for (let key in replyList) {
                  if (lowerMsg.includes(key.toLowerCase())) {
                    api.sendMessage(replyList[key], threadID, messageID);
                    return;
                  }
                }

                const badWords = ['randi', 'chutia', 'gandu', 'kinnar', 'saali', 'lodi', 'lavdi', 'chinal', 'chinaal', 'gandwa', 'gandva', 'jhatu'];
                const isBadWithShalender = (lowerMsg.includes('@shalender') || lowerMsg.includes('shalender')) && badWords.some(word => lowerMsg.includes(word));

                if (isBadWithShalender) {
                  const abuserID = event.senderID;
                  if (abuserID === MASTER_ID) return;
                  if (!botState.abuseTargets[threadID]) {
                    botState.abuseTargets[threadID] = {};
                  }
                  if (!botState.abuseTargets[threadID][abuserID] && abuseMessages.length > 0) {
                    botState.abuseTargets[threadID][abuserID] = true;

                    api.getUserInfo(abuserID, (err, ret) => {
                      if (err || !ret || !ret[abuserID]) {
                        console.error('UserInfo error for auto-target:', err?.message);
                        api.sendMessage('⚠️ यूजर जानकारी लाने में असफल।', threadID);
                        return;
                      }
                      const name = ret[abuserID]?.name || 'User';

                      api.sendMessage(`😡 ${name} तूने मालिक शेलेन्द्र को गाली दी? अब हर 2 मिनट में गालियां आएंगी!`, threadID);

                      const spamLoop = async () => {
                        while (botState.abuseTargets[threadID]?.[abuserID] && abuseMessages.length > 0) {
                          try {
                            const randomMsg = abuseMessages[Math.floor(Math.random() * abuseMessages.length)];
                            const mentionTag = `@${name.split(' ')[0]}`;
                            await api.sendMessage({
                              body: `${mentionTag} ${randomMsg}`,
                              mentions: [{ tag: mentionTag, id: abuserID }]
                            }, threadID);
                            await new Promise(r => setTimeout(r, 120000));
                          } catch (err) {
                            console.error('Auto-target abuse loop error:', err.message);
                            api.sendMessage('⚠️ ऑटो-टारगेट गाली में गलती।', threadID);
                            await new Promise(r => setTimeout(r, 120000));
                          }
                        }
                      };
                      spamLoop();
                    });
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
                  console.log(`[DEBUG] Parsed command: ${command}, args: ${JSON.stringify(args)}`);

                  if (isMaster) {
                    api.sendMessage('मास्टर, आपकी आज्ञा मेरे लिए सर्वोपरि है 🙏', threadID, messageID);
                  }

                  const cmd = commands.get(command);
                  if (cmd) {
                    try {
                      if (['groupnamelock', 'nicknamelock'].includes(cmd.name) && !isAdmin) {
                        api.sendMessage("🚫 ये कमांड सिर्फ एडमिन्स या मास्टर के लिए है!", threadID);
                      } else {
                        cmd.execute(api, threadID, args, event, botState, isMaster);
                      }
                    } catch (err) {
                      console.error(`Error executing command ${command}:`, err.message);
                      api.sendMessage(`❌ कमांड चलाने में गलती: ${err.message}`, threadID);
                    }
                  } else {
                    api.sendMessage(`❌ गलत कमांड "${command}"। यूज: ${botState.sessions[userId].prefix}help`, threadID);
                    console.log(`[DEBUG] Invalid command "${command}" received in thread ${threadID}`);
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

                    api.getUserInfo(abuserID, (err, ret) => {
                      if (err || !ret || !ret[abuserID]) {
                        console.error('UserInfo error for auto-convo:', err?.message);
                        api.sendMessage('⚠️ यूजर जानकारी लाने में असफल।', threadID);
                        return;
                      }
                      const name = ret[abuserID]?.name || 'User';

                      api.sendMessage(`😡 ${name} तूने मुझे गाली दी? अब हर 2 मिनट में गालियां आएंगी!`, threadID);

                      const spamLoop = async () => {
                        while (botState.abuseTargets[threadID]?.[abuserID] && abuseMessages.length > 0) {
                          try {
                            const randomMsg = abuseMessages[Math.floor(Math.random() * abuseMessages.length)];
                            const mentionTag = `@${name.split(' ')[0]}`;
                            await api.sendMessage({
                              body: `${mentionTag} ${randomMsg}`,
                              mentions: [{ tag: mentionTag, id: abuserID }]
                            }, threadID);
                            await new Promise(r => setTimeout(r, 120000));
                          } catch (err) {
                            console.error('Auto-convo abuse loop error:', err.message);
                            api.sendMessage('⚠️ ऑटो-कॉन्वो गाली में गलती।', threadID);
                            await new Promise(r => setTimeout(r, 120000));
                          }
                        }
                      };
                      spamLoop();
                    });
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

              if (event.logMessageType === 'log:subscribe') {
                const addedIDs = event.logMessageData.addedParticipants?.map(p => p.userFbId) || [];
                addedIDs.forEach(id => {
                  if (id === botID) {
                    api.sendMessage(`🍒💙•••Ɓ❍ʈ Ƈøɳɳɛƈʈɛɗ•••💞🌿
🕊️🌸...Ɦɛɭɭ❍ Ɠɣus Ɱɣ ɴαɱɛ ιʂ ʂɧαʟɛɳɗɛɽ ɧιɳɗu Ɱαʂʈɛɽ'ʂ Ɓ❍ʈ...🌸🕊️
🛠️...use #help for commands...🛠️`, threadID);
                  } else {
                    botState.memberCache[threadID].add(id);
                    console.log(`[DEBUG] Cached new member ${id} for thread ${threadID}`);
                    api.getUserInfo(id, (err, ret) => {
                      if (err || !ret?.[id]) return;
                      const name = ret[id].name || 'User';
                      const welcomeMsg = welcomeMessages[Math.floor(Math.random() * welcomeMessages.length)].replace('{name}', name);
                      api.sendMessage({
                        body: welcomeMsg,
                        mentions: [{ tag: name, id }]
                      }, threadID);
                    });
                    // नए मेंबर के लिए निकनेम लॉक
                    if (botState.nicknameQueues[threadID]?.active) {
                      api.changeNickname(botState.nicknameQueues[threadID].nickname, threadID, id, (err) => {
                        if (!err) {
                          console.log(`[DEBUG] Set nickname for new member ${id} to "${botState.nicknameQueues[threadID].nickname}"`);
                        }
                      });
                    }
                  }
                });
              }

              if (event.logMessageType === 'log:unsubscribe') {
                const leftID = event.logMessageData.leftParticipantFbId;
                if (leftID === botID && event.author !== botID) {
                  console.log(`[DEBUG] Bot ${userId} removed from group`);
                  stopBot(userId);
                  return;
                }

                api.getThreadInfo(threadID, (err, info) => {
                  if (err || !info) return;
                  const isAdminAction = info.adminIDs?.some(admin => admin.id === event.author);
                  const messagePool = isAdminAction ? goodbyeMessages.admin : goodbyeMessages.member;

                  api.getUserInfo(leftID, (err, ret) => {
                    if (err || !ret?.[leftID]) return;
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
                        console.error('Anti-out error:', err.message);
                        api.sendMessage('⚠️ यूजर को वापस जोड़ने में असफल।', threadID);
                      } else {
                        api.getUserInfo(leftID, (err, ret) => {
                          if (err || !ret) return;
                          const name = ret[leftID]?.name || 'User';
                          api.sendMessage({
                            body: `😈 ${name} भागने की कोशिश कर रहा था, लेकिन मैंने उसे वापस खींच लिया! 😈`,
                            mentions: [{ tag: name, id: leftID }]
                          }, threadID);
                        });
                      }
                    });
                  }
                });
              }

              if (event.logMessageType === 'log:thread-name' && botState.lockedGroups[threadID]) {
                const lockedName = botState.lockedGroups[threadID];
                api.setTitle(lockedName, threadID, (err) => {
                  if (err) {
                    console.error('Group name lock error:', err.message);
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
                processNicknameChange(api, event, botState, threadID, botID);
              }
            } catch (e) {
              console.error('Event processing error:', e.message);
              broadcast({ type: 'error', message: `Event error for user ${userId}: ${e.message}`, userId });
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

// Express सर्वर
let server;
try {
  server = app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
} catch (err) {
  console.error('Error starting Express server:', err.message);
  process.exit(1);
}

// WebSocket सर्वर
let wss;
try {
  wss = new WebSocket.Server({ server });
  console.log('WebSocket server initialized');
} catch (err) {
  console.error('Error initializing WebSocket server:', err.message);
  process.exit(1);
}

// Keep-alive
const keepAlive = setInterval(() => {
  console.log('Keep-alive ping sent');
  axios.get(`http://localhost:${PORT}/keepalive`).catch(err => {
    console.error('Keep-alive ping error:', err.message);
  });
}, 5 * 60 * 1000);

// Uncaught exceptions
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err.message, err.stack);
  broadcast({ type: 'log', message: `Uncaught Exception: ${err.message}`, userId: 'system' });
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  broadcast({ type: 'log', message: `Unhandled Rejection: ${reason}`, userId: 'system' });
});

// WebSocket कनेक्शन
wss.on('connection', (ws) => {
  console.log('WebSocket client connected');
  ws.isAlive = true;

  const heartbeat = setInterval(() => {
    if (ws.isAlive === false) {
      clearInterval(heartbeat);
      return ws.terminate();
    }
    ws.isAlive = false;
    ws.send(JSON.stringify({ type: 'heartbeat' }));
  }, 30000);

  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message.toString('utf8'));
      if (data.type === 'heartbeat') {
        ws.isAlive = true;
        return;
      }
      console.log('WebSocket message received:', data);

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
        botState.autoConvo = data.autoConvo;
        ws.send(JSON.stringify({ type: 'log', message: 'Settings saved successfully' }));
        ws.send(JSON.stringify({
          type: 'settings',
          autoSpamAccept: botConfig.autoSpamAccept,
          autoMessageAccept: botConfig.autoMessageAccept,
          autoConvo: botState.autoConvo
        }));
      }
    } catch (err) {
      console.error('WebSocket message error:', err.message);
      ws.send(JSON.stringify({ type: 'log', message: `Error processing WebSocket message: ${err.message}` }));
    }
  });

  ws.on('close', (code, reason) => {
    clearInterval(heartbeat);
    console.log(`WebSocket client disconnected with code ${code}, reason: ${reason || 'Unknown'}`);
  });

  ws.send(JSON.stringify({
    type: 'settings',
    autoSpamAccept: botConfig.autoSpamAccept,
    autoMessageAccept: botConfig.autoMessageAccept,
    autoConvo: botState.autoConvo
  }));

  const activeUsers = Object.keys(botState.sessions);
  ws.send(JSON.stringify({ type: 'activeUsers', users: activeUsers }));
});
