const commandHandler = require('./commandHandler');
const messageStore = require('../utils/messageStore');
const { getAIResponse } = require('../utils/aichat');
const { MASTER_ID } = require('../config/constants');

function handleMessage(api, event, botState, userId) {
    const senderID = event.senderID || event.author || null;
    const isMaster = senderID === MASTER_ID;
    const isAdmin = Array.isArray(botState.adminList) && (botState.adminList.includes(senderID) || isMaster);
    const isGroup = event.threadID !== senderID;
    const botID = botState.sessions[userId]?.botID;
    const threadID = event.threadID;
    const messageID = event.messageID;
    const content = event.body ? event.body.trim() : '';

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
    if (content.startsWith(botState.sessions[userId].prefix)) {
        return commandHandler.handleCommand(api, event, botState, userId);
    }

    // AI chat handling
    if (content.toLowerCase().startsWith('#ai') || content.toLowerCase().startsWith('@ai')) {
        return handleAIChat(api, event, botState, userId);
    }

    // Auto-replies and other message processing
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
    // Yeh aapka existing auto-reply logic yahan aayega
    // Main isko short rakha hun taki file manageable rahe
    const content = event.body ? event.body.toLowerCase() : '';
    
    // Basic auto-reply example
    if (content.includes('hello') || content.includes('hi')) {
        api.sendMessage('Hello! How can I help you?', event.threadID);
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

function handleNicknameChange(api, event, botState) {
    const changedUserID = event.logMessageData.participant_id;
    const threadID = event.threadID;
    
    if (!changedUserID || changedUserID === botState.sessions[userId]?.botID) {
        return;
    }
    
    // Nickname change handling logic yahan aayega
    console.log(`[NICKNAME] Change detected for user ${changedUserID} in thread ${threadID}`);
}

module.exports = {
    handleMessage,
    handleGroupNameChange,
    handleNicknameChange
};
