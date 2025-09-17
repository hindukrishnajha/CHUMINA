module.exports = {
  name: 'unmute',
  aliases: ['unmute'],
  description: 'Unmute users (admin/master only)',
  execute(api, threadID, args, event, botState, isMaster, botID, stopBot) {
    const isAdmin = Array.isArray(botState.adminList) && botState.adminList.includes(event.senderID) || isMaster;
    if (!isAdmin) {
      return api.sendMessage('🚫 Yeh command sirf admins ya master ke liye hai! 🕉️', threadID);
    }

    const mentionedIDs = Object.keys(event.mentions || {});
    if (mentionedIDs.length < 1) {
      return api.sendMessage('❌ Tag users to unmute! Use: #unmute @user1 @user2 🕉️', threadID);
    }

    if (!botState.mutedUsers) botState.mutedUsers = {};
    if (!botState.mutedUsers[threadID]) botState.mutedUsers[threadID] = [];

    let unmuteCount = 0;
    mentionedIDs.forEach(id => {
      const index = botState.mutedUsers[threadID].indexOf(id);
      if (index > -1) {
        botState.mutedUsers[threadID].splice(index, 1);
        unmuteCount++;
      }
    });

    if (unmuteCount === 0) {
      return api.sendMessage('❌ Yeh users muted nahi hain! 🕉️', threadID);
    }

    api.getUserInfo(mentionedIDs, (err, userInfo) => {
      let names = mentionedIDs.map(id => userInfo[id]?.name || 'User').join(', ');
      api.sendMessage(`✅ Unmuted: ${names}! Ab inki baat suni jayegi. 🕉️`, threadID);
    });

    // Save to learned_responses
    if (botState.learnedResponses[threadID]) {
      botState.learnedResponses[threadID].mutedUsers = botState.mutedUsers[threadID];
      require('fs').writeFileSync(require('../../config/constants').LEARNED_RESPONSES_PATH, JSON.stringify(botState.learnedResponses, null, 2), 'utf8');
    }
  }
};
