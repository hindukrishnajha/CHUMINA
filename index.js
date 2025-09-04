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
const { stickerspam: handleStickerSpam } = require('./commands/admin/stickerspam');
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
console.log('botState initialized:', JSON.stringify(botState, null, 2));

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 10000;

// Log current directory for debugging
console.log('Current directory (__dirname):', __dirname);

// Add explicit route for root to serve index.html
app.get('/', (req, res) => {
    const filePath = path.join(__dirname, 'index.html');
    console.log('Attempting to serve:', filePath);
    if (fs.existsSync(filePath)) {
        console.log('index.html found, serving file');
        res.sendFile(filePath);
    } else {
        console.error('Error: index.html not found at:', filePath);
        res.status(404).send('Cannot GET: index.html not found in root directory.');
    }
});

// Health Check Endpoint
app.get('/health', (req, res) => {
    console.log('Health check endpoint hit');
    res.status(200).json({
        status: 'active',
        bot: 'शेलेन्द्र हिन्दू का गुलाम बोट राम इंडिया एफ',
        version: '10.0.0'
    });
});

// Keep-alive endpoint to prevent Render timeout
app.get('/keepalive', (req, res) => {
    console.log('Keep-alive endpoint hit');
    res.status(200).json({ status: 'alive' });
});

// Load environment variables for default cookies
if (process.env.COOKIE_BASE64) {
    try {
        const cookieContent = Buffer.from(process.env.COOKIE_BASE64, 'base64').toString('utf-8');
        fs.writeFileSync('cookies_default.txt', cookieContent);
        console.log('Default cookie file created from environment variable');
    } catch (err) {
        console.error('Error creating default cookie file:', err.message);
    }
}

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

// Load learned responses
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

// Stop bot function
function stopBot(userId) {
    console.log(`Attempting to stop bot for user ${userId}`);
    if (!botState.sessions[userId]) {
        console.log(`[DEBUG] No active session for user ${userId}`);
        broadcast({ type: 'log', message: `No active session for user ${userId}`, userId });
        return;
    }

    // Clear nickname timers and queues
    Object.keys(botState.nicknameTimers).forEach(threadID => {
        if (botState.nicknameQueues[threadID]?.botUserId === userId) {
            clearTimeout(botState.nicknameTimers[threadID]);
            delete botState.nicknameTimers[threadID];
            delete botState.nicknameQueues[threadID];
        }
    });

    // Clear sticker spam
    Object.keys(botState.stickerSpam).forEach(threadID => {
        if (botState.stickerSpam[threadID]) {
            clearInterval(botState.stickerSpam[threadID].interval);
            delete botState.stickerSpam[threadID];
        }
    });

    // Clear group name lock
    Object.keys(botState.lockedGroups).forEach(threadID => {
        if (botState.lockedGroups[threadID]) {
            delete botState.lockedGroups[threadID];
        }
    });

    // Logout API
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

    // Clear learned responses
    learnedResponses.triggers = [];
    fs.writeFileSync(LEARNED_RESPONSES_PATH, JSON.stringify({ triggers: [], adminList: botState.adminList }, null, 2));

    delete botState.sessions[userId];
    console.log(`Session stopped and cleaned for user ${userId}`);
    broadcast({ type: 'log', message: `Bot stopped for user ${userId}`, userId });
    broadcast({ type: 'status', userId, running: false });
}

