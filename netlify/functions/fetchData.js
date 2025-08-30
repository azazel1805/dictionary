const { GoogleGenerativeAI } = require("@google/generative-ai");

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const UNSPLASH_ACCESS_KEY = process.env.UNSPLASH_ACCESS_KEY;

const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash-latest" });

exports.handler = async function (event, context) {
  const { word, mode, language, word1, word2, userSentence } = event.queryStringParameters;

  try {
    // --- MODE: Full dictionary search (default) ---
    if (!mode || mode === 'search') {
      if (!word) return { statusCode: 400, body: JSON.stringify({ error: "Word parameter is required." }) };
      const prompt = `
        Provide a detailed dictionary entry for the word or phrase: "${word}"

        Include the following sections clearly labeled EXACTLY as shown with markdown bolding:
        **Pronunciation:** [Provide phonetic spelling or IPA here]
        **Definitions:** [List all common meanings]
        **Synonyms:** [Provide a comma-separated list]
        **Antonyms:** [Provide a comma-separated list]
        **Etymology:** [Provide a brief etymology]
        **Example Sentences:** [List several example sentences]
        **${language || 'Turkish'} Meaning:** [Provide the meaning in ${language || 'Turkish'}]
      `;

      const [geminiResult, imageResponse] = await Promise.all([
        model.generateContent(prompt),
        fetch(`https://api.unsplash.com/search/photos?query=${word}&per_page=1&orientation=landscape&client_id=${UNSPLASH_ACCESS_KEY}`)
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

    // --- MODE: Explain Like I'm 5 ---
    if (mode === 'eli5') {
        if (!word) return { statusCode: 400, body: JSON.stringify({ error: "Word parameter is required." }) };
        const prompt = `Explain the word "${word}" in one simple sentence that a five-year-old could easily understand.`;
        const result = await model.generateContent(prompt);
        return { statusCode: 200, body: JSON.stringify({ resultText: result.response.text() }) };
    }

    // --- MODE: More Examples ---
    if (mode === 'moreExamples') {
        if (!word) return { statusCode: 400, body: JSON.stringify({ error: "Word parameter is required." }) };
        const prompt = `Generate three new and creative example sentences for the word "${word}".`;
        const result = await model.generateContent(prompt);
        return { statusCode: 200, body: JSON.stringify({ resultText: result.response.text() }) };
    }

    // --- NEW MODE: Word vs. Word Comparison ---
    if (mode === 'compare') {
      if (!word1 || !word2) return { statusCode: 400, body: JSON.stringify({ error: "Both words are required for comparison." }) };
      const prompt = `Clearly explain the difference between the words "${word1}" and "${word2}". Provide one example sentence for each to highlight its correct usage. Format the response using markdown for clarity (bolding, lists).`;
      const result = await model.generateContent(prompt);
      return { statusCode: 200, body: JSON.stringify({ resultText: result.response.text() }) };
    }

    // --- NEW MODE: Grammar & Usage Validator ---
    if (mode === 'validate') {
      if (!word || !userSentence) return { statusCode: 400, body: JSON.stringify({ error: "Word and user sentence are required." }) };
      const prompt = `The user wants to use the word "${word}" in this sentence: "${userSentence}". Is this sentence grammatically correct and does it use the word in a natural way? If not, please correct it and provide a one-sentence explanation of the mistake.`;
      const result = await model.generateContent(prompt);
      return { statusCode: 200, body: JSON.stringify({ resultText: result.response.text() }) };
    }

  } catch (error) {
    console.error("API call error:", error);
    return { statusCode: 500, body: JSON.stringify({ error: "Failed to fetch data from APIs." }) };
  }
};
