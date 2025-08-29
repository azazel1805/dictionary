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

// NEW: Get references to the image elements
const resultImageContainer = document.getElementById('result-image-container');
const resultImage = document.getElementById('result-image');

// Web Speech API
const synth = window.speechSynthesis;

form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const word = input.value.trim();
    if (!word) return;

    // Reset UI
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

    const keys = [
        "Pronunciation", "Definitions", "Synonyms", "Antonyms", 
        "Etymology", "Example Sentences", "Turkish Meaning"
    ];

    keys.forEach(key => {
        const regex = new RegExp(`\\*\\*${key}:\\*\\*\\s*([\\s\\S]*?)(?=\\n\\*\\*|$)`, "is");
        const match = text.match(regex);

        if (match && match[1]) {
            const camelCaseKey = key.charAt(0).toLowerCase() + key.slice(1).replace(/\s(.)/g, (m, char) => char.toUpperCase());
            
            if (sections.hasOwnProperty(camelCaseKey)) {
                 sections[camelCaseKey] = match[1].trim();
            }
        }
    });

    return sections;
}

function displayResults(word, data, imageUrl) {
    // UPDATED: Handle the new image element
    // Check if the imageUrl is the generic default one or a real one.
    if (imageUrl && !imageUrl.includes("1528459801416")) { 
        resultImage.src = imageUrl;
        resultImage.alt = `An image related to the word "${word}"`;
        resultImageContainer.classList.remove('hidden');
    } else {
        resultImageContainer.classList.add('hidden');
    }

    resultWord.textContent = word;

    const formatText = (text) => text.replace(/\*/g, '').replace(/ - /g, '<br>- ').replace(/(\d\.)/g, '<br>$1');
    
    resultPronunciation.textContent = data.pronunciation || "N/A";
    resultDefinitions.innerHTML = formatText(data.definitions || "N/A");
    resultSynonyms.textContent = data.synonyms || "N/A";
    resultAntonyms.textContent = data.antonyms || "N/A";
    resultEtymology.textContent = data.etymology || "N/A";
    resultExamples.innerHTML = formatText(data.exampleSentences || "N/A");
    resultTurkish.textContent = data.turkishMeaning || "N/A";

    speakButton.onclick = () => {
        if (synth.speaking) {
            synth.cancel();
        }
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
