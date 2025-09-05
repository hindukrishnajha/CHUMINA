// commands/admin/groupnamelock.js
module.exports = {
  name: "groupnamelock",
  execute(api, threadID, args, event, botState, isMaster) {
    if (!isMaster && !botState.adminList.includes(event.senderID)) {
      return api.sendMessage("🚫 ये कमांड सिर्फ मास्टर या एडमिन्स के लिए है!", threadID);
    }

    const action = args[1]?.toLowerCase();
    const groupName = args.slice(2).join(" ") || botState.lockedGroups[threadID];

    if (!action) {
      return api.sendMessage("🔍 यूज: #groupnamelock <on/off> [ग्रुप_नाम]", threadID);
    }

    if (action === "on") {
      if (!groupName) {
        return api.sendMessage("⚠️ ग्रुप नाम डालो, जैसे: #groupnamelock on ramukakakaaka", threadID);
      }
      botState.lockedGroups[threadID] = groupName;
      api.setTitle(groupName, threadID, (err) => {
        if (err) {
          console.error("Group name lock error:", err.message);
          return api.sendMessage("⚠️ ग्रुप नाम लॉक करने में गलती। बॉट को एडमिन परमिशन चाहिए।", threadID);
        }
        api.sendMessage(`🔒 ग्रुप नाम लॉक हो गया: ${groupName}`, threadID);
      });
    } else if (action === "off") {
      delete botState.lockedGroups[threadID];
      api.sendMessage("🔓 ग्रुप नाम अनलॉक हो गया।", threadID);
    } else {
      api.sendMessage("❌ गलत एक्शन। यूज: #groupnamelock <on/off> [ग्रुप_नाम]", threadID);
    }
  }
};
