const fs = require('fs');

module.exports = {
    handleLearn: (api, threadID, args, event, botState, isMaster, msg, learnedResponses, LEARNED_RESPONSES_PATH) => {
        console.log(`[DEBUG] handleLearn called: threadID=${threadID}, msg=${msg}`);
        try {
            if (!isMaster && !botState.adminList.includes(event.senderID)) {
                api.sendMessage('🚫 केवल मास्टर या एडमिन इस कमांड को यूज कर सकते हैं।', threadID);
                return;
            }

            if (typeof msg !== 'string') {
                console.error('[ERROR] msg is not a string in handleLearn:', typeof msg);
                api.sendMessage('⚠️ लर्न कमांड में गलती। कृपया सही फॉर्मेट यूज करें।', threadID);
                return;
            }

            const match = msg.match(/^#learn \((.*?)\) \{(.*?)\}$/i);
            if (!match) {
                api.sendMessage('❌ सही फॉर्मेट: #learn (trigger) {response}', threadID);
                return;
            }

            const trigger = match[1].trim();
            const response = match[2].trim();
            if (!trigger || !response) {
                api.sendMessage('⚠️ ट्रिगर या रिस्पॉन्स खाली नहीं हो सकता।', threadID);
                return;
            }

            const triggerLower = trigger.toLowerCase();
            if (triggerLower.includes('shalender') || triggerLower.includes('selender')) {
                api.sendMessage('shalender king h or king hi rahega', threadID);
                return;
            }

            learnedResponses.triggers.push({ trigger, response });
            fs.writeFileSync(LEARNED_RESPONSES_PATH, JSON.stringify(learnedResponses, null, 2));
            api.sendMessage(`✅ नया रिस्पॉन्स सीखा गया!\nट्रिगर: ${trigger}\nरिस्पॉन्स: ${response}`, threadID);
            console.log(`[SUCCESS] Learned new response for trigger "${trigger}"`);
        } catch (e) {
            console.error('[ERROR] handleLearn error:', e.message, e.stack);
            api.sendMessage('⚠️ लर्न कमांड में गलती।', threadID);
        }
    }
};
