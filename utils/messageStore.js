const MAX_AGE = 2 * 60 * 60 * 1000; // 2 hours
const CLEANUP_INTERVAL = 15 * 60 * 1000; // 15 min

const messageStore = {
  messages: {}, // All messages
  botMessages: [], // Bot's sent messages
  deleteNotifyEnabled: {}, // Per-thread #delete on/off state

  storeMessage(messageID, content, senderID, threadID, attachment = null) {
    const normalizedThreadID = String(threadID); // Normalize threadID to string
    const key = `${normalizedThreadID}_${messageID}`; // Unique key with threadID
    console.log(
      `[DEBUG] Storing message: key=${key}, messageID=${messageID}, threadID=${normalizedThreadID}, senderID=${senderID}, content=${content.slice(0, 50)}..., attachment=${
        attachment ? JSON.stringify(attachment) : 'none'
      }`
    );
    this.messages[key] = {
      content,
      senderID,
      threadID: normalizedThreadID,
      attachment,
      timestamp: Date.now(),
    };
  },

  storeBotMessage(messageID, content, threadID, replyToMessageID = null) {
    const normalizedThreadID = String(threadID);
    console.log(
      `[DEBUG] Storing bot message: messageID=${messageID}, threadID=${normalizedThreadID}, replyToMessageID=${replyToMessageID || 'none'}, content=${content.slice(0, 50)}...`
    );
    this.botMessages.push({
      messageID,
      content,
      threadID: normalizedThreadID,
      replyToMessageID,
      timestamp: Date.now(),
    });
  },

  getMessage(messageID, threadID) {
    const normalizedThreadID = String(threadID);
    const key = `${normalizedThreadID}_${messageID}`;
    console.log(`[DEBUG] Fetching message: key=${key}, messageID=${messageID}, threadID=${normalizedThreadID}, available keys=${JSON.stringify(Object.keys(this.messages))}`);
    return this.messages[key];
  },

  getLastBotMessages(threadID, count = 3) {
    const normalizedThreadID = String(threadID);
    console.log(`[DEBUG] Fetching last ${count} bot messages for threadID=${normalizedThreadID}`);
    return this.botMessages.filter((msg) => msg.threadID === normalizedThreadID).slice(-count); // Last N (recent)
  },

  getBotMessageByReply(replyMessageID) {
    console.log(`[DEBUG] Fetching bot message by replyMessageID=${replyMessageID}`);
    return this.botMessages.find((msg) => msg.replyToMessageID === replyMessageID || msg.messageID === replyMessageID);
  },

  removeMessage(messageID, threadID) {
    const normalizedThreadID = String(threadID);
    const key = `${normalizedThreadID}_${messageID}`;
    console.log(`[DEBUG] Removing message from store: key=${key}, messageID=${messageID}`);
    delete this.messages[key];
  },

  removeBotMessage(messageID) {
    console.log(`[DEBUG] Removing bot message from store: messageID=${messageID}`);
    const index = this.botMessages.findIndex((msg) => msg.messageID === messageID);
    if (index > -1) {
      this.botMessages.splice(index, 1);
    }
  },

  cleanup() {
    const now = Date.now();
    let cleanedCount = 0;
    for (const key in this.messages) {
      if (now - this.messages[key].timestamp > MAX_AGE) {
        console.log(`[DEBUG] Cleaning message: key=${key}`);
        delete this.messages[key];
        cleanedCount++;
      }
    }
    let botCleaned = 0;
    this.botMessages = this.botMessages.filter((msg) => {
      const keep = now - msg.timestamp <= MAX_AGE;
      if (!keep) {
        console.log(`[DEBUG] Cleaning bot message: messageID=${msg.messageID}`);
        botCleaned++;
      }
      return keep;
    });
    console.log(
      `[MEMORY] Cleaned ${cleanedCount} messages, ${botCleaned} bot messages. Remaining: Messages=${Object.keys(this.messages).length}, Bot=${this.botMessages.length}`
    );
  },

  clearAll() {
    this.messages = {};
    this.botMessages = [];
    console.log('[MEMORY] All message data cleared on shutdown');
  },
};

setInterval(() => messageStore.cleanup(), CLEANUP_INTERVAL);

module.exports = messageStore;
