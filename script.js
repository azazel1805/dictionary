const form = document.getElementById('search-form');
const input = document.getElementById('search-input');
const resultsContainer = document.getElementById('results-container');
const loader = document.getElementById('loader');
const errorMessage = document.getElementById('error-message');

// Get references to all result elements
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

// Web Speech API
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
 * NEW, MORE ROBUST PARSER
 * This function is much more flexible and handles variations in the API response.
 */
function parseGeminiResponse(text) {
    const sections = {};
    const lines = text.split('\n').filter(line => line.trim() !== '');

    let currentSection = 'pronunciation'; // Assume the first line(s) are pronunciation
    sections[currentSection] = [];

    for (const line of lines) {
        // Check if the line is a section header (e.g., **Definitions:**)
        const headerMatch = line.match(/^\*\*(.*?):\*\*/);
        if (headerMatch) {
            // Convert header to camelCase (e.g., "Example Sentences" -> "exampleSentences")
            currentSection = headerMatch[1].trim().toLowerCase().replace(/\s(.)/g, (m, char) => char.toUpperCase());
            sections[currentSection] = [];
        } else {
            // If it's not a header, it's content for the current section
            if (!sections[currentSection]) {
                sections[currentSection] = [];
            }
            // Clean up list markers like "1. ", "* ", "- "
            sections[currentSection].push(line.replace(/^\s*(\d+\.|\*|-)\s*/, '').trim());
        }
    }
    
    // Join the array content back into strings
    for (const key in sections) {
        sections[key] = sections[key].join('\n');
    }

    return sections;
}


/**
 * NEW, IMPROVED DISPLAY FUNCTION
 * This now uses a helper to format lists beautifully.
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

    // Helper function to format content into an HTML list
    const formatContentToHTML = (content) => {
        if (!content || content.trim() === '') return '<p>N/A</p>';
        const items = content.split('\n').filter(item => item.trim() !== '');
        // If only one item, just return a paragraph. Otherwise, create a list.
        if (items.length <= 1) return `<p>${items[0] || 'N/A'}</p>`;
        return `<ul>${items.map(item => `<li>${item}</li>`).join('')}</ul>`;
    };

    resultPronunciation.innerHTML = `<p>${data.pronunciation || 'N/A'}</p>`;
    resultDefinitions.innerHTML = formatContentToHTML(data.definitions);
    resultSynonyms.innerHTML = `<p>${data.synonyms || 'N/A'}</p>`;
    resultAntonyms.innerHTML = `<p>${data.antonyms || 'N/A'}</p>`;
    resultEtymology.innerHTML = `<p>${data.etymology || 'N/A'}</p>`;
    resultExamples.innerHTML = formatContentToHTML(data.exampleSentences);
    resultTurkish.innerHTML = `<p>${data.turkishMeaning || 'N/A'}</p>`;

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
