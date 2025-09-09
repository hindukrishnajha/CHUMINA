const fs = require('fs');
const path = require('path');
const gTTS = require('gtts');

module.exports = {
  name: 'voice',
  description: 'Sends a voice message in Hindi.',
  async execute(api, threadID, args, event, botState, isMaster) {
    // 30 सेकंड कूलडाउन चेक
    if (botState.commandCooldowns[threadID]?.voice) {
      api.sendMessage(
        '👑 किंग के नियमों के हिसाब से अगली वॉइस का इस्तमाल करने के लिए आपको 30 सेकंड का इंतज़ार करना होगा। इन 30 सेकंड में आप किंग की महानता के बारे में सोचें, वो कितने दिलेर, कितने महान, कितने शूरवीर, कितने परमवीर हैं! 👑🔥',
        threadID
      );
      return;
    }

    const text = args.slice(1).join(' ') || 'मैं हीरो हूँ';

    // 200 अक्षरों की लिमिट
    if (text.length > 200) {
      api.sendMessage('❌ टेक्स्ट ज्यादा लंबा है! 200 अक्षरों तक यूज करो।', threadID);
      return;
    }

    // "shalender" aur uske tone ke saare variations (English aur Hindi) block karen
    const shalenderRegex = /(sh|s|ch)[aeiou]*(l|ll)[aeiou]*(n|nn)?[d]+[r]*(a|ra|ar)?\b|[\u0936\u0937\u0938][\u093E\u0947\u0948\u094B\u0941\u0942]*[\u0932][\u093E\u0947\u0948\u094B\u0941\u0942]*[\u0928]?[\u094D]?[\u0926]+[\u0930]*[\u093E]?/i;
    if (shalenderRegex.test(text)) {
      api.sendMessage('👑 किंग किंग होता है, शैलेंद्र हिन्दू किंग है! 👑🔥', threadID);
      return;
    }

    const audioPath = path.join(__dirname, `../../voice_${threadID}_${Date.now()}.mp3`);

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
      await new Promise((resolve, reject) => {
        api.sendMessage(message, threadID, (err) => {
          if (err) return reject(err);
          resolve();
        });
      });

      // कूलडाउन सेट करें
      botState.commandCooldowns[threadID] = { voice: true };
      setTimeout(() => delete botState.commandCooldowns[threadID]?.voice, 30000);
    } catch (err) {
      api.sendMessage(`❌ वॉइस मैसेज भेजने में गलती हुई: ${err.message}`, threadID);
    } finally {
      // ऑडियो फाइल तुरंत डिलीट करें
      if (fs.existsSync(audioPath)) {
        fs.unlink(audioPath, (unlinkErr) => {
          if (unlinkErr) console.error('Error deleting audio file:', unlinkErr.message);
        });
      }
    }
  }
};
