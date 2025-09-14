const Jimp = require('jimp');
const fs = require('fs');
const path = require('path');

module.exports = {
  name: 'badge',
  description: 'Generate a stylish text-based badge with name, verified title, date, and custom stamp 🌟🔥',
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

      // Add name, verified badge, date, and stamp
      let font;
      try {
        console.log('[DEBUG] Loading bold font for name');
        font = await Jimp.loadFont(Jimp.FONT_SANS_64_WHITE); // White for visibility
        badgeImage.print(font, 10, 30, `@${name.substring(0, 15)}`, 280); // @user NAME
        console.log('[DEBUG] Name printed on badge');
      } catch (err) {
        console.error(`[ERROR] Font loading error for name: ${err.message}`);
        return api.sendMessage('⚠️ नाम लिखने में गलती। डेवलपर से संपर्क करें! 🕉️', threadID);
      }

      // Add verified badge title
      const titles = [
        'VERIFIED', 'KING', 'QUEEN', 'RANDII', 'LAVDII', 'TATTA', 'CHOTA TATTA',
        'BDA TATTA', 'TATTO KA DOST', 'TATTO KA KAAL', 'TATTA KING', 'PORNSTAR',
        'MIA KHALIFA', 'SUNNYLEON', 'DENI DENIAL', 'MAHAMURKH', 'NAMOONA',
        'JOKAR', 'NOKAR', 'MAHISTMATI SHAMRAT', 'GULAAM', 'CHUTIYA',
        'CHUTIYO KA RAJA', 'MAHACHUTIYA', 'NO.1 CHUTIA', '2025 KA FYTR'
      ];
      const selectedTitle = titles[Math.floor(Math.random() * titles.length)];
      try {
        console.log('[DEBUG] Loading font for verified badge');
        font = await Jimp.loadFont(Jimp.FONT_SANS_32_WHITE);
        badgeImage.print(font, 10, 120, `VERIFIED ${selectedTitle}`, 280); // VERIFIED <title>
        console.log('[DEBUG] Verified badge printed');
      } catch (err) {
        console.error(`[ERROR] Font loading error for verified badge: ${err.message}`);
        return api.sendMessage('⚠️ उपाधि लिखने में गलती। डेवलपर से संपर्क करें! 🕉️', threadID);
      }

      // Add random year (2000-2025)
      const randomYear = Math.floor(Math.random() * (2025 - 2000 + 1)) + 2000;
      const dateStr = `BADGE DHARAN KIYA: ${randomYear}`;
      try {
        console.log('[DEBUG] Loading font for date');
        font = await Jimp.loadFont(Jimp.FONT_SANS_16_WHITE);
        badgeImage.print(font, 10, 180, dateStr, 280);
        console.log('[DEBUG] Date printed on badge');
      } catch (err) {
        console.error(`[ERROR] Font loading error for date: ${err.message}`);
        return api.sendMessage('⚠️ तारीख लिखने में गलती। डेवलपर से संपर्क करें! 🕉️', threadID);
      }

      // Add random stamp (5-6 options with circle background)
      const stamps = [
        '100% ✅', 'Verified 🖨️', 'Approved ✓', 'Elite 🌟', 'Pro 🔥', 'Legend 🦁'
      ];
      const selectedStamp = stamps[Math.floor(Math.random() * stamps.length)];
      try {
        console.log('[DEBUG] Creating stamp circle');
        const stampCircle = new Jimp(80, 80, 0x00000000); // Transparent background
        stampCircle.circle({ radius: 40, x: 40, y: 40 }); // Draw circle
        stampCircle.scan(0, 0, stampCircle.bitmap.width, stampCircle.bitmap.height, (x, y, idx) => {
          if (stampCircle.bitmap.data[idx + 3] !== 0) { // Only fill non-transparent pixels
            stampCircle.bitmap.data[idx] = Math.random() * 255; // Random red
            stampCircle.bitmap.data[idx + 1] = Math.random() * 255; // Random green
            stampCircle.bitmap.data[idx + 2] = Math.random() * 255; // Random blue
            stampCircle.bitmap.data[idx + 3] = 255; // Full opacity
          }
        });
        console.log('[DEBUG] Loading font for stamp');
        font = await Jimp.loadFont(Jimp.FONT_SANS_16_WHITE);
        stampCircle.print(font, 10, 30, selectedStamp, 60); // Center stamp text
        badgeImage.composite(stampCircle, 210, 210); // Right-bottom corner
        console.log('[DEBUG] Stamp printed on badge');
      } catch (err) {
        console.error(`[ERROR] Stamp creation error: ${err.message}`);
        return api.sendMessage('⚠️ स्टैंप बनाने में गलती। डेवलपर से संपर्क करें! 🕉️', threadID);
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
          body: `🌟 @${name} का सुपर मस्त बैज तैयार है! 🔥🎉🦁🚀\nनिकनेम: ${selectedTitle}\nउपाधि: VERIFIED ${selectedTitle}\n${dateStr}\nस्टैंप: ${selectedStamp}`,
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
