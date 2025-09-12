module.exports = {
  name: 'unsend',
  description: 'Delete a replied-to message or the last 3 bot messages if no reply',
  execute(api, threadID, args, event, botState, isMaster, botID, stopBot) {
    const messageStore = require('../../utils/messageStore'); // Import store

    // Check if bot is admin in the group
    api.getThreadInfo(threadID, (err, info) => {
      if (err) {
        console.error('[ERROR] Failed to fetch thread info:', err?.message || 'Unknown error', 'Error details:', JSON.stringify(err));
        api.sendMessage('⚠️ ग्रुप जानकारी लाने में गलती। 🕉️', threadID);
        return;
      }

      console.log('[DEBUG] Thread info admins:', JSON.stringify(info.adminIDs), 'botID:', botID);
      const isBotAdmin = Array.isArray(info.adminIDs) && info.adminIDs.some(admin => admin.id === botID);
      if (!isBotAdmin) {
        api.sendMessage('🚫 मुझे एडमिन बनाओ ताकि मैं मैसेज डिलीट कर सकूं! 🙏', threadID);
        return;
      }

      // Case 1: If command is replied to a message, delete that specific message
      if (event.messageReply && event.messageReply.messageID) {
        console.log('[DEBUG] Reply event detected:', JSON.stringify(event.messageReply));
        const messageIDToDelete = event.messageReply.messageID;
        console.log(`[DEBUG] Attempting to unsend replied messageID: ${messageIDToDelete}`);
        api.unsendMessage(messageIDToDelete, (err) => {
          if (err) {
            console.error('[ERROR] Failed to unsend replied message:', err?.message || 'Unknown error', 'Error details:', JSON.stringify(err));
            api.sendMessage(`❌ मैसेज डिलीट करने में गलती: ${err?.message || 'अज्ञात त्रुटि'} 🕉️`, threadID);
            return;
          }
          console.log(`[DEBUG] Successfully unsent replied messageID: ${messageIDToDelete}`);
          api.sendMessage('✅ रिप्लाई वाला मैसेज डिलीट कर दिया गया! 🕉️', threadID);
        });
        return;
      }

      // Case 2: No reply, delete last 3 bot messages from store
      console.log('[DEBUG] No reply found, proceeding to delete bot messages from store');
      const botMessages = messageStore.getLastBotMessages(threadID, 3);

      if (botMessages.length === 0) {
        console.log('[DEBUG] No bot messages found in store for threadID:', threadID);
        api.sendMessage('❌ कोई बॉट मैसेज नहीं मिला डिलीट करने के लिए। 🕉️', threadID);
        return;
      }

      console.log('[DEBUG] Bot messages to delete from store:', JSON.stringify(botMessages.map(msg => msg.messageID)));
      api.sendMessage(`✅ लास्ट ${botMessages.length} बॉट मैसेज डिलीट कर रहा हूँ... 🕉️`, threadID);

      let successCount = 0;
      let totalCount = botMessages.length;

      botMessages.forEach((msg, index) => {
        const delay = (Math.random() * 1000) + 2000; // 2-3 sec random delay
        setTimeout(() => {
          console.log(`[DEBUG] Attempting to unsend bot messageID: ${msg.messageID}`);
          api.unsendMessage(msg.messageID, (err) => {
            if (err) {
              console.error(`[ERROR] Failed to unsend bot message ${msg.messageID}:`, err?.message || 'Unknown error');
              // Optional: Send per-error, but avoid spam
              return;
            }
            successCount++;
            console.log(`[DEBUG] Successfully unsent bot messageID: ${msg.messageID}`);
            messageStore.removeBotMessage(msg.messageID); // Cleanup store
            if (index === totalCount - 1) { // Last one
              api.sendMessage(`✅ कुल ${successCount}/${totalCount} बॉट मैसेज सफलतापूर्वक डिलीट हो गए! 🕉️`, threadID);
            }
          });
        }, index * delay);
      });
    });
  }
};
