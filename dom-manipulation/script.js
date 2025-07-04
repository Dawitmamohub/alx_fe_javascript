let quotes = [];

// Load quotes from localStorage
function loadQuotes() {
  const stored = localStorage.getItem("quotes");
  if (stored) {
    try {
      quotes = JSON.parse(stored);
    } catch (e) {
      console.error("Error parsing localStorage data:", e);
      quotes = [];
    }
  }
}

// Save quotes to localStorage
function saveQuotes() {
  localStorage.setItem("quotes", JSON.stringify(quotes));
}

// Show a random quote & update sessionStorage
function showRandomQuote() {
  if (quotes.length === 0) {
    document.getElementById('quoteDisplay').innerHTML = "<p>No quotes available.</p>";
    return;
  }

  const q = quotes[Math.floor(Math.random() * quotes.length)];
  sessionStorage.setItem("lastQuote", JSON.stringify(q)); // Save to session

  document.getElementById('quoteDisplay').innerHTML = `
    <blockquote>"${q.text}"</blockquote>
    <p><em>Category: ${q.category}</em></p>
  `;
}

// Add new quote
function addQuote() {
  const text = document.getElementById('newQuoteText').value.trim();
  const category = document.getElementById('newQuoteCategory').value.trim();
  const error = document.getElementById('errorMessage');
  error.textContent = "";

  if (!text || !category) {
    error.textContent = "Please fill in both fields.";
    return;
  }

  const newQuote = { text, category };
  quotes.push(newQuote);
  saveQuotes();
  showQuote(newQuote);

  document.getElementById('newQuoteText').value = "";
  document.getElementById('newQuoteCategory').value = "";
}

// Show a specific quote
function showQuote(q) {
  document.getElementById('quoteDisplay').innerHTML = `
    <blockquote>"${q.text}"</blockquote>
    <p><em>Category: ${q.category}</em></p>
  `;
  sessionStorage.setItem("lastQuote", JSON.stringify(q));
}

// Create add-quote form dynamically
function createAddQuoteForm() {
  const formContainer = document.getElementById("formContainer");

  const formDiv = document.createElement("div");
  formDiv.className = "form";

  const quoteInput = document.createElement("input");
  quoteInput.id = "newQuoteText";
  quoteInput.type = "text";
  quoteInput.placeholder = "Enter a new quote";

  const categoryInput = document.createElement("input");
  categoryInput.id = "newQuoteCategory";
  categoryInput.type = "text";
  categoryInput.placeholder = "Enter quote category";

  const errorMsg = document.createElement("p");
  errorMsg.id = "errorMessage";
  errorMsg.className = "error";

  const addButton = document.createElement("button");
  addButton.id = "addQuoteButton";
  addButton.textContent = "Add Quote";

  formDiv.appendChild(quoteInput);
  formDiv.appendChild(categoryInput);
  formDiv.appendChild(addButton);
  formDiv.appendChild(errorMsg);

  formContainer.appendChild(formDiv);
  addButton.addEventListener("click", addQuote);
}

// Export quotes to JSON file
function exportToJsonFile() {
  const dataStr = JSON.stringify(quotes, null, 2);
  const blob = new Blob([dataStr], { type: "application/json" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = "quotes.json";
  a.click();

  URL.revokeObjectURL(url);
}

// Import quotes from uploaded JSON file
function importFromJsonFile(event) {
  const fileReader = new FileReader();
  fileReader.onload = function (e) {
    try {
      const importedQuotes = JSON.parse(e.target.result);
      if (Array.isArray(importedQuotes)) {
        quotes.push(...importedQuotes);
        saveQuotes();
        alert("Quotes imported successfully!");
        showRandomQuote();
      } else {
        alert("Invalid file format.");
      }
    } catch (err) {
      alert("Error reading JSON file.");
      console.error(err);
    }
  };
  fileReader.readAsText(event.target.files[0]);
}

// Load session-stored quote if available
function loadLastQuoteFromSession() {
  const last = sessionStorage.getItem("lastQuote");
  if (last) {
    try {
      const q = JSON.parse(last);
      showQuote(q);
    } catch (e) {
      console.error("Error reading session data:", e);
    }
  }
}

// Initialize app
document.addEventListener("DOMContentLoaded", () => {
  loadQuotes();
  createAddQuoteForm();
  loadLastQuoteFromSession();

  document.getElementById("newQuote").addEventListener("click", showRandomQuote);
});
