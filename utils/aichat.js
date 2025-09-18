const Groq = require('groq-sdk');
const fs = require('fs').promises; // For file handling

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY
});

console.log('Groq API Key:', process.env.GROQ_API_KEY ? 'Set' : 'Not set');
console.log('Groq AI initialized successfully');

// File to store dynamically generated roasts
const ROAST_STORAGE_FILE = 'dynamic_roasts.json';

// Optimized roast prompt with few-shot examples to avoid forbidden words
const ROAST_PROMPT = `
You are a desi Hindi roast bot. Generate EXACTLY ONE FRESH, FUNNY, and HARSHLY EMBARRASSING roast in SUDDH HINDI, using desi slang and edgy vibes. Max 300 tokens, STRICTLY 1-3 lines, short, crisp, and complete. NO ENGLISH WORDS, NO HEADINGS, NO MULTIPLE ROASTS.

Rules:
- Roast ONLY USER and GIRLFRIEND. ABSOLUTELY NO family (ma, baap, behan, bhai, bhabhi, dada, dadi, chacha, chachi, tau, tai, cousin, family, dost, friend, wife, beti, beta, papa, mummy, relative, sister, brother, mother, father). Do not use any family-related words at all. If you do, the response will be invalid.
- USER words: chutia, gandu, lodu, jokar, murakh, namard, gandwa, namoona, hijda, chapri, nibba.
- GIRLFRIEND words: randi, callgirl, veshya, dhandhewaali, nibbi, chinaal, kinnri, sexy maal.
- Naughty twists (use randomly): teri girlfriend ke boobs, teri girlfriend ki gaand, teri girlfriend ki chut, teri girlfriend ki bra, teri girlfriend ki panty, teri girlfriend ki kaali hai, teri girlfriend ki gulabi hai, teri girlfriend to sexy maal hai, teri girlfriend ki gulabi chut ki kasam aaj ka din bhot mast hai, teri girlfriend ki kaali na hoti to abhi uski mar leta, teri girlfriend k jism ki khushbu sungkar maza a gya, teri girlfriend ki gaand nahi gubbara hai, teri girlfriend ki chut pe kabja kar luga.
- Savage USER lines: teri gaand pe powder lga k maaruga, teri gaand pe kiss kar luga, teri gaand ko kaali se gulabi bna duga, teri gaand ki drar naap luga, teri gaand ki gahrai m kho gaya.
- Mix variety: Bollywood, TikTok, tapri, bazaar, naughty scenarios. Be creative and random.
- Avoid repeating previous roasts. Output ONLY the roast text.

Examples of GOOD roasts (use similar style):
- तेरी गर्लफ्रेंड की गुलाबी चूत की कसम, तू चूतिया है, लोडू!
- तेरी गर्लफ्रेंड की गांड नहीं गुब्बारा है, टिकटॉक पे डांस कर, गandu!
- तेरी गर्लफ्रेंड का जिस्म सुंगकर मज़ा आ गया, पर तू तो निब्बा बाजार में भटक रहा!

Examples of BAD roasts (DO NOT use anything like this, avoid family words):
- तेरी ma की तरह... (bad because 'ma' is family)
- तेरे baap की गर्लफ्रेंड... (bad because 'baap' is family)
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

// New reword function to fix invalid roasts
async function rewordRoast(invalidRoast) {
  console.log('Rewording invalid roast:', invalidRoast);
  try {
    const rewordPrompt = `Rewrite this roast in SUDDH HINDI, 1-3 lines, remove any family words (ma, baap, etc.), make it fresh and funny: "${invalidRoast}". Output ONLY the rewritten roast.`;
    const rewordCompletion = await groq.chat.completions.create({
      messages: [{ role: 'system', content: 'Reword bot, remove family words, keep desi roast style.' },
                 { role: 'user', content: rewordPrompt }],
      model: 'llama-3.1-8b-instant',
      temperature: 1.0,
      max_tokens: 150,
      top_p: 0.9
    });
    return rewordCompletion.choices[0]?.message?.content?.trim() || invalidRoast; // Fallback to original if fail
  } catch (err) {
    console.error('Reword error:', err.message);
    return invalidRoast;
  }
}

async function getAIResponse(message, isRoast = false, retries = 0) {
  const maxRetries = 2; // Reduced for speed
  console.log(`AI request - Message: ${message}, isRoast: ${isRoast}, Retry: ${retries}/${maxRetries}, Time: ${new Date().toISOString()}`);
  try {
    if (retries >= maxRetries) {
      console.warn('Max retries reached, generating dynamic fallback roast');
      const fallbackPrompt = `Generate ONE fresh, SUDDH HINDI roast, 1-3 lines, using random naughty twists like teri girlfriend ki gaand nahi gubbara hai or teri girlfriend ki gulabi chut ki kasam. NO family words, be creative and different.`;
      const fallbackCompletion = await Promise.race([
        groq.chat.completions.create({
          messages: [{ role: 'system', content: 'Roast bot, one unique short roast, no family, pure Hindi.' },
                     { role: 'user', content: fallbackPrompt }],
          model: 'llama-3.1-8b-instant',
          temperature: 1.2, // Higher for variety
          max_tokens: 100,
          top_p: 0.95
        }),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Fallback timed out')), 8000))
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
        messages: [{ role: 'system', content: isRoast ? 'Roast bot, one unique short roast, no family (ma, baap, behan, bhai, etc.), pure Hindi, 1-3 lines.' : 'Friendly AI, SUDDH HINDI, witty replies.' },
                   { role: 'user', content: prompt }],
        model: 'llama-3.1-8b-instant',
        temperature: 1.0,
        max_tokens: 300,
        top_p: 0.9
      }),
      new Promise((_, reject) => setTimeout(() => reject(new Error('API call timed out')), 8000))
    ]);

    let response = chatCompletion.choices[0]?.message?.content?.trim();
    if (isRoast) {
      response = filterFamilyWords(response);
      const hasFamily = /ma|baap|behan|bhai|bhabhi|dada|dadi|chacha|chachi|tau|tai|cousin|family|dost|friend|wife|beti|beta|papa|mummy|relative|sister|brother|mother|father/i.test(response);
      const isMultiLine = response.split('\n').filter(line => line.trim()).length > 3;
      if (hasFamily || !response || isMultiLine) {
        console.warn(`Invalid roast detected (hasFamily: ${hasFamily}, empty: ${!response}, multiLine: ${isMultiLine}), rewording instead of retrying`);
        response = await rewordRoast(response); // Reword instead of full retry
        // Check again after reword
        const hasFamilyAfter = /ma|baap|behan|bhai|bhabhi|dada|dadi|chacha|chachi|tau|tai|cousin|family|dost|friend|wife|beti|beta|papa|mummy|relative|sister|brother|mother|father/i.test(response);
        if (hasFamilyAfter) {
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
