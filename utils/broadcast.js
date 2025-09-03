module.exports = {
    broadcast: (message) => {
        const wss = global.wss; // Assuming wss is attached globally
        if (wss && wss.clients) {
            wss.clients.forEach(client => {
                if (client.readyState === require('ws').OPEN) {
                    client.send(JSON.stringify(message));
                }
            });
        }
    }
};
