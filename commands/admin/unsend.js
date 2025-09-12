// ./commands/admin/unsend.js
module.exports = {
  name: 'unsend',
  description: 'Delete a replied-to message or the last 3 bot messages if no reply',
  execute(api, threadID, args, event, botState, isMaster, botID, stopBot) {
    // Check if bot is admin in the group
    api.getThreadInfo(threadID, (err, info) => {
      if (err) {
        console.error('[ERROR] Failed to fetch thread info:', err.message);
        api.sendMessage('⚠️ ग्रुप जानकारी लाने में गलती। 🕉️', threadID);
        return;
      }

      const isBotAdmin = Array.isArray(info.adminIDs) && info.adminIDs.some(admin => admin.id === botID);
      if (!isBotAdmin) {
        api.sendMessage('🚫 मुझे एडमिन बनाओ ताकि मैं मैसेज डिलीट कर सकूं! 🙏', threadID);
        return;
      }

      // Case 1: If command is replied to a message, delete that specific message
      if (event.messageReply && event.messageReply.messageID) {
        const messageIDToDelete = event.messageReply.messageID;
        api.deleteMessage(messageIDToDelete, (err) => {
          if (err) {
            console.error('[ERROR] Failed to delete replied message:', err.message);
            api.sendMessage(`❌ मैसेज डिलीट करने में गलती: ${err.message} 🕉️`, threadID);
            return;
          }
          api.sendMessage('✅ रिप्लाई वाला मैसेज डिलीट कर दिया गया! 🕉️', threadID);
        });
        return;
      }

      // Case 2: No reply, delete last 3 bot messages with 2-3 second delays
      api.getThreadHistory(threadID, 50, null, (err, history) => {
        if (err) {
          console.error('[ERROR] Failed to fetch thread history:', err.message);
          api.sendMessage('⚠️ ग्रुप हिस्ट्री लाने में गलती। 🕉️', threadID);
          return;
        }

        // Filter last 3 messages sent by the bot (senderID === botID)
        const botMessages = history
          .filter(msg => msg.senderID === botID && msg.messageID)
          .slice(0, 3)
          .reverse();

        if (botMessages.length === 0) {
          api.sendMessage('❌ कोई बॉट मैसेज नहीं मिला डिलीट करने के लिए। 🕉️', threadID);
          return;
        }

        api.sendMessage(`✅ लास्ट ${botMessages.length} बॉट मैसेज डिलीट कर रहा हूँ... 🕉️`, threadID);

        // Delete with 2-3 second random delays
        botMessages.forEach((msg, index) => {
          const delay = (Math.random() * 1000) + 2000; // 2000-3000 ms
          setTimeout(() => {
            api.deleteMessage(msg.messageID, (err) => {
              if (err) {
                console.error(`[ERROR] Failed to delete bot message ${msg.messageID}:`, err.message);
              }
            });
          }, index * delay);
        });
      });
    });
  }
};
