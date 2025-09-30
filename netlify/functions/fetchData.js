const { GoogleGenerativeAI } = require("@google/generative-ai");
// 'fetch' is globally available in Netlify's environment, so no need to import it.

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const UNSPLASH_ACCESS_KEY = process.env.UNSPLASH_ACCESS_KEY;

// Check for the existence of API Keys at the very beginning. If they are missing, do not initialize the function.
if (!GEMINI_API_KEY || !UNSPLASH_ACCESS_KEY) {
  throw new Error("Missing API keys. Please set GEMINI_API_KEY and UNSPLASH_ACCESS_KEY in environment variables.");
}

const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
// FIX: Corrected the model name to a valid, available model.
const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

exports.handler = async function (event, context) {
  // --- NEW: Check for an empty query string parameters object ---
  if (!event.queryStringParameters) {
    return { statusCode: 400, body: JSON.stringify({ error: "Query parameters are required." }) };
  }

  const { word, mode, language, word1, word2, userSentence } = event.queryStringParameters;

  try {
    // --- MODE: Full dictionary search (default) ---
    if (!mode || mode === 'search') {
      if (!word) return { statusCode: 400, body: JSON.stringify({ error: "Word parameter is required." }) };
      
      const prompt = `
        Provide a detailed dictionary entry for the word or phrase: "${word}".
        The entire response, including all explanations and section titles, must be strictly in English.

        Include the following sections, labeled EXACTLY as shown with markdown bolding:
        
        **Pronunciation:** [Provide phonetic spelling or IPA here]
        **Definitions:** [List all common meanings with examples for each. All text must be in English.]
        **Synonyms:** [Provide a comma-separated list of English synonyms.]
        **Antonyms:** [Provide a comma-separated list of English antonyms.]
        **Etymology:** [Provide a brief etymology, in English.]
        **Example Sentences:** [List at least 3 diverse example sentences in English.]
        **Turkish Meaning:** [Provide only the direct Turkish translation(s) for "${word}" in this section. No other Turkish text should appear anywhere else in the response.]
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

    // Your other modes (which already look good)
    if (mode === 'eli5') {
        if (!word) return { statusCode: 400, body: JSON.stringify({ error: "Word parameter is required." }) };
        const prompt = `Explain the word "${word}" in one simple sentence that a five-year-old could easily understand.`;
        const result = await model.generateContent(prompt);
        return { statusCode: 200, body: JSON.stringify({ resultText: result.response.text() }) };
    }

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

    // If an invalid mode is received
    return { statusCode: 400, body: JSON.stringify({ error: `Invalid mode specified: ${mode}` }) };

  } catch (error) {
    console.error("API call error:", error);
    return { statusCode: 500, body: JSON.stringify({ error: "Failed to fetch data from APIs. Check the function logs for more details." }) };
  }
};
