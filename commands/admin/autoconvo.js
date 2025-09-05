// commands/admin/autoconvo.js
const { broadcast } = require('../../utils/broadcast');

module.exports = {
  name: "autoconvo",
  execute(api, threadID, args, event, botState, isMaster) {
    try {
      if (!isMaster && !botState.adminList.includes(event.senderID)) {
        api.sendMessage('🚫 केवल मास्टर या एडमिन इस कमांड को यूज कर सकते हैं।', threadID);
        return;
      }

      if (!botState.sessions[event.senderID]) {
        api.sendMessage('⚠️ बॉट सेशन नहीं मिला।', threadID);
        return;
      }

      const botConfig = botState.sessions[event.senderID].botConfig || { autoConvo: false };
      const action = args[1]?.toLowerCase();

      if (action === 'on') {
        botConfig.autoConvo = true;
        api.sendMessage('✅ ऑटो कन्वर्सेशन चालू कर दिया गया!', threadID);
      } else if (action === 'off') {
        botConfig.autoConvo = false;
        api.sendMessage('✅ ऑटो कन्वर्सेशन बंद कर दिया गया!', threadID);
      } else {
        api.sendMessage('❌ यूज: #autoconvo on/off', threadID);
        return;
      }

      botState.sessions[event.senderID].botConfig = botConfig;

      broadcast({
        type: 'settings',
        autoConvo: botConfig.autoConvo,
        autoSpamAccept: botConfig.autoSpamAccept,
        autoMessageAccept: botConfig.autoMessageAccept,
        userId: event.senderID
      });
    } catch (e) {
      console.error('[ERROR] autoconvo error:', e.message);
      api.sendMessage('⚠️ ऑटो कन्वर्सेशन कमांड में गलती।', threadID);
    }
  }
};
