// ============================================================
//   LegalBot India — Frontend JavaScript
//   Features: Chat, Voice Input (STT), Voice Output (TTS)
// ============================================================

// ---------- 1. Configuration ----------
const CONFIG = {
  // Backend URL — now pointing to the live Render deployment
  API_URL: "https://legalbot-ai-chatbot.onrender.com/chat",
  CLEAR_URL: "https://legalbot-ai-chatbot.onrender.com/clear",
  SESSION_ID: "session_" + Date.now(), // Unique session per tab
};

// ---------- 2. DOM References ----------
const chatMessages    = document.getElementById("chatMessages");
const userInput       = document.getElementById("userInput");
const sendBtn         = document.getElementById("sendBtn");
const micBtn          = document.getElementById("micBtn");
const typingIndicator = document.getElementById("typingIndicator");
const voiceStatus     = document.getElementById("voiceStatus");
const voiceStatusText = document.getElementById("voiceStatusText");
const welcomeScreen   = document.getElementById("welcomeScreen");
const toast           = document.getElementById("toast");

// ---------- 3. State ----------
let isListening  = false;  // Is mic active?
let isSpeaking   = false;  // Is TTS playing?
let isVoiceOutputEnabled = false; // Does user want auto voice?
let recognition  = null;   // SpeechRecognition instance
let messageCount = 0;      // Count messages to hide welcome screen

// ============================================================
//   SECTION A — SEND MESSAGE (Text Chat)
// ============================================================

async function sendMessage(text) {
  // Get text from input box OR from function parameter (voice)
  const message = (text || userInput.value).trim();
  if (!message) { showToast("Please type or speak something! 😊"); return; }

  // Hide welcome screen on first message
  if (welcomeScreen) welcomeScreen.style.display = "none";

  // Clear input & reset height
  userInput.value = "";
  autoResize(userInput);

  // Show user bubble
  appendMessage("user", message);

  // Disable send button while waiting
  sendBtn.disabled = true;
  sendBtn.style.opacity = "0.6";

  // Show typing indicator
  showTyping(true);

  try {
    // POST request to backend
    const response = await fetch(CONFIG.API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message:   message,
        sessionId: CONFIG.SESSION_ID,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Server error");
    }

    // Show bot reply
    showTyping(false);
    appendMessage("bot", data.reply);

    // 🔊 Speak the bot's reply using TTS if enabled
    if (isVoiceOutputEnabled) {
      speakText(data.reply);
    }

  } catch (error) {
    showTyping(false);
    const errMsg = "Sorry, something went wrong! 😔 Please check your internet connection or try again.\n\nError: " + error.message;
    appendMessage("bot", errMsg);
    console.error("❌ Fetch error:", error);
  } finally {
    sendBtn.disabled = false;
    sendBtn.style.opacity = "1";
  }
}

// ============================================================
//   SECTION B — APPEND MESSAGE BUBBLE
// ============================================================

function appendMessage(role, text) {
  messageCount++;

  const row = document.createElement("div");
  row.className = `message-row ${role}`;

  const avatar = document.createElement("div");
  avatar.className = `msg-avatar ${role}`;
  avatar.textContent = role === "bot" ? "⚖️" : "👤";

  const content = document.createElement("div");
  content.className = "msg-content";

  const bubble = document.createElement("div");
  bubble.className = `bubble ${role}`;
  // Format bot text (convert **bold** and newlines)
  bubble.innerHTML = role === "bot" ? formatBotText(text) : escapeHtml(text);

  const time = document.createElement("div");
  time.className = "msg-time";
  time.textContent = getCurrentTime();

  content.appendChild(bubble);
  content.appendChild(time);

  row.appendChild(avatar);
  row.appendChild(content);

  chatMessages.appendChild(row);

  // Smooth scroll to bottom
  chatMessages.scrollTo({ top: chatMessages.scrollHeight, behavior: "smooth" });
}

// ============================================================
//   SECTION C — TEXT FORMATTING
// ============================================================

function formatBotText(text) {
  // Escape HTML first
  let formatted = escapeHtml(text);

  // Convert **bold** → <strong>
  formatted = formatted.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");

  // Convert *italic* → <em>
  formatted = formatted.replace(/\*(.*?)\*/g, "<em>$1</em>");

  // Convert lines starting with • or - to styled bullets
  formatted = formatted.replace(/^[•\-] (.+)$/gm, '<span style="display:block;padding-left:12px;margin:2px 0;">• $1</span>');

  // Convert newlines to <br>
  formatted = formatted.replace(/\n/g, "<br>");

  return formatted;
}

function escapeHtml(text) {
  const div = document.createElement("div");
  div.appendChild(document.createTextNode(text));
  return div.innerHTML;
}

function getCurrentTime() {
  return new Date().toLocaleTimeString("en-IN", {
    hour: "2-digit", minute: "2-digit",
  });
}

// ============================================================
//   SECTION D — TYPING INDICATOR
// ============================================================

