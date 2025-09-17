const Groq = require('groq-sdk');
const fs = require('fs').promises; // For file handling

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY
});

console.log('Groq API Key:', process.env.GROQ_API_KEY ? 'Set' : 'Not set');
console.log('Groq AI initialized successfully');

// File to store dynamically generated roasts
const ROAST_STORAGE_FILE = 'dynamic_roasts.json';

// Roast prompt with strict rules
const ROAST_PROMPT = `
You are a desi Hindi roast bot. Generate a FRESH, FUNNY, and HARSHLY EMBARRASSING roast (ghanghor beizzati) based on general desi vibe, not tied to any specific message. Create UNIQUE roasts every time, using Hindi, desi slang, and edgy vibes. Max 300 tokens, 1-3 lines.

Rules (STRICTLY FOLLOW):
- Only roast USER and GIRLFRIEND. NO family (ma, baap, behan, bhai, etc.), wife, friends, or relatives.
- USER words: chutia, gandu, lodu, jokar, murakh, namard, gandwa, namoona, hijda, chapri, nibba.
- GIRLFRIEND words: randi, callgirl, veshya, dhandhewaali, nibbi, chinaal, kinnri, sexy maal.
- Add naughty twists: teri girlfriend ke boobs, teri girlfriend ki gaand, teri girlfriend ki chut, teri girlfriend ki bra, teri girlfriend ki panty, teri girlfriend ki kaali hai, teri girlfriend ki gulabi hai, teri girlfriend to sexy maal hai.
- Add savage lines for USER: teri gaand pe powder lga k maaruga, teri gaand pe kiss kar luga, teri gaand ko kaali se gulabi bna duga, teri gaand ki drar naap luga, teri gaand ki gahrai m kho gaya, teri gaand ki gahrai kya hai.
- Mix variety: pop culture (Bollywood, TikTok), desi scenes (tapri, bazaar), naughty scenarios.
- Avoid repetition from previous roasts.
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

// Family word filter
function filterFamilyWords(roast) {
  const familyWords = ['ma', 'baap', 'behan', 'bhai', 'bhabhi', 'dada', 'dadi', 'chacha', 'chachi', 'tau', 'tai', 'cousin', 'family', 'dost', 'friend', 'wife'];
  let filteredRoast = roast;
  familyWords.forEach(word => {
    const regex = new RegExp(`\\b${word}\\b`, 'gi');
    filteredRoast = filteredRoast.replace(regex, '');
  });
  return filteredRoast.trim();
}

async function getAIResponse(message, isRoast = false) {
  console.log('AI request - Message:', message, 'isRoast:', isRoast);
  try {
    const dynamicRoasts = await loadDynamicRoasts();
    const truncatedMessage = message.length > 100 ? message.substring(0, 100) + '...' : message;
    let prompt = isRoast 
      ? ROAST_PROMPT + (dynamicRoasts.length > 0 ? `\nAvoid these previous roasts: ${JSON.stringify(dynamicRoasts.slice(-5))}` : '') // Avoid last 5 roasts
      : `Reply in Hindi, desi style, short, witty: ${truncatedMessage || 'अरे भाई, मस्ती करो! 😎'}`;

    const chatCompletion = await groq.chat.completions.create({
      messages: [{ role: 'system', content: isRoast ? 'Roast bot, unique roasts, no family (ma, baap, etc.).' : 'Friendly AI, Hindi, witty replies.' },
                 { role: 'user', content: prompt }],
      model: 'llama-3.1-8b-instant',
      temperature: isRoast ? 1.2 : 0.7,
      max_tokens: 300,
      top_p: isRoast ? 0.95 : 1.0
    });

    let response = chatCompletion.choices[0]?.message?.content?.trim();
    if (isRoast) {
      response = filterFamilyWords(response);
      if (response.includes('baap') || response.includes('baap ko') || !response) {
        console.warn('Family or invalid roast detected, regenerating');
        return await getAIResponse(message, true); // Retry if family mention
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
    return response || (isRoast ? 'Tera swag sasta hai, teri nibbi tujhe ignore karti, chutia! 😜' : 'गड़बड़ हो गई, फिर ट्राई कर! 😜');
  } catch (err) {
    console.error('Groq API error:', err.message);
    return isRoast ? 'Tu bakwas karta, teri nibbi sexy maal ban gayi, lodu! 😂' : '⚠️ कुछ गड़बड़ है, रुक कर ट्राई कर! 😅';
  }
}

module.exports = { getAIResponse };
