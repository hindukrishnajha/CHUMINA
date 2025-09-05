module.exports = {
  name: "status",
  execute(api, threadID, args, event, botState, isMaster) {
    if (!isMaster) {
      api.sendMessage('🚫 केवल मास्टर (Shalender Hindu Ji) इस कमांड को यूज कर सकते हैं।', threadID);
      return;
    }
    const activeBots = Object.keys(botState.sessions).length;
    api.sendMessage(`📊 Active bots: ${activeBots}`, threadID);
  }
};
