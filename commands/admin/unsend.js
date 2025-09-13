module.exports = {
  name: 'unsend',
  description: 'Delete a replied-to bot message or the last 3 bot messages if no reply',
  execute(api, threadID, args, event, botState, isMaster, botID, stopBot) {
    console.log(`[DEBUG UNSEND] Command started - event type: ${event.type}, body: "${event.body}", reply: ${!!event.messageReply}`);
    const messageStore = require('../../utils/messageStore');

    api.getThreadInfo(threadID, (err, info) => {
      if (err) {
        console.error('[ERROR UNSEND] Thread info error:', err);
        api.sendMessage('⚠️ ग्रुप जानकारी लाने में गलती। 🕉️', threadID);
        return;
      }

      const isBotAdmin = Array.isArray(info.adminIDs) && info.adminIDs.some(admin => admin.id === botID);
      if (!isBotAdmin) {
        console.log('[DEBUG UNSEND] Bot not admin');
        api.sendMessage('🚫 मुझे एडमिन बनाओ! 🙏', threadID);
        return;
      }

      // Case 1: Reply (force check even if type is message)
      let messageIDToDelete = null;
      if (event.messageReply && event.messageReply.messageID) {
        messageIDToDelete = event.messageReply.messageID;
        console.log(`[DEBUG UNSEND] Reply detected - ID: ${messageIDToDelete}`);
      }

      if (messageIDToDelete) {
        const storedMessage = messageStore.getMessage(messageIDToDelete);
        if (!storedMessage || storedMessage.senderID !== botID) {
          console.log('[DEBUG UNSEND] Not bot message');
          api.sendMessage('❌ सिर्फ मेरे मैसेज डिलीट कर सकता हूँ! 🕉️', threadID);
          return;
        }

        let responseSent = false;
        const timeoutId = setTimeout(() => {
          if (!responseSent) {
            responseSent = true;
            console.error('[ERROR UNSEND] Timeout');
            api.sendMessage('❌ डिलीट में देरी—रीट्राई करो। 🕉️', threadID);
          }
        }, 10000);

        api.deleteMessage(messageIDToDelete, (err) => {
          clearTimeout(timeoutId);
          if (responseSent) return;
          responseSent = true;

          if (err) {
            console.error('[ERROR UNSEND] Delete failed:', err);
            api.unsendMessage(messageIDToDelete, (fErr) => {
              if (fErr) {
                console.error('[ERROR UNSEND] Unsend failed:', fErr);
                api.sendMessage(`❌ फेल: ${fErr.message || 'API इश्यू'} 🕉️`, threadID);
              } else {
                messageStore.removeMessage(messageIDToDelete);
                api.sendMessage('✅ Unsend हो गया! 🕉️', threadID);
              }
            });
            return;
          }
          messageStore.removeMessage(messageIDToDelete);
          api.sendMessage('✅ डिलीट हो गया! 🕉️', threadID);
        });
        return;
      }

      // Case 2: No reply
      console.log('[DEBUG UNSEND] No reply - deleting last 3');
      const botMessages = messageStore.getLastBotMessages(threadID, 3);
      if (botMessages.length === 0) {
        api.sendMessage('❌ कोई मैसेज नहीं मिला। 🕉️', threadID);
        return;
      }

      api.sendMessage(`✅ लास्ट ${botMessages.length} डिलीट... 🕉️`, threadID);

      let success = 0, error = 0;
      botMessages.forEach((msg, i) => {
        setTimeout(() => {
          let done = false;
          const tId = setTimeout(() => {
            if (!done) done = true, error++;
          }, 10000);

          api.deleteMessage(msg.messageID, (err) => {
            clearTimeout(tId);
            if (done) return;
            done = true;

            if (err) {
              api.unsendMessage(msg.messageID, (fErr) => {
                if (fErr) error++; else success++;
              });
              return;
            }
            success++;
            messageStore.removeBotMessage(msg.messageID);
          });

          if (i === botMessages.length - 1) {
            setTimeout(() => {
              api.sendMessage(`✅ ${success}/${botMessages.length} डिलीट! (एरर: ${error}) 🕉️`, threadID);
            }, 4000);
          }
        }, i * 2500);
      });
    });
  }
};
