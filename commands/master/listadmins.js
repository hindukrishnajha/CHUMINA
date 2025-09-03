// commands/master/listadmins.js
module.exports.listadmins = (api, event, botState) => {
    api.sendMessage(`Admin list: ${botState.adminList.length ? botState.adminList.join(', ') : 'None'}`, event.threadID);
};
