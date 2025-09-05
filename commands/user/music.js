const ytdl = require('ytdl-core');
const search = require('yt-search');

module.exports = {
  name: "music",
  execute(api, threadID, args) {
    try {
      const songName = args.slice(1).join(' ');
      if (!songName) return api.sendMessage('Song name required.', threadID);

      api.sendMessage(`🔍 Searching for "${songName}"...`, threadID);

      search(songName).then(searchResults => {
        if (!searchResults.videos.length) {
          api.sendMessage('No results found.', threadID);
          console.log(`No YouTube results for: ${songName}`);
          return;
        }

        const video = searchResults.videos[0];
        ytdl.getInfo(video.url).then(info => {
          const audioStream = ytdl.downloadFromInfo(info, { filter: 'audioonly' });
          api.sendMessage({
            body: `🎵 Here's your song: ${video.title}\nEnjoy!`,
            attachment: audioStream
          }, threadID);
          console.log(`Sent music: ${video.title} to thread ${threadID}`);
        }).catch(e => {
          api.sendMessage('Failed to get song info. Try again.', threadID);
          console.error('YTDL error:', e);
        });
      }).catch(e => {
        api.sendMessage('Failed to search song. Try again.', threadID);
        console.error('YouTube search error:', e);
      });
    } catch (e) {
      api.sendMessage('Error in music command.', threadID);
      console.error('Music command error:', e);
    }
  }
};
