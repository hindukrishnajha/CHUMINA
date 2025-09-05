module.exports = {
  name: "stopall",
  execute(api, threadID, args, event, botState, isMaster, botID, stopBot) {
    if (!isMaster) {
      api.sendMessage('🚫 केवल मास्टर (Shalender Hindu Ji) इस कमांड को यूज कर सकते हैं।', threadID);
      return;
    }
    Object.keys(botState.sessions).forEach(id => {
      stopBot(id);
    });
    api.sendMessage('🚫 All bots stopped by Shalender Hindu Ji.', threadID);
  }
};
