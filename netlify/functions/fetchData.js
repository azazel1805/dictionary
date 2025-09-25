const { GoogleGenerativeAI } = require("@google/generative-ai");
// 'fetch' Netlify'ın ortamında global olarak bulunur, bu yüzden import etmeye gerek yok.

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const UNSPLASH_ACCESS_KEY = process.env.UNSPLASH_ACCESS_KEY;

// API Anahtarlarının varlığını en başta kontrol et. Eksikse, fonksiyonu başlatma.
if (!GEMINI_API_KEY || !UNSPLASH_ACCESS_KEY) {
  throw new Error("Missing API keys. Please set GEMINI_API_KEY and UNSPLASH_ACCESS_KEY in environment variables.");
}

const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

exports.handler = async function (event, context) {
  // --- YENİ: Boş parametre nesnesini kontrol et ---
  if (!event.queryStringParameters) {
    return { statusCode: 400, body: JSON.stringify({ error: "Query parameters are required." }) };
  }

  const { word, mode, language, word1, word2, userSentence } = event.queryStringParameters;

  try {
    // --- MODE: Full dictionary search (default) ---
    if (!mode || mode === 'search') {
      if (!word) return { statusCode: 400, body: JSON.stringify({ error: "Word parameter is required." }) };
      
      const prompt = `
        Provide a detailed dictionary entry for the word or phrase: "${word}" in ${language || 'English'}.
        Your response must be in ${language || 'English'}.
        Include the following sections clearly labeled EXACTLY as shown with markdown bolding:
        **Pronunciation:** [Provide phonetic spelling or IPA here]
        **Definitions:** [List all common meanings with examples for each]
        **Synonyms:** [Provide a comma-separated list]
        **Antonyms:** [Provide a comma-separated list]
        **Etymology:** [Provide a brief etymology]
        **Example Sentences:** [List at least 3 diverse example sentences]
        **${language || 'Turkish'} Meaning:** [Provide the meaning in ${language || 'Turkish'}. If the source language is the same, just write the word itself.]
      `;

      const [geminiResult, imageResponse] = await Promise.all([
        model.generateContent(prompt),
        fetch(`https://api.unsplash.com/search/photos?query=${encodeURIComponent(word)}&per_page=1&orientation=landscape&client_id=${UNSPLASH_ACCESS_KEY}`)
      ]);
      
      const dictionaryText = geminiResult.response.text();
      let imageUrl = null;
      if (imageResponse.ok) {
        const imageData = await imageResponse.json();
        if (imageData.results && imageData.results.length > 0) {
          imageUrl = imageData.results[0].urls.regular;
        }
      }

      return { statusCode: 200, body: JSON.stringify({ dictionaryData: dictionaryText, imageUrl }) };
    }

    // Diğer modlarınız (bunlar zaten iyi görünüyor)
    if (mode === 'eli5') {
        if (!word) return { statusCode: 400, body: JSON.stringify({ error: "Word parameter is required." }) };
        const prompt = `Explain the word "${word}" in one simple sentence that a five-year-old could easily understand.`;
        const result = await model.generateContent(prompt);
        return { statusCode: 200, body: JSON.stringify({ resultText: result.response.text() }) };
    }
    // ... diğer modlarınız ...
    if (mode === 'compare') {
      if (!word1 || !word2) return { statusCode: 400, body: JSON.stringify({ error: "Both words are required for comparison." }) };
      const prompt = `Clearly explain the difference between the words "${word1}" and "${word2}". Provide one example sentence for each to highlight its correct usage. Format the response using markdown for clarity (bolding, lists).`;
      const result = await model.generateContent(prompt);
      return { statusCode: 200, body: JSON.stringify({ resultText: result.response.text() }) };
    }
    if (mode === 'validate') {
      if (!word || !userSentence) return { statusCode: 400, body: JSON.stringify({ error: "Word and user sentence are required." }) };
      const prompt = `The user wants to use the word "${word}" in this sentence: "${userSentence}". Is this sentence grammatically correct and does it use the word in a natural way? If not, please correct it and provide a one-sentence explanation of the mistake.`;
      const result = await model.generateContent(prompt);
      return { statusCode: 200, body: JSON.stringify({ resultText: result.response.text() }) };
    }

    // Eğer geçersiz bir mod gelirse
    return { statusCode: 400, body: JSON.stringify({ error: `Invalid mode specified: ${mode}` }) };

  } catch (error) {
    console.error("API call error:", error);
    return { statusCode: 500, body: JSON.stringify({ error: "Failed to fetch data from APIs. Check the function logs for more details." }) };
  }
};
