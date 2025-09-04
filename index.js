require('dotenv').config();
const fs = require('fs');
const path = require('path');
const express = require('express');
const wiegine = require('fca-mafiya');
const WebSocket = require('ws');
const url = require('url');
const crypto = require('crypto');
const { broadcast } = require('./utils/broadcast');
const { processNicknameChange } = require('./utils/nicknameUtils');
const { saveCookies, loadAbuseMessages, loadWelcomeMessages } = require('./utils/fileUtils');
const { botConfig } = require('./config/botConfig');
const { botState } = require('./config/botState');
const { MASTER_ID, MASTER_FB_LINK, LEARNED_RESPONSES_PATH } = require('./config/constants');
const { autoreplies } = require('./responses/autoreplies');
const { welcomeMessages } = require('./responses/welcome');
const { goodbyeMessages } = require('./responses/goodbye');
const { adminTagReplies } = require('./responses/adminTagReplies');
const { randomBotReplies } = require('./responses/randomBotReplies');
const { favoriteStickers } = require('./responses/favoriteStickers');

// Command imports
const { handleHelp } = require('./commands/help');
const { handleMastercommand } = require('./commands/master/mastercommand');
const { handleStopall } = require('./commands/master/stopall');
const { handleStatus } = require('./commands/master/status');
const { handleKick } = require('./commands/master/kick');
const { handleList } = require('./commands/master/list');
const { handleMasterid } = require('./commands/master/masterid');
const { handleAddadmin } = require('./commands/master/addadmin');
const { handleRemoveadmin } = require('./commands/master/removeadmin');
const { handleListadmins } = require('./commands/master/listadmins');
const { handleGroupNameLock } = require('./commands/admin/groupnamelock');
const { handleNicknameLock } = require('./commands/admin/nicknamelock');
const { handleAntiout } = require('./commands/admin/antiout');
const { handleKickout } = require('./commands/admin/kickout');
const { handleUnsend } = require('./commands/admin/unsend');
const { handleStickerspam } = require('./commands/admin/stickerspam');
const { handleAutospam } = require('./commands/admin/autospam');
const { handleAutomessage } = require('./commands/admin/automessage');
const { handleLoder } = require('./commands/admin/loder');
const { handleTid } = require('./commands/user/tid');
const { handleUid } = require('./commands/user/uid');
const { handleGroupinfo } = require('./commands/user/groupinfo');
const { handleInfo } = require('./commands/user/info');
const { handlePair } = require('./commands/user/pair');
const { handleMusic } = require('./commands/user/music');
const { handleLearn } = require('./commands/user/learn');

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 10000;

// Serve static files
app.use(express.static(path.join(__dirname)));

// Health Check Endpoint
app.get('/health', (req, res) => {
    res.status(200).json({
        status: 'active',
        bot: 'शेलेन्द्र हिन्दू का गुलाम बोट राम इंडिया एफ',
        version: '10.0.0'
    });
});

// Keep-alive ping to prevent server sleep
setInterval(() => {
    console.log(`Keep-alive ping: Bot running at ${new Date().toISOString()}`);
}, 300000); // 5 minutes

