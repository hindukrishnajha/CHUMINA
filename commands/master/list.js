module.exports = {
  name: "list",
  execute(api, threadID, args, event, botState, isMaster) {
    if (!isMaster) {
      api.sendMessage('🚫 केवल मास्टर (Shalender Hindu Ji) इस कमांड को यूज कर सकते हैं।', threadID);
      return;
    }
    const activeUsers = Object.keys(botState.sessions).join(', ');
    api.sendMessage(`📜 Active User IDs: ${activeUsers || 'None'}`, threadID);
  }
};
