const Groq = require("groq-sdk");

const groq = new Groq({
    apiKey: process.env.GROQ_API_KEY
});

async function generateResponse(isTargetAdmin, targetMessage, targetName) {
    try {
        let prompt;
        if (isTargetAdmin) {
            // Support mode for admin/master
            prompt = `
            Respond to the user's message with these rules:
            1. Full support karo user ke message ka. 30-40 words.
            2. User ko raja jaisa treat karo, khud ko gulam ya dost bano. 
            3. Koi gaali nahi. FAMILY aur relatives (maa, behen, baap, bhai, dadi, nani, chacha, bua, etc.) bilkul banned hain.
            4. Supportive + loyal tone, user ke message ke context se directly related ho.
            5. Example:
               - User: "ye idea sahi h?" → "Bilkul sahi hai, main toh pehle se keh raha tha ki ye idea best hai, main hamesha aapke saath hoon."
               - User: "ye pankaj faltu hai" → "Haan, bilkul theek bola, main bhi maanta hoon ki pankaj bilkul faltu hai, aap hamesha sahi pakadte ho."
            User: "${targetMessage}"
            Target Name: "${targetName}"
            Complete supportive response:`;
        } else {
            // Roast mode for non-admin
            prompt = `
            Respond to the user's message with these rules:
            1. 30-40 words ka full adult roast.
            2. Abuse/gaali (madarchod, behenchod, etc.) aur FAMILY references bilkul banned.
            3. Allowed words: chut, lund, chutad, lavdi, lulli, girlfriend ki bra, girlfriend ki chut, girlfriend ki gaand, girlfriend ke boobs, girlfriend ki sexy kamar, girlfriend ko pregnant kar dunga.
            4. Roast sirf user ko, kisi aur ko involve mat karo.
            5. Roast hamesha user ke message ke words ya theme pe based ho.
            6. Example:
               - User: "ye kya hai be" → "Ye? Tera chut jaisa dimag jo sirf girlfriend ki gaand ke bare me sochta hai!"
               - User: "bhai yaha kya chal rha" → "Yaha wahi chal raha hai jo teri lulli ki speed hai, zero!"
            User: "${targetMessage}"
            Target Name: "${targetName}"
            Complete roast:`;
        }

        const completion = await groq.chat.completions.create({
            messages: [
                {
                    role: "system", 
                    content: isTargetAdmin 
                        ? "Tu ek supportive dost/gulam hai jo admin/master ke har message ko support karta hai. Family aur gaali banned hain. Sirf supportive loyal tone."
                        : "Tu ek professional roaster hai jo full adult roast karta hai. Family aur gaali banned hain. Allowed words: chut, lund, lavdi, lulli, girlfriend-based insults."
                },
                { role: "user", content: prompt }
            ],
            model: "llama-3.3-70b-versatile",
            temperature: 0.9,
            max_tokens: 120,
            top_p: 1,
            stream: false,
        });

        let response =
            completion.choices[0]?.message?.content ||
            (isTargetAdmin
                ? "Bilkul sahi keh rahe ho, main hamesha aapke saath hoon!"
                : "Abe chut, dimaag ka lulli hai tu!");

        // Banned words filter
        const bannedWords = [
            'maa','behen','baap','bhai','dadi','nani','chacha','mausi','bua','chachi',
            'patni','biwi','mummy','papa','aunty','uncle','bhabhi','aukat',
            'madarchod','behenchod','mc','bc','gandu','chod','sorry',
            'decode','cannot','unable','unfortunately'
        ];
        bannedWords.forEach(word => {
            const regex = new RegExp(`\\b${word}\\b`, 'gi');
            response = response.replace(regex, '');
        });

        return response.trim();
    } catch (error) {
        console.error("Response generation error:", error);
        return isTargetAdmin 
            ? "Server slow hai, thodi der baad try karo, main aapke saath hoon!" 
            : "Abe lavdi, server slow hai!";
    }
}

