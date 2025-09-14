const axios = require('axios');
const Jimp = require('jimp');
const fs = require('fs');
const path = require('path');

module.exports = {
  name: 'badge',
  description: 'Generate a high-quality colorful badge with bold name 🌟🔥',
  aliases: ['badge'],
  execute: async (api, threadID, args, event, botState, isMaster, botID, stopBot) => {
    console.log(`[DEBUG] badge called: threadID=${threadID}, args=${JSON.stringify(args)}, senderID=${event.senderID}`);
    try {
      let targetID;
      if (event.mentions && Object.keys(event.mentions).length > 0) {
        targetID = Object.keys(event.mentions)[0];
        console.log(`[DEBUG] Using mention ID: ${targetID}`);
      } else if (args[0] && args[0].startsWith('https://www.facebook.com/')) {
        const profileUrl = args[0];
        const userIDMatch = profileUrl.match(/(\d+)/);
        if (!userIDMatch) {
          console.log('[DEBUG] Invalid profile URL provided');
          return api.sendMessage('🚫 गलत प्रोफाइल लिंक! @mention या सही FB प्रोफाइल लिंक यूज करो। 🕉️', threadID);
        }
        targetID = userIDMatch[0];
        console.log(`[DEBUG] Using profile URL ID: ${targetID}`);
      } else if (event.messageReply && event.messageReply.senderID) {
        targetID = event.messageReply.senderID;
        console.log(`[DEBUG] Using reply sender ID: ${targetID}`);
      } else {
        targetID = event.senderID;
        console.log(`[DEBUG] Using sender ID: ${targetID}`);
      }

      if (!targetID) {
        console.log('[DEBUG] No target ID found');
        return api.sendMessage('🚫 यूजर ID नहीं मिली! @mention, प्रोफाइल लिंक, या रिप्लाई यूज करो। 🕉️', threadID);
      }

      let userInfo;
      try {
        console.log(`[DEBUG] Fetching user info for ID: ${targetID}`);
        userInfo = await new Promise((resolve, reject) => {
          api.getUserInfo(targetID, (err, ret) => {
            if (err || !ret || !ret[targetID]) {
              console.error(`[ERROR] Failed to fetch user info: ${err?.message || 'Unknown error'}`);
              reject(new Error('यूजर जानकारी लाने में असफल।'));
            } else {
              resolve(ret[targetID]);
            }
          });
        });
      } catch (err) {
        console.error(`[ERROR] User info error: ${err.message}`);
        return api.sendMessage(`⚠️ यूजर जानकारी लाने में गलती: ${err.message} 🕉️`, threadID);
      }

      const name = userInfo.name || 'Unknown User';
      console.log(`[DEBUG] User name: ${name}`);
      // Try high-quality URL first, fall back to thumbSrc, then default
      const profilePicUrls = [
        `https://graph.facebook.com/${targetID}/picture?type=large`,
        userInfo.thumbSrc,
        'https://via.placeholder.com/200'
      ];
      console.log(`[DEBUG] Profile picture URLs to try: ${JSON.stringify(profilePicUrls)}`);

      let profilePic;
      let selectedUrl;
      for (const url of profilePicUrls) {
        try {
          console.log(`[DEBUG] Downloading profile picture from ${url}`);
          selectedUrl = url;
          const response = await axios.get(url, { responseType: 'arraybuffer' });
          if (!response.data || response.data.length === 0) {
            throw new Error('Empty response data for profile picture');
          }
          profilePic = await Jimp.read(Buffer.from(response.data));
          console.log(`[DEBUG] Profile picture downloaded successfully from ${url}`);
          break;
        } catch (err) {
          console.error(`[ERROR] Profile picture download error from ${url}: ${err.message}`);
          if (url === profilePicUrls[profilePicUrls.length - 1]) {
            console.log('[DEBUG] All URLs failed, using default placeholder');
            profilePic = await Jimp.read('https://via.placeholder.com/200');
            console.log('[DEBUG] Default profile picture loaded');
          }
        }
      }

      try {
        // Use bicubic interpolation for better quality resizing
        profilePic.resize(150, 150, Jimp.RESIZE_BICUBIC);
        // Add a gradient border to default image for style
        if (selectedUrl === 'https://via.placeholder.com/200') {
          const border = new Jimp(160, 160);
          border.scan(0, 0, border.bitmap.width, border.bitmap.height, (x, y, idx) => {
            const t = Math.min(x, y, border.bitmap.width - x, border.bitmap.height - y) / 10;
            border.bitmap.data[idx] = t * 255; // Red gradient border
            border.bitmap.data[idx + 1] = t * 165;
            border.bitmap.data[idx + 2] = 0;
            border.bitmap.data[idx + 3] = 255;
          });
          border.composite(profilePic, 5, 5);
          profilePic = border;
        }
        console.log('[DEBUG] Profile picture resized');
      } catch (err) {
        console.error(`[ERROR] Profile picture resize error: ${err.message}`);
        return api.sendMessage('⚠️ प्रोफाइल पिक्चर प्रोसेस करने में गलती। 🕉️', threadID);
      }

      // Create a colorful gradient background (300x300)
      let badgeImage;
      try {
        badgeImage = new Jimp(300, 300);
        const colors = [
          { start: '#FF0000', end: '#0000FF' }, // Red to Blue
          { start: '#00FF00', end: '#FF00FF' }, // Green to Magenta
          { start: '#FFFF00', end: '#FF4500' }, // Yellow to OrangeRed
          { start: '#00FFFF', end: '#FF69B4' }  // Cyan to HotPink
        ];
        const selectedGradient = colors[Math.floor(Math.random() * colors.length)];
        console.log(`[DEBUG] Selected gradient: ${selectedGradient.start} to ${selectedGradient.end}`);

        badgeImage.scan(0, 0, badgeImage.bitmap.width, badgeImage.bitmap.height, (x, y, idx) => {
          const t = y / badgeImage.bitmap.height;
          const r = parseInt(selectedGradient.start.slice(1, 3), 16) * (1 - t) + parseInt(selectedGradient.end.slice(1, 3), 16) * t;
          const g = parseInt(selectedGradient.start.slice(3, 5), 16) * (1 - t) + parseInt(selectedGradient.end.slice(3, 5), 16) * t;
          const b = parseInt(selectedGradient.start.slice(5, 7), 16) * (1 - t) + parseInt(selectedGradient.end.slice(5, 7), 16) * t;
          badgeImage.bitmap.data[idx] = r;
          badgeImage.bitmap.data[idx + 1] = g;
          badgeImage.bitmap.data[idx + 2] = b;
          badgeImage.bitmap.data[idx + 3] = 255;
        });
        console.log('[DEBUG] Gradient background created');
      } catch (err) {
        console.error(`[ERROR] Failed to create badge image: ${err.message}`);
        return api.sendMessage('⚠️ बैज इमेज बनाने में गलती। डेवलपर से संपर्क करें! 🕉️', threadID);
      }

      try {
        badgeImage.composite(profilePic, selectedUrl === 'https://via.placeholder.com/200' ? 70 : 75, selectedUrl === 'https://via.placeholder.com/200' ? 70 : 75);
        console.log('[DEBUG] Profile picture composited');
      } catch (err) {
        console.error(`[ERROR] Profile picture composition error: ${err.message}`);
        return api.sendMessage('⚠️ प्रोफाइल पिक्चर जोड़ने में गलती। 🕉️', threadID);
      }

      let font;
      try {
        console.log('[DEBUG] Loading bold font');
        font = await Jimp.loadFont(Jimp.FONT_SANS_64_BLACK);
        badgeImage.print(font, 10, 10, name.substring(0, 15));
        console.log('[DEBUG] Name printed on badge');
      } catch (err) {
        console.error(`[ERROR] Font loading error: ${err.message}`);
        return api.sendMessage('⚠️ फॉन्ट लोड करने में गलती। डेवलपर से संपर्क करें! 🕉️', threadID);
      }

      let outputPath;
      try {
        outputPath = path.join(__dirname, `badge_${targetID}_${Date.now()}.png`);
        console.log(`[DEBUG] Saving badge image to ${outputPath}`);
        await badgeImage.write(outputPath);
        await new Promise(resolve => setTimeout(resolve, 100));
        console.log(`[DEBUG] Badge image saved to ${outputPath}`);
      } catch (err) {
        console.error(`[ERROR] Failed to save badge image: ${err.message}`);
        return api.sendMessage('⚠️ बैज इमेज सेव करने में गलती। 🕉️', threadID);
      }

      try {
        if (!fs.existsSync(outputPath)) {
          console.error(`[ERROR] Badge image file does not exist: ${outputPath}`);
          return api.sendMessage('⚠️ बैज इमेज फाइल नहीं मिली। डेवलपर से संपर्क करें! 🕉️', threadID);
        }
        console.log(`[DEBUG] File exists: ${outputPath}`);
      } catch (err) {
        console.error(`[ERROR] Error checking file existence: ${err.message}`);
        return api.sendMessage('⚠️ फाइल चेक करने में गलती। डेवलपर से संपर्क करें! 🕉️', threadID);
      }

      try {
        console.log('[DEBUG] Creating read stream for badge image');
        const attachment = fs.createReadStream(outputPath);
        console.log('[DEBUG] Sending badge image with attachment');
        await api.sendMessage({
          body: `🌟 ${name} का सुपर मस्त बैज तैयार है! 🔥🎉🦁🚀`,
          attachment: [attachment]
        }, threadID);
        console.log('[DEBUG] Badge image sent successfully');
      } catch (err) {
        console.error(`[ERROR] Failed to send badge: ${err.message}`);
        return api.sendMessage(`⚠️ बैज भेजने में गलती: ${err.message} 🕉️`, threadID);
      }

      try {
        fs.unlinkSync(outputPath);
        console.log(`[DEBUG] Deleted badge image: ${outputPath}`);
      } catch (err) {
        console.error(`[DEBUG] Error deleting badge image: ${err.message}`);
      }
    } catch (err) {
      console.error(`[ERROR] Badge command error: ${err.message}`);
      api.sendMessage(`❌ कमांड चलाने में गलती: ${err.message} 🕉️`, threadID);
    }
  }
};
