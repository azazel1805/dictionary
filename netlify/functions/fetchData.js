// Import the Google AI SDK
const { GoogleGenerativeAI } = require("@google/generative-ai");

// Access your API keys from environment variables
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const UNSPLASH_ACCESS_KEY = process.env.UNSPLASH_ACCESS_KEY;

// Initialize the Gemini client
const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);

exports.handler = async function (event, context) {
  // Get the word from the query parameter
  const { word } = event.queryStringParameters;

  if (!word) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: "Word parameter is required." }),
    };
  }

  try {
    // --- 1. Fetch data from Gemini API ---
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash-latest" }); 
    const prompt = `
      Provide a detailed dictionary entry for the word or phrase: "${word}"

      Include the following sections clearly labeled EXACTLY as shown:
      - Pronunciation: [Provide phonetic spelling or IPA here, e.g., /prəˌnʌnsiˈeɪʃən/ or pruh-nuhn-see-AY-shuhn]
      - Definitions: [List all common meanings...]
      - Synonyms: [...]
      - Antonyms: [...]
      - Etymology: [...]
      - Example Sentences: [...]
      - Turkish Meaning: [...]
    `;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const dictionaryText = response.text();

    // --- 2. Fetch the TOP RATED background image from Unsplash API ---
    // UPDATED: Changed from /photos/random to /search/photos for better relevance.
    const unsplashUrl = `https://api.unsplash.com/search/photos?query=${word}&per_page=1&orientation=landscape&client_id=${UNSPLASH_ACCESS_KEY}`;
    
    // A nice, neutral default background image
    let imageUrl = "https://images.unsplash.com/photo-1528459801416-a9e53bbf4e17?q=80&w=1912&auto=format&fit=crop"; 

    try {
        const imageResponse = await fetch(unsplashUrl);
        if (imageResponse.ok) {
            const imageData = await imageResponse.json();
            // UPDATED: The response for a search is an object with a 'results' array.
            // We check if the array exists and has at least one item.
            if (imageData.results && imageData.results.length > 0) {
                // We take the URL of the VERY FIRST image in the results.
                imageUrl = imageData.results[0].urls.regular;
            }
        }
    } catch (e) {
        console.error("Unsplash API call failed, using default background.", e);
    }

    // --- 3. Return both results to the frontend ---
    return {
      statusCode: 200,
      body: JSON.stringify({ dictionaryData: dictionaryText, imageUrl: imageUrl }),
    };

  } catch (error) {
    console.error("API call error:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Failed to fetch data from APIs." }),
    };
  }
};
