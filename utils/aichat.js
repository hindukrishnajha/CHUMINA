const Groq = require('groq-sdk');

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY
});

console.log('Groq API Key:', process.env.GROQ_API_KEY ? 'Set' : 'Not set');
console.log('Groq AI initialized successfully');

async function getAIResponse(message) {
  console.log('AI request - Message:', message);
  try {
    const chatCompletion = await groq.chat.completions.create({
      messages: [
        {
          role: 'system',
          content: 'आप एक दोस्ताना AI हैं जो हिंदी में मजेदार और साधारण तरीके से जवाब देता है। जवाब छोटा, मस्ती भरा, और Shalender Hindu के स्टाइल में हो।'
        },
        {
          role: 'user',
          content: message || 'अरे भाई, कुछ मस्ती करो ना! 😎'
        }
      ],
      model: 'llama-3.1-8b-instant',
      temperature: 0.7,
      max_tokens: 100
    });

    const response = chatCompletion.choices[0]?.message?.content || 'अरे भाई, कुछ गड़बड़ हो गई, फिर से बोलो! 😜';
    console.log('AI response:', response);
    return response;
  } catch (err) {
    console.error('Groq API error:', err.message);
    return '⚠️ ओहो, कुछ तो गड़बड़ है! थोड़ा रुक, फिर ट्राई कर! 😅';
  }
}

module.exports = { getAIResponse };
