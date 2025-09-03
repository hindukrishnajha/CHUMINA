require('dotenv').config();
const fs = require('fs');
const path = require('path');
const express = require('express');
const wiegine = require('fca-mafiya');
const WebSocket = require('ws');
const url = require('url');

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
const PORT = process.env.PORT || 10000;

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

// Keep-alive ping to prevent server sleep on Render
setInterval(() => {
    console.log(`Keep-alive ping: Bot running at ${new Date().toISOString()}`);
}, 300000); // 5 minutes

// Load learned responses with robust validation
let learnedResponses = { triggers: [], adminList: [constants.MASTER_ID] };
try {
    if (fs.existsSync(constants.LEARNED_RESPONSES_PATH)) {
        const rawData = fs.readFileSync(constants.LEARNED_RESPONSES_PATH, 'utf8');
        if (rawData.trim()) {
            try {
                learnedResponses = JSON.parse(rawData);
                if (!learnedResponses.triggers || !Array.isArray(learnedResponses.triggers) || 
                    !learnedResponses.adminList || !Array.isArray(learnedResponses.adminList)) {
                    throw new Error('Invalid learned_responses.json structure');
                }
                botState.adminList = learnedResponses.adminList || [constants.MASTER_ID];
                console.log('Loaded learned_responses.json successfully');
            } catch (err) {
                console.error('Error parsing learned_responses.json:', err.message);
                console.warn('Resetting to default learned_responses');
                learnedResponses = { triggers: [], adminList: [constants.MASTER_ID] };
                fs.writeFileSync(constants.LEARNED_RESPONSES_PATH, JSON.stringify(learnedResponses, null, 2));
            }
        } else {
            console.warn('learned_responses.json is empty, resetting to default');
            fs.writeFileSync(constants.LEARNED_RESPONSES_PATH, JSON.stringify(learnedResponses, null, 2));
        }
    } else {
        console.warn('learned_responses.json not found, creating default file');
        fs.writeFileSync(constants.LEARNED_RESPONSES_PATH, JSON.stringify(learnedResponses, null, 2));
    }
} catch (err) {
    console.error('Error accessing learned_responses.json:', err.message);
    console.warn('Resetting to default learned_responses');
    fs.writeFileSync(constants.LEARNED_RESPONSES_PATH, JSON.stringify(learnedResponses, null, 2));
}

// Load environment variables for default files (if available)
if (typeof fileUtils.loadDefaultFiles === 'function') {
    try {
        fileUtils.loadDefaultFiles();
    } catch (err) {
        console.error('Error calling loadDefaultFiles:', err.message);
        broadcast({ type: 'error', message: `Error loading default files: ${err.message}` });
    }
} else {
    console.warn('fileUtils.loadDefaultFiles is not defined, skipping...');
    // Fallback: Load default cookies if COOKIE_BASE64 exists
    if (process.env.COOKIE_BASE64) {
        try {
            const cookieContent = Buffer.from(process.env.COOKIE_BASE64, 'base64').toString('utf-8');
            fs.writeFileSync('cookies_default.txt', cookieContent);
            console.log('Default cookie file created from environment variable');
            broadcast({ type: 'log', message: 'Default cookie file created from environment variable' });
        } catch (err) {
            console.error('Error creating default cookie file:', err.message);
            broadcast({ type: 'error', message: `Error creating default cookie file: ${err.message}` });
        }
    }
}

// Command handler object
const commands = {};

// Load commands dynamically from subfolders
const commandFolders = ['admin', 'master', 'user'];
commandFolders.forEach(folder => {
    const commandPath = path.join(__dirname, 'commands', folder);
    try {
        fs.readdirSync(commandPath).forEach(file => {
            if (file.endsWith('.js')) {
                const commandName = file.split('.')[0];
                commands[commandName] = require(path.join(commandPath, file));
                console.log(`Loaded command: ${commandName} from ${folder}`);
            }
        });
    } catch (err) {
        console.error(`Error loading commands from ${folder}:`, err.message);
    }
});

