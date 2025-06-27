// Add this to the top of your script.js (if not already present)
const NOTIFICATION_TYPES = {
  SUCCESS: 'success',
  ERROR: 'error',
  WARNING: 'warning',
  INFO: 'info',
  SYNC: 'sync'
};

// Replace any existing showNotification function with this enhanced version
function showNotification(message, type = NOTIFICATION_TYPES.INFO) {
  // Remove any existing notifications
  document.querySelectorAll('.notification').forEach(el => el.remove());

  const notification = document.createElement('div');
  notification.className = `notification notification-${type}`;
  
  const icons = {
    [NOTIFICATION_TYPES.SUCCESS]: '✅',
    [NOTIFICATION_TYPES.ERROR]: '❌',
    [NOTIFICATION_TYPES.WARNING]: '⚠️',
    [NOTIFICATION_TYPES.INFO]: 'ℹ️',
    [NOTIFICATION_TYPES.SYNC]: '🔄'
  };

  notification.innerHTML = `
    <span class="notification-icon">${icons[type] || icons[NOTIFICATION_TYPES.INFO]}</span>
    <p class="notification-message">${message}</p>
    <button class="close-notification">&times;</button>
  `;

  notification.querySelector('.close-notification').addEventListener('click', () => {
    notification.remove();
  });

  document.body.appendChild(notification);

  // Auto-hide after 5 seconds
  setTimeout(() => {
    notification.style.opacity = '0';
    setTimeout(() => notification.remove(), 300);
  }, 5000);
}

// Update all sync-related functions to use the new notification system:

// In syncWithServer function:
async function syncWithServer() {
  try {
    updateSyncStatus('Connecting to server...');
    showNotification('Starting synchronization with server...', NOTIFICATION_TYPES.SYNC);
    
    const serverQuotes = await fetchQuotesFromServer();
    showNotification('Successfully fetched quotes from server', NOTIFICATION_TYPES.SUCCESS);
    
    const mergeResult = syncQuotes(quotes, serverQuotes);
    
    if (mergeResult.conflicts.length > 0) {
      conflicts = mergeResult.conflicts;
      showConflictResolution(conflicts);
      updateSyncStatus(`Resolve ${conflicts.length} conflict(s)`, true);
      showNotification(`Found ${conflicts.length} conflicts that need resolution`, NOTIFICATION_TYPES.WARNING);
      return;
    }
    
    if (mergeResult.updated) {
      quotes = mergeResult.mergedQuotes;
      saveQuotes(false);
      updateCategories();
      populateCategories();
      showRandomQuote();
      showNotification('Quotes updated from server', NOTIFICATION_TYPES.SUCCESS);
    }
    
    if (pendingChanges) {
      updateSyncStatus('Uploading changes to server...');
      showNotification('Uploading local changes to server...', NOTIFICATION_TYPES.SYNC);
      await postQuotesToServer(quotes);
      showNotification('Quotes successfully synced with server!', NOTIFICATION_TYPES.SUCCESS); // This replaces the alert
    }
    
    lastSyncTime = new Date();
    pendingChanges = false;
    updateSyncStatus(`Synced at ${formatTime(lastSyncTime)}`);
    
  } catch (error) {
    console.error('Sync error:', error);
    updateSyncStatus('Sync failed - will retry', true);
    showNotification(`Sync failed: ${error.message}`, NOTIFICATION_TYPES.ERROR);
    
    clearInterval(syncTimer);
    syncTimer = setInterval(syncWithServer, 10000);
  }
}

// In resolveConflicts function:
function resolveConflicts() {
  const resolvedQuotes = [...quotes];
  
  conflicts.forEach((conflict, index) => {
    const selected = document.querySelector(`input[name="resolve-${index}"]:checked`).value;
    let resolvedQuote;
    
    switch(selected) {
      case 'local':
        resolvedQuote = conflict.local;
        showNotification('Kept local version of quote', NOTIFICATION_TYPES.INFO);
        break;
      case 'server':
        resolvedQuote = conflict.server;
        showNotification('Used server version of quote', NOTIFICATION_TYPES.INFO);
        break;
      case 'merge':
        resolvedQuote = {
          ...conflict.server,
          text: conflict.local.text,
          updatedAt: new Date().toISOString()
        };
        showNotification('Merged local and server versions', NOTIFICATION_TYPES.INFO);
        break;
    }
    
    const quoteIndex = resolvedQuotes.findIndex(q => q.id.toString() === conflict.key);
    if (quoteIndex !== -1) {
      resolvedQuotes[quoteIndex] = resolvedQuote;
    } else {
      resolvedQuotes.push(resolvedQuote);
    }
  });
  
  quotes = resolvedQuotes;
  conflicts = [];
  saveQuotes();
  updateCategories();
  populateCategories();
  elements.conflictResolution.classList.add('hidden');
  showNotification('All conflicts resolved successfully!', NOTIFICATION_TYPES.SUCCESS);
  
  setTimeout(syncWithServer, 1000);
}

