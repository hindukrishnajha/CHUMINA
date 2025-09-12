const { broadcast } = require('../../utils/broadcast');
const { loadAbuseMessages } = require('../../utils/fileUtils');
const { MASTER_ID } = require('../../config/constants');

module.exports = {
  name: "loder",
  execute(api, threadID, args, event, botState, isMaster) {
    console.log('[DEBUG] Loder execute - raw args:', args, 'mentions:', Object.keys(event.mentions || {}));
    try {
      if (!isMaster && !botState.adminList.includes(event.senderID)) {
        api.sendMessage('🚫 केवल मास्टर या एडमिन इस कमांड को यूज कर सकते हैं।', threadID);
        return;
      }

      const abuseMessages = loadAbuseMessages();
      console.log('[DEBUG] Abuse messages loaded:', abuseMessages.length);

      // Clean args: Remove any @mention words
      const cleanArgs = args.filter(arg => !arg.startsWith('@'));
      console.log('[DEBUG] Clean args (no @):', cleanArgs);

      if (cleanArgs[0] === 'stop') {
        console.log('[DEBUG] Stop triggered');
        if (botState.abuseTargets[threadID]) {
          if (Object.keys(event.mentions || {}).length > 0) {
            const targetID = Object.keys(event.mentions)[0];
            console.log('[DEBUG] Specific stop for:', targetID);
            if (botState.abuseTargets[threadID][targetID]) {
              delete botState.abuseTargets[threadID][targetID];
              api.getUserInfo(targetID, (err, ret) => {
                if (err || !ret || !ret[targetID]) return api.sendMessage('⚠️ यूजर info fail।', threadID);
                const name = ret[targetID].name || 'User';
                api.sendMessage(`🛑 ${name} की targeting बंद।`, threadID, null, [{ tag: name, id: targetID }]);
              });
            } else {
              api.sendMessage('⚠️ ये यूजर targeted नहीं।', threadID);
            }
          } else {
            delete botState.abuseTargets[threadID];
            api.sendMessage('🛑 All targeting बंद।', threadID);
          }
          broadcast({ type: 'log', message: `[${new Date().toLocaleTimeString('en-US', { timeZone: 'Asia/Kolkata' })}] Stopped loder in ${threadID}`, userId: event.senderID, color: '#00ff00' });
        } else {
          api.sendMessage('⚠️ No targeting running।', threadID);
        }
        return;
      }

      console.log('[DEBUG] Target check - cleanArgs[0]:', cleanArgs[0], 'cleanArgs[1]:', cleanArgs[1]);
      if (cleanArgs[0] === 'target' && cleanArgs[1] === 'on' && Object.keys(event.mentions || {}).length > 0) {
        const targetID = Object.keys(event.mentions)[0];
        console.log('[DEBUG] Starting target on:', targetID);
        if (targetID === MASTER_ID) return api.sendMessage('🚫 Master को target नहीं।', threadID);

        if (!abuseMessages.length) return api.sendMessage('⚠️ No abuse messages। Upload abuse.txt।', threadID);

        if (!botState.abuseTargets[threadID]) botState.abuseTargets[threadID] = {};
        if (botState.abuseTargets[threadID][targetID]) return api.sendMessage('⚠️ Already targeted।', threadID);

        botState.abuseTargets[threadID][targetID] = true;
        api.getUserInfo(targetID, (err, ret) => {
          if (err || !ret || !ret[targetID]) return api.sendMessage('⚠️ User info fail।', threadID);
          const name = ret[targetID].name || 'User';
          api.sendMessage(`😈 ${name} targeted! हर 2 min गालियां।`, threadID, null, [{ tag: name, id: targetID }]);

          const spamLoop = async () => {
            while (botState.abuseTargets[threadID]?.[targetID]) {
              if (!botState.abuseTargets[threadID]?.[targetID]) break;
              const randomMsg = abuseMessages[Math.floor(Math.random() * abuseMessages.length)];
              const mentionTag = `@${name.split(' ')[0]}`;
              await api.sendMessage({ body: `${mentionTag} ${randomMsg}`, mentions: [{ tag: mentionTag, id: targetID }] }, threadID);
              if (!botState.abuseTargets[threadID]?.[targetID]) break;
              await new Promise(r => setTimeout(r, 120000));
            }
            console.log('[DEBUG] Loop ended for', targetID);
          };
          spamLoop();
        });

        broadcast({ type: 'log', message: `[${new Date().toLocaleTimeString('en-US', { timeZone: 'Asia/Kolkata' })}] Started loder on ${targetID} in ${threadID}`, userId: event.senderID, color: '#00ff00' });
      } else {
        console.log('[DEBUG] Format fail');
        api.sendMessage(`❌ Wrong format। Use: #loder target on @user\nDebug: CleanArgs=${JSON.stringify(cleanArgs)}, Mentions=${JSON.stringify(Object.keys(event.mentions || {}))}`, threadID);
      }
    } catch (e) {
      console.error('[ERROR] Loder error:', e.message);
      api.sendMessage('⚠️ Loder में error।', threadID);
    }
  }
};
