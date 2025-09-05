// commands/admin/automessage.js
const { broadcast } = require('../../utils/broadcast');

module.exports = {
  name: "automessage",
  execute(api, threadID, args, event, botState, isMaster) {
    console.log(`[DEBUG] automessage called: threadID=${threadID}, args=${JSON.stringify(args)}`);
    try {
      if (!isMaster && !botState.adminList.includes(event.senderID)) {
        api.sendMessage('🚫 केवल मास्टर या एडमिन इस कमांड को यूज कर सकते हैं।', threadID);
        return;
      }

      if (!botState.sessions[event.senderID]) {
        console.error('[ERROR] No session found for user:', event.senderID);
        api.sendMessage('⚠️ बॉट सेशन नहीं मिला।', threadID);
        return;
      }

      const botConfig = botState.sessions[event.senderID].botConfig || { autoSpamAccept: false, autoMessageAccept: false };
      botConfig.autoMessageAccept = !botConfig.autoMessageAccept;
      api.sendMessage(`✅ ऑटो मैसेज ${botConfig.autoMessageAccept ? 'चालू' : 'बंद'} कर दिया गया!`, threadID);
      botState.sessions[event.senderID].botConfig = botConfig;

      broadcast({
        type: 'settings',
        autoSpamAccept: botConfig.autoSpamAccept,
        autoMessageAccept: botConfig.autoMessageAccept,
        autoConvo: botConfig.autoConvo,
        userId: event.senderID
      });
    } catch (e) {
      console.error('[ERROR] automessage error:', e.message);
      api.sendMessage('⚠️ ऑटो मैसेज कमांड में गलती।', threadID);
    }
  }
};
