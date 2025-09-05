module.exports = {
  name: "kick",
  execute(api, threadID, args, event, botState, isMaster, botID, stopBot) {
    if (!isMaster) {
      api.sendMessage('🚫 केवल मास्टर (Shalender Hindu Ji) इस कमांड को यूज कर सकते हैं।', threadID);
      return;
    }
    const targetId = args[1];
    if (botState.sessions[targetId]) {
      stopBot(targetId);
      api.sendMessage(`🚫 Bot for User ID ${targetId} stopped by Shalender Hindu Ji.`, threadID);
    } else {
      api.sendMessage(`❌ No bot running for User ID ${targetId}.`, threadID);
    }
  }
};
