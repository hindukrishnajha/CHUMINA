module.exports = {
    handleUnsend: (api, threadID, event, isMaster) => {
        try {
            const repliedMessageId = event.messageReply.messageID;
            api.deleteMessage(repliedMessageId, threadID, (err) => {
                if (err) {
                    api.sendMessage('❌ Error deleting message. Ensure bot has admin permissions and the message is accessible.', threadID);
                    console.error('Unsend error:', err);
                } else {
                    api.sendMessage(`✅ Message deleted by ${isMaster ? 'Shalender Hindu Ji' : 'Admin'}.`, threadID);
                }
            });
        } catch (e) {
            api.sendMessage('Error in unsend command.', threadID);
            console.error('Unsend error:', e);
        }
    }
};
