const fs = require('fs');
const path = require('path');
const gTTS = require('gtts');

module.exports = {
  name: 'voice',
  description: 'Sends a voice message in Hindi.',
  async execute(api, threadID, args, event, botState, isMaster) {
    // टेक्स्ट को args से लें, डिफॉल्ट: "मैं हीरो हूँ"
    const text = args.slice(1).join(' ') || 'मैं हीरो हूँ';
    const audioPath = path.join(__dirname, `../../voice_${threadID}.mp3`);

    try {
      // टेक्स्ट को हिंदी वॉइस में कन्वर्ट करें
      const gtts = new gTTS(text, 'hi');
      await new Promise((resolve, reject) => {
        gtts.save(audioPath, (err) => {
          if (err) return reject(err);
          resolve();
        });
      });

      // ऑडियो फाइल भेजें
      const message = {
        attachment: fs.createReadStream(audioPath)
      };
      api.sendMessage(message, threadID, (err) => {
        // फाइल भेजने के बाद डिलीट करें
        fs.unlink(audioPath, (unlinkErr) => {
          if (unlinkErr) console.error('Error deleting audio file:', unlinkErr.message);
        });
        if (err) {
          api.sendMessage('❌ वॉइस मैसेज भेजने में गलती हुई।', threadID);
        } else {
          api.sendMessage('✅ वॉइस मैसेज भेजा गया!', thread
