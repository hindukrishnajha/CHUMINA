const fs = require('fs');
const { LEARNED_RESPONSES_PATH } = require('../../config/constants');

module.exports = {
  name: "removeadmin",
  execute(api, threadID, args, event, botState, isMaster) {
    // मास्टर चेक
    if (!isMaster) {
      api.sendMessage('🚫 केवल मास्टर (Shalender Hindu Ji) इस कमांड को यूज कर सकते हैं।', threadID);
      return;
    }

    try {
      // यूजर ID निकालना
      let targetID = args[1]?.trim();
      if (event.mentions && Object.keys(event.mentions).length > 0) {
        targetID = Object.keys(event.mentions)[0];
      }

      // UID या मेंशन का वैलिडेशन
      if (!targetID || isNaN(targetID)) {
        api.sendMessage(`Usage: ${botState.sessions[event.threadID]?.prefix || '#'}removeadmin <@user/uid>`, threadID);
        return;
      }

      // मास्टर को हटाने से रोकना
      if (targetID === MASTER_ID) {
        api.sendMessage('❌ Shalender Hindu Ji को एडमिन लिस्ट से नहीं हटाया जा सकता!', threadID);
        return;
      }

      // एडमिन लिस्ट में यूजर की जाँच
      if (!botState.adminList.includes(targetID)) {
        api.sendMessage(`❌ यूजर ${targetID} एडमिन नहीं है!`, threadID);
        return;
      }

      // यूजर की जानकारी लेना
      api.getUserInfo(targetID, (err, ret) => {
        if (err || !ret?.[targetID]) {
          console.error(`Removeadmin user info error for UID ${targetID}:`, err?.message || err);
          api.sendMessage('❌ यूजर की जानकारी लेने में असफल। कृपया फिर से कोशिश करें।', threadID);
          return;
        }

        const name = ret[targetID].name || 'User';

        // एडमिन लिस्ट से यूजर हटाना
        botState.adminList = botState.adminList.filter(id => id !== targetID);

        // learned_responses.json अपडेट करना
        let learnedResponses = { triggers: [], adminList: botState.adminList };
        try {
          if (fs.existsSync(LEARNED_RESPONSES_PATH)) {
            learnedResponses = JSON.parse(fs.readFileSync(LEARNED_RESPONSES_PATH, 'utf8'));
            learnedResponses.adminList = botState.adminList;
          }
          fs.writeFileSync(LEARNED_RESPONSES_PATH, JSON.stringify(learnedResponses, null, 2));
          api.sendMessage(`✅ ${name} (${targetID}) को Shalender Hindu Ji ने एडमिन लिस्ट से हटा दिया!`, threadID);
        } catch (fileErr) {
          console.error(`Removeadmin file write error for UID ${targetID}:`, fileErr.message);
          api.sendMessage('❌ फाइल अपडेट करने में गलती। कृपया फिर से कोशिश करें।', threadID);
        }
      });
    } catch (e) {
      console.error(`Removeadmin general error for thread ${threadID}:`, e.message);
      api.sendMessage('❌ removeadmin कमांड में त्रुटि। कृपया फिर से कोशिश करें या डेवलपर से संपर्क करें।', threadID);
    }
  }
};
