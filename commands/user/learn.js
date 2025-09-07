const fs = require('fs');
const { LEARNED_RESPONSES_PATH } = require('../../config/constants');

module.exports = {
  name: 'learn',
  description: 'Teach the bot a new response for a trigger (available to all group members)',
  execute(api, threadID, args, event, botState) {
    const userId = event.senderID; // Har user apne liye trigger set kar sakta hai
    console.log(`Learning response for userId: ${userId}, threadID: ${threadID}, senderID: ${event.senderID}`);

    // Initialize learnedResponses for user if not exists
    if (!botState.learnedResponses[userId]) {
      botState.learnedResponses[userId] = { triggers: [] };
      console.log(`Initialized learnedResponses for userId: ${userId}`);
    }

    // Check if trigger and response are provided
    if (args.length < 2) {
      api.sendMessage('🚫 यूज: #learn (trigger) {response}\nउदाहरण: #learn (hello) {Hi there!}', threadID);
      return;
    }

    // Extract trigger (between parentheses) and response
    const triggerMatch = args[1].match(/^\((.+)\)$/);
    if (!triggerMatch) {
      api.sendMessage('❌ ट्रिगर को ( ) में डालें, जैसे: #learn (trigger) {response}', threadID);
      return;
    }
    const trigger = triggerMatch[1].trim();
    const responseMatch = args.slice(2).join(' ').match(/^\{(.+)\}$/);
    if (!responseMatch) {
      api.sendMessage('❌ रिस्पॉन्स को { } में डालें, जैसे: #learn (trigger) {response}', threadID);
      return;
    }
    const response = responseMatch[1].trim();

    if (!trigger || !response) {
      api.sendMessage('🚫 ट्रिगर और रिस्पॉन्स दोनों चाहिए!', threadID);
      return;
    }

    // Block shalender-related words
    const shalenderVariations = [
      'shalender', 'selender', 'shlender', 'shalendra', 'shlendra',
      'shelndr', 'shlndr', 'शेलेन्द्र', 'सिलेंडर', 'शैलेन्द्र'
    ];
    const lowerTrigger = trigger.toLowerCase();
    const lowerResponse = response.toLowerCase();
    if (shalenderVariations.some(variation => lowerTrigger.includes(variation) || lowerResponse.includes(variation))) {
      api.sendMessage('🚫 Shalender से related words trigger या response में allowed नहीं हैं!', threadID);
      return;
    }

    // Find or create trigger entry
    let triggerEntry = botState.learnedResponses[userId].triggers.find(t => t.trigger.toLowerCase() === lowerTrigger);
    if (!triggerEntry) {
      triggerEntry = { trigger, responses: [] };
      botState.learnedResponses[userId].triggers.push(triggerEntry);
    }

    // Add new response to trigger
    triggerEntry.responses.push(response);
    console.log(`Stored trigger: ${trigger}, response: ${response} for userId: ${userId}`);

    // Save to learned_responses.json
    try {
      fs.writeFileSync(LEARNED_RESPONSES_PATH, JSON.stringify(botState.learnedResponses, null, 2));
      api.sendMessage(`✅ नया रिस्पॉन्स सीखा गया!\nट्रिगर: ${trigger}\nरिस्पॉन्स: ${response}`, threadID);
    } catch (err) {
      console.error(`Error saving learned responses: ${err.message}`);
      api.sendMessage(`❌ रिस्पॉन्स सेव करने में गलती: ${err.message}`, threadID);
    }
  }
};
