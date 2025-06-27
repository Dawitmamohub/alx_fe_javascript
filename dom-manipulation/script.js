// Configuration
const API_URL = 'https://jsonplaceholder.typicode.com/posts'; // Mock API endpoint
const SYNC_INTERVAL = 30000; // Sync every 30 seconds
let syncTimer = null;

// State management
let quotes = [];
let categories = [];
let selectedCategory = null;
let lastSyncTime = null;
let pendingChanges = false;
let conflicts = [];

// DOM elements
const elements = {
  quoteDisplay: document.getElementById('quoteDisplay'),
  newQuoteBtn: document.getElementById('newQuote'),
  showAddFormBtn: document.getElementById('showAddForm'),
  addQuoteForm: document.getElementById('addQuoteForm'),
  addQuoteBtn: document.getElementById('addQuoteBtn'),
  categoryFilter: document.getElementById('categoryFilter'),
  activeFilter: document.getElementById('activeFilter'),
  exportQuotesBtn: document.getElementById('exportQuotes'),
  importQuotesBtn: document.getElementById('importQuotes'),
  importFileInput: document.getElementById('importFile'),
  syncStatus: document.getElementById('syncStatus'),
  manualSyncBtn: document.getElementById('manualSync'),
  conflictResolution: document.getElementById('conflictResolution'),
  conflictItems: document.getElementById('conflictItems'),
  resolveConflictsBtn: document.getElementById('resolveConflicts')
};

// Initialize the app
function init() {
  loadQuotes();
  loadLastFilter();
  showRandomQuote();
  setupEventListeners();
  populateCategories();
  initSync();
  sessionStorage.setItem('lastVisit', new Date().toISOString());
}

function setupEventListeners() {
  elements.newQuoteBtn.addEventListener('click', showRandomQuote);
  elements.showAddFormBtn.addEventListener('click', toggleAddForm);
  elements.addQuoteBtn.addEventListener('click', addQuote);
  elements.exportQuotesBtn.addEventListener('click', exportQuotes);
  elements.importQuotesBtn.addEventListener('click', () => elements.importFileInput.click());
  elements.importFileInput.addEventListener('change', importFromJsonFile);
  elements.categoryFilter.addEventListener('change', filterQuotes);
  elements.manualSyncBtn.addEventListener('click', syncWithServer);
  elements.resolveConflictsBtn.addEventListener('click', resolveConflicts);
  window.addEventListener('focus', syncWithServer);
}

// Server Sync Functions
function initSync() {
  syncWithServer();
  syncTimer = setInterval(syncWithServer, SYNC_INTERVAL);
}

async function syncWithServer() {
  try {
    updateSyncStatus('Syncing with server...');
    
    const serverQuotes = await fetchServerQuotes();
    const mergeResult = mergeQuotes(quotes, serverQuotes);
    
    if (mergeResult.conflicts.length > 0) {
      conflicts = mergeResult.conflicts;
      showConflictResolution(conflicts);
    }
    
    if (mergeResult.updated) {
      quotes = mergeResult.mergedQuotes;
      saveQuotes();
      updateCategories();
      populateCategories();
      showRandomQuote();
      
      if (mergeResult.conflicts.length === 0) {
        showNotification('Quotes updated from server');
      }
    }
    
    lastSyncTime = new Date();
    pendingChanges = false;
    updateSyncStatus(`Last synced: ${lastSyncTime.toLocaleTimeString()}`);
  } catch (error) {
    console.error('Sync failed:', error);
    updateSyncStatus('Sync failed - will retry', true);
  }
}

async function fetchServerQuotes() {
  // Simulate network delay
  await new Promise(resolve => setTimeout(resolve, 500));
  
  // In a real app, this would fetch from your actual server
  const serverData = localStorage.getItem('serverQuotes') || '[]';
  return JSON.parse(serverData);
}

async function postQuotesToServer(quotesToPost) {
  // Simulate server delay
  await new Promise(resolve => setTimeout(resolve, 800));
  
  // Simulate server processing
  const processedQuotes = quotesToPost.map(quote => ({
    ...quote,
    serverVersion: true,
    updatedAt: new Date().toISOString()
  }));
  
  localStorage.setItem('serverQuotes', JSON.stringify(processedQuotes));
  return processedQuotes;
}

