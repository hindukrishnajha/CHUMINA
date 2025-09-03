require('dotenv').config();
const fs = require('fs');
const path = require('path');
const express = require('express');
const wiegine = require('fca-mafiya');
const WebSocket = require('ws');

// Load configurations
const botConfig = require('./config/botConfig');
const botState = require('./config/botState');
const constants = require('./config/constants');

// Load utilities
const broadcast = require('./utils/broadcast');
const fileUtils = require('./utils/fileUtils');
const nicknameUtils = require('./utils/nicknameUtils');

// Load responses
const adminTagReplies = require('./responses/adminTagReplies');
const autoreplies = require('./responses/autoreplies');
const favoriteStickers = require('./responses/favoriteStickers');
const goodbye = require('./responses/goodbye');
const randomBotReplies = require('./responses/randomBotReplies');
const welcome = require('./responses/welcome');

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 3000;

// Serve static files (like index.html)
app.use(express.static(path.join(__dirname)));

// Health Check Endpoint (Required for Render)
app.get('/health', (req, res) => {
    res.status(200).json({
        status: 'active',
        bot: 'शेलेन्द्र हिन्दू का गुलाम बोट राम इंडिया एफ',
        version: '10.0.0'
    });
});

// Command handler object
const commands = {};

// Load commands dynamically from subfolders
const commandFolders = ['admin', 'master', 'user'];
commandFolders.forEach(folder => {
    const commandPath = path.join(__dirname, 'commands', folder);
    fs.readdirSync(commandPath).forEach(file => {
        if (file.endsWith('.js')) {
            const commandName = file.split('.')[0];
            commands[commandName] = require(path.join(commandPath, file));
            console.log(`Loaded command: ${commandName} from ${folder}`);
        }
    });
});

// Load standalone help command
commands.help = require('./commands/help');

// Start Express server
const server = app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});

// Initialize WebSocket server for wss://shalender-hindu-ka-bot-of7n.onrender.com
const wss = new WebSocket.Server({ server });
global.wss = wss; // Store wss globally for broadcast utility

wss.on('connection', (ws) => {
    console.log('WebSocket client connected to wss://shalender-hindu-ka-bot-of7n.onrender.com');
    ws.send(JSON.stringify({
        type: 'settings',
        autoSpamAccept: botConfig.autoSpamAccept,
        autoMessageAccept: botConfig.autoMessageAccept,
        autoConvo: botState.autoConvo
    }));

    // Send list of active userIds on connection
    const activeUsers = Object.keys(botState.sessions);
    ws.send(JSON.stringify({ type: 'activeUsers', users: activeUsers }));

    ws.on('message', async (message) => {
        try {
            const data = JSON.parse(message);

            if (data.type === 'start') {
                const startBot = require('./utils/startBot');
                await startBot(data.userId, data.cookieContent, data.prefix, data.adminId, ws, commands);
            } else if (data.type === 'stop') {
                const stopBot = require('./utils/stopBot');
                if (data.userId && botState.sessions[data.userId]) {
                    await stopBot(data.userId, ws);
                    ws.send(JSON.stringify({ type: 'log', message: `Bot stopped for user ${data.userId}`, userId: data.userId }));
                    ws.send(JSON.stringify({ type: 'status', userId: data.userId, running: false }));
                } else {
                    ws.send(JSON.stringify({ type: 'log', message: `No active session for user ${data.userId}`, userId: data.userId }));
                }
            } else if (data.type === 'checkStatus') {
                const userId = data.userId;
                const running = !!botState.sessions[userId];
                ws.send(JSON.stringify({ type: 'status', userId, running }));
            } else if (data.type === 'uploadAbuse') {
                fileUtils.saveAbuse(data.content);
                ws.send(JSON.stringify({ type: 'log', message: 'Abuse messages updated successfully' }));
            } else if (data.type === 'saveWelcome') {
                fileUtils.saveWelcome(data.content);
                ws.send(JSON.stringify({ type: 'log', message: 'Welcome messages updated successfully' }));
            }
        } catch (err) {
            console.error('WebSocket message error:', err);
            ws.send(JSON.stringify({ type: 'log', message: `Error processing WebSocket message: ${err.message}` }));
        }
    });

    ws.on('error', (err) => {
        console.error('WebSocket error:', err);
    });

    ws.on('close', () => {
        console.log('WebSocket client disconnected from wss://shalender-hindu-ka-bot-of7n.onrender.com');
    });
});

// Load environment variables for default files (if any)
fileUtils.loadDefaultFiles();

// Load learned responses
fileUtils.loadLearnedResponses();

// Restart active sessions if any
Object.keys(botState.sessions).forEach(userId => {
    if (botState.sessions[userId].running) {
        const startBot = require('./utils/startBot');
        startBot(userId, null, botState.sessions[userId].prefix, botState.sessions[userId].adminID, null, commands);
    }
});