// In addQuote function:
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
    elements.addQuoteForm.classList.add('hidden');
    
    selectedCategory = category;
    elements.categoryFilter.value = category;
    localStorage.setItem('lastFilter', category);
    updateActiveFilterDisplay();
    showRandomQuote();
    
    showNotification('Quote added successfully! It will be synced with the server shortly.', NOTIFICATION_TYPES.SUCCESS);
  } else {
    showNotification('Please enter both a quote and a category', NOTIFICATION_TYPES.ERROR);
  }
}

// In importFromJsonFile function:
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
      showNotification(`Successfully imported ${validQuotes.length} quotes! They will be synced with the server shortly.`, NOTIFICATION_TYPES.SUCCESS);
    } catch (error) {
      showNotification('Error importing quotes: ' + error.message, NOTIFICATION_TYPES.ERROR);
      console.error('Import error:', error);
    }
  };
  fileReader.readAsText(file);
}

// Configuration
const SYNC_INTERVAL = 30000; // 30 seconds
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
  resolveConflictsBtn: document.getElementById('resolveConflicts'),
  newQuoteText: document.getElementById('newQuoteText'),
  newQuoteCategory: document.getElementById('newQuoteCategory')
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
  
  elements.manualSyncBtn.addEventListener('click', () => {
    elements.manualSyncBtn.disabled = true;
    setTimeout(() => {
      elements.manualSyncBtn.disabled = false;
    }, 1000);
  });
  
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) syncWithServer();
  });
}

// Server Synchronization Functions
function initSync() {
  if (!localStorage.getItem(SERVER_STORAGE_KEY)) {
    const defaultServerQuotes = [
      { id: 1, text: "The journey of a thousand miles begins with one step.", category: "Inspiration", serverVersion: true, updatedAt: new Date().toISOString() },
      { id: 2, text: "Innovation is seeing what everybody has seen and thinking what nobody has thought.", category: "Creativity", serverVersion: true, updatedAt: new Date().toISOString() }
    ];
    localStorage.setItem(SERVER_STORAGE_KEY, JSON.stringify(defaultServerQuotes));
  }
  
  syncWithServer();
  
  syncTimer = setInterval(() => {
    if (!document.hidden) {
      syncWithServer();
    }
  }, SYNC_INTERVAL);
}

async function syncWithServer() {
  try {
    updateSyncStatus('Connecting to server...');
    showNotification('Starting synchronization with server...', false, 'sync');
    
    const serverQuotes = await fetchQuotesFromServer();
    showNotification('Successfully fetched quotes from server', false, 'success');
    
    const mergeResult = syncQuotes(quotes, serverQuotes);
    
    if (mergeResult.conflicts.length > 0) {
      conflicts = mergeResult.conflicts;
      showConflictResolution(conflicts);
      updateSyncStatus(`Resolve ${conflicts.length} conflict(s)`, true);
      showNotification(`Found ${conflicts.length} conflicts that need resolution`, true, 'warning');
      return;
    }
    
    if (mergeResult.updated) {
      quotes = mergeResult.mergedQuotes;
      saveQuotes(false);
      updateCategories();
      populateCategories();
      showRandomQuote();
      showNotification('Quotes updated from server', false, 'success');
    }
    
    if (pendingChanges) {
      updateSyncStatus('Uploading changes to server...');
      showNotification('Uploading local changes to server...', false, 'sync');
      await postQuotesToServer(quotes);
      showNotification('Quotes successfully synced with server!', false, 'success');
    }
    
    lastSyncTime = new Date();
    pendingChanges = false;
    updateSyncStatus(`Synced at ${formatTime(lastSyncTime)}`);
    
  } catch (error) {
    console.error('Sync error:', error);
    updateSyncStatus('Sync failed - will retry', true);
    showNotification(`Sync failed: ${error.message}`, true, 'error');
    
    clearInterval(syncTimer);
    syncTimer = setInterval(syncWithServer, 10000);
  }
}

