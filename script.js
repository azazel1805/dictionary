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
 * FINAL, ROBUST PARSER (Version 5)
 * This version uses a powerful regular expression to match all known sections
 * and their content, making it immune to ordering issues and internal markdown.
 */
function parseGeminiResponse(text) {
    const sections = {};
    if (!text) return sections;

    const knownHeaders = [
        'Pronunciation', 'Definitions', 'Synonyms', 'Antonyms',
        'Etymology', 'Example Sentences', 'Turkish Meaning'
    ];
    
    // Create a pattern that matches any of the known headers
    const headerPattern = knownHeaders.join('|');
    
    // This regex finds a header and captures all content until the next known header or the end of the string.
    // The "g" flag is crucial for matchAll to find every occurrence.
    const regex = new RegExp(`\\*\\*(${headerPattern}):\\*\\*([\\s\\S]*?)(?=\\s*\\*\\*(${headerPattern}):\\*\\*|$)`, "g");
    
    const matches = [...text.matchAll(regex)];
    
    for (const match of matches) {
        const header = match[1].trim();
        const content = match[2].trim();
        const key = header.toLowerCase().replace(/\s(.)/g, (m, char) => char.toUpperCase());
        sections[key] = content;
    }
    
    // Special case: If Pronunciation was not found as a header,
    // check if there's text before the very first matched section.
    if (!sections.pronunciation && matches.length > 0) {
        const firstMatchIndex = text.indexOf(matches[0][0]);
        if (firstMatchIndex > 0) {
            const potentialPronunciation = text.substring(0, firstMatchIndex).trim();
            if (potentialPronunciation) {
                sections.pronunciation = potentialPronunciation;
            }
        }
    }

    return sections;
}

/**
 * DISPLAY FUNCTION
 * Cleans and formats the parsed content for display.
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

    const formatContent = (content, isList = false) => {
        if (!content || content.trim() === '' || content.trim() === '-') return '<p>N/A</p>';
        
        if (isList) {
            const items = content.split('\n').filter(item => item.trim() !== '');
            if (items.length === 0) return '<p>N/A</p>';
            // Clean up each item and wrap in <li> tags
            return `<ul>${items.map(item => `<li>${item.trim().replace(/^\s*(\*|-|\d+\.)\s*/, '')}</li>`).join('')}</ul>`;
        } else {
            // For single-line content, just put it in a paragraph
            return `<p>${content.replace(/\*/g, '')}</p>`;
        }
    };

    document.querySelector("#pronunciation-section p").innerHTML = data.pronunciation || 'N/A';
    document.querySelector("#definitions-section div").innerHTML = formatContent(data.definitions, true);
    document.querySelector("#synonyms-section p").innerHTML = formatContent(data.synonyms);
    document.querySelector("#antonyms-section p").innerHTML = formatContent(data.antonyms);
    document.querySelector("#etymology-section p").innerHTML = formatContent(data.etymology);
    document.querySelector("#examples-section div").innerHTML = formatContent(data.exampleSentences, true);
    document.querySelector("#turkish-section p").innerHTML = formatContent(data.turkishMeaning);
    
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
