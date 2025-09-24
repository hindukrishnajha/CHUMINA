// messageStore.js - Final Version (Auto tracks bot + user messages)
const messages = new Map();

let wrapped = false;

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

  getBotMessageByReply(replyMessageID) {
    if (!replyMessageID) return null;

    for (let [messageID, message] of messages.entries()) {
      if (message.replyToMessageID === replyMessageID && message.isBotMessage) {
        return { ...message, messageID };
      }
    }
    return null;
  },

  getLastBotMessages(threadID, limit = 3, botID) {
    const allMessages = Array.from(messages.entries())
      .map(([messageID, msg]) => ({ ...msg, messageID }))
      .filter(msg => (msg.isBotMessage || msg.senderID === botID) && msg.threadID === threadID)
      .sort((a, b) => b.timestamp - a.timestamp);

    return allMessages.slice(0, limit);
  },

  removeBotMessage(messageID, botID) {
    const msg = messages.get(messageID);
    if (msg && (msg.isBotMessage || msg.senderID === botID)) {
      messages.delete(messageID);
      console.log(`[MESSAGE-STORE] Removed bot message: ${messageID}`);
      return true;
    }
    return false;
  },

  getMessagesByBotID(threadID, botID, limit = 3) {
    const allMessages = Array.from(messages.entries())
      .map(([messageID, msg]) => ({ ...msg, messageID }))
      .filter(msg => (msg.senderID === botID || msg.isBotMessage) && msg.threadID === threadID)
      .sort((a, b) => b.timestamp - a.timestamp);

    return allMessages.slice(0, limit);
  },

  clearAll() {
    messages.clear();
    console.log(`[MESSAGE-STORE] Cleared all messages`);
  },

  // --- AUTO-WRAP api.sendMessage ---
  wrapApi(api, botID) {
    if (wrapped) return api; // only once
    wrapped = true;

    const originalSend = api.sendMessage;
    api.sendMessage = (message, threadID, callback, replyTo) => {
      return originalSend.call(api, message, threadID, (err, info) => {
        if (!err && info && info.messageID) {
          this.storeMessage(
            info.messageID,
            typeof message === 'string' ? message : (message.body || ''),
            botID,
            threadID,
            message.attachment || null,
            true
          );
        }
        if (typeof callback === 'function') callback(err, info);
      }, replyTo);
    };

    console.log("[MESSAGE-STORE] api.sendMessage wrapped for auto-store ✅");
    return api;
  }
};