function showTyping(show) {
  typingIndicator.style.display = show ? "flex" : "none";
  if (show) {
    chatMessages.scrollTo({ top: chatMessages.scrollHeight, behavior: "smooth" });
  }
}

// ============================================================
//   SECTION E — VOICE INPUT (Speech → Text)
//   Uses Web Speech API (SpeechRecognition)
//   Works in Chrome / Edge
// ============================================================

function toggleVoiceInput() {
  // Check browser support
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

  if (!SpeechRecognition) {
    showToast("❌ Voice not supported. Please use Chrome browser!");
    return;
  }

  if (isListening) {
    // --- Stop listening ---
    stopListening();
  } else {
    // --- Start listening ---
    startListening(SpeechRecognition);
  }
}

function startListening(SpeechRecognition) {
  recognition = new SpeechRecognition();

  // Configuration
  recognition.lang           = "en-IN"; // Indian English
  recognition.interimResults = true;    // Show partial results
  recognition.maxAlternatives = 1;
  recognition.continuous     = false;

  // Update UI to "listening" state
  isListening = true;
  micBtn.classList.add("listening");
  micBtn.textContent = "🛑";
  voiceStatus.style.display = "flex";
  voiceStatusText.textContent = "Listening... Please speak! 🎤";

  // --- Event: interim / final results ---
  recognition.onresult = (event) => {
    let interimText = "";
    let finalText   = "";

    for (let i = event.resultIndex; i < event.results.length; i++) {
      const transcript = event.results[i][0].transcript;
      if (event.results[i].isFinal) {
        finalText += transcript;
      } else {
        interimText += transcript;
      }
    }

    // Show partial text in input box
    userInput.value = finalText || interimText;
    autoResize(userInput);

    // When final — auto send
    if (finalText) {
      voiceStatusText.textContent = "Processing... ✅";
      setTimeout(() => {
        stopListening();
        sendMessage(finalText);
      }, 300);
    }
  };

  // --- Event: speech detected ---
  recognition.onspeechstart = () => {
    voiceStatusText.textContent = "Speech detected! Keep speaking... 🎙️";
  };

  // --- Event: no speech ---
  recognition.onspeechend = () => {
    voiceStatusText.textContent = "Processing...";
    recognition.stop();
  };

  // --- Event: error ---
  recognition.onerror = (event) => {
    stopListening();
    if (event.error === "not-allowed") {
      showToast("🎤 Mic permission denied. Please allow microphone access.");
    } else if (event.error === "no-speech") {
      showToast("No speech detected. Please try again! 🎤");
    } else {
      showToast("Voice error: " + event.error);
    }
  };

  // --- Event: recognition ended ---
  recognition.onend = () => {
    if (isListening) stopListening();
  };

  // Start
  recognition.start();
}

function stopListening() {
  isListening = false;
  micBtn.classList.remove("listening");
  micBtn.textContent = "🎤";
  voiceStatus.style.display = "none";

  if (recognition) {
    try { recognition.stop(); } catch (e) {}
    recognition = null;
  }
}

// ============================================================
//   SECTION F — VOICE OUTPUT (Text → Speech)
//   Uses Web Speech API (speechSynthesis)
// ============================================================

function speakText(text) {
  // Cancel any ongoing speech
  window.speechSynthesis.cancel();

  if (!text) return;

  // Clean text — remove markdown symbols before speaking
  const cleanText = text
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/\*(.*?)\*/g, "$1")
    .replace(/#{1,3}\s/g, "")
    .replace(/•/g, "")
    .replace(/\n/g, " ")
    .trim();

  // Limit TTS to first 500 chars to avoid very long speech
  const spokenText = cleanText.length > 500 ? cleanText.substring(0, 500) + "..." : cleanText;

  const utterance = new SpeechSynthesisUtterance(spokenText);

  const voices = window.speechSynthesis.getVoices();
  
  // Try to find a male Indian voice (Indian English or Hindi)
  // Common male voice names: Ravi, Hemant, Rishi, Neil, Male
  const maleVoice = voices.find(v => 
    (v.lang === "en-IN" || v.lang.startsWith("hi")) && 
    (v.name.toLowerCase().includes("male") || v.name.includes("Hemant") || v.name.includes("Ravi") || v.name.includes("Rishi") || v.name.includes("Neil"))
  );

  // Fallback to any English voice
  const engVoice = voices.find(v => v.lang.startsWith("en"));

  if (maleVoice) {
    utterance.voice = maleVoice;
  } else if (engVoice) {
    utterance.voice = engVoice;
  }

  utterance.lang  = "en-IN";
  utterance.rate  = 0.9;   // Slightly slower — easier to understand
  utterance.pitch = 1.0;
  utterance.volume = 1.0;

  utterance.onstart = () => { isSpeaking = true; };
  utterance.onend   = () => { isSpeaking = false; };

  window.speechSynthesis.speak(utterance);
}

