const yts = require("yt-search");
const fs = require("fs");
const path = require("path");
const play = require("play-dl");
const ffmpeg = require("fluent-ffmpeg");
const ffmpegPath = require("@ffmpeg-installer/ffmpeg").path;

// ✅ Set ffmpeg path for Render
ffmpeg.setFfmpegPath(ffmpegPath);

module.exports = {
  config: {
    name: "music",
    aliases: ["song", "audio"],
    version: "1.2",
    author: "Fixed by ChatGPT",
    role: 0,
    cooldown: 10,
    shortDescription: "Play music from YouTube",
    longDescription: "Search a song on YouTube and play it as audio",
    category: "music",
    guide: {
      en: "{p}music <song name>"
    }
  },

  onStart: async function ({ api, event, args }) {
    const query = args.join(" ");
    if (!query) {
      return api.sendMessage("❌ Please provide a song name.", event.threadID, event.messageID);
    }

    try {
      // 🔍 Search song
      const search = await yts(query);
      if (!search.videos.length) {
        return api.sendMessage("❌ No results found.", event.threadID, event.messageID);
      }

      const song = search.videos[0];
      const fileName = `music_${Date.now()}`;
      const cacheDir = path.join(__dirname, "cache");

      if (!fs.existsSync(cacheDir)) fs.mkdirSync(cacheDir);

      const webmPath = path.join(cacheDir, `${fileName}.webm`);
      const mp3Path = path.join(cacheDir, `${fileName}.mp3`);

      // 🎶 Download with play-dl
      const stream = await play.stream(song.url, { quality: 2 });
      await new Promise((resolve, reject) => {
        const writeStream = fs.createWriteStream(webmPath);
        stream.stream.pipe(writeStream);
        writeStream.on("finish", resolve);
        writeStream.on("error", reject);
      });

      // 🔄 Convert webm → mp3
      await new Promise((resolve, reject) => {
        ffmpeg(webmPath)
          .toFormat("mp3")
          .audioBitrate(128)
          .on("end", resolve)
          .on("error", reject)
          .save(mp3Path);
      });

      // 📤 Send to FB
      api.sendMessage(
        {
          body: `🎵 Now Playing: ${song.title}\n⏱ Duration: ${song.timestamp}\n🔗 Link: ${song.url}`,
          attachment: fs.createReadStream(mp3Path)
        },
        event.threadID,
        () => {
          // cleanup
          try { fs.unlinkSync(webmPath); } catch {}
          try { fs.unlinkSync(mp3Path); } catch {}
        }
      );

    } catch (err) {
      console.error("Music error:", err);
      api.sendMessage("⚠️ Failed to fetch music.", event.threadID, event.messageID);
    }
  }
};
