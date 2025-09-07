const fs = require('fs');
const { LEARNED_RESPONSES_PATH } = require('../../config/constants');

module.exports = {
  name: 'learn',
  description: 'Teach the bot a new response for a trigger',
  execute(api, threadID, args, event, botState, isMaster, botID, stopBot, broadcast) {
    const userId = botState.sessions[event.threadID]?.botID || event.senderID;
    console.log(`Learning response for userId: ${userId}, threadID: ${threadID}, senderID: ${event.senderID}`);

    if (!botState.learnedResponses[userId]) {
      botState.learnedResponses[userId] = { triggers: [] };
      console.log(`Initialized learnedResponses for userId: ${userId}`);
    }

    if (args.length < 2) {
      api.sendMessage('🚫 यूज: #learn <trigger> <response>', threadID);
      return;
    }

    const trigger = args[1].trim();
    const response = args.slice(2).join(' ').trim();

    if (!trigger || !response) {
      api.sendMessage('🚫 ट्रिगर और रिस्पॉन्स दोनों चाहिए!', threadID);
      return;
    }

    botState.learnedResponses[userId].triggers = botState.learnedResponses[userId].triggers.filter(t => t.trigger.toLowerCase() !== trigger.toLowerCase());
    botState.learnedResponses[userId].triggers.push({ trigger, response });
    console.log(`Stored trigger: ${trigger}, response: ${response} for userId: ${userId}`);

    try {
      fs.writeFileSync(LEARNED_RESPONSES_PATH, JSON.stringify(botState.learnedResponses, null, 2));
      api.sendMessage(`✅ नया रिस्पॉन्स सीखा गया!\nट्रिगर: ${trigger}\nरिस्पॉन्स: ${response}`, threadID);
    } catch (err) {
      console.error(`Error saving learned responses: ${err.message}`);
      api.sendMessage(`❌ रिस्पॉन्स सेव करने में गलती: ${err.message}`, threadID);
    }
  }
};
