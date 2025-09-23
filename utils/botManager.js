const fs = require('fs');
const wiegine = require('fca-mafiya');
const { loadAbuseMessages, loadWelcomeMessages } = require('./fileUtils');
const messageStore = require('./messageStore');
const { LEARNED_RESPONSES_PATH } = require('../config/constants');

function startBot(userId, cookieContent, prefix, adminID, botState, eventHandler) {
    console.log(`Starting bot for ${userId}`);
    
    if (botState.sessions[userId]) {
        stopBot(userId, botState);
    }

    botState.sessions[userId] = {
        running: true,
        prefix: prefix || '#',
        adminID: adminID || '',
        api: null,
        cookieContent,
        manualStop: false,
        safeMode: false
    };

    loginBot(userId, cookieContent, botState, eventHandler);
}

function loginBot(userId, cookieContent, botState, eventHandler) {
    if (botState.sessions[userId]?.manualStop) return;

    try {
        wiegine.login(cookieContent, {}, (err, api) => {
            if (err || !api) {
                botState.sessions[userId].safeMode = true;
                return;
            }

            botState.sessions[userId].api = api;
            botState.sessions[userId].botID = api.getCurrentUserID();
            api.setOptions({ listenEvents: true, autoMarkRead: true });

            startEventListener(api, userId, botState, eventHandler);
        });
    } catch (err) {
        botState.sessions[userId].safeMode = true;
    }
}

function startEventListener(api, userId, botState, eventHandler) {
    // Memory cleanup every 5 minutes
    setInterval(() => {
        if (Object.keys(botState.eventProcessed).length > 1000) {
            botState.eventProcessed = {};
        }
    }, 300000);

    api.listenMqtt((err, event) => {
        if (err) {
            botState.sessions[userId].safeMode = true;
            return;
        }
        eventHandler(api, event, botState, userId);
    });
}

function stopBot(userId, botState) {
    if (!botState.sessions[userId]) return;

    botState.sessions[userId].manualStop = true;
    
    if (botState.sessions[userId].api) {
        try {
            botState.sessions[userId].api.logout(() => {});
        } catch (err) {}
    }
    
    delete botState.sessions[userId];
}

module.exports = { startBot, stopBot };
