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
    
    console.log(`[MESSAGE-STORE] Stored message: ${messageID} for thread ${threadID}`);
    
    // Memory management (commented for testing)
    /*
    if (messages.size > 1000) {
        const sortedKeys = Array.from(messages.keys()).sort((a, b) => messages.get(a).timestamp - messages.get(b).timestamp);
        for (let i = 0; i < 200; i++) {
            messages.delete(sortedKeys[i]);
        }
    }
    */
  },

  getMessage(messageID) {
    return messages.get(messageID);
  },

  removeMessage(messageID) {
    messages.delete(messageID);
  },

  storeBotMessage(messageID, content, threadID, replyToMessageID = null) {
    if (!messageID || !threadID) {
      console.error(`[MESSAGE-STORE] Invalid params for storeBotMessage: ID=${messageID}, thread=${threadID}`);
      return;
    }
    messages.set(messageID, {
      content,
      senderID: 'bot',
      threadID,
      replyToMessageID,
      timestamp: Date.now()
    });
    console.log(`[MESSAGE-STORE] Stored bot message: ${messageID} - ${content.slice(0, 20)}... for thread ${threadID}`);
  },

  getBotMessageByReply(replyMessageID) {
    const message = Array.from(messages.values()).find(msg => msg.replyToMessageID === replyMessageID && msg.senderID === 'bot');
    if (message) {
      const messageID = Array.from(messages.keys()).find(key => messages.get(key) === message);
      return { ...message, messageID };
    }
    return null;
  },

  getLastBotMessages(threadID, limit = 3) {
    const botMessages = Array.from(messages.values())
      .filter(msg => msg.senderID === 'bot' && msg.threadID === threadID)
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, limit)
      .map(msg => ({
        messageID: Array.from(messages.keys()).find(key => messages.get(key) === msg),
        content: msg.content,
        threadID: msg.threadID,
        timestamp: msg.timestamp
      }));
    console.log(`[MESSAGE-STORE] Found ${botMessages.length} bot messages for thread ${threadID}`);
    return botMessages;
  },

  clearAll() {
    messages.clear();
  }
};