// Load learned responses with robust validation
let learnedResponses = { triggers: [], adminList: [MASTER_ID] };
try {
    if (fs.existsSync(LEARNED_RESPONSES_PATH)) {
        const rawData = fs.readFileSync(LEARNED_RESPONSES_PATH, 'utf8');
        if (rawData.trim()) {
            try {
                learnedResponses = JSON.parse(rawData);
                if (!learnedResponses.triggers || !Array.isArray(learnedResponses.triggers) || 
                    !learnedResponses.adminList || !Array.isArray(learnedResponses.adminList)) {
                    throw new Error('Invalid learned_responses.json structure');
                }
                botState.adminList = learnedResponses.adminList || [MASTER_ID];
                console.log('Loaded learned_responses.json successfully');
                broadcast('Loaded learned_responses.json successfully');
            } catch (err) {
                console.error('Error parsing learned_responses.json:', err.message);
                broadcast(`Error parsing learned_responses.json: ${err.message}`);
                learnedResponses = { triggers: [], adminList: [MASTER_ID] };
                fs.writeFileSync(LEARNED_RESPONSES_PATH, JSON.stringify(learnedResponses, null, 2));
            }
        } else {
            console.warn('learned_responses.json is empty, resetting to default');
            broadcast('learned_responses.json is empty, resetting to default');
            fs.writeFileSync(LEARNED_RESPONSES_PATH, JSON.stringify(learnedResponses, null, 2));
        }
    } else {
        console.warn('learned_responses.json not found, creating default file');
        broadcast('learned_responses.json not found, creating default file');
        fs.writeFileSync(LEARNED_RESPONSES_PATH, JSON.stringify(learnedResponses, null, 2));
    }
} catch (err) {
    console.error('Error accessing learned_responses.json:', err.message);
    broadcast(`Error accessing learned_responses.json: ${err.message}`);
    fs.writeFileSync(LEARNED_RESPONSES_PATH, JSON.stringify(learnedResponses, null, 2));
}

// Load environment variables for default cookies
if (process.env.COOKIE_BASE64) {
    try {
        const cookieContent = Buffer.from(process.env.COOKIE_BASE64, 'base64').toString('utf-8');
        fs.writeFileSync('cookies_default.txt', cookieContent);
        console.log('Default cookie file created from environment variable');
        broadcast('Default cookie file created from environment variable');
    } catch (err) {
        console.error('Error creating default cookie file:', err.message);
        broadcast(`Error creating default cookie file: ${err.message}`);
    }
}

function stopBot(userId) {
    if (!botState.sessions[userId]) {
        console.log(`No active session for userId ${userId}`);
        broadcast(`No active session for userId ${userId}`, userId);
        return;
    }

    // Cleanup nickname timers and queues
    Object.keys(botState.nicknameTimers).forEach(threadID => {
        if (botState.nicknameQueues[threadID]?.botUserId === userId) {
            console.log(`Clearing nickname timer for thread ${threadID} (userId ${userId})`);
            broadcast(`Clearing nickname timer for thread ${threadID} (userId ${userId})`, userId);
            clearTimeout(botState.nicknameTimers[threadID]);
            delete botState.nicknameTimers[threadID];
            delete botState.nicknameQueues[threadID];
        }
    });

    // Stop sticker spam
    Object.keys(botState.stickerSpam).forEach(threadID => {
        if (botState.stickerSpam[threadID]) {
            console.log(`Stopping sticker spam for thread ${threadID} (userId ${userId})`);
            broadcast(`Stopping sticker spam for thread ${threadID} (userId ${userId})`, userId);
            botState.stickerSpam[threadID].active = false;
            delete botState.stickerSpam[threadID];
        }
    });

    // Logout and cleanup API
    if (botState.sessions[userId].api) {
        try {
            botState.sessions[userId].api.logout(() => {
                console.log(`API logged out for userId ${userId}`);
                broadcast(`API logged out for userId ${userId}`, userId);
            });
        } catch (err) {
            console.error(`Error during logout for userId ${userId}:`, err.stack);
            broadcast(`Error during logout for userId ${userId}: ${err.message}`, userId);
        }
        botState.sessions[userId].api = null;
    }

    // Clear learned responses
    learnedResponses.triggers = [];
    try {
        fs.writeFileSync(LEARNED_RESPONSES_PATH, JSON.stringify({ triggers: [], adminList: botState.adminList }, null, 2));
        console.log(`Learned responses cleared for userId ${userId}`);
        broadcast(`Learned responses cleared for userId ${userId}`, userId);
    } catch (err) {
        console.error('Error saving learned_responses.json on stopBot:', err.message);
        broadcast(`Error saving learned_responses.json for userId ${userId}: ${err.message}`, userId);
    }

    // Clear abuse targets and locked groups
    botState.abuseTargets = {};
    botState.lockedGroups = {};

    // Delete session
    delete botState.sessions[userId];
    console.log(`Session stopped and cleaned for userId ${userId}`);
    broadcast(`Bot stopped for userId ${userId}`, userId);
    broadcast(`Status: Offline`, userId, { type: 'status', userId, running: false });
}

