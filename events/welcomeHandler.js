const messageStore = require('../utils/messageStore');

function handleWelcome(api, event, botState, userId) {
    const threadID = event.threadID;
    const addedIDs = Array.isArray(event.logMessageData?.addedParticipants) ? 
        event.logMessageData.addedParticipants.map(p => p.userFbId) : [];
    
    if (!botState.memberCache[threadID]) {
        botState.memberCache[threadID] = new Set();
    }

    addedIDs.forEach(id => {
        // Muted users check
        if (botState.mutedUsers && botState.mutedUsers[threadID] && botState.mutedUsers[threadID].includes(id)) {
            console.log(`[MUTE] Skipping welcome for muted user ${id}`);
            return;
        }

        if (id === botState.sessions[userId].botID) {
            // Bot added to group
            api.sendMessage(`🍒💙•••Ɓ❍ʈ Ƈøɳɳɛƈʈɛɗ•••💞🌿
🕊️🌸...Ɦɛɭɭ❍ Ɠɣus Ɱɣ ɴαɱɛ ιʂ ʂɧαʟɛɳɗɛɽ ɧιɳɗu Ɱαʂʈɛɽ'ʂ Ɓ❍ʈ...🌸🕊️
🛠️...use #help for commands...🛠️`, threadID);
        } else {
            // New member added
            botState.memberCache[threadID].add(id);
            sendWelcomeMessage(api, threadID, id, botState);
        }
    });
}

function sendWelcomeMessage(api, threadID, userID, botState) {
    api.getUserInfo(userID, (err, ret) => {
        let userName = 'User';
        if (!err && ret && ret[userID]) {
            userName = ret[userID].name || 'User';
        }

        const welcomeMessages = botState.welcomeMessages || [
            "Welcome {name} to the group! 🎉",
            "Hello {name}, welcome to the family! 👋",
            "Hey {name}, glad to have you here! 😊"
        ];

        const randomWelcome = welcomeMessages[Math.floor(Math.random() * welcomeMessages.length)]
            .replace('{name}', userName);
        
        api.sendMessage(randomWelcome, threadID);
    });
}

function handleGoodbye(api, event, botState, userId) {
    const threadID = event.threadID;
    const leftID = event.logMessageData?.leftParticipantFbId;
    
    if (!leftID) {
        console.log(`[GOODBYE] Missing leftParticipantFbId in thread ${threadID}`);
        return;
    }

    // Muted users check
    if (botState.mutedUsers && botState.mutedUsers[threadID] && botState.mutedUsers[threadID].includes(leftID)) {
        console.log(`[MUTE] Skipping goodbye for muted user ${leftID}`);
        return;
    }

    // Bot removed from group
    if (leftID === botState.sessions[userId].botID && event.author !== botState.sessions[userId].botID) {
        const stopBot = require('../utils/botManager').stopBot;
        stopBot(userId, botState);
        return;
    }

    // Send goodbye message
    sendGoodbyeMessage(api, threadID, leftID, event.author, botState, userId);
}

function sendGoodbyeMessage(api, threadID, leftID, authorID, botState, userId) {
    api.getThreadInfo(threadID, (err, info) => {
        if (err || !info) {
            console.error(`[GOODBYE] Error fetching thread info: ${err?.message}`);
            sendDefaultGoodbye(api, threadID, leftID, botState);
            return;
        }

        const isAdminAction = authorID && Array.isArray(info.adminIDs) && 
            info.adminIDs.some(admin => admin.id === authorID);
        
        api.getUserInfo(leftID, (err, ret) => {
            let userName = 'User';
            if (!err && ret && ret[leftID]) {
                userName = ret[leftID].name || 'User';
            }

            const goodbyeMessages = {
                admin: [
                    "🚪 {name} was removed by admin",
                    "👋 {name} has been kicked from the group",
                    "❌ Admin removed {name} from group"
                ],
                member: [
                    "😢 {name} left the group",
                    "👋 Goodbye {name}",
                    "🚪 {name} has left the building"
                ]
            };

            const messagePool = isAdminAction ? goodbyeMessages.admin : goodbyeMessages.member;
            const randomGoodbye = messagePool[Math.floor(Math.random() * messagePool.length)]
                .replace('{name}', userName);
            
            api.sendMessage(randomGoodbye, threadID);

            // Anti-out feature
            if (botState.sessions[userId].botConfig.antiOut && !isAdminAction && leftID !== botState.sessions[userId].botID) {
                handleAntiOut(api, threadID, leftID, userName);
            }
        });
    });
}

function handleAntiOut(api, threadID, leftID, userName) {
    api.addUserToGroup(leftID, threadID, (err) => {
        if (err) {
            console.error(`[ANTI-OUT] Error adding user back: ${err.message}`);
            api.sendMessage('⚠️ यूजर को वापस जोड़ने में असफल। 🕉️', threadID);
        } else {
            api.sendMessage(`😈 ${userName} भागने की कोशिश कर रहा था, लेकिन मैंने उसे वापस खींच लिया! 😈 🕉️`, threadID);
        }
    });
}

function sendDefaultGoodbye(api, threadID, leftID, botState) {
    const goodbyeMessages = [
        "😢 A user left the group",
        "👋 Someone left the group",
        "🚪 A member has left"
    ];
    
    const randomGoodbye = goodbyeMessages[Math.floor(Math.random() * goodbyeMessages.length)];
    api.sendMessage(randomGoodbye, threadID);
}

module.exports = {
    handleWelcome,
    handleGoodbye
};
