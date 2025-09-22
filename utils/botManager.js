const fs = require('fs');
const wiegine = require('fca-mafiya');
const { loadAbuseMessages, loadWelcomeMessages, saveFile } = require('./fileUtils');
const messageStore = require('./messageStore');
const { LEARNED_RESPONSES_PATH } = require('../config/constants');

function startBot(userId, cookieContent, prefix, adminID, botState, eventHandler) {
    console.log(`[BOT-MANAGER] Starting bot for user ${userId}`);
    
    if (botState.sessions[userId]) {
        stopBot(userId, botState);
    }

    botState.sessions[userId] = {
        running: true,
        prefix: prefix || '#',
        adminID: adminID || '',
        api: null,
        cookieContent,
        botConfig: { autoSpamAccept: false, autoMessageAccept: false, antiOut: true },
        manualStop: false,
        safeMode: false
    };

    if (!botState.learnedResponses[userId]) {
        botState.learnedResponses[userId] = { triggers: [] };
        try {
            fs.writeFileSync(LEARNED_RESPONSES_PATH, JSON.stringify(botState.learnedResponses, null, 2), 'utf8');
        } catch (err) {
            console.error(`Error saving learned_responses: ${err.message}`);
        }
    }

    loginBot(userId, cookieContent, botState, eventHandler);
}

function loginBot(userId, cookieContent, botState, eventHandler) {
    if (botState.sessions[userId]?.manualStop) {
        console.log(`[BOT-MANAGER] Manual stop detected for ${userId}, no login attempt`);
        return;
    }

    try {
        const cookieFile = `cookies_${userId}.txt`;
        if (!fs.existsSync(cookieFile)) {
            fs.writeFileSync(cookieFile, cookieContent, 'utf8');
        }

        wiegine.login(cookieContent, {}, (err, api) => {
            if (err || !api) {
                console.error(`[BOT-MANAGER] Login failed for user ${userId}:`, err?.message || err);
                handleLoginFailure(userId, botState);
                return;
            }

            handleLoginSuccess(userId, api, botState, eventHandler);
        });
    } catch (err) {
        console.error(`[BOT-MANAGER] Login error for ${userId}:`, err.message);
        handleLoginFailure(userId, botState);
    }
}

function handleLoginSuccess(userId, api, botState, eventHandler) {
    botState.sessions[userId].api = api;
    botState.sessions[userId].botID = api.getCurrentUserID();
    botState.sessions[userId].safeMode = false;
    botState.sessions[userId].running = true;

    api.setOptions({ listenEvents: true, autoMarkRead: true });

    // Load messages
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

    console.log(`[BOT-MANAGER] Bot ${userId} logged in successfully`);
    startEventListener(api, userId, botState, eventHandler);
}

function handleLoginFailure(userId, botState) {
    botState.sessions[userId].safeMode = true;
    botState.sessions[userId].running = true;
    botState.sessions[userId].api = null;
    console.log(`[BOT-MANAGER] Bot ${userId} switched to SAFE MODE`);
}

function startEventListener(api, userId, botState, eventHandler) {
    const userRateLimits = {};

    // Cleanup interval
    setInterval(() => {
        cleanupMemory(botState, userRateLimits);
    }, 300000);

    api.listenMqtt(async (err, event) => {
        if (err) {
            console.error(`[BOT-MANAGER] Listen error for ${userId}:`, err?.message || err);
            botState.sessions[userId].safeMode = true;
            return;
        }

        // Event handler ko call karo
        eventHandler(api, event, botState, userId);
    });
}

function cleanupMemory(botState, userRateLimits) {
    // Event processed cleanup
    if (Object.keys(botState.eventProcessed).length > 0) {
        Object.keys(botState.eventProcessed).forEach(messageID => {
            if (Date.now() - botState.eventProcessed[messageID].timestamp > 60000) {
                delete botState.eventProcessed[messageID];
            }
        });
    }

    // User rate limits cleanup
    if (Object.keys(userRateLimits).length > 0) {
        Object.keys(userRateLimits).forEach(user => delete userRateLimits[user]);
    }

    // Roast cooldowns cleanup
    Object.keys(botState.roastCooldowns).forEach(senderID => {
        if (Date.now() - botState.roastCooldowns[senderID] > 60000) {
            delete botState.roastCooldowns[senderID];
        }
    });

    // Command cooldowns cleanup
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

    console.log('[BOT-MANAGER] Memory cleanup completed');
}

function stopBot(userId, botState) {
    console.log(`[BOT-MANAGER] Stopping bot for user ${userId}`);
    
    if (!botState.sessions[userId]) {
        console.log(`[BOT-MANAGER] No active session for user ${userId}`);
        return;
    }

    botState.sessions[userId].manualStop = true;

    // Cleanup learned responses
    if (botState.learnedResponses[userId]) {
        delete botState.learnedResponses[userId];
        try {
            fs.writeFileSync(LEARNED_RESPONSES_PATH, JSON.stringify(botState.learnedResponses, null, 2), 'utf8');
            console.log(`[BOT-MANAGER] Deleted learned responses for user ${userId}`);
        } catch (err) {
            console.error(`[BOT-MANAGER] Error saving after delete: ${err.message}`);
        }
    }

    // Logout API
    if (botState.sessions[userId].api) {
        try {
            botState.sessions[userId].api.logout(() => {
                console.log(`[BOT-MANAGER] API logout for user ${userId}`);
            });
        } catch (err) {
            console.error(`[BOT-MANAGER] Logout error: ${err.message}`);
        }
        botState.sessions[userId].api = null;
    }

    delete botState.sessions[userId];
    console.log(`[BOT-MANAGER] Bot stopped for user ${userId}`);
}

module.exports = {
    startBot,
    stopBot
};
