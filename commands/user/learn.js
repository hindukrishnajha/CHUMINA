// ./commands/learn.js
const fs = require('fs');
const { LEARNED_RESPONSES_PATH } = require('../../config/constants');

module.exports = {
  name: 'learn',
  description: 'Teach the bot a new response for a trigger (available to all group members)',
  execute(api, threadID, args, event, botState) {
    const userId = event.senderID || event.author;
    const fullMsg = event.body?.trim();
    if (!fullMsg || !fullMsg.startsWith('#learn ')) return;

    // Initialize learnedResponses if not exists
    if (!botState.learnedResponses) botState.learnedResponses = {};
    if (!botState.learnedResponses[userId]) botState.learnedResponses[userId] = { triggers: [] };

    // Extract trigger and response using regex
    const match = fullMsg.match(/#learn\s*\(\s*([^)]+)\s*\)\s*\{\s*([^}]+)\s*\}/i);
    if (!match) {
      api.sendMessage('❌ सही फॉर्मेट: #learn (trigger) {response}', threadID);
      return;
    }

    const trigger = match[1].trim().toLowerCase();
    const response = match[2].trim();

    if (!trigger || !response) {
      api.sendMessage('🚫 ट्रिगर और रिस्पॉन्स दोनों चाहिए!', threadID);
      return;
    }

    // Block shalender-related words
    const shalenderVariations = [
      'shalender','shalindra','शैलेंद्र','शेलेंद्र'
    ];
    if (shalenderVariations.some(w => trigger.includes(w) || response.includes(w))) {
      api.sendMessage('🚫 ये शब्द ट्रिगर या रिस्पॉन्स में इस्तेमाल नहीं कर सकते!', threadID);
      return;
    }

    // Save trigger
    let triggerEntry = botState.learnedResponses[userId].triggers.find(t => t.trigger === trigger);
    if (!triggerEntry) {
      triggerEntry = { trigger, responses: [] };
      botState.learnedResponses[userId].triggers.push(triggerEntry);
    }
    triggerEntry.responses.push(response);

    // Save to file
    try {
      fs.writeFileSync(LEARNED_RESPONSES_PATH, JSON.stringify(botState.learnedResponses, null, 2));
      api.sendMessage(`✅ सीखा गया!\nट्रिगर: ${trigger}\nरिस्पॉन्स: ${response}`, threadID);
    } catch (err) {
      console.error(err);
      api.sendMessage(`❌ सेव करने में गलती: ${err.message}`, threadID);
    }
  }
};
