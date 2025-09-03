require('dotenv').config();
const fs = require('fs');
const path = require('path');
const express = require('express');
const wiegine = require('fca-mafiya');
const WebSocket = require('ws');
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
const { handleHelp } = require('./commands/help');
const { handleMasterCommand, handleStopAll, handleStatus, handleKick, handleList, handleMasterId } = require('./commands/master');
const { handleGroupNameLock, handleNicknameLock, handleAntiOut, handleKickout, handleUnsend, handleAutoSpam, handleAutoMessage, handleLoder, handleAddAdmin, handleRemoveAdmin, handleListAdmins } = require('./commands/admin');
const { handleTid, handleUid, handleGroupInfo, handleInfo, handlePair, handleMusic, handleLearn } = require('./commands/user');

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 3000;

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
    console.error('Error loading learned_responses.json:', err);
}

function stopBot(userId) {
    if (!botState.sessions[userId]) {
        broadcast({ type: 'log', message: `No active session for user ${userId}`, userId });
        return;
    }

    Object.keys(nicknameTimers).forEach(threadID => {
        if (nicknameQueues[threadID]?.botUserId === userId) {
            clearTimeout(nicknameTimers[threadID]);
            delete nicknameTimers[threadID];
            delete nicknameQueues[threadID];
        }
    });

    Object.keys(botState.stickerSpam).forEach(threadID => {
        if (botState.stickerSpam[threadID]) {
            botState.stickerSpam[threadID].active = false;
            delete botState.stickerSpam[threadID];
        }
    });

    if (botState.sessions[userId].api) {
        try {
            botState.sessions[userId].api.logout(() => {
                console.log(`API logged out for user ${userId}`);
            });
        } catch (err) {
            console.error(`Error during logout for user ${userId}:`, err);
        }
        botState.sessions[userId].api = null;
    }

    learnedResponses.triggers = [];
    fs.writeFileSync(LEARNED_RESPONSES_PATH, JSON.stringify({ triggers: [], adminList: botState.adminList }, null, 2));

    delete botState.sessions[userId];
    console.log(`Session stopped and cleaned for user ${userId}`);
    broadcast({ type: 'log', message: `Bot stopped for user ${userId}`, userId });
    broadcast({ type: 'status', userId, running: false });
}

