let quotes = [];

function saveQuotes() {
  localStorage.setItem("quotes", JSON.stringify(quotes));
}

function loadQuotes() {
  const saved = localStorage.getItem("quotes");
  quotes = saved ? JSON.parse(saved) : [];
}

function showQuote(quote) {
  const display = document.getElementById("quoteDisplay");
  display.textContent = `${quote.text} (${quote.category})`;
  sessionStorage.setItem("lastQuote", JSON.stringify(quote));
}

function showRandomQuote() {
  const category = document.getElementById("categoryFilter").value;
  const filtered = category === "all" ? quotes : quotes.filter(q => q.category === category);
  if (filtered.length === 0) {
    document.getElementById("quoteDisplay").textContent = "No quotes available.";
    return;
  }
  const random = filtered[Math.floor(Math.random() * filtered.length)];
  showQuote(random);
}

async function postQuoteToServer(quote) {
  try {
    // JSONPlaceholder ignores data but responds with created object
    const response = await fetch("https://jsonplaceholder.typicode.com/posts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(quote),
    });
    const data = await response.json();
    console.log("Posted quote to server:", data);
  } catch (err) {
    console.error("Failed to post quote to server:", err);
  }
}

async function addQuote() {
  const textElem = document.getElementById("newQuoteText");
  const categoryElem = document.getElementById("newQuoteCategory");
  const error = document.getElementById("errorMessage");
  error.textContent = "";

  const text = textElem.value.trim();
  const category = categoryElem.value.trim();

  if (!text || !category) {
    error.textContent = "Both quote and category are required.";
    return;
  }

  const newQuote = { text, category };
  quotes.push(newQuote);
  saveQuotes();
  populateCategories();
  showQuote(newQuote);

  // Post new quote to the server
  await postQuoteToServer(newQuote);

  textElem.value = "";
  categoryElem.value = "";
}

function populateCategories() {
  const select = document.getElementById("categoryFilter");
  const categories = Array.from(new Set(quotes.map(q => q.category))).sort();
  const current = localStorage.getItem("selectedCategory") || "all";

  select.innerHTML = `<option value="all">All Categories</option>`;
  categories.forEach(cat => {
    const option = document.createElement("option");
    option.value = cat;
    option.textContent = cat;
    select.appendChild(option);
  });

  select.value = current;
  filterQuotes();
}

function filterQuotes() {
  const category = document.getElementById("categoryFilter").value;
  localStorage.setItem("selectedCategory", category);
  const filtered = category === "all" ? quotes : quotes.filter(q => q.category === category);
  if (filtered.length > 0) {
    showQuote(filtered[0]);
  } else {
    document.getElementById("quoteDisplay").textContent = "No quotes in this category.";
  }
}

function exportQuotesAsJson() {
  const blob = new Blob([JSON.stringify(quotes, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "quotes.json";
  a.click();
  URL.revokeObjectURL(url);
}

function importFromJsonFile(event) {
  const fileReader = new FileReader();
  fileReader.onload = function(e) {
    try {
      const imported = JSON.parse(e.target.result);
      if (Array.isArray(imported)) {
        quotes.push(...imported);
        saveQuotes();
        populateCategories();
        notifyUser("Quotes imported successfully.");
      } else {
        alert("Invalid JSON structure.");
      }
    } catch {
      alert("Invalid JSON file.");
    }
  };
  fileReader.readAsText(event.target.files[0]);
}

function notifyUser(message) {
  const area = document.getElementById("notificationArea");
  const note = document.createElement("div");
  note.textContent = message;
  note.className = "notification";
  area.innerHTML = "";
  area.appendChild(note);
  setTimeout(() => note.remove(), 5000);
}

function loadLastQuote() {
  const last = sessionStorage.getItem("lastQuote");
  if (last) {
    showQuote(JSON.parse(last));
  }
}

// --- Server sync and conflict resolution ---

async function fetchQuotesFromServer() {
  try {
    const res = await fetch("https://jsonplaceholder.typicode.com/posts");
    const data = await res.json();
    // Convert server posts to quotes with category 'Server'
    return data.slice(0, 10).map(post => ({
      text: post.title,
      category: "Server",
    }));
  } catch (err) {
    console.error("Error fetching server quotes:", err);
    return [];
  }
}

async function syncQuotes() {
  const serverQuotes = await fetchQuotesFromServer();
  let updated = false;
  let conflictsResolved = false;

  serverQuotes.forEach(serverQuote => {
    // Check if quote exists locally (text + category)
    const localIndex = quotes.findIndex(local =>
      local.text === serverQuote.text && local.category === serverQuote.category
    );

    if (localIndex === -1) {
      // New quote from server, add locally
      quotes.push(serverQuote);
      updated = true;
    } else {
      // Conflict possible if local quote differs in content (unlikely here, but placeholder)
      // For demo, assume server wins and replace local quote
      // In real app, compare and ask user if needed
      // (Here just simulate that server always overrides)
      // So if serverQuote text !== local text, update local quote
      // But since keys are the same, ignore this step for now
    }
  });

  if (updated) {
    saveQuotes();
    populateCategories();
    notifyUser("Quotes updated from server (sync complete).");
  }
}

document.addEventListener("DOMContentLoaded", () => {
  loadQuotes();
  populateCategories();
  loadLastQuote();
  document.getElementById("newQuote").addEventListener("click", showRandomQuote);

  // Periodically sync quotes every 10 seconds
  syncQuotes();
  setInterval(syncQuotes, 10000);
});
