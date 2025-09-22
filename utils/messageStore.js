// messageStore.js
const messages = new Map();

module.exports = {
  storeMessage(messageID, content, senderID, threadID, attachment = null) {
    if (!messageID) return;
    messages.set(messageID, {
      content,
      senderID,
      threadID,
      attachment,
      timestamp: Date.now()
    });
    // मेमोरी बचाने के लिए पुराने मैसेज हटाएं
    if (messages.size > 1000) {
      const sortedKeys = Array.from(messages.keys()).sort((a, b) => messages.get(a).timestamp - messages.get(b).timestamp);
      for (let i = 0; i < messages.size - 500; i++) {
        messages.delete(sortedKeys[i]);
      }
      console.log('[MESSAGE-STORE] पुराने मैसेज हटाए गए ताकि मेमोरी लिमिट में रहे');
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
