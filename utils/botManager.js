const fs = require('fs');
const wiegine = require('fca-mafiya');
const { loadAbuseMessages, loadWelcomeMessages } = require('./fileUtils');
const messageStore = require('./messageStore');
const { LEARNED_RESPONSES_PATH } = require('../config/constants');
const WebSocket = require('ws');

function startBot(userId, cookieContent, prefix, adminID, botState, eventHandler, wss) {
    console.log(`Starting bot for ${userId}`);
    
    if (botState.sessions[userId]) {
        stopBot(userId, botState, wss);
    }

    botState.sessions[userId] = {
        running: true,
        prefix: prefix || '#',
        adminID: adminID || '',
        api: null,
        cookieContent,
        manualStop: false,
        safeMode: false,
        botID: null
    };

    // WebSocket को status update भेजें
    if (wss) {
        wss.clients.forEach(client => {
            if (client.readyState === WebSocket.OPEN) {
                client.send(JSON.stringify({
                    type: 'status',
                    userId: userId,
                    running: true,
                    safeMode: false
                }));
                client.send(JSON.stringify({
                    type: 'log', 
                    message: `Bot started for user ${userId}`
                }));
            }
        });
    }

    loginBot(userId, cookieContent, botState, eventHandler, wss);
}

function loginBot(userId, cookieContent, botState, eventHandler, wss) {
    if (botState.sessions[userId]?.manualStop) return;

    try {
        wiegine.login(cookieContent, {}, (err, api) => {
            if (err || !api) {
                botState.sessions[userId].safeMode = true;
                sendWsStatus(wss, userId, true, true, `Safe mode activated for ${userId}`);
                return;
            }

            // ✅ पहले wrap करो फिर botID set करो
            const currentUserID = api.getCurrentUserID();
            api = messageStore.wrapApi(api, currentUserID);

            botState.sessions[userId].api = api;
            botState.sessions[userId].botID = currentUserID;

            api.setOptions({ listenEvents: true, autoMarkRead: true });

            sendWsStatus(wss, userId, true, false, `Login successful for ${userId}`);

            startEventListener(api, userId, botState, eventHandler, wss);
        });
    } catch (err) {
        botState.sessions[userId].safeMode = true;
        sendWsStatus(wss, userId, true, true, `Login exception for ${userId}`);
    }
}

function startEventListener(api, userId, botState, eventHandler, wss) {
    // Memory cleanup every 5 minutes
    setInterval(() => {
        if (Object.keys(botState.eventProcessed).length > 1000) {
            botState.eventProcessed = {};
        }
    }, 300000);

    api.listenMqtt((err, event) => {
        if (err) {
            botState.sessions[userId].safeMode = true;
            sendWsStatus(wss, userId, true, true, `Event listener error for ${userId}`);
            return;
        }
        eventHandler(api, event, botState, userId);
    });
}

function stopBot(userId, botState, wss) {
    if (!botState.sessions[userId]) return;

    botState.sessions[userId].manualStop = true;
    
    if (botState.sessions[userId].api) {
        try {
            botState.sessions[userId].api.logout(() => {});
        } catch (err) {}
    }
    
    sendWsStatus(wss, userId, false, false, `Bot stopped for user ${userId}`);
    delete botState.sessions[userId];
}

// Helper for WebSocket status updates
function sendWsStatus(wss, userId, running, safeMode, logMessage) {
    if (!wss) return;
    wss.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify({
                type: 'status',
                userId,
                running,
                safeMode
            }));
            client.send(JSON.stringify({
                type: 'log',
                message: logMessage
            }));
        }
    });
}

module.exports = { startBot, stopBot };
