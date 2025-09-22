const messageStore = require('../utils/messageStore');

function handleUnsend(api, event, botState, userId) {
    console.log(`🎯 [DELETE-EVENT] Caught: ${event.messageID} in thread ${event.threadID}`);
    
    const threadID = event.threadID;
    
    if (!botState.deleteNotifyEnabled[threadID]) {
        console.log(`[DELETE] Delete notify disabled for thread ${threadID}`);
        return;
    }

    console.log(`[DELETE] Delete notify enabled for this thread`);
    
    const deletedMsg = messageStore.getMessage(event.messageID);
    if (!deletedMsg) {
        console.log(`[DELETE] No message found in store for ID: ${event.messageID}`);
        return;
    }

    console.log(`[DELETE] Found deleted message: "${deletedMsg.content}"`);
    
    // Check if bot is admin
    api.getThreadInfo(threadID, (err, info) => {
        if (err) {
            console.error('[DELETE] Failed to get thread info');
            return;
        }

        const botID = botState.sessions[userId]?.botID;
        const isBotAdmin = Array.isArray(info.adminIDs) && info.adminIDs.some(admin => admin.id === botID);
        if (!isBotAdmin) {
            console.log('[DELETE] Bot not admin, skipping');
            api.sendMessage('मालिक, मुझे एडमिन बनाओ ताकि मैं डिलीट नोटिफिकेशन भेज सकूं! 🙏', threadID);
            return;
        }

        // Get sender info
        api.getUserInfo(deletedMsg.senderID, (err, userInfo) => {
            let senderName = 'Unknown';
            if (!err && userInfo && userInfo[deletedMsg.senderID]) {
                senderName = userInfo[deletedMsg.senderID].name;
            }
            
            // Handle different attachment types
            if (deletedMsg.content === '[attachment: photo]') {
                api.sendMessage(`📸🗑️ ${senderName} ने एक फोटो डिलीट किया!`, threadID);
            } 
            else if (deletedMsg.content === '[attachment: sticker]') {
                api.sendMessage(`😊🗑️ ${senderName} ने एक स्टिकर डिलीट किया!`, threadID);
            }
            else if (deletedMsg.content === '[attachment: video]') {
                api.sendMessage(`🎥🗑️ ${senderName} ने एक वीडियो डिलीट किया!`, threadID);
            }
            else {
                // Text message
                const notificationMsg = `🗑️ ${senderName} ने मैसेज डिलीट किया:\n"${deletedMsg.content}"`;
                api.sendMessage(notificationMsg, threadID);
            }
            
            console.log(`[DELETE] Notification sent successfully`);
            
            // Clean up stored message
            messageStore.removeMessage(event.messageID);
        });
    });
}

module.exports = {
    handleUnsend
};
