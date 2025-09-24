const fs = require("fs");
const path = require("path");
const yts = require("yt-search");
const { exec } = require("child_process");
const ffmpeg = require("fluent-ffmpeg");
const ffmpegPath = require("@ffmpeg-installer/ffmpeg").path;
ffmpeg.setFfmpegPath(ffmpegPath);

const CACHE_DIR = path.join(__dirname, "../cache");
if (!fs.existsSync(CACHE_DIR)) fs.mkdirSync(CACHE_DIR, { recursive: true });

const YT_COOKIES = JSON.parse(process.env.YOUTUBE_COOKIES || "[]");
const wait = (ms) => new Promise((res) => setTimeout(res, ms));

const globalQueue = [];
let isProcessing = false;

function cleanCache(maxFiles = 200) {
  const files = fs.readdirSync(CACHE_DIR).map(f => ({
    name: f,
    time: fs.statSync(path.join(CACHE_DIR, f)).mtimeMs
  }));
  if (files.length > maxFiles) {
    files.sort((a, b) => a.time - b.time);
    const toDelete = files.slice(0, files.length - maxFiles);
    for (const f of toDelete) {
      try { fs.unlinkSync(path.join(CACHE_DIR, f.name)); } catch {}
    }
  }
}

async function processQueue(api) {
  if (isProcessing || globalQueue.length === 0) return;
  isProcessing = true;

  const job = globalQueue[0];
  const { query, threadID } = job;

  try {
    const cacheFile = path.join(CACHE_DIR, encodeURIComponent(query) + ".mp3");

    if (fs.existsSync(cacheFile)) {
      await sendSong(api, threadID, cacheFile, job);
    } else {
      const search = await yts(query);
      if (!search.videos.length) {
        api.sendMessage("❌ गाना नहीं मिला।", threadID);
      } else {
        let videoIndex = 0;
        let success = false;
        const maxVideos = Math.min(search.videos.length, 3);
        const cookieFile = path.join(CACHE_DIR, "cookies.txt");

        // Write cookies to a file for yt-dlp
        const cookieString = YT_COOKIES.map(c => `youtube.com\tTRUE\t/\t${c.secure ? "TRUE" : "FALSE"}\t${c.expirationDate || 0}\t${c.name}\t${c.value}`).join("\n");
        fs.writeFileSync(cookieFile, cookieString);

        while (videoIndex < maxVideos && !success) {
          const song = search.videos[videoIndex];
          job.url = song.url;
          job.title = song.title;
          console.log(`Trying video: ${job.title} (${job.url})`);

          await wait(2000 + Math.random() * 2000);

          try {
            await new Promise((resolve, reject) => {
              exec(`yt-dlp --cookies ${cookieFile} -x --audio-format mp3 -o "${cacheFile}" "${song.url}"`, (err) => {
                if (err) reject(err);
                else resolve();
              });
            });
            success = true;
          } catch (err) {
            console.warn(`⚠️ Error for ${song.url}: ${err.message}`);
            videoIndex++;
          }
        }

        if (!success) throw new Error("No playable video found after trying multiple sources");

        await sendSong(api, threadID, cacheFile, job);
        cleanCache(200);
      }
    }
  } catch (err) {
    console.error("Music error:", err);
    if (err.message.includes("410") || err.message.includes("not available")) {
      api.sendMessage("❌ गाना उपलब्ध नहीं है, कृपया दूसरा गाना ट्राई करें।", threadID);
    } else if (err.message.includes("429")) {
      cleanCache(0);
      api.sendMessage("❌ Rate limit error, थोड़ी देर बाद ट्राई करें।", threadID);
    } else {
      api.sendMessage(`❌ गाना भेजने में गलती हुई: ${err.message}`, threadID);
    }
  } finally {
    globalQueue.shift();
    isProcessing = false;
    if (globalQueue.length > 0) processQueue(api);
  }
}

async function sendSong(api, threadID, filePath, job) {
  api.sendMessage(
    {
      body: `🎵 गाना: ${job.title || job.query}\n🔗 ${job.url || "URL not available"}`,
      attachment: fs.createReadStream(filePath),
    },
    threadID,
    (err) => { if (err) console.error("Send error:", err); }
  );
}

module.exports = {
  name: "music",
  description: "Plays YouTube music using yt-dlp (handles 410 and 429).",
  async execute(api, threadID, args) {
    const query = args.join(" ");
    if (!query) return api.sendMessage("❌ गाना नाम डालो।", threadID);

    globalQueue.push({ query, threadID });
    processQueue(api);
  },
};
