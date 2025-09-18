const Groq = require('groq-sdk');
const fs = require('fs').promises; // For file handling

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY
});

console.log('Groq API Key:', process.env.GROQ_API_KEY ? 'Set' : 'Not set');
console.log('Groq AI initialized successfully');

// File to store dynamically generated roasts
const ROAST_STORAGE_FILE = 'dynamic_roasts.json';

// Optimized roast prompt with strong focus on logical adult roasts
const ROAST_PROMPT = `
You are a desi Hindi roast bot. Based on this user message: "{user_message}", generate EXACTLY ONE FRESH, FUNNY, HARSHLY EMBARRASSING, and ADULT SEXY roast in SUDDH HINDI, using desi slang and edgy vibes. Max 200 tokens, STRICTLY 1-2 lines, short, crisp, logical, and complete with a strong punchline. NO ENGLISH WORDS, NO HEADINGS, NO MULTIPLE ROASTS.

Rules:
- Roast ONLY USER and GIRLFRIEND. ABSOLUTELY NO family (ma, baap, behan, bhai, bhabhi, dada, dadi, chacha, chachi, tau, tai, cousin, family, dost, friend, wife, beti, beta, papa, mummy, relative, sister, brother, mother, father).
- USER words: chutia, gandu, lodu, jokar, murakh, namard, gandwa, namoona, hijda, chapri, nibba, ullu, choti lulli waale, hijde, hijdi.
- GIRLFRIEND words: lavdi, randi, chinaal, veshya, nibbi, sexy maal, kinnar, kinnri.
- Naughty twists (use logically for adult sexy vibe, pick 1-2 max, not mandatory every time): uff teri gf k boobs, uff teri gf ki gaand, uff teri gf ki chut, teri girlfriend ke boobs tapri pe dikhte hain, teri girlfriend ki gaand nahi gubbara hai, teri girlfriend ki chut pe kabja kar lunga, teri girlfriend ki bra bazaar mein bik rahi, teri girlfriend ki panty latak rahi.
- Savage USER lines (use logically): tu lodu bazaar mein ghumta hai, teri gaand pe powder lagake maarunga, tu nibba ban ke TikTok pe nach raha, teri choti lulli waale tu ullu hai.
- Mix variety: Bollywood, TikTok, tapri, bazaar. Ensure roast is logical, punchy, and based on the user message for relevance.
- Avoid repeating previous roasts. Output ONLY the roast text.

Examples of GOOD roasts (logical, punchy, adult sexy):
- उफ़ तेरी गर्लफ्रेंड की गांड, तू लोडू टिकटॉक पे नाच, रंडी की तरह उछल!
- उफ़ तेरी गर्लफ्रेंड के बूब्स, तू चूतिया बाजार में छोटी लुल्ली वाले बन के घूम!
- तेरी गर्लफ्रेंड की चूत पे कब्जा कर लूंगा, उफ़ तेरी gf की चूत, तू नामर्द तपरी पे बैठ!

Examples of BAD roasts (avoid illogical, weak, or nonsense punchlines):
- तेरी गर्लफ्रेंड की चूत से ज्यादा सेक्सी तेरी नामर्द है! (illogical, no punch)
- तेरी गर्लफ्रेंड की गांड और तेरा lodu... (incomplete, no sense)
- तेरी गर्लफ्रेंड की काली चूत की कसम, तू नामर्द सेक्सी है! (nonsense combination)
- क्या तुम्हारे पास काम करता है या फिर तुम्हारे gf काम करते हैं? (illogical, no adult vibe)
- मैंने देखा है, तेरी GF की गांड के बाद तेरा IQ क्या है? (weak punch, illogical)
- मैंने देखा है, तेरी gf की गांड चुदने वाली कोई और नहीं है, लेकिन तेरी gf की गांड चुदने के लिए कोई भी लड़की काफी है. (nonsense, repetitive)
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
  const illogicalPatterns = [
    /सेक्सी.*नामर्द/i, // e.g., "sexy namard"
    /है\s*और\s*है/i, // Vague or repetitive
    /[^।!?]$/, // No punctuation
    /नामर्द.*(सेक्सी|चूत|गांड)/i, // Nonsense combinations
    /काली.*मार देती/i, // Confusing hypothetical
    /\b(कसम|खुशबू).*(नामर्द|गंदी)/i, // Weak or illogical links
    /पास\s*काम\s*करता/i, // Bad example from user
    /गांड\s*के\s*बाद\s*तेरा/i, // Weak punch from user
    /चुदने\s*वाली\s*कोई\s*और/i // Nonsense from user
  ];
  return roast && roast.length > 10 && roast.length < 150 && !illogicalPatterns.some(pattern => pattern.test(roast));
}

// Reword function to fix invalid or illogical roasts
async function rewordRoast(invalidRoast, userMessage) {
  console.log('Rewording invalid/illogical roast:', invalidRoast);
  try {
    const rewordPrompt = `Based on user message: "${userMessage}", rewrite this roast in SUDDH HINDI, 1-2 lines, remove any family words or illogical phrases, make it adult sexy, funny, punchy, and logical: "${invalidRoast}". Use desi slang like chutia, lodu, lavdi, randi, chinaal, sexy maal, and naughty twists like uff teri gf k boobs. Output ONLY the rewritten roast.`;
    const rewordCompletion = await Promise.race([
      groq.chat.completions.create({
        messages: [{ role: 'system', content: 'Reword bot, remove family words and illogical phrases, keep desi roast style, logical and punchy, adult sexy.' },
                   { role: 'user', content: rewordPrompt }],
        model: 'llama-3.1-8b-instant',
        temperature: 0.7,
        max_tokens: 100,
        top_p: 0.85
      }),
      new Promise((_, reject) => setTimeout(() => reject(new Error('Reword timed out')), 5000))
    ]);
    return rewordCompletion.choices[0]?.message?.content?.trim() || 'उफ़ तेरी गर्लफ्रेंड की गांड, तू लोडू टिकटॉक पे नाच! 😜';
  } catch (err) {
    console.error('Reword error:', err.message);
    return 'उफ़ तेरी गर्लफ्रेंड के बूब्स, तू चूतिया बाजार में घूम! 😜';
  }
}

async function getAIResponse(message, isRoast = false, retries = 0) {
  const maxRetries = 1; // Reduced for speed
  console.log(`AI request - Message: ${message}, isRoast: ${isRoast}, Retry: ${retries}/${maxRetries}, Time: ${new Date().toISOString()}`);
  try {
    if (retries >= maxRetries) {
      console.warn('Max retries reached, generating dynamic fallback roast');
      const fallbackPrompt = `Based on user message: "${message}", generate ONE fresh, SUDDH HINDI roast, 1-2 lines, logical and punchy, adult sexy, using naughty twists like uff teri gf ki gaand or uff teri gf k boobs. NO family words, NO repetition, ensure logical flow.`;
      const fallbackCompletion = await Promise.race([
        groq.chat.completions.create({
          messages: [{ role: 'system', content: 'Roast bot, one unique short roast, no family, pure Hindi, logical, adult sexy.' },
                     { role: 'user', content: fallbackPrompt }],
          model: 'llama-3.1-8b-instant',
          temperature: 0.7, // Controlled for logic
          max_tokens: 80,
          top_p: 0.85
        }),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Fallback timed out')), 5000))
      ]);
      const fallbackResponse = fallbackCompletion.choices[0]?.message?.content?.trim();
      console.log('Dynamic fallback response:', fallbackResponse);
      return filterFamilyWords(fallbackResponse) || 'उफ़ तेरी गर्लफ्रेंड की चूत, तू निब्बा तपरी पे बैठ! 😜';
    }

    const dynamicRoasts = await loadDynamicRoasts();
    const truncatedMessage = message.length > 100 ? message.substring(0, 100) + '...' : message;
    let prompt = isRoast 
      ? ROAST_PROMPT.replace('{user_message}', message) + (dynamicRoasts.length > 0 ? `\nAvoid these previous roasts: ${JSON.stringify(dynamicRoasts.slice(-3))}` : '')
      : `Reply in SUDDH HINDI, desi style, short, witty: ${truncatedMessage || 'अरे भाई, मस्ती करो! 😎'}`;

    const chatCompletion = await Promise.race([
      groq.chat.completions.create({
        messages: [{ role: 'system', content: isRoast ? 'Roast bot, one unique short roast, no family (ma, baap, behan, bhai, etc.), pure Hindi, 1-2 lines, logical and adult sexy.' : 'Friendly AI, SUDDH HINDI, witty replies.' },
                   { role: 'user', content: prompt }],
        model: 'llama-3.1-8b-instant',
        temperature: 0.7, // Reduced for logical output
        max_tokens: 200,
        top_p: 0.85 // Tighter for logic
      }),
      new Promise((_, reject) => setTimeout(() => reject(new Error('API call timed out')), 5000))
    ]);

    let response = chatCompletion.choices[0]?.message?.content?.trim();
    if (isRoast) {
      response = filterFamilyWords(response);
      const hasFamily = /ma|baap|behan|bhai|bhabhi|dada|dadi|chacha|chachi|tau|tai|cousin|family|dost|friend|wife|beti|beta|papa|mummy|relative|sister|brother|mother|father/i.test(response);
      const isMultiLine = response.split('\n').filter(line => line.trim()).length > 2;
      const isIllogical = !isLogicalRoast(response);
      if (hasFamily || !response || isMultiLine || isIllogical) {
        console.warn(`Invalid roast detected (hasFamily: ${hasFamily}, empty: ${!response}, multiLine: ${isMultiLine}, illogical: ${isIllogical}), rewording`);
        response = await rewordRoast(response, message); // Reword with user message for relevance
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
      await saveDynamicRoasts(dynamicRoasts.slice(-50)); // Keep last 50 roasts
      console.log('New roast added, total:', dynamicRoasts.length);
    }
    console.log('AI response:', response);
    
    // Optional 50-second delay for consecutive messages (comment out if not needed)
    await new Promise(resolve => setTimeout(resolve, 50000)); // 50 seconds delay
    
    return response || (isRoast ? 'उफ़ तेरी गर्लफ्रेंड के बूब्स, तू चूतिया टिकटॉक पे! 😜' : 'गड़बड़ हो गई, फिर ट्राई कर! 😜');
  } catch (err) {
    console.error('Groq API error:', err.message);
    return await getAIResponse(message, isRoast, retries + 1); // Retry on error
  }
}

module.exports = { getAIResponse };
