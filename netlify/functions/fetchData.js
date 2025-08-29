const { GoogleGenerativeAI } = require("@google/generative-ai");

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const UNSPLASH_ACCESS_KEY = process.env.UNSPLASH_ACCESS_KEY;

const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash-latest" });

exports.handler = async function (event, context) {
  // CORRECTION: Ensure language has a default value if not provided.
  const { word, mode, language = 'Turkish' } = event.queryStringParameters;

  if (!word) {
    return { statusCode: 400, body: JSON.stringify({ error: "Word parameter is required." }) };
  }

  try {
    if (!mode || mode === 'search') {
      // CORRECTION: The language variable is now correctly placed in the prompt.
      const prompt = `
        Provide a detailed dictionary entry for the word or phrase: "${word}"

        Include the following sections clearly labeled EXACTLY as shown with markdown bolding:
        **Pronunciation:** [Provide phonetic spelling or IPA here]
        **Definitions:** [List all common meanings]
        **Synonyms:** [Provide a comma-separated list]
        **Antonyms:** [Provide a comma-separated list]
        **Etymology:** [Provide a brief etymology]
        **Example Sentences:** [List several example sentences]
        **${language} Meaning:** [Provide the meaning in ${language}]
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

      return {
        statusCode: 200,
        body: JSON.stringify({ dictionaryData: dictionaryText, imageUrl }),
      };
    }

    if (mode === 'eli5') {
      const prompt = `Explain the word "${word}" in one simple sentence that a five-year-old could easily understand.`;
      const result = await model.generateContent(prompt);
      return {
        statusCode: 200,
        body: JSON.stringify({ resultText: result.response.text() }),
      };
    }

    if (mode === 'moreExamples') {
      const prompt = `Generate three new and creative example sentences for the word "${word}".`;
      const result = await model.generateContent(prompt);
      return {
        statusCode: 200,
        body: JSON.stringify({ resultText: result.response.text() }),
      };
    }

  } catch (error) {
    console.error("API call error:", error);
    return { statusCode: 500, body: JSON.stringify({ error: "Failed to fetch data from APIs." }) };
  }
};
