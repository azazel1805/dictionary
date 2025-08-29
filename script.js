document.addEventListener('DOMContentLoaded', () => {
    // --- ELEMENT REFERENCES ---
    const form = document.getElementById('search-form');
    const input = document.getElementById('search-input');
    const resultsContainer = document.getElementById('results-container');
    const loader = document.getElementById('loader');
    const errorMessage = document.getElementById('error-message');
    const languageSelect = document.getElementById('language-select');

    const resultWord = document.getElementById('result-word');
    const resultPronunciation = document.getElementById('result-pronunciation');
    const resultDefinitions = document.getElementById('result-definitions');
    const resultSynonyms = document.getElementById('result-synonyms');
    const resultAntonyms = document.getElementById('result-antonyms');
    const resultEtymology = document.getElementById('result-etymology');
    const resultExamples = document.getElementById('result-examples');
    const languageTitle = document.getElementById('language-title');
    const resultLanguage = document.getElementById('result-language');
    
    const speakButton = document.getElementById('speak-button');
    const eli5Button = document.getElementById('eli5-button');
    const moreExamplesButton = document.getElementById('more-examples-button');

    const resultImageContainer = document.getElementById('result-image-container');
    const resultImage = document.getElementById('result-image');
    
    const historyContainer = document.getElementById('history-container');
    const historyList = document.getElementById('history-list');

    const synth = window.speechSynthesis;
    let currentWord = '';

    // --- INITIALIZATION ---
    renderHistory();
    fetchWordOfTheDay();

    // --- EVENT LISTENERS ---
    form.addEventListener('submit', (e) => {
        e.preventDefault();
        const word = input.value.trim();
        if (word) {
            performSearch(word);
        }
    });

    eli5Button.addEventListener('click', () => fetchExtraData('eli5'));
    moreExamplesButton.addEventListener('click', () => fetchExtraData('moreExamples'));

    // --- CORE FUNCTIONS ---
    async function performSearch(word) {
        currentWord = word;
        input.value = word; // Update input box in case search was triggered by history/synonym
        resultsContainer.classList.remove('visible');
        resultsContainer.classList.add('hidden');
        errorMessage.classList.add('hidden');
        loader.classList.remove('hidden');
        
        try {
            const selectedLanguage = languageSelect.value;
            const response = await fetch(`/.netlify/functions/fetchData?word=${encodeURIComponent(word)}&language=${selectedLanguage}`);

            if (!response.ok) throw new Error(`Server error: ${response.statusText}`);
            
            const data = await response.json();
            const parsedData = parseGeminiResponse(data.dictionaryData);
            
            displayResults(word, parsedData, data.imageUrl);
            saveHistory(word);
            renderHistory();

        } catch (error) {
            console.error("Error fetching data:", error);
            showError("Sorry, something went wrong. Please try again.");
        } finally {
            loader.classList.add('hidden');
        }
    }
    
    async function fetchExtraData(mode) {
        const button = mode === 'eli5' ? eli5Button : moreExamplesButton;
        const originalText = button.textContent;
        button.textContent = 'Loading...';
        button.disabled = true;

        try {
            const response = await fetch(`/.netlify/functions/fetchData?word=${encodeURIComponent(currentWord)}&mode=${mode}`);
            if (!response.ok) throw new Error('Failed to fetch extra data');
            
            const data = await response.json();
            if (mode === 'eli5') {
                resultDefinitions.innerHTML = `<p><strong>Simple Version:</strong> ${data.resultText}</p>`;
            } else if (mode === 'moreExamples') {
                const newExamples = data.resultText.split('\n').filter(item => item.trim() !== '');
                const list = resultExamples.querySelector('ul');
                newExamples.forEach(ex => {
                    const li = document.createElement('li');
                    li.textContent = ex.replace(/^\s*(\*|-|\d+\.)\s*/, '');
                    list.appendChild(li);
                });
            }
        } catch (error) {
            console.error(`Error in ${mode}:`, error);
        } finally {
            button.textContent = originalText;
            button.disabled = false;
        }
    }

    function parseGeminiResponse(text) {
        const sections = {};
        if (!text) return sections;

        const knownHeaders = ['Pronunciation', 'Definitions', 'Synonyms', 'Antonyms', 'Etymology', 'Example Sentences', languageSelect.value + ' Meaning'];
        const headerPattern = knownHeaders.join('|').replace(/ /g, '\\s');
        const regex = new RegExp(`\\*\\*(${headerPattern}):\\*\\*([\\s\\S]*?)(?=\\s*\\*\\*(${headerPattern}):\\*\\*|$)`, "g");
        
        const matches = [...text.matchAll(regex)];
        
        for (const match of matches) {
            let header = match[1].trim();
            const content = match[2].trim();
            if (header.includes('Meaning')) header = 'languageMeaning'; // Generic key for translation
            const key = header.toLowerCase().replace(/\s(.)/g, (m, char) => char.toUpperCase());
            sections[key] = content;
        }
        
        if (!sections.pronunciation && matches.length > 0) {
            const firstMatchIndex = text.indexOf(matches[0][0]);
            if (firstMatchIndex > 0) {
                const potentialPronunciation = text.substring(0, firstMatchIndex).trim();
                if (potentialPronunciation) sections.pronunciation = potentialPronunciation;
            }
        }
        return sections;
    }

    function displayResults(word, data, imageUrl) {
        // Handle Image
        if (imageUrl) {
            resultImage.src = imageUrl;
            resultImage.alt = `An image related to the word "${word}"`;
            resultImageContainer.classList.remove('hidden');
        } else {
            resultImageContainer.classList.add('hidden');
        }

        // Set Text Content
        resultWord.textContent = word;
        resultPronunciation.textContent = data.pronunciation || 'N/A';
        resultEtymology.textContent = data.etymology || 'N/A';
        
        // Handle Language Section
        const selectedLanguage = languageSelect.value;
        languageTitle.textContent = `${selectedLanguage} Meaning:`;
        resultLanguage.textContent = data.languageMeaning || 'N/A';
        
        // Handle Content Requiring HTML Formatting
        resultDefinitions.innerHTML = formatContent(data.definitions, true);
        resultExamples.innerHTML = formatContent(data.exampleSentences, true);
        
        // Handle Clickable Synonyms/Antonyms
        createClickableItems(resultSynonyms, data.synonyms);
        createClickableItems(resultAntonyms, data.antonyms);

        // Setup Speak Button
        speakButton.onclick = () => {
            if (synth.speaking) synth.cancel();
            const utterance = new SpeechSynthesisUtterance(word);
            utterance.lang = 'en-US';
            synth.speak(utterance);
        };

        // Show results with animation
        resultsContainer.classList.remove('hidden');
        setTimeout(() => resultsContainer.classList.add('visible'), 10);
    }
    
    // --- HELPER FUNCTIONS ---
    function formatContent(content, isList = false) {
        if (!content || content.trim() === '' || content.trim() === '-') return '<p>N/A</p>';
        if (isList) {
            const items = content.split('\n').filter(item => item.trim() !== '');
            return `<ul>${items.map(item => `<li>${item.trim().replace(/^\s*(\*|-|\d+\.)\s*/, '')}</li>`).join('')}</ul>`;
        }
        return `<p>${content}</p>`;
    }
    
    function createClickableItems(container, text) {
        container.innerHTML = ''; // Clear previous content
        if (!text || text.trim() === 'N/A' || text.trim() === '-') {
            container.innerHTML = '<p>N/A</p>';
            return;
        }
        const items = text.split(',').map(item => item.trim()).filter(Boolean);
        items.forEach(item => {
            const button = document.createElement('button');
            button.textContent = item;
            button.onclick = () => performSearch(item);
            container.appendChild(button);
        });
    }

    function showError(message) {
        errorMessage.textContent = message;
        errorMessage.classList.remove('hidden');
    }

    // --- WORD OF THE DAY & HISTORY ---
    function fetchWordOfTheDay() {
        const words = ['serendipity', 'ephemeral', 'ubiquitous', 'mellifluous', 'petrichor', 'sonder', 'eloquence'];
        const randomWord = words[Math.floor(Math.random() * words.length)];
        performSearch(randomWord);
    }

    function getHistory() {
        return JSON.parse(localStorage.getItem('searchHistory')) || [];
    }
    
    function saveHistory(word) {
        let history = getHistory();
        const lowerCaseWord = word.toLowerCase();
        // Remove existing instance to move it to the front
        history = history.filter(item => item.toLowerCase() !== lowerCaseWord);
        // Add new word to the front
        history.unshift(word);
        // Keep only the last 10
        if (history.length > 10) history.pop();
        localStorage.setItem('searchHistory', JSON.stringify(history));
    }

    function renderHistory() {
        historyList.innerHTML = '';
        const history = getHistory();
        if (history.length > 0) {
            historyContainer.classList.remove('hidden');
            history.forEach(word => {
                const item = document.createElement('button');
                item.className = 'history-item';
                item.textContent = word;
                item.onclick = () => performSearch(word);
                historyList.appendChild(item);
            });
        } else {
            historyContainer.classList.add('hidden');
        }
    }
});
