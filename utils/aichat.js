const Groq = require('groq-sdk');

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY
});

console.log('Groq API Key:', process.env.GROQ_API_KEY ? 'Set' : 'Not set');
console.log('Groq AI initialized successfully');

// Roast-specific prompt with updated words and variety
const ROAST_PROMPT = `
You are a desi Hindi roast bot, full of savage humor and naughty desi vibes. Generate a FRESH, FUNNY, and HARSHLY EMBARRASSING roast (ghanghor beizzati) for the user based on their message's tone and keywords (e.g., "kha", "kya", abusive words). DO NOT repeat or include the user's message in the roast. Create UNIQUE roasts every time, inspired by but not copying examples. Use Hindi, desi slang, keep it edgy, spicy, and within rules. Max 300 tokens, 1-3 lines, expand for max beizzati if needed.

Rules (strictly follow):
- Only roast the USER and their GIRLFRIEND. Never mention family (ma, baap, behan, bhai), wife, friends, or relatives.
- Words for USER: chutia, gandu, lodu, jokar, murakh, namard, gandwa, namoona, hijda, chapri, nibba.
- Words for GIRLFRIEND: randi, callgirl, veshya, dhandhewaali, nibbi, chinaal, kinnri, sexy maal, hijde.
- Include naughty desi references to girlfriend's physical attributes (e.g., boobs, gaand, chut, bra, panty, kaali, gulabi) for extra spice, but keep it playful and not overly vulgar.
- Add variety: mix pop culture (Bollywood, cricket, TikTok), desi scenarios (mohalla, tapri, bazaar), and naughty twists (e.g., girlfriend's bra, panty, or seductive vibe).
- If message is incomplete (ends with '...'), use generic roast like "Bhai, tera message itna sasta hai, teri nibbi ke boobs bhi tujhe ignore karte hain, chutia! 😜"
- Always add a girlfriend twist, and base the roast on the user's message tone/keywords.
- Avoid repeating the same words or structure in consecutive roasts.

Examples (for inspiration, DO NOT COPY):
User message (for context): "kha ho be"
Roast: "Tu toh apne mohalle ke tapri pe pada hai, gandu! Teri nibbi ke boobs market mein trend kar rahe hain! 😎"

User message (for context): "kya kar rhe ho"
Roast: "Tu toh apni girlfriend ki panty ke sapne mein khoya hai, lodu! Woh toh TikTok pe sexy maal ban ke nach rahi hai! 😜"

User message (for context): "randi saali tapko"
Roast: "Arre, tu tapkane ke chakkar mein apni aukaat bhool gaya, jokar! Teri nibbi ki gaand toh bazaar mein sabko nacha rahi hai! 😏"

User message (for context): "kya bol raha hai..."
Roast: "Tera message itna bekaar hai, teri nibbi ki bra bhi tujhe chod ke chali gayi, chutia! 😂"

Now, generate a roast based on this message's tone and keywords: {message}
`;

