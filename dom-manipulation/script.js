// Quotes database - will be loaded from local storage
let quotes = [];

// DOM elements
const quoteDisplay = document.getElementById('quoteDisplay');
const newQuoteBtn = document.getElementById('newQuote');
const showAddFormBtn = document.getElementById('showAddForm');
const addQuoteForm = document.getElementById('addQuoteForm');
const addQuoteBtn = document.getElementById('addQuoteBtn');
const categoryButtonsContainer = document.getElementById('categoryButtons');
const exportQuotesBtn = document.getElementById('exportQuotes');
const importQuotesBtn = document.getElementById('importQuotes');
const importFileInput = document.getElementById('importFile');

// Current category filter (null means all categories)
let currentCategory = null;

// Initialize the app
function init() {
  // Load quotes from local storage
  loadQuotes();
  
  // Display a random quote on page load
  showRandomQuote();
  
  // Set up event listeners
  newQuoteBtn.addEventListener('click', showRandomQuote);
  showAddFormBtn.addEventListener('click', toggleAddForm);
  addQuoteBtn.addEventListener('click', addQuote);
  exportQuotesBtn.addEventListener('click', exportQuotes);
  importQuotesBtn.addEventListener('click', () => importFileInput.click());
  importFileInput.addEventListener('change', importFromJsonFile);
  
  // Generate category buttons
  updateCategoryButtons();
  
  // Store the current timestamp in session storage
  sessionStorage.setItem('lastVisit', new Date().toISOString());
  
  // Display last visit time if available
  const lastVisit = sessionStorage.getItem('lastVisit');
  if (lastVisit) {
    console.log('Last visit:', new Date(lastVisit).toLocaleString());
  }
}

// Load quotes from local storage
function loadQuotes() {
  const savedQuotes = localStorage.getItem('quotes');
  if (savedQuotes) {
    quotes = JSON.parse(savedQuotes);
  } else {
    // Default quotes if none are saved
    quotes = [
      { text: "The only way to do great work is to love what you do.", category: "Inspiration" },
      { text: "Innovation distinguishes between a leader and a follower.", category: "Business" },
      { text: "Your time is limited, don't waste it living someone else's life.", category: "Life" },
      { text: "Stay hungry, stay foolish.", category: "Inspiration" },
      { text: "The greatest glory in living lies not in never falling, but in rising every time we fall.", category: "Perseverance" },
      { text: "The way to get started is to quit talking and begin doing.", category: "Productivity" }
    ];
    saveQuotes();
  }
}

// Save quotes to local storage
function saveQuotes() {
  localStorage.setItem('quotes', JSON.stringify(quotes));
}

// Display a random quote
function showRandomQuote() {
  let filteredQuotes = currentCategory 
    ? quotes.filter(quote => quote.category === currentCategory)
    : quotes;
  
  if (filteredQuotes.length === 0) {
    quoteDisplay.innerHTML = `
      <p class="quote-text">No quotes found in this category.</p>
      <p class="quote-category"></p>
    `;
    return;
  }
  
  const randomIndex = Math.floor(Math.random() * filteredQuotes.length);
  const quote = filteredQuotes[randomIndex];
  
  quoteDisplay.innerHTML = `
    <p class="quote-text">"${quote.text}"</p>
    <p class="quote-category">— ${quote.category}</p>
  `;
  
  // Store the last viewed quote in session storage
  sessionStorage.setItem('lastViewedQuote', JSON.stringify(quote));
}

// Toggle the add quote form visibility
function toggleAddForm() {
  addQuoteForm.style.display = addQuoteForm.style.display === 'none' ? 'block' : 'none';
}

// Add a new quote to the database
function addQuote() {
  const textInput = document.getElementById('newQuoteText');
  const categoryInput = document.getElementById('newQuoteCategory');
  
  const text = textInput.value.trim();
  const category = categoryInput.value.trim();
  
  if (text && category) {
    // Add the new quote
    quotes.push({ text, category });
    
    // Save to local storage
    saveQuotes();
    
    // Clear the form
    textInput.value = '';
    categoryInput.value = '';
    
    // Hide the form
    addQuoteForm.style.display = 'none';
    
    // Update category buttons
    updateCategoryButtons();
    
    // Show the new quote
    currentCategory = category;
    showRandomQuote();
    
    // Show success message
    alert('Quote added successfully!');
  } else {
    alert('Please enter both a quote and a category.');
  }
}

// Update the category filter buttons
function updateCategoryButtons() {
  // Get all unique categories
  const categories = [...new Set(quotes.map(quote => quote.category))];
  
  // Clear existing buttons
  categoryButtonsContainer.innerHTML = '';
  
  // Add "All" button
  const allButton = document.createElement('button');
  allButton.textContent = 'All';
  allButton.className = !currentCategory ? 'category-btn active-category' : 'category-btn';
  allButton.addEventListener('click', () => {
    currentCategory = null;
    updateCategoryButtons();
    showRandomQuote();
  });
  categoryButtonsContainer.appendChild(allButton);
  
  // Add buttons for each category
  categories.forEach(category => {
    const button = document.createElement('button');
    button.textContent = category;
    button.className = currentCategory === category ? 'category-btn active-category' : 'category-btn';
    button.addEventListener('click', () => {
      currentCategory = category;
      updateCategoryButtons();
      showRandomQuote();
    });
    categoryButtonsContainer.appendChild(button);
  });
}

// Export quotes to JSON file
function exportQuotes() {
  const dataStr = JSON.stringify(quotes, null, 2);
  const dataBlob = new Blob([dataStr], { type: 'application/json' });
  const url = URL.createObjectURL(dataBlob);
  
  const link = document.createElement('a');
  link.href = url;
  link.download = 'quotes-' + new Date().toISOString().slice(0, 10) + '.json';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  
  // Clean up
  setTimeout(() => URL.revokeObjectURL(url), 100);
}

// Import quotes from JSON file
function importFromJsonFile(event) {
  const file = event.target.files[0];
  if (!file) return;
  
  const fileReader = new FileReader();
  fileReader.onload = function(e) {
    try {
      const importedQuotes = JSON.parse(e.target.result);
      
      if (!Array.isArray(importedQuotes)) {
        throw new Error('Invalid format: Expected an array of quotes');
      }
      
      // Validate each quote
      const validQuotes = importedQuotes.filter(quote => 
        quote.text && quote.category &&
        typeof quote.text === 'string' && 
        typeof quote.category === 'string'
      );
      
      if (validQuotes.length === 0) {
        throw new Error('No valid quotes found in the file');
      }
      
      // Add the new quotes
      quotes.push(...validQuotes);
      saveQuotes();
      updateCategoryButtons();
      showRandomQuote();
      
      // Reset file input
      event.target.value = '';
      
      alert(`Successfully imported ${validQuotes.length} quotes!`);
    } catch (error) {
      alert('Error importing quotes: ' + error.message);
      console.error('Import error:', error);
    }
  };
  fileReader.readAsText(file);
}

// Initialize the application when the DOM is loaded
document.addEventListener('DOMContentLoaded', init);