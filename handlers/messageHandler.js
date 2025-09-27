const commandHandler = require('./commandHandler');
const messageStore = require('../utils/messageStore');
const { getAIResponse } = require('../utils/aichat');
const { MASTER_ID } = require('../config/constants');

// Import response files
const autoreplies = require('../responses/autoreplies').autoreplies;
const masterReplies = require('../responses/masterReplies');
const adminTagReplies = require('../responses/adminTagReplies').adminTagReplies;
const randomBotReplies = require('../responses/randomBotReplies');
const welcomeMessages = require('../responses/welcome').welcomeMessages;
const goodbyeMessages = require('../responses/goodbye').goodbyeMessages;

// ---------------- Helper: Exact word match -----------------
function exactMatch(message, trigger) {
    message = message.toLowerCase().trim();
    trigger = trigger.toLowerCase().trim();
    const pattern = new RegExp(`\\b${trigger}\\b`, 'i'); // exact word boundary
    return pattern.test(message);
}

// ---------------- Auto Replies -----------------
function handleAutoReplies(api, event, botState, userId) {
    const content = event.body ? event.body.toLowerCase().replace(/[^a-z0-9\s]/g, '') : '';
    const threadID = event.threadID;
    const senderID = event.senderID;

    if (content.startsWith(botState.sessions[userId]?.prefix || '#')) return;
    if (!content || content.length < 2) return;

    // 1. Master replies
    if (String(senderID) === String(MASTER_ID)) {
        // If roast mode is on, skip masterReplies to avoid double replies
        if (botState.roastEnabled && botState.roastEnabled[threadID]) {
            return; // Let roastToggle.js handle the response
        }
        for (const category of Object.values(masterReplies)) {
            if (category.triggers && category.replies) {
                for (const trigger of category.triggers) {
                    if (exactMatch(content, trigger)) {
                        const reply = Array.isArray(category.replies)
                            ? category.replies[Math.floor(Math.random() * category.replies.length)]
                            : category.replies;
                        api.sendMessage(reply, threadID);
                        return;
                    }
                }
            }
            if (category.replies && !category.triggers) {
                for (const [trigger, replies] of Object.entries(category)) {
                    if (exactMatch(content, trigger)) {
                        const reply = Array.isArray(replies)
                            ? replies[Math.floor(Math.random() * replies.length)]
                            : replies;
                        api.sendMessage(reply, threadID);
                        return;
                    }
                }
            }
            if (typeof category === 'object' && category !== null && !category.triggers && !category.replies) {
                for (const [trigger, replies] of Object.entries(category)) {
                    if (exactMatch(content, trigger)) {
                        const reply = Array.isArray(replies)
                            ? replies[Math.floor(Math.random() * replies.length)]
                            : replies;
                        api.sendMessage(reply, threadID);
                        return;
                    }
                }
            }
        }
    }

    // 2. Random bot replies
    if (exactMatch(content, 'bot')) {
        const reply = randomBotReplies[Math.floor(Math.random() * randomBotReplies.length)];
        api.sendMessage(reply, threadID);
        return;
    }

    // 3. Admin tag replies
    if (String(senderID) === String(MASTER_ID) && event.mentions) {
        const mentionedIDs = Object.keys(event.mentions);
        const isAdminMention = mentionedIDs.some(id => botState.adminList && botState.adminList.includes(id));
        if (isAdminMention && adminTagReplies.length > 0) {
            const reply = adminTagReplies[Math.floor(Math.random() * adminTagReplies.length)];
            api.sendMessage(reply, threadID);
            return;
        }
    }

    // 4. General autoreplies
    for (const [trigger, replies] of Object.entries(autoreplies)) {
        if (exactMatch(content, trigger)) {
            const reply = Array.isArray(replies)
                ? replies[Math.floor(Math.random() * replies.length)]
                : replies;
            api.sendMessage(reply, threadID);
            return;
        }
    }

    // 5. Learned responses
    if (botState.learnedResponses) {
        for (const [user, data] of Object.entries(botState.learnedResponses)) {
            if (data.triggers) {
                for (const triggerObj of data.triggers) {
                    if (exactMatch(content, triggerObj.trigger)) {
                        const reply = triggerObj.responses[Math.floor(Math.random() * triggerObj.responses.length)];
                        api.sendMessage(reply, threadID);
                        return;
                    }
                }
            }
        }
    }
}

