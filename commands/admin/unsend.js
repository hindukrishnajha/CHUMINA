module.exports = {
  name: 'unsend',
  description: 'Delete a replied-to bot message or the last 3 bot messages if no reply',
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

        // Check if the message is from the bot
        const storedMessage = messageStore.getMessage(messageIDToDelete);
        if (!storedMessage || storedMessage.senderID !== botID) {
          console.log(`[DEBUG] Message ${messageIDToDelete} not found in store or not a bot message`);
          api.sendMessage('❌ सिर्फ मेरे मैसेज डिलीट कर सकता हूँ! 🕉️', threadID);
          return;
        }

        // Try deleteMessage with timeout
        console.log(`[DEBUG] Attempting to delete replied messageID: ${messageIDToDelete}`);
        let timeoutTriggered = false;
        const timeoutId = setTimeout(() => {
          timeoutTriggered = true;
          console.error(`[ERROR] Timeout: No response from deleteMessage for ${messageIDToDelete}`);
          api.sendMessage('❌ मैसेज डिलीट करने में टाइमआउट। FB API इश्यू हो सकता है। 🕉️', threadID);
        }, 5000);

        api.deleteMessage(messageIDToDelete, (err) => {
          clearTimeout(timeoutId); // Clear timeout on response
          if (timeoutTriggered) return; // Skip if timeout already handled

          if (err) {
            console.error('[ERROR] Failed to delete replied message:', err?.message || 'Unknown error', 'Error details:', JSON.stringify(err));
            // Fallback to unsendMessage
            console.log(`[DEBUG] Falling back to unsendMessage for ${messageIDToDelete}`);
            api.unsendMessage(messageIDToDelete, (fallbackErr) => {
              if (fallbackErr) {
                console.error('[ERROR] Fallback unsendMessage failed:', fallbackErr?.message || 'Unknown error');
                api.sendMessage(`❌ रिप्लाई मैसेज डिलीट करने में गलती: ${fallbackErr?.message || 'अज्ञात त्रुटि'} (FB API इश्यू या रेट लिमिट) 🕉️`, threadID);
                return;
              }
              console.log(`[DEBUG] Successfully unsent replied messageID: ${messageIDToDelete} via fallback`);
              messageStore.removeMessage(messageIDToDelete);
              api.sendMessage('✅ रिप्लाई वाला मैसेज डिलीट कर दिया गया (फॉल बैक)! 🕉️', threadID);
            });
            return;
          }
          console.log(`[DEBUG] Successfully deleted replied messageID: ${messageIDToDelete}`);
          messageStore.removeMessage(messageIDToDelete);
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
      api.sendMessage(`✅ लास्ट ${botMessages.length} बॉट मैसेज डिलीट कर रहा हूँ... (1-2 sec wait करो, FB delay हो सकता है) 🕉️`, threadID);

      let successCount = 0;
      let errorCount = 0;
      let totalCount = botMessages.length;

      botMessages.forEach((msg, index) => {
        const delay = (Math.random() * 1000) + 2000; // 2-3 sec random delay
        setTimeout(() => {
          console.log(`[DEBUG] Attempting to delete bot messageID: ${msg.messageID}`);
          let msgTimeoutTriggered = false;
          const msgTimeoutId = setTimeout(() => {
            msgTimeoutTriggered = true;
            console.error(`[ERROR] Timeout: No response from deleteMessage for ${msg.messageID}`);
            errorCount++;
          }, 5000);

          api.deleteMessage(msg.messageID, (err) => {
            clearTimeout(msgTimeoutId);
            if (msgTimeoutTriggered) return;

            if (err) {
              console.error(`[ERROR] Failed to delete bot message ${msg.messageID}:`, err?.message || 'Unknown error', 'Details:', JSON.stringify(err));
              // Fallback to unsendMessage
              api.unsendMessage(msg.messageID, (fallbackErr) => {
                if (fallbackErr) {
                  console.error(`[ERROR] Fallback unsendMessage failed for ${msg.messageID}:`, fallbackErr?.message || 'Unknown error');
                  errorCount++;
                  return;
                }
                successCount++;
                console.log(`[DEBUG] Successfully unsent bot messageID: ${msg.messageID} via fallback`);
                messageStore.removeBotMessage(msg.messageID);
              });
              return;
            }
            successCount++;
            console.log(`[DEBUG] Successfully deleted bot messageID: ${msg.messageID}`);
            messageStore.removeBotMessage(msg.messageID);
          });

          // Check if last one
          if (index === totalCount - 1) {
            setTimeout(() => {
              const totalDeleted = successCount;
              api.sendMessage(`✅ कुल ${totalDeleted}/${totalCount} बॉट मैसेज सफलतापूर्वक डिलीट हो गए! (एरर: ${errorCount}) 🕉️\nनोट: FB में 1-5 sec delay हो सकता है, group refresh करो।`, threadID);
              if (errorCount > 0) {
                api.sendMessage(`⚠️ ${errorCount} मैसेज डिलीट नहीं हुए (FB API इश्यू या रेट लिमिट)।`, threadID);
              }
            }, 3000);
          }
        }, index * delay);
      });
    });
  }
};
