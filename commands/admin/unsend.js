// unsend.js - Fixed version with better bot message detection
const messageStore = require('../../utils/messageStore');

module.exports = {
  name: 'unsend',
  description: 'Delete a replied-to bot message or the last 3 bot messages if no reply',
  async execute(api, threadID, args, event, botState, isMaster, botID, stopBot) {
    console.log(`[DEBUG UNSEND] Command started - event type: ${event.type}, body: "${event.body || 'undefined'}", reply: ${!!event.messageReply}, replyMessageID: ${event.messageReply?.messageID || 'none'}, senderID: ${event.senderID}, botID: ${botID}`);

    try {
      // Fetch thread info with retry
      let threadInfo = null;
      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          threadInfo = await new Promise((resolve, reject) => {
            api.getThreadInfo(threadID, (err, info) => {
              if (err) return reject(err);
              resolve(info);
            });
          });
          console.log(`[DEBUG UNSEND] Thread info fetched successfully on attempt ${attempt}`);
          break;
        } catch (err) {
          console.error(`[ERROR UNSEND] Thread info error on attempt ${attempt}:`, err.message);
          if (attempt === 3) {
            api.sendMessage('⚠️ ग्रुप जानकारी लाने में गलती। बाद में ट्राई करें। 🕉️', threadID);
            return;
          }
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }

      // Check if bot is admin
      const isBotAdmin = threadInfo && Array.isArray(threadInfo.adminIDs) && threadInfo.adminIDs.some(admin => admin.id === botID);
      if (!isBotAdmin && !isMaster) {
        console.log(`[DEBUG UNSEND] Bot not admin and user ${event.senderID} is not master`);
        api.sendMessage('🚫 मुझे एडमिन बनाओ या मास्टर यूज करो! 🙏', threadID);
        return;
      }

      // Check if user is authorized
      const isUserAdmin = isMaster || (threadInfo && Array.isArray(threadInfo.adminIDs) && threadInfo.adminIDs.some(admin => admin.id === event.senderID));
      if (!isUserAdmin) {
        console.log(`[DEBUG UNSEND] User ${event.senderID} is not authorized`);
        api.sendMessage('🚫 केवल मास्टर या एडमिन इस कमांड को यूज कर सकते हैं। 🕉️', threadID);
        return;
      }

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

        // Attempt to unsend with retry
        let responseSent = false;
        for (let attempt = 1; attempt <= 3; attempt++) {
          try {
            await new Promise((resolve, reject) => {
              api.unsendMessage(messageIDToDelete, (err) => {
                if (err) return reject(err);
                resolve();
              });
            });
            console.log(`[DEBUG UNSEND] Message ${messageIDToDelete} unsent successfully`);
            messageStore.removeBotMessage(messageIDToDelete);
            if (!responseSent) {
              responseSent = true;
              api.sendMessage('✅ मैसेज अनसेंड हो गया! 🕉️', threadID);
            }
            return;
          } catch (err) {
            console.error(`[ERROR UNSEND] Unsend failed on attempt ${attempt}:`, err.message);
            if (attempt === 3) {
              if (!responseSent) {
                responseSent = true;
                api.sendMessage(`❌ डिलीट फेल: ${err.message || 'API इश्यू'} 🕉️`, threadID);
              }
              return;
            }
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
        }
      } else if (event.messageReply) {
        console.log('[ERROR UNSEND] Reply detected but no messageID available');
        api.sendMessage('⚠️ रिप्लाई मैसेज ID नहीं मिला। रीट्राई करो। 🕉️', threadID);
        return;
      }

      // Case 2: No reply - delete last 3 bot messages
      console.log('[DEBUG UNSEND] No reply - deleting last 3 bot messages');
      
      const botMessages = messageStore.getLastBotMessages(threadID, 3, botID);
      
      if (botMessages.length === 0) {
        console.log('[DEBUG UNSEND] No bot messages found in messageStore');
        api.sendMessage('❌ कोई बॉट मैसेज नहीं मिला। 🕉️', threadID);
        return;
      }

      api.sendMessage(`✅ लास्ट ${botMessages.length} मैसेज डिलीट कर रहा हूँ... 🕉️`, threadID);

      let success = 0, error = 0;
      for (let i = 0; i < botMessages.length; i++) {
        const msg = botMessages[i];
        for (let attempt = 1; attempt <= 3; attempt++) {
          try {
            await new Promise((resolve, reject) => {
              api.unsendMessage(msg.messageID, (err) => {
                if (err) return reject(err);
                resolve();
              });
            });
            console.log(`[DEBUG UNSEND] Message ${msg.messageID} unsent successfully`);
            messageStore.removeBotMessage(msg.messageID);
            success++;
            break;
          } catch (err) {
            console.error(`[ERROR UNSEND] Failed to unsend message ${msg.messageID} on attempt ${attempt}:`, err.message);
            if (attempt === 3) {
              error++;
              break;
            }
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
        }
      }

      // Send final status
      setTimeout(() => {
        api.sendMessage(`✅ ${success}/${botMessages.length} मैसेज डिलीट! (एरर: ${error}) 🕉️`, threadID);
      }, 2000);

    } catch (e) {
      console.error(`[ERROR UNSEND] General error for thread ${threadID}:`, e.message);
      api.sendMessage(`⚠️ अनसेंड कमांड में गलती: ${e.message} 🕉️`, threadID);
    }
  }
};
