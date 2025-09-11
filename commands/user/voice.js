const fs = require('fs');
const path = require('path');
const gTTS = require('gtts');

module.exports = {
  name: 'voice',
  description: 'हिंदी में वॉइस मैसेज भेजता है।',
  async execute(api, threadID, args, event, botState, isMaster) {
    // सुनिश्चित करें कि commandCooldowns[threadID] मौजूद हो
    if (!botState.commandCooldowns[threadID]) {
      botState.commandCooldowns[threadID] = {};
      console.log(`[DEBUG] commandCooldowns इनिशियलाइज़ किया गया threadID: ${threadID}`);
    }

    // कूलडाउन चेक: सिर्फ ऑब्जेक्ट और टाइमस्टैंप चेक करें
    if (
      botState.commandCooldowns[threadID].voice &&
      typeof botState.commandCooldowns[threadID].voice === 'object' &&
      Date.now() - botState.commandCooldowns[threadID].voice.timestamp < 30000
    ) {
      console.log(`[DEBUG] वॉइस कमांड कूलडाउन पर है threadID: ${threadID}`);
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

    // "shalender" और इसके वैरिएशन्स ब्लॉक करें
    const shalenderRegex = /((sh|ss|s|ch)(h|ai|e|ei|ail|il)?[aeiou]*(l|ll)[aeiou]*(n|nn)?[d]+[r]*(a|ra|ar|adr|ea)?)|(sh(h|ai|e|ei|ail|il|ale)?[aeiou]*(l|ll)[aeiou]*(n|nn)?[d]+[r]*(a|ra|ar|adr|ea|iandr|endra)?)|(s(ale|lender)?[aeiou]*(l|ll)[aeiou]*(n|nn)?[d]+[r]*(a|ra|ar|adr|ea|ndra|ndrea)?)|([\u0936\u0937\u0938\u0938\u094D\u0938][\u093E\u0947\u0948\u094B\u0941\u0942\u093F\u0940\u0949]?[\u0932][\u093E\u0947\u0948\u094B\u0941\u0942\u093F\u0940]*[\u0928]?[\u094D]?[\u0926]+[\u0930]*[\u093E|\u093F\u0940|\u0947\u094D\u0930|\u093F\u092F\u093E]?)|([\u0936\u0938][\u093E\u0947\u0948\u094B\u0941\u0942\u093F\u0940\u0949]?[\u0932][\u093E\u0947\u0948\u094B\u0941\u0942\u093F\u0940]*[\u0928]?[\u094D]?[\u0926]+[\u0930]*[\u093E|\u093F\u0940|\u0947\u094D\u0930|\u093F\u092F\u093E|\u093F\u092F\u093E\u0928\u094D\u0926\u094D\u0930]?)|(s[\u093E|\u0947|\u0948|\u094B|\u0941|\u0942|\u093F|\u0940|\u0949]?[\u0932][\u093E\u0947\u0948\u094B\u0941\u0942\u093F\u0940]*[\u0928]?[\u094D]?[\u0926]+[\u0930]*[\u093E|\u093F\u0940|\u0947\u094D\u0930|\u093F\u092F\u093E|\u0923\u094D\u0921\u094D\u0930|\u0923\u094D\u0921\u094D\u0930\u093F\u092F\u093E]?)/i;
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
      botState.commandCooldowns[threadID].voice = { timestamp: Date.now() };
      console.log(`[DEBUG] वॉइस कमांड कूलडाउन सेट किया गया threadID: ${threadID}, timestamp: ${botState.commandCooldowns[threadID].voice.timestamp}`);
      setTimeout(() => {
        if (botState.commandCooldowns[threadID]?.voice) {
          delete botState.commandCooldowns[threadID].voice;
          console.log(`[DEBUG] वॉइस कमांड कूलडाउन हटाया गया threadID: ${threadID}`);
        }
      }, 30000);
    } catch (err) {
      console.error(`[ERROR] वॉइस मैसेज भेजने में गलती: ${err.message}`);
      api.sendMessage(`❌ वॉइस मैसेज भेजने में गलती हुई: ${err.message}`, threadID);
    } finally {
      // ऑडियो फाइल डिलीट करें
      if (fs.existsSync(audioPath)) {
        fs.unlink(audioPath, (unlinkErr) => {
          if (unlinkErr) console.error(`[ERROR] ऑडियो फाइल डिलीट करने में गलती: ${unlinkErr.message}`);
        });
      }
    }
  }
};
