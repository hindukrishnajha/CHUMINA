module.exports = {
  name: 'chat',
  description: 'Toggle chat mode on or off (admin only)',
  aliases: ['chaton', 'chatoff'],
  execute: async (api, threadID, args, event, botState, isMaster) => {
    console.log('Chat command - SenderID:', event.senderID, 'isMaster:', isMaster, 'AdminList:', botState.adminList, 'Args:', args);

    if (!botState.adminList.includes(event.senderID) && !isMaster) {
      api.sendMessage('🚫 ये कमांड सिर्फ एडमिन्स या मास्टर के लिए है!', threadID);
      return;
    }

    const command = args[1] ? args[1].toLowerCase() : args[0].toLowerCase().replace(/^#/, '');
    let chatState = botState.chatEnabled || { [threadID]: false };

    if (command === 'on' || command === 'chaton') {
      if (chatState[threadID]) {
        api.sendMessage('✅ चैट मोड पहले से ऑन है! #ai या @ai यूज करो।', threadID);
        return;
      }
      chatState[threadID] = true;
      api.sendMessage('✅ चैट मोड ऑन! अब #ai या @ai के साथ बात करो, जैसे: #ai हाय भाई!', threadID);
    } else if (command === 'off' || command === 'chatoff') {
      if (!chatState[threadID]) {
        api.sendMessage('✅ चैट मोड पहले से ऑफ है!', threadID);
        return;
      }
      chatState[threadID] = false;
      api.sendMessage('❌ चैट मोड ऑफ! अब सिर्फ कमांड्स काम करेंगी।', threadID);
    } else {
      api.sendMessage('❓ यूज: #chat on या #chat off (या #chaton, #chatoff)', threadID);
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
      api.sendMessage('⚠️ चैट स्टेट सेव करने में गड़बड़!', threadID);
    }
  }
};
