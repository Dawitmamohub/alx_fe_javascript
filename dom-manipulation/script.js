// Configuration
const MOCK_API_URL = 'https://jsonplaceholder.typicode.com/posts'; // Mock API endpoint
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
    
    // Fetch quotes from mock server
    const serverQuotes = await fetchQuotesFromServer();
    
    // Merge with local quotes
    const mergeResult = await syncQuotes(quotes, serverQuotes);
    
    if (mergeResult.conflicts.length > 0) {
      conflicts = mergeResult.conflicts;
      showConflictResolution(conflicts);
      showNotification(`Found ${conflicts.length} conflict(s)`, true);
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
    showNotification('Sync failed. Working offline.', true);
  }
}

// Fetch quotes from mock server
async function fetchQuotesFromServer() {
  try {
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // In a real app, this would fetch from your actual server
    // For demo, we use localStorage to simulate server storage
    const serverData = localStorage.getItem('serverQuotes') || '[]';
    const parsedData = JSON.parse(serverData);
    
    // Simulate occasional server errors
    if (Math.random() < 0.1) throw new Error('Simulated server error');
    
    return parsedData;
  } catch (error) {
    console.error('Failed to fetch quotes:', error);
    throw error;
  }
}

// Post quotes to mock server
async function postQuotesToServer(quotesToPost) {
  try {
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 800));
    
    // Simulate server processing
    const processedQuotes = quotesToPost.map(quote => ({
      ...quote,
      serverVersion: true,
      updatedAt: new Date().toISOString()
    }));
    
    // Simulate occasional server errors
    if (Math.random() < 0.1) throw new Error('Simulated server error');
    
    localStorage.setItem('serverQuotes', JSON.stringify(processedQuotes));
    return processedQuotes;
  } catch (error) {
    console.error('Failed to post quotes:', error);
    throw error;
  }
}

// Synchronize local and server quotes
async function syncQuotes(localQuotes, serverQuotes) {
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
      // Prefer server version by default
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
          <input type="radio" name="resolve-${index}" value="local" ${index === 0 ? 'checked' : ''}>
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
  showNotification(`${conflicts.length} conflicts found. Please resolve.`, true);
}

function resolveConflicts() {
  conflicts.forEach((conflict, index) => {
    const selected = document.querySelector(`input[name="resolve-${index}"]:checked`).value;
    conflict.resolved = selected === 'local' ? conflict.local : conflict.server;
  });
  
  // Apply resolutions
  quotes = quotes.map(quote => {
    const conflict = conflicts.find(c => (c.key === (quote.id || quote.text)));
    return conflict ? conflict.resolved : quote;
  });
  
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
    // Default quotes
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
  // Post to server in background
  postQuotesToServer(quotes).catch(error => {
    console.error('Background sync failed:', error);
  });
}

// ... (remaining functions remain the same as previous implementation)

// Initialize the application
document.addEventListener('DOMContentLoaded', init);