// Start bot function with reconnection logic
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
        cookieContent
    };

    const tryLogin = (attempt = 1, maxAttempts = 5) => {
        try {
            const cookieFile = `cookies_${userId}.txt`;
            fs.writeFileSync(cookieFile, cookieContent);
            console.log(`Cookie file saved for user ${userId} at ${cookieFile}`);
            broadcast({ type: 'log', message: `Cookie file saved for user ${userId}`, userId });

            wiegine.login(cookieContent, {}, (err, api) => {
                if (err || !api) {
                    console.error(`Login failed for user ${userId} (attempt ${attempt}):`, err?.message || err);
                    broadcast({ type: 'log', message: `Login failed for user ${userId}: ${err?.message || err}`, userId });
                    if (attempt < maxAttempts) {
                        console.log(`Retrying login for user ${userId} in ${10 * attempt} seconds (attempt ${attempt + 1})`);
                        setTimeout(() => tryLogin(attempt + 1, maxAttempts), 10000 * attempt);
                    } else {
                        console.error(`Max login attempts reached for user ${userId}`);
                        botState.sessions[userId].running = false;
                        broadcast({ type: 'log', message: `Max login attempts reached for user ${userId}`, userId });
                        delete botState.sessions[userId];
                    }
                    return;
                }

                botState.sessions[userId].api = api;
                console.log(`Bot logged in and running for user ${userId}`);
                broadcast({ type: 'log', message: `Bot logged in and running for user ${userId}`, userId });
                broadcast({ type: 'status', userId, running: true });

                api.setOptions({ listenEvents: true, autoMarkRead: true });

                let abuseMessages = [];
                try {
                    abuseMessages = loadAbuseMessages();
                    console.log('Abuse messages loaded:', abuseMessages.length);
                } catch (err) {
                    console.error('Abuse file error:', err.message);
                    broadcast({ type: 'log', message: 'No abuse.txt file found or error reading it', userId });
                }

                try {
                    botState.welcomeMessages = loadWelcomeMessages();
                } catch (err) {
                    saveFile('welcome.txt', botState.welcomeMessages.join('\n'));
                }

                // MQTT reconnection logic
                const listenMqtt = (mqttAttempt = 1, maxMqttAttempts = 15) => {
                    if (!botState.sessions[userId]?.running) {
                        console.log(`[DEBUG] Session not running for user ${userId}, stopping MQTT listen`);
                        return;
                    }
                    api.listenMqtt(async (err, event) => {
                        if (err) {
                            console.error(`Listen error for user ${userId} (attempt ${mqttAttempt}):`, err.message);
                            broadcast({ type: 'log', message: `Listen error for user ${userId}: ${err.message}`, userId });
                            if (botState.sessions[userId]?.running && mqttAttempt < maxMqttAttempts) {
                                console.log(`Reconnecting MQTT for user ${userId} in ${10 * mqttAttempt} seconds (attempt ${mqttAttempt + 1})`);
                                setTimeout(() => listenMqtt(mqttAttempt + 1, maxMqttAttempts), 10000 * mqttAttempt);
                            } else {
                                console.error(`Max MQTT reconnection attempts reached for user ${userId}`);
                                broadcast({ type: 'log', message: `Max MQTT reconnection attempts reached for user ${userId}. Restarting bot.`, userId });
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

                            // Cache member IDs from message events
                            if (isGroup && event.senderID && event.senderID !== botID) {
                                if (!botState.memberCache[threadID]) {
                                    botState.memberCache[threadID] = new Set();
                                }
                                botState.memberCache[threadID].add(event.senderID);
                                console.log(`[DEBUG] Cached member ${event.senderID} for thread ${threadID}`);
                            }

                            // Cache member IDs from mentions
                            if (event.mentions && Object.keys(event.mentions).length > 0) {
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

                            // Cache member IDs from log:subscribe events
                            if (event.logMessageType === 'log:subscribe') {
                                const addedIDs = event.logMessageData.addedParticipants?.map(p => p.userFbId) || [];
                                if (!botState.memberCache[threadID]) {
                                    botState.memberCache[threadID] = new Set();
                                }
                                addedIDs.forEach(id => {
                                    if (id !== botID) {
                                        botState.memberCache[threadID].add(id);
                                        console.log(`[DEBUG] Cached new member ${id} for thread ${threadID}`);
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
                                        api.sendMessage("🚀 Auto-accepted your message request!", event.threadID);
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
                                            if (err || !ret) {
                                                console.error('UserInfo error for auto-target:', err.message);
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
                                                        console.log(`Auto-target abuse sent to ${name} (${abuserID}) in thread ${threadID}`);
                                                        await new Promise(r => setTimeout(r, 120000));
                                                    } catch (err) {
                                                        console.error('Auto-target abuse loop error:', err.message);
                                                        api.sendMessage('⚠️ Error sending auto-target abuse. Retrying in 2 minutes...', threadID);
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

                                    api.sendMessage(reply, event.threadID, event.messageID);
                                    api.sendMessage({ sticker: stickerID }, event.threadID);
                                }

                                const args = msg.split(' ').filter(arg => arg.trim() !== '');

                                if (msg.startsWith(botState.sessions[userId].prefix)) {
                                    const command = args[0].slice(botState.sessions[userId].prefix.length).toLowerCase();
                                    console.log(`[DEBUG] Parsed command: ${command}, args: ${JSON.stringify(args)}`);

                                    if (isMaster) {
                                        api.sendMessage('Thanks for considering me worthy, Master! Your order is my command 🙏', threadID, messageID);
                                    }

                                    // Command handlers
                                    if (command === 'help') {
                                        handleHelp(api, threadID, botState.sessions[userId].prefix);
                                        return;
                                    }

                                    if (isMaster) {
                                        if (command === 'mastercommand') {
                                            handleMasterCommand(api, threadID, botState.sessions[userId].prefix);
                                            return;
                                        } else if (command === 'stopall') {
                                            handleStopAll(api, threadID, botState, stopBot);
                                            return;
                                        } else if (command === 'status') {
                                            handleStatus(api, threadID, botState);
                                            return;
                                        } else if (command === 'kick') {
                                            handleKick(api, threadID, args, botState, stopBot);
                                            return;
                                        } else if (command === 'list') {
                                            handleList(api, threadID, botState);
                                            return;
                                        } else if (command === 'addadmin') {
                                            handleAddAdmin(api, threadID, args, event, botState, learnedResponses, LEARNED_RESPONSES_PATH);
                                            return;
                                        } else if (command === 'removeadmin') {
                                            handleRemoveAdmin(api, threadID, args, event, botState, learnedResponses, LEARNED_RESPONSES_PATH, MASTER_ID);
                                            return;
                                        } else if (command === 'listadmins') {
                                            handleListAdmins(api, threadID, botState);
                                            return;
                                        }
                                    }

                                    if (command === 'masterid') {
                                        handleMasterId(api, threadID, MASTER_FB_LINK);
                                        return;
                                    }

                                    if (command === 'learn') {
                                        handleLearn(api, threadID, msg, learnedResponses, LEARNED_RESPONSES_PATH);
                                        return;
                                    }

                                    if (isAdmin) {
                                        if (command === 'groupnamelock') {
                                            handleGroupNameLock(api, threadID, args, botState);
                                            return;
                                        } else if (command === 'nicknamelock') {
                                            handleNicknameLock(api, threadID, args, botState, userId);
                                            return;
                                        } else if (command === 'tid') {
                                            handleTid(api, threadID);
                                            return;
                                        } else if (command === 'uid') {
                                            handleUid(api, threadID, args, event);
                                            return;
                                        } else if (command === 'group' && args[1] === 'info') {
                                            handleGroupInfo(api, threadID, botState);
                                            return;
                                        } else if (command === 'info') {
                                            handleInfo(api, threadID, args, event);
                                            return;
                                        } else if (command === 'pair') {
                                            handlePair(api, threadID, botID, axios);
                                            return;
                                        } else if (command === 'music') {
                                            handleMusic(api, threadID, args, search, ytdl);
                                            return;
                                        } else if (command === 'antiout') {
                                            handleAntiOut(api, threadID, args, botConfig);
                                            return;
                                        } else if (command === 'send' && args[1] && args[1].toLowerCase() === 'sticker') {
                                            handleStickerSpam(api, threadID, args, botState);
                                            return;
                                        } else if (command === 'autospam' && args[1] === 'accept') {
                                            handleAutoSpam(api, threadID, botConfig, broadcast, userId);
                                            return;
                                        } else if (command === 'automessage' && args[1] === 'accept') {
                                            handleAutoMessage(api, threadID, botConfig, broadcast, userId);
                                            return;
                                        } else if (command === 'loder') {
                                            handleLoder(api, threadID, args, event, botState, abuseMessages, MASTER_ID);
                                            return;
                                        } else if (command === 'kickout' || (args.includes('kickout') && event.mentions)) {
                                            handleKickOut(api, threadID, args, event, isMaster, MASTER_ID);
                                            return;
                                        } else if (command === 'unsend' && event.messageReply) {
                                            handleUnsend(api, threadID, event, isMaster);
                                            return;
                                        }
                                    }

                                    api.sendMessage(`❌ Invalid command "${command}". Use ${botState.sessions[userId].prefix}help for the list of available commands.`, threadID);
                                    console.log(`[DEBUG] Invalid command "${command}" received in thread ${threadID}`);
                                    return;
                                }

                                if (lowerMsg === 'autoconvo on' && isAdmin) {
                                    botState.autoConvo = true;
                                    api.sendMessage('🔥 ऑटो कॉन्वो सिस्टम चालू हो गया है! अब कोई भी गाली देगा तो उसकी खैर नहीं!', threadID);
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
                                    api.sendMessage('✅ ऑटो कॉन्वो सिस्टम बंद हो गया है!', threadID);
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
                                    if (abuserIDGazelleBot === MASTER_ID) return;
                                    if (!botState.abuseTargets[threadID]) {
                                        botState.abuseTargets[threadID] = {};
                                    }

                                    if (!botState.abuseTargets[threadID][abuserID] && abuseMessages.length > 0) {
                                        botState.abuseTargets[threadID][abuserID] = true;

                                        api.getUserInfo(abuserID, (err, ret) => {
                                            if (err || !ret) {
                                                console.error('UserInfo error for auto-convo:', err.message);
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
                                                        console.log(`Auto-convo abuse sent to ${name} (${abuserID}) in thread ${threadID}`);
                                                        await new Promise(r => setTimeout(r, 120000));
                                                    } catch (err) {
                                                        console.error('Auto-convo abuse loop error:', err.message);
                                                        api.sendMessage('⚠️ Error sending auto-convo abuse. Retrying in 2 minutes...', threadID);
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
                                        api.sendMessage('😏 ठीक है बेटा! अब तुझे नहीं गाली देंगे. बच गया तू... अगली बार संभल के!', threadID);
                                        return;
                                    }
                                }

                                if (lowerMsg.includes('bot') && isGroup) {
                                    const randomResponse = randomBotReplies[Math.floor(Math.random() * randomBotReplies.length)];
                                    if (Math.random() < 0.8) {
                                        setTimeout(() => {
                                            api.sendMessage(randomResponse, threadID);
                                        }, 5000);
                                    }
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
👑 𝗖𝗿𝗲𝗮𝘁𝗲𝗱 𝗕𝗬: ✶♡⤾➝SHALENDER X..⤹✶➺🪿🫨🩷🪽`, threadID);
                                    } else {
                                        // Cache new members
                                        if (!botState.memberCache[threadID]) {
                                            botState.memberCache[threadID] = new Set();
                                        }
                                        botState.memberCache[threadID].add(id);
                                        console.log(`[DEBUG] Cached new member ${id} for thread ${threadID}`);

                                        api.getUserInfo(id, (err, ret) => {
                                            if (err || !ret?.[id]) return;
                                            const name = ret[id].name || 'User';
                                            const welcomeMsg = welcomeMessages[Math.floor(Math.random() * welcomeMessages.length)]
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
                                    console.log(`[DEBUG] Bot ${userId} removed from group, stopping session`);
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
                                                console.error('Anti-out error:', err.message);
                                                api.sendMessage('⚠️ Failed to re-add user (anti-out).', threadID);
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
                                        api.sendMessage('⚠️ Failed to restore group name. Admin permissions may be required.', threadID);
                                    } else {
                                        api.sendMessage(`🔒 Group name restored to: ${lockedName}`, threadID);
                                    }
                                });
                            }
                        } catch (e) {
                            console.error('Event processing error:', e.message);
                            broadcast({ type: 'log', message: `Event error for user ${userId}: ${e.message}`, userId });
                        }
                    });
                };

                listenMqtt();
            });
        } catch (err) {
            console.error(`Error in startBot for user ${userId}:`, err.message);
            broadcast({ type: 'log', message: `Error starting bot for user ${userId}: ${err.message}`, userId });
            botState.sessions[userId].running = false;
        }
    };

    tryLogin();
}

// Start Express server
let server;
try {
    server = app.listen(PORT, () => {
        console.log(`Server running on port ${PORT}`);
    });
} catch (err) {
    console.error('Error starting Express server:', err.message);
    process.exit(1);
}

// Initialize WebSocket server
let wss;
try {
    wss = new WebSocket.Server({ server });
    console.log('WebSocket server initialized');
} catch (err) {
    console.error('Error initializing WebSocket server:', err.message);
    process.exit(1);
}

// Keep-alive mechanism to prevent Render timeout
const keepAlive = setInterval(() => {
    console.log('Keep-alive ping sent to prevent server timeout');
    axios.get(`http://localhost:${PORT}/keepalive`).catch(err => {
        console.error('Keep-alive ping error:', err.message);
    });
}, 5 * 60 * 1000); // Every 5 minutes

// Log uncaught exceptions and rejections
process.on('uncaughtException', (err) => {
    console.error('Uncaught Exception:', err.message, err.stack);
    broadcast({ type: 'log', message: `Uncaught Exception: ${err.message}`, userId: 'system' });
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
    broadcast({ type: 'log', message: `Unhandled Rejection: ${reason}`, userId: 'system' });
});

// Log botState at startup
console.log('botState at startup:', JSON.stringify(botState, null, 2));

wss.on('connection', (ws) => {
    console.log('WebSocket client connected with IP:', ws._socket.remoteAddress);
    ws.isAlive = true;

    // Heartbeat mechanism
    const heartbeat = setInterval(() => {
        if (ws.isAlive === false) {
            clearInterval(heartbeat);
            console.log('Terminating inactive WebSocket client');
            return ws.terminate();
        }
        ws.isAlive = false;
        ws.send(JSON.stringify({ type: 'heartbeat' }));
        console.log('Heartbeat sent to client');
    }, 30000);

    ws.on('message', (message) => {
        try {
            const messageString = message.toString('utf8');
            if (!messageString) {
                console.error('WebSocket message is empty');
                ws.send(JSON.stringify({ type: 'log', message: 'Error: Empty message received' }));
                return;
            }

            const data = JSON.parse(messageString);
            if (data.type === 'heartbeat') {
                ws.isAlive = true;
                console.log('Heartbeat received from client');
                return;
            }
            console.log('WebSocket message received:', data);

            if (data.type === 'start') {
                console.log(`Received start request for user ${data.userId}`);
                startBot(data.userId, data.cookieContent, data.prefix, data.adminId);
            } else if (data.type === 'stop') {
                console.log(`Received stop request for user ${data.userId}`);
                if (data.userId) {
                    if (botState.sessions[data.userId]) {
                        stopBot(data.userId);
                        ws.send(JSON.stringify({ type: 'log', message: `Bot stopped for user ${data.userId}`, userId: data.userId }));
                        ws.send(JSON.stringify({ type: 'status', userId: data.userId, running: false }));
                    } else {
                        ws.send(JSON.stringify({ type: 'log', message: `No active session for user ${data.userId}`, userId: data.userId }));
                    }
                } else {
                    ws.send(JSON.stringify({ type: 'log', message: 'Invalid userId provided' }));
                }
            } else if (data.type === 'checkStatus') {
                console.log(`Received checkStatus request for user ${data.userId}`);
                const userId = data.userId;
                const running = !!botState.sessions[userId] && botState.sessions[userId].running;
                ws.send(JSON.stringify({ type: 'status', userId, running }));
            } else if (data.type === 'uploadAbuse') {
                console.log('Received uploadAbuse request');
                try {
                    saveFile('abuse.txt', data.content);
                    console.log('Abuse file saved successfully');
                    ws.send(JSON.stringify({ type: 'log', message: 'Abuse messages updated successfully' }));
                } catch (err) {
                    console.error('Error saving abuse file:', err.message);
                    ws.send(JSON.stringify({ type: 'log', message: `Failed to update abuse messages: ${err.message}` }));
                }
            } else if (data.type === 'saveWelcome') {
                console.log('Received saveWelcome request');
                try {
                    saveFile('welcome.txt', data.content);
                    botState.welcomeMessages = data.content.split('\n')
                        .map(line => line.trim())
                        .filter(line => line.length > 0);
                    console.log('Welcome messages saved successfully');
                    ws.send(JSON.stringify({ type: 'log', message: 'Welcome messages updated successfully' }));
                } catch (err) {
                    console.error('Error saving welcome messages:', err.message);
                    ws.send(JSON.stringify({ type: 'log', message: `Failed to update welcome messages: ${err.message}` }));
                }
            } else if (data.type === 'saveSettings') {
                console.log('Received saveSettings request:', data);
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

    if (!botState.sessions) {
        console.error('botState.sessions is undefined, initializing to empty object');
        botState.sessions = {};
    }
    const activeUsers = Object.keys(botState.sessions);

    ws.send(JSON.stringify({ type: 'activeUsers', users: activeUsers }));
});
