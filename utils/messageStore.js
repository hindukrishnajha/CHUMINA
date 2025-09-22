const messages = new Map();

module.exports = {
  storeMessage(messageID, content, senderID, threadID, attachment = null) {
    if (!messageID) return;
    
    let messageContent = content;
    let attachmentData = null;
    
    // ATTACHMENT HANDLING - IMPROVED
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
    
    console.log(`[MESSAGE-STORE] Stored: ${messageID} - ${messageContent}`);
    
    // Memory management
    if (messages.size > 1000) {
        const sortedKeys = Array.from(messages.keys()).sort((a, b) => messages.get(a).timestamp - messages.get(b).timestamp);
        for (let i = 0; i < 200; i++) {
            messages.delete(sortedKeys[i]);
        }
    }
  },

  getMessage(messageID) {
    return messages.get(messageID);
  },

  removeMessage(messageID) {
    messages.delete(messageID);
  },

  storeBotMessage(messageID, content, threadID, replyToMessageID = null) {
    if (!messageID) return;
    messages.set(messageID, {
      content,
      senderID: 'bot',
      threadID,
      replyToMessageID,
      timestamp: Date.now()
    });
  },

  clearAll() {
    messages.clear();
  }
};
