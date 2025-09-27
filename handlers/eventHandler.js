const messageHandler = require('./messageHandler');
const deleteHandler = require('../events/deleteHandler');
const welcomeHandler = require('../events/welcomeHandler');
const commandHandler = require('./commandHandler');
const Groq = require("groq-sdk");
const { generateResponse } = require('../commands/roast'); // Added import for generateResponse

const groq = new Groq({
    apiKey: process.env.GROQ_API_KEY
});

// Auto-roast function
async function handleAutoRoast(api, event, botState) {
    try {
        // Check if roast is enabled for this thread
        if (!botState.roastEnabled || !botState.roastEnabled[event.threadID]) {
            return false;
        }

        // Check if targeted roast
        if (botState.roastTargets && botState.roastTargets[event.threadID]) {
            if (!botState.roastTargets[event.threadID][event.senderID]) {
                return false;
            }
        }

        // 30 seconds gap check
        const now = Date.now();
        if (botState.lastRoastTime && botState.lastRoastTime[event.threadID]) {
            const timeDiff = now - botState.lastRoastTime[event.threadID];
            if (timeDiff < 30000) { // 30 seconds
                return false;
            }
        }

        // Don't roast bot's own messages
        if (event.senderID === api.getCurrentUserID()) {
            return false;
        }

        // Don't roast commands
        if (event.body && event.body.startsWith('#')) {
            return false;
        }

        // Don't roast empty messages
        if (!event.body || event.body.trim().length === 0) {
            return false;
        }

        // Check if message mentions "shalender" or similar
        const shalenderPattern = /\b(shalender|shelender)\b/i;
        const mentionsShalender = shalenderPattern.test(event.body);

        // Check if sender is master or admin
        const masterID = '100023807453349';
        const isSenderAdmin = String(event.senderID) === masterID || (Array.isArray(botState.adminList) && botState.adminList.includes(String(event.senderID)));

        // Get sender's name
        let targetName = "Unknown";
        try {
            const userInfo = await new Promise((resolve, reject) => {
                api.getUserInfo([event.senderID], (err, info) => {
                    if (err) reject(err);
                    else resolve(info);
                });
            });
            targetName = userInfo[event.senderID]?.name || "Unknown";
        } catch (e) {
            console.error("User info error:", e);
        }

        // If message mentions shalender, treat as king and support
        if (mentionsShalender) {
            const response = await generateResponse(true, event.body, targetName); // Use support mode
            api.sendMessage(`${targetName}, ${response}`, event.threadID);
            if (!botState.lastRoastTime) botState.lastRoastTime = {};
            botState.lastRoastTime[event.threadID] = now;
            return true;
        }

        // If sender is master or admin, use support mode
        if (isSenderAdmin) {
            const response = await generateResponse(true, event.body, targetName); // Use support mode
            api.sendMessage(`${targetName}, ${response}`, event.threadID);
            if (!botState.lastRoastTime) botState.lastRoastTime = {};
            botState.lastRoastTime[event.threadID] = now;
            return true;
        }

        // Roast for non-admin users
        const response = await generateResponse(false, event.body, targetName); // Use roast mode
        api.sendMessage(`${targetName}, ${response}`, event.threadID);
        
        // Update last roast time
        if (!botState.lastRoastTime) botState.lastRoastTime = {};
        botState.lastRoastTime[event.threadID] = now;
        
        return true;
    } catch (error) {
        console.error("Auto-roast error:", error);
        return false;
    }
}

function handleEvent(api, event, botState, userId) {
    try {
        console.log(`[EVENT] Type: ${event.type}, Thread: ${event.threadID}, MessageID: ${event.messageID}`);
        
        // Pehle delete events handle karo
        if (event.type === 'message_unsend') {
            return deleteHandler.handleUnsend(api, event, botState, userId);
        }
        
        // Phir message events
        if (event.type === 'message' || event.type === 'message_reply') {
            // Auto-roast check (sirf normal messages pe)
            if (event.body && !event.body.startsWith('#')) {
                handleAutoRoast(api, event, botState).catch(console.error);
            }
            
            return messageHandler.handleMessage(api, event, botState, userId);
        }
        
        // Welcome/goodbye events
        if (event.logMessageType === 'log:subscribe') {
            return welcomeHandler.handleWelcome(api, event, botState, userId);
        }
        
        if (event.logMessageType === 'log:unsubscribe') {
            return welcomeHandler.handleGoodbye(api, event, botState, userId);
        }
        
        // Group events
        if (event.logMessageType === 'log:thread-name') {
            return messageHandler.handleGroupNameChange(api, event, botState);
        }
        
        if (event.logMessageType === 'log:user-nickname') {
            return messageHandler.handleNicknameChange(api, event, botState);
        }
        
        // Ignore these events
        if (event.type === 'read_receipt' || event.type === 'presence' || event.type === 'typ') {
            return;
        }
        
    } catch (error) {
        console.error('[EVENT-ERROR] Event handling failed:', error.message);
    }
}

module.exports = handleEvent;
