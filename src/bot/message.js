// src/bot/message.js
const messageStore = require('../utils/messageStore');

function sendBotMessage(api, message, threadID, replyToMessageID = null, mentions = [], callback = null) {
  const userId = Object.keys(require('../config/botState').botState.sessions).find(id => require('../config/botState').botState.sessions[id].api === api);
  if (require('../config/botState').botState.sessions[userId]?.safeMode) {
    console.log(`SAFE MODE: Skipping message to ${threadID}`);
    if (callback && typeof callback === 'function') callback(null, null);
    return;
  }
  const randomDelay = Math.floor(Math.random() * 1000) + 1000;
  setTimeout(() => {
    const msgObj = typeof message === 'string' ? { body: message, mentions } : { ...message, mentions };
    if (replyToMessageID && replyToMessageID !== undefined) {
      msgObj.messageReply = { messageID: replyToMessageID };
    }
    api.sendMessage(msgObj, threadID, (err, messageInfo) => {
      if (err) {
        console.error(`[SEND-ERROR] Failed to send with reply: ${err.message}. Trying without reply...`);
        const fallbackMsgObj = typeof message === 'string' ? { body: message, mentions } : { ...message, mentions };
        api.sendMessage(fallbackMsgObj, threadID, (fallbackErr, fallbackInfo) => {
          if (fallbackErr) {
            console.error(`[SEND-ERROR] Fallback failed: ${fallbackErr.message}`);
          } else if (fallbackInfo?.messageID) {
            messageStore.storeBotMessage(fallbackInfo.messageID, typeof message === 'string' ? message : JSON.stringify(message), threadID, replyToMessageID);
          }
          if (callback && typeof callback === 'function') callback(fallbackErr, fallbackInfo);
        });
      } else if (messageInfo?.messageID) {
        messageStore.storeBotMessage(messageInfo.messageID, typeof message === 'string' ? message : JSON.stringify(message), threadID, replyToMessageID);
      }
      if (callback && typeof callback === 'function') callback(err, messageInfo);
    });
  }, randomDelay);
}

module.exports = { sendBotMessage };
