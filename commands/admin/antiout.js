module.exports = {
    handleAntiOut: (api, threadID, args, botConfig) => {
        try {
            if (args[1] === 'on') {
                botConfig.antiOut = true;
                api.sendMessage('🛡️ Anti-out system activated! Members cannot leave now!', threadID);
            } else if (args[1] === 'off') {
                botConfig.antiOut = false;
                api.sendMessage('🛡️ Anti-out system deactivated!', threadID);
            } else {
                api.sendMessage(`Usage: ${botState.sessions[threadID]?.prefix || '#'}antiout on/off`, threadID);
            }
        } catch (e) {
            api.sendMessage('Error in antiout.', threadID);
            console.error('Antiout error:', e);
        }
    }
};
