module.exports = {
  name: 'chat',
  description: 'Toggle chat mode on or off (admin only)',
  aliases: ['chaton', 'chatoff'],
  execute: async (api, threadID, args, event, botState, isMaster, botID, stopBot) => {
    // डिबगिंग के लिए लॉग
    console.log('Chat command - SenderID:', event.senderID, 'isMaster:', isMaster, 'AdminList:', botState.adminList, 'Args:', args);

    // सिर्फ एडमिन या मास्टर के लिए
    if (!botState.adminList.includes(event.senderID) && !isMaster) {
      api.sendMessage('🚫 ये कमांड सिर्फ एडमिन्स या मास्टर के लिए है!', threadID);
      return;
    }

    // कमांड और aliases हैंडल करें
    const command = args[1] ? args[1].toLowerCase() : args[0].toLowerCase().replace(/^#/, '');
    let chatState = botState.chatEnabled || { [threadID]: false }; // डिफॉल्ट स्टेट

    if (command === 'on' || command === 'chaton') {
      if (chatState[threadID]) {
        api.sendMessage('✅ चैट मोड पहले से ही ऑन है!', threadID);
        return;
      }
      chatState[threadID] = true;
      api.sendMessage('✅ अब मैं एक्टिव हूँ! नॉर्मल बातचीत के लिए #ai या @bot के साथ मैसेज भेजो।', threadID);
    } else if (command === 'off' || command === 'chatoff') {
      if (!chatState[threadID]) {
        api.sendMessage('✅ चैट मोड पहले से ही ऑफ है!', threadID);
        return;
      }
      chatState[threadID] = false;
      api.sendMessage('❌ मालिक, अब केवल कमांड्स वर्क करेंगी, मैं जवाब नहीं दूंगा।', threadID);
    } else {
      api.sendMessage('❓ यूज: #chat on या #chat off (या #chaton, #chatoff)', threadID);
      return;
    }

    botState.chatEnabled = chatState; // स्टेट अपडेट
    console.log('Chat state updated:', botState.chatEnabled);

    // स्टेट को डिस्क पर सेव करें
    try {
      const fs = require('fs');
      const { LEARNED_RESPONSES_PATH } = require('../../config/constants');
      botState.learnedResponses.chatEnabled = chatState;
      fs.writeFileSync(LEARNED_RESPONSES_PATH, JSON.stringify(botState.learnedResponses, null, 2), 'utf8');
      console.log('Chat state saved to learned_responses.json');
    } catch (err) {
      console.error('Error saving chat state:', err.message);
    }
  }
};
