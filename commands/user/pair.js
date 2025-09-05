const axios = require('axios');

module.exports = {
  name: "pair",
  execute(api, threadID, args, event, botState, isMaster, botID) {
    try {
      api.getThreadInfo(threadID, (err, info) => {
        if (err || !info?.participantIDs) {
          api.sendMessage('Failed to get group info.', threadID);
          console.error('ThreadInfo error for pair:', err);
          return;
        }

        const members = info.participantIDs.filter(id => id !== botID);
        if (members.length < 2) {
          api.sendMessage('Not enough members to pair.', threadID);
          return;
        }

        const random1 = members[Math.floor(Math.random() * members.length)];
        let random2 = members[Math.floor(Math.random() * members.length)];
        while (random2 === random1) {
          random2 = members[Math.floor(Math.random() * members.length)];
        }

        api.getUserInfo([random1, random2], async (err, ret) => {
          if (err || !ret) {
            api.sendMessage('Failed to get user info.', threadID);
            console.error('UserInfo error for pair:', err);
            return;
          }

          const name1 = ret[random1]?.name || 'User1';
          const name2 = ret[random2]?.name || 'User2';
          const profilePic1 = ret[random1]?.thumbSrc || null;
          const profilePic2 = ret[random2]?.thumbSrc || null;

          const pairMessages = [
            `इन दोनों की पसंद लगभग एक जैसी है ये अच्छे दोस्त बन सकते हैं 😎`,
            `ये दोनों सबसे ज्यादा एक जैसे हैं इन दोनों की बॉन्डिंग अच्छी बन सकती है ❤️`,
            `ये दोनों कमाल के बंदे हैं यार 🔥`
          ];
          const randomMsg = pairMessages[Math.floor(Math.random() * pairMessages.length)];

          const msgBody = `💑 ये लो तुम्हारा जोड़ा! ${name1} और ${name2}!\n${randomMsg}`;
          const mentions = [
            { tag: name1, id: random1 },
            { tag: name2, id: random2 }
          ];

          let attachments = [];
          if (profilePic1) {
            try {
              const pic1 = await axios.get(profilePic1, { responseType: 'stream' });
              attachments.push(pic1.data);
            } catch (e) {
              console.error('Error fetching profile pic1:', e);
            }
          }
          if (profilePic2) {
            try {
              const pic2 = await axios.get(profilePic2, { responseType: 'stream' });
              attachments.push(pic2.data);
            } catch (e) {
              console.error('Error fetching profile pic2:', e);
            }
          }

          api.sendMessage({
            body: msgBody,
            mentions: mentions,
            attachment: attachments
          }, threadID);
          console.log(`Paired ${name1} and ${name2} in thread ${threadID}`);
        });
      });
    } catch (e) {
      api.sendMessage('Error in pair command.', threadID);
      console.error('Pair command error:', e);
    }
  }
};
