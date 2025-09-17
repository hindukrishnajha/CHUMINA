module.exports = {
  name: 'mute',
  aliases: ['mute'],
  description: 'Mute users (admin/master only, max 3)',
  execute(api, threadID, args, event, botState, isMaster, botID, stopBot) {
    const isAdmin = Array.isArray(botState.adminList) && botState.adminList.includes(event.senderID) || isMaster;
    if (!isAdmin) {
      return api.sendMessage('🚫 Yeh command sirf admins ya master ke liye hai! 🕉️', threadID);
    }

    const mentionedIDs = Object.keys(event.mentions || {});
    if (mentionedIDs.length < 1 || mentionedIDs.length > 3) {
      return api.sendMessage('❌ Tag 1-3 users to mute! Use: #mute @user1 @user2 🕉️', threadID);
    }

    // Check if already muted or self-mute
    if (!botState.mutedUsers) botState.mutedUsers = {};
    if (!botState.mutedUsers[threadID]) botState.mutedUsers[threadID] = [];
    mentionedIDs.forEach(id => {
      if (id === botID || id === event.senderID) return; // No self or bot mute
      if (botState.mutedUsers[threadID].includes(id)) return; // Already muted
      botState.mutedUsers[threadID].push(id);
    });

    if (botState.mutedUsers[threadID].length > 10) {
      return api.sendMessage('❌ Max 10 muted users allowed! Unmute some first. 🕉️', threadID);
    }

    api.getUserInfo(mentionedIDs, (err, userInfo) => {
      if (err) {
        return api.sendMessage('⚠️ User info fetch failed. 🕉️', threadID);
      }
      let names = mentionedIDs.map(id => userInfo[id]?.name || 'User').join(', ');
      api.sendMessage(`✅ Muted: ${names}! Ab inki har baat ignore hogi (commands, messages, roasts – sab). 🕉️`, threadID);
    });

    // Save to learned_responses
    if (botState.learnedResponses[threadID]) {
      botState.learnedResponses[threadID].mutedUsers = botState.mutedUsers[threadID];
      require('fs').writeFileSync(require('../../config/constants').LEARNED_RESPONSES_PATH, JSON.stringify(botState.learnedResponses, null, 2), 'utf8');
    }
  }
};
