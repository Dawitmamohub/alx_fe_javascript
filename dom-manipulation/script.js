// Configuration
const SYNC_INTERVAL = 30000; // Sync every 30 seconds
const SERVER_STORAGE_KEY = 'serverQuotes';
const LOCAL_STORAGE_KEY = 'quotes';
let syncTimer = null;

// Application State
let quotes = [];
let categories = [];
let selectedCategory = null;
let lastSyncTime = null;
let pendingChanges = false;
let conflicts = [];

// DOM Elements
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

// Initialize the application
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

// Server Synchronization Functions
function initSync() {
  // Initialize server with default quotes if empty
  if (!localStorage.getItem(SERVER_STORAGE_KEY)) {
    localStorage.setItem(SERVER_STORAGE_KEY, JSON.stringify([
      { id: 1, text: "The only way to do great work is to love what you do.", category: "Inspiration", serverVersion: true, updatedAt: new Date().toISOString() },
      { id: 2, text: "Innovation distinguishes between a leader and a follower.", category: "Business", serverVersion: true, updatedAt: new Date().toISOString() }
    ]));
  }
  
  syncWithServer();
  syncTimer = setInterval(syncWithServer, SYNC_INTERVAL);
}

async function syncWithServer() {
  try {
    updateSyncStatus('Syncing with server...');
    
    // Fetch from server and merge
    const serverQuotes = await fetchQuotesFromServer();
    const mergeResult = syncQuotes(quotes, serverQuotes);
    
    // Handle conflicts if any
    if (mergeResult.conflicts.length > 0) {
      conflicts = mergeResult.conflicts;
      showConflictResolution(conflicts);
      showNotification(`${conflicts.length} conflict(s) detected`, true);
      return; // Wait for user resolution
    }
    
    // Update local data if changed
    if (mergeResult.updated) {
      quotes = mergeResult.mergedQuotes;
      saveQuotes(false); // Don't trigger sync to avoid loop
      updateCategories();
      populateCategories();
      showRandomQuote();
      showNotification('Quotes updated from server');
    }
    
    // Push local changes to server
    if (pendingChanges) {
      await postQuotesToServer(quotes);
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

// Improved Mock API Functions
async function fetchQuotesFromServer() {
  try {
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 500 + Math.random() * 500));
    
    const response = await fetch('https://jsonplaceholder.typicode.com/posts')
      .then(res => res.json());
    
    // Transform to our quote format
    const serverQuotes = response.slice(0, 5).map((post, index) => ({
      id: index + 1000, // Different ID range to simulate server IDs
      text: post.title,
      category: 'Server',
      serverVersion: true,
      updatedAt: new Date().toISOString()
    }));
    
    // Combine with our localStorage server data
    const localServerData = JSON.parse(localStorage.getItem(SERVER_STORAGE_KEY) || '[]');
    return [...serverQuotes, ...localServerData];
  } catch (error) {
    console.error('Using fallback server data:', error);
    // Fallback to localStorage if API fails
    return JSON.parse(localStorage.getItem(SERVER_STORAGE_KEY) || '[]');
  }
}

async function postQuotesToServer(quotesToPost) {
  try {
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 800 + Math.random() * 500));
    
    // Process quotes for server
    const processedQuotes = quotesToPost.map(quote => ({
      ...quote,
      serverVersion: true,
      updatedAt: new Date().toISOString()
    }));
    
    // In a real app, this would be an actual API call
    localStorage.setItem(SERVER_STORAGE_KEY, JSON.stringify(processedQuotes));
    
    // Simulate posting to JSONPlaceholder
    await fetch('https://jsonplaceholder.typicode.com/posts', {
      method: 'POST',
      body: JSON.stringify(processedQuotes[0]), // Just send first quote as example
      headers: {
        'Content-type': 'application/json; charset=UTF-8',
      },
    });
    
    return processedQuotes;
  } catch (error) {
    console.error('Failed to post quotes:', error);
    throw error;
  }
}

