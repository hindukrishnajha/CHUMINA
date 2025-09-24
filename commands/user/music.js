const fs = require("fs");
const path = require("path");
const yts = require("yt-search");
const ytdl = require("ytdl-core");
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
      // Filter out live streams, shorts, and non-videos
      const videos = search.videos.filter(v => !v.live && v.duration && v.duration.seconds > 30 && v.duration.seconds < 600);
      if (!videos.length) {
        api.sendMessage("❌ कोई उपयुक्त गाना नहीं मिला।", threadID);
      } else {
        let videoIndex = 0;
        let stream = null;
        const maxVideos = Math.min(videos.length, 5); // Try up to 5 videos
        const cookieString = YT_COOKIES.map(c => `${c.name}=${c.value}`).join("; ");

        // Optional: Proxy setup
        // const { HttpsProxyAgent } = require("https-proxy-agent");
        // const proxy = 'http://your_proxy_ip:port';
        // const agent = new HttpsProxyAgent(proxy);

        while (videoIndex < maxVideos && !stream) {
          const song = videos[videoIndex];
          job.url = song.url;
          job.title = song.title;
          console.log(`Trying video: ${job.title} (${job.url})`);

          await wait(2000 + Math.random() * 2000);

          let attempt = 0;
          const maxAttempts = 5;

          while (attempt < maxAttempts) {
            try {
              console.log(`Request for ${query}, attempt ${attempt + 1}, video ${videoIndex + 1}`);
              stream = ytdl(song.url, {
                quality: "highestaudio",
                filter: "audioonly",
                highWaterMark: 1 << 25, // 32MB buffer
                requestOptions: {
                  headers: {
                    cookie: cookieString,
                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
                  }
                  // agent // Uncomment for proxy
                }
              });
              // Test stream before processing
              await new Promise((resolve, reject) => {
                stream.on('info', resolve);
                stream.on('error', reject);
              });
              break;
            } catch (err) {
              attempt++;
              if (err.message.includes("410") || err.message.includes("Status code: 410")) {
                console.warn(`⚠️ 410 error for ${song.url}, moving to next video`);
                stream = null;
                break;
              } else if (err.message.includes("429") || err.message.includes("rate")) {
                const backoff = 5000 * Math.pow(2, attempt) + Math.random() * 2000;
                console.warn(`⚠️ 429 error, retry #${attempt} in ${Math.round(backoff)}ms`);
                await wait(backoff);
              } else {
                console.error('Stream error:', err);
                throw err;
              }
            }
          }
          videoIndex++;
        }

        if (!stream) throw new Error("No playable video found after trying multiple sources");

        await new Promise((resolve, reject) => {
          ffmpeg(stream)
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
  description: "Plays YouTube music using ytdl-core (handles 410 and 429).",
  async execute(api, threadID, args) {
    const query = args.join(" ");
    if (!query) return api.sendMessage("❌ गाना नाम डालो।", threadID);

    globalQueue.push({ query, threadID });
    processQueue(api);
  },
};
