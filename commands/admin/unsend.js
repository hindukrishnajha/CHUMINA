module.exports = {
    handleUnsend: (api, threadID, event, isMaster) => {
        try {
            if (!event.messageReply) {
                api.sendMessage('❌ Please reply to a message to unsend.', threadID);
                return;
            }

            const repliedMessageId = event.messageReply.messageID;
            api.deleteMessage(repliedMessageId, threadID, (err) => {
                if (err) {
                    api.sendMessage('❌ Error deleting message. Ensure bot is admin and message is recent.', threadID);
                    console.error('Unsend error:', err);
                    return;
                }
                api.sendMessage(`✅ Message deleted by ${isMaster ? 'Master' : 'Admin'}.`, threadID);
            });
        } catch (e) {
            api.sendMessage('⚠️ Error in unsend.', threadID);
            console.error('Unsend error:', e);
        }
    }
};
