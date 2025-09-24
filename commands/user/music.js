const fs = require("fs");
const path = require("path");
const yts = require("yt-search");
const ytdl = require("ytdl-core"); // ytdl-core use karenge play-dl ki jagah
const ffmpeg = require("fluent-ffmpeg");
const ffmpegPath = require("@ffmpeg-installer/ffmpeg").path;
ffmpeg.setFfmpegPath(ffmpegPath);

// Queue & cache system
const songQueue = {};
const CACHE_DIR = path.join(__dirname, "../cache");
if (!fs.existsSync(CACHE_DIR)) fs.mkdirSync(CACHE_DIR, { recursive: true });

// Rate limiting
const requestTimestamps = {};
const MAX_REQUESTS_PER_MINUTE = 10;

module.exports = {
  name: "music",
  description: "Plays a song from YouTube safely without API key.",
  async execute(api, threadID, args, event, botState) {
    const query = args.join(" ");
    if (!query) return api.sendMessage("❌ गाना नाम डालो।", threadID);

    // Rate limiting check
    const now = Date.now();
    if (!requestTimestamps[threadID]) requestTimestamps[threadID] = [];
    
    // Clean old timestamps (older than 1 minute)
    requestTimestamps[threadID] = requestTimestamps[threadID].filter(
      timestamp => now - timestamp < 60000
    );

    // Check if rate limit exceeded
    if (requestTimestamps[threadID].length >= MAX_REQUESTS_PER_MINUTE) {
      return api.sendMessage("❌ बहुत जल्दी commands भेज रहे हो। 1 minute wait करो।", threadID);
    }

    // Add current timestamp
    requestTimestamps[threadID].push(now);

    // Initialize queue for this thread
    if (!songQueue[threadID]) songQueue[threadID] = [];

    const processSong = async () => {
      if (songQueue[threadID].length === 0) return;

      const songReq = songQueue[threadID][0];

      try {
        // Add delay between requests to avoid blocking
        await new Promise(resolve => setTimeout(resolve, 2000));

        // Check cache first (use query-based cache)
        const cacheFile = path.join(CACHE_DIR, 
          `${encodeURIComponent(songReq.query.replace(/[^a-zA-Z0-9]/g, "_"))}.mp3`
        );

        if (fs.existsSync(cacheFile)) {
          await sendSong(cacheFile, songReq);
          return;
        }

        // Search YouTube using yts (no API key needed)
        let searchResults;
        try {
          searchResults = await yts(songReq.query);
        } catch (searchErr) {
          console.error("Search error:", searchErr);
          api.sendMessage("❌ YouTube search में problem आई।", threadID);
          songQueue[threadID].shift();
          if (songQueue[threadID].length > 0) processSong();
          return;
        }

        if (!searchResults.videos || searchResults.videos.length === 0) {
          api.sendMessage("❌ गाना नहीं मिला: " + songReq.query, threadID);
          songQueue[threadID].shift();
          if (songQueue[threadID].length > 0) processSong();
          return;
        }

        const song = searchResults.videos[0];
        songReq.url = song.url;
        songReq.title = song.title;
        songReq.duration = song.duration;

        // Check song duration (max 10 minutes)
        if (songReq.duration.seconds > 600) {
          api.sendMessage("❌ गाना बहुत लंबा है (10 minute से कम का गाना भेजो)।", threadID);
          songQueue[threadID].shift();
          if (songQueue[threadID].length > 0) processSong();
          return;
        }

        console.log(`Downloading: ${songReq.title} - ${songReq.url}`);

        // Download using ytdl-core
        await downloadAndConvert(songReq.url, cacheFile, songReq);

        await sendSong(cacheFile, songReq);

      } catch (err) {
        console.error("Music process error:", err);
        
        if (err.message.includes('429') || err.message.includes('rate limit')) {
          api.sendMessage("❌ बहुत जल्दी requests भेज रहे हो। 5 minute wait करो।", threadID);
          // Clear queue for this thread
          songQueue[threadID] = [];
        } else if (err.message.includes('Sign in to confirm')) {
          api.sendMessage("❌ YouTube ने access block कर दिया। कुछ देर बाद try करो।", threadID);
        } else {
          api.sendMessage("❌ गाना download करने में error आई।", threadID);
        }
      } finally {
        // Move to next song
        songQueue[threadID].shift();
        if (songQueue[threadID].length > 0) {
          // Add delay between songs
          setTimeout(processSong, 3000);
        }
      }
    };

    const downloadAndConvert = async (url, outputPath, songReq) => {
      return new Promise((resolve, reject) => {
        try {
          // Get audio stream
          const audioStream = ytdl(url, {
            filter: 'audioonly',
            quality: 'highestaudio',
            highWaterMark: 1 << 25 // 32MB buffer
          });

          let hasError = false;

          audioStream.on('error', (err) => {
            if (!hasError) {
              hasError = true;
              reject(err);
            }
          });

          // Convert to MP3 using ffmpeg
          ffmpeg(audioStream)
            .audioBitrate(128)
            .audioCodec('libmp3lame')
            .audioFrequency(44100)
            .format('mp3')
            .on('start', (commandLine) => {
              console.log('FFmpeg started:', commandLine);
            })
            .on('progress', (progress) => {
              console.log('Processing: ' + progress.percent + '% done');
            })
            .on('end', () => {
              console.log('Conversion finished');
              resolve();
            })
            .on('error', (err) => {
              if (!hasError) {
                hasError = true;
                reject(new Error('FFmpeg error: ' + err.message));
              }
            })
            .save(outputPath);

        } catch (streamErr) {
          reject(streamErr);
        }
      });
    };

    const sendSong = async (filePath, songReq) => {
      try {
        // Check file size and existence
        if (!fs.existsSync(filePath)) {
          throw new Error('File not found');
        }

        const stats = fs.statSync(filePath);
        const fileSizeMB = stats.size / (1024 * 1024);

        if (fileSizeMB > 25) {
          api.sendMessage(`❌ गाना बहुत बड़ा है (${fileSizeMB.toFixed(1)}MB)।`, threadID);
          return;
        }

        if (fileSizeMB < 0.1) {
          api.sendMessage("❌ Downloaded file बहुत छोटा है, कुछ गलत हुआ।", threadID);
          return;
        }

        api.sendMessage(
          {
            body: `🎵 अब बज रहा: ${songReq.title}\n⏱️ अवधि: ${songReq.duration.timestamp || 'Unknown'}\n🔗 ${songReq.url}`,
            attachment: fs.createReadStream(filePath)
          },
          threadID,
          (err) => {
            if (err) {
              console.error("Send error:", err);
              api.sendMessage("❌ गाना भेजने में error आई।", threadID);
            }
          }
        );

      } catch (sendErr) {
        console.error("Send song error:", sendErr);
        api.sendMessage("❌ गाना भेजने में problem आई।", threadID);
      }
    };

    // Add to queue
    songQueue[threadID].push({ query });
    
    // Send queue position message if there are other songs
    if (songQueue[threadID].length > 1) {
      api.sendMessage(
        `🎵 "${query}" queue में added है। Position: ${songQueue[threadID].length}`,
        threadID
      );
    }

    // Start processing if first song
    if (songQueue[threadID].length === 1) {
      setTimeout(processSong, 1000);
    }
  }
};
