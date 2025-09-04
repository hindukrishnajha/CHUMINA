
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
            } catch (err) {
                console.error('Error parsing learned_responses.json:', err.message);
                console.warn('Resetting to default learned_responses');
                learnedResponses = { triggers: [], adminList: [MASTER_ID] };
                fs.writeFileSync(LEARNED_RESPONSES_PATH, JSON.stringify(learnedResponses, null, 2));
            }
        } else {
            console.warn('learned_responses.json is empty, resetting to default');
            fs.writeFileSync(LEARNED_RESPONSES_PATH, JSON.stringify(learnedResponses, null, 2));
        }
    } else {
        console.warn('learned_responses.json not found, creating default file');
        fs.writeFileSync(LEARNED_RESPONSES_PATH, JSON.stringify(learnedResponses, null, 2));
    }
} catch (err) {
    console.error('Error accessing learned_responses.json:', err.message);
    console.warn('Resetting to default learned_responses');
    fs.writeFileSync(LEARNED_RESPONSES_PATH, JSON.stringify(learnedResponses, null, 2));
}

// Load environment variables for default cookies (optional)
if (process.env.COOKIE_BASE64) {
    try {
        const cookieContent = Buffer.from(process.env.COOKIE_BASE64, 'base64').toString('utf-8');
        fs.writeFileSync('cookies_default.json', cookieContent);
        console.log('Default cookie file created from environment variable');
        broadcast({ type: 'log', message: 'Default cookie file created from environment variable' });
    } catch (err) {
        console.error('Error creating default cookie file:', err.message);
        broadcast({ type: 'log', message: `Error creating default cookie file: ${err.message}` });
    }
}

function stopBot(uniqueId) {
    if (!botState.sessions[uniqueId]) {
        broadcast({ type: 'log', message: `No active session for uniqueId ${uniqueId}`, uniqueId });
        return;
    }

    if (botState.nicknameTimers && typeof botState.nicknameTimers === 'object') {
        Object.keys(botState.nicknameTimers).forEach(threadID => {
            if (botState.nicknameQueues[threadID]?.botUniqueId === uniqueId) {
                console.log(`Clearing nickname timer for thread ${threadID} (uniqueId ${uniqueId})`);
                clearTimeout(botState.nicknameTimers[threadID]);
                delete botState.nicknameTimers[threadID];
                delete botState.nicknameQueues[threadID];
            }
        });
    } else {
        botState.nicknameTimers = {};
    }

    if (botState.stickerSpam && typeof botState.stickerSpam === 'object') {
        Object.keys(botState.stickerSpam).forEach(threadID => {
            if (botState.stickerSpam[threadID]) {
                console.log(`Stopping sticker spam for thread ${threadID} (uniqueId ${uniqueId})`);
                botState.stickerSpam[threadID].active = false;
                delete botState.stickerSpam[threadID];
            }
        });
    } else {
        botState.stickerSpam = {};
    }

    if (botState.sessions[uniqueId].api) {
        try {
            botState.sessions[uniqueId].api.logout(() => {
                console.log(`API logged out for uniqueId ${uniqueId}`);
            });
        } catch (err) {
            console.error(`Error during logout for uniqueId ${uniqueId}:`, err.stack);
        }
        botState.sessions[uniqueId].api = null;
    }

    learnedResponses.triggers = [];
    try {
        fs.writeFileSync(LEARNED_RESPONSES_PATH, JSON.stringify({ triggers: [], adminList: botState.adminList }, null, 2));
    } catch (err) {
        console.error('Error saving learned_responses.json on stopBot:', err.message);
    }

    botState.abuseTargets = {};
    botState.lockedGroups = {};

    delete botState.sessions[uniqueId];
    console.log(`Session stopped and cleaned for uniqueId ${uniqueId}`);
    broadcast({ type: 'log', message: `Bot stopped for uniqueId ${uniqueId}`, uniqueId });
    broadcast({ type: 'status', uniqueId, running: false });
}

