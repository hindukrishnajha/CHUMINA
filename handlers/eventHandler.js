const messageHandler = require('./messageHandler');
const deleteHandler = require('../events/deleteHandler');
const welcomeHandler = require('../events/welcomeHandler');
const commandHandler = require('./commandHandler');
const Groq = require("groq-sdk");

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

const bannedWords = [
    'maa', 'behen', 'baap', 'bhai', 'dadi', 'nani', 'chacha',
    'mausi', 'bua', 'chachi', 'patni', 'biwi', 'mummy', 'papa',
    'aunty', 'uncle', 'aukat'
];

async function generateRoastCore(api, event, message, wordLimit = 30) {
    try {
        const prompt = `
        Short roast (${wordLimit - 10}-${wordLimit} words).
        Rules:
        - Family banned
        - 'Aukat' banned
        - Allowed words: gandu, chutia, kinnar, lund, chut, gaand, lavde, chutiye
        User: "${message}"`;

        const completion = await groq.chat.completions.create({
            messages: [
                { role: "system", content: "Tu ek roaster hai. Family words aur 'aukat' banned hai." },
                { role: "user", content: prompt }
            ],
            model: "llama-3.1-8b-instant",
            temperature: 0.9,
            max_tokens: wordLimit * 2,
        });

        let roast = completion.choices[0]?.message?.content || "Chup kar gandu!";
        bannedWords.forEach(word => {
            const regex = new RegExp(word, 'gi');
            roast = roast.replace(regex, '');
        });
        return roast;
    } catch (error) {
        console.error("Roast generation error:", error);
        return "Server slow hai, baad me try kar!";
    }
}

async function handleAutoRoast(api, event, botState, botId) {
    try {
        botState.roastEnabled = botState.roastEnabled || {};
        botState.roastTargets = botState.roastTargets || {};
        botState.lastRoastTime = botState.lastRoastTime || {};

        if (!botState.roastEnabled[event.threadID]) return false;
        if (event.senderID === botId) return false; // Ignore bot's own messages
        if (botState.roastTargets[event.threadID] && !botState.roastTargets[event.threadID][event.senderID]) return false;
        if (!event.body || event.body.startsWith('#')) return false;

        // Cooldown check: 10 seconds per thread
        const now = Date.now();
        if (botState.lastRoastTime[event.threadID] && now - botState.lastRoastTime[event.threadID] < 10000) return false;
        botState.lastRoastTime[event.threadID] = now;

        const userInfo = await api.getUserInfo([event.senderID]);
        const targetName = userInfo[event.senderID]?.name || "User";

        const roastResponse = await generateRoastCore(api, event, event.body, 20);
        api.sendMessage(`${targetName}, ${roastResponse}`, event.threadID);
        return true;
    } catch (error) {
        console.error("Auto-roast error:", error);
        api.sendMessage("❌ Auto-roast mein error aa gaya!", event.threadID);
        return false;
    }
}

function handleEvent(api, event, botState, botId) {
    try {
        if (event.type === 'message' && !event.body.startsWith('#')) {
            handleAutoRoast(api, event, botState, botId).catch(console.error);
            return messageHandler.handleMessage(api, event, botState, botId);
        }
        if (event.type === 'message_unsend') return deleteHandler.handleUnsend(api, event, botState, botId);
        if (event.logMessageType === 'log:subscribe') return welcomeHandler.handleWelcome(api, event, botState, botId);
        if (event.logMessageType === 'log:unsubscribe') return welcomeHandler.handleGoodbye(api, event, botState, botId);
    } catch (error) {
        console.error('[EVENT-ERROR] Event handling failed:', error.message);
        api.sendMessage("❌ Bot mein error aa gaya, try again!", event.threadID);
    }
}

module.exports = handleEvent;
