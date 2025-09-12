// commands/master/unsend.js
const messageStore = require('../../utils/messageStore');

module.exports = {
  name: 'unsend',
  aliases: ['undelete'],
  execute(api, threadID, args, event, botState, isMaster, botID, stopBot) {
    if (!isMaster) {
      api.sendMessage('🚫 ये कमांड सिर्फ मास्टर के लिए है! 🕉️', threadID);
      return;
    }

    const deletedMsg = messageStore.getLastDeletedMessage(threadID);
    if (!deletedMsg) {
      api.sendMessage('❌ कोई डिलीट किया हुआ मैसेज नहीं मिला।', threadID);
      return;
    }

    api.getUserInfo(deletedMsg.senderID, (err, info) => {
      if (err || !info || !info[deletedMsg.senderID]) {
        api.sendMessage(`@Unknown ने डिलीट किया: "${deletedMsg.content || '(attachment or empty message)'}"`, threadID);
        if (deletedMsg.attachment && deletedMsg.attachment.url) {
          api.sendMessage({ url: deletedMsg.attachment.url }, threadID);
        }
        return;
      }

      const senderName = info[deletedMsg.senderID].name || 'Unknown';
      api.sendMessage(
        `@${senderName} ने डिलीट किया: "${deletedMsg.content || '(attachment or empty message)'}"`,
        threadID,
        null,
        [{ tag: senderName, id: deletedMsg.senderID }]
      );
      if (deletedMsg.attachment && deletedMsg.attachment.url) {
        api.sendMessage({ url: deletedMsg.attachment.url }, threadID);
      }
    });
  }
};
