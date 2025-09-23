const Groq = require("groq-sdk");

const groq = new Groq({
    apiKey: process.env.GROQ_API_KEY
});

async function generateRoast(targetMessage, targetName) {
    try {
        const prompt = `
        User ke message ka pura roast karo. 30-40 words tak. Complete roast ho.

        STRICT RULES:
        1. FAMILY & RELATIVES COMPLETELY BANNED
        2. "AUKAT" WORD BILKUL BANNED
        3. Allowed words: gandu, chutia, kinnar, lund, chut, gaand, lavde, chutiye
        4. Sirf USER ko directly roast karo
        5. User ke message ka directly related jawab do
        6. Hindi mixed with English

        User: "${targetMessage}"

        Tera complete roast:`;

        const completion = await groq.chat.completions.create({
            messages: [
                {
                    role: "system",
                    content: "Tu ek professional roaster hai. Family aur relatives ki gaaliyan banned hain. 'AUKAT' word bilkul banned hai."
                },
                { role: "user", content: prompt }
            ],
            model: "llama-3.1-8b-instant", // ✅ updated supported model
            temperature: 0.9,
            max_tokens: 100,
        });

        let roastResponse = completion.choices[0]?.message?.content || "Aaj dimaag kaam nahi kar raha!";

        // 🚫 banned words filter
        const bannedWords = [
            'maa', 'behen', 'baap', 'bhai', 'dadi', 'nani', 'chacha',
            'mausi', 'bua', 'chachi', 'patni', 'biwi', 'mummy', 'papa',
            'aunty', 'uncle', 'aukat'
        ];
        bannedWords.forEach(word => {
            const regex = new RegExp(word, 'gi');
            roastResponse = roastResponse.replace(regex, '');
        });

        return roastResponse;
    } catch (error) {
        console.error("Roast generation error:", error);
        return "Server slow hai, baad me try kar!";
    }
}

module.exports = {
    name: 'roast',
    aliases: ['roast'],
    description: 'Toggle auto-roast mode (general or targeted)',
    async execute(api, threadID, args, event, botState, isMaster) {
        const isAdmin =
            (Array.isArray(botState.adminList) && botState.adminList.includes(event.senderID)) ||
            isMaster;

        if (!isAdmin) {
            return api.sendMessage('🚫 Yeh command sirf admins/master ke liye hai!', threadID);
        }

        const command = args[0]?.toLowerCase();
        const mentionedIDs = Object.keys(event.mentions || {});

        if (command === 'on') {
            if (mentionedIDs.length > 0 && mentionedIDs.length <= 4) {
                if (!botState.roastTargets) botState.roastTargets = {};
                if (!botState.roastTargets[threadID]) botState.roastTargets[threadID] = {};
                mentionedIDs.forEach(id => (botState.roastTargets[threadID][id] = true));
                api.sendMessage(`✅ Targeted roast ON for selected users!`, threadID);
            } else {
                if (!botState.roastEnabled) botState.roastEnabled = {};
                botState.roastEnabled[threadID] = true;
                api.sendMessage('🔥 Auto-roast ON for all users!', threadID);
            }
        } else if (command === 'off') {
            if (!botState.roastEnabled) botState.roastEnabled = {};
            botState.roastEnabled[threadID] = false;
            if (botState.roastTargets && botState.roastTargets[threadID]) {
                delete botState.roastTargets[threadID];
            }
            api.sendMessage('✅ Auto-roast OFF!', threadID);
        } else if (command === 'manual') {
            let targetMessage = event.messageReply?.body || args.slice(1).join(" ");
            let targetName = "User";
            api.sendTypingIndicator(threadID);
            const roastResponse = await generateRoast(targetMessage, targetName);
            api.sendMessage(`${targetName}, ${roastResponse}`, threadID);
        } else {
            api.sendMessage('❌ Use: #roast on / off / manual', threadID);
        }
    }
};