function startBot(uniqueId, cookieContent, prefix, adminId) {
    if (botState.sessions[uniqueId]) {
        stopBot(uniqueId);
    }

    let cookies;
    try {
        // Clean up cookieContent by removing newlines and extra spaces to handle single or multi-line JSON
        const cleanedContent = cookieContent.replace(/\s+/g, ' ').trim();
        cookies = JSON.parse(cleanedContent);
        if (!Array.isArray(cookies)) {
            throw new Error('Cookie content must be an array of objects');
        }
    } catch (err) {
        console.warn(`JSON parsing failed for uniqueId ${uniqueId}: ${err.message}`);
        // Fallback: Handle header-style cookie string like "Cookie: name=value; name2=value2"
        try {
            // Remove "Cookie: " prefix if present
            const cleanedContent = cookieContent.replace(/^Cookie:\s*/, '').trim();
            cookies = cleanedContent.split(';').map(item => {
                const [name, value] = item.trim().split('=');
                if (!name || !value) throw new Error('Invalid cookie string format');
                // Handle complex values like dbln which are URL-encoded JSON
                let decodedValue = value;
                try {
                    decodedValue = decodeURIComponent(value);
                    // If it's a JSON string, parse it
                    if (decodedValue.startsWith('{') || decodedValue.startsWith('[')) {
                        decodedValue = JSON.parse(decodedValue);
                    }
                } catch (decodeErr) {
                    console.warn(`Failed to decode value for ${name}: ${decodeErr.message}`);
                }
                return { name, value: decodedValue };
            });
        } catch (stringErr) {
            console.error(`Invalid cookie content for uniqueId ${uniqueId}:`, stringErr.message);
            broadcast({ type: 'error', message: `Invalid cookie content for uniqueId ${uniqueId}: ${stringErr.message}`, uniqueId });
            return;
        }
    }

    botState.sessions[uniqueId] = {
        running: true,
        prefix: prefix || '#',
        adminID: adminId || '',
        api: null
    };

    try {
        const cookieFile = `cookies_${uniqueId}.json`;
        fs.writeFileSync(cookieFile, JSON.stringify(cookies, null, 2));
        console.log(`Cookie file saved for uniqueId ${uniqueId}`);
        broadcast({ type: 'log', message: `Cookie file saved for uniqueId ${uniqueId}`, uniqueId });
    } catch (err) {
        console.error(`Failed to save cookie for uniqueId ${uniqueId}:`, err.stack);
        broadcast({ type: 'error', message: `Failed to save cookie for uniqueId ${uniqueId}: ${err.message}`, uniqueId });
        botState.sessions[uniqueId].running = false;
        return;
    }

    wiegine.login({ appState: cookies }, {}, (err, api) => {
        if (err || !api) {
            console.error(`Login failed for uniqueId ${uniqueId}:`, err?.stack || err);
            broadcast({ type: 'error', message: `Login failed for uniqueId ${uniqueId}: ${err?.message || 'Unknown error'}`, uniqueId });
            botState.sessions[uniqueId].running = false;
            return;
        }

        console.log(`API object for uniqueId ${uniqueId}:`, Object.keys(api));
        botState.sessions[uniqueId].api = api;
        broadcast({ type: 'log', message: `Bot logged in and running for uniqueId ${uniqueId}`, uniqueId });
        broadcast({ type: 'status', uniqueId, running: true });

        api.setOptions({ listenEvents: true, autoMarkRead: true });

        let abuseMessages = loadAbuseMessages();
        botState.welcomeMessages = loadWelcomeMessages();

        setupListener(uniqueId, api, cookieContent, prefix, adminId);
    });
}