// Toggle Voice Output on/off
function toggleVoiceOutput() {
  isVoiceOutputEnabled = !isVoiceOutputEnabled;
  const toggleBtn = document.getElementById("voiceToggleBtn");
  const toggleIcon = document.getElementById("voiceToggleIcon");
  const toggleText = document.getElementById("voiceToggleText");
  
  if (isVoiceOutputEnabled) {
    toggleIcon.textContent = "🔊";
    toggleText.textContent = "Voice On";
    toggleBtn.style.background = "rgba(76, 175, 80, 0.1)";
    toggleBtn.style.color = "#4caf50";
    toggleBtn.style.borderColor = "rgba(76, 175, 80, 0.3)";
    showToast("🔊 Voice Output Enabled");
  } else {
    toggleIcon.textContent = "🔇";
    toggleText.textContent = "Voice Off";
    toggleBtn.style.background = "rgba(255, 152, 0, 0.1)";
    toggleBtn.style.color = "#ff9800";
    toggleBtn.style.borderColor = "rgba(255, 152, 0, 0.3)";
    window.speechSynthesis.cancel(); // Stop currently playing audio
    showToast("🔇 Voice Output Disabled");
  }
}

// ============================================================
//   SECTION G — QUICK CATEGORY QUERIES
// ============================================================

const QUICK_QUERIES = {
  women:    "Tell me about women safety laws — what are the main acts?",
  domestic: "What is the Domestic Violence Act 2005 and what rights does it give?",
  dowry:    "What is the Dowry Prohibition Act? Is giving or taking dowry illegal?",
  sexual:   "What does the POSH Act 2013 say about sexual harassment at the workplace?",
  criminal: "What is IPC? Tell me about Sections 354 and 376.",
  divorce:  "What are the divorce laws in India? What does the Hindu Marriage Act say?",
  traffic:  "What are the traffic rules under the Motor Vehicles Act? How much is the fine?",
  rti:      "What is the RTI Act 2005? How can we request information from the government?",
};

function sendQuickQuery(category) {
  const query = QUICK_QUERIES[category];
  if (query) {
    userInput.value = query;
    sendMessage(query);
    // Close sidebar on mobile after selecting
    if (window.innerWidth <= 768) toggleSidebar();
  }
}

// ============================================================
//   SECTION H — UTILITY FUNCTIONS
// ============================================================

// Set text in input box (from welcome chips)
function setInput(text) {
  userInput.value = text;
  userInput.focus();
  autoResize(userInput);
}

// Auto-resize textarea as user types
function autoResize(textarea) {
  textarea.style.height = "auto";
  textarea.style.height = Math.min(textarea.scrollHeight, 120) + "px";
}

// Handle Enter key (send) — Shift+Enter = new line
function handleKeyDown(event) {
  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault();
    sendMessage();
  }
}

// Toggle mobile sidebar
function toggleSidebar() {
  const sidebar = document.getElementById("sidebar");
  sidebar.classList.toggle("open");
}

// Clear chat history
async function clearChat() {
  // Clear UI
  chatMessages.innerHTML = "";
  // Re-show welcome screen
  const welcome = document.createElement("div");
  welcome.id = "welcomeScreen";
  welcome.className = "welcome-screen";
  welcome.innerHTML = `
    <div class="welcome-icon">⚖️</div>
    <h2>Hello! I am LegalBot India 🙏</h2>
    <p>Start a new conversation. Ask any law-related question in English!</p>
    <div class="welcome-chips">
      <button onclick="setInput('What is the Domestic Violence Act?')">Domestic Violence Act?</button>
      <button onclick="setInput('What are the Dowry Laws?')">Dowry Laws?</button>
      <button onclick="setInput('What is IPC 376?')">IPC 376?</button>
    </div>`;
  chatMessages.appendChild(welcome);

  // Clear backend session
  try {
    await fetch(CONFIG.CLEAR_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId: CONFIG.SESSION_ID }),
    });
  } catch (e) { /* Ignore if offline */ }

  showToast("🗑️ Chat cleared! Start a new conversation.");
}

// Toast notification
let toastTimeout;
function showToast(message) {
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => toast.classList.remove("show"), 3500);
}

// ============================================================
//   SECTION I — INITIALISATION
// ============================================================

// Load voices when they become available
window.speechSynthesis.onvoiceschanged = () => {
  window.speechSynthesis.getVoices(); // Warm up voice list
};

// Close sidebar when clicking outside on mobile
document.addEventListener("click", (e) => {
  const sidebar = document.getElementById("sidebar");
  const menuToggle = document.getElementById("menuToggle");
  if (
    window.innerWidth <= 768 &&
    sidebar.classList.contains("open") &&
    !sidebar.contains(e.target) &&
    e.target !== menuToggle
  ) {
    sidebar.classList.remove("open");
  }
});

// Input focus on load
window.addEventListener("load", () => {
  userInput.focus();

  // Check if Chrome for voice feature notice
  const isChrome = /Chrome/.test(navigator.userAgent) && /Google Inc/.test(navigator.vendor);
  if (!isChrome) {
    showToast("💡 Voice feature works best in Chrome browser!");
  }
});

console.log("🇮🇳 LegalBot India — Frontend Loaded Successfully!");
console.log("📡 Backend URL:", CONFIG.API_URL);
