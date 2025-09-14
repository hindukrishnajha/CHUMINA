const axios = require('axios');
const Jimp = require('jimp');
const fs = require('fs');
const path = require('path');

module.exports = {
  name: 'badge',
  description: 'Generate a badge with user profile picture and name',
  aliases: ['badge'],
  execute: async (api, threadID, args, event, botState, isMaster, botID, stopBot) => {
    console.log(`[DEBUG] badge called: threadID=${threadID}, args=${JSON.stringify(args)}, senderID=${event.senderID}`);
    try {
      let targetID;
      if (event.mentions && Object.keys(event.mentions).length > 0) {
        targetID = Object.keys(event.mentions)[0];
      } else if (args[0] && args[0].startsWith('https://www.facebook.com/')) {
        const profileUrl = args[0];
        const userIDMatch = profileUrl.match(/(\d+)/);
        if (!userIDMatch) {
          return api.sendMessage('🚫 गलत प्रोफाइल लिंक! @mention या सही FB प्रोफाइल लिंक यूज करो। 🕉️', threadID);
        }
        targetID = userIDMatch[0];
      } else if (event.messageReply && event.messageReply.senderID) {
        targetID = event.messageReply.senderID;
      } else {
        targetID = event.senderID;
      }

      if (!targetID) {
        return api.sendMessage('🚫 यूजर ID नहीं मिली! @mention, प्रोफाइल लिंक, या रिप्लाई यूज करो। 🕉️', threadID);
      }

      let userInfo;
      try {
        userInfo = await new Promise((resolve, reject) => {
          api.getUserInfo(targetID, (err, ret) => {
            if (err || !ret || !ret[targetID]) {
              reject(new Error('यूजर जानकारी लाने में असफल।'));
            } else {
              resolve(ret[targetID]);
            }
          });
        });
      } catch (err) {
        return api.sendMessage('⚠️ यूजर जानकारी लाने में गलती: ' + err.message + ' 🕉️', threadID);
      }

      const name = userInfo.name || 'Unknown User';
      const profilePicUrl = userInfo.thumbSrc || `https://graph.facebook.com/${targetID}/picture?type=large&access_token=${process.env.FB_ACCESS_TOKEN || ''}`;

      let badgeImage;
      try {
        badgeImage = await Jimp.read('badge.png');
      } catch (err) {
        return api.sendMessage('⚠️ बैज इमेज लोड करने में गलती। डेवलपर से संपर्क करें! 🕉️', threadID);
      }

      let profilePic;
      try {
        const response = await axios.get(profilePicUrl, { responseType: 'arraybuffer' });
        profilePic = await Jimp.read(Buffer.from(response.data));
      } catch (err) {
        return api.sendMessage('⚠️ प्रोफाइल पिक्चर डाउनलोड करने में गलती। 🕉️', threadID);
      }

      profilePic.resize(100, 100);
      badgeImage.composite(profilePic, 50, 50);
      const font = await Jimp.loadFont(Jimp.FONT_SANS_32_WHITE);
      badgeImage.print(font, 10, 10, name.substring(0, 20));

      const outputBuffer = await badgeImage.getBufferAsync(Jimp.MIME_PNG);
      const outputPath = path.join(__dirname, `badge_${targetID}.png`);
      fs.writeFileSync(outputPath, outputBuffer);

      try {
        await api.sendMessage({
          body: `✅ ${name} का बैज तैयार है! 🕉️`,
          attachment: fs.createReadStream(outputPath)
        }, threadID);
      } catch (err) {
        return api.sendMessage('⚠️ बैज भेजने में गलती। फिर से ट्राई करो! 🕉️', threadID);
      }

      try {
        fs.unlinkSync(outputPath);
      } catch (err) {
        console.error('[DEBUG] Error deleting badge image:', err.message);
      }
    } catch (err) {
      console.error('[ERROR] Badge command error:', err.message);
      api.sendMessage(`❌ कमांड चलाने में गलती: ${err.message} 🕉️`, threadID);
    }
  }
};
