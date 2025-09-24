// ./commands/admin/antiout.js
const botConfig = require('../../config/botConfig');

module.exports = {
  name: "antiout",
  execute(api, threadID, args, event, botState, isMaster) {
    try {
      if (!isMaster && !botState.adminList.includes(event.senderID)) {
        api.sendMessage('🚫 केवल मास्टर या एडमिन इस कमांड को यूज कर सकते हैं।', threadID);
        return;
      }

      // ✅ args[0] instead of args[1]
      const option = args[0]?.toLowerCase();

      if (option === 'on') {
        botConfig.antiOut = true;
        api.sendMessage('🛡️ Anti-out सिस्टम चालू! अब मेंबर्स ग्रुप छोड़ नहीं सकते!', threadID);
      } else if (option === 'off') {
        botConfig.antiOut = false;
        api.sendMessage('🛡️ Anti-out सिस्टम बंद!', threadID);
      } else {
        api.sendMessage(`उपयोग: ${botState.sessions[event.senderID]?.prefix || '#'}antiout on/off`, threadID);
      }
    } catch (e) {
      console.error('[ERROR] antiout error:', e.message);
      api.sendMessage('⚠️ Antiout कमांड में गलती।', threadID);
    }
  }
};
