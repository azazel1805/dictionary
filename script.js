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
 * FINAL, ROBUST PARSER (Version 3)
 * This function uses a much more reliable method to extract each section individually.
 * It will not fail if a section is missing or out of order.
 */
function parseGeminiResponse(text) {
    const sections = {
        pronunciation: "N/A",
        definitions: "N/A",
        synonyms: "N/A",
        antonyms: "N/A",
        etymology: "N/A",
        exampleSentences: "N/A",
        turkishMeaning: "N/A",
    };

    // Helper function to extract content for a specific section
    const extractSection = (key) => {
        // This regex finds a header (e.g., **Definitions:**) and captures EVERYTHING
        // until it hits the next header or the end of the text.
        const regex = new RegExp(`\\*\\*${key}:\\*\\*\\s*([\\s\\S]*?)(?=\\n\\*\\*|$)`, "i");
        const match = text.match(regex);
        return match ? match[1].trim() : null;
    };

    // Extract each section using the helper
    sections.definitions = extractSection("Definitions") || sections.definitions;
    sections.synonyms = extractSection("Synonyms") || sections.synonyms;
    sections.antonyms = extractSection("Antonyms") || sections.antonyms;
    sections.etymology = extractSection("Etymology") || sections.etymology;
    sections.exampleSentences = extractSection("Example Sentences") || sections.exampleSentences;
    sections.turkishMeaning = extractSection("Turkish Meaning") || sections.turkishMeaning;

    // Special handling for Pronunciation, which often lacks a header
    const pronunciationMatch = extractSection("Pronunciation");
    if (pronunciationMatch) {
        sections.pronunciation = pronunciationMatch;
    } else {
        // If no header, assume the very first line is the pronunciation,
        // as long as it doesn't look like another section's content.
        const firstLine = text.split('\n')[0].trim();
        if (!firstLine.startsWith('**')) {
            sections.pronunciation = firstLine;
        }
    }

    return sections;
}

/**
 * IMPROVED DISPLAY FUNCTION
 * Correctly formats multi-line content into proper HTML lists.
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

    const formatContentToHTML = (content) => {
        if (!content || content.trim() === 'N/A') return '<p>N/A</p>';
        
        // Remove markdown list markers (*, -, 1.) and clean up lines
        const cleanedContent = content.replace(/(\n\s*(\*|-|\d+\.)\s*)/g, '\n');
        const items = cleanedContent.split('\n').filter(item => item.trim() !== '');

        if (items.length <= 1) return `<p>${items[0] || 'N/A'}</p>`;
        
        // Wrap each item in <li> tags and join into a <ul>
        return `<ul>${items.map(item => `<li>${item.trim()}</li>`).join('')}</ul>`;
    };

    // Use querySelector to ensure we are targeting the correct child element
    document.querySelector("#pronunciation-section p").innerHTML = data.pronunciation || 'N/A';
    document.querySelector("#definitions-section div").innerHTML = formatContentToHTML(data.definitions);
    document.querySelector("#synonyms-section p").innerHTML = data.synonyms || 'N/A';
    document.querySelector("#antonyms-section p").innerHTML = data.antonyms || 'N/A';
    document.querySelector("#etymology-section p").innerHTML = data.etymology || 'N/A';
    document.querySelector("#examples-section div").innerHTML = formatContentToHTML(data.exampleSentences);
    document.querySelector("#turkish-section p").innerHTML = data.turkishMeaning || 'N/A';
    
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
