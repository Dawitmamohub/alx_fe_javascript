// Configuration
const SYNC_INTERVAL = 30000;
const SERVER_STORAGE_KEY = 'serverQuotes';
const LOCAL_STORAGE_KEY = 'quotes';
let syncTimer = null;

// Notification Types
const NOTIFICATION_TYPES = {
  SUCCESS: 'success',
  ERROR: 'error',
  WARNING: 'warning',
  INFO: 'info',
  SYNC: 'sync'
};

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
  newQuoteCategory: document.getElementById('newQuoteCategory'),
  conflictCount: document.getElementById('conflictCount'),
  notificationCenter: document.getElementById('notificationCenter')
};

// Notification System
function showNotification(message, type = NOTIFICATION_TYPES.INFO, options = {}) {
  const notification = document.createElement('div');
  notification.className = `notification ${type}`;
  
  const now = new Date();
  const timestamp = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  
  const icons = {
    [NOTIFICATION_TYPES.SUCCESS]: '✅',
    [NOTIFICATION_TYPES.ERROR]: '❌',
    [NOTIFICATION_TYPES.WARNING]: '⚠️',
    [NOTIFICATION_TYPES.INFO]: 'ℹ️',
    [NOTIFICATION_TYPES.SYNC]: '🔄'
  };

  notification.innerHTML = `
    <div class="notification-header">
      <div class="notification-title">
        <span class="notification-icon">${icons[type] || icons.info}</span>
        <span>${options.title || type.charAt(0).toUpperCase() + type.slice(1)}</span>
      </div>
      <span class="notification-time">${timestamp}</span>
    </div>
    <p class="notification-message">${message}</p>
  `;

  const closeBtn = document.createElement('button');
  closeBtn.className = 'close-notification';
  closeBtn.innerHTML = '&times;';
  closeBtn.addEventListener('click', () => notification.remove());
  notification.querySelector('.notification-header').appendChild(closeBtn);

  elements.notificationCenter.prepend(notification);

  const timeout = type === NOTIFICATION_TYPES.ERROR ? 8000 : 5000;
  setTimeout(() => {
    notification.style.opacity = '0';
    setTimeout(() => notification.remove(), 300);
  }, timeout);
}

// Initialize the application
function init() {
  loadQuotes();
  loadLastFilter();
  showRandomQuote();
  setupEventListeners();
  populateCategories();
  initSync();
}

function setupEventListeners() {
  elements.newQuoteBtn.addEventListener('click', showRandomQuote);
  elements.showAddFormBtn.addEventListener('click', toggleAddForm);
  elements.addQuoteBtn.addEventListener('click', addQuote);
  elements.exportQuotesBtn.addEventListener('click', exportQuotes);
  elements.importQuotesBtn.addEventListener('click', () => elements.importFileInput.click());
  elements.importFileInput.addEventListener('change', importFromJsonFile);
  elements.categoryFilter.addEventListener('change', filterQuotes);
  elements.manualSyncBtn.addEventListener('click', triggerManualSync);
  elements.resolveConflictsBtn.addEventListener('click', resolveConflicts);
  
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) syncWithServer();
  });
}

// Sync Functions
function initSync() {
  if (!localStorage.getItem(SERVER_STORAGE_KEY)) {
    const defaultServerQuotes = [
      { id: 1, text: "The journey of a thousand miles begins with one step.", category: "Inspiration", serverVersion: true, updatedAt: new Date().toISOString() },
      { id: 2, text: "Innovation is seeing what everybody has seen and thinking what nobody has thought.", category: "Creativity", serverVersion: true, updatedAt: new Date().toISOString() }
    ];
    localStorage.setItem(SERVER_STORAGE_KEY, JSON.stringify(defaultServerQuotes));
  }
  
  syncWithServer();
  syncTimer = setInterval(syncWithServer, SYNC_INTERVAL);
}

function triggerManualSync() {
  elements.manualSyncBtn.disabled = true;
  showNotification('Manual sync initiated...', NOTIFICATION_TYPES.SYNC);
  syncWithServer()
    .finally(() => {
      setTimeout(() => {
        elements.manualSyncBtn.disabled = false;
      }, 1000);
    });
}

