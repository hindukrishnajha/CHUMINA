const fs = require('fs');

module.exports = {
    handleLearn: (api, threadID, msg, learnedResponses, LEARNED_RESPONSES_PATH) => {
        try {
            const match = msg.match(/^#learn \((.*?)\) \{(.*?)\}$/);
            if (!match) {
                api.sendMessage(`Usage: ${botState.sessions[threadID]?.prefix || '#'}learn (trigger) {response}`, threadID);
                return;
            }

            const [, trigger, response] = match;
            if (!trigger || !response) {
                api.sendMessage('Trigger and response cannot be empty.', threadID);
                return;
            }

            const triggerLower = trigger.toLowerCase();
            if (triggerLower.includes('shalender') || triggerLower.includes('selender')) {
                api.sendMessage('shalender king h or king hi rahega', threadID);
                return;
            }

            learnedResponses.triggers.push({ trigger, response });
            learnedResponses.adminList = botState.adminList;
            fs.writeFileSync(LEARNED_RESPONSES_PATH, JSON.stringify(learnedResponses, null, 2));
            api.sendMessage(`✅ Learned new response!\nTrigger: ${trigger}\nResponse: ${response}`, threadID);
        } catch (e) {
            api.sendMessage('Error in learn command.', threadID);
            console.error('Learn command error:', e);
        }
    }
};
