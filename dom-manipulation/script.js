// Quotes database - will be loaded from local storage
let quotes = [];
let categories = [];

// DOM elements
const quoteDisplay = document.getElementById('quoteDisplay');
const newQuoteBtn = document.getElementById('newQuote');
const showAddFormBtn = document.getElementById('showAddForm');
const addQuoteForm = document.getElementById('addQuoteForm');
const addQuoteBtn = document.getElementById('addQuoteBtn');
const categoryFilter = document.getElementById('categoryFilter');
const activeFilter = document.getElementById('activeFilter');
const exportQuotesBtn = document.getElementById('exportQuotes');
const importQuotesBtn = document.getElementById('importQuotes');
const importFileInput = document.getElementById('importFile');

// Current category filter (null means all categories)
let currentCategory = null;

// Initialize the app
function init() {
  // Load quotes from local storage
  loadQuotes();
  
  // Load last selected filter from local storage
  loadLastFilter();
  
  // Display a random quote on page load
  showRandomQuote();
  
  // Set up event listeners
  newQuoteBtn.addEventListener('click', showRandomQuote);
  showAddFormBtn.addEventListener('click', toggleAddForm);
  addQuoteBtn.addEventListener('click', addQuote);
  exportQuotesBtn.addEventListener('click', exportQuotes);
  importQuotesBtn.addEventListener('click', () => importFileInput.click());
  importFileInput.addEventListener('change', importFromJsonFile);
  categoryFilter.addEventListener('change', filterQuotes);
  
  // Populate categories dropdown
  populateCategories();
  
  // Store the current timestamp in session storage
  sessionStorage.setItem('lastVisit', new Date().toISOString());
}

// Load quotes from local storage
function loadQuotes() {
  const savedQuotes = localStorage.getItem('quotes');
  if (savedQuotes) {
    quotes = JSON.parse(savedQuotes);
    updateCategories();
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
    updateCategories();
  }
}

// Load last selected filter from local storage
function loadLastFilter() {
  const savedFilter = localStorage.getItem('lastFilter');
  if (savedFilter) {
    currentCategory = savedFilter === 'all' ? null : savedFilter;
    categoryFilter.value = savedFilter;
    updateActiveFilterDisplay();
  }
}

// Save quotes to local storage
function saveQuotes() {
  localStorage.setItem('quotes', JSON.stringify(quotes));
}

// Save current filter to local storage
function saveCurrentFilter() {
  const filterValue = currentCategory ? currentCategory : 'all';
  localStorage.setItem('lastFilter', filterValue);
}

// Extract unique categories from quotes
function updateCategories() {
  categories = [...new Set(quotes.map(quote => quote.category))];
  categories.sort();
}

// Populate categories dropdown
function populateCategories() {
  // Clear existing options except the first one
  while (categoryFilter.options.length > 1) {
    categoryFilter.remove(1);
  }
  
  // Add categories to dropdown
  categories.forEach(category => {
    const option = document.createElement('option');
    option.value = category;
    option.textContent = category;
    categoryFilter.appendChild(option);
  });
  
  // Restore selected filter if available
  if (currentCategory && categories.includes(currentCategory)) {
    categoryFilter.value = currentCategory;
  }
}

// Filter quotes based on selected category
function filterQuotes() {
  const selectedValue = categoryFilter.value;
  currentCategory = selectedValue === 'all' ? null : selectedValue;
  
  // Save the current filter
  saveCurrentFilter();
  
  // Update the active filter display
  updateActiveFilterDisplay();
  
  // Show a random quote from the filtered selection
  showRandomQuote();
}

// Update the active filter display
function updateActiveFilterDisplay() {
  if (currentCategory) {
    activeFilter.textContent = currentCategory;
    activeFilter.classList.remove('hidden');
  } else {
    activeFilter.classList.add('hidden');
  }
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
    
    // Update categories
    updateCategories();
    populateCategories();
    
    // Clear the form
    textInput.value = '';
    categoryInput.value = '';
    
    // Hide the form
    addQuoteForm.style.display = 'none';
    
    // Show the new quote
    currentCategory = category;
    categoryFilter.value = category;
    saveCurrentFilter();
    updateActiveFilterDisplay();
    showRandomQuote();
    
    // Show success message
    alert('Quote added successfully!');
  } else {
    alert('Please enter both a quote and a category.');
  }
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
      updateCategories();
      populateCategories();
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