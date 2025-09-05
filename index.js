require('dotenv').config();
const fs = require('fs');
const path = require('path');
const express = require('express');
const WebSocket = require('ws');
const axios = require('axios');
const ytdl = require('ytdl-core');
const search = require('yt-search');

// Try to require fca-mafiya with error handling
let wiegine;
try {
    wiegine = require('fca-mafiya');
    console.log('fca-mafiya module loaded successfully');
} catch (err) {
    console.error('Error loading fca-mafiya module:', err.message);
    process.exit(1);
}

// Import configurations
const botConfig = require('./config/botConfig');
const { botState } = require('./config/botState');
const { MASTER_ID, MASTER_FB_LINK, LEARNED_RESPONSES_PATH } = require('./config/constants');

// Import responses
const adminTagReplies = require('./responses/adminTagReplies');
const autoreplies = require('./responses/autoreplies');
const favoriteStickers = require('./responses/favoriteStickers');
const goodbyeMessages = require('./responses/goodbye');
const randomBotReplies = require('./responses/randomBotReplies');
const welcomeMessages = require('./responses/welcome');

// Import commands
const { handleHelp } = require('./commands/help');
const { handleAddAdmin } = require('./commands/master/addadmin');
const { handleKick } = require('./commands/master/kick');
const { handleList } = require('./commands/master/list');
const { handleListAdmins } = require('./commands/master/listadmins');
const { handleMasterCommand } = require('./commands/master/mastercommand');
const { handleMasterId } = require('./commands/master/masterid');
const { handleRemoveAdmin } = require('./commands/master/removeadmin');
const { handleStatus } = require('./commands/master/status');
const { handleStopAll } = require('./commands/master/stopall');
const { handleAntiOut } = require('./commands/admin/antiout');
const { handleAutoMessage } = require('./commands/admin/automessage');
const { handleAutoSpam } = require('./commands/admin/autospam');
const { handleGroupNameLock } = require('./commands/admin/groupnamelock');
const { handleKickOut } = require('./commands/admin/kickout');
const { handleLoder } = require('./commands/admin/loder');
const { handleNicknameLock } = require('./commands/admin/nicknamelock');
const { stickerspam } = require('./commands/admin/stickerspam');
const { handleUnsend } = require('./commands/admin/unsend');
const { handleGroupInfo } = require('./commands/user/groupinfo');
const { handleInfo } = require('./commands/user/info');
const { handleLearn } = require('./commands/user/learn');
const { handleMusic } = require('./commands/user/music');
const { handlePair } = require('./commands/user/pair');
const { handleTid } = require('./commands/user/tid');
const { handleUid } = require('./commands/user/uid');

// Import utilities
const { broadcast } = require('./utils/broadcast');
const { loadAbuseMessages, loadWelcomeMessages, saveFile } = require('./utils/fileUtils');
const { processNicknameChange } = require('./utils/nicknameUtils');

// Initialize botState
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

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 10000;

// Serve index.html
app.get('/', (req, res) => {
    const filePath = path.join(__dirname, 'index.html');
    if (fs.existsSync(filePath)) {
        res.sendFile(filePath);
    } else {
        console.error('Error: index.html not found at:', filePath);
        res.status(404).send('Cannot GET: index.html not found.');
    }
});

// Health Check Endpoint
app.get('/health', (req, res) => {
    res.status(200).json({
        status: 'active',
        bot: 'शेलेन्द्र हिन्दू का गुलाम बोट राम इंडिया एफ',
        version: '10.0.0'
    });
});

// Keep-alive endpoint
app.get('/keepalive', (req, res) => {
    res.status(200).json({ status: 'alive' });
});

// Load default abuse.txt
if (process.env.ABUSE_BASE64) {
    const abuseContent = Buffer.from(process.env.ABUSE_BASE64, 'base64').toString('utf-8');
    if (!fs.existsSync('abuse.txt')) {
        fs.writeFileSync('abuse.txt', abuseContent);
        console.log('Default abuse file created from environment variable');
    }
}

// Load welcome messages
if (process.env.WELCOME_BASE64) {
    const welcomeContent = Buffer.from(process.env.WELCOME_BASE64, 'base64').toString('utf-8');
    fs.writeFileSync('welcome.txt', welcomeContent);
    botState.welcomeMessages = welcomeContent.split('\n').map(line => line.trim()).filter(line => line.length > 0);
}

