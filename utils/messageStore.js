// utils/messageStore.js
const MAX_AGE = 60 * 60 * 1000; // 1 hour
const CLEANUP_INTERVAL = 10 * 60 * 1000; // 10 min

const messageStore = {
  messages: {}, // All messages
  botMessages: [], // Bot's sent messages
  deleteNotifyEnabled: {}, // Per-thread #delete on/off state

  // Store message
  storeMessage(messageID, content, senderID, threadID) {
    this.messages[messageID] = {
      content,
      senderID,
      threadID,
      timestamp: Date.now()
    };
  },

  // Store bot's sent message
  storeBotMessage(messageID, content, threadID) {
    this.botMessages.push({
      messageID,
      content,
      threadID,
      timestamp: Date.now()
    });
  },

  // Get message by ID
  getMessage(messageID) {
    return this.messages[messageID];
  },

  // Get last bot message for thread
  getLastBotMessage(threadID) {
    return this.botMessages
      .filter(msg => msg.threadID === threadID)
      .slice(-1)[0]; // Latest message
  },

  // Cleanup old messages
  cleanup() {
    const now = Date.now();
    // Clean messages
    for (const mid in this.messages) {
      if (now - this.messages[mid].timestamp > MAX_AGE) {
        delete this.messages[mid];
      }
    }
    // Clean botMessages
    this.botMessages = this.botMessages.filter(msg => now - msg.timestamp <= MAX_AGE);
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
