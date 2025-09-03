// commands/master/addadmin.js
const fs = require('fs');

module.exports.addadmin = (api, event, botState, LEARNED_RESPONSES_PATH) => {
    const args = event.body.split(' ');
    const userId = args[1]?.replace(/[@<>]/g, '');
    if (!userId) {
        api.sendMessage("Please provide a user ID or mention.", event.threadID);
        return;
    }
    if (!botState.adminList.includes(userId)) {
        botState.adminList.push(userId);
        fs.writeFileSync(LEARNED_RESPONSES_PATH, JSON.stringify({ triggers: [], adminList: botState.adminList }, null, 2));
        api.sendMessage(`User ${userId} added to admin list.`, event.threadID);
    } else {
        api.sendMessage(`User ${userId} is already an admin.`, event.threadID);
    }
};