async function syncWithServer() {
  try {
    updateSyncStatus('Connecting to server...');
    showNotification('Starting synchronization...', NOTIFICATION_TYPES.SYNC);
    
    const serverQuotes = await fetchQuotesFromServer();
    const mergeResult = syncQuotes(quotes, serverQuotes);
    
    if (mergeResult.conflicts.length > 0) {
      conflicts = mergeResult.conflicts;
      updateConflictCount();
      showConflictResolution(conflicts);
      updateSyncStatus(`${conflicts.length} conflict(s) found`, true);
      showNotification(`Found ${conflicts.length} conflicts`, NOTIFICATION_TYPES.WARNING);
      return;
    }
    
    if (mergeResult.updated) {
      quotes = mergeResult.mergedQuotes;
      saveQuotes(false);
      updateCategories();
      populateCategories();
      showRandomQuote();
    }
    
    if (pendingChanges) {
      updateSyncStatus('Uploading changes...');
      await postQuotesToServer(quotes);
      showNotification('Sync completed successfully!', NOTIFICATION_TYPES.SUCCESS);
    }
    
    lastSyncTime = new Date();
    pendingChanges = false;
    updateSyncStatus(`Last sync: ${formatTime(lastSyncTime)}`);
    
  } catch (error) {
    console.error('Sync error:', error);
    updateSyncStatus('Sync failed', true);
    showNotification(`Sync failed: ${error.message}`, NOTIFICATION_TYPES.ERROR);
    clearInterval(syncTimer);
    syncTimer = setInterval(syncWithServer, 10000);
  }
}

// Conflict Resolution
function updateConflictCount() {
  elements.conflictCount.textContent = `${conflicts.length} conflict${conflicts.length !== 1 ? 's' : ''}`;
}

function showConflictResolution(conflicts) {
  elements.conflictItems.innerHTML = '';
  updateConflictCount();
  
  conflicts.forEach((conflict, index) => {
    const conflictEl = document.createElement('div');
    conflictEl.className = 'conflict-item';
    conflictEl.innerHTML = `
      <h4>Conflict #${index + 1}</h4>
      <div class="conflict-versions">
        <div class="conflict-option local-version">
          <h5><i class="fas fa-desktop"></i> Local Version</h5>
          <p class="quote-text">"${conflict.local.text}"</p>
          <p class="quote-category">— ${conflict.local.category}</p>
          <div class="quote-meta">
            <span>Created: ${formatDate(conflict.local.createdAt)}</span>
          </div>
        </div>
        <div class="conflict-option server-version">
          <h5><i class="fas fa-server"></i> Server Version</h5>
          <p class="quote-text">"${conflict.server.text}"</p>
          <p class="quote-category">— ${conflict.server.category}</p>
          <div class="quote-meta">
            <span>Updated: ${formatDate(conflict.server.updatedAt)}</span>
          </div>
        </div>
      </div>
      <div class="conflict-actions">
        <label class="resolve-option">
          <input type="radio" name="resolve-${index}" value="local" checked>
          Keep local
        </label>
        <label class="resolve-option">
          <input type="radio" name="resolve-${index}" value="server">
          Use server
        </label>
      </div>
    `;
    elements.conflictItems.appendChild(conflictEl);
  });
  
  elements.conflictResolution.classList.remove('hidden');
}

function resolveConflicts() {
  const resolvedQuotes = [...quotes];
  
  conflicts.forEach((conflict, index) => {
    const selected = document.querySelector(`input[name="resolve-${index}"]:checked`).value;
    const resolvedQuote = selected === 'local' ? conflict.local : conflict.server;
    
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
  showNotification('Conflicts resolved successfully!', NOTIFICATION_TYPES.SUCCESS);
}

// Data Management
function loadQuotes() {
  const savedQuotes = localStorage.getItem(LOCAL_STORAGE_KEY);
  quotes = savedQuotes ? JSON.parse(savedQuotes) : getDefaultQuotes();
  updateCategories();
}

function getDefaultQuotes() {
  return [
    { id: 1, text: "The only way to do great work is to love what you do.", category: "Inspiration", createdAt: new Date().toISOString() },
    { id: 2, text: "Innovation distinguishes between a leader and a follower.", category: "Business", createdAt: new Date().toISOString() },
    { id: 3, text: "Your time is limited, don't waste it living someone else's life.", category: "Life", createdAt: new Date().toISOString() }
  ];
}

function saveQuotes(triggerSync = true) {
  localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(quotes));
  pendingChanges = triggerSync;
}

// UI Functions
function showRandomQuote() {
  const filteredQuotes = selectedCategory 
    ? quotes.filter(quote => quote.category === selectedCategory)
    : quotes;
  
  if (filteredQuotes.length === 0) {
    elements.quoteDisplay.innerHTML = `
      <p class="quote-text">No quotes in this category</p>
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
  `;
}

// Utility Functions
function formatDate(dateString) {
  return new Date(dateString).toLocaleString();
}

function formatTime(date) {
  return date ? date.toLocaleTimeString() : 'Never';
}

function updateSyncStatus(message, isError = false) {
  elements.syncStatus.innerHTML = `
    <span class="sync-icon">${isError ? '⚠️' : '🔄'}</span>
    <span class="sync-message">${message}</span>
  `;
  elements.syncStatus.className = isError ? 'sync-status error' : 'sync-status';
}

// Initialize
document.addEventListener('DOMContentLoaded', init);