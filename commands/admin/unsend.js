// unsend.js - Delete bot messages reliably
const messageStore = require('../../utils/messageStore');

module.exports = {
  name: 'unsend',
  description: 'Delete a replied-to bot message or the last 3 bot messages if no reply',
  async execute(api, threadID, args, event, botState, isMaster, botID) {
    console.log(`[DEBUG UNSEND] Command started - reply: ${!!event.messageReply}, senderID: ${event.senderID}, botID: ${botID}`);

    try {
      // Case 1: Reply to a specific message
      if (event.messageReply && event.messageReply.messageID) {
        const messageIDToDelete = event.messageReply.messageID;
        console.log(`[DEBUG UNSEND] Reply detected - ID: ${messageIDToDelete}`);

        let storedMessage = messageStore.getMessage(messageIDToDelete);
        if (!storedMessage) {
          storedMessage = messageStore.getBotMessageByReply(messageIDToDelete);
        }

        if (!storedMessage || (!storedMessage.isBotMessage && storedMessage.senderID !== botID)) {
          console.log('[DEBUG UNSEND] Not a bot message (reply):', storedMessage ? storedMessage.senderID : 'Not found');
          api.sendMessage('❌ सिर्फ मेरे मैसेज डिलीट कर सकता हूँ! 🕉️', threadID);
          return;
        }

        // Unsend
        api.unsendMessage(messageIDToDelete, (err) => {
          if (err) {
            console.error(`[ERROR UNSEND] Failed: ${err.message}`);
            api.sendMessage(`❌ डिलीट फेल: ${err.message}`, threadID);
            return;
          }
          messageStore.removeBotMessage(messageIDToDelete, botID);
          api.sendMessage('✅ मैसेज अनसेंड हो गया! 🕉️', threadID);
        });
        return;
      }

      // Case 2: No reply - delete last 3 bot messages
      console.log('[DEBUG UNSEND] No reply - deleting last 3 bot messages');
      const botMessages = messageStore.getLastBotMessages(threadID, 3, botID);

      if (botMessages.length === 0) {
        api.sendMessage('❌ कोई बॉट मैसेज नहीं मिला। 🕉️', threadID);
        return;
      }

      let success = 0, error = 0;
      for (let msg of botMessages) {
        try {
          await new Promise((resolve, reject) => {
            api.unsendMessage(msg.messageID, (err) => {
              if (err) return reject(err);
              resolve();
            });
          });
          messageStore.removeBotMessage(msg.messageID, botID);
          success++;
        } catch (err) {
          console.error(`[ERROR UNSEND] Failed to unsend ${msg.messageID}:`, err.message);
          error++;
        }
      }

      api.sendMessage(`✅ ${success}/${botMessages.length} मैसेज डिलीट! (एरर: ${error}) 🕉️`, threadID);

    } catch (e) {
      console.error(`[ERROR UNSEND] General error:`, e.message);
      api.sendMessage(`⚠️ अनसेंड कमांड में गलती: ${e.message} 🕉️`, threadID);
    }
  }
};
