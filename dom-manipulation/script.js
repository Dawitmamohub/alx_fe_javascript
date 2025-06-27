// Initial quotes database
let quotes = [
  { text: "The only way to do great work is to love what you do.", category: "Inspiration" },
  { text: "Innovation distinguishes between a leader and a follower.", category: "Business" },
  { text: "Your time is limited, don't waste it living someone else's life.", category: "Life" },
  { text: "Stay hungry, stay foolish.", category: "Inspiration" },
  { text: "The greatest glory in living lies not in never falling, but in rising every time we fall.", category: "Perseverance" },
  { text: "The way to get started is to quit talking and begin doing.", category: "Productivity" }
];

// DOM elements
const quoteDisplay = document.getElementById('quoteDisplay');
const newQuoteBtn = document.getElementById('newQuote');
const showAddFormBtn = document.getElementById('showAddForm');
const addQuoteForm = document.getElementById('addQuoteForm');
const categoryButtonsContainer = document.getElementById('categoryButtons');

// Current category filter (null means all categories)
let currentCategory = null;

// Initialize the app
function init() {
  // Display a random quote on page load
  showRandomQuote();
  
  // Set up event listeners
  newQuoteBtn.addEventListener('click', showRandomQuote);
  showAddFormBtn.addEventListener('click', toggleAddForm);
  
  // Generate category buttons
  updateCategoryButtons();
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
    
    // Clear the form
    textInput.value = '';
    categoryInput.value = '';
    
    // Hide the form
    addQuoteForm.style.display = 'none';
    
    // Update category buttons
    updateCategoryButtons();
    
    // Show the new quote
    showRandomQuote();
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

// Initialize the application when the DOM is loaded
document.addEventListener('DOMContentLoaded', init);