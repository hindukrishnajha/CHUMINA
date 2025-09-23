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
        wiegine.login(cookieContent, {}, (err, api) => {
            if (err || !api) {
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
                                message: `Safe mode activated for ${userId}`
                            }));
                        }
                    });
                }
                return;
            }

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

            startEventListener(api, userId, botState, eventHandler);
        });
    } catch (err) {
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
