// commands/admin/unsend.js
const messageStore = require('../../utils/messageStore');

module.exports = {
  name: "unsend",
  execute(api, threadID, args, event, botState, isMaster) {
    console.log(`[DEBUG] unsend called: threadID=${threadID}, args=${JSON.stringify(args)}, hasReply=${!!event.messageReply}`);
    try {
      if (!isMaster && !botState.adminList.includes(event.senderID)) {
        api.sendMessage('🚫 केवल मास्टर या एडमिन इस कमांड को यूज कर सकते हैं।', threadID);
        return;
      }

      let targetMessage;
      // Check if command is replying to a bot message
      if (event.messageReply && event.messageReply.senderID === botState.botID) {
        targetMessage = messageStore.getBotMessageByReply(event.messageReply.messageID);
      }

      // Fallback to last bot message if no reply or invalid reply
      if (!targetMessage) {
        targetMessage = messageStore.getLastBotMessage(threadID);
      }

      if (!targetMessage) {
        api.sendMessage('❌ कोई हाल का बॉट मैसेज नहीं मिला।', threadID);
        return;
      }

      api.unsendMessage(targetMessage.messageID, (err) => {
        if (err) {
          console.error('[ERROR] Unsend failed:', err.message);
          api.sendMessage(`❌ मैसेज डिलीट करने में गलती: ${err.message} (शायद 10 मिनट से पुराना है)।`, threadID);
          return;
        }
        api.sendMessage(`✅ बॉट का मैसेज डिलीट किया गया: "${targetMessage.content}"`, threadID);
        // Remove from store
        messageStore.botMessages = messageStore.botMessages.filter(msg => msg.messageID !== targetMessage.messageID);
      });
    } catch (e) {
      console.error('[ERROR] unsend error:', e.message);
      api.sendMessage('⚠️ अनसेंड कमांड में गलती।', threadID);
    }
  }
};
