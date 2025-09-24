const fs = require("fs");
const path = require("path");
const yts = require("yt-search");
const ytdl = require("ytdl-core");
const ffmpeg = require("fluent-ffmpeg");
const ffmpegPath = require("@ffmpeg-installer/ffmpeg").path;
ffmpeg.setFfmpegPath(ffmpegPath);

// Queue system
const songQueue = {};
const CACHE_DIR = path.join(__dirname, "../cache");
if (!fs.existsSync(CACHE_DIR)) fs.mkdirSync(CACHE_DIR, { recursive: true });

module.exports = {
  name: "music",
  description: "Play music from YouTube",
  async execute(api, threadID, args, event, botState) {
    const query = args.join(" ").trim();
    if (!query) return api.sendMessage("❌ गाना नाम डालो।", threadID);

    // Initialize queue
    if (!songQueue[threadID]) songQueue[threadID] = [];

    try {
      api.sendMessage(`🔍 Searching for: "${query}"...`, threadID);

      // Search YouTube
      const search = await yts(query);
      if (!search.videos.length) {
        return api.sendMessage("❌ कोई गाना नहीं मिला।", threadID);
      }

      const video = search.videos[0];
      const videoUrl = video.url;
      const title = video.title;
      const duration = video.duration;

      // Check duration (max 10 minutes)
      if (duration.seconds > 600) {
        return api.sendMessage("❌ गाना 10 minute से ज्यादा लंबा है।", threadID);
      }

      api.sendMessage(`⬇️ Downloading: ${title} (${duration.timestamp})...`, threadID);

      // Create cache filename
      const cacheFile = path.join(CACHE_DIR, `${Date.now()}_${title.replace(/[^a-zA-Z0-9]/g, "_")}.mp3`);

      // Download and convert
      await new Promise((resolve, reject) => {
        const stream = ytdl(videoUrl, { 
          filter: 'audioonly',
          quality: 'highestaudio' 
        });

        ffmpeg(stream)
          .audioBitrate(128)
          .toFormat('mp3')
          .on('end', () => {
            console.log('Conversion finished');
            resolve();
          })
          .on('error', (err) => {
            console.error('Conversion error:', err);
            reject(err);
          })
          .save(cacheFile);
      });

      // Send the song
      api.sendMessage({
        body: `🎵 ${title}\n⏱️ ${duration.timestamp}\n🔗 ${videoUrl}`,
        attachment: fs.createReadStream(cacheFile)
      }, threadID, (err) => {
        // Clean up file after sending
        if (fs.existsSync(cacheFile)) {
          fs.unlink(cacheFile, (unlinkErr) => {
            if (unlinkErr) console.error('File delete error:', unlinkErr);
          });
        }
        
        if (err) {
          console.error('Send error:', err);
          api.sendMessage("❌ गाना भेजने में error आई।", threadID);
        }
      });

    } catch (error) {
      console.error('Music command error:', error);
      api.sendMessage("❌ Error: " + error.message, threadID);
    }
  }
};
