const fs = require("fs");
const path = require("path");
const yts = require("yt-search");
const play = require("play-dl");
const ffmpeg = require("fluent-ffmpeg");
const ffmpegPath = require("@ffmpeg-installer/ffmpeg").path;
ffmpeg.setFfmpegPath(ffmpegPath);

module.exports = {
  name: "music",
  description: "Plays a song from YouTube.",
  async execute(api, threadID, args, event, botState) {
    const query = args.join(" ");
    if (!query) return api.sendMessage("❌ गाना नाम डालो।", threadID);

    try {
      const search = await yts(query);
      if (!search.videos.length) return api.sendMessage("❌ गाना नहीं मिला।", threadID);

      const song = search.videos[0];
      const cacheDir = path.join(__dirname, "../cache");
      if (!fs.existsSync(cacheDir)) fs.mkdirSync(cacheDir);

      const webmPath = path.join(cacheDir, `${Date.now()}_temp.webm`);
      const mp3Path = path.join(cacheDir, `${Date.now()}.mp3`);

      // Retry logic for play-dl stream
      let stream;
      let attempts = 0;
      while (attempts < 3) {
        try {
          stream = await play.stream(song.url, { quality: 2 });
          break;
        } catch (err) {
          attempts++;
          console.warn(`⚠️ Stream attempt ${attempts} failed: ${err.message}`);
          if (attempts === 3) throw err;
          await new Promise(r => setTimeout(r, 2000)); // 2 sec delay before retry
        }
      }

      // Save webm
      await new Promise((resolve, reject) => {
        const ws = fs.createWriteStream(webmPath);
        stream.stream.pipe(ws);
        ws.on("finish", resolve);
        ws.on("error", reject);
      });

      // Convert to mp3
      await new Promise((resolve, reject) => {
        ffmpeg(webmPath)
          .toFormat("mp3")
          .audioBitrate(128)
          .on("end", resolve)
          .on("error", reject)
          .save(mp3Path);
      });

      // Send music
      api.sendMessage(
        { 
          body: `🎵 गाना: ${song.title}\n⏱ ${song.timestamp}\n🔗 ${song.url}`,
          attachment: fs.createReadStream(mp3Path)
        },
        threadID,
        (err) => {
          if(err) console.error("SendMessage error:", err);
          // Cleanup files
          [webmPath, mp3Path].forEach(f => fs.existsSync(f) && fs.unlinkSync(f));
        }
      );

    } catch (err) {
      console.error("Music command error:", err);
      api.sendMessage("❌ गाना भेजने में गलती हुई। Retry later.", threadID);
    }
  }
};