// Load learned responses
let learnedResponses = { triggers: [], adminList: [MASTER_ID] };
if (fs.existsSync(LEARNED_RESPONSES_PATH)) {
    learnedResponses = JSON.parse(fs.readFileSync(LEARNED_RESPONSES_PATH, 'utf8'));
    botState.adminList = learnedResponses.adminList || [MASTER_ID];
} else {
    fs.writeFileSync(LEARNED_RESPONSES_PATH, JSON.stringify({ triggers: [], adminList: [MASTER_ID] }, null, 2));
}

// Cooldown function
function checkCooldown(threadID, command, cooldownMs = 5000) {
    const now = Date.now();
    if (!botState.commandCooldowns[threadID]) botState.commandCooldowns[threadID] = {};
    if (botState.commandCooldowns[threadID][command] && now < botState.commandCooldowns[threadID][command]) {
        return false;
    }
    botState.commandCooldowns[threadID][command] = now + cooldownMs;
    return true;
}

// Stop bot function
function stopBot(userId) {
    if (!botState.sessions[userId]) {
        broadcast({ type: 'log', message: `No active session for user ${userId}`, userId });
        broadcast({ type: 'status', userId, running: false, message: `Bot is not running for user ${userId}` });
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

    const userAbuseFile = `abuse_${userId}.txt`;
    if (fs.existsSync(userAbuseFile)) {
        fs.unlinkSync(userAbuseFile);
        broadcast({ type: 'log', message: `User-specific abuse file deleted for user ${userId}`, userId });
    }

    if (botState.sessions[userId].api) {
        botState.sessions[userId].api.logout();
    }

    learnedResponses.triggers = [];
    fs.writeFileSync(LEARNED_RESPONSES_PATH, JSON.stringify({ triggers: [], adminList: botState.adminList }, null, 2));

    delete botState.sessions[userId];
    broadcast({ type: 'log', message: `Bot stopped for user ${userId}`, userId });
    broadcast({ type: 'status', userId, running: false, message: `Bot stopped for user ${userId}` });
}

// Start bot function
function startBot(userId, cookieContent, prefix, adminID) {
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
        const cookieFile = `cookies_${userId}.txt`;
        fs.writeFileSync(cookieFile, cookieContent);
        broadcast({ type: 'log', message: `Cookie file saved for user ${userId}`, userId });

        wiegine.login(cookieContent, {}, (err, api) => {
            if (err || !api) {
                const errorMessage = `Login failed for user ${userId}: ${err?.message || 'Invalid cookies'}`;
                broadcast({ type: 'error', message: errorMessage, userId });
                if (attempt < maxAttempts) {
                    broadcast({ type: 'log', message: `Retrying login for user ${userId} in ${10 * attempt} seconds (attempt ${attempt + 1})`, userId });
                    setTimeout(() => tryLogin(attempt + 1, maxAttempts), 10000 * attempt);
                } else {
                    broadcast({ type: 'error', message: `Max login attempts reached for user ${userId}.`, userId });
                    broadcast({ type: 'status', userId, running: false, message: `Max login attempts reached for user ${userId}. Bot failed to start.` });
                    delete botState.sessions[userId];
                }
                return;
            }

            botState.sessions[userId].api = api;
            broadcast({ type: 'log', message: `Bot logged in and running for user ${userId}`, userId });
            broadcast({ type: 'status', userId, running: true, message: `Bot started successfully for user ${userId}` });

            api.setOptions({ listenEvents: true, autoMarkRead: true });

            let abuseMessages = fs.existsSync(`abuse_${userId}.txt`) ? loadAbuseMessages(`abuse_${userId}.txt`) : loadAbuseMessages();
            broadcast({ type: 'log', message: `Abuse messages loaded for user ${userId}: ${abuseMessages.length} messages`, userId });

            try {
                botState.welcomeMessages = loadWelcomeMessages();
            } catch (err) {
                saveFile('welcome.txt', botState.welcomeMessages.join('\n'));
            }

            const listenMqtt = (mqttAttempt = 1, maxMqttAttempts = 15) => {
                if (!botState.sessions[userId]?.running) {
                    broadcast({ type: 'log', message: `Session not running for user ${userId}, stopping MQTT listen`, userId });
                    return;
                }

                api.listenMqtt(async (err, event) => {
                    if (err) {
                        broadcast({ type: 'error', message: `Listen error for user ${userId}: ${err?.message || 'Unknown error'}`, userId });
                        if (botState.sessions[userId]?.running && mqttAttempt < maxMqttAttempts) {
                            broadcast({ type: 'log', message: `Reconnecting MQTT for user ${userId} in ${10 * mqttAttempt} seconds (attempt ${mqttAttempt + 1})`, userId });
                            setTimeout(() => listenMqtt(mqttAttempt + 1, maxMqttAttempts), 10000 * mqttAttempt);
                        } else {
                            broadcast({ type: 'error', message: `Max MQTT reconnection attempts reached for user ${userId}.`, userId });
                            broadcast({ type: 'status', userId, running: false, message: `Max MQTT reconnection attempts reached. Bot stopped.` });
                            startBot(userId, cookieContent, prefix, adminID);
                        }
                        return;
                    }

                    if (['presence', 'read_receipt', 'message_reaction'].includes(event.type)) return;

                    const isMaster = event.senderID === MASTER_ID;
                    const isAdmin = botState.adminList.includes(event.senderID) || isMaster;
                    const isGroup = event.threadID !== event.senderID;
                    const botID = api.getCurrentUserID();
                    const threadID = event.threadID;
                    const messageID = event.messageID;

                    // Cache members
                    if (isGroup && event.senderID && event.senderID !== botID) {
                        if (!botState.memberCache[threadID]) botState.memberCache[threadID] = new Set();
                        botState.memberCache[threadID].add(event.senderID);
                    }

                    if (event.mentions && Object.keys(event.mentions).length > 0) {
                        if (!botState.memberCache[threadID]) botState.memberCache[threadID] = new Set();
                        Object.keys(event.mentions).forEach(id => {
                            if (id !== botID) botState.memberCache[threadID].add(id);
                        });
                    }

                    if (event.logMessageType === 'log:subscribe') {
                        const addedIDs = event.logMessageData.addedParticipants?.map(p => p.userFbId) || [];
                        if (!botState.memberCache[threadID]) botState.memberCache[threadID] = new Set();
                        addedIDs.forEach(id => {
                            if (id !== botID) botState.memberCache[threadID].add(id);
                        });
                    }

                    if (isMaster && event.type === 'message') {
                        api.setMessageReaction('😍', messageID);
                    }

                    if (botConfig.autoSpamAccept && event.type === 'message_request') {
                        api.handleMessageRequest(event.threadID, true, (err) => {
                            if (!err) api.sendMessage("🚀 ऑटो-एक्सेप्ट किया गया मैसेज रिक्वेस्ट!", event.threadID);
                        });
                    }

                    if (event.type === 'message') {
                        const msg = event.body?.toLowerCase() || '';
                        if (!msg) return;

                        const args = msg.split(' ').filter(arg => arg.trim() !== '');
                        if (msg.startsWith(botState.sessions[userId].prefix)) {
                            const command = args[0].slice(botState.sessions[userId].prefix.length).toLowerCase();

                            if (!checkCooldown(threadID, command)) {
                                api.sendMessage(`⏳ कृपया ${command} कमांड के लिए 5 सेकंड रुकें।`, threadID);
                                return;
                            }

                            const commandHandlers = {
                                // Master commands
                                mastercommand: () => handleMasterCommand(api, threadID, args, event, botState, isMaster),
                                stopall: () => handleStopAll(api, threadID, args, event, botState, isMaster, stopBot),
                                status: () => handleStatus(api, threadID, args, event, botState, isMaster),
                                kick: () => handleKick(api, threadID, args, event, botState, isMaster, stopBot),
                                list: () => handleList(api, threadID, args, event, botState, isMaster),
                                addadmin: () => handleAddAdmin(api, threadID, args, event, botState, isMaster, learnedResponses, LEARNED_RESPONSES_PATH),
                                removeadmin: () => handleRemoveAdmin(api, threadID, args, event, botState, isMaster, learnedResponses, LEARNED_RESPONSES_PATH, MASTER_ID),
                                listadmins: () => handleListAdmins(api, threadID, args, event, botState, isMaster),
                                // General commands
                                help: () => handleHelp(api, threadID, args, event, botState, isMaster, botState.sessions[userId].prefix),
                                masterid: () => handleMasterId(api, threadID, args, event, botState, isMaster, MASTER_FB_LINK),
                                learn: () => handleLearn(api, threadID, args, event, botState, isMaster, msg, learnedResponses, LEARNED_RESPONSES_PATH),
                                // Admin commands
                                groupnamelock: () => isAdmin && handleGroupNameLock(api, threadID, args, event, botState, isMaster),
                                nicknamelock: () => isAdmin && handleNicknameLock(api, threadID, args, event, botState, isMaster),
                                tid: () => isAdmin && handleTid(api, threadID, args, event, botState, isMaster),
                                uid: () => isAdmin && handleUid(api, threadID, args, event, botState, isMaster),
                                group: () => isAdmin && args[1] === 'info' && handleGroupInfo(api, threadID, args, event, botState, isMaster),
                                info: () => isAdmin && handleInfo(api, threadID, args, event, botState, isMaster),
                                pair: () => isAdmin && handlePair(api, threadID, args, event, botState, isMaster, botID, axios),
                                music: () => isAdmin && handleMusic(api, threadID, args, event, botState, isMaster, search, ytdl),
                                antiout: () => isAdmin && handleAntiOut(api, threadID, args, event, botState, isMaster, botConfig),
                                send: () => isAdmin && args[1] && args[1].toLowerCase() === 'sticker' && stickerspam(api, threadID, args, event, botState, isMaster),
                                autospam: () => isAdmin && args[1] === 'accept' && handleAutoSpam(api, threadID, args, event, botState, isMaster),
                                automessage: () => isAdmin && args[1] === 'accept' && handleAutoMessage(api, threadID, args, event, botState, isMaster),
                                loder: () => isAdmin && handleLoder(api, threadID, args, event, botState, isMaster, abuseMessages, MASTER_ID),
                                kickout: () => isAdmin && handleKickOut(api, threadID, args, event, botState, isMaster, MASTER_ID),
                                unsend: () => isAdmin && event.messageReply && handleUnsend(api, threadID, args, event, botState, isMaster)
                            };

                            if (commandHandlers[command]) {
                                commandHandlers[command]();
                            } else {
                                api.sendMessage(`❌ गलत कमांड "${command}"। उपलब्ध कमांड्स की लिस्ट के लिए ${botState.sessions[userId].prefix}help यूज़ करें।`, threadID);
                            }
                            return;
                        }

                        // Auto-convo and abuse handling
                        const triggerWords = ['bc', 'mc', 'bkl', 'bhenchod', 'madarchod', 'lund', 'gandu', 'chutiya', 'randi', 'motherchod', 'fuck', 'bhosda', 'kinnar', 'saali', 'lodi', 'lavdi', 'chinal', 'chinaal', 'gandwa', 'gandva', 'jhatu'];
                        const isAbusive = triggerWords.some(word => msg.includes(word));
                        const isMentioningBot = msg.includes('bot') || event.mentions?.[botID];

                        if ((isAbusive && isMentioningBot) || (isAbusive && botState.autoConvo)) {
                            const abuserID = event.senderID;
                            if (abuserID === MASTER_ID) return;
                            if (!botState.abuseTargets[threadID]) botState.abuseTargets[threadID] = {};

                            if (!botState.abuseTargets[threadID][abuserID] && abuseMessages.length > 0) {
                                botState.abuseTargets[threadID][abuserID] = true;
                                api.getUserInfo(abuserID, (err, ret) => {
                                    if (err || !ret || !ret[abuserID]) {
                                        api.sendMessage('⚠️ यूज़र जानकारी लाने में असफल।', threadID);
                                        return;
                                    }
                                    const name = ret[abuserID]?.name || 'User';
                                    api.sendMessage(`😡 ${name} तूने मुझे गाली दी? अब हर 2 मिनट में गालियां आएंगी!`, threadID);

                                    const spamLoop = async () => {
                                        while (botState.abuseTargets[threadID]?.[abuserID] && abuseMessages.length > 0) {
                                            const randomMsg = abuseMessages[Math.floor(Math.random() * abuseMessages.length)];
                                            const mentionTag = `@${name.split(' ')[0]}`;
                                            await api.sendMessage({
                                                body: `${mentionTag} ${randomMsg}`,
                                                mentions: [{ tag: mentionTag, id: abuserID }]
                                            }, threadID);
                                            await new Promise(r => setTimeout(r, 120000));
                                        }
                                    };
                                    spamLoop();
                                });
                            }
                            return;
                        }

                        if (botState.abuseTargets?.[threadID]?.[event.senderID]) {
                            if (msg.includes('sorry babu') || msg.includes('sorry mikky')) {
                                delete botState.abuseTargets[threadID][event.senderID];
                                api.sendMessage('😏 ठीक है बेटा! अब तुझे नहीं गाली देंगे. बच गया तू...', threadID);
                                return;
                            }
                        }

                        if (msg.includes('bot') && isGroup) {
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
🎉...Ƭɧɛ Ɓɛʂʈ Ƒɛαʈuɽɛʂ Ɠɽøuρ ɱαɳαɠɛɱɛɳʈ...🎉
🔐...Ɠɽøuρ ɴαɱɛ ʟøcк...🔐
🔐...Ɲιcкɴαɱɛ ʟøcк...🔐
🎯...Ƭαɽɠɛʈ ƛɓuʂɛ...🎯
🎵...Ƴøuʈuɓɛ ɱuʂιc...🎵
💑...Ƥαιɽ ɱɛɱɓɛɽʂ...💑
😈...ƛuʈø cøɳʋø...😈
📢...ƛɳʈιøuʈ...📢
✨...ƛuʈø ʂραɱ...✨
✨...ƛuʈø ɱɛʂʂαɠɛ...✨
🔥...Ƨʈιcкɛɽ ʂραɱ...🔥
🔥...Ƙιcкøuʈ...🔥
🔥...Ʋɳʂɛɳɗ...🔥
🛠️...use #help for commands...🛠️
━━━━━━━━━━━━━━━━━━━━
👑 𝗖𝗿𝗲𝗮𝘁𝗲𝗱 𝗕𝘆: ✶♡⤾➝SHALENDER X..⤹✶➺🪿🫨🩷🪽`, threadID);
                            } else {
                                api.getUserInfo(id, (err, ret) => {
                                    if (err || !ret?.[id]) return;
                                    const name = ret[id].name || 'User';
                                    const welcomeMsg = botState.welcomeMessages[Math.floor(Math.random() * botState.welcomeMessages.length)]
                                        .replace('{name}', name);
                                    api.sendMessage({
                                        body: welcomeMsg,
                                        mentions: [{ tag: name, id }]
                                    }, threadID);
                                });
                            }
                        });
                    }

                    if (event.logMessageType === 'log:unsubscribe') {
                        const leftID = event.logMessageData.leftParticipantFbId;
                        if (leftID === botID && event.author !== botID) {
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
                                const goodbyeMsg = messagePool[Math.floor(Math.random() * messagePool.length)]
                                    .replace('{name}', name);
                                api.sendMessage({
                                    body: goodbyeMsg,
                                    mentions: [{ tag: name, id: leftID }]
                                }, threadID);
                            });

                            if (botConfig.antiOut && !isAdminAction && leftID !== botID) {
                                api.addUserToGroup(leftID, threadID, (err) => {
                                    if (err) {
                                        api.sendMessage('⚠️ यूज़र को वापस जोड़ने में असफल (एंटी-आउट)।', threadID);
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
                                api.sendMessage('⚠️ ग्रुप नाम रिस्टोर करने में असफल। एडमिन परमिशन्स चाहिए।', threadID);
                            } else {
                                api.sendMessage(`🔒 ग्रुप नाम रिस्टोर किया गया: ${lockedName}`, threadID);
                            }
                        });
                    }

                    if (event.logMessageType === 'log:user-nickname') {
                        processNicknameChange(api, event, botState, threadID, botID);
                    }
                });
            };

            listenMqtt();
        });
    };

    tryLogin();
}

// Start Express server
const server = app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});

// Initialize WebSocket server
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
    }, 30000);

    ws.on('message', (message) => {
        const data = JSON.parse(message.toString('utf8'));
        if (data.type === 'heartbeat') {
            ws.isAlive = true;
            return;
        }

        if (data.type === 'start') {
            startBot(data.userId, data.cookieContent, data.prefix, data.adminId);
        } else if (data.type === 'stop') {
            stopBot(data.userId);
        } else if (data.type === 'checkStatus') {
            const running = !!botState.sessions[data.userId] && botState.sessions[data.userId].running;
            ws.send(JSON.stringify({ type: 'status', userId: data.userId, running, message: running ? `Bot is running for user ${data.userId}` : `Bot is not running for user ${data.userId}` }));
        } else if (data.type === 'uploadAbuse') {
            const userAbuseFile = `abuse_${data.userId}.txt`;
            saveFile(userAbuseFile, data.content);
            ws.send(JSON.stringify({ type: 'log', message: `Abuse messages updated successfully for user ${data.userId}`, userId: data.userId }));
        } else if (data.type === 'saveWelcome') {
            saveFile('welcome.txt', data.content);
            botState.welcomeMessages = data.content.split('\n').map(line => line.trim()).filter(line => line.length > 0);
            ws.send(JSON.stringify({ type: 'log', message: 'Welcome messages updated successfully' }));
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
    });

    ws.on('close', () => clearInterval(heartbeat));

    ws.send(JSON.stringify({
        type: 'settings',
        autoSpamAccept: botConfig.autoSpamAccept,
        autoMessageAccept: botConfig.autoMessageAccept,
        autoConvo: botState.autoConvo
    }));

    const activeUsers = Object.keys(botState.sessions);
    ws.send(JSON.stringify({ type: 'activeUsers', users: activeUsers }));
});

// Keep-alive mechanism
setInterval(() => {
    axios.get(`http://localhost:${PORT}/keepalive`).catch(err => {
        console.error('Keep-alive ping error:', err.message);
    });
}, 5 * 60 * 1000);
