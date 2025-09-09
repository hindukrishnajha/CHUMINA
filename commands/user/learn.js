const fs = require('fs');
const { LEARNED_RESPONSES_PATH } = require('../../config/constants');

module.exports = {
  name: 'learn',
  description: 'Teach the bot a new response for a trigger (available to all group members)',
  execute(api, threadID, args, event, botState) {
    const userId = event.senderID || event.author; // Handle undefined senderID with event.author
    console.log(`Learning response for userId: ${userId}, threadID: ${threadID}, senderID: ${event.senderID || 'undefined'}`);

    // Initialize learnedResponses for user if not exists
    if (!botState.learnedResponses[userId]) {
      botState.learnedResponses[userId] = { triggers: [] };
      console.log(`Initialized learnedResponses for userId: ${userId}`);
    }

    // Use full message body for better parsing instead of args (to handle spaces)
    const fullMsg = event.body.trim();
    if (!fullMsg.startsWith('#learn ')) {
      api.sendMessage('🚫 यूज: #learn (trigger) {response}\nउदाहरण: #learn (hello) {Hi there!}', threadID);
      return;
    }

    // Extract trigger and response using regex on full message
    const match = fullMsg.match(/#learn\s*\(\s*([^)]+)\s*\)\s*\{\s*([^}]+)\s*\}/i);
    if (!match) {
      api.sendMessage('❌ ट्रिगर को ( ) में डालें, जैसे: #learn (trigger) {response}', threadID);
      return;
    }
    const trigger = match[1].trim();
    const response = match[2].trim();

    if (!trigger || !response) {
      api.sendMessage('🚫 ट्रिगर और रिस्पॉन्स दोनों चाहिए!', threadID);
      return;
    }

    // Block shalender-related words (Updated with Hindi and English variations)
    const shalenderVariations = [
      // English variations
      'shalender', 'salender', 'shalinder', 'shailnder', 'saalender', 'selendr', 'shelender', 'shalander', 'shelendar',
      'selender', 'shlender', 'shalendra', 'shlendra', 'shelndr', 'shlndr', 'shaalender', 'shaelender',
      'shealender', 'shelandar', 'shelandor', 'shielnder', 'sholander', 'shulender', 'salindra', 'selander',
      'shalendur', 'shalendir', 'shalendor', 'shalindor', 'shelindr', 'shalandra', 'shalindra', 'shalyner',
      'shaender', 'shaenlender', 'shaolender', 'sholender', 'shalindr', 'shalandr', 'selindr', 'saelender',
      'sholindr', 'shalendara', 'shalindera', 'shelindra',
      // Hindi variations
      'शेलेन्द्र', 'शैलेंद्र', 'स्लेंडर', 'सलेन्द्र', 'शालेंद्र', 'सेलेंद्र', 'सैलेंडर', 'शेलेंद्र', 'शेलेंडर',
      'शालिन्द्र', 'सालेंद्र', 'शैलेंडर', 'शेलेन्डर', 'सिलेंडर', 'शैलेन्द्र', 'शालेंडर', 'सेलेंडर', 'शोलेंद्र',
      'शुलेंद्र', 'सैलेंडर', 'शालेंद्रा', 'शैलिंद्रा', 'शेलिंद्रा', 'शालेंडरा', 'सालेंडर', 'शैलेंडारा'
    ];
    const lowerTrigger = trigger.toLowerCase();
    const lowerResponse = response.toLowerCase();
    if (shalenderVariations.some(variation => lowerTrigger.includes(variation) || lowerResponse.includes(variation))) {
      api.sendMessage('🚫 शेलेन्द्र या इससे मिलते-जुलते शब्द ट्रिगर या रिस्पॉन्स में इस्तेमाल नहीं कर सकते!', threadID);
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
