const commandHandler = require('./commandHandler');
const messageStore = require('../utils/messageStore');
const { getAIResponse } = require('../utils/aichat');
const { MASTER_ID } = require('../config/constants');

// Import response files
const autoreplies = require('../responses/autoreplies').autoreplies; // Assuming this exists
const masterReplies = require('../responses/masterReplies');
const adminTagReplies = require('../responses/adminTagReplies').adminTagReplies;
const randomBotReplies = require('../responses/randomBotReplies');
const welcomeMessages = require('../responses/welcome').welcomeMessages;
const goodbyeMessages = require('../responses/goodbye').goodbyeMessages;

// Utility for exact word match
function isWordMatch(content, trigger) {
    const regex = new RegExp(`\\b${trigger.toLowerCase()}\\b`, 'i'); // Word boundary, case-insensitive
    return regex.test(content);
}

function handleMessage(api, event, botState, userId) {
    const senderID = event.senderID || event.author || null;
    const isMaster = String(senderID) === String(MASTER_ID);
    const isAdmin = Array.isArray(botState.adminList) && (botState.adminList.includes(senderID) || isMaster);
    const threadID = event.threadID;
    const messageID = event.messageID;
    const content = event.body ? event.body.trim() : '';
    const botID = botState.sessions[userId]?.botID;

    console.log(`[MESSAGE] From: ${senderID}, Content: ${content}`);
    console.log(`[DEBUG] SenderID: ${senderID}, MASTER_ID: ${MASTER_ID}, IsMaster: ${isMaster}`);

    if (event.logMessageType === 'log:subscribe') {
        handleGroupJoin(api, event, botState, userId);
    } else if (event.logMessageType === 'log:unsubscribe') {
        handleGroupLeave(api, event, botState, userId);
    }

    if (botState.mutedUsers && botState.mutedUsers[threadID] && botState.mutedUsers[threadID].includes(senderID)) {
        console.log(`[MUTE] Ignoring message from muted user ${senderID}`);
        return;
    }

    const attachment = event.attachments && event.attachments.length > 0 ? event.attachments[0] : null;
    messageStore.storeMessage(messageID, content, senderID, threadID, attachment);

    if (isMaster && event.type === 'message') {
        api.setMessageReaction('😍', messageID, (err) => {
            if (err) console.error(`[ERROR] Reaction failed: ${err.message}`);
        });
    }

    if (content.startsWith(botState.sessions[userId]?.prefix || '#')) {
        return commandHandler.handleCommand(api, event, botState, userId);
    }

    if (content.toLowerCase().startsWith('#ai') || content.toLowerCase().startsWith('@ai')) {
        return handleAIChat(api, event, botState, userId);
    }

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
    const content = event.body ? event.body.toLowerCase() : ''; // Keep original text for word boundary
    const threadID = event.threadID;
    const senderID = event.senderID;

    if (content.startsWith(botState.sessions[userId]?.prefix || '#')) return;
    if (!content || content.length < 2) return;

    console.log(`[AUTO-REPLY] Checking: "${content}"`);

    // Master Replies
    if (String(senderID) === String(MASTER_ID)) {
        console.log(`[MASTER-REPLY] Sender is master: ${senderID}`);
        for (const category of Object.values(masterReplies)) {
            if (category.triggers && category.replies) {
                for (const trigger of category.triggers) {
                    if (isWordMatch(content, trigger)) {
                        const reply = Array.isArray(category.replies) 
                            ? category.replies[Math.floor(Math.random() * category.replies.length)] 
                            : category.replies;
                        api.sendMessage(reply, threadID);
                        console.log(`[MASTER-REPLY] Triggered: ${trigger}`);
                        return;
                    }
                }
            }
            if (category.replies && !category.triggers) {
                for (const [trigger, replies] of Object.entries(category)) {
                    if (isWordMatch(content, trigger)) {
                        const reply = Array.isArray(replies) 
                            ? replies[Math.floor(Math.random() * replies.length)] 
                            : replies;
                        api.sendMessage(reply, threadID);
                        console.log(`[MASTER-REPLY] Triggered: ${trigger}`);
                        return;
                    }
                }
            }
        }
        console.log(`[MASTER-REPLY] No trigger matched for content: "${content}"`);
    }

    // Random bot replies
    if (isWordMatch(content, 'bot')) {
        const reply = randomBotReplies[Math.floor(Math.random() * randomBotReplies.length)];
        api.sendMessage(reply, threadID);
        console.log(`[RANDOM-BOT-REPLY] Triggered for content: "${content}"`);
        return;
    }

    // Admin tag replies
    if (String(senderID) === String(MASTER_ID) && event.mentions) {
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

    // General autoreplies
    for (const [trigger, replies] of Object.entries(autoreplies)) {
        console.log(`[AUTO-REPLY] Checking trigger: ${trigger}`);
        if (isWordMatch(content, trigger)) {
            let reply = Array.isArray(replies) ? replies[Math.floor(Math.random() * replies.length)] : replies;
            api.sendMessage(reply, threadID);
            console.log(`[AUTO-REPLY] Triggered: ${trigger}, Reply: ${reply}`);
            return;
        }
    }

    // Learned responses
    if (botState.learnedResponses) {
        console.log(`[LEARNED] Checking learnedResponses: ${JSON.stringify(botState.learnedResponses)}`);
        for (const [user, data] of Object.entries(botState.learnedResponses)) {
            if (data.triggers) {
                for (const triggerObj of data.triggers) {
                    if (isWordMatch(content, triggerObj.trigger)) {
                        const reply = triggerObj.responses[Math.floor(Math.random() * triggerObj.responses.length)];
                        api.sendMessage(reply, threadID);
                        console.log(`[LEARNED] Triggered: ${triggerObj.trigger}, Reply: ${reply}`);
                        return;
                    }
                }
            }
        }
    }
}

function handleGroupJoin(api, event, botState, userId) {
    const threadID = event.threadID;
    const addedParticipants = event.logMessageData.added_participants || [];
    
    addedParticipants.forEach(participant => {
        const name = participant.full_name || participant.userFbId || 'Unknown';
        const reply = welcomeMessages[Math.floor(Math.random() * welcomeMessages.length)].replace('{name}', name);
        api.sendMessage(reply, threadID);
        console.log(`[WELCOME] Sent for ${name} in thread ${threadID}: ${reply}`);
    });
}

function handleGroupLeave(api, event, botState, userId) {
    const threadID = event.threadID;
    const removedUserID = event.logMessageData.left_participant_fb_id;
    const isAdminAction = event.logMessageData.admin_event && event.logMessageData.admin_event.action === 'remove';

    api.getUserInfo([removedUserID], (err, userInfo) => {
        if (err) {
            console.error(`[ERROR] Failed to fetch user info: ${err.message}`);
            return;
        }
        
        const name = userInfo[removedUserID]?.name || 'Unknown';
        let reply;
        if (isAdminAction) {
            reply = goodbyeMessages.admin[Math.floor(Math.random() * goodbyeMessages.admin.length)].replace('{name}', name);
        } else {
            reply = goodbyeMessages.member[Math.floor(Math.random() * goodbyeMessages.member.length)].replace('{name}', name);
        }
        
        api.sendMessage(reply, threadID);
        console.log(`[GOODBYE] Sent for ${name} in thread ${threadID}: ${reply}`);
    });
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
    handleNicknameChange,
    handleGroupJoin,
    handleGroupLeave
};
