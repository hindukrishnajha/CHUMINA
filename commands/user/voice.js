const fs = require('fs');
const path = require('path');
const gTTS = require('gtts');

module.exports = {
  name: 'voice',
  description: 'Sends a voice message in Hindi.',
  async execute(api, threadID, args, event, botState, isMaster) {
    const text = args.slice(1).join(' ') || 'मैं हीरो हूँ';
    const audioPath = path.join(__dirname, `../../voice_${threadID}.mp3`);

    try {
      const gtts = new gTTS(text, 'hi');
      await new Promise((resolve, reject) => {
        gtts.save(audioPath, (err) => {
          if (err) return reject(err);
          resolve();
        });
      });

      const message = {
        attachment: fs.createReadStream(audioPath)
      };
      api.sendMessage(message, threadID, (err) => {
        fs.unlink(audioPath, (unlinkErr) => {
          if (unlinkErr) console.error('Error deleting audio file:', unlinkErr.message);
        });
        if (err) {
          api.sendMessage('❌ वॉइस मैसेज भेजने में गलती हुई।', threadID);
        } else {
          api.sendMessage('✅ वॉइस मैसेज भेजा गया!', threadID);
        }
      });
    } catch (err) {
      api.sendMessage(`❌ गलती: ${err.message}`, threadID);
    }
  }
};
