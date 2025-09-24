const yts = require("yt-search");
const fs = require("fs");
const path = require("path");
const play = require("play-dl");
const ffmpeg = require("fluent-ffmpeg");
const ffmpegPath = require("@ffmpeg-installer/ffmpeg").path;

ffmpeg.setFfmpegPath(ffmpegPath);

module.exports = {
  config: {
    name: "music",
    aliases: ["song", "audio"],
    cooldown: 10
  },

  onStart: async function ({ api, event, args }) {
    const query = args.join(" ");
    if (!query) return api.sendMessage("❌ Provide a song name.", event.threadID);

    try {
      const search = await yts(query);
      if (!search.videos.length) return api.sendMessage("❌ No results found.", event.threadID);

      const song = search.videos[0];
      const fileName = `music_${Date.now()}`;
      const cacheDir = path.join(__dirname, "cache");
      if (!fs.existsSync(cacheDir)) fs.mkdirSync(cacheDir);

      const webmPath = path.join(cacheDir, `${fileName}.webm`);
      const mp3Path = path.join(cacheDir, `${fileName}.mp3`);

      // Download
      const stream = await play.stream(song.url, { quality: 2 });
      await new Promise((resolve, reject) => {
        const writeStream = fs.createWriteStream(webmPath);
        stream.stream.pipe(writeStream);
        writeStream.on("finish", resolve);
        writeStream.on("error", reject);
      });

      // Convert
      await new Promise((resolve, reject) => {
        ffmpeg(webmPath)
          .toFormat("mp3")
          .audioBitrate(128)
          .on("end", resolve)
          .on("error", reject)
          .save(mp3Path);
      });

      // Send
      api.sendMessage(
        {
          body: `🎵 Now Playing: ${song.title}\n⏱ ${song.timestamp}\n🔗 ${song.url}`,
          attachment: fs.createReadStream(mp3Path)
        },
        event.threadID,
        () => {
          // Cleanup temp files immediately
          [webmPath, mp3Path].forEach(file => {
            if (fs.existsSync(file)) fs.unlinkSync(file);
          });
        }
      );

    } catch (err) {
      console.error("Music error:", err);
      api.sendMessage("⚠️ Failed to fetch music.", event.threadID);
    }
  }
};
