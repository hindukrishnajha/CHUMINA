const fs = require("fs");
const path = require("path");
const yts = require("yt-search");
const play = require("play-dl");
const ffmpeg = require("fluent-ffmpeg");
const ffmpegPath = require("@ffmpeg-installer/ffmpeg").path;
ffmpeg.setFfmpegPath(ffmpegPath);

const songQueue = {};
const CACHE_DIR = path.join(__dirname, "../cache");
if (!fs.existsSync(CACHE_DIR)) fs.mkdirSync(CACHE_DIR, { recursive: true });

module.exports = {
  name: "music",
  description: "Plays a song from YouTube safely.",
  async execute(api, threadID, args, event, botState) {
    const query = args.join(" ");
    if (!query) return api.sendMessage("❌ गाना नाम डालो।", threadID);

    if (!songQueue[threadID]) songQueue[threadID] = [];

    const processSong = async () => {
      if (songQueue[threadID].length === 0) return;

      const songReq = songQueue[threadID][0];

      try {
        const cacheFile = path.join(CACHE_DIR, encodeURIComponent(songReq.query) + ".mp3");
        if (fs.existsSync(cacheFile)) {
          await sendSong(cacheFile, songReq);
          return;
        }

        const search = await yts(songReq.query);
        if (!search.videos.length) {
          api.sendMessage("❌ गाना नहीं मिला।", threadID);
          songQueue[threadID].shift();
          processSong();
          return;
        }

        const song = search.videos[0];
        songReq.url = song.url;
        songReq.title = song.title;

        const stream = await play.stream(song.url, { quality: 2 });
        const webmPath = path.join(CACHE_DIR, `${Date.now()}.webm`);
        await new Promise((resolve, reject) => {
          const ws = fs.createWriteStream(webmPath);
          stream.stream.pipe(ws);
          ws.on("finish", resolve);
          ws.on("error", reject);
        });

        await new Promise((resolve, reject) => {
          ffmpeg(webmPath)
            .toFormat("mp3")
            .audioBitrate(128)
            .on("end", resolve)
            .on("error", reject)
            .save(cacheFile);
        });

        if (fs.existsSync(webmPath)) fs.unlinkSync(webmPath);
        await sendSong(cacheFile, songReq);

      } catch (err) {
        console.error("Music command error:", err);
        api.sendMessage("❌ गाना भेजने में गलती हुई।", threadID);
      } finally {
        songQueue[threadID].shift();
        if (songQueue[threadID].length > 0) processSong();
      }
    };

    const sendSong = async (filePath, songReq) => {
      api.sendMessage(
        {
          body: `🎵 गाना: ${songReq.title || songReq.query}\n🔗 ${songReq.url || 'URL not available'}`,
          attachment: fs.createReadStream(filePath)
        },
        threadID,
        (err) => {
          if (err) console.error("SendMessage error:", err);
        }
      );
    };

    songQueue[threadID].push({ query });
    if (songQueue[threadID].length === 1) processSong();
  }
};
