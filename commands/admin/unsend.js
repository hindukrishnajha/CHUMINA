module.exports = {
  name: 'unsend',
  description: 'Delete a replied-to message or the last 3 bot messages if no reply',
  execute(api, threadID, args, event, botState, isMaster, botID, stopBot) {
    // Check if bot is admin in the group
    api.getThreadInfo(threadID, (err, info) => {
      if (err) {
        console.error('[ERROR] Failed to fetch thread info:', err?.message || 'Unknown error', 'Error details:', JSON.stringify(err));
        api.sendMessage('⚠️ ग्रुप जानकारी लाने में गलती। 🕉️', threadID);
        return;
      }

      console.log('[DEBUG] Thread info:', JSON.stringify(info.adminIDs), 'botID:', botID);
      const isBotAdmin = Array.isArray(info.adminIDs) && info.adminIDs.some(admin => admin.id === botID);
      if (!isBotAdmin) {
        api.sendMessage('🚫 मुझे एडमिन बनाओ ताकि मैं मैसेज डिलीट कर सकूं! 🙏', threadID);
        return;
      }

      // Case 1: If command is replied to a message, delete that specific message
      if (event.messageReply) {
        console.log('[DEBUG] Reply event detected:', JSON.stringify(event.messageReply));
        if (event.messageReply.messageID) {
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
        } else {
          console.error('[ERROR] No valid messageID in event.messageReply');
          api.sendMessage('❌ रिप्लाई मैसेज का ID नहीं मिला। कृपया सही मैसेज को रिप्लाई करें। 🕉️', threadID);
        }
        return;
      }

      // Case 2: No reply, delete last 3 bot messages with 2-3 second delays
      console.log('[DEBUG] No reply found, proceeding to delete bot messages');
      api.getThreadHistory(threadID, 100, null, (err, history) => {
        if (err || !history) {
          console.error('[ERROR] Failed to fetch thread history:', err?.message || 'Unknown error', 'Error details:', JSON.stringify(err));
          api.sendMessage('⚠️ ग्रुप हिस्ट्री लाने में गलती। 🕉️', threadID);
          return;
        }
        console.log('[DEBUG] Thread history length:', history.length);

        // Filter last 3 messages sent by the bot (senderID === botID)
        const botMessages = history
          .filter(msg => msg.senderID === botID && msg.messageID)
          .slice(0, 3)
          .reverse();

        if (botMessages.length === 0) {
          console.log('[DEBUG] No bot messages found in thread history');
          api.sendMessage('❌ कोई बॉट मैसेज नहीं मिला डिलीट करने के लिए। 🕉️', threadID);
          return;
        }

        console.log('[DEBUG] Bot messages to delete:', JSON.stringify(botMessages.map(msg => msg.messageID)));
        api.sendMessage(`✅ लास्ट ${botMessages.length} बॉट मैसेज डिलीट कर रहा हूँ... 🕉️`, threadID);

        // Delete with 2-3 second random delays
        botMessages.forEach((msg, index) => {
          const delay = (Math.random() * 1000) + 2000; // 2000-3000 ms
          setTimeout(() => {
            console.log(`[DEBUG] Attempting to unsend bot messageID: ${msg.messageID}`);
            api.unsendMessage(msg.messageID, (err) => {
              if (err) {
                console.error(`[ERROR] Failed to unsend bot message ${msg.messageID}:`, err?.message || 'Unknown error', 'Error details:', JSON.stringify(err));
                api.sendMessage(`❌ मैसेज ${msg.messageID} डिलीट करने में गलती: ${err?.message || 'अज्ञात त्रुटि'} 🕉️`, threadID);
                return;
              }
              console.log(`[DEBUG] Successfully unsent bot messageID: ${msg.messageID}`);
            });
          }, index * delay);
        });
      });
    });
  }
};
