// commands/admin/antiout.js
module.exports = {
  name: "antiout",
  execute(api, threadID, args, event, botState, isMaster) {
    try {
      if (!isMaster && !botState.adminList.includes(event.senderID)) {
        api.sendMessage('🚫 केवल मास्टर या एडमिन इस कमांड को यूज कर सकते हैं।', threadID);
        return;
      }

      const botConfig = botState.sessions[event.senderID]?.botConfig || { antiOut: false };
      if (args[1] === 'on') {
        botConfig.antiOut = true;
        botState.sessions[event.senderID].botConfig = botConfig;
        api.sendMessage('🛡️ Anti-out सिस्टम चालू! अब मेंबर्स ग्रुप छोड़ नहीं सकते!', threadID);
      } else if (args[1] === 'off') {
        botConfig.antiOut = false;
        botState.sessions[event.senderID].botConfig = botConfig;
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
