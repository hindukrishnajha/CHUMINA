const fs = require('fs');
const { LEARNED_RESPONSES_PATH } = require('../../config/constants');

module.exports = {
  name: "addadmin",
  execute(api, threadID, args, event, botState, isMaster) {
    if (!isMaster) {
      api.sendMessage('🚫 केवल मास्टर (Shalender Hindu Ji) इस कमांड को यूज कर सकते हैं।', threadID);
      return;
    }
    try {
      let targetID = args[1];
      if (event.mentions && Object.keys(event.mentions).length > 0) {
        targetID = Object.keys(event.mentions)[0];
      }
      if (!targetID) {
        api.sendMessage(`Usage: ${botState.sessions[event.threadID]?.prefix || '#'}addadmin <@user/uid>`, threadID);
        return;
      }
      if (botState.adminList.includes(targetID)) {
        api.sendMessage(`❌ User ${targetID} is already an admin!`, threadID);
        return;
      }
      api.getUserInfo(targetID, (err, ret) => {
        if (err || !ret?.[targetID]) {
          api.sendMessage('❌ Failed to get user info.', threadID);
          console.error('Addadmin user info error:', err);
          return;
        }
        const name = ret[targetID].name || 'User';
        botState.adminList.push(targetID);
        let learnedResponses = { triggers: [], adminList: botState.adminList };
        if (fs.existsSync(LEARNED_RESPONSES_PATH)) {
          learnedResponses = JSON.parse(fs.readFileSync(LEARNED_RESPONSES_PATH, 'utf8'));
          learnedResponses.adminList = botState.adminList;
        }
        fs.writeFileSync(LEARNED_RESPONSES_PATH, JSON.stringify(learnedResponses, null, 2));
        api.sendMessage(`✅ ${name} (${targetID}) has been added as an admin by Shalender Hindu Ji!`, threadID);
      });
    } catch (e) {
      api.sendMessage('Error in addadmin command.', threadID);
      console.error('Addadmin error:', e);
    }
  }
};
