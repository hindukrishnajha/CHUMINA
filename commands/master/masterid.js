module.exports = {
    handleMasterId: (api, threadID) => {
        try {
            const masterLink = 'https://www.facebook.com/SHALENDER.HINDU.BAAP.JI.HERE.1';
            api.sendMessage(`👑 मास्टर प्रोफाइल: ${masterLink}`, threadID);
            console.log(`[SUCCESS] Responded to #masterid for thread ${threadID} with link ${masterLink}`);
            broadcast({ type: 'log', message: `[7:30 AM IST] [User 100023807453349] Responded to #masterid`, userId: '100023807453349', color: '#00ff00' });
        } catch (err) {
            console.error('[ERROR] masterid कमांड में गलती:', err.message, err.stack);
            api.sendMessage('⚠️ masterid कमांड चलाने में गलती।', threadID);
            broadcast({ type: 'error', message: `[7:30 AM IST] [User 100023807453349] masterid कमांड में गलती: ${err.message}`, userId: '100023807453349', color: '#ff4444' });
        }
    }
};
