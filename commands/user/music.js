const fs = require("fs");
const path = require("path");
const yts = require("yt-search");
const play = require("play-dl");
const ffmpeg = require("fluent-ffmpeg");
const ffmpegPath = require("@ffmpeg-installer/ffmpeg").path;
const { HttpsProxyAgent } = require("https-proxy-agent"); // Add this for proxy support
ffmpeg.setFfmpegPath(ffmpegPath);

const CACHE_DIR = path.join(__dirname, "../cache");
if (!fs.existsSync(CACHE_DIR)) fs.mkdirSync(CACHE_DIR, { recursive: true });

const YT_COOKIES = JSON.parse(process.env.YOUTUBE_COOKIES || "[]"); // Parse cookies from env
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
        const song = search.videos[0];
        job.url = song.url;
        job.title = song.title;

        await wait(1000 + Math.random() * 1000); // Random delay

        let attempt = 0, stream;
        const maxAttempts = 10;
        // Optional: Proxy setup (uncomment to use)
        // const proxy = 'http://your_proxy_ip:port';
        // play.set_option('agent', new HttpsProxyAgent(proxy));

        while (attempt < maxAttempts) {
          try {
            console.log(`Request for ${query}, attempt ${attempt + 1}`);
            stream = await play.stream(song.url, {
              quality: 2,
              cookies: YT_COOKIES.length ? YT_COOKIES : undefined // Use parsed cookies
            });
            console.log('Stream headers:', stream.headers); // Log headers for debugging
            break;
          } catch (err) {
            attempt++;
            if (err.message.includes("429") || err.message.includes("rate")) {
              const backoff = 3000 * Math.pow(2, attempt) + Math.random() * 1500;
              console.warn(`⚠️ 429 error, retry #${attempt} in ${Math.round(backoff)}ms`);
              await wait(backoff);
            } else {
              console.error('Stream error:', err);
              throw err;
            }
          }
        }
        if (!stream) throw new Error("Stream fetch failed after retries");

        await new Promise((resolve, reject) => {
          ffmpeg(stream.stream)
            .audioBitrate(128)
            .format("mp3")
            .on("end", resolve)
            .on("error", reject)
            .save(cacheFile);
        });

        await sendSong(api, threadID, cacheFile, job);
        cleanCache(200);
      }
    }
  } catch (err) {
    console.error("Music error:", err);
    if (err.message.includes("429")) {
      cleanCache(0); // Clear cache on 429
      api.sendMessage("❌ Rate limit error, thodi der baad try karo।", threadID);
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
  description: "Plays YouTube music safely using cookies (handles 429).",
  async execute(api, threadID, args) {
    const query = args.join(" ");
    if (!query) return api.sendMessage("❌ गाना नाम डालो।", threadID);

    globalQueue.push({ query, threadID });
    processQueue(api);
  },
};
