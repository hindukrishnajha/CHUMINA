// botManager.js - Fixed version
// Added logging for API login and errors. No other changes to avoid new bugs.

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
        safeMode: false
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
        console.log('[DEBUG] Attempting login for user:', userId);
        wiegine.login(JSON.parse(cookieContent), {}, (err, api) => {
            if (err || !api) {
                console.error('[ERROR] API login failed:', err?.message || 'No API object');
                botState.sessions[userId].safeMode = true;
                
                // Safe mode status update
                if (wss) {
                    wss.clients.forEach(client => {
                        if (client.readyState === WebSocket.OPEN) {
                            client.send(JSON.stringify({
                                type: 'status',
                                userId: userId,
                                running: true,
                                safeMode: true
                            }));
                            client.send(JSON.stringify({
                                type: 'log',
                                message: `Safe mode activated for ${userId}: ${err?.message || 'No API'}`
                            }));
                        }
                    });
                }
                return;
            }

            console.log('[DEBUG] API login successful, botID:', api.getCurrentUserID());
            botState.sessions[userId].api = api;
            botState.sessions[userId].botID = api.getCurrentUserID();
            api.setOptions({ listenEvents: true, autoMarkRead: true });

            // Successful login update
            if (wss) {
                wss.clients.forEach(client => {
                    if (client.readyState === WebSocket.OPEN) {
                        client.send(JSON.stringify({
                            type: 'log',
                            message: `Login successful for ${userId}`
                        }));
                    }
                });
            }

            startEventListener(api, userId, botState, eventHandler, wss);
        });
    } catch (err) {
        console.error('[ERROR] Login attempt failed:', err.message);
        botState.sessions[userId].safeMode = true;
        
        if (wss) {
            wss.clients.forEach(client => {
                if (client.readyState === WebSocket.OPEN) {
                    client.send(JSON.stringify({
                        type: 'status',
                        userId: userId,
                        running: true,
                        safeMode: true
                    }));
                }
            });
        }
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
            
            // Error status update
            if (wss) {
                wss.clients.forEach(client => {
                    if (client.readyState === WebSocket.OPEN) {
                        client.send(JSON.stringify({
                            type: 'status',
                            userId: userId,
                            running: true,
                            safeMode: true
                        }));
                        client.send(JSON.stringify({
                            type: 'log',
                            message: `Event listener error for ${userId}`
                        }));
                    }
                });
            }
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
    
    // Stop status update
    if (wss) {
        wss.clients.forEach(client => {
            if (client.readyState === WebSocket.OPEN) {
                client.send(JSON.stringify({
                    type: 'status',
                    userId: userId,
                    running: false,
                    safeMode: false
                }));
                client.send(JSON.stringify({
                    type: 'log',
                    message: `Bot stopped for user ${userId}`
                }));
            }
        });
    }
    
    delete botState.sessions[userId];
}

module.exports = { startBot, stopBot };