// Load standalone help command
try {
    commands.help = require('./commands/help');
    console.log('Loaded command: help');
} catch (err) {
    console.error('Error loading help command:', err.message);
}

// Start Express server
const server = app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});

// Initialize WebSocket server for wss://shalender-hindu-ka-bot-of7n.onrender.com
const wss = new WebSocket.Server({ server });
global.wss = wss; // Store wss globally for broadcast utility

wss.on('connection', (ws, req) => {
    const query = url.parse(req.url, true).query;
    const userId = query.userId || 'unknown';
    console.log(`WebSocket client connected to wss://shalender-hindu-ka-bot-of7n.onrender.com with user ${userId}`);
    broadcast({ type: 'log', message: `WebSocket client connected with user ${userId}`, userId });

    ws.userId = userId; // Attach userId to WebSocket instance

    ws.send(JSON.stringify({
        type: 'settings',
        autoSpamAccept: botConfig.autoSpamAccept,
        autoMessageAccept: botConfig.autoMessageAccept,
        autoConvo: botState.autoConvo,
        userId
    }));

    const activeUsers = Object.keys(botState.sessions);
    ws.send(JSON.stringify({ type: 'activeUsers', users: activeUsers }));

    ws.on('message', async (message) => {
        try {
            const data = JSON.parse(message);
            console.log('WebSocket message received:', data);
            broadcast({ type: 'log', message: `WebSocket message received for user ${userId}: ${JSON.stringify(data)}`, userId });

            if (data.type === 'start') {
                const startBot = require('./utils/startBot');
                await startBot(data.userId || userId, data.cookieContent, data.prefix, data.adminId, ws, commands);
            } else if (data.type === 'stop') {
                const stopBot = require('./utils/stopBot');
                const targetUserId = data.userId || userId;
                if (botState.sessions[targetUserId]) {
                    await stopBot(targetUserId, ws);
                    ws.send(JSON.stringify({ type: 'log', message: `Bot stopped for user ${targetUserId}`, userId: targetUserId }));
                    ws.send(JSON.stringify({ type: 'status', userId: targetUserId, running: false }));
                } else {
                    ws.send(JSON.stringify({ type: 'log', message: `No active session for user ${targetUserId}`, userId: targetUserId }));
                }
            } else if (data.type === 'checkStatus') {
                const targetUserId = data.userId || userId;
                const running = !!botState.sessions[targetUserId];
                ws.send(JSON.stringify({ type: 'status', userId: targetUserId, running }));
                broadcast({ type: 'log', message: `Status check for user ${targetUserId}: ${running ? 'Running' : 'Not running'}`, userId: targetUserId });
            } else if (data.type === 'uploadAbuse') {
                fileUtils.saveAbuse(data.content);
                ws.send(JSON.stringify({ type: 'log', message: 'Abuse messages updated successfully', userId }));
            } else if (data.type === 'saveWelcome') {
                fileUtils.saveWelcome(data.content);
                ws.send(JSON.stringify({ type: 'log', message: 'Welcome messages updated successfully', userId }));
            }
        } catch (err) {
            console.error('WebSocket message error:', err.stack);
            ws.send(JSON.stringify({ type: 'error', message: `Error processing WebSocket message: ${err.message}`, userId }));
            broadcast({ type: 'error', message: `WebSocket message error for user ${userId}: ${err.message}`, userId });
        }
    });

    ws.on('error', (err) => {
        console.error('WebSocket error:', err.stack);
        broadcast({ type: 'error', message: `WebSocket error for user ${userId}: ${err.message}`, userId });
    });

    ws.on('close', () => {
        console.log(`WebSocket client disconnected for user ${userId}`);
        broadcast({ type: 'log', message: `WebSocket client disconnected for user ${userId}`, userId });
    });
});

// Restart active sessions if any
Object.keys(botState.sessions).forEach(userId => {
    if (botState.sessions[userId].running) {
        const startBot = require('./utils/startBot');
        startBot(userId, null, botState.sessions[userId].prefix, botState.sessions[userId].adminID, null, commands);
    }
});
