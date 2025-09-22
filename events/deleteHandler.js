const messageStore = require('../utils/messageStore');

function handleUnsend(api, event, botState, userId) {
    console.log(`🎯 [DELETE-EVENT] Caught: ${event.messageID} in thread ${event.threadID}`);
    
    const threadID = event.threadID;
    
    if (!botState.deleteNotifyEnabled[threadID]) {
        return;
    }

    const deletedMsg = messageStore.getMessage(event.messageID);
    if (!deletedMsg) {
        console.log(`[DELETE] No message found for ID: ${event.messageID}`);
        return;
    }

    // Check if bot is admin
    api.getThreadInfo(threadID, (err, info) => {
        if (err) {
            console.error('[DELETE] Failed to get thread info');
            return;
        }

        const botID = botState.sessions[userId]?.botID;
        const isBotAdmin = Array.isArray(info.adminIDs) && info.adminIDs.some(admin => admin.id === botID);
        if (!isBotAdmin) {
            api.sendMessage('मालिक, मुझे एडमिन बनाओ ताकि मैं डिलीट नोटिफिकेशन भेज सकूं! 🙏', threadID);
            return;
        }

        // Get sender info
        api.getUserInfo(deletedMsg.senderID, (err, userInfo) => {
            let senderName = 'Unknown';
            if (!err && userInfo && userInfo[deletedMsg.senderID]) {
                senderName = userInfo[deletedMsg.senderID].name;
            }
            
            // STICKER DELETE
            if (deletedMsg.content === '[attachment: sticker]') {
                api.sendMessage(`😊🗑️ ${senderName} ने एक स्टिकर डिलीट किया!`, threadID);
                
                // Sticker resend attempt
                if (deletedMsg.attachment && deletedMsg.attachment.url) {
                    api.sendMessage({
                        body: '🗳️ डिलीट किया गया स्टिकर:',
                        sticker: deletedMsg.attachment.url
                    }, threadID);
                }
            } 
            // PHOTO DELETE  
            else if (deletedMsg.content === '[attachment: photo]') {
                api.sendMessage(`📸🗑️ ${senderName} ने एक फोटो डिलीट किया!`, threadID);
                
                // Photo resend attempt
                if (deletedMsg.attachment && deletedMsg.attachment.url) {
                    api.sendMessage({
                        body: '🖼️ डिलीट की गई फोटो:',
                        attachment: require('fs').createReadStream(deletedMsg.attachment.url)
                    }, threadID, (err) => {
                        if (err) {
                            api.sendMessage('📸 फोटो रीसेंड नहीं हो सकी, लेकिन notification आ गया!', threadID);
                        }
                    });
                }
            }
            // VIDEO DELETE
            else if (deletedMsg.content === '[attachment: video]') {
                api.sendMessage(`🎥🗑️ ${senderName} ने एक वीडियो डिलीट किया!`, threadID);
            }
            // TEXT MESSAGE DELETE
            else {
                const notificationMsg = `🗑️ ${senderName} ने मैसेज डिलीट किया:\n"${deletedMsg.content}"`;
                api.sendMessage(notificationMsg, threadID);
            }
            
            console.log(`[DELETE] Notification sent for ${deletedMsg.content}`);
        });
    });
}

module.exports = {
    handleUnsend
};
