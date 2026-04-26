// ============================================================
//   LegalBot India - Backend Server (Node.js + Express)
//   Domain  : Indian Laws & Women Safety Laws
//   AI      : MULTI-PROVIDER — Groq → Gemini → OpenRouter
//   Version : 2.0.0 — Never-Stop Architecture
// ============================================================

// ---------- 1. Load environment variables ----------
require("dotenv").config();

// ---------- 2. Import packages ----------
const express = require("express");
const cors    = require("cors");
const path    = require("path");
const { OpenAI } = require("openai");

// ---------- 3. Create Express app ----------
const app  = express();
const PORT = process.env.PORT || 5000;

// ---------- 4. Middleware ----------
app.use(cors({ origin: true, methods: ["GET", "POST"], allowedHeaders: ["Content-Type"] }));
app.use(express.static(path.join(__dirname, "../frontend")));
app.use(express.json());

// ---------- 5. MULTI-PROVIDER SETUP ----------
// Each provider uses the OpenAI-compatible SDK.
// Providers are tried IN ORDER. Within each provider, models are tried in order.
// As long as ONE provider + model works, the bot responds. 🚀

const PROVIDERS = [];

// ── Provider 1: GROQ (Fastest — 30 req/min free) ──────────────────────────────
// Get free key → https://console.groq.com  (no credit card needed)
if (process.env.GROQ_API_KEY) {
  PROVIDERS.push({
    name: "Groq",
    client: new OpenAI({
      baseURL: "https://api.groq.com/openai/v1",
      apiKey : process.env.GROQ_API_KEY,
    }),
    models: [
      "llama-3.3-70b-versatile",   // Best quality — 30 req/min
      "llama-3.1-8b-instant",      // Fastest — 30 req/min
      "gemma2-9b-it",              // Google Gemma on Groq
    ],
  });
}

// ── Provider 2: GOOGLE GEMINI (15 req/min, 1500 req/day free) ─────────────────
// Get free key → https://aistudio.google.com  (no credit card needed)
if (process.env.GEMINI_API_KEY) {
  PROVIDERS.push({
    name: "Gemini",
    client: new OpenAI({
      // Gemini supports OpenAI-compatible API — no extra package needed!
      baseURL: "https://generativelanguage.googleapis.com/v1beta/openai/",
      apiKey : process.env.GEMINI_API_KEY,
    }),
    models: [
      "gemini-2.5-flash",       // Latest Gemini — fast & smart
      "gemini-2.5-pro",         // More capable model
      "gemini-2.0-flash-lite",  // Lightest Gemini
    ],
  });
}

// ── Provider 3: OPENROUTER (Many free models) ─────────────────────────────────
// Get free key → https://openrouter.ai/keys  (no credit card needed)
if (process.env.OPENROUTER_API_KEY) {
  PROVIDERS.push({
    name: "OpenRouter",
    client: new OpenAI({
      baseURL: "https://openrouter.ai/api/v1",
      apiKey : process.env.OPENROUTER_API_KEY,
      defaultHeaders: {
        "HTTP-Referer": "http://localhost:5000",
        "X-Title"     : "LegalBot India",
      },
    }),
    models: [
      "openai/gpt-oss-20b:free",
      "meta-llama/llama-3.3-70b-instruct:free",
      "google/gemma-3-27b-it:free",
      "nvidia/nemotron-3-super-120b-a12b:free",
      "qwen/qwen3-next-80b-a3b-instruct:free",
      "google/gemma-3-12b-it:free",
    ],
  });
}

// Warn if no providers are configured
if (PROVIDERS.length === 0) {
  console.error("❌ FATAL: No API keys found in .env! Add at least one of:");
  console.error("   GROQ_API_KEY, GEMINI_API_KEY, or OPENROUTER_API_KEY");
}

// Helper: sleep N ms (used between 429 retries)
const sleep = (ms) => new Promise((res) => setTimeout(res, ms));

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
  • SITUATION BASED QUERIES: If the user describes a real-life situation, provide a step-by-step practical guide on what to do next, which authorities to approach, and the relevant laws applicable.
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
const chatSessions = {}; // sessionId → array of messages

// ---------- 8. Helper — get or create chat session ----------
function getSession(sessionId) {
  if (!chatSessions[sessionId]) {
    chatSessions[sessionId] = [];
  }
  return chatSessions[sessionId];
}