async function fetchQuotesFromServer() {
  try {
    await new Promise(resolve => setTimeout(resolve, 500 + Math.random() * 500));
    
    if (Math.random() < 0.1) throw new Error('Simulated API failure');
    
    const response = await fetch('https://jsonplaceholder.typicode.com/posts', {
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    });
    
    if (!response.ok) throw new Error('API response not OK');
    
    const jsonData = await response.json();
    const serverQuotes = jsonData.slice(0, 5).map((post, index) => ({
      id: index + 1000,
      text: post.title,
      category: 'Server',
      serverVersion: true,
      updatedAt: new Date().toISOString()
    }));
    
    const localServerData = JSON.parse(localStorage.getItem(SERVER_STORAGE_KEY) || '[]');
    return [...serverQuotes, ...localServerData];
    
  } catch (error) {
    console.error('Using fallback server data:', error);
    return JSON.parse(localStorage.getItem(SERVER_STORAGE_KEY) || '[]');
  }
}

async function postQuotesToServer(quotesToPost) {
  try {
    await new Promise(resolve => setTimeout(resolve, 800 + Math.random() * 500));
    
    if (Math.random() < 0.1) throw new Error('Simulated server error during post');
    
    const processedQuotes = quotesToPost.map(quote => ({
      ...quote,
      serverVersion: true,
      updatedAt: new Date().toISOString(),
      synced: true
    }));
    
    localStorage.setItem(SERVER_STORAGE_KEY, JSON.stringify(processedQuotes));
    
    const response = await fetch('https://jsonplaceholder.typicode.com/posts', {
      method: 'POST',
      body: JSON.stringify({
        title: `Synced ${processedQuotes.length} quotes`,
        body: JSON.stringify(processedQuotes.slice(0, 3)),
        userId: 1
      }),
      headers: {
        'Content-Type': 'application/json; charset=UTF-8',
      },
    });
    
    if (!response.ok) throw new Error('Failed to post to mock API');
    
    return processedQuotes;
  } catch (error) {
    console.error('Post to server failed:', error);
    throw error;
  }
}

function syncQuotes(localQuotes, serverQuotes) {
  const mergedQuotes = [];
  const newConflicts = [];
  const quoteMap = new Map();

  serverQuotes.forEach(quote => {
    const key = quote.id.toString();
    quoteMap.set(key, { ...quote, source: 'server' });
  });

  localQuotes.forEach(localQuote => {
    const key = localQuote.id.toString();
    const existing = quoteMap.get(key);
    
    if (existing) {
      const serverCopy = { ...existing };
      const localCopy = { ...localQuote };
      
      delete serverCopy.serverVersion;
      delete serverCopy.updatedAt;
      delete serverCopy.source;
      delete localCopy.createdAt;
      
      const serverStr = JSON.stringify(serverCopy);
      const localStr = JSON.stringify(localCopy);
      
      if (serverStr !== localStr) {
        newConflicts.push({
          key,
          local: localQuote,
          server: existing,
          resolved: null
        });
      }
      quoteMap.set(key, existing);
    } else {
      quoteMap.set(key, { ...localQuote, source: 'local' });
    }
  });

  quoteMap.forEach(quote => mergedQuotes.push(quote));

  return {
    mergedQuotes,
    conflicts: newConflicts,
    updated: newConflicts.length > 0 || serverQuotes.length !== localQuotes.length
  };
}

function showConflictResolution(conflicts) {
  elements.conflictItems.innerHTML = '';
  
  conflicts.forEach((conflict, index) => {
    const conflictEl = document.createElement('div');
    conflictEl.className = 'conflict-item';
    conflictEl.innerHTML = `
      <h4>Conflict #${index + 1} <span class="conflict-id">(ID: ${conflict.key})</span></h4>
      <div class="conflict-versions">
        <div class="conflict-option local-version">
          <h5><i class="fas fa-desktop"></i> Local Version</h5>
          <p class="quote-text">"${conflict.local.text}"</p>
          <p class="quote-category">— ${conflict.local.category}</p>
          <div class="quote-meta">
            <span>Created: ${formatDate(conflict.local.createdAt)}</span>
            ${conflict.local.updatedAt ? `<span>Updated: ${formatDate(conflict.local.updatedAt)}</span>` : ''}
          </div>
        </div>
        <div class="conflict-option server-version">
          <h5><i class="fas fa-server"></i> Server Version</h5>
          <p class="quote-text">"${conflict.server.text}"</p>
          <p class="quote-category">— ${conflict.server.category}</p>
          <div class="quote-meta">
            ${conflict.server.createdAt ? `<span>Created: ${formatDate(conflict.server.createdAt)}</span>` : ''}
            <span>Updated: ${formatDate(conflict.server.updatedAt)}</span>
          </div>
        </div>
      </div>
      <div class="conflict-actions">
        <label class="resolve-option">
          <input type="radio" name="resolve-${index}" value="local" ${index === 0 ? 'checked' : ''}>
          Keep local version
        </label>
        <label class="resolve-option">
          <input type="radio" name="resolve-${index}" value="server">
          Use server version
        </label>
        <label class="resolve-option">
          <input type="radio" name="resolve-${index}" value="merge">
          Merge changes
        </label>
      </div>
    `;
    elements.conflictItems.appendChild(conflictEl);
  });
  
  elements.conflictResolution.classList.remove('hidden');
  window.scrollTo(0, document.body.scrollHeight);
}

