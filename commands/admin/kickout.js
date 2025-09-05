// commands/admin/kickout.js
const { MASTER_ID } = require('../../config/constants');

module.exports = {
  name: "kickout",
  execute(api, threadID, args, event, botState, isMaster) {
    console.log(`[DEBUG] kickout called: threadID=${threadID}, args=${JSON.stringify(args)}, event.mentions=${JSON.stringify(event.mentions)}`);
    try {
      if (!isMaster && !botState.adminList.includes(event.senderID)) {
        api.sendMessage('🚫 केवल मास्टर या एडमिन इस कमांड को यूज कर सकते हैं।', threadID);
        return;
      }

      if (!event.mentions || Object.keys(event.mentions).length === 0) {
        console.log(`[DEBUG] No mentions provided for kickout in thread ${threadID}`);
        api.sendMessage('उपयोग: #kickout @user', threadID);
        return;
      }

      const targetID = Object.keys(event.mentions)[0];
      if (targetID === MASTER_ID) {
        console.log(`[DEBUG] Attempted to kick master ${MASTER_ID} in thread ${threadID}`);
        api.sendMessage('🚫 मास्टर को किक नहीं किया जा सकता!', threadID);
        return;
      }

      api.getThreadInfo(threadID, (err, info) => {
        if (err || !info) {
          console.error(`[ERROR] getThreadInfo failed for thread ${threadID}:`, err?.message || 'No thread info');
          api.sendMessage('⚠️ ग्रुप जानकारी लाने में असफल।', threadID);
          return;
        }

        if (!info.adminIDs.some(admin => admin.id === api.getCurrentUserID())) {
          console.log(`[DEBUG] Bot is not admin in thread ${threadID}`);
          api.sendMessage('⚠️ किक करने के लिए बॉट को एडमिन परमिशन्स चाहिए।', threadID);
          return;
        }

        api.getUserInfo(targetID, (err, ret) => {
          if (err || !ret[targetID]) {
            console.error(`[ERROR] getUserInfo failed for user ${targetID}:`, err?.message || 'No user info');
            api.sendMessage('⚠️ यूजर जानकारी लाने में असफल।', threadID);
            return;
          }

          const name = ret[targetID].name || 'User';
          api.removeUserFromGroup(targetID, threadID, (err) => {
            if (err) {
              console.error(`[ERROR] Failed to kick user ${targetID} from thread ${threadID}:`, err.message);
              api.sendMessage(`⚠️ ${name} को किक करने में गलती। बॉट को एडमिन परमिशन्स चाहिए।`, threadID);
            } else {
              console.log(`[DEBUG] Successfully kicked user ${targetID} (${name}) from thread ${threadID}`);
              api.sendMessage(`✅ ${name} को ग्रुप से किक कर दिया गया!`, threadID);
            }
          });
        });
      });
    } catch (e) {
      console.error(`[ERROR] kickout error for thread ${threadID}:`, e.message);
      api.sendMessage('⚠️ किकआउट कमांड में गलती।', threadID);
    }
  }
};
