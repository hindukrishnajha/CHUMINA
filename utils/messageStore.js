// messageStore.js
const messages = new Map();

module.exports = {
  storeMessage(messageID, content, senderID, threadID, attachment = null) {
    if (!messageID) {
      console.log('[MESSAGE-STORE] Empty messageID, skipping storage');
      return;
    }
    
    // Content ko properly handle karo
    let messageContent = content;
    if (!messageContent && attachment) {
      messageContent = `[${attachment.type} attachment]`;
    }
    
    messages.set(messageID, {
      content: messageContent || '[empty message]',
      senderID,
      threadID,
      attachment,
      timestamp: Date.now()
    });
    
    console.log(`[MESSAGE-STORE] Stored message: ${messageID} - ${messageContent?.substring(0, 50)}...`);
    
    // Memory management
    if (messages.size > 1000) {
      const sortedKeys = Array.from(messages.keys()).sort((a, b) => messages.get(a).timestamp - messages.get(b).timestamp);
      for (let i = 0; i < 200; i++) {
        messages.delete(sortedKeys[i]);
      }
      console.log('[MESSAGE-STORE] Cleared old messages for memory management');
    }
  },

  getMessage(messageID) {
    const msg = messages.get(messageID);
    console.log(`[MESSAGE-STORE] Retrieving message ${messageID}: ${msg ? 'Found' : 'Not found'}`);
    return msg;
  },

  removeMessage(messageID) {
    const existed = messages.has(messageID);
    messages.delete(messageID);
    console.log(`[MESSAGE-STORE] Removed message ${messageID}: ${existed ? 'Existed' : 'Did not exist'}`);
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
    console.log('[MESSAGE-STORE] Clearing all messages');
    messages.clear();
  }
};
