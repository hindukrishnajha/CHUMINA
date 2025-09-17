module.exports = {
  name: 'roast',
  aliases: ['roast'],
  description: 'Toggle auto-roast mode (general or targeted)',
  execute(api, threadID, args, event, botState, isMaster, botID, stopBot) {
    const isAdmin = Array.isArray(botState.adminList) && botState.adminList.includes(event.senderID) || isMaster;
    if (!isAdmin) {
      return api.sendMessage('🚫 Yeh command sirf admins ya master ke liye hai! 🕉️', threadID);
    }

    const command = args[0]?.toLowerCase();
    const mentionedIDs = Object.keys(event.mentions || {});

    if (command === 'on') {
      if (mentionedIDs.length > 0 && mentionedIDs.length <= 4) {
        // Targeted roast
        if (!botState.roastTargets) botState.roastTargets = {};
        if (!botState.roastTargets[threadID]) botState.roastTargets[threadID] = {};
        mentionedIDs.forEach(id => {
          botState.roastTargets[threadID][id] = true;
        });
        api.getUserInfo(mentionedIDs, (err, userInfo) => {
          let names = mentionedIDs.map(id => userInfo[id]?.name || 'User').join(', ');
          api.sendMessage(`✅ Targeted roast on for ${names}! Ab sirf yeh users roast honge jab message karenge. 🕉️`, threadID);
        });
      } else {
        // General roast
        if (!botState.roastEnabled) botState.roastEnabled = {};
        botState.roastEnabled[threadID] = true;
        api.sendMessage('🔥 Auto-roast ON for all users! Har message pe beizzati, 30 sec gap ke saath. 🕉️', threadID);
      }
    } else if (command === 'off') {
      if (!botState.roastEnabled) botState.roastEnabled = {};
      botState.roastEnabled[threadID] = false;
      if (botState.roastTargets && botState.roastTargets[threadID]) {
        delete botState.roastTargets[threadID];
      }
      api.sendMessage('✅ Auto-roast OFF! Ab koi beizzati nahi. 🕉️', threadID);
    } else {
      api.sendMessage('❌ Use: #roast on (all users) or #roast on @user1 @user2 (targeted, max 4) or #roast off 🕉️', threadID);
    }

    // Save to learned_responses
    if (botState.learnedResponses[threadID]) {
      botState.learnedResponses[threadID].roastEnabled = botState.roastEnabled[threadID];
      botState.learnedResponses[threadID].roastTargets = botState.roastTargets[threadID];
      require('fs').writeFileSync(require('../../config/constants').LEARNED_RESPONSES_PATH, JSON.stringify(botState.learnedResponses, null, 2), 'utf8');
    }
  }
};
