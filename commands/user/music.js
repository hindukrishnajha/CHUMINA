const fs = require("fs");
const path = require("path");
const yts = require("yt-search");
const play = require("play-dl");
const ffmpeg = require("fluent-ffmpeg");
const ffmpegPath = require("@ffmpeg-installer/ffmpeg").path;
ffmpeg.setFfmpegPath(ffmpegPath);

const CACHE_DIR = path.join(__dirname, "../cache");
if (!fs.existsSync(CACHE_DIR)) fs.mkdirSync(CACHE_DIR, { recursive: true });

// simple wait
const wait = (ms) => new Promise((res) => setTimeout(res, ms));

// --- GLOBAL QUEUE (max 1 song at a time) ---
const globalQueue = [];
let isProcessing = false;

// cache cleanup helper
function cleanCache(maxFiles = 50) {
  const files = fs.readdirSync(CACHE_DIR).map(f => ({
    name: f,
    time: fs.statSync(path.join(CACHE_DIR, f)).mtimeMs
  }));
  if (files.length > maxFiles) {
    files.sort((a, b) => a.time - b.time); // oldest first
    const toDelete = files.slice(0, files.length - maxFiles);
    for (const f of toDelete) {
      try {
        fs.unlinkSync(path.join(CACHE_DIR, f.name));
      } catch {}
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
        const song = search.videos[0];
        job.url = song.url;
        job.title = song.title;

        // retry on 429
        let attempt = 0, stream;
        while (attempt < 4) {
          try {
            stream = await play.stream(song.url, { quality: 2 });
            break;
          } catch (err) {
            attempt++;
            if (err.message.includes("429") || err.message.includes("rate")) {
              const backoff = 1000 * Math.pow(2, attempt) + Math.random() * 500;
              console.warn(`429 error, retry in ${backoff}ms`);
              await wait(backoff);
            } else throw err;
          }
        }
        if (!stream) throw new Error("Stream fetch failed");

        // direct convert to mp3, no temp files
        await new Promise((resolve, reject) => {
          ffmpeg(stream.stream)
            .audioBitrate(128)
            .format("mp3")
            .on("end", resolve)
            .on("error", reject)
            .save(cacheFile);
        });

        await sendSong(api, threadID, cacheFile, job);
        cleanCache(50); // keep cache small
      }
    }
  } catch (err) {
    console.error("Music error:", err);
    api.sendMessage("❌ गाना भेजने में गलती हुई।", job.threadID);
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
    (err) => {
      if (err) console.error("Send error:", err);
    }
  );
}

module.exports = {
  name: "music",
  description: "Plays YouTube music safely (no cookies, low memory).",
  async execute(api, threadID, args) {
    const query = args.join(" ");
    if (!query) return api.sendMessage("❌ गाना नाम डालो।", threadID);

    globalQueue.push({ query, threadID });
    processQueue(api);
  },
};