function startBot(userId, cookieContent, prefix, adminID) {
    if (botState.sessions[userId]) {
        stopBot(userId);
    }

    botState.sessions[userId] = {
        running: true,
        prefix: prefix || '#',
        adminID: adminID || '',
        api: null
    };

    try {
        saveCookies(userId, cookieContent);
        broadcast({ type: 'log', message: `Cookie file saved for user ${userId}`, userId });
    } catch (err) {
        broadcast({ type: 'log', message: `Failed to save cookie for user ${userId}: ${err.message}`, userId });
        botState.sessions[userId].running = false;
        return;
    }

    wiegine.login(cookieContent, {}, (err, api) => {
        if (err || !api) {
            broadcast({ type: 'log', message: `Login failed for user ${userId}: ${err?.message || err}`, userId });
            botState.sessions[userId].running = false;
            return;
        }

        botState.sessions[userId].api = api;
        broadcast({ type: 'log', message: `Bot logged in and running for user ${userId}`, userId });
        broadcast({ type: 'status', userId, running: true });

        api.setOptions({ listenEvents: true, autoMarkRead: true });

        let abuseMessages = loadAbuseMessages();
        botState.welcomeMessages = loadWelcomeMessages();

        api.listenMqtt(async (err, event) => {
            if (err) {
                broadcast({ type: 'log', message: `Listen error for user ${userId}: ${err}`, userId });
                return;
            }

            try {
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

                    for (let key in autoreplies) {
                        if (lowerMsg.includes(key.toLowerCase())) {
                            api.sendMessage(autoreplies[key], threadID, messageID);
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

                    if (event.mentions && Object.keys(event.mentions).includes(botState.sessions[userId].adminID)) {
                        const reply = adminTagReplies[Math.floor(Math.random() * adminTagReplies.length)];
                        const stickerID = favoriteStickers[Math.floor(Math.random() * favoriteStickers.length)];
                        api.sendMessage(reply, event.threadID, event.messageID);
                        api.sendMessage({ sticker: stickerID }, event.threadID);
                    }

                    const args = msg.split(' ');
                    if (msg.startsWith(botState.sessions[userId].prefix)) {
                        const command = args[0].slice(botState.sessions[userId].prefix.length).toLowerCase();
                        if (isMaster) {
                            api.sendMessage('Thanks for considering me worthy, Master! Your order is my command 🙏', threadID, messageID);
                        }

                        if (command === 'help') return handleHelp(api, threadID);
                        if (isMaster) {
                            if (command === 'mastercommand') return handleMasterCommand(api, threadID);
                            if (command === 'stopall') return handleStopAll(api, threadID, botState, stopBot);
                            if (command === 'status') return handleStatus(api, threadID, botState);
                            if (command === 'kick') return handleKick(api, threadID, args, botState, stopBot);
                            if (command === 'list') return handleList(api, threadID, botState);
                            if (command === 'addadmin') return handleAddAdmin(api, threadID, args, event, botState, learnedResponses, LEARNED_RESPONSES_PATH);
                            if (command === 'removeadmin') return handleRemoveAdmin(api, threadID, args, event, botState, learnedResponses, LEARNED_RESPONSES_PATH);
                            if (command === 'listadmins') return handleListAdmins(api, threadID, botState);
                        }
                        if (command === 'masterid') return handleMasterId(api, threadID, MASTER_FB_LINK);
                        if (command === 'learn') return handleLearn(api, threadID, msg, learnedResponses, LEARNED_RESPONSES_PATH);
                        if (isAdmin) {
                            if (command === 'groupnamelock') return handleGroupNameLock(api, threadID, args, lockedGroups);
                            if (command === 'nicknamelock') return handleNicknameLock(api, threadID, args, botID, userId, nicknameTimers, nicknameQueues, processNicknameChange);
                            if (command === 'antiout') return handleAntiOut(api, threadID, args, botConfig);
                            if (command === 'kickout') return handleKickout(api, threadID, args, event, isMaster);
                            if (command === 'unsend') return handleUnsend(api, threadID, event, isMaster);
                            if (command === 'autospam') return handleAutoSpam(api, threadID, botConfig, userId, broadcast);
                            if (command === 'automessage') return handleAutoMessage(api, threadID, botConfig, userId, broadcast);
                            if (command === 'loder') return handleLoder(api, threadID, args, event, botState, abuseMessages, MASTER_ID);
                        }
                        if (command === 'tid') return handleTid(api, threadID);
                        if (command === 'uid') return handleUid(api, threadID, args, event);
                        if (command === 'group' && args[1] === 'info') return handleGroupInfo(api, threadID, lockedGroups, nicknameQueues);
                        if (command === 'info') return handleInfo(api, threadID, args, event);
                        if (command === 'pair') return handlePair(api, threadID, botID, event);
                        if (command === 'music') return handleMusic(api, threadID, args);
                        api.sendMessage(`❌ Invalid command. Use ${botState.sessions[userId].prefix}help for list.`, threadID);
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
                        const lower = lowerMsg;
                        if (lower.includes('sorry babu') || lower.includes('sorry mikky')) {
                            delete botState.abuseTargets[threadID][event.senderID];
                            api.sendMessage('😏 ठीक है बेटा! अब तुझे नहीं गाली देंगे. बच गया तू... अगली बार संभल के!', threadID);
                            return;
                        }
                    }

                    if (lowerMsg.includes('bot') && isGroup) {
                        if (Math.random() < 0.8) {
                            setTimeout(() => {
                                api.sendMessage(randomBotReplies[Math.floor(Math.random() * randomBotReplies.length)], threadID);
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
👑 𝗖𝗿𝗲𝗮𝗧𝗲𝗱 𝗕𝗬: ✶♡⤾➝SHALENDER X..⤹✶➺🪿🫨🩷🪽`, threadID);
                        } else {
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
                    if (leftID === botID) {
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

                if (event.logMessageType === 'log:thread-name' && lockedGroups[threadID]) {
                    const lockedName = lockedGroups[threadID];
                    api.setTitle(lockedName, threadID, (err) => {
                        if (err) {
                            api.sendMessage('⚠️ Failed to restore group name.', threadID);
                            console.error('Group name lock error:', err);
                        } else {
                            api.sendMessage(`🔒 Group name restored to: ${lockedName}`, threadID);
                        }
                    });
                }
            } catch (e) {
                console.error('Event processing error:', e);
                broadcast({ type: 'log', message: `Event error for user ${userId}: ${e.message}`, userId });
            }
        });
    });
}

const server = app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});

let wss = new WebSocket.Server({ server });

wss.on('connection', (ws) => {
    console.log('WebSocket client connected');
    ws.send(JSON.stringify({
        type: 'settings',
        autoSpamAccept: botConfig.autoSpamAccept,
        autoMessageAccept: botConfig.autoMessageAccept,
        autoConvo: botState.autoConvo
    }));

    const activeUsers = Object.keys(botState.sessions);
    ws.send(JSON.stringify({ type: 'activeUsers', users: activeUsers }));

    ws.on('message', (message) => {
        try {
            const data = JSON.parse(message);
            if (data.type === 'start') {
                startBot(data.userId, data.cookieContent, data.prefix, data.adminId);
            } else if (data.type === 'stop') {
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
                const userId = data.userId;
                const running = !!botState.sessions[userId];
                ws.send(JSON.stringify({ type: 'status', userId, running }));
            } else if (data.type === 'uploadAbuse') {
                try {
                    fs.writeFileSync('abuse.txt', data.content);
                    ws.send(JSON.stringify({ type: 'log', message: 'Abuse messages updated successfully' }));
                } catch (err) {
                    ws.send(JSON.stringify({ type: 'log', message: `Failed to update abuse messages: ${err.message}` }));
                }
            } else if (data.type === 'saveWelcome') {
                try {
                    fs.writeFileSync('welcome.txt', data.content);
                    botState.welcomeMessages = data.content.split('\n')
                        .map(line => line.trim())
                        .filter(line => line.length > 0);
                    ws.send(JSON.stringify({ type: 'log', message: 'Welcome messages updated successfully' }));
                } catch (err) {
                    ws.send(JSON.stringify({ type: 'log', message: `Failed to update welcome messages: ${err.message}` }));
                }
            }
        } catch (err) {
            console.error('WebSocket message error:', err);
            ws.send(JSON.stringify({ type: 'log', message: `Error processing WebSocket message: ${err.message}` }));
        }
    });

    ws.on('close', () => {
        console.log('WebSocket client disconnected');
    });
});
