// messageStore.js - Fixed version to handle all bot messages (text, sticker, etc.) without breaking other commands
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

  storeBotMessage(messageID, content, threadID, replyToMessageID = null, botID, attachment = null) {
    if (!messageID || !threadID) {
      console.error(`[MESSAGE-STORE] Invalid params for storeBotMessage: ID=${messageID}, thread=${threadID}`);
      return;
    }
    
    let messageContent = content || '[bot message]';
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
      content: messageContent,
      senderID: botID,
      threadID,
      replyToMessageID,
      attachment: attachmentData,
      timestamp: Date.now(),
      isBotMessage: true
    });
    
    console.log(`[MESSAGE-STORE] Stored BOT message: ${messageID} for thread ${threadID}, sender: ${botID}, replyTo: ${replyToMessageID || 'none'}, type: ${attachment ? attachment.type : 'text'}`);
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
    console.log(`[MESSAGE-STORE] Getting last ${limit} bot messages for thread: ${threadID}`);
    
    const allMessages = Array.from(messages.entries())
      .map(([messageID, msg]) => ({ ...msg, messageID }))
      .filter(msg => (msg.isBotMessage || msg.senderID === botID) && msg.threadID === threadID)
      .sort((a, b) => b.timestamp - a.timestamp);
    
    const result = allMessages.slice(0, limit);
    
    console.log(`[MESSAGE-STORE] Found ${result.length} bot messages for thread ${threadID}:`, 
                result.map(m => `${m.messageID} (${m.content.substring(0, 30)}...)`));
    
    if (result.length === 0) {
      console.log(`[MESSAGE-STORE] DEBUG: All messages in store for thread ${threadID}:`);
      messages.forEach((msg, id) => {
        if (msg.threadID === threadID) {
          console.log(`[MESSAGE-STORE] DEBUG: ${id} -> sender: ${msg.senderID}, isBot: ${msg.isBotMessage}, content: ${msg.content.substring(0, 50)}, type: ${msg.attachment ? msg.attachment.type : 'text'}`);
        }
      });
    }
    
    return result;
  },

  removeBotMessage(messageID) {
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