function mergeQuotes(localQuotes, serverQuotes) {
  const mergedQuotes = [];
  const newConflicts = [];
  const allQuotes = [...localQuotes, ...serverQuotes];
  const quoteMap = new Map();

  allQuotes.forEach(quote => {
    const key = quote.id || quote.text;
    if (!quoteMap.has(key)) {
      quoteMap.set(key, quote);
    } else {
      const existing = quoteMap.get(key);
      if (JSON.stringify(existing) !== JSON.stringify(quote)) {
        newConflicts.push({
          key,
          local: existing.serverVersion ? quote : existing,
          server: existing.serverVersion ? existing : quote,
          resolved: null
        });
      }
      // Prefer server version in case of conflict
      quoteMap.set(key, existing.serverVersion ? existing : quote);
    }
  });

  quoteMap.forEach(quote => mergedQuotes.push(quote));

  return {
    mergedQuotes,
    conflicts: newConflicts,
    updated: newConflicts.length > 0 || serverQuotes.length !== localQuotes.length
  };
}

// Conflict Resolution
function showConflictResolution(conflicts) {
  elements.conflictItems.innerHTML = '';
  
  conflicts.forEach((conflict, index) => {
    const conflictEl = document.createElement('div');
    conflictEl.className = 'conflict-item';
    conflictEl.innerHTML = `
      <h4>Conflict #${index + 1}</h4>
      <div>
        <p><strong>Local Version:</strong> "${conflict.local.text}" (${conflict.local.category})</p>
        <p><strong>Server Version:</strong> "${conflict.server.text}" (${conflict.server.category})</p>
      </div>
      <div>
        <label>
          <input type="radio" name="resolve-${index}" value="local" checked>
          Keep local version
        </label>
        <label>
          <input type="radio" name="resolve-${index}" value="server">
          Use server version
        </label>
      </div>
    `;
    elements.conflictItems.appendChild(conflictEl);
  });
  
  elements.conflictResolution.classList.remove('hidden');
}

function resolveConflicts() {
  conflicts.forEach((conflict, index) => {
    const selected = document.querySelector(`input[name="resolve-${index}"]:checked`).value;
    conflict.resolved = selected === 'local' ? conflict.local : conflict.server;
  });
  
  // Apply resolutions
  const resolvedQuotes = quotes.map(quote => {
    const conflict = conflicts.find(c => (c.key === (quote.id || quote.text)));
    return conflict ? conflict.resolved : quote;
  });
  
  quotes = resolvedQuotes;
  conflicts = [];
  saveQuotes();
  updateCategories();
  populateCategories();
  elements.conflictResolution.classList.add('hidden');
  showNotification('Conflicts resolved successfully');
}

// Quote Management
function loadQuotes() {
  const savedQuotes = localStorage.getItem('quotes');
  if (savedQuotes) {
    quotes = JSON.parse(savedQuotes);
    updateCategories();
  } else {
    quotes = [
      { id: 1, text: "The only way to do great work is to love what you do.", category: "Inspiration" },
      { id: 2, text: "Innovation distinguishes between a leader and a follower.", category: "Business" },
      { id: 3, text: "Your time is limited, don't waste it living someone else's life.", category: "Life" },
      { id: 4, text: "Stay hungry, stay foolish.", category: "Inspiration" },
      { id: 5, text: "The greatest glory in living lies not in never falling, but in rising every time we fall.", category: "Perseverance" },
      { id: 6, text: "The way to get started is to quit talking and begin doing.", category: "Productivity" }
    ];
    saveQuotes();
    updateCategories();
  }
}

function saveQuotes() {
  localStorage.setItem('quotes', JSON.stringify(quotes));
  pendingChanges = true;
  postQuotesToServer(quotes);
}

function loadLastFilter() {
  const savedFilter = localStorage.getItem('lastFilter');
  if (savedFilter && savedFilter !== 'all') {
    selectedCategory = savedFilter;
    elements.categoryFilter.value = savedFilter;
    updateActiveFilterDisplay();
  }
}

function updateCategories() {
  categories = [...new Set(quotes.map(quote => quote.category))];
  categories.sort();
}

function populateCategories() {
  while (elements.categoryFilter.options.length > 1) {
    elements.categoryFilter.remove(1);
  }
  
  categories.forEach(category => {
    const option = document.createElement('option');
    option.value = category;
    option.textContent = category;
    elements.categoryFilter.appendChild(option);
  });
  
  if (selectedCategory && categories.includes(selectedCategory)) {
    elements.categoryFilter.value = selectedCategory;
  }
}