// ---------------- AI Chat -----------------
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

// ---------------- Main Handler -----------------
function handleMessage(api, event, botState, userId) {
    const senderID = event.senderID || event.author || null;
    const threadID = event.threadID;
    const messageID = event.messageID;
    const content = event.body ? event.body.trim() : '';

    // Prevent double processing
    const eventKey = `${threadID}_${messageID}`;
    if (botState.eventProcessed[eventKey]) {
        console.log(`[MSG] Duplicate message detected: ${eventKey}, skipping`);
        return;
    }
    botState.eventProcessed[eventKey] = true;

    // Group join/leave
    if (event.logMessageType === 'log:subscribe') handleGroupJoin(api, event, botState, userId);
    else if (event.logMessageType === 'log:unsubscribe') handleGroupLeave(api, event, botState, userId);

    // Muted users
    if (botState.mutedUsers && botState.mutedUsers[threadID] && botState.mutedUsers[threadID].includes(senderID)) return;

    // Store message
    const attachment = event.attachments && event.attachments.length > 0 ? event.attachments[0] : null;
    messageStore.storeMessage(messageID, content, senderID, threadID, attachment);

    // Master reactions
    if (String(senderID) === String(MASTER_ID) && event.type === 'message') {
        api.setMessageReaction('😍', messageID, (err) => { if (err) console.error(err); });
    }

    // Command handling
    if (content.startsWith(botState.sessions[userId]?.prefix || '#')) return commandHandler.handleCommand(api, event, botState, userId);

    // AI chat
    if (content.toLowerCase().startsWith('#ai') || content.toLowerCase().startsWith('@ai')) return handleAIChat(api, event, botState, userId);

    // Auto replies
    handleAutoReplies(api, event, botState, userId);
}

// ---------------- Group Functions -----------------
function handleGroupJoin(api, event, botState, userId) {
    const threadID = event.threadID;
    const addedParticipants = event.logMessageData.added_participants || [];
    addedParticipants.forEach(participant => {
        const name = participant.full_name || participant.userFbId || 'Unknown';
        const reply = welcomeMessages[Math.floor(Math.random() * welcomeMessages.length)].replace('{name}', name);
        api.sendMessage(reply, threadID);
    });
}

function handleGroupLeave(api, event, botState, userId) {
    const threadID = event.threadID;
    const removedUserID = event.logMessageData.left_participant_fb_id;
    const isAdminAction = event.logMessageData.admin_event && event.logMessageData.admin_event.action === 'remove';

    api.getUserInfo([removedUserID], (err, userInfo) => {
        if (err) return;
        const name = userInfo[removedUserID]?.name || 'Unknown';
        let reply = isAdminAction
            ? goodbyeMessages.admin[Math.floor(Math.random() * goodbyeMessages.admin.length)].replace('{name}', name)
            : goodbyeMessages.member[Math.floor(Math.random() * goodbyeMessages.member.length)].replace('{name}', name);
        api.sendMessage(reply, threadID);
    });
}

function handleGroupNameChange(api, event, botState) {
    const threadID = event.threadID;
    if (botState.lockedGroups[threadID]) {
        const lockedName = botState.lockedGroups[threadID];
        api.setTitle(lockedName, threadID, (err) => {
            if (!err) api.sendMessage(`🔒 ग्रुप नाम रिस्टोर किया गया: ${lockedName} 🕉️`, threadID);
        });
    }
}

function handleNicknameChange(api, event, botState, userId) {
    const changedUserID = event.logMessageData.participant_id;
    const threadID = event.threadID;
    if (!changedUserID || changedUserID === botState.sessions[userId]?.botID) return;
}

// ---------------- Export -----------------
module.exports = {
    handleMessage,
    handleGroupNameChange,
    handleNicknameChange,
    handleGroupJoin,
    handleGroupLeave
};
