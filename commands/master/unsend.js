module.exports = {
  name: 'unsend',
  execute: async (api, threadID, args, event, botState, isMaster, botID, stopBot) => {
    if (!isMaster) {
      api.sendMessage('🚫 ये कमांड सिर्फ मास्टर के लिए है! 🕉️', threadID);
      return;
    }

    const userId = Object.keys(botState.sessions).find(id => botState.sessions[id].api === api);
    if (botState.sessions[userId]?.safeMode) {
      console.log(`[SAFE] Skipping unsend in SAFE MODE for thread ${threadID}`);
      api.sendMessage('⚠️ SAFE MODE में है, मैसेज डिलीट नहीं कर सकता। कुकीज अपडेट करो! 🕉️', threadID);
      return;
    }

    const tryDeleteMessage = (messageID, attempt = 1, maxAttempts = 2) => {
      api.deleteMessage(messageID, (err) => {
        if (err && attempt < maxAttempts) {
          console.error(`[ERROR] Unsend attempt ${attempt} failed for messageID=${messageID}: ${err.message}`);
          setTimeout(() => tryDeleteMessage(messageID, attempt + 1, maxAttempts), 2000);
          return;
        }
        if (err) {
          console.error(`[ERROR] Failed to unsend messageID=${messageID}: ${err.message}`);
          api.sendMessage('❌ मैसेज डिलीट करने में गलती हुई।', threadID);
          return;
        }
        console.log(`[DEBUG] Successfully unsent messageID=${messageID} in thread ${threadID}`);
        api.sendMessage('✅ मैसेज डिलीट कर दिया गया! 🕉️', threadID);
      });
    };

    if (event.messageReply && event.messageReply.messageID) {
      const replyMessageID = event.messageReply.messageID;
      console.log(`[DEBUG] Unsend requested for replied messageID=${replyMessageID}, threadID=${threadID}`);
      tryDeleteMessage(replyMessageID);
    } else {
      api.getThreadHistory(threadID, 2, null, (err, history) => {
        if (err || !history || history.length < 2) {
          console.error(`[ERROR] Failed to fetch thread history for unsend: ${err?.message || 'No history'}`);
          api.sendMessage('❌ लास्ट मैसेज नहीं मिला।', threadID);
          return;
        }
        const lastBotMessage = history.find(msg => msg.senderID === botID && msg.messageID !== event.messageID);
        if (lastBotMessage) {
          console.log(`[DEBUG] Unsend requested for last bot messageID=${lastBotMessage.messageID}, threadID=${threadID}`);
          tryDeleteMessage(lastBotMessage.messageID);
        } else {
          console.error(`[ERROR] No bot message found in history for unsend, threadID=${threadID}`);
          api.sendMessage('❌ कोई डिलीट करने लायक मैसेज नहीं मिला।', threadID);
        }
      });
    }
  }
};
