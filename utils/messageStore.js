const MAX_AGE = 2 * 60 * 60 * 1000; // 2 hours
const CLEANUP_INTERVAL = 15 * 60 * 1000; // 15 min

const messageStore = {
  messages: {}, // All messages
  botMessages: [], // Bot's sent messages
  deleteNotifyEnabled: {}, // Per-thread #delete on/off state

  storeMessage(messageID, content, senderID, threadID, attachment = null) {
    console.log(`[DEBUG] Storing message: messageID=${messageID}, threadID=${threadID}, senderID=${senderID}, content=${content.slice(0, 50)}..., attachment=${attachment ? JSON.stringify(attachment) : 'none'}`);
    this.messages[messageID] = {
      content,
      senderID,
      threadID,
      attachment,
      timestamp: Date.now()
    };
  },

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

  getMessage(messageID) {
    console.log(`[DEBUG] Fetching message: messageID=${messageID}`);
    return this.messages[messageID];
  },

  getLastBotMessages(threadID, count = 3) {
    console.log(`[DEBUG] Fetching last ${count} bot messages for threadID=${threadID}`);
    return this.botMessages
      .filter(msg => msg.threadID === threadID)
      .slice(-count); // Last N (recent)
  },

  getBotMessageByReply(replyMessageID) {
    console.log(`[DEBUG] Fetching bot message by replyMessageID=${replyMessageID}`);
    return this.botMessages.find(msg => msg.replyToMessageID === replyMessageID || msg.messageID === replyMessageID);
  },

  removeBotMessage(messageID) {
    console.log(`[DEBUG] Removing bot message from store: messageID=${messageID}`);
    const index = this.botMessages.findIndex(msg => msg.messageID === messageID);
    if (index > -1) {
      this.botMessages.splice(index, 1);
    }
  },

  cleanup() {
    const now = Date.now();
    for (const mid in this.messages) {
      if (now - this.messages[mid].timestamp > MAX_AGE) {
        console.log(`[DEBUG] Cleaning message: messageID=${mid}`);
        delete this.messages[mid];
      }
    }
    this.botMessages = this.botMessages.filter(msg => {
      const keep = now - msg.timestamp <= MAX_AGE;
      if (!keep) console.log(`[DEBUG] Cleaning bot message: messageID=${msg.messageID}`);
      return keep;
    });
    console.log('[MEMORY] Cleaned messages:', Object.keys(this.messages).length, 'Bot messages:', this.botMessages.length);
  },

  clearAll() {
    this.messages = {};
    this.botMessages = [];
    console.log('[MEMORY] All message data cleared on shutdown');
  }
};

setInterval(() => messageStore.cleanup(), CLEANUP_INTERVAL);

module.exports = messageStore;
