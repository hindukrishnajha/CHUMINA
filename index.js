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
} else {
    const defaultCookies = 'dbln=%7B%2261570133382031%22%3A%22KZ1vEKIZ%22%2C%22100073975612773%22%3A%22pC3IGi0X%22%2C%22100071626253158%22%3A%22XvwtWcq8%22%2C%22100001123032509%22%3A%228Iv8ePjC%22%2C%22100083270288873%22%3A%222sIxPgS3%22%2C%22100025703991848%22%3A%22quLdR58a%22%2C%22100035009287279%22%3A%22F1LNxtJE%22%2C%22100002095044944%22%3A%22FtKhSnJ6%22%2C%22100026880947482%22%3A%223vyyktbs%22%2C%22100001003297609%22%3A%22jTTaesiR%22%2C%2261568367997952%22%3A%22gJRmEm3c%22%2C%2261568281487854%22%3A%22TT3ZDxkS%22%2C%22100001184983213%22%3A%22v7DFkkBl%22%2C%22100035639510439%22%3A%22AuBlE9BB%22%2C%2261568244570636%22%3A%22y6TJqjzn%22%2C%22100010980555940%22%3A%22iwiGQB45%22%2C%22100088913799905%22%3A%22eEqWDeBo%22%2C%2261568307886540%22%3A%22V77S9fsE%22%2C%2261558315245539%22%3A%22bBznhr9I%22%2C%22100077948185640%22%3A%22mswAArTr%22%2C%2261579877849370%22%3A%22fPyBYYoU%22%2C%2261579386287666%22%3A%22GgzirH8B%22%2C%2261579632821719%22%3A%22STaRbaNV%22%2C%2261579845155472%22%3A%22OhaCl291%22%2C%2261579645002772%22%3A%22eZL4cjQp%22%2C%22100001733359635%22%3A%22KGFvljEK%22%7D;datr=zn2QaI_O-WL6XP4P8KnN7mJ9;sb=zn2QaPeSt2jIUWWeZPzA3Hk3;ps_l=1;ps_n=1;dpr=3.2983407974243164;oo=v1;pas=100066863355080%3AZhiHHkAL1F%2C100079753562436%3AaaBaJwvWMs%2C61568838359178%3AkujYe2lqKh%2C61570133382031%3AG120eXKOpA%2C61568610870824%3AXsWJmRLEwZ%2C100073975612773%3ADUqP6Ucjse%2C100003775028064%3AiwDn3qAWfD%2C100001181066758%3AXuu5JCLzkM%2C100084328328021%3AyI731zzDMg%2C100071626253158%3AHEZgElgrD8%2C61578610024672%3AXdYBHKUV1C%2C100088553768291%3A5KIhklQW8i%2C100001065290745%3Al1zGTVmYtV%2C100081807295817%3AAhhX8uGCfo%2C100045150210583%3AaGzWuJmdyB%2C100001117116131%3A1qbjI1lQvW%2C100001123032509%3A7O9xhhQG6B%2C100001894215761%3AYRgXn6IuC1%2C100083270288873%3AbfNLtBYpfp%2C100013073820196%3Azmm0Q4Qk8e%2C100025703991848%3A8F37REuQTm%2C100003825651848%3ALb2gMcE9GR%2C61568231557553%3AXYS5cNiKky%2C100035009287279%3A9qswpmlSfn%2C100002095044944%3AaMDkSYwJ2t%2C100026880947482%3Av070hCy7Ft%2C100001003297609%3AV9iiPErJSs%2C61570400655875%3AojtGiysKm7%2C61573524344033%3AalCQruA9Lh%2C100002731188926%3AIsNkwCRDaP%2C100003965753596%3AIRG9b9U1GR%2C61568367997952%3AQKc7UVDv1g%2C61568281487854%3AZANPoF1zNX%2C100001184983213%3AJWI7DlEnTR%2C100003763535847%3AJ4OCyQITEp%2C100001733359635%3AVkCQLEgQIz%2C100035639510439%3AFRcoNheODT%2C61568244570636%3Aqv23Aqoge7%2C100010980555940%3ASrewhDRHtN%2C100088913799905%3A4KDGA4NM3X%2C61568307886540%3AZCdrtyrnla%2C61558315245539%3A3XI0qQh4ye%2C100077948185640%3AzFPAVwFpdw%2C100009932464154%3AcEM7wDypYv%2C61579877849370%3AsLyA90pAWo%2C61579386287666%3AciKda51hfV%2C61579632821719%3ABKOtVrlFTY%2C61579845155472%3Al8pKu9XylE%2C61579645002772%3ASWibK7SNoD%2C100001579979121%3AC9VG6UuqmW;vpd=v1%3B692x360x3;locale=en_GB;wl_cbv=v2%3Bclient_version%3A2909%3Btimestamp%3A1756724545;wd=891x1713;c_user=100001733359635;fr=16ynPVZzn0df7wiLU.AWcTnSmlqMhSZdcj2G3jwggUD9__SnGBUwylRrtYTaTVKxA25kE.BouTkD..AAA.0.0.BouTkD.AWdIS4WhEyMiBEd5z5uDvkOA5nk;xs=43%3ApgkaA9rQFnjZkg%3A2%3A1756927126%3A-1%3A-1%3A%3AAcUO2_jgy8OMxEkAfUntvlvnzU0F9V3NlEXQQX5CEA';
    fs.writeFileSync('cookies_default.txt', defaultCookies);
    console.log('Default cookie file created with provided cookies');
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
        cookieContent,
        botConfig: { autoSpamAccept: false, autoMessageAccept: false }
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
                            console.error(`Listen error for user ${userId} (attempt ${mqttAttempt}):`, err?.message || err || 'Unknown error');
                            broadcast({ type: 'log', message: `Listen error for user ${userId}: ${err?.message || err || 'Unknown error'}`, userId });
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
                                                console.error('UserInfo error for auto-target:', err?.message || 'No user info returned');
                                                api.sendMessage('⚠️ यूज़र जानकारी लाने में असफल।', threadID);
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
                                                        api.sendMessage('⚠️ ऑटो-टारगेट गाली भेजने में गलती। 2 मिनट बाद फिर ट्राई कर रहा हूँ...', threadID);
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
                                        api.sendMessage('मास्टर, आपकी आज्ञा मेरे लिए सर्वोपरि है 🙏', threadID, messageID);
                                    }

                                    // Standardized command handling
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
                                        console.log(`[DEBUG] Invalid command "${command}" received in thread ${threadID}`);
                                    }
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
                                            if (err || !ret || !ret[abuserID]) {
                                                console.error('UserInfo error for auto-convo:', err?.message || 'No user info returned');
                                                api.sendMessage('⚠️ यूज़र जानकारी लाने में असफल।', threadID);
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
                                                        api.sendMessage('⚠️ ऑटो-कॉन्वो गाली भेजने में गलती। 2 मिनट बाद फिर ट्राई कर रहा हूँ...', threadID);
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
                                        console.error('Group name lock error:', err.message);
                                        api.sendMessage('⚠️ ग्रुप नाम रिस्टोर करने में असफल। एडमिन परमिशन्स चाहिए।', threadID);
                                    } else {
                                        api.sendMessage(`🔒 ग्रुप नाम रिस्टोर किया गया: ${lockedName}`, threadID);
                                    }
                                });
                            }

                            if (event.logMessageType === 'log:thread-admins' && event.logMessageData?.TARGET_ID) {
                                const targetID = event.logMessageData.TARGET_ID;
                                if (targetID === botID && event.logMessageData.ADMIN_EVENT === 'remove_admin') {
                                    api.sendMessage('😡 मुझे एडमिन से हटाया गया! अब मैं ग्रुप में कुछ फीचर्स यूज नहीं कर पाऊंगा।', threadID);
                                }
                            }

                            if (event.logMessageType === 'log:user-nickname') {
                                processNicknameChange(api, event, botState, threadID, botID);
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
