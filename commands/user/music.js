const fs = require('fs');
const path = require('path');
const ytdl = require('ytdl-core');
const yts = require('yt-search');

module.exports = {
  name: 'music',
  description: 'Plays a song from YouTube as an audio message.',
  async execute(api, threadID, args, event, botState, isMaster) {
    // 30 सेकंड कूलडाउन चेक
    if (botState.commandCooldowns[threadID]?.music) {
      api.sendMessage(
        '👑 किंग के नियमों के हिसाब से अगली म्यूजिक का इस्तमाल करने के लिए आपको 30 सेकंड का इंतज़ार करना होगा। इन 30 सेकंड में आप किंग की महानता के बारे में सोचें, वो कितने दिलेर, कितने महान, कितने शूरवीर, कितने परमवीर हैं! 👑🔥',
        threadID
      );
      return;
    }

    const query = args.slice(1).join(' ') || 'default song';

    // 200 अक्षरों की सर्च टर्म लिमिट
    if (query.length > 200) {
      api.sendMessage('❌ सर्च टर्म ज्यादा लंबा है! 200 अक्षरों तक यूज करो।', threadID);
      return;
    }

    const audioPath = path.join(__dirname, `../../music_${threadID}_${Date.now()}.mp3`);

    try {
      // यूट्यूब पर गाना सर्च करें
      const searchResults = await yts(query);
      const video = searchResults.videos[0];
      if (!video) {
        api.sendMessage('❌ कोई गाना नहीं मिला! सही नाम डालकर दोबारा ट्राई करो। 🎶', threadID);
        return;
      }

      // यूट्यूब वीडियो से ऑडियो डाउनलोड करें
      const stream = ytdl(video.url, {
        filter: 'audioonly',
        quality: 'highestaudio',
        highWaterMark: 1 << 25 // मेमोरी मैनेजमेंट के लिए
      });

      const writeStream = fs.createWriteStream(audioPath);
      stream.pipe(writeStream);

      await new Promise((resolve, reject) => {
        writeStream.on('finish', resolve);
        writeStream.on('error', reject);
      });

      const message = {
        body: `🎵 गाना: ${video.title} (${video.duration.toString()})`,
        attachment: fs.createReadStream(audioPath)
      };
      await new Promise((resolve, reject) => {
        api.sendMessage(message, threadID, (err) => {
          if (err) return reject(err);
          resolve();
        });
      });

      // कूलडाउन सेट करें
      botState.commandCooldowns[threadID] = { music: true };
      setTimeout(() => delete botState.commandCooldowns[threadID]?.music, 30000);
    } catch (err) {
      api.sendMessage(`❌ गाना भेजने में गलती हुई: ${err.message}`, threadID);
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