module.exports = {
    name: 'roast',
    aliases: ['roast'],
    description: 'Toggle auto-roast mode (general or targeted) or manual roast',
    async execute(api, threadID, args, event, botState, isMaster, botID, stopBot) {
        const isAdmin = (Array.isArray(botState.adminList) && botState.adminList.includes(event.senderID)) || isMaster;
        if (!isAdmin) {
            return api.sendMessage('🚫 Yeh command sirf admins ya master ke liye hai! 🕉️', threadID);
        }

        const command = args[0]?.toLowerCase();
        const mentionedIDs = Object.keys(event.mentions || {});

        if (!event.isGroup) {
            return api.sendMessage("❌ Roast command only works in groups!", threadID);
        }

        if (command === 'on') {
            if (mentionedIDs.length > 0 && mentionedIDs.length <= 4) {
                // Targeted roast
                if (!botState.roastTargets) botState.roastTargets = {};
                if (!botState.roastTargets[threadID]) botState.roastTargets[threadID] = {};
                mentionedIDs.forEach(id => {
                    botState.roastTargets[threadID][id] = true;
                });
                api.getUserInfo(mentionedIDs, (err, userInfo) => {
                    let names = mentionedIDs.map(id => userInfo[id]?.name || 'User').join(', ');
                    api.sendMessage(`✅ Targeted roast ON for ${names}! Ab sirf yeh users roast honge jab message karenge. 🕉️`, threadID);
                });
            } else {
                // General roast
                if (!botState.roastEnabled) botState.roastEnabled = {};
                botState.roastEnabled[threadID] = true;
                api.sendMessage('🔥 Auto-roast ON for all users! Har message pe beizzati, 30 sec gap ke saath. 🕉️', threadID);
            }
        } else if (command === 'off') {
            if (!botState.roastEnabled) botState.roastEnabled = {};
            botState.roastEnabled[threadID] = false;
            if (botState.roastTargets && botState.roastTargets[threadID]) {
                delete botState.roastTargets[threadID];
            }
            api.sendMessage('✅ Auto-roast OFF! Ab koi beizzati nahi. 🕉️', threadID);
        } else if (command === 'manual') {
            // Manual roast
            let targetMessage = "";
            let targetName = "Unknown";
            let targetID = null;
            let isTargetAdmin = false;

            if (event.messageReply) {
                targetMessage = event.messageReply.body || "";
                targetID = event.messageReply.senderID;
                try {
                    const userInfo = await api.getUserInfo(targetID);
                    targetName = userInfo[targetID]?.name || "Unknown";
                } catch (e) {
                    targetName = "Unknown";
                }
            } else if (Object.keys(event.mentions).length > 0) {
                targetID = Object.keys(event.mentions)[0];
                targetName = event.mentions[targetID];
                targetMessage = event.body.replace(/@\[.*?\]/g, '').replace(/^#roast\s+manual\s*/i, '').trim();
            } else {
                targetMessage = event.body.replace(/^#roast\s+manual\s*/i, '').trim();
            }

            if (!targetMessage && !event.messageReply) {
                return api.sendMessage("❌ Kisi message ko reply karo ya kuch text do roast karne ke liye!", threadID);
            }

            // Check if target is admin/master
            if (targetID) {
                isTargetAdmin =
                    (Array.isArray(botState.adminList) && botState.adminList.includes(targetID)) ||
                    targetID === require('../config/constants').MASTER_ID;
            }

            api.sendTypingIndicator(threadID);
            const response = await generateResponse(isTargetAdmin, targetMessage, targetName);
            
            if (targetName !== "Unknown") {
                api.sendMessage(`${targetName}, ${response}`, threadID);
            } else {
                api.sendMessage(response, threadID);
            }
            return;
        } else {
            api.sendMessage('❌ Use: #roast on (all users) | #roast on @user1 @user2 (max 4) | #roast off | #roast manual 🕉️', threadID);
        }

        // Save to learned_responses
        if (botState.learnedResponses && botState.learnedResponses[threadID]) {
            botState.learnedResponses[threadID].roastEnabled = botState.roastEnabled ? botState.roastEnabled[threadID] : false;
            botState.learnedResponses[threadID].roastTargets = botState.roastTargets ? botState.roastTargets[threadID] : {};
            const fs = require('fs');
            const path = require('path');
            const LEARNED_RESPONSES_PATH = path.join(__dirname, '../../config/learned_responses.json');
            fs.writeFileSync(LEARNED_RESPONSES_PATH, JSON.stringify(botState.learnedResponses, null, 2), 'utf8');
        }
    }
};