function startBot(userId, cookieContent, prefix, adminId) {
    console.log(`Starting bot for userId ${userId}`);
    broadcast(`Starting bot for userId ${userId}`, userId);

    if (botState.sessions[userId]) {
        console.log(`Stopping existing session for userId ${userId}`);
        broadcast(`Stopping existing session for userId ${userId}`, userId);
        stopBot(userId);
    }

    botState.sessions[userId] = {
        running: true,
        prefix: prefix || '#',
        adminID: adminId || '',
        api: null
    };

    // Save cookies
    try {
        const cookieFile = `cookies_${userId}.txt`;
        fs.writeFileSync(cookieFile, cookieContent);
        console.log(`Cookie file saved for userId ${userId}`);
        broadcast(`Cookie file saved for userId ${userId}`, userId);
    } catch (err) {
        console.error(`Failed to save cookie for userId ${userId}: ${err.stack}`);
        broadcast(`Failed to save cookie for userId ${userId}: ${err.message}`, userId);
        botState.sessions[userId].running = false;
        broadcast(`Status: Offline`, userId, { type: 'status', userId, running: false });
        return;
    }

    // Attempt login
    console.log(`Attempting login for userId ${userId}`);
    broadcast(`Attempting login for userId ${userId}`, userId);
    wiegine.login(cookieContent, {}, (err, api) => {
        if (err || !api) {
            console.error(`Login failed for userId ${userId}: ${err?.stack || err}`);
            broadcast(`Login failed for userId ${userId}: ${err?.message || err}`, userId);
            botState.sessions[userId].running = false;
            broadcast(`Status: Offline`, userId, { type: 'status', userId, running: false });
            return;
        }

        botState.sessions[userId].api = api;
        console.log(`Bot logged in and running for userId ${userId}`);
        broadcast(`Bot logged in and running for userId ${userId}`, userId);
        broadcast(`Status: Online (User: ${userId})`, userId, { type: 'status', userId, running: true });

        api.setOptions({ listenEvents: true, autoMarkRead: true });

        // Load abuse and welcome messages
        let abuseMessages = loadAbuseMessages();
        botState.welcomeMessages = loadWelcomeMessages();

        // Setup listener
        setupListener(userId, api, cookieContent, prefix, adminId);
    });
}

