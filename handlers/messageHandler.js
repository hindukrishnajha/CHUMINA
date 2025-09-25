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

function handleMessage(api, event, botState, userId) {
    const senderID = event.senderID || event.author || null;
    const isMaster = String(senderID) === String(MASTER_ID); // Type-safe comparison
    const isAdmin = Array.isArray(botState.adminList) && (botState.adminList.includes(senderID) || isMaster);
    const threadID = event.threadID;
    const messageID = event.messageID;
    const content = event.body ? event.body.trim() : '';
    const botID = botState.sessions[userId]?.botID;

    console.log(`[MESSAGE] From: ${senderID}, Content: ${content}`);
    console.log(`[DEBUG] SenderID: ${senderID}, MASTER_ID: ${MASTER_ID}, IsMaster: ${isMaster}`);

    // Handle group join/leave events
    if (event.logMessageType === 'log:subscribe') {
        handleGroupJoin(api, event, botState, userId);
    } else if (event.logMessageType === 'log:unsubscribe') {
        handleGroupLeave(api, event, botState, userId);
    }

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
        api.setMessageReaction('😍', messageID, (err) => {
            if (err) console.error(`[ERROR] Reaction failed: ${err.message}`);
        });
    }

    // Command handling
    if (content.startsWith(botState.sessions[userId]?.prefix || '#')) {
        return commandHandler.handleCommand(api, event, botState, userId);
    }

    // AI chat handling
    if (content.toLowerCase().startsWith('#ai') || content.toLowerCase().startsWith('@ai')) {
        return handleAIChat(api, event, botState, userId);
    }

    // Auto-replies handling
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
    const rawContent = event.body ? event.body.toLowerCase() : '';
    const normalizedContent = rawContent.replace(/[^a-z0-9\s]/g, '');
    const threadID = event.threadID;
    const senderID = event.senderID;

    // Skip messages starting with # (commands)
    if (rawContent.startsWith(botState.sessions[userId]?.prefix || '#')) return;

    // Skip if message is empty or too short
    if (!rawContent || rawContent.length < 2) return;

    console.log(`[AUTO-REPLY] Checking: "${rawContent}"`);

    // 1. First check masterReplies (if sender is master)
    if (String(senderID) === String(MASTER_ID)) {
        console.log(`[MASTER-REPLY] Sender is master: ${senderID}`);
        for (const category of Object.values(masterReplies)) {
            if (category.triggers && category.replies) {
                for (const trigger of category.triggers) {
                    if (normalizedContent.includes(trigger.toLowerCase().replace(/[^a-z0-9\s]/g, ''))) {
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
                    if (normalizedContent.includes(trigger.toLowerCase().replace(/[^a-z0-9\s]/g, ''))) {
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
        console.log(`[MASTER-REPLY] No trigger matched for content: "${rawContent}"`);
    } else {
        console.log(`[MASTER-REPLY] Sender ${senderID} is not master`);
    }

    // 2. Check randomBotReplies for non-master users
    if (normalizedContent.includes('bot')) {
        const reply = randomBotReplies[Math.floor(Math.random() * randomBotReplies.length)];
        api.sendMessage(reply, threadID);
        console.log(`[RANDOM-BOT-REPLY] Triggered for content: "${normalizedContent}"`);
        return;
    }

    // 3. Check admin tag replies (when master tags admin)
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

    // 4. Check general autoreplies (safe emoji handling)
    for (const [trigger, replies] of Object.entries(autoreplies)) {
        let checkContent;
        let checkTrigger;

        // अगर trigger सिर्फ emoji है → rawContent से match
        if (/^[\p{Emoji}\p{Extended_Pictographic}]+$/u.test(trigger)) {
            checkContent = rawContent;
            checkTrigger = trigger;
        } else {
            checkContent = normalizedContent;
            checkTrigger = trigger.toLowerCase().replace(/[^a-z0-9\s]/g, '');
        }

        if (checkTrigger && checkContent.includes(checkTrigger)) {
            let reply = Array.isArray(replies) 
                ? replies[Math.floor(Math.random() * replies.length)] 
                : replies;
            api.sendMessage(reply, threadID);
            console.log(`[AUTO-REPLY] Triggered: ${trigger}, Reply: ${reply}`);
            return;
        }
    }

    // 5. Check learned responses
    if (botState.learnedResponses) {
        console.log(`[LEARNED] Checking learnedResponses: ${JSON.stringify(botState.learnedResponses)}`);
        for (const [user, data] of Object.entries(botState.learnedResponses)) {
            if (data.triggers) {
                for (const triggerObj of data.triggers) {
                    const normTrigger = triggerObj.trigger.toLowerCase().replace(/[^a-z0-9\s]/g, '');
                    if (normalizedContent.includes(normTrigger)) {
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
        api.sendMessage(reply, threadID, (err) => {
            if (err) console.error(`[ERROR] Welcome message failed: ${err.message}`);
        });
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
        
        api.sendMessage(reply, threadID, (err) => {
            if (err) console.error(`[ERROR] Goodbye message failed: ${err.message}`);
        });
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
