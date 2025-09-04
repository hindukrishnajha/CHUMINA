module.exports = {
    handleUnsend: (api, threadID, event, isMaster) => {
        try {
            if (!event.messageReply || !event.messageReply.messageID) {
                api.sendMessage('❌ Please reply to a message to unsend.', threadID);
                return;
            }

            const repliedMessageId = event.messageReply.messageID;
            api.deleteMessage(repliedMessageId, threadID, (err) => {
                if (err) {
                    api.sendMessage('❌ Error deleting message. Ensure bot has admin permissions and the message is accessible.', threadID);
                    console.error('Unsend error for thread', threadID, ':', err);
                    return;
                }
                api.sendMessage(`✅ Message deleted by ${isMaster ? 'Shalender Hindu Ji' : 'Admin'}.`, threadID);
                console.log(`Message unsent in thread ${threadID}: ${repliedMessageId}`);
            });
        } catch (e) {
            api.sendMessage('⚠️ Error in unsend command.', threadID);
            console.error('Unsend error for thread', threadID, ':', e);
        }
    }
};
