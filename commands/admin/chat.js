// commands/admin/chat.js
module.exports = {
  name: 'chat',
  description: 'Toggle Groq AI chat on or off (admin only)',
  aliases: ['chaton', 'chatoff'],
  execute: async (api, threadID, args, event, botState, isMaster, botID, stopBot) => {
    // सिर्फ एडमिन या मास्टर के लिए
    if (!botState.adminList.includes(event.senderID) && !isMaster) {
      api.sendMessage('🚫 ये कमांड सिर्फ एडमिन्स या मास्टर के लिए है!', threadID);
      return;
    }

    const command = args[0] ? args[0].toLowerCase() : '';
    let chatState = botState.chatEnabled || {}; // डिफॉल्ट स्टेट, अगर नहीं तो नया ऑब्जेक्ट

    if (command === 'on') {
      chatState[threadID] = true;
      api.sendMessage('✅ Groq AI चैट ऑन हो गई! अब #ai या @bot से बात कर सकते हो।', threadID);
    } else if (command === 'off') {
      chatState[threadID] = false;
      api.sendMessage('❌ Groq AI चैट ऑफ हो गई! अब AI जवाब नहीं देगा।', threadID);
    } else {
      api.sendMessage('❓ यूज: #chat on या #chat off', threadID);
      return;
    }

    botState.chatEnabled = chatState; // स्टेट अपडेट
  }
};