function resolveConflicts() {
  const resolvedQuotes = [...quotes];
  
  conflicts.forEach((conflict, index) => {
    const selected = document.querySelector(`input[name="resolve-${index}"]:checked`).value;
    let resolvedQuote;
    
    switch(selected) {
      case 'local':
        resolvedQuote = conflict.local;
        showNotification('Kept local version of quote', false, 'info');
        break;
      case 'server':
        resolvedQuote = conflict.server;
        showNotification('Used server version of quote', false, 'info');
        break;
      case 'merge':
        resolvedQuote = {
          ...conflict.server,
          text: conflict.local.text,
          updatedAt: new Date().toISOString()
        };
        showNotification('Merged local and server versions', false, 'info');
        break;
    }
    
    const quoteIndex = resolvedQuotes.findIndex(q => q.id.toString() === conflict.key);
    if (quoteIndex !== -1) {
      resolvedQuotes[quoteIndex] = resolvedQuote;
    } else {
      resolvedQuotes.push(resolvedQuote);
    }
  });
  
  quotes = resolvedQuotes;
  conflicts = [];
  saveQuotes();
  updateCategories();
  populateCategories();
  elements.conflictResolution.classList.add('hidden');
  showNotification('All conflicts resolved successfully!', false, 'success');
  
  setTimeout(syncWithServer, 1000);
}

function loadQuotes() {
  const savedQuotes = localStorage.getItem(LOCAL_STORAGE_KEY);
  if (savedQuotes) {
    quotes = JSON.parse(savedQuotes);
    updateCategories();
  } else {
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
    ${quote.createdAt ? `<p class="quote-meta">Added: ${formatDate(quote.createdAt)}</p>` : ''}
    ${quote.updatedAt ? `<p class="quote-meta">Updated: ${formatDate(quote.updatedAt)}</p>` : ''}
  `;
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
  elements.addQuoteForm.classList.toggle('hidden');
  if (!elements.addQuoteForm.classList.contains('hidden')) {
    elements.newQuoteText.focus();
  }
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
    elements.addQuoteForm.classList.add('hidden');
    
    selectedCategory = category;
    elements.categoryFilter.value = category;
    localStorage.setItem('lastFilter', category);
    updateActiveFilterDisplay();
    showRandomQuote();
    
    showNotification('Quote added successfully! It will be synced with the server shortly.', false, 'success');
  } else {
    showNotification('Please enter both a quote and a category', true, 'error');
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
      showNotification(`Successfully imported ${validQuotes.length} quotes! They will be synced with the server shortly.`, false, 'success');
    } catch (error) {
      showNotification('Error importing quotes: ' + error.message, true, 'error');
      console.error('Import error:', error);
    }
  };
  fileReader.readAsText(file);
}

function updateSyncStatus(message, isError = false) {
  elements.syncStatus.innerHTML = `
    <span class="sync-icon">${isError ? '⚠️' : '🔄'}</span>
    <span class="sync-message">${message}</span>
    ${lastSyncTime ? `<span class="sync-time">Last success: ${formatTime(lastSyncTime)}</span>` : ''}
  `;
  elements.syncStatus.className = isError ? 'sync-status error' : 'sync-status';
}

function showNotification(message, isWarning = false, type = 'info') {
  document.querySelectorAll('.notification').forEach(el => el.remove());
  
  const notification = document.createElement('div');
  notification.className = `notification notification-${type}`;
  
  const icons = {
    'error': '❌',
    'warning': '⚠️',
    'success': '✅',
    'info': 'ℹ️',
    'sync': '🔄'
  };
  
  notification.innerHTML = `
    <span class="notification-icon">${icons[type] || 'ℹ️'}</span>
    <p class="notification-message">${message}</p>
    <button class="close-notification">&times;</button>
  `;
  
  notification.querySelector('.close-notification').addEventListener('click', () => {
    notification.remove();
  });
  
  document.body.appendChild(notification);
  
  setTimeout(() => {
    notification.style.opacity = '0';
    setTimeout(() => notification.remove(), 300);
  }, 5000);
}

function formatDate(dateString) {
  if (!dateString) return 'Unknown';
  const date = new Date(dateString);
  return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function formatTime(date) {
  if (!date) return 'Never';
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

// Initialize the application
document.addEventListener('DOMContentLoaded', init);