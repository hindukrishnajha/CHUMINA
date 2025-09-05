module.exports = {
  name: "tid",
  execute(api, threadID) {
    try {
      api.getThreadInfo(threadID, (err, info) => {
        if (err || !info) return api.sendMessage('Failed to get group info.', threadID);
        api.sendMessage(`📌 Group Name: ${info.threadName || 'N/A'}\n🆔 Group ID: ${threadID}`, threadID);
      });
    } catch (e) {
      api.sendMessage('Error in tid.', threadID);
      console.error('Tid error:', e);
    }
  }
};
