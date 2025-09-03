module.exports = {
    handleMasterid: (api, threadID, MASTER_FB_LINK) => {
        api.sendMessage(`🌐 Master Profile: ${MASTER_FB_LINK}`, threadID);
    }
};
