// commands/admin/unsend.js
const messageStore = require('../../utils/messageStore');

module.exports = {
  name: "unsend",
  execute(api, threadID, args, event, botState, isMaster) {
    console.log(`[DEBUG] unsend called: threadID=${threadID}, args=${JSON.stringify(args)}`);
    try {
      if (!isMaster && !botState.adminList.includes(event.senderID)) {
        api.sendMessage('🚫 केवल मास्टर या एडमिन इस कमांड को यूज कर सकते हैं।', threadID);
        return;
      }

      const lastBotMessage = messageStore.getLastBotMessage(threadID);
      if (!lastBotMessage) {
        api.sendMessage('❌ कोई हाल का बॉट मैसेज नहीं मिला।', threadID);
        return;
      }

      api.unsendMessage(lastBotMessage.messageID, (err) => {
        if (err) {
          console.error('[ERROR] Unsend failed:', err.message);
          api.sendMessage(`❌ मैसेज डिलीट करने में गलती: ${err.message} (शायद 10 मिनट से पुराना है)।`, threadID);
          return;
        }
        api.sendMessage(`✅ बॉट का मैसेज डिलीट किया गया: "${lastBotMessage.content}"`, threadID);
        // Remove from store
        messageStore.botMessages = messageStore.botMessages.filter(msg => msg.messageID !== lastBotMessage.messageID);
      });
    } catch (e) {
      console.error('[ERROR] unsend error:', e.message);
      api.sendMessage('⚠️ अनसेंड कमांड में गलती।', threadID);
    }
  }
};
