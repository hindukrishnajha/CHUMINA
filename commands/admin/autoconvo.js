// CHUMINA-main/commands/admin/autoconvo.js
const { botState } = require('../../config/botState');

module.exports = {
    handleAutoConvo: (api, threadID, args, event) => {
        try {
            if (!botState.sessions[event.senderID]) {
                api.sendMessage('⚠️ बॉट सेशन नहीं मिला।', threadID);
                return;
            }

            const botConfig = botState.sessions[event.senderID].botConfig || { autoConvo: false };
            const action = args[0]?.toLowerCase();

            if (action === 'on') {
                botConfig.autoConvo = true;
                api.sendMessage('✅ ऑटो कन्वर्सेशन चालू कर दिया गया!', threadID);
            } else if (action === 'off') {
                botConfig.autoConvo = false;
                api.sendMessage('✅ ऑटो कन्वर्सेशन बंद कर दिया गया!', threadID);
            } else {
                api.sendMessage('❌ यूज: #autoconvo on/off', threadID);
                return;
            }

            botState.sessions[event.senderID].botConfig = botConfig;

            const broadcast = require('../../utils/broadcast').broadcast;
            broadcast({
                type: 'settings',
                autoConvo: botConfig.autoConvo,
                userId: event.senderID
            });
        } catch (e) {
            console.error('[ERROR] handleAutoConvo error:', e.message);
            api.sendMessage('⚠️ ऑटो कन्वर्सेशन कमांड में गलती। कृपया फिर से ट्राई करें।', threadID);
        }
    }
};