// ---------- 9. Core AI call — tries all providers & models ----------
async function callAI(messages) {
  let lastError = null;

  for (const provider of PROVIDERS) {
    for (const model of provider.models) {
      try {
        console.log(`🔄 Trying [${provider.name}] → ${model}`);
        const response = await provider.client.chat.completions.create({
          model,
          messages,
          temperature: 0.3,
          top_p      : 0.8,
          max_tokens : 1024,
        });
        const text = response.choices[0].message.content;
        if (!text) throw new Error("Empty response from model");
        console.log(`✅ Success! [${provider.name}] → ${model}`);
        return { text, provider: provider.name, model };
      } catch (err) {
        const code = err.status || err.code || "ERR";
        console.warn(`⚠️  [${provider.name}] ${model} failed (${code}): ${err.message?.slice(0, 80)}`);
        lastError = err;

        // If API key is invalid, skip this provider completely
        if (err.status === 401) {
          console.error(`🔑 Bad API key for [${provider.name}] — skipping to next provider`);
          break;
        }

        // If rate limited, don't waste time trying other models on the SAME provider — it'll be slow and just hit the limit again.
        // Skip directly to the next provider for a faster response.
        if (err.status === 429) {
          console.warn(`🐌 Rate limited by [${provider.name}] — immediately failing over to next provider`);
          break;
        }
      }
    }
  }

  // All providers failed
  throw lastError || new Error("All AI providers exhausted");
}

// ---------- 10. POST /chat — Main chat endpoint ----------
app.post("/chat", async (req, res) => {
  try {
    const { message, sessionId } = req.body;

    // Validate input
    if (!message || message.trim() === "") {
      return res.status(400).json({ error: "Message cannot be empty. Kuch to poochho! 😊" });
    }

    // Get this user's chat history
    const history = getSession(sessionId || "default");

    // Save user message
    history.push({ role: "user", content: message });

    // Build full message list (system prompt + history)
    const messages = [
      { role: "system", content: SYSTEM_PROMPT },
      ...history,
    ];

    // Call AI with multi-provider fallback
    const { text: botReply, provider, model } = await callAI(messages);

    // Save bot reply to history
    history.push({ role: "assistant", content: botReply });

    // Keep history to last 20 messages to save memory
    if (history.length > 20) history.splice(0, 2);

    // Send response
    res.json({
      success  : true,
      reply    : botReply,
      sessionId: sessionId || "default",
      provider,  // e.g. "Groq", "Gemini", "OpenRouter"
      model,     // e.g. "llama-3.3-70b-versatile"
    });

  } catch (error) {
    console.error("❌ All providers failed:", error.message);

    if (error.status === 401 || error.message?.includes("401")) {
      return res.status(401).json({ error: "Invalid API key. Please check your .env file." });
    }
    if (error.status === 429 || error.message?.includes("429")) {
      return res.status(429).json({ error: "All providers are rate-limited right now. Please wait 30 seconds and try again." });
    }

    res.status(500).json({ error: "All AI providers failed. Please try again in a moment." });
  }
});

// ---------- 11. GET /health — Health check ----------
app.get("/health", (req, res) => {
  const providerStatus = PROVIDERS.map(p => ({
    name  : p.name,
    models: p.models.length,
    active: true,
  }));

  res.json({
    status   : "✅ LegalBot India Backend is Running!",
    version  : "2.0.0",
    message  : "Multi-provider AI — Never-Stop Architecture",
    providers: providerStatus,
    totalProviders: PROVIDERS.length,
    domain   : "Indian Laws & Women Safety",
  });
});

// GET / — Serve the frontend HTML
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "../frontend/index.html"));
});

// ---------- 12. POST /clear — Clear chat history ----------
app.post("/clear", (req, res) => {
  const { sessionId } = req.body;
  if (chatSessions[sessionId || "default"]) {
    chatSessions[sessionId || "default"] = [];
  }
  res.json({ success: true, message: "Chat history cleared!" });
});

// ---------- 13. Handle 404 routes ----------
app.use((req, res) => {
  res.status(404).json({ error: "Route not found." });
});

// ---------- 14. Start the server ----------
app.listen(PORT, () => {
  console.log("==============================================");
  console.log("  🇮🇳  LegalBot India  v2.0 — Never-Stop!");
  console.log("==============================================");
  console.log(`  🌐 Open    : http://localhost:${PORT}`);
  console.log(`  📡 Chat    : POST /chat`);
  console.log(`  ⚕️  Health  : http://localhost:${PORT}/health`);
  console.log("----------------------------------------------");
  console.log("  🔌 ACTIVE PROVIDERS:");
  if (PROVIDERS.length === 0) {
    console.log("  ❌  None! Add API keys to .env file!");
  } else {
    PROVIDERS.forEach((p, i) => {
      console.log(`  ${i + 1}. ✅ ${p.name.padEnd(12)} (${p.models.length} models)`);
    });
  }
  console.log("----------------------------------------------");
  console.log("  💡 Add more keys to .env for more uptime:");
  if (!process.env.GROQ_API_KEY)
    console.log("     ➕ GROQ_API_KEY    → https://console.groq.com");
  if (!process.env.GEMINI_API_KEY)
    console.log("     ➕ GEMINI_API_KEY  → https://aistudio.google.com");
  if (!process.env.OPENROUTER_API_KEY)
    console.log("     ➕ OPENROUTER_API_KEY → https://openrouter.ai/keys");
  console.log("==============================================");
});
