const { botState } = require('../../config/botState');

module.exports = {
    handleAutoMessage: (api, threadID, args, event, botState, isMaster) => {
        console.log(`[DEBUG] handleAutoMessage called: threadID=${threadID}, args=${JSON.stringify(args)}`);
        try {
            if (!botState) {
                console.error('[ERROR] botState is undefined');
                api.sendMessage('⚠️ इंटरनल एरर: बॉट स्टेट इनिशियलाइज नहीं हुआ।', threadID);
                return;
            }
            if (!botState.sessions[event.senderID]) {
                console.error('[ERROR] No session found for user:', event.senderID);
                api.sendMessage('⚠️ बॉट सेशन नहीं मिला।', threadID);
                return;
            }

            const botConfig = botState.sessions[event.senderID].botConfig || { autoSpamAccept: false, autoMessageAccept: false };
            botConfig.autoMessageAccept = !botConfig.autoMessageAccept;
            api.sendMessage(`✅ ऑटो मैसेज ${botConfig.autoMessageAccept ? 'चालू' : 'बंद'} कर दिया गया!`, threadID);
            botState.sessions[event.senderID].botConfig = botConfig;

            const broadcast = require('../../utils/broadcast').broadcast;
            broadcast({
                type: 'settings',
                autoSpamAccept: botConfig.autoSpamAccept,
                autoMessageAccept: botConfig.autoMessageAccept,
                autoConvo: botState.autoConvo,
                userId: event.senderID
            });
        } catch (e) {
            console.error('[ERROR] handleAutoMessage error:', e.message);
            api.sendMessage('⚠️ ऑटो मैसेज कमांड में गलती। कृपया फिर से ट्राई करें।', threadID);
        }
    }
};