// Enhanced Data Synchronization Logic
function syncQuotes(localQuotes, serverQuotes) {
  const mergedQuotes = [];
  const newConflicts = [];
  const quoteMap = new Map();

  // Add server quotes first (higher priority)
  serverQuotes.forEach(quote => {
    const key = quote.id.toString();
    quoteMap.set(key, quote);
  });

  // Merge local quotes, checking for conflicts
  localQuotes.forEach(localQuote => {
    const key = localQuote.id.toString();
    const serverQuote = quoteMap.get(key);
    
    if (serverQuote) {
      // Check if different (excluding server metadata)
      const { serverVersion, updatedAt, ...serverClean } = serverQuote;
      const { createdAt, ...localClean } = localQuote;
      
      if (JSON.stringify(serverClean) !== JSON.stringify(localClean)) {
        newConflicts.push({
          key,
          local: localQuote,
          server: serverQuote,
          resolved: null
        });
      }
    } else {
      // Add local quote if not on server
      quoteMap.set(key, localQuote);
    }
  });

  // Convert map back to array
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
      <div class="conflict-versions">
        <div class="conflict-option">
          <h5>Local Version</h5>
          <p class="quote-text">"${conflict.local.text}"</p>
          <p class="quote-category">— ${conflict.local.category}</p>
          <p class="quote-meta">Created: ${new Date(conflict.local.createdAt || Date.now()).toLocaleString()}</p>
        </div>
        <div class="conflict-option">
          <h5>Server Version</h5>
          <p class="quote-text">"${conflict.server.text}"</p>
          <p class="quote-category">— ${conflict.server.category}</p>
          <p class="quote-meta">Updated: ${new Date(conflict.server.updatedAt).toLocaleString()}</p>
        </div>
      </div>
      <div class="conflict-actions">
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
  document.documentElement.scrollTop = document.documentElement.scrollHeight;
}

function resolveConflicts() {
  const resolvedQuotes = [...quotes];
  
  conflicts.forEach((conflict, index) => {
    const selected = document.querySelector(`input[name="resolve-${index}"]:checked`).value;
    const resolvedQuote = selected === 'local' ? conflict.local : conflict.server;
    
    // Update the quote in our array
    const quoteIndex = resolvedQuotes.findIndex(q => q.id.toString() === conflict.key);
    if (quoteIndex !== -1) {
      resolvedQuotes[quoteIndex] = resolvedQuote;
    }
  });
  
  // Update application state
  quotes = resolvedQuotes;
  conflicts = [];
  saveQuotes();
  updateCategories();
  populateCategories();
  elements.conflictResolution.classList.add('hidden');
  showNotification('Conflicts resolved successfully');
  
  // Sync again to ensure server gets updates
  syncWithServer();
}

// Quote Management
function loadQuotes() {
  const savedQuotes = localStorage.getItem(LOCAL_STORAGE_KEY);
  if (savedQuotes) {
    quotes = JSON.parse(savedQuotes);
    updateCategories();
  } else {
    // Default quotes
    quotes = [
      { id: 1, text: "The only way to do great work is to love what you do.", category: "Inspiration", createdAt: new Date().toISOString() },
      { id: 2, text: "Innovation distinguishes between a leader and a follower.", category: "Business", createdAt: new Date().toISOString() },
      { id: 3, text: "Your time is limited, don't waste it living someone else's life.", category: "Life", createdAt: new Date().toISOString() },
      { id: 4, text: "Stay hungry, stay foolish.", category: "Inspiration", createdAt: new Date().toISOString() },
      { id: 5, text: "The greatest glory in living lies not in never falling, but in rising every time we fall.", category: "Perseverance", createdAt: new Date().toISOString() },
      { id: 6, text: "The way to get started is to quit talking and begin doing.", category: "Productivity", createdAt: new Date().toISOString() }
    ];
    saveQuotes();
    updateCategories();
  }
}

function saveQuotes(triggerSync = true) {
  localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(quotes));
  pendingChanges = triggerSync;
  if (triggerSync) {
    // Post to server in background
    postQuotesToServer(quotes).catch(error => {
      console.error('Background sync failed:', error);
    });
  }
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
      id: Date.now(),
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