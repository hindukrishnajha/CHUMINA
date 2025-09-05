module.exports = {
  name: "masterid",
  execute(api, threadID, args, event, botState, isMaster, botID, broadcast) {
    if (!isMaster) {
      api.sendMessage('🚫 केवल मास्टर (Shalender Hindu Ji) इस कमांड को यूज कर सकते हैं।', threadID);
      return;
    }
    try {
      const masterLink = 'https://www.facebook.com/SHALENDER.HINDU.BAAP.JI.HERE.1';
      api.sendMessage(`👑 मास्टर प्रोफाइल: ${masterLink}`, threadID);
      console.log(`[SUCCESS] Responded to #masterid for thread ${threadID} with link ${masterLink}`);
      if (broadcast) {
        broadcast({
          type: 'log',
          message: `[7:30 AM IST] [User ${event.senderID}] Responded to #masterid`,
          userId: event.senderID,
          color: '#00ff00'
        });
      }
    } catch (err) {
      console.error('[ERROR] masterid कमांड में गलती:', err.message, err.stack);
      api.sendMessage('⚠️ masterid कमांड चलाने में गलती।', threadID);
      if (broadcast) {
        broadcast({
          type: 'error',
          message: `[7:30 AM IST] [User ${event.senderID}] masterid कमांड में गलती: ${err.message}`,
          userId: event.senderID,
          color: '#ff4444'
        });
      }
    }
  }
};
