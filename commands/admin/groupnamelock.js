module.exports = {
  name: "groupnamelock",
  execute(api, threadID, args, event, botState, isMaster) {
    if (!isMaster && !botState.adminList.includes(event.senderID)) {
      return api.sendMessage("🚫 ये कमांड सिर्फ मास्टर या एडमिन्स के लिए है!", threadID);
    }

    if (args.length < 1) {
      return api.sendMessage("🔍 यूज: #groupnamelock <on/off> [ग्रुप_नाम]", threadID);
    }

    const action = args[0].toLowerCase(); // Fix: args[0] is 'on' or 'off'
    const groupName = args.slice(1).join(" ").trim() || botState.lockedGroups[threadID]; // Fix: Join all remaining args for name with spaces

    if (!action) {
      return api.sendMessage("🔍 यूज: #groupnamelock <on/off> [ग्रुप_नाम]", threadID);
    }

    // Early admin permission check
    api.getThreadInfo(threadID, (err, info) => {
      if (err || !info) {
        api.sendMessage("⚠️ ग्रुप जानकारी लाने में असफल।", threadID);
        return;
      }
      if (!info.adminIDs.some(admin => admin.id === api.getCurrentUserID())) {
        api.sendMessage("⚠️ ग्रुप नाम लॉक करने के लिए बॉट को एडमिन परमिशन चाहिए।", threadID);
        console.log('[DEBUG] Bot lacks admin permissions for group name lock');
        return;
      }

      if (action === "on") {
        if (!groupName) {
          return api.sendMessage("⚠️ ग्रुप नाम डालो, जैसे: #groupnamelock on ramukakakaaka", threadID);
        }
        botState.lockedGroups[threadID] = groupName;
        api.setTitle(groupName, threadID, (err) => {
          if (err) {
            console.error("Group name lock error:", err.message);
            return api.sendMessage("⚠️ ग्रुप नाम लॉक करने में गलती (API इश्यू)। बॉट को एडमिन परमिशन चाहिए।", threadID);
          }
          api.sendMessage(`🔒 ग्रुप नाम लॉक हो गया: ${groupName}`, threadID);
        });
      } else if (action === "off") {
        delete botState.lockedGroups[threadID];
        api.sendMessage("🔓 ग्रुप नाम अनलॉक हो गया।", threadID);
      } else {
        api.sendMessage("❌ गलत एक्शन। यूज: #groupnamelock <on/off> [ग्रुप_नाम]", threadID);
      }
    });
  }
};
