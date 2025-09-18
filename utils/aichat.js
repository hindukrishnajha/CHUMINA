const Groq = require('groq-sdk');
const fs = require('fs').promises; // For file handling

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY
});

console.log('Groq API Key:', process.env.GROQ_API_KEY ? 'Set' : 'Not set');
console.log('Groq AI initialized successfully');

// File to store dynamically generated roasts
const ROAST_STORAGE_FILE = 'dynamic_roasts.json';

// Toggle states for chat and roast modes
let isChatEnabled = true; // Default: Chat mode on
let isRoastEnabled = true; // Default: Roast mode on

// Roast prompt with strict rules, new twists, pure Hindi, and single roast
const ROAST_PROMPT = `
You are a desi Hindi roast bot. Generate exactly ONE FRESH, FUNNY, and HARSHLY EMBARRASSING roast (ghanghor beizzati) based on general desi vibe, not tied to any specific message. Create UNIQUE short roast every time, using only SUDDH HINDI, desi slang, and edgy vibes. Max 300 tokens, 1-3 lines only, keep it short and complete.

Rules (STRICTLY FOLLOW):
- Only roast USER and GIRLFRIEND. NO family (ma, baap, behan, bhai, etc.), wife, friends, or relatives. Avoid any mention of them.
- USER words: chutia, gandu, lodu, jokar, murakh, namard, gandwa, namoona, hijda, chapri, nibba.
- GIRLFRIEND words: randi, callgirl, veshya, dhandhewaali, nibbi, chinaal, kinnri, sexy maal.
- Add naughty twists: teri girlfriend ke boobs, teri girlfriend ki gaand, teri girlfriend ki chut, teri girlfriend ki bra, teri girlfriend ki panty, teri girlfriend ki kaali hai, teri girlfriend ki gulabi hai, teri girlfriend to sexy maal hai. New twists: teri girlfriend ki gulabi chut ki kasam aaj ka din bhot mast hai, teri girlfriend ki kaali na hoti to abhi uski mar leta, teri girlfriend k jism ki khushbu sungkar maza a gya, teri girlfriend ki gaand nahi gubbara hai, teri girlfriend ki chut pe kabja kar luga.
- Add savage lines for USER: teri gaand pe powder lga k maaruga, teri gaand pe kiss kar luga, teri gaand ko kaali se gulabi bna duga, teri gaand ki drar naap luga, teri gaand ki gahrai m kho gaya, teri gaand ki gahrai kya hai.
- Mix variety: pop culture (Bollywood, TikTok), desi scenes (tapri, bazaar), naughty scenarios. Use these automatically in roasts.
- Avoid repetition from previous roasts. Make it random, short line, even if it takes time to generate.
- Output ONLY the roast text, no headings like "Roast 1:", no multiple roasts.
`;

// Load or initialize dynamic roasts
async function loadDynamicRoasts() {
  try {
    const data = await fs.readFile(ROAST_STORAGE_FILE, 'utf8');
    return JSON.parse(data) || [];
  } catch (err) {
    return [];
  }
}

// Save dynamic roasts
async function saveDynamicRoasts(roasts) {
  await fs.writeFile(ROAST_STORAGE_FILE, JSON.stringify(roasts, null, 2), 'utf8');
}

// Enhanced Family word filter
function filterFamilyWords(roast) {
  const familyWords = ['ma', 'baap', 'behan', 'bhai', 'bhabhi', 'dada', 'dadi', 'chacha', 'chachi', 'tau', 'tai', 'cousin', 'family', 'dost', 'friend', 'wife', 'beti', 'beta', 'papa', 'mummy', 'relative', 'sister', 'brother', 'mother', 'father'];
  let filteredRoast = roast;
  familyWords.forEach(word => {
    const regex = new RegExp(`\\b${word}\\b`, 'gi');
    filteredRoast = filteredRoast.replace(regex, '');
  });
  return filteredRoast.trim();
}

