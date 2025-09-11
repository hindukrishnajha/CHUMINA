// utils/messageStore.js
const MAX_AGE = 60 * 60 * 1000; // 1 hour
const CLEANUP_INTERVAL = 10 * 60 * 1000; // 10 min

const messageStore = {
  messages: {}, // All messages
  botMessages: [], // Bot's sent messages
  deleteNotifyEnabled: {}, // Per-thread #delete on/off state

  // Store message
  storeMessage(messageID, content, senderID, threadID) {
    console.log(`[DEBUG] Storing message: messageID=${messageID}, threadID=${threadID}, senderID=${senderID}, content=${content.slice(0, 50)}...`);
    this.messages[messageID] = {
      content,
      senderID,
      threadID,
      timestamp: Date.now()
    };
  },

  // Store bot's sent message
  storeBotMessage(messageID, content, threadID, replyToMessageID = null) {
    console.log(`[DEBUG] Storing bot message: messageID=${messageID}, threadID=${threadID}, replyToMessageID=${replyToMessageID}, content=${content.slice(0, 50)}...`);
    this.botMessages.push({
      messageID,
      content,
      threadID,
      replyToMessageID,
      timestamp: Date.now()
    });
  },

  // Get message by ID
  getMessage(messageID) {
    console.log(`[DEBUG] Fetching message: messageID=${messageID}`);
    return this.messages[messageID];
  },

  // Get last bot message for thread
  getLastBotMessage(threadID) {
    console.log(`[DEBUG] Fetching last bot message for threadID=${threadID}`);
    return this.botMessages
      .filter(msg => msg.threadID === threadID)
      .slice(-1)[0];
  },

  // Get bot message by reply message ID
  getBotMessageByReply(replyMessageID) {
    console.log(`[DEBUG] Fetching bot message by replyMessageID=${replyMessageID}`);
    return this.botMessages.find(msg => msg.replyToMessageID === replyMessageID);
  },

  // Cleanup old messages
  cleanup() {
    const now = Date.now();
    // Clean messages
    for (const mid in this.messages) {
      if (now - this.messages[mid].timestamp > MAX_AGE) {
        console.log(`[DEBUG] Cleaning message: messageID=${mid}`);
        delete this.messages[mid];
      }
    }
    // Clean botMessages
    this.botMessages = this.botMessages.filter(msg => {
      const keep = now - msg.timestamp <= MAX_AGE;
      if (!keep) console.log(`[DEBUG] Cleaning bot message: messageID=${msg.messageID}`);
      return keep;
    });
    console.log('[MEMORY] Cleaned messages:', Object.keys(this.messages).length, 'Bot messages:', this.botMessages.length);
  },

  // Clear all on shutdown
  clearAll() {
    this.messages = {};
    this.botMessages = [];
    console.log('[MEMORY] All message data cleared on shutdown');
  }
};

// Periodic cleanup
setInterval(() => messageStore.cleanup(), CLEANUP_INTERVAL);

module.exports = messageStore;
