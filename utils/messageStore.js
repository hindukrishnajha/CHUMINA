// messageStore.js - Fixed to handle all bot & user messages properly
const messages = new Map();

module.exports = {
  storeMessage(messageID, content, senderID, threadID, attachment = null, isBot = false) {
    if (!messageID || !threadID) {
      console.error(`[MESSAGE-STORE] Invalid params for storeMessage: ID=${messageID}, thread=${threadID}`);
      return;
    }
    
    let messageContent = content || '[no text]';
    let attachmentData = null;
    
    if (attachment) {
      if (attachment.type === 'sticker') {
        messageContent = '[sticker] ' + (content || '');
        attachmentData = {
          type: 'sticker',
          url: attachment.url || attachment.largePreviewUrl,
          id: attachment.ID || attachment.id
        };
      } else if (attachment.type === 'photo' || attachment.type === 'image') {
        messageContent = '[photo] ' + (content || '');
        attachmentData = {
          type: 'photo', 
          url: attachment.url || attachment.largePreviewUrl || attachment.previewUrl,
          id: attachment.ID || attachment.id
        };
      } else if (attachment.type === 'video') {
        messageContent = '[video] ' + (content || '');
        attachmentData = {
          type: 'video',
          url: attachment.url,
          id: attachment.ID || attachment.id
        };
      } else {
        messageContent = `[${attachment.type}] ` + (content || '');
        attachmentData = attachment;
      }
    }
    
    messages.set(messageID, {
      content: messageContent || '[empty message]',
      senderID,
      threadID,
      attachment: attachmentData,
      timestamp: Date.now(),
      isBotMessage: isBot
    });
    
    console.log(`[MESSAGE-STORE] Stored message: ${messageID} for thread ${threadID}, sender: ${senderID}, isBot: ${isBot}, type: ${attachment ? attachment.type : 'text'}`);
  },

  getMessage(messageID) {
    const msg = messages.get(messageID);
    console.log(`[MESSAGE-STORE] Get message ${messageID}:`, msg ? 'Found' : 'Not found');
    return msg;
  },

  removeMessage(messageID) {
    if (messageID) {
      messages.delete(messageID);
      console.log(`[MESSAGE-STORE] Removed message: ${messageID}`);
    }
  },

  // NEW: Wrapper for api.sendMessage -> auto store bot message
  sendAndStore(api, message, threadID, botID, callback = null) {
    api.sendMessage(message, threadID, (err, info) => {
      if (!err && info && info.messageID) {
        this.storeMessage(info.messageID, 
          typeof message === "string" ? message : (message.body || ''), 
          botID, 
          threadID, 
          message.attachment || null, 
          true
        );
      }
      if (callback) callback(err, info);
    });
  },

  getBotMessageByReply(replyMessageID) {
    if (!replyMessageID) return null;
    
    console.log(`[MESSAGE-STORE] Searching bot message for reply ID: ${replyMessageID}`);
    
    for (let [messageID, message] of messages.entries()) {
      if (message.replyToMessageID === replyMessageID && message.isBotMessage) {
        console.log(`[MESSAGE-STORE] Found bot message ${messageID} for reply ${replyMessageID}`);
        return { ...message, messageID };
      }
    }
    
    console.log(`[MESSAGE-STORE] No bot message found for reply ${replyMessageID}`);
    return null;
  },

  getLastBotMessages(threadID, limit = 3, botID) {
    console.log(`[MESSAGE-STORE] Getting last ${limit} bot messages for thread: ${threadID}, botID: ${botID}`);
    
    const allMessages = Array.from(messages.entries())
      .map(([messageID, msg]) => ({ ...msg, messageID }))
      .filter(msg => (msg.isBotMessage || msg.senderID === botID) && msg.threadID === threadID)
      .sort((a, b) => b.timestamp - a.timestamp);
    
    const result = allMessages.slice(0, limit);
    
    console.log(`[MESSAGE-STORE] Found ${result.length} bot messages for thread ${threadID}:`, 
                result.map(m => `${m.messageID} (${m.content.substring(0, 30)}...)`));
    
    return result;
  },

  removeBotMessage(messageID, botID) {
    const msg = messages.get(messageID);
    if (msg && (msg.isBotMessage || msg.senderID === botID)) {
      messages.delete(messageID);
      console.log(`[MESSAGE-STORE] Removed bot message: ${messageID}`);
      return true;
    }
    console.log(`[MESSAGE-STORE] Cannot remove bot message ${messageID}: Not found or not a bot message`);
    return false;
  },

  getMessagesByBotID(threadID, botID, limit = 3) {
    console.log(`[MESSAGE-STORE] Getting messages by bot ID: ${botID} for thread: ${threadID}`);
    
    const allMessages = Array.from(messages.entries())
      .map(([messageID, msg]) => ({ ...msg, messageID }))
      .filter(msg => (msg.senderID === botID || msg.isBotMessage) && msg.threadID === threadID)
      .sort((a, b) => b.timestamp - a.timestamp);
    
    const result = allMessages.slice(0, limit);
    console.log(`[MESSAGE-STORE] Found ${result.length} messages by bot ID ${botID}`);
    return result;
  },

  clearAll() {
    messages.clear();
    console.log(`[MESSAGE-STORE] Cleared all messages`);
  }
};
