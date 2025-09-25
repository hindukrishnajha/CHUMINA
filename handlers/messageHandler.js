// ./handlers/messageHandler.js
const commandHandler = require('./commandHandler');
const messageStore = require('../utils/messageStore');
const { getAIResponse } = require('../utils/aichat');
const { MASTER_ID } = require('../config/constants');

// Import response files
const autoreplies = require('../responses/autoreplies').autoreplies;
const masterReplies = require('../responses/masterReplies');
const adminTagReplies = require('../responses/adminTagReplies').adminTagReplies;

function handleMessage(api, event, botState, userId) {
    const senderID = event.senderID || event.author || null;
    const isMaster = senderID === MASTER_ID;
    const isAdmin = Array.isArray(botState.adminList) && (botState.adminList.includes(senderID) || isMaster);
    const threadID = event.threadID;
    const messageID = event.messageID;
    const content = event.body ? event.body.trim() : '';
    const botID = botState.sessions[userId]?.botID;

    console.log(`[MESSAGE] From: ${senderID}, Content: ${content}`);

    // Muted users check
    if (botState.mutedUsers && botState.mutedUsers[threadID] && botState.mutedUsers[threadID].includes(senderID)) {
        console.log(`[MUTE] Ignoring message from muted user ${senderID}`);
        return;
    }

    // Store message
    const attachment = event.attachments && event.attachments.length > 0 ? event.attachments[0] : null;
    messageStore.storeMessage(messageID, content, senderID, threadID, attachment);

    // Master reactions
    if (isMaster && event.type === 'message') {
        api.setMessageReaction('😍', messageID, (err) => {});
    }

    // Command handling
    if (content.startsWith(botState.sessions[userId]?.prefix || '#')) {
        return commandHandler.handleCommand(api, event, botState, userId);
    }

    // AI chat handling
    if (content.toLowerCase().startsWith('#ai') || content.toLowerCase().startsWith('@ai')) {
        return handleAIChat(api, event, botState, userId);
    }

    // Auto-replies handling (MAIN FIX)
    handleAutoReplies(api, event, botState, userId);
}

async function handleAIChat(api, event, botState, userId) {
    const threadID = event.threadID;
    const messageID = event.messageID;
    const content = event.body || '';
    
    if (botState.chatEnabled[threadID] !== true) {
        api.sendMessage('❌ मालिक, चैट ऑफ है! पहले #chat on करो। 🕉️', threadID, messageID);
        return;
    }

    const userMessage = content.replace(/#ai|@ai/gi, '').trim();
    const groqResponse = await getAIResponse(userMessage || 'अरे भाई, कुछ मस्ती करो ना! 😎');
    api.sendMessage(groqResponse, threadID, messageID);
}

function handleAutoReplies(api, event, botState, userId) {
    const content = event.body ? event.body.toLowerCase() : '';
    const threadID = event.threadID;
    const senderID = event.senderID;

    // Skip messages starting with # (commands)
    if (content.startsWith(botState.sessions[userId]?.prefix || '#')) return;

    // Skip if message is empty or too short
    if (!content || content.length < 2) return;

    console.log(`[AUTO-REPLY] Checking: "${content}"`);

    // 1. First check masterReplies (if sender is master)
    if (senderID === MASTER_ID) {
        for (const [trigger, replies] of Object.entries(masterReplies)) {
            if (content.includes(trigger.toLowerCase())) {
                const reply = Array.isArray(replies) ? replies[Math.floor(Math.random() * replies.length)] : replies;
                api.sendMessage(reply, threadID);
                console.log(`[MASTER-REPLY] Triggered: ${trigger}`);
                return;
            }
        }
    }

    // 2. Check admin tag replies (when master tags admin)
    if (senderID === MASTER_ID && event.mentions) {
        const mentionedIDs = Object.keys(event.mentions);
        const isAdminMention = mentionedIDs.some(id => 
            botState.adminList && botState.adminList.includes(id)
        );
        
        if (isAdminMention && adminTagReplies.length > 0) {
            const reply = adminTagReplies[Math.floor(Math.random() * adminTagReplies.length)];
            api.sendMessage(reply, threadID);
            console.log('[ADMIN-TAG] Reply sent');
            return;
        }
    }

    // 3. Check general autoreplies
    for (const [trigger, replies] of Object.entries(autoreplies)) {
        if (content.includes(trigger.toLowerCase())) {
            let reply;
            if (Array.isArray(replies)) {
                reply = replies[Math.floor(Math.random() * replies.length)];
            } else {
                reply = replies; // For single string replies like "good morning"
            }
            
            api.sendMessage(reply, threadID);
            console.log(`[AUTO-REPLY] Triggered: ${trigger}`);
            return; // Only one reply per message
        }
    }

    // 4. Check learned responses
    if (botState.learnedResponses) {
        for (const [user, data] of Object.entries(botState.learnedResponses)) {
            if (data.triggers) {
                for (const triggerObj of data.triggers) {
                    if (content.includes(triggerObj.trigger.toLowerCase())) {
                        const reply = triggerObj.responses[Math.floor(Math.random() * triggerObj.responses.length)];
                        api.sendMessage(reply, threadID);
                        console.log(`[LEARNED] Triggered: ${triggerObj.trigger}`);
                        return;
                    }
                }
            }
        }
    }
}

function handleGroupNameChange(api, event, botState) {
    const threadID = event.threadID;
    if (botState.lockedGroups[threadID]) {
        const lockedName = botState.lockedGroups[threadID];
        api.setTitle(lockedName, threadID, (err) => {
            if (err) {
                console.error(`[ERROR] Failed to restore group name: ${err.message}`);
            } else {
                api.sendMessage(`🔒 ग्रुप नाम रिस्टोर किया गया: ${lockedName} 🕉️`, threadID);
            }
        });
    }
}

function handleNicknameChange(api, event, botState, userId) {
    const changedUserID = event.logMessageData.participant_id;
    const threadID = event.threadID;
    
    if (!changedUserID || changedUserID === botState.sessions[userId]?.botID) {
        return;
    }

    console.log(`[NICKNAME] Change detected for user ${changedUserID} in thread ${threadID}`);
}

module.exports = {
    handleMessage,
    handleGroupNameChange,
    handleNicknameChange
};