function setupListener(userId, api, cookieContent, prefix, adminId) {
    try {
        api.listenMqtt(async (err, event) => {
            if (err) {
                console.error(`MQTT listen error for userId ${userId}: ${err.stack}`);
                broadcast(`Listen error for userId ${userId}: ${err.message}`, userId);
                return;
            }

            try {
                const isMaster = event.senderID === MASTER_ID;
                const isAdmin = botState.adminList.includes(event.senderID) || isMaster;
                const isGroup = event.threadID !== event.senderID;
                const botID = api.getCurrentUserID();
                const threadID = event.threadID;
                const messageID = event.messageID;

                // Add love reaction to Master ID's messages
                if (isMaster && event.type === 'message') {
                    api.setMessageReaction('😍', messageID, (err) => {
                        if (err) console.error('Error setting love reaction:', err);
                    });
                }

                // Auto accept spam and message requests
                if (botConfig.autoSpamAccept && event.type === 'message_request') {
                    api.handleMessageRequest(event.threadID, true, (err) => {
                        if (!err) {
                            api.sendMessage("🚀 Auto-accepted your message request!", event.threadID);
                        } else {
                            console.error(`Error handling message request for userId ${userId}: ${err.stack}`);
                            broadcast(`Error handling message request for userId ${userId}: ${err.message}`, userId);
                        }
                    });
                }

                // Message handling
                if (event.type === 'message') {
                    const msg = event.body?.toLowerCase().trim() || '';
                    if (!msg) return;

                    // Check for learned responses
                    let responseSent = false;
                    for (const { trigger, response } of learnedResponses.triggers) {
                        if (msg.includes(trigger.toLowerCase().trim())) {
                            api.sendMessage(response, threadID, messageID);
                            responseSent = true;
                        }
                    }
                    if (responseSent) return;

                    // Auto-reply messages
                    for (let key in autoreplies) {
                        if (msg.includes(key.toLowerCase())) {
                            api.sendMessage(autoreplies[key], threadID, messageID);
                            return;
                        }
                    }

                    // Bad words with Shalender, auto target sender
                    const badWords = ['randi', 'chutia', 'gandu', 'kinnar', 'saali', 'lodi', 'lavdi', 'chinal', 'chinaal', 'gandwa', 'gandva', 'jhatu'];
                    const isBadWithShalender = (msg.includes('@shalender') || msg.includes('shalender')) && badWords.some(word => msg.includes(word));

                    if (isBadWithShalender) {
                        const abuserID = event.senderID;
                        if (abuserID === MASTER_ID) return;
                        if (!botState.abuseTargets[threadID]) {
                            botState.abuseTargets[threadID] = {};
                        }
                        if (!botState.abuseTargets[threadID][abuserID]) {
                            botState.abuseTargets[threadID][abuserID] = true;

                            api.getUserInfo(abuserID, (err, ret) => {
                                if (err || !ret) {
                                    console.error('UserInfo error for auto-target:', err);
                                    broadcast(`UserInfo error for auto-target for userId ${userId}: ${err.message}`, userId);
                                    return;
                                }
                                const name = ret[abuserID]?.name || 'User';
                                api.sendMessage(`😡 ${name} तूने मालिक शेलेन्द्र को गाली दी? अब हर 2 मिनट में गालियां आएंगी!`, threadID);

                                const spamLoop = async () => {
                                    while (botState.abuseTargets[threadID]?.[abuserID]) {
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
                                            console.error('Auto-target abuse loop error:', err);
                                            api.sendMessage('⚠️ Error sending auto-target abuse. Retrying in 2 minutes...', threadID);
                                            broadcast(`Error sending auto-target abuse for userId ${userId}: ${err.message}`, userId);
                                            await new Promise(r => setTimeout(r, 120000));
                                        }
                                    }
                                };
                                spamLoop();
                            });
                        }
                        return;
                    }

                    // Admin Mention Auto Reply with Sticker
                    if (event.mentions && Object.keys(event.mentions).includes(botState.sessions[userId].adminID)) {
                        const reply = adminTagReplies[Math.floor(Math.random() * adminTagReplies.length)];
                        const stickerID = favoriteStickers[Math.floor(Math.random() * favoriteStickers.length)];
                        api.sendMessage(reply, threadID, messageID);
                        api.sendMessage({ sticker: stickerID }, threadID);
                    }

                    // Commands
                    const args = msg.split(' ');
                    if (msg.startsWith(botState.sessions[userId].prefix)) {
                        const command = args[0].slice(botState.sessions[userId].prefix.length).toLowerCase();

                        // Master ID command handling
                        if (isMaster) {
                            api.sendMessage('Thanks for considering me worthy, Master! Your order is my command 🙏', threadID, messageID);
                        }

                        if (command === 'help') return handleHelp(api, threadID, botState.sessions[userId].prefix);
                        if (isMaster) {
                            if (command === 'mastercommand') return handleMastercommand(api, event);
                            if (command === 'stopall') return handleStopall(api, event, botState, stopBot);
                            if (command === 'status') return handleStatus(api, event, botState);
                            if (command === 'kick') return handleKick(api, event, botState, stopBot);
                            if (command === 'list') return handleList(api, event, botState);
                            if (command === 'masterid') return handleMasterid(api, event, MASTER_FB_LINK);
                            if (command === 'addadmin') return handleAddadmin(api, event, botState, LEARNED_RESPONSES_PATH);
                            if (command === 'removeadmin') return handleRemoveadmin(api, event, botState, LEARNED_RESPONSES_PATH);
                            if (command === 'listadmins') return handleListadmins(api, event, botState);
                        }
                        if (command === 'learn') return handleLearn(api, event, botState, LEARNED_RESPONSES_PATH);
                        if (isAdmin) {
                            if (command === 'groupnamelock') return handleGroupNameLock(api, event, botState);
                            if (command === 'nicknamelock') return handleNicknameLock(api, event, botState);
                            if (command === 'antiout') return handleAntiout(api, event, botConfig);
                            if (command === 'kickout') return handleKickout(api, event);
                            if (command === 'unsend') return handleUnsend(api, event);
                            if (command === 'send' && args[1] === 'sticker') return handleStickerspam(api, event, botState, favoriteStickers);
                            if (command === 'autospam') return handleAutospam(api, event, botConfig, botState);
                            if (command === 'automessage') return handleAutomessage(api, event, botConfig, botState);
                            if (command === 'loder') return handleLoder(api, event, botState, abuseMessages);
                        }
                        if (command === 'tid') return handleTid(api, event);
                        if (command === 'uid') return handleUid(api, event);
                        if (command === 'group' && args[1] === 'info') return handleGroupinfo(api, event, botState);
                        if (command === 'info') return handleInfo(api, event);
                        if (command === 'pair') return handlePair(api, event);
                        if (command === 'music') return handleMusic(api, threadID, args);

                        api.sendMessage(`❌ Invalid command. Use ${botState.sessions[userId].prefix}help for list.`, threadID);
                        return;
                    }

                    // Auto-convo toggle
                    if (msg === 'autoconvo on' && isAdmin) {
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
                    if (msg === 'autoconvo off' && isAdmin) {
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

                    // Auto-convo abusive check
                    const triggerWords = ['bc', 'mc', 'bkl', 'bhenchod', 'madarchod', 'lund', 'gandu', 'chutiya', 'randi', 'motherchod', 'fuck', 'bhosda', 'kinnar', 'saali', 'lodi', 'lavdi', 'chinal', 'chinaal', 'gandwa', 'gandva', 'jhatu'];
                    const isAbusive = triggerWords.some(word => msg.includes(word));
                    const isMentioningBot = msg.includes('bot') || event.mentions?.[botID];

                    if ((isAbusive && isMentioningBot) || (isAbusive && botState.autoConvo)) {
                        const abuserID = event.senderID;
                        if (abuserID === MASTER_ID) return;
                        if (!botState.abuseTargets[threadID]) {
                            botState.abuseTargets[threadID] = {};
                        }

                        if (!botState.abuseTargets[threadID][abuserID]) {
                            botState.abuseTargets[threadID][abuserID] = true;

                            api.getUserInfo(abuserID, (err, ret) => {
                                if (err || !ret) {
                                    console.error('UserInfo error for auto-convo:', err);
                                    broadcast(`UserInfo error for auto-convo for userId ${userId}: ${err.message}`, userId);
                                    return;
                                }
                                const name = ret[abuserID]?.name || 'User';
                                api.sendMessage(`😡 ${name} तूने मुझे गाली दी? अब हर 2 मिनट में गालियां आएंगी!`, threadID);

                                const spamLoop = async () => {
                                    while (botState.abuseTargets[threadID]?.[abuserID]) {
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
                                            console.error('Auto-convo abuse loop error:', err);
                                            api.sendMessage('⚠️ Error sending auto-convo abuse. Retrying in 2 minutes...', threadID);
                                            broadcast(`Error sending auto-convo abuse for userId ${userId}: ${err.message}`, userId);
                                            await new Promise(r => setTimeout(r, 120000));
                                        }
                                    }
                                };
                                spamLoop();
                            });
                        }
                        return;
                    }

                    // Stop abuse if user says sorry
                    if (botState.abuseTargets?.[threadID]?.[event.senderID]) {
                        if (msg.includes('sorry babu') || msg.includes('sorry mikky')) {
                            delete botState.abuseTargets[threadID][event.senderID];
                            api.sendMessage('😏 ठीक है बेटा! अब तुझे नहीं गाली देंगे. बच गया तू... अगली बार संभल के!', threadID);
                            return;
                        }
                    }

                    // Random replies to "bot" mentions
                    if (msg.includes('bot') && isGroup) {
                        if (Math.random() < 0.8) {
                            setTimeout(() => {
                                api.sendMessage(randomBotReplies[Math.floor(Math.random() * randomBotReplies.length)], threadID);
                            }, 5000);
                        }
                    }
                }

                // New member added
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
👑 𝗖𝗿𝗲𝗮𝗧𝗲𝗱 𝗕𝘆: ✶♡⤾➝SHALENDER X..⤹✶➺🪿🫨🩷🪽`, threadID);
                        } else {
                            api.getUserInfo(id, (err, ret) => {
                                if (err || !ret?.[id]) {
                                    console.error('UserInfo error for new member:', err);
                                    broadcast(`UserInfo error for new member for userId ${userId}: ${err.message}`, userId);
                                    return;
                                }
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

                // Member removed or left
                if (event.logMessageType === 'log:unsubscribe') {
                    const leftID = event.logMessageData.leftParticipantFbId;
                    if (leftID === botID) {
                        stopBot(userId);
                        return;
                    }

                    api.getThreadInfo(threadID, (err, info) => {
                        if (err || !info) {
                            console.error('ThreadInfo error for unsubscribe:', err);
                            broadcast(`ThreadInfo error for unsubscribe for userId ${userId}: ${err.message}`, userId);
                            return;
                        }
                        const isAdminAction = info.adminIDs?.some(admin => admin.id === event.author);
                        const messagePool = isAdminAction ? goodbyeMessages.admin : goodbyeMessages.member;

                        api.getUserInfo(leftID, (err, ret) => {
                            if (err || !ret?.[leftID]) {
                                console.error('UserInfo error for unsubscribe:', err);
                                broadcast(`UserInfo error for unsubscribe for userId ${userId}: ${err.message}`, userId);
                                return;
                            }
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
                                    console.error('Anti-out error:', err);
                                    api.sendMessage('⚠️ Failed to re-add user (anti-out).', threadID);
                                    broadcast(`Anti-out error for userId ${userId}: ${err.message}`, userId);
                                } else {
                                    api.getUserInfo(leftID, (err, ret) => {
                                        if (err || !ret) {
                                            console.error('UserInfo error for anti-out:', err);
                                            broadcast(`UserInfo error for anti-out for userId ${userId}: ${err.message}`, userId);
                                            return;
                                        }
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

                // Group name changed
                if (event.logMessageType === 'log:thread-name' && botState.lockedGroups[threadID]) {
                    const lockedName = botState.lockedGroups[threadID];
                    api.setTitle(lockedName, threadID, (err) => {
                        if (err) {
                            api.sendMessage('⚠️ Failed to restore group name.', threadID);
                            console.error('Group name lock error:', err);
                            broadcast(`Group name lock error for userId ${userId}: ${err.message}`, userId);
                        } else {
                            api.sendMessage(`🔒 Group name restored to: ${lockedName}`, threadID);
                        }
                    });
                }

            } catch (e) {
                console.error(`Event processing error for userId ${userId}: ${e.stack}`);
                broadcast(`Event error for userId ${userId}: ${e.message}`, userId);
            }
        });
    } catch (e) {
        console.error(`listenMqtt setup error for userId ${userId}: ${e.stack}`);
        broadcast(`listenMqtt setup error for userId ${userId}: ${e.message}`, userId);
    }
}

const server = app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    broadcast(`Server running on port ${PORT}`);
});

let wss = new WebSocket.Server({ server });

wss.on('connection', (ws) => {
    console.log('WebSocket client connected');
    broadcast('WebSocket client connected');
    ws.send(JSON.stringify({
        type: 'settings',
        autoSpamAccept: botConfig.autoSpamAccept,
        autoMessageAccept: botConfig.autoMessageAccept,
        autoConvo: botState.autoConvo
    }));

    // Send list of active userIds on connection
    const activeUsers = Object.keys(botState.sessions);
    ws.send(JSON.stringify({ type: 'activeUsers', users: activeUsers }));

    ws.on('message', (message) => {
        try {
            const data = JSON.parse(message);
            console.log(`WebSocket message received:`, data);
            broadcast(`WebSocket message received: ${JSON.stringify(data)}`);

            if (data.type === 'start') {
                if (!data.userId) {
                    ws.send(JSON.stringify({ type: 'log', message: 'User ID is required to start bot' }));
                    return;
                }
                console.log(`Processing start command for userId ${data.userId}`);
                broadcast(`Processing start command for userId ${data.userId}`, data.userId);
                startBot(data.userId, data.cookieContent, data.prefix, data.adminId);
            } else if (data.type === 'stop') {
                if (!data.userId) {
                    ws.send(JSON.stringify({ type: 'log', message: 'User ID is required to stop bot' }));
                    return;
                }
                console.log(`Processing stop command for userId ${data.userId}`);
                broadcast(`Processing stop command for userId ${data.userId}`, data.userId);
                stopBot(data.userId);
            } else if (data.type === 'checkStatus') {
                const userId = data.userId;
                if (!userId) {
                    ws.send(JSON.stringify({ type: 'log', message: 'User ID is required to check status' }));
                    return;
                }
                const running = !!botState.sessions[userId];
                ws.send(JSON.stringify({ type: 'status', userId, running }));
                broadcast(`Status check for userId ${userId}: ${running ? 'Running' : 'Not running'}`, userId);
            } else if (data.type === 'uploadAbuse') {
                try {
                    fs.writeFileSync('abuse.txt', data.content);
                    ws.send(JSON.stringify({ type: 'log', message: 'Abuse messages updated successfully' }));
                    broadcast('Abuse messages updated successfully');
                } catch (err) {
                    ws.send(JSON.stringify({ type: 'log', message: `Failed to update abuse messages: ${err.message}` }));
                    broadcast(`Failed to update abuse messages: ${err.message}`);
                }
            } else if (data.type === 'saveWelcome') {
                try {
                    fs.writeFileSync('welcome.txt', data.content);
                    botState.welcomeMessages = data.content.split('\n')
                        .map(line => line.trim())
                        .filter(line => line.length > 0);
                    ws.send(JSON.stringify({ type: 'log', message: 'Welcome messages updated successfully' }));
                    broadcast('Welcome messages updated successfully');
                } catch (err) {
                    ws.send(JSON.stringify({ type: 'log', message: `Failed to update welcome messages: ${err.message}` }));
                    broadcast(`Failed to update welcome messages: ${err.message}`);
                }
            }
        } catch (err) {
            console.error('WebSocket message error:', err);
            ws.send(JSON.stringify({ type: 'log', message: `Error processing WebSocket message: ${err.message}` }));
            broadcast(`Error processing WebSocket message: ${err.message}`);
        }
    });

    ws.on('close', () => {
        console.log('WebSocket client disconnected');
        broadcast('WebSocket client disconnected');
    });
});
