const Groq = require("groq-sdk");

const groq = new Groq({
    apiKey: process.env.GROQ_API_KEY
});

async function generateResponse(isTargetAdmin, targetMessage, targetName) {
    try {
        console.log(`generateResponse: isTargetAdmin=${isTargetAdmin}, targetMessage="${targetMessage}", targetName="${targetName}"`);
        let prompt;
        if (isTargetAdmin) {
            prompt = `
            SUPPORT MODE ONLY: Respond to user's message with these rules:
            1. Treat user as king/malik/raja, act as friend, only positive support, NO ROAST, NO ABUSE.
            2. Hindi-English mix, 30-40 words.
            3. BANNED: family words (maa, behen, baap, bhai, dadi, nani, chacha, mausi, bua, chachi, patni, biwi, mummy, papa, aunty, uncle, bhabhi), apologies, refusals, sorry, cannot, unable, instead, as, however, it, unfortunately, important, decode.
            4. Directly relate to: "${targetMessage}"
            5. Address as bhai/malik/raja.
            Example:
                - User: "Kya pankaj gandu hai yaar" → "Haan raja, Pankaj gandu hai, aapne toh ekdum sahi pakda, king ho aap!"
                - User: "Chutia, yaha bakwas teri dig mein chal rahi hai" → "Malik, aapne bilkul sahi bola, yeh bakwas toh aapke samne fail hai!"
            User: "${targetMessage}"
            Target Name: "${targetName}"
            Tera supportive response:`;
            console.log("Support mode selected for admin/master");
        } else {
            prompt = `
            ROAST MODE: Respond to user's message with these rules:
            1. Full adult insulting roast, mild slang only (chut, lund, chutad, lavdi, lulli, girlfriend-related).
            2. Hindi-English mix, 30-40 words.
            3. BANNED: family words (maa, behen, baap, bhai, dadi, nani, chacha, mausi, bua, chachi, patni, biwi, mummy, papa, aunty, uncle, bhabhi), aukat, heavy abuse (madarchod, behenchod, etc.), apologies, sorry, cannot, unable, instead, as, however, it, unfortunately, important, decode.
            4. Directly roast user based on: "${targetMessage}"
            5. Stick to message context, no inventions.
            Example:
                - User: "Kya pankaj gandu hai yaar" → "Gandu? Tera dimaag toh girlfriend ke chutad jaisa, bilkul bekar, lavdi!"
                - User: "Chutia, yaha bakwas teri dig mein chal rahi hai" → "Bakwas? Teri girlfriend ka bhosda jaisa logic, chutiye, band kar yeh natak!"
            User: "${targetMessage}"
            Target Name: "${targetName}"
            Tera roast:`;
            console.log("Roast mode selected for non-admin");
        }

        const completion = await groq.chat.completions.create({
            messages: [
                {
                    role: "system",
                    content: isTargetAdmin
                        ? "Tu ek supportive dost hai jo admin/master ko raja/malik treat karta hai. NO ROAST, NO ABUSE, only positive support. Family words, heavy gaali banned. Hindi-English mix."
                        : "Tu ek funny roaster hai. Family words, aukat, heavy gaali banned. Mild slang (chut, lund, lavdi) allowed. Sirf user ko roast kar, message context se. Hindi-English mix."
                },
                { role: "user", content: prompt }
            ],
            model: "llama-3.3-70b-versatile",
            temperature: 0.7, // Reduced temperature for more consistent responses
            max_tokens: 150,
            top_p: 1,
            stream: false,
        });

        let response = completion.choices[0]?.message?.content || (isTargetAdmin ? "Haan bhai, aap bilkul sahi keh rahe ho, king ho aap!" : "Tera dimaag toh lavdi jaisa, bilkul khali hai!");
        console.log(`API Response: ${response}`);

        // Banned words filter
        const bannedWords = ['maa', 'behen', 'baap', 'bhai', 'dadi', 'nani', 'chacha', 'mausi', 'bua', 'chachi', 'patni', 'biwi', 'mummy', 'papa', 'aunty', 'uncle', 'aukat', 'bhabhi', 'sorry', 'cannot', 'refuse', 'policy', 'unable', 'unfortunately'];
        bannedWords.forEach(word => {
            const regex = new RegExp(word, 'gi');
            response = response.replace(regex, '');
        });

        // Force support for master/admin
        if (isTargetAdmin && response.includes('chut') || response.includes('lund') || response.includes('lavdi')) {
            console.log("WARNING: Roast detected in admin response, forcing support response");
            response = `Haan malik, aapne "${targetMessage}" mein ekdum sahi bola, king ho aap!`;
        }

        return response;
    } catch (error) {
        console.error("Response generation error:", error);
        return isTargetAdmin ? "Server slow hai, thodi der baad try kar malik!" : "Server slow hai, thodi der baad try kar lavdi!";
    }
}

module.exports = {
    name: 'roast',
    aliases: ['roast'],
    description: 'Toggle auto-roast mode (general or targeted) or manual roast',
    async execute(api, threadID, args, event, botState, isMaster, botID, stopBot) {
        const isAdmin = Array.isArray(botState.adminList) && botState.adminList.includes(String(event.senderID)) || isMaster;
        console.log(`isAdmin Check: SenderID=${event.senderID}, isMaster=${isMaster}, AdminList=${JSON.stringify(botState.adminList)}`);

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
                if (!botState.roastTargets) botState.roastTargets = {};
                if (!botState.roastTargets[threadID]) botState.roastTargets[threadID] = {};
                mentionedIDs.forEach(id => {
                    botState.roastTargets[threadID][id] = true;
                });
                api.getUserInfo(mentionedIDs, (err, userInfo) => {
                    let names = mentionedIDs.map(id => userInfo[id]?.name || 'User').join(', ');
                    api.sendMessage(`✅ Targeted roast on for ${names}! Ab sirf yeh users roast honge jab message karenge. 🕉️`, threadID);
                });
            } else {
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
            let targetMessage = "";
            let targetName = "Unknown";
            let targetID = null;
            let isTargetAdmin = false;

            if (event.messageReply) {
                targetMessage = event.messageReply.body || "";
                targetID = event.messageReply.senderID;
                console.log(`Reply TargetID: ${targetID}, Type: ${typeof targetID}`);
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

            // Hard-coded master ID check
            if (targetID && String(targetID) === '100023807453349') {
                console.log("Master ID detected, forcing support response");
                return api.sendMessage(`${targetName}, Haan malik, aapne "${targetMessage}" mein ekdum sahi bola, king ho aap!`, threadID);
            }

            // Check if target is admin or master
            if (targetID) {
                const masterID = '100023807453349';
                isTargetAdmin = String(targetID) === masterID || (Array.isArray(botState.adminList) && botState.adminList.includes(String(targetID)));
                console.log(`isTargetAdmin Check: TargetID=${targetID}, MasterID=${masterID}, AdminList=${JSON.stringify(botState.adminList)}, isTargetAdmin=${isTargetAdmin}`);
            }

            api.sendTypingIndicator(threadID);
            const response = await generateResponse(isTargetAdmin, targetMessage, targetName);
            console.log(`Final Response for ${targetName}: ${response}`);

            if (targetName !== "Unknown") {
                api.sendMessage(`${targetName}, ${response}`, threadID);
            } else {
                api.sendMessage(response, threadID);
            }
            return;
        } else {
            api.sendMessage('❌ Use: #roast on (all users) or #roast on @user1 @user2 (targeted, max 4) or #roast off or #roast manual 🕉️', threadID);
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
