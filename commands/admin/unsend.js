// commands/admin/unsend.js
module.exports = {
  name: "unsend",
  execute(api, threadID, args, event, botState, isMaster) {
    console.log(`[DEBUG] unsend called: threadID=${threadID}, args=${JSON.stringify(args)}`);
    try {
      if (!isMaster && !botState.adminList.includes(event.senderID)) {
        api.sendMessage('🚫 केवल मास्टर या एडमिन इस कमांड को यूज कर सकते हैं।', threadID);
        return;
      }

      if (!event.messageReply) {
        api.sendMessage('❌ कृपया उस मैसेज को रिप्लाई करें जिसे डिलीट करना है।', threadID);
        return;
      }

      api.getThreadInfo(threadID, (err, info) => {
        if (err || !info) {
          console.error('[ERROR] getThreadInfo failed for unsend:', err?.message);
          api.sendMessage('⚠️ ग्रुप जानकारी लाने में असफल।', threadID);
          return;
        }

        const botID = api.getCurrentUserID();
        const isBotAdmin = info.adminIDs.some(admin => admin.id === botID);
        if (!isBotAdmin) {
          api.sendMessage('⚠️ मैसेज डिलीट करने के लिए बॉट को एडमिन परमिशन्स चाहिए।', threadID);
          return;
        }

        const repliedMessageId = event.messageReply.messageID;
        api.deleteMessage(repliedMessageId, threadID, (err) => {
          if (err) {
            api.sendMessage('❌ मैसेज डिलीट करने में गलती। सुनिश्चित करें कि मैसेज हाल का है।', threadID);
            console.error('Unsend error:', err);
            return;
          }
          api.sendMessage(`✅ मैसेज ${isMaster ? 'मास्टर' : 'एडमिन'} द्वारा डिलीट किया गया।`, threadID);
        });
      });
    } catch (e) {
      console.error('[ERROR] unsend error:', e.message);
      api.sendMessage('⚠️ अनसेंड कमांड में गलती।', threadID);
    }
  }
};