function setupListener(uniqueId, api, cookieContent, prefix, adminId) {
    try {
        api.listenMqtt(async (err, event) => {
            if (err) {
                console.error('MQTT listen error:', err.stack);
                broadcast({ type: 'error', message: `MQTT listen error for uniqueId ${uniqueId}: ${err.message}`, uniqueId });
                return;
            }

            try {
                console.log('MQTT event received:', { type: event?.type, body: event?.body, threadID: event?.threadID, senderID: event?.senderID });
                if (!event || event.type !== 'message' || !event.body) {
                    console.log('Skipping invalid or non-message event');
                    return;
                }

                const isMaster = event.senderID === MASTER_ID;
                const isAdmin = botState.adminList.includes(event.senderID) || isMaster;
                const isGroup = event.threadID !== event.senderID;
                const botID = api.getCurrentUserID();
                const threadID = event.threadID;
                const messageID = event.messageID;

                if (isMaster && event.type === 'message') {
                    api.setMessageReaction('😍', messageID, (err) => {
                        if (err) console.error('Error setting love reaction:', err);
                    });
                }

                if (botConfig.autoSpamAccept && event.type === 'message_request') {
                    api.handleMessageRequest(event.threadID, true, (err) => {
                        if (!err) {
                            api.sendMessage("🚀 Auto-accepted your message request!", event.threadID);
                        }
                    });
                }

                const msg = event.body.toLowerCase().trim();
                console.log('Message:', msg);
                const prefix = botState.sessions[uniqueId]?.prefix || '#';
                console.log('Prefix:', prefix);

                if (msg.startsWith(prefix)) {
                    const args = msg.split(' ');
                    const command = args[0].slice(prefix.length).toLowerCase();
                    console.log('Command received:', command, 'Args:', args);

                    if (command === 'help') {
                        console.log('Executing help command');
                        return handleHelp(api, threadID, prefix);
                    }
                    if (isMaster) {
                        console.log('Master command check:', command);
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
                    if (command === 'learn') {
                        console.log('Executing learn command');
                        return handleLearn(api, event, botState, LEARNED_RESPONSES_PATH);
                    }
                    if (isAdmin) {
                        console.log('Admin command check:', command);
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
                    console.log('User command check:', command);
                    if (command === 'tid') return handleTid(api, event);
                    if (command === 'uid') return handleUid(api, event);
                    if (command === 'group' && args[1] === 'info') return handleGroupinfo(api, event, botState);
                    if (command === 'info') return handleInfo(api, event);
                    if (command === 'pair') return handlePair(api, event);
                    if (command === 'music') return handleMusic(api, threadID, args);
                    console.log('Invalid command detected:', command);
                    api.sendMessage(`❌ अरे भाई, "${command}" कोई कमांड नहीं है! 😜 ${prefix}help यूज कर लिस्ट देखने के लिए।`, threadID);
                    return;
                }

                let responseSent = false;
                for (const { trigger, response } of learnedResponses.triggers) {
                    if (msg.includes(trigger.toLowerCase().trim())) {
                        api.sendMessage(response, threadID, messageID);
                        responseSent = true;
                    }
                }
                if (responseSent) return;

                for (let key in autoreplies) {
                    if (msg.includes(key.toLowerCase())) {
                        api.sendMessage(autoreplies[key], threadID, messageID);
                        return;
                    }
                }

                const badWords = ['randi', 'chutia', 'gandu', 'kinnar', 'saali', 'lodi', 'lavdi', 'chinal', 'chinaal', 'gandwa', 'gandva', 'jhatu'];
                const isBadWithShalender = (msg.includes('@shalender') || msg.includes('shalender')) && badWords.some(word => msg.includes(word));

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
                                console.error('UserInfo error for auto-target:', err);
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
                                        console.error('Auto-target abuse loop error:', err);
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

                if (event.mentions && Object.keys(event.mentions).includes(botState.sessions[uniqueId].adminID)) {
                    const reply = adminTagReplies[Math.floor(Math.random() * adminTagReplies.length)];
                    const stickerID = favoriteStickers[Math.floor(Math.random() * favoriteStickers.length)];
                    api.sendMessage(reply, threadID, messageID);
                    api.sendMessage({ sticker: stickerID }, threadID);
                }

                if (msg === 'autoconvo on' && isAdmin) {
                    botState.autoConvo = true;
                    api.sendMessage('🔥 ऑटो कॉन्वो सिस्टम चालू हो गया है! अब कोई भी गाली देगा तो उसकी खैर नहीं!', threadID);
                    broadcast({
                        type: 'settings',
                        autoSpamAccept: botConfig.autoSpamAccept,
                        autoMessageAccept: botConfig.autoMessageAccept,
                        autoConvo: botState.autoConvo,
                        uniqueId
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
                        uniqueId
                    });
                    return;
                }

                const triggerWords = ['bc', 'mc', 'bkl', 'bhenchod', 'madarchod', 'lund', 'gandu', 'chutiya', 'randi', 'motherchod', 'fuck', 'bhosda', 'kinnar', 'saali', 'lodi', 'lavdi', 'chinal', 'chinaal', 'gandwa', 'gandva', 'jhatu'];
                const isAbusive = triggerWords.some(word => msg.includes(word));
                const isMentioningBot = msg.includes('bot') || event.mentions?.[botID];

                if ((isAbusive && isMentioningBot) || (isAbusive && botState.autoConvo)) {
                    const abuserID = event.senderID;
                    if (abuserID === MASTER_ID) return;
                    if (!botState.abuseTargets[threadID]) {
                        botState.abuseTargets[threadID] = {};
                    }

                    if (!botState.abuseTargets[threadID][abuserID] && abuseMessages.length > 0) {
                        botState.abuseTargets[threadID][abuserID] = true;
                        api.getUserInfo(abuserID, (err, ret) => {
                            if (err || !ret) {
                                console.error('UserInfo error for auto-convo:', err);
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
                                        console.error('Auto-convo abuse loop error:', err);
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
                    if (msg.includes('sorry babu') || msg.includes('sorry mikky')) {
                        delete botState.abuseTargets[threadID][event.senderID];
                        api.sendMessage('😏 ठीक है बेटा! अब तुझे नहीं गाली देंगे. बच गया तू... अगली बार संभल के!', threadID);
                        return;
                    }
                }

                if (msg.includes('bot') && isGroup) {
                    if (Math.random() < 0.8) {
                        setTimeout(() => {
                            api.sendMessage(randomBotReplies[Math.floor(Math.random() * randomBotReplies.length)], threadID);
                        }, 5000);
                    }
                }
            } catch (e) {
                console.error('Event processing error:', e.stack);
                broadcast({ type: 'error', message: `Event error for uniqueId ${uniqueId}: ${e.message}`, uniqueId });
            }

            if (event?.logMessageType === 'log:subscribe') {
                const addedIDs = event.logMessageData?.addedParticipants?.map(p => p.userFbId) || [];
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

            if (event?.logMessageType === 'log:unsubscribe') {
                const leftID = event.logMessageData?.leftParticipantFbId;
                if (leftID === botID) {
                    stopBot(uniqueId);
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
                                console.error('Anti-out error:', err);
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

            if (event?.logMessageType === 'log:thread-name' && botState.lockedGroups[threadID]) {
                const lockedName = botState.lockedGroups[threadID];
                api.setTitle(lockedName, threadID, (err) => {
                    if (err) {
                        api.sendMessage('⚠️ Failed to restore group name.', threadID);
                        console.error('Group name lock error:', err);
                    } else {
                        api.sendMessage(`🔒 Group name restored to: ${lockedName}`, threadID);
                    }
                });
            }
        });
    } catch (e) {
        console.error(`listenMqtt setup error for uniqueId ${uniqueId}:`, e.stack);
        broadcast({ type: 'error', message: `listenMqtt setup error for uniqueId ${uniqueId}: ${e.message}`, uniqueId });
    }
}

const server = app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});

let wss = new WebSocket.Server({ server });

wss.on('error', (err) => {
    console.error('WebSocket server error:', err.stack);
});

wss.on('connection', (ws, req) => {
    const query = url.parse(req.url, true).query;
    let uniqueId = query.uniqueId || crypto.randomBytes(8).toString('hex');
    console.log(`WebSocket client connected with uniqueId ${uniqueId}`);
    broadcast({ type: 'log', message: `WebSocket client connected with uniqueId ${uniqueId}`, uniqueId });

    ws.uniqueId = uniqueId;

    ws.on('error', (err) => {
        console.error(`WebSocket connection error for uniqueId ${uniqueId}:`, err.stack);
        broadcast({ type: 'error', message: `WebSocket connection error for uniqueId ${uniqueId}: ${err.message}`, uniqueId });
    });

    ws.send(JSON.stringify({
        type: 'settings',
        autoSpamAccept: botConfig.autoSpamAccept,
        autoMessageAccept: botConfig.autoMessageAccept,
        autoConvo: botState.autoConvo,
        uniqueId
    }));

    const activeSessions = Object.keys(botState.sessions);
    ws.send(JSON.stringify({ type: 'activeSessions', sessions: activeSessions }));

    ws.on('message', (message) => {
        try {
            const data = JSON.parse(message);
            console.log('WebSocket message received:', data);
            broadcast({ type: 'log', message: `WebSocket message received for uniqueId ${uniqueId}: ${JSON.stringify(data)}`, uniqueId });

            const targetUniqueId = data.uniqueId || uniqueId;

            if (data.type === 'start') {
                broadcast({ type: 'log', message: `Starting bot for uniqueId ${targetUniqueId}` });
                startBot(targetUniqueId, data.cookieContent, data.prefix, data.adminId);
            } else if (data.type === 'stop') {
                if (botState.sessions[targetUniqueId]) {
                    stopBot(targetUniqueId);
                    ws.send(JSON.stringify({ type: 'log', message: `Bot stopped for uniqueId ${targetUniqueId}`, uniqueId: targetUniqueId }));
                    ws.send(JSON.stringify({ type: 'status', uniqueId: targetUniqueId, running: false }));
                } else {
                    ws.send(JSON.stringify({ type: 'log', message: `No active session for uniqueId ${targetUniqueId}`, uniqueId: targetUniqueId }));
                }
            } else if (data.type === 'checkStatus') {
                const running = !!botState.sessions[targetUniqueId];
                ws.send(JSON.stringify({ type: 'status', uniqueId: targetUniqueId, running }));
                broadcast({ type: 'log', message: `Status check for uniqueId ${targetUniqueId}: ${running ? 'Running' : 'Not running'}`, uniqueId: targetUniqueId });
            } else if (data.type === 'uploadAbuse') {
                try {
                    fs.writeFileSync('abuse.txt', data.content);
                    broadcast({ type: 'log', message: 'Abuse messages updated successfully', uniqueId: targetUniqueId });
                } catch (err) {
                    ws.send(JSON.stringify({ type: 'error', message: `Failed to update abuse messages: ${err.message}`, uniqueId: targetUniqueId }));
                }
            } else if (data.type === 'saveWelcome') {
                try {
                    fs.writeFileSync('welcome.txt', data.content);
                    botState.welcomeMessages = loadWelcomeMessages();
                    broadcast({ type: 'log', message: 'Welcome messages updated successfully', uniqueId: targetUniqueId });
                } catch (err) {
                    ws.send(JSON.stringify({ type: 'error', message: `Failed to update welcome messages: ${err.message}`, uniqueId: targetUniqueId }));
                }
            }
        } catch (err) {
            console.error('WebSocket message error:', err.stack);
            ws.send(JSON.stringify({ type: 'error', message: `Error processing WebSocket message: ${err.message}`, uniqueId }));
            broadcast({ type: 'error', message: `WebSocket message error for uniqueId ${uniqueId}: ${err.message}`, uniqueId });
        }
    });

    ws.on('close', () => {
        console.log(`WebSocket client disconnected for uniqueId ${uniqueId}`);
        broadcast({ type: 'log', message: `WebSocket client disconnected for uniqueId ${uniqueId}`, uniqueId });
        // Do not stop bot session on WebSocket disconnect
    });
});
