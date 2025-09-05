// commands/admin/autospam.js
const { broadcast } = require('../../utils/broadcast');

module.exports = {
  name: "autospam",
  execute(api, threadID, args, event, botState, isMaster) {
    console.log(`[DEBUG] autospam called: threadID=${threadID}, args=${JSON.stringify(args)}`);
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
      botConfig.autoSpamAccept = !botConfig.autoSpamAccept;
      api.sendMessage(`✅ ऑटो स्पैम ${botConfig.autoSpamAccept ? 'चालू' : 'बंद'} कर दिया गया!`, threadID);
      botState.sessions[event.senderID].botConfig = botConfig;

      broadcast({
        type: 'settings',
        autoSpamAccept: botConfig.autoSpamAccept,
        autoMessageAccept: botConfig.autoMessageAccept,
        autoConvo: botConfig.autoConvo,
        userId: event.senderID
      });
    } catch (e) {
      console.error('[ERROR] autospam error:', e.message);
      api.sendMessage('⚠️ ऑटो स्पैम कमांड में गलती।', threadID);
    }
  }
};
