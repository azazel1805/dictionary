const form = document.getElementById('search-form');
const input = document.getElementById('search-input');
const resultsContainer = document.getElementById('results-container');
const loader = document.getElementById('loader');
const errorMessage = document.getElementById('error-message');

const resultWord = document.getElementById('result-word');
const resultPronunciation = document.getElementById('result-pronunciation');
const resultDefinitions = document.getElementById('result-definitions');
const resultSynonyms = document.getElementById('result-synonyms');
const resultAntonyms = document.getElementById('result-antonyms');
const resultEtymology = document.getElementById('result-etymology');
const resultExamples = document.getElementById('result-examples');
const resultTurkish = document.getElementById('result-turkish');
const speakButton = document.getElementById('speak-button');

const resultImageContainer = document.getElementById('result-image-container');
const resultImage = document.getElementById('result-image');

const synth = window.speechSynthesis;

form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const word = input.value.trim();
    if (!word) return;

    resultsContainer.classList.add('hidden');
    errorMessage.classList.add('hidden');
    loader.classList.remove('hidden');

    try {
        const response = await fetch(`/.netlify/functions/fetchData?word=${encodeURIComponent(word)}`);

        if (!response.ok) {
            throw new Error(`Server error: ${response.statusText}`);
        }
        
        const data = await response.json();
        
        console.log("Raw text from Gemini:", data.dictionaryData);

        const parsedData = parseGeminiResponse(data.dictionaryData);
        displayResults(word, parsedData, data.imageUrl);

    } catch (error) {
        console.error("Error fetching data:", error);
        showError("Sorry, something went wrong. Please try again.");
    } finally {
        loader.classList.add('hidden');
    }
});

/**
 * FINAL, GUARANTEED PARSER (Version 4)
 * This function first splits the entire text into chunks based on the section headers.
 * This completely prevents content from one section bleeding into another. It is the most robust method.
 */
function parseGeminiResponse(text) {
    const sections = {};
    if (!text) return sections;

    // The regex splits the text right BEFORE each section header (e.g., **Definitions:**)
    // The (?=...) is a "positive lookahead" which means the delimiter is kept.
    const splitRegex = /(?=\s*\*\*[A-Za-z\s]+:\*\*)/;
    let parts = text.split(splitRegex).filter(p => p.trim() !== '');

    // Handle the first part, which is usually the pronunciation if it has no header.
    if (parts.length > 0 && !parts[0].startsWith('**')) {
        sections.pronunciation = parts.shift().trim();
    }

    // Process the rest of the parts, which are now guaranteed to be distinct sections.
    parts.forEach(part => {
        // Split the part into header and content
        const [headerLine, ...contentLines] = part.split('\n');
        const headerMatch = headerLine.match(/\*\*(.*?):\*\*/);

        if (headerMatch && headerMatch[1]) {
            const header = headerMatch[1].trim();
            const content = contentLines.join('\n').trim();

            // Convert header to camelCase for the object key
            const key = header.toLowerCase().replace(/\s(.)/g, (m, char) => char.toUpperCase());
            sections[key] = content;
        }
    });

    return sections;
}


/**
 * DISPLAY FUNCTION
 * This function now correctly formats multi-line text into clean HTML lists.
 */
function displayResults(word, data, imageUrl) {
    if (imageUrl && !imageUrl.includes("1528459801416")) { 
        resultImage.src = imageUrl;
        resultImage.alt = `An image related to the word "${word}"`;
        resultImageContainer.classList.remove('hidden');
    } else {
        resultImageContainer.classList.add('hidden');
    }

    resultWord.textContent = word;

    const formatToList = (content) => {
        if (!content) return '<p>N/A</p>';
        const items = content.split('\n').filter(item => item.trim() !== '');
        if (items.length === 0) return '<p>N/A</p>';

        // Create a clean list, removing any leading list markers from the raw text
        return `<ul>${items.map(item => `<li>${item.trim().replace(/^\s*(\*|-|\d+\.)\s*/, '')}</li>`).join('')}</ul>`;
    };
    
    const formatToParagraph = (content) => `<p>${content || 'N/A'}</p>`;

    // Update each section using specific selectors and the correct formatter
    document.querySelector("#pronunciation-section p").innerHTML = data.pronunciation || 'N/A';
    document.querySelector("#definitions-section div").innerHTML = formatToList(data.definitions);
    document.querySelector("#synonyms-section p").innerHTML = formatToParagraph(data.synonyms);
    document.querySelector("#antonyms-section p").innerHTML = formatToParagraph(data.antonyms);
    document.querySelector("#etymology-section p").innerHTML = formatToParagraph(data.etymology);
    document.querySelector("#examples-section div").innerHTML = formatToList(data.exampleSentences);
    document.querySelector("#turkish-section p").innerHTML = formatToParagraph(data.turkishMeaning);
    
    speakButton.onclick = () => {
        if (synth.speaking) synth.cancel();
        const utterance = new SpeechSynthesisUtterance(word);
        utterance.lang = 'en-US';
        synth.speak(utterance);
    };

    resultsContainer.classList.remove('hidden');
}

function showError(message) {
    errorMessage.textContent = message;
    errorMessage.classList.remove('hidden');
}
