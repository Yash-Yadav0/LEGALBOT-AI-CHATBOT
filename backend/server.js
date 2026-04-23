// ============================================================
//   LegalBot India - Backend Server (Node.js + Express)
//   Domain : Indian Laws & Women Safety Laws
//   AI     : Google Gemini API
// ============================================================

// ---------- 1. Load environment variables ----------
require("dotenv").config();

// ---------- 2. Import packages ----------
const express = require("express");
const cors    = require("cors");
const path    = require("path");
const { GoogleGenerativeAI } = require("@google/generative-ai");

// ---------- 3. Create Express app ----------
const app  = express();
const PORT = process.env.PORT || 5000;

// ---------- 4. Middleware ----------

// CORS – allow ALL origins (works for file://, localhost, Vercel, etc.)
// origin: true mirrors the request origin — perfect for college demo
app.use(cors({ origin: true, methods: ["GET", "POST"], allowedHeaders: ["Content-Type"] }));

// Serve frontend files from backend so browser opens via http:// (no file:// issues)
app.use(express.static(path.join(__dirname, "../frontend")));

// Parse incoming JSON bodies
app.use(express.json());

// ---------- 5. Initialize Gemini AI ----------
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// ---------- 6. System Prompt (the "brain" of the bot) ----------
const SYSTEM_PROMPT = `
You are LegalBot India — an expert AI legal assistant specializing in:
  • General Indian laws (IPC, CrPC, Constitution of India)
  • Women's safety and protection laws
  • Domestic violence, dowry, sexual harassment, rape laws, divorce laws

YOUR STYLE & EMOTIONAL INTELLIGENCE:
  • Speak in simple English so common people can understand
  • HIGH EMOTIONAL INTELLIGENCE: Always validate the user's feelings first. If they share a traumatic experience (abuse, harassment, fear), start by expressing deep empathy and comfort (e.g., "I am so sorry you are going through this. You are brave for seeking help. Please know this is not your fault and you are not alone.")
  • Be respectful, warm, and highly sensitive — never use robotic language when dealing with human pain.
  • NEVER engage in victim-blaming or judge the user's circumstances.
  • Give real-world examples to explain laws
  • Mention specific Acts and IPC sections when relevant
  • Keep answers clear, concise, and helpful
  • DYNAMIC EXPLANATION: If the user explicitly asks for "more detail", provide a highly detailed, comprehensive breakdown of the law. If the user asks to "explain in easy terms" or "like I'm 5", explain it using extremely basic language and everyday analogies without legal jargon.
  • Always suggest consulting a qualified lawyer for serious legal cases

KEY LAWS YOU KNOW (always be accurate):
  1. Domestic Violence Act 2005 (Protection of Women from Domestic Violence Act)
  2. Dowry Prohibition Act 1961
  3. IPC Section 354 – Assault or criminal force on woman with intent to outrage modesty
  4. IPC Section 376 – Punishment for rape
  5. IPC Section 498A – Cruelty by husband or relatives
  6. Sexual Harassment of Women at Workplace Act 2013 (POSH Act)
  7. Hindu Marriage Act 1955 (Divorce laws)
  8. Muslim Personal Law (Divorce provisions)
  9. Indian Constitution – Articles 14, 15, 21 (Equality and Right to Life)
  10. POCSO Act 2012 (Protection of Children from Sexual Offences)
  11. Motor Vehicles Act (Traffic Rules)
  12. Consumer Protection Act 2019
  13. Right to Information Act (RTI) 2005

IMPORTANT RULES:
  • NEVER give harmful, unethical, or illegal advice
  • NEVER encourage violence or unlawful actions
  • Always recommend calling 100 (Police) or 1091 (Women Helpline) for emergencies
  • If someone is in danger, immediately provide emergency numbers
  • Format your response with clear headings and bullet points when needed
  • CRITICAL OUT-OF-CONTEXT RULE: If the user asks a question that is NOT related to Indian Laws, Women Safety, or legal advice (for example: coding, math, recipes, movies, random chatting), you MUST refuse to answer. You should reply exactly with: "I'm not built for this. I can only help you with Indian laws and legal awareness."
  • ANTI-HALLUCINATION RULE: NEVER guess or invent fake laws, sections, or penalties. If you are not 100% sure about a specific law or IPC section, clearly state "I don't have the exact legal section for this, but generally..." Do not hallucinate legal facts.
  • LOCATION RULE: If the user mentions their city or location, you MUST attempt to provide the contact number for the main police station AND the name or contact of a major government or well-known hospital in that specific city. Always remind them to dial 112 for Police and 108 for Ambulance for immediate dispatch.

EMERGENCY NUMBERS TO MENTION WHEN RELEVANT:
  • Police: 100
  • Women Helpline: 1091
  • Domestic Violence Helpline: 181
  • Child Helpline: 1098
  • Legal Aid: 15100
  • Ambulance / Medical Emergency: 108
  • National Health Helpline: 104
`;