// Handle commands (#chat on/off, #roast on/off)
function handleCommand(message) {
  const lowerMessage = message.toLowerCase().trim();
  if (lowerMessage === '#chat on') {
    isChatEnabled = true;
    return 'Chat mode ON kiya, bhai! Ab masti shuru! 😎';
  } else if (lowerMessage === '#chat off') {
    isChatEnabled = false;
    return 'Chat mode OFF kiya, ab chup reh! 😜';
  } else if (lowerMessage === '#roast on') {
    isRoastEnabled = true;
    return 'Roast mode ON kiya, ab teri beizzati pakki! 🔥';
  } else if (lowerMessage === '#roast off') {
    isRoastEnabled = false;
    return 'Roast mode OFF kiya, bhai thodi si izzat bachi! 😅';
  }
  return null; // No command matched
}

async function getAIResponse(message, isRoast = false) {
  console.log('AI request - Message:', message, 'isRoast:', isRoast);

  // Check for commands first
  const commandResponse = handleCommand(message);
  if (commandResponse) {
    console.log('Command response:', commandResponse);
    return commandResponse;
  }

  // Check if chat or roast mode is enabled
  if (!isChatEnabled && !isRoast) {
    return 'Bhai, chat aur roast dono OFF hain! #chat on ya #roast on kar pehle! 😜';
  }
  if (isRoast && !isRoastEnabled) {
    return 'Roast mode OFF hai, bhai! #roast on kar pehle! 🔥';
  }
  if (!isRoast && !isChatEnabled) {
    return 'Chat mode OFF hai, bhai! #chat on kar pehle! 😎';
  }

  try {
    const dynamicRoasts = await loadDynamicRoasts();
    const truncatedMessage = message.length > 100 ? message.substring(0, 100) + '...' : message;
    let prompt = isRoast 
      ? ROAST_PROMPT + (dynamicRoasts.length > 0 ? `\nAvoid these previous roasts: ${JSON.stringify(dynamicRoasts.slice(-5))}` : '') // Avoid last 5 roasts
      : `Reply in SUDDH HINDI, desi style, short, witty: ${truncatedMessage || 'अरे भाई, मस्ती करो! 😎'}`;

    const chatCompletion = await groq.chat.completions.create({
      messages: [{ role: 'system', content: isRoast ? 'Roast bot, exactly one unique short roast, no family (ma, baap, etc.), pure Hindi only.' : 'Friendly AI, SUDDH HINDI, witty replies.' },
                 { role: 'user', content: prompt }],
      model: 'llama-3.1-8b-instant',
      temperature: isRoast ? 1.2 : 0.7,
      max_tokens: 300,
      top_p: isRoast ? 0.95 : 1.0
    });

    let response = chatCompletion.choices[0]?.message?.content?.trim();
    if (isRoast) {
      response = filterFamilyWords(response);
      // Check for family words more strictly
      const hasFamily = /ma|baap|behan|bhai|bhabhi|dada|dadi|chacha|chachi|tau|tai|cousin|family|dost|friend|wife|beti|beta|papa|mummy|relative|sister|brother|mother|father/i.test(response);
      if (hasFamily || !response || response.split('\n').length > 3) {
        console.warn('Family, invalid, or multi-line roast detected, regenerating');
        return await getAIResponse(message, true); // Retry
      }
      // Check for uniqueness
      if (dynamicRoasts.some(roast => roast.toLowerCase().includes(response.toLowerCase()))) {
        console.log('Duplicate roast detected, regenerating');
        return await getAIResponse(message, true);
      }
      // Add new roast to storage
      dynamicRoasts.push(response);
      await saveDynamicRoasts(dynamicRoasts.slice(-100)); // Keep last 100 roasts
      console.log('New roast added, total:', dynamicRoasts.length);
    }
    console.log('AI response:', response);
    return response || (isRoast ? 'तेरी गर्लफ्रेंड की गुलाबी चूत की कसम, तू चूतिया है! 😜' : 'गड़बड़ हो गई, फिर ट्राई कर! 😜');
  } catch (err) {
    console.error('Groq API error:', err.message);
    return isRoast ? 'तेरी गर्लफ्रेंड की गांड नहीं गुब्बारा है, लोडू! 😂' : '⚠️ कुछ गड़बड़ है, रुक कर ट्राई कर! 😅';
  }
}

module.exports = { getAIResponse, handleCommand };
