// messageStore.js - Fixed version
const messages = new Map();

module.exports = {
  storeMessage(messageID, content, senderID, threadID, attachment = null) {
    if (!messageID || !threadID) {
      console.error(`[MESSAGE-STORE] Invalid params for storeMessage: ID=${messageID}, thread=${threadID}`);
      return;
    }
    
    let messageContent = content;
    let attachmentData = null;
    
    if (attachment) {
        if (attachment.type === 'sticker') {
            messageContent = '[attachment: sticker]';
            attachmentData = {
                type: 'sticker',
                url: attachment.url || attachment.largePreviewUrl,
                id: attachment.ID || attachment.id
            };
        } else if (attachment.type === 'photo' || attachment.type === 'image') {
            messageContent = '[attachment: photo]';
            attachmentData = {
                type: 'photo', 
                url: attachment.url || attachment.largePreviewUrl || attachment.previewUrl,
                id: attachment.ID || attachment.id
            };
        } else if (attachment.type === 'video') {
            messageContent = '[attachment: video]';
            attachmentData = {
                type: 'video',
                url: attachment.url,
                id: attachment.ID || attachment.id
            };
        } else {
            messageContent = `[attachment: ${attachment.type}]`;
            attachmentData = attachment;
        }
    }
    
    messages.set(messageID, {
        content: messageContent || '[empty message]',
        senderID,
        threadID,
        attachment: attachmentData,
        timestamp: Date.now()
    });
    
    console.log(`[MESSAGE-STORE] Stored message: ${messageID} for thread ${threadID}, sender: ${senderID}`);
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

  storeBotMessage(messageID, content, threadID, replyToMessageID = null) {
    if (!messageID || !threadID) {
      console.error(`[MESSAGE-STORE] Invalid params for storeBotMessage: ID=${messageID}, thread=${threadID}`);
      return;
    }
    
    messages.set(messageID, {
      content: content || '[empty bot message]',
      senderID: 'bot',
      threadID,
      replyToMessageID,
      timestamp: Date.now(),
      isBotMessage: true // Additional flag for easy identification
    });
    
    console.log(`[MESSAGE-STORE] Stored BOT message: ${messageID} for thread ${threadID}, replyTo: ${replyToMessageID}`);
  },

  getBotMessageByReply(replyMessageID) {
    if (!replyMessageID) return null;
    
    console.log(`[MESSAGE-STORE] Searching bot message for reply ID: ${replyMessageID}`);
    
    for (let [messageID, message] of messages.entries()) {
      if (message.replyToMessageID === replyMessageID && message.senderID === 'bot') {
        console.log(`[MESSAGE-STORE] Found bot message ${messageID} for reply ${replyMessageID}`);
        return { ...message, messageID };
      }
    }
    
    console.log(`[MESSAGE-STORE] No bot message found for reply ${replyMessageID}`);
    return null;
  },

  getLastBotMessages(threadID, limit = 3) {
    console.log(`[MESSAGE-STORE] Getting last ${limit} bot messages for thread: ${threadID}`);
    
    const allMessages = Array.from(messages.entries())
      .map(([messageID, msg]) => ({ ...msg, messageID }))
      .filter(msg => msg.senderID === 'bot' && msg.threadID === threadID)
      .sort((a, b) => b.timestamp - a.timestamp);
    
    const result = allMessages.slice(0, limit);
    
    console.log(`[MESSAGE-STORE] Found ${result.length} bot messages for thread ${threadID}:`, 
                result.map(m => `${m.messageID} (${new Date(m.timestamp).toLocaleTimeString()})`));
    
    return result;
  },

  removeBotMessage(messageID) {
    const msg = messages.get(messageID);
    if (msg && msg.senderID === 'bot') {
      messages.delete(messageID);
      console.log(`[MESSAGE-STORE] Removed bot message: ${messageID}`);
      return true;
    }
    return false;
  },

  // Debug function to see all stored messages
  debugMessages() {
    console.log(`[MESSAGE-STORE] Total messages stored: ${messages.size}`);
    messages.forEach((msg, id) => {
      console.log(`[MESSAGE-STORE] ${id}: ${msg.senderID} -> ${msg.content.substring(0, 50)}...`);
    });
  },

  clearAll() {
    messages.clear();
    console.log(`[MESSAGE-STORE] Cleared all messages`);
  }
};