// UI Functions
function showRandomQuote() {
  const filteredQuotes = selectedCategory 
    ? quotes.filter(quote => quote.category === selectedCategory)
    : quotes;
  
  if (filteredQuotes.length === 0) {
    elements.quoteDisplay.innerHTML = `
      <p class="quote-text">No quotes found in this category.</p>
      <p class="quote-category"></p>
    `;
    return;
  }
  
  const randomIndex = Math.floor(Math.random() * filteredQuotes.length);
  const quote = filteredQuotes[randomIndex];
  
  elements.quoteDisplay.innerHTML = `
    <p class="quote-text">"${quote.text}"</p>
    <p class="quote-category">— ${quote.category}</p>
  `;
  
  sessionStorage.setItem('lastViewedQuote', JSON.stringify(quote));
}

function filterQuotes() {
  const selectedValue = elements.categoryFilter.value;
  selectedCategory = selectedValue === 'all' ? null : selectedValue;
  localStorage.setItem('lastFilter', selectedCategory || 'all');
  updateActiveFilterDisplay();
  showRandomQuote();
}

function updateActiveFilterDisplay() {
  if (selectedCategory) {
    elements.activeFilter.textContent = selectedCategory;
    elements.activeFilter.classList.remove('hidden');
  } else {
    elements.activeFilter.classList.add('hidden');
  }
}

function toggleAddForm() {
  elements.addQuoteForm.style.display = elements.addQuoteForm.style.display === 'none' ? 'block' : 'none';
}

function addQuote() {
  const text = elements.newQuoteText.value.trim();
  const category = elements.newQuoteCategory.value.trim();
  
  if (text && category) {
    const newQuote = {
      id: Date.now(), // Simple ID generation
      text,
      category,
      createdAt: new Date().toISOString()
    };
    
    quotes.push(newQuote);
    saveQuotes();
    updateCategories();
    populateCategories();
    
    elements.newQuoteText.value = '';
    elements.newQuoteCategory.value = '';
    elements.addQuoteForm.style.display = 'none';
    
    selectedCategory = category;
    elements.categoryFilter.value = category;
    localStorage.setItem('lastFilter', category);
    updateActiveFilterDisplay();
    showRandomQuote();
    
    showNotification('Quote added successfully');
  } else {
    showNotification('Please enter both a quote and a category', true);
  }
}

function exportQuotes() {
  const dataStr = JSON.stringify(quotes, null, 2);
  const dataBlob = new Blob([dataStr], { type: 'application/json' });
  const url = URL.createObjectURL(dataBlob);
  
  const link = document.createElement('a');
  link.href = url;
  link.download = `quotes-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  
  setTimeout(() => URL.revokeObjectURL(url), 100);
}

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
      
      const validQuotes = importedQuotes.filter(quote => 
        quote.text && quote.category &&
        typeof quote.text === 'string' && 
        typeof quote.category === 'string'
      );
      
      if (validQuotes.length === 0) {
        throw new Error('No valid quotes found in the file');
      }
      
      quotes.push(...validQuotes);
      saveQuotes();
      updateCategories();
      populateCategories();
      showRandomQuote();
      
      event.target.value = '';
      showNotification(`Successfully imported ${validQuotes.length} quotes!`);
    } catch (error) {
      showNotification('Error importing quotes: ' + error.message, true);
      console.error('Import error:', error);
    }
  };
  fileReader.readAsText(file);
}

function updateSyncStatus(message, isError = false) {
  elements.syncStatus.textContent = message;
  elements.syncStatus.style.backgroundColor = isError ? '#ffdddd' : '#ddffdd';
}

function showNotification(message, isWarning = false) {
  const notification = document.createElement('div');
  notification.className = `notification ${isWarning ? 'notification-warning' : 'notification-success'}`;
  notification.textContent = message;
  
  document.body.appendChild(notification);
  
  setTimeout(() => {
    notification.style.transition = 'opacity 1s';
    notification.style.opacity = '0';
    setTimeout(() => notification.remove(), 1000);
  }, 3000);
}

// Initialize the application
document.addEventListener('DOMContentLoaded', init);