// commands/master/removeadmin.js
const fs = require('fs');

module.exports.removeadmin = (api, event, botState, LEARNED_RESPONSES_PATH) => {
    const args = event.body.split(' ');
    const userId = args[1]?.replace(/[@<>]/g, '');
    if (!userId) {
        api.sendMessage("Please provide a user ID or mention.", event.threadID);
        return;
    }
    if (botState.adminList.includes(userId)) {
        botState.adminList = botState.adminList.filter(id => id !== userId);
        fs.writeFileSync(LEARNED_RESPONSES_PATH, JSON.stringify({ triggers: [], adminList: botState.adminList }, null, 2));
        api.sendMessage(`User ${userId} removed from admin list.`, event.threadID);
    } else {
        api.sendMessage(`User ${userId} is not an admin.`, event.threadID);
    }
};
