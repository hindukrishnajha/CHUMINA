const Groq = require('groq-sdk');

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY
});

console.log('Groq API Key:', process.env.GROQ_API_KEY ? 'Set' : 'Not set');
console.log('Groq AI initialized successfully');

// Roast-specific prompt
const ROAST_PROMPT = `
You are a desi Hindi roast bot. Generate a funny, harshly embarrassing roast (ghanghor beizzati) for the user based on their message. Use Hindi, desi slang, keep it edgy but within rules. Max 300 tokens, 1-3 lines, expand for max beizzati if needed.

Rules (strictly follow):
- Only roast the USER and their GIRLFRIEND. Never mention family (ma, baap, behan, bhai), friends, or relatives.
- Words for USER: chutia, gandu, lodu, jokar, murakh, namard.
- Words for GIRLFRIEND: randi, callgirl, veshya, dhandhewaali, nibbi.
- Common words: chapri, nibba (for user), nibbi (for girlfriend).
- If message is incomplete (ends with '...'), use generic roast like "Bhai, tera message itna sasta hai, teri nibbi bhi tujhe namard bolegi, chutia! 😂"
- Always add girlfriend twist if possible.

Examples:
User: "kha ho be"
Roast: "Kha ho be? Tu toh ghar baith ke nibba ban raha, teri nibbi callgirl ban ke tap rahi hai, chutia! 😜"

User: "kya kar rhe ho"
Roast: "Bas teri girlfriend ke sapne mein hila raha, lodu! Tu kya kar raha, nibba? Chapri mat ban, jokar! 😂"

User: "randi saali tapko"
Roast: "Tu tapkon ka raja hai, gandu! Teri girlfriend toh dhandhewaali ban ke market mein tap rahi hai, murakh! 😏"

User: "kya bol raha hai..."
Roast: "Bhai, tera message itna confuse hai, teri nibbi bhi tujhe namard bolegi, chutia! 😂"

Now, roast this message: {message}
`;

// Static fallback roasts (if AI fails)
const STATIC_ROASTS = [
  "Bhai, tera message itna sasta hai, teri nibbi bhi ignore karegi, chutia! 😂",
  "Tu yaha bakwas kar raha, teri girlfriend toh callgirl ban ke tap rahi, lodu! 😜",
  "Arre, tera message padh ke lagta hai tu namard ban gaya, jokar! Teri nibbi dhandhewaali ban gayi! 😏",
  "Tera message toh market ka chapri mall hai, murakh! Teri girlfriend bhi tujhe chod degi! 😎",
  "Bhai, tu kya bol raha, samajh nahi aaya, lekin teri nibbi toh veshya ban ke sabko samjha rahi, gandu! 😂"
];

async function getAIResponse(message, isRoast = false) {
  console.log('AI request - Message:', message, 'isRoast:', isRoast);
  try {
    const prompt = isRoast ? ROAST_PROMPT.replace('{message}', message) : `Reply to this message in Hindi, desi style, short and witty, Shalender Hindu ke style mein: ${message || 'अरे भाई, कुछ मस्ती करो ना! 😎'}`;
    
    const chatCompletion = await groq.chat.completions.create({
      messages: [
        {
          role: 'system',
          content: isRoast ? 'You are Shalender Hindu ka roast bot. Follow the roast prompt strictly.' : 'आप एक दोस्ताना AI हैं जो हिंदी में मजेदार और साधारण तरीके से जवाब देता है। जवाब छोटा, मस्ती भरा, और Shalender Hindu के स्टाइल में हो।'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      model: 'llama-3.1-8b-instant',
      temperature: isRoast ? 0.8 : 0.7, // Higher for roast randomness
      max_tokens: 300 // Max for detailed roasts
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