// Static fallback roasts (updated with new lines and variety)
const STATIC_ROASTS = [
  "Bhai, tera style itna sasta hai, teri nibbi ke boobs bhi tujhe ignore karte hain, chutia! 😂",
  "Tu yaha bakwas kar raha, teri girlfriend ki gaand toh Bollywood ke set pe dhoom macha rahi hai, lodu! 😜",
  "Arre, tera dimag toh namard ho gaya, jokar! Teri nibbi ki chut bazaar mein trend kar rahi hai! 😏",
  "Tera swag toh chapri mall jaisa hai, murakh! Teri girlfriend ki bra Instagram reels pe viral ho rahi! 😎",
  "Bhai, tu toh nibba king ban gaya, gandu! Teri nibbi ki panty toh TikTok pe auction mein hai! 😂",
  "Tera attitude dekh ke teri nibbi bolti hai, 'Yeh lodu meri kaali vibe ko kyun bigadta hai?' 😜",
  "Tu yaha time waste kar raha, teri girlfriend ki gulabi chut toh club mein sabko nacha rahi, jokar! 😏",
  "Bhai, tera message itna boring hai, teri nibbi toh sexy maal ban ke tujhe block kar diya! 😂",
  "Arre, tu kya bol raha, teri girlfriend ki gaand pe powder laga ke sab has rahe, gandwa! 😎",
  "Tera message toh itna ghatiya hai, teri nibbi ki bra bhi tujhe namard bolti hai, lodu! 😜",
  "Bhai, tu yaha bak-bak kar raha, teri nibbi ki panty toh mohalle ke tapri pe discuss ho rahi, chutia! 😂",
  "Tera style toh bilkul namoona wala hai, hijda! Teri girlfriend ki kaali chut toh market mein famous hai! 😏",
  "Arre, tu toh apni girlfriend ki gaand ki gahrai mein khoya hai, gandu! Woh toh TikTok pe sexy maal ban gayi! 😎",
  "Bhai, tera message itna sasta hai, teri nibbi ke boobs bhi tujhe dekh ke sharma gaye, murakh! 😂",
  "Tu toh apni girlfriend ki bra ke sapne mein pada hai, jokar! Woh toh club mein dhandhewaali ban gayi! 😜",
  "Tera attitude toh Ola ka cancelled ride jaisa hai, gandwa! Teri nibbi ki panty toh bazaar mein bik rahi hai! 😏",
  "Bhai, tu yaha bakwas kar raha, teri girlfriend ki gaand pe kiss karne ka sapna toh viral ho gaya, lodu! 😎",
  "Arre, tera dimag itna bekaar hai, teri nibbi ki chut ki gahrai bhi tujhe samajh nahi aati, chutia! 😂",
  "Tu toh apni girlfriend ki kaali vibe ke chakkar mein pada hai, namard! Woh toh reels mein gulabi ban gayi! 😜",
  "Bhai, tera message itna ghatiya hai, teri nibbi ki bra toh tujhe dekh ke utar gayi, gandu! 😏",
  "Tu toh apni girlfriend ki gaand ki draar naap raha, murakh! Woh toh sexy maal ban ke sabko hila rahi! 😎",
  "Bhai, tera style itna sasta hai, teri nibbi ki panty bhi tujhe dekh ke sharma gayi, jokar! 😂",
  "Arre, tu toh apni girlfriend ki chut ke sapne mein khoya hai, lodu! Woh toh mohalle mein callgirl ban gayi! 😜",
  "Tera message toh bilkul namoona wala hai, hijda! Teri nibbi ki gaand toh TikTok pe trend kar rahi hai! 😏",
  "Bhai, tu yaha bak-bak kar raha, teri girlfriend ki bra toh bazaar mein auction mein hai, gandwa! 😎",
  "Tu toh apni girlfriend ki gaand pe powder laga ke nach raha, chutia! Woh toh club mein sexy maal ban gayi! 😂",
  "Arre, tera dimag itna bekaar hai, teri nibbi ki chut ki gahrai tujhe samajh nahi aati, murakh! 😜",
  "Bhai, tera attitude toh sasti daaru jaisa hai, gandu! Teri nibbi ki panty toh reels mein viral ho rahi! 😏"
];

async function getAIResponse(message, isRoast = false) {
  console.log('AI request - Message:', message, 'isRoast:', isRoast);
  try {
    // Truncate message if too long to avoid token overflow
    const truncatedMessage = message.length > 100 ? message.substring(0, 100) + '...' : message;
    
    // Add random context for variety
    const randomContexts = [
      'Mohalle ke tapri pe',
      'Bollywood ke saste set mein',
      'TikTok ban ke baad',
      'Cricket match ke dugout mein',
      'Bazaar ke sale mein',
      'Diwali ke patakhe jaisa',
      'Mumbai local train ke rush mein',
      'Shaadi ke pandal mein'
    ];
    const randomContext = randomContexts[Math.floor(Math.random() * randomContexts.length)];
    const prompt = isRoast 
      ? ROAST_PROMPT.replace('{message}', `${randomContext}: ${truncatedMessage}`)
      : `Reply to this message in Hindi, desi style, short and witty, Shalender Hindu ke style mein: ${truncatedMessage || 'अरे भाई, कुछ मस्ती करो ना! 😎'}`;
    
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
      temperature: isRoast ? 1.2 : 0.7, // Higher for more creative roasts
      max_tokens: 300, // Max for detailed roasts
      top_p: isRoast ? 0.95 : 1.0 // More diversity for roasts
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
