// commands/admin/chat.js
module.exports = {
  name: 'chat',
  description: 'Toggle chat mode on or off (admin only)',
  aliases: ['chaton', 'chatoff'],
  execute: async (api, threadID, args, event, botState, isMaster, botID, stopBot) => {
    // सिर्फ एडमिन या मास्टर के लिए
    if (!botState.adminList.includes(event.senderID) && !isMaster) {
      api.sendMessage('🚫 ये कमांड सिर्फ एडमिन्स या मास्टर के लिए है!', threadID);
      return;
    }

    const command = args[0] ? args[0].toLowerCase() : '';
    let chatState = botState.chatEnabled || {}; // डिफॉल्ट स्टेट

    if (command === 'on') {
      chatState[threadID] = true;
      api.sendMessage('✅ अब मैं एक्टिव हूँ! नॉर्मल बातचीत के लिए #ai या @bot के साथ मैसेज भेजो।', threadID);
    } else if (command === 'off') {
      chatState[threadID] = false;
      api.sendMessage('❌ मालिक, अब केवल कमांड्स वर्क करेंगी, मैं जवाब नहीं दूंगा।', threadID);
    } else {
      api.sendMessage('❓ यूज: #chat on या #chat off', threadID);
      return;
    }

    botState.chatEnabled = chatState; // स्टेट अपडेट
  }
};
