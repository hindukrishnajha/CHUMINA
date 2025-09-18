const Groq = require('groq-sdk');
const fs = require('fs').promises; // For file handling

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY
});

console.log('Groq API Key:', process.env.GROQ_API_KEY ? 'Set' : 'Not set');
console.log('Groq AI initialized successfully');

// File to store dynamically generated roasts
const ROAST_STORAGE_FILE = 'dynamic_roasts.json';

// Optimized roast prompt with clear rules and examples for logical roasts
const ROAST_PROMPT = `
You are a desi Hindi roast bot. Generate EXACTLY ONE FRESH, FUNNY, and HARSHLY EMBARRASSING roast in SUDDH HINDI, using desi slang and edgy vibes. Max 300 tokens, STRICTLY 1-3 lines, short, crisp, logical, and complete with a strong punchline. NO ENGLISH WORDS, NO HEADINGS, NO MULTIPLE ROASTS.

Rules:
- Roast ONLY USER and GIRLFRIEND. ABSOLUTELY NO family (ma, baap, behan, bhai, bhabhi, dada, dadi, chacha, chachi, tau, tai, cousin, family, dost, friend, wife, beti, beta, papa, mummy, relative, sister, brother, mother, father).
- USER words: chutia, gandu, lodu, jokar, murakh, namard, gandwa, namoona, hijda, chapri, nibba.
- GIRLFRIEND words: randi, callgirl, veshya, dhandhewaali, nibbi, chinaal, kinnri, sexy maal.
- Naughty twists (use logically): teri girlfriend ke boobs, teri girlfriend ki gaand, teri girlfriend ki chut, teri girlfriend ki bra, teri girlfriend ki panty, teri girlfriend ki kaali hai, teri girlfriend ki gulabi hai, teri girlfriend to sexy maal hai, teri girlfriend ki gulabi chut ki kasam aaj ka din bhot mast hai, teri girlfriend ki kaali na hoti to abhi uski mar leta, teri girlfriend k jism ki khushbu sungkar maza a gya, teri girlfriend ki gaand nahi gubbara hai, teri girlfriend ki chut pe kabja kar luga.
- Savage USER lines: teri gaand pe powder lga k maaruga, teri gaand pe kiss kar luga, teri gaand ko kaali se gulabi bna duga, teri gaand ki drar naap luga, teri gaand ki gahrai m kho gaya.
- Mix variety: Bollywood, TikTok, tapri, bazaar, naughty scenarios. Ensure the roast is logical and punchy.
- Avoid repeating previous roasts. Output ONLY the roast text.

Examples of GOOD roasts (logical, punchy):
- तेरी गर्लफ्रेंड की गांड नहीं गुब्बारा है, टिकटॉक पे nach ke dikha, lodu!
- तेरी गर्लफ्रेंड की bra tapri pe latak rahi, aur tu bazaar mein nibba ban ke ghum raha!
- तेरी गर्लफ्रेंड की gulabi chut ki kasam, tu chutia hai jo uske pichhe pada hai!

Examples of BAD roasts (avoid illogical or weak punchlines):
- तेरी गर्लफ्रेंड की चूत से ज्यादा सेक्सी तेरी नामर्द है! (illogical, no punch)
- तेरी गर्लफ्रेंड की गांड और तेरा lodu... (incomplete, no sense)
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

// Check for logical coherence
function isLogicalRoast(roast) {
  // Basic check for nonsense or weak punchlines
  const illogicalPatterns = [
    /सेक्सी.*नामर्द/i, // e.g., "sexy namard" is nonsense
    /है\s*और\s*है/i, // Too vague or repetitive
    /[^।!?]$/ // No proper punctuation at end
  ];
  return !illogicalPatterns.some(pattern => pattern.test(roast));
}

// Reword function to fix invalid or illogical roasts
async function rewordRoast(invalidRoast) {
  console.log('Rewording invalid/illogical roast:', invalidRoast);
  try {
    const rewordPrompt = `Rewrite this roast in SUDDH HINDI, 1-3 lines, remove any family words or illogical phrases, make it funny, punchy, and logical: "${invalidRoast}". Use desi slang like chutia, lodu, sexy maal, and naughty twists like teri girlfriend ki gaand nahi gubbara hai. Output ONLY the rewritten roast.`;
    const rewordCompletion = await Promise.race([
      groq.chat.completions.create({
        messages: [{ role: 'system', content: 'Reword bot, remove family words and illogical phrases, keep desi roast style.' },
                   { role: 'user', content: rewordPrompt }],
        model: 'llama-3.1-8b-instant',
        temperature: 0.8,
        max_tokens: 150,
        top_p: 0.9
      }),
      new Promise((_, reject) => setTimeout(() => reject(new Error('Reword timed out')), 6000))
    ]);
    return rewordCompletion.choices[0]?.message?.content?.trim() || 'तेरी गर्लफ्रेंड की चूत पे कब्जा कर लूंगा, चूतिया! 😜';
  } catch (err) {
    console.error('Reword error:', err.message);
    return 'तेरी गर्लफ्रेंड की गांड नहीं गुब्बारा है, लोडू! 😜';
  }
}

async function getAIResponse(message, isRoast = false, retries = 0) {
  const maxRetries = 2; // Reduced for speed
  console.log(`AI request - Message: ${message}, isRoast: ${isRoast}, Retry: ${retries}/${maxRetries}, Time: ${new Date().toISOString()}`);
  try {
    if (retries >= maxRetries) {
      console.warn('Max retries reached, generating dynamic fallback roast');
      const fallbackPrompt = `Generate ONE fresh, SUDDH HINDI roast, 1-3 lines, logical and punchy, using random naughty twists like teri girlfriend ki gaand nahi gubbara hai or teri girlfriend ki gulabi chut ki kasam. NO family words, NO repetition.`;
      const fallbackCompletion = await Promise.race([
        groq.chat.completions.create({
          messages: [{ role: 'system', content: 'Roast bot, one unique short roast, no family, pure Hindi, logical.' },
                     { role: 'user', content: fallbackPrompt }],
          model: 'llama-3.1-8b-instant',
          temperature: 0.8, // Controlled for logic
          max_tokens: 100,
          top_p: 0.9
        }),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Fallback timed out')), 6000))
      ]);
      const fallbackResponse = fallbackCompletion.choices[0]?.message?.content?.trim();
      console.log('Dynamic fallback response:', fallbackResponse);
      return filterFamilyWords(fallbackResponse) || 'तेरी गर्लफ्रेंड की चूत पे कब्जा कर लूंगा, चूतिया! 😜';
    }

    const dynamicRoasts = await loadDynamicRoasts();
    const truncatedMessage = message.length > 100 ? message.substring(0, 100) + '...' : message;
    let prompt = isRoast 
      ? ROAST_PROMPT + (dynamicRoasts.length > 0 ? `\nAvoid these previous roasts: ${JSON.stringify(dynamicRoasts.slice(-5))}` : '')
      : `Reply in SUDDH HINDI, desi style, short, witty: ${truncatedMessage || 'अरे भाई, मस्ती करो! 😎'}`;

    const chatCompletion = await Promise.race([
      groq.chat.completions.create({
        messages: [{ role: 'system', content: isRoast ? 'Roast bot, one unique short roast, no family (ma, baap, behan, bhai, etc.), pure Hindi, 1-3 lines, logical.' : 'Friendly AI, SUDDH HINDI, witty replies.' },
                   { role: 'user', content: prompt }],
        model: 'llama-3.1-8b-instant',
        temperature: 0.8, // Reduced for logical output
        max_tokens: 300,
        top_p: 0.9
      }),
      new Promise((_, reject) => setTimeout(() => reject(new Error('API call timed out')), 6000))
    ]);

    let response = chatCompletion.choices[0]?.message?.content?.trim();
    if (isRoast) {
      response = filterFamilyWords(response);
      const hasFamily = /ma|baap|behan|bhai|bhabhi|dada|dadi|chacha|chachi|tau|tai|cousin|family|dost|friend|wife|beti|beta|papa|mummy|relative|sister|brother|mother|father/i.test(response);
      const isMultiLine = response.split('\n').filter(line => line.trim()).length > 3;
      const isIllogical = !isLogicalRoast(response);
      if (hasFamily || !response || isMultiLine || isIllogical) {
        console.warn(`Invalid roast detected (hasFamily: ${hasFamily}, empty: ${!response}, multiLine: ${isMultiLine}, illogical: ${isIllogical}), rewording`);
        response = await rewordRoast(response); // Reword instead of full retry
        // Check again after reword
        const hasFamilyAfter = /ma|baap|behan|bhai|bhabhi|dada|dadi|chacha|chachi|tau|tai|cousin|family|dost|friend|wife|beti|beta|papa|mummy|relative|sister|brother|mother|father/i.test(response);
        if (hasFamilyAfter || !isLogicalRoast(response)) {
          return await getAIResponse(message, true, retries + 1); // Retry if still bad
        }
      }
      // Relaxed uniqueness check
      if (dynamicRoasts.some(roast => roast.toLowerCase() === response.toLowerCase())) {
        console.log('Duplicate roast detected, retrying');
        return await getAIResponse(message, true, retries + 1);
      }
      // Add new roast to storage
      dynamicRoasts.push(response);
      await saveDynamicRoasts(dynamicRoasts.slice(-100)); // Keep last 100 roasts
      console.log('New roast added, total:', dynamicRoasts.length);
    }
    console.log('AI response:', response);
    return response || (isRoast ? 'तेरी गर्लफ्रेंड की गांड नहीं गुब्बारा है, लोडू! 😜' : 'गड़बड़ हो गई, फिर ट्राई कर! 😜');
  } catch (err) {
    console.error('Groq API error:', err.message);
    return await getAIResponse(message, isRoast, retries + 1); // Retry on error
  }
}

module.exports = { getAIResponse };
