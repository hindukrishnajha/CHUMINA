const Groq = require('groq-sdk');

// Initialize Groq API
const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY
});

console.log('Groq API Key:', process.env.GROQ_API_KEY ? 'Set ✅' : 'Not set ❌');
console.log('Groq AI initialized successfully');

// Roast prompt template
const ROAST_PROMPT = `
You are a desi Hindi roast bot. Generate a FRESH, FUNNY, and HARSHLY EMBARRASSING roast (ghanghor beizzati) for the user based on their message's tone and keywords (like "kha", "kya", abusive words). DO NOT repeat or include the user's message in the roast. Create UNIQUE roasts every time, inspired by but not copying examples. Use Hindi, desi slang including chut, lund, gaand, randi, callgirl, veshya, dhandhewaali, nibbi, lavdi, chinal, chamcha, jokar, nokar, ullu, gandu, chutia, lodu etc. Keep it edgy but within rules. Max 300 tokens, 1-3 lines, expand for max beizzati if needed.

Rules (strictly follow):
- Roast only the USER and their GIRLFRIEND. Never mention family (ma, baap, behan, bhai), wife, friends, or relatives.
- Always add girlfriend twist if possible.
- If message is incomplete (ends with '...'), use generic roast like "Bhai, tera message itna sasta hai, teri nibbi bhi tujhe namard bolegi, chutia! 😂"

Examples for inspiration (do not copy):
- "Tu toh ghar mein nibba ban ke pada hai, teri nibbi callgirl ban ke market mein tap rahi, chutia! 😜"
- "Bas teri girlfriend ke sapne mein hila raha, lodu! Tu toh chapri ban ke time waste karta hai, jokar! 😂"
- "Tapkon ka raja tu hai, gandu! Teri girlfriend toh dhandhewaali ban ke sabko nacha rahi, murakh! 😏"
`;

// Fallback static roasts in case API fails
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
  "Tera message toh itna ghatiya hai, teri girlfriend bhi tujhe chapri bolti hai, lodu! 😜"
];

// Main function to generate roast
async function getAIResponse(userRole, message, isRoast = false) {
  console.log('AI request - Role:', userRole, 'Message:', message, 'isRoast:', isRoast);

  // Skip roasting for masterid or admin
  const lowerRole = userRole.toLowerCase();
  if (lowerRole === 'masterid' || lowerRole === 'admin') {
    console.log('Skipping roast for privileged role');
    return '⚠️ इस यूज़र को roast नहीं किया जा सकता!';
  }

  try {
    // Truncate message if too long
    const truncatedMessage = message.length > 100 ? message.substring(0, 100) + '...' : message;

    const prompt = isRoast 
      ? ROAST_PROMPT.replace('{message}', truncatedMessage)
      : `Reply to this message in Hindi, desi style, short and witty, Shalender Hindu ke style mein, without repeating the user's message: ${truncatedMessage || 'अरे भाई, कुछ मस्ती करो ना! 😎'}`;

    const response = await groq.chat.completions.create({
      messages: [
        {
          role: 'system',
          content: isRoast 
            ? 'You are Shalender Hindu ka roast bot. Generate unique, creative roasts following the roast prompt strictly. Do not repeat user message.'
            : 'आप एक दोस्ताना AI हैं जो हिंदी में मजेदार और साधारण तरीके से जवाब देता है। जवाब छोटा, मस्ती भरा, और Shalender Hindu के स्टाइल में हो। User का message repeat न करें।'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      model: 'llama-3.1-8b-instant',
      temperature: isRoast ? 1.0 : 0.7,
      max_tokens: 300,
      top_p: isRoast ? 0.9 : 1.0
    });

    const reply = response.choices[0]?.message?.content?.trim();
    if (reply) {
      console.log('AI response:', reply);
      return reply;
    } else {
      throw new Error('Empty reply from API');
    }
  } catch (error) {
    console.error('Groq API error:', error.message);
    if (isRoast) {
      const randomIndex = Math.floor(Math.random() * STATIC_ROASTS.length);
      return STATIC_ROASTS[randomIndex];
    } else {
      return '⚠️ ओहो, कुछ तो गड़बड़ है! फिर से कोशिश करो! 😅';
    }
  }
}

// Export the function
module.exports = { getAIResponse };
