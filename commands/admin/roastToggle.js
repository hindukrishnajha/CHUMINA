const Groq = require("groq-sdk");

const groq = new Groq({
    apiKey: process.env.GROQ_API_KEY
});

async function generateRoast(targetMessage, targetName) {
    try {
        const prompt = `
        User ke message ka pura roast karo. 30-40 words tak. Complete roast ho.
        
        STRICT RULES:
        1. FAMILY & RELATIVES COMPLETELY BANNED: maa, behen, baap, bhai, dadi, nani, chacha, mausi, bua, chachi, patni, biwi, mummy, papa, aunty, uncle - YE SAB WORDS BILKUL BANNED HAI
        2. "AUKAT" WORD BILKUL BANNED HAI
        3. Sirf ye words use kar sakta hai: gandu, chutia, kinnar, lund, chut, gaand, lavde, chutiye
        4. Sirf USER ko directly roast karo - kisi aur ko involve mat karo
        5. User ke message ka directly related jawab do
        6. Hindi mixed with English
        
        User: "${targetMessage}"
        
        Tera complete roast:`;

        const completion = await groq.chat.completions.create({
            messages: [
                {
                    role: "system", 
                    content: "Tu ek professional roaster hai. Family aur relatives ki gaaliyan completely banned hain. Sirf user ko directly roast karta hai. 'AUKAT' word bilkul banned hai."
                },
                {
                    role: "user",
                    content: prompt
                }
            ],
            model: "llama-3.3-70b-versatile", // ✅ FIXED
            temperature: 0.9,
            max_tokens: 100,
            top_p: 1,
            stream: false,
        });

        let roastResponse = completion.choices[0]?.message?.content || "Aaj dimaag kaam nahi kar raha, kal try kar gandu!";
        
        // Banned words filter
        const bannedWords = ['maa', 'behen', 'baap', 'bhai', 'dadi', 'nani', 'chacha', 'mausi', 'bua', 'chachi', 'patni', 'biwi', 'mummy', 'papa', 'aunty', 'uncle', 'aukat'];
        bannedWords.forEach(word => {
            const regex = new RegExp(word, 'gi');
            roastResponse = roastResponse.replace(regex, '');
        });
        
        return roastResponse;
    } catch (error) {
        console.error("Roast generation error:", error);
        return "Server slow hai, thodi der baad try kar chutia!";
    }
}

module.exports = {
  name: 'roast',
  aliases: ['roast'],
  description: 'Toggle auto-roast mode (general or targeted)',
  async execute(api, threadID, args, event, botState, isMaster, botID, stopBot) {
    const isAdmin = Array.isArray(botState.adminList) && botState.adminList.includes(event.senderID) || isMaster;
    if (!isAdmin) {
      return api.sendMessage('🚫 Yeh command sirf admins ya master ke liye hai! 🕉️', threadID);
    }

    const command = args[0]?.toLowerCase();
    const mentionedIDs = Object.keys(event.mentions || {});

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
          api.sendMessage(`✅ Targeted roast on for ${names}! Ab sirf yeh users roast honge jab message karenge. 🕉️`, threadID);
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
      // Manual roast command
      let targetMessage = "";
      let targetName = "Unknown";

      if (event.messageReply) {
        targetMessage = event.messageReply.body || "";
        try {
          const userInfo = await api.getUserInfo(event.messageReply.senderID);
          targetName = userInfo[event.messageReply.senderID]?.name || "Unknown";
        } catch (e) {
          targetName = "Unknown";
        }
      } else if (Object.keys(event.mentions).length > 0) {
        const targetID = Object.keys(event.mentions)[0];
        targetName = event.mentions[targetID];
        targetMessage = event.body.replace(/@.*?/g, '').replace(/^#roast\s+manual\s*/i, '').trim();
      } else {
        targetMessage = event.body.replace(/^#roast\s+manual\s*/i, '').trim();
      }

      if (!targetMessage && !event.messageReply) {
        return api.sendMessage("❌ Kisi message ko reply karo ya kuch text do roast karne ke liye!", threadID);
      }

      api.sendTypingIndicator(threadID);
      const roastResponse = await generateRoast(targetMessage, targetName);
      
      if (targetName !== "Unknown") {
        api.sendMessage(`${targetName}, ${roastResponse}`, threadID);
      } else {
        api.sendMessage(roastResponse, threadID);
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