// ---------- 7. In-memory chat history (per session) ----------
// Note: In production, use a database (MongoDB) for persistent history
const chatSessions = {}; // sessionId → array of messages

// ---------- 8. Helper — get or create chat session ----------
function getSession(sessionId) {
  if (!chatSessions[sessionId]) {
    chatSessions[sessionId] = []; // fresh conversation
  }
  return chatSessions[sessionId];
}

// ---------- 9. POST /chat — Main chat endpoint ----------
app.post("/chat", async (req, res) => {
  try {
    const { message, sessionId } = req.body;

    // Validate input
    if (!message || message.trim() === "") {
      return res.status(400).json({
        error: "Message cannot be empty. Kuch to poochho! 😊",
      });
    }

    // Get this user's chat history
    const history = getSession(sessionId || "default");

    // ---- Build the Gemini model ----
    const model = genAI.getGenerativeModel({
      model: "gemini-flash-latest",   // Using generic latest to bypass overloaded specific models
      generationConfig: {
        temperature: 0.3,           // Low = more factual, accurate answers
        topP: 0.8,                  // Controls diversity of response
        maxOutputTokens: 1024,      // Max length of reply
      },
      systemInstruction: SYSTEM_PROMPT,
    });

    // ---- Start or continue chat ----
    const chat = model.startChat({
      history: history,             // Pass previous messages for memory
    });

    // ---- Send user message to Gemini ----
    const result = await chat.sendMessage(message);
    let botReply = "";
    try {
      botReply = result.response.text();
      if (!botReply) throw new Error("Empty response");
    } catch (textErr) {
      console.error("⚠️ Failed to parse response text (likely gibberish or blocked):", textErr.message);
      botReply = "I am sorry, I couldn't understand that. Please ask a clear question related to Indian Laws or Women's Safety.";
    }
    // ---- Save conversation history ----
    history.push({ role: "user",  parts: [{ text: message  }] });
    history.push({ role: "model", parts: [{ text: botReply }] });

    // Keep history to last 20 messages to save memory
    if (history.length > 20) {
      history.splice(0, 2); // Remove oldest pair
    }

    // ---- Send response back to frontend ----
    res.json({
      success : true,
      reply   : botReply,
      sessionId: sessionId || "default",
    });

  } catch (error) {
    console.error("❌ Error from Gemini API:", error.message);

    // Handle specific API errors
    if (error.message.includes("API_KEY_INVALID")) {
      return res.status(401).json({
        error: "Invalid API key. Please check your .env file.",
      });
    }

    if (error.message.includes("QUOTA_EXCEEDED") || error.message.includes("429 Too Many Requests") || error.message.includes("quota")) {
      return res.status(429).json({
        error: "Google API Quota Limit Reached! The free tier only allows 15 questions per minute. Please wait exactly 1 minute before asking your next question.",
      });
    }

    res.status(500).json({
      error: "Server error. Please wait a moment and try again.",
    });
  }
});

// ---------- 10. GET /health — Health check (JSON) ----------
app.get("/health", (req, res) => {
  res.json({
    status  : "✅ LegalBot India Backend is Running!",
    version : "1.0.0",
    message : "POST /chat endpoint is ready",
    model   : "Google Gemini 1.5 Flash",
    domain  : "Indian Laws & Women Safety",
  });
});

// GET / — Serve the frontend HTML
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "../frontend/index.html"));
});

// ---------- 11. POST /clear — Clear chat history ----------
app.post("/clear", (req, res) => {
  const { sessionId } = req.body;
  if (chatSessions[sessionId || "default"]) {
    chatSessions[sessionId || "default"] = [];
  }
  res.json({ success: true, message: "Chat history cleared!" });
});

// ---------- 12. Handle 404 routes ----------
app.use((req, res) => {
  res.status(404).json({ error: "Route not found. Yeh route exist nahi karta!" });
});

// ---------- 13. Start the server ----------
app.listen(PORT, () => {
  console.log("===========================================");
  console.log("  🇮🇳 LegalBot India Backend Started!");
  console.log(`  🌐 Open chatbot at: http://localhost:${PORT}`);
  console.log(`  📡 POST /chat — Chat endpoint ready`);
  console.log(`  🔑 API Key: ${process.env.GEMINI_API_KEY ? "✅ Loaded" : "❌ Missing!"}`);
  console.log("===========================================");
});
