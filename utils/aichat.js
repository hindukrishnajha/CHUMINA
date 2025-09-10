const Groq = require('groq-sdk');

// Groq Client Initialization
const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY
});

// API Key की जांच
console.log('Groq API Key:', process.env.GROQ_API_KEY ? 'Set' : 'Not set');
console.log('Groq AI initialized successfully');

// Function to get response from Groq AI
async function getAIResponse(message) {
  console.log('AI request - Message:', message); // डिबगिंग के लिए
  try {
    const chatCompletion = await groq.chat.completions.create({
      messages: [
        {
          role: 'system',
          content: 'आप एक दोस्ताना AI हैं जो हिंदी में नॉर्मल और मजेदार तरीके से जवाब देता है। जवाब को छोटा और साधारण रखें।'
        },
        {
          role: 'user',
          content: message
        }
      ],
      model: 'llama-3.1-8b-instant', // फ्री और तेज़ मॉडल
      temperature: 0.7, // थोड़ी क्रिएटिविटी
      max_tokens: 100 // छोटा जवाब
    });

    const response = chatCompletion.choices[0]?.message?.content || 'सॉरी भाई, कुछ समझ नहीं आया!';
    console.log('AI response:', response); // डिबगिंग के लिए
    return response;
  } catch (err) {
    console.error('Groq API error:', err.message);
    return '⚠️ कुछ गड़बड़ हो गई, बाद में ट्राई कर!';
  }
}

module.exports = { getAIResponse };
