const Groq = require('groq-sdk');

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY
});

console.log('Groq API Key:', process.env.GROQ_API_KEY ? 'Set' : 'Not set');
console.log('Groq AI initialized successfully');

// Roast-specific prompt with updated words
const ROAST_PROMPT = `
You are a desi Hindi roast bot. Generate a FRESH, FUNNY, and HARSHLY EMBARRASSING roast (ghanghor beizzati) for the user based on their message's tone and keywords (e.g., "kha", "kya", abusive words). DO NOT repeat or include the user's message in the roast. Create UNIQUE roasts every time, inspired by but not copying examples. Use Hindi, desi slang, keep it edgy but within rules. Max 300 tokens, 1-3 lines, expand for max beizzati if needed.

Rules (strictly follow):
- Only roast the USER and their GIRLFRIEND. Never mention family (ma, baap, behan, bhai), wife, friends, or relatives.
- Words for USER: chutia, gandu, lodu, jokar, murakh, namard, gandwa, namoona, hijda.
- Words for GIRLFRIEND: randi, callgirl, veshya, dhandhewaali, nibbi, chinaal, kinnri, hijde.
- Common words: chapri, nibba (for user), nibbi (for girlfriend).
- If message is incomplete (ends with '...'), use generic roast like "Bhai, tera message itna sasta hai, teri nibbi bhi tujhe namard bolegi, chutia! 😂"
- Always add girlfriend twist if possible, and base the roast on the user's message tone/keywords.

Examples (for inspiration, DO NOT COPY):
User message (for context): "kha ho be"
Roast: "Tu toh ghar mein nibba ban ke pada hai, teri nibbi callgirl ban ke market mein tap rahi, chutia! 😜"

User message (for context): "kya kar rhe ho"
Roast: "Bas teri girlfriend ke sapne mein hila raha, lodu! Tu toh chapri ban ke time waste karta hai, jokar! 😂"

User message (for context): "randi saali tapko"
Roast: "Tapkon ka raja tu hai, gandu! Teri girlfriend toh dhandhewaali ban ke sabko nacha rahi, murakh! 😏"

User message (for context): "kya bol raha hai..."
Roast: "Tera message itna bekaar hai, teri nibbi bhi tujhe namard bol ke bhag gayi, chutia! 😂"

Now, generate a roast based on this message's tone and keywords: {message}
`;

// Static fallback roasts (updated with new words, no user message included)
const STATIC_ROASTS = [
  "Bhai, tera style itna sasta hai, teri nibbi bhi tujhe ignore karti hai, chutia! 😂",
  "Tu yaha time waste kar raha, teri girlfriend toh callgirl ban ke paisa kama rahi, lodu! 😜",
  "Arre, tera dimag toh namard ho gaya, jokar! Teri nibbi dhandhewaali ban ke tap rahi! 😏",
  "Tera swag toh chapri mall jaisa hai, murakh! Teri girlfriend tujhe chod ke veshya ban gayi! 😎",
  "Bhai, tu bolta hai toh lagta hai nibba king hai, gandu! Teri nibbi toh market mein tap rahi! 😂",
  "Tera attitude dekh ke teri nibbi bhi bolti hai, 'Yeh lodu kahan se aaya?' 😜",
  "Tu yaha bak-bak kar raha, teri girlfriend toh callgirl ban ke sabko entertain kar rahi, jokar! 😏",
  "Bhai, tera message itna boring hai, teri nibbi ne tujhe block kar diya, murakh! 😂",
  "Arre, tu kya bol raha, teri nibbi toh veshya ban ke tujhe bhool gayi, gandu! 😎",
  "Tera message toh itna ghatiya hai, teri girlfriend bhi tujhe chapri bolti hai, lodu! 😜",
  "Bhai, tu yeh kya likh raha? Teri nibbi toh dhandhewaali ban ke sabko samjha rahi, chutia! 😂",
  "Tera message padh ke toh teri girlfriend bhi bolti hai, 'Yeh chutia kyun message karta hai?' 😏",
  "Tu toh bilkul namard ban gaya, jokar! Teri nibbi toh market mein tap rahi! 😜",
  "Bhai, tera message itna sasta hai, teri girlfriend ne tujhe scrapyard mein bech diya, lodu! 😂",
  "Arre, tu kya kar raha, teri nibbi toh callgirl ban ke tujhe troll kar rahi, murakh! 😎",
  "Tera message toh itna bekaar hai, teri girlfriend bhi tujhe nibba bol ke has rahi, gandu! 😜",
  "Bhai, tu yaha bakwas kar raha, teri nibbi toh veshya ban ke duniya hila rahi, chutia! 😂",
  "Tera style dekh ke teri girlfriend bhi bolti hai, 'Yeh lodu kyun mera time waste karta hai?' 😏",
  "Arre, tu toh chapri king ban gaya, jokar! Teri nibbi toh dhandhewaali ban ke paisa kama rahi! 😎",
  "Bhai, tera message itna ghatiya hai, teri girlfriend ne tujhe namard declare kar diya, murakh! 😂",
  "Tu toh gandwa ban gaya hai, namoona! Teri nibbi chinaal ban ke sabko nacha rahi! 😜",
  "Bhai, tera dimag hijda jaisa hai, jokar! Teri girlfriend kinnri ban ke tap rahi! 😏",
  "Arre, tu kya kar raha, teri nibbi hijde ban ke tujhe has rahi, gandwa! 😎",
  "Tera attitude toh namoona wala hai, hijda! Teri girlfriend chinaal ban ke market mein ghum rahi! 😂"
];

async function getAIResponse(message, isRoast = false) {
  console.log('AI request - Message:', message, 'isRoast:', isRoast);
  try {
    // Truncate message if too long to avoid token overflow
    const truncatedMessage = message.length > 100 ? message.substring(0, 100) + '...' : message;
    const prompt = isRoast ? ROAST_PROMPT.replace('{message}', truncatedMessage) : `Reply to this message in Hindi, desi style, short and witty, Shalender Hindu ke style mein: ${truncatedMessage || 'अरे भाई, कुछ मस्ती करो ना! 😎'}`;
    
    const chatCompletion = await groq.chat.completions.create({
      messages: [
        {
          role: 'system',
          content: isRoast ? 'You are Shalender Hindu ka roast bot. Generate unique, creative roasts following the roast prompt strictly. Do not repeat user message.' : 'आप एक दोस्ताना AI हैं जो हिंदी में मजेदार और साधारण तरीके से जवाब देता है। जवाब छोटा, मस्ती भरा, और Shalender Hindu के स्टाइल में हो।'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      model: 'llama-3.1-8b-instant',
      temperature: isRoast ? 1.0 : 0.7, // Higher for creative roasts
      max_tokens: 300, // Max for detailed roasts
      top_p: isRoast ? 0.9 : 1.0 // Add diversity for roasts
    });

    const response = chatCompletion.choices[0]?.message?.content?.trim() || (isRoast ? STATIC_ROASTS[Math.floor(Math.random() * STATIC_ROASTS.length)] : 'अरे भाई, कुछ गड़बड़ हो गई, फिर से बोलो! 😜');
    console.log('AI response:', response);
    return response;
  } catch (err) {
    console.error('Groq API error:', err.message);
    return isRoast ? STATIC_ROASTS[Math.floor(Math.random() * STATIC_ROASTS.length)] : '⚠️ ओहो, कुछ तो गड़बड़ है! थोड़ा रुक, फिर ट्राई कर! 😅';
  }
}

module.exports = { getAIResponse };
