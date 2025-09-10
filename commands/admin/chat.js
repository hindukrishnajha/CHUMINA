module.exports = {
  name: 'chat',
  description: 'Toggle chat mode on or off (admin only)',
  aliases: ['chaton', 'chatoff'],
  execute: async (api, threadID, args, event, botState, isMaster) => {
    console.log('Chat command - SenderID:', event.senderID, 'isMaster:', isMaster, 'AdminList:', botState.adminList, 'Args:', args);

    if (!botState.adminList.includes(event.senderID) && !isMaster) {
      api.sendMessage('🚫 ये कमांड सिर्फ किंग के खास एडमिन्स या मास्टर के लिए है! 🌟', threadID);
      return;
    }

    const command = args[1] ? args[1].toLowerCase() : args[0].toLowerCase().replace(/^#/, '');
    let chatState = botState.chatEnabled || { [threadID]: false };

    if (command === 'on' || command === 'chaton') {
      if (chatState[threadID]) {
        api.sendMessage('🌟 AI पहले से चालू है, भाई! #ai या @ai से बात कर, जैसे: #ai हाय भाई, क्या हाल है? 😎', threadID);
        return;
      }
      chatState[threadID] = true;
      api.sendMessage('🔥 AI चालू! अब #ai या @ai से बात करो, जैसे: #ai भाई, क्या हाल है? 😎', threadID);
    } else if (command === 'off' || command === 'chatoff') {
      if (!chatState[threadID]) {
        api.sendMessage('🌙 AI पहले से बंद है, भाई! सिर्फ कमांड्स चालू। 🌟', threadID);
        return;
      }
      chatState[threadID] = false;
      api.sendMessage('❌ AI बंद! अब सिर्फ किंग के कमांड्स काम करेंगे। 🌟', threadID);
    } else {
      api.sendMessage('❓ यूज करो: #chat on या #chat off (या #chaton, #chatoff)। किंग के नियम समझो! 😎', threadID);
      return;
    }

    botState.chatEnabled = chatState;
    console.log('Chat state updated:', botState.chatEnabled);

    try {
      const fs = require('fs');
      const { LEARNED_RESPONSES_PATH } = require('../../config/constants');
      botState.learnedResponses.chatEnabled = chatState;
      botState.learnedResponses.adminList = botState.adminList;
      fs.writeFileSync(LEARNED_RESPONSES_PATH, JSON.stringify(botState.learnedResponses, null, 2), 'utf8');
      console.log('Chat state and adminList saved to learned_responses.json');
    } catch (err) {
      console.error('Error saving to learned_responses.json:', err.message);
      api.sendMessage('⚠️ चैट स्टेट सेव करने में गड़बड़! किंग को बताओ! 🌟', threadID);
    }
  }
};
