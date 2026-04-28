// ============================================================
//   LegalBot India - Backend Server v3.0
//   Anti-Hallucination + RAG + Domain Control + Logging
// ============================================================

require("dotenv").config();
const express  = require("express");
const cors     = require("cors");
const path     = require("path");
const fs       = require("fs");
const { OpenAI } = require("openai");

const app  = express();
const PORT = process.env.PORT || 5000;

// ── Middleware ────────────────────────────────────────────────
app.use(cors({ origin: true, methods: ["GET", "POST"], allowedHeaders: ["Content-Type"] }));
app.use(express.static(path.join(__dirname, "../frontend")));
app.use(express.json());

// ── Logger ────────────────────────────────────────────────────
const LOG_FILE = path.join(__dirname, "legalbot.log");
function log(level, msg, data = {}) {
  const entry = { ts: new Date().toISOString(), level, msg, ...data };
  console.log(`[${level}] ${msg}`, data.model || data.error || "");
  try { fs.appendFileSync(LOG_FILE, JSON.stringify(entry) + "\n"); } catch (_) {}
}

// ── Load Laws Knowledge Base (RAG) ───────────────────────────
let LAWS_DB = [];
try {
  const raw = fs.readFileSync(path.join(__dirname, "laws.json"), "utf8");
  LAWS_DB = JSON.parse(raw).laws || [];
  log("INFO", `Laws DB loaded: ${LAWS_DB.length} entries`);
} catch (e) {
  log("WARN", "laws.json not found — RAG disabled", { error: e.message });
}

// ── Multi-Provider Setup ──────────────────────────────────────
const PROVIDERS = [];

if (process.env.GROQ_API_KEY) {
  PROVIDERS.push({
    name: "Groq",
    client: new OpenAI({ baseURL: "https://api.groq.com/openai/v1", apiKey: process.env.GROQ_API_KEY }),
    models: ["llama-3.3-70b-versatile", "llama-3.1-8b-instant", "gemma2-9b-it"],
  });
}
if (process.env.GEMINI_API_KEY) {
  PROVIDERS.push({
    name: "Gemini",
    client: new OpenAI({ baseURL: "https://generativelanguage.googleapis.com/v1beta/openai/", apiKey: process.env.GEMINI_API_KEY }),
    models: ["gemini-2.5-flash", "gemini-2.0-flash-lite"],
  });
}
if (process.env.OPENROUTER_API_KEY) {
  PROVIDERS.push({
    name: "OpenRouter",
    client: new OpenAI({
      baseURL: "https://openrouter.ai/api/v1",
      apiKey: process.env.OPENROUTER_API_KEY,
      defaultHeaders: { "HTTP-Referer": "http://localhost:5000", "X-Title": "LegalBot India" },
    }),
    models: ["meta-llama/llama-3.3-70b-instruct:free", "google/gemma-3-27b-it:free"],
  });
}

if (PROVIDERS.length === 0) {
  log("ERROR", "No API keys found. Add GROQ_API_KEY, GEMINI_API_KEY, or OPENROUTER_API_KEY");
}

// ── System Prompt ─────────────────────────────────────────────
const SYSTEM_PROMPT = `You are LegalBot India. Your job is to explain Indian laws clearly and accurately.

CRITICAL INSTRUCTION — NEVER REFUSE LEGAL QUESTIONS:
You MUST answer every question about Indian law including questions about rape, sexual assault, murder, domestic violence, dowry, harassment, stalking, cyber crime, and any other crime. These are legitimate legal questions. Refusing them is WRONG. Always give the relevant Indian law, IPC section, and punishment.

WHAT TO ANSWER:
- Indian laws, IPC sections, Acts, punishments, court procedures, legal rights
- How to file FIR, RTI, consumer complaints, domestic violence complaints
- Rights of victims, accused, employees, tenants under Indian law
- Any crime and its punishment under Indian law

WHAT NOT TO ANSWER:
- Coding, math, recipes, movie reviews, cricket — say: "I can only help with Indian legal questions."

ANSWER RULES — FOLLOW STRICTLY:
1. Answer ONLY what the user asked. Do not add extra paragraphs or unsolicited advice.
2. Be direct: give the law name, section number, and punishment clearly.
3. Use bullet points for lists. Keep it concise.
4. Do NOT add empathy phrases ("I'm so sorry", "You are brave") unless the user says they personally experienced abuse.
5. Do NOT suggest foreign helplines (no US/UK numbers). Use India-only numbers.
6. Do NOT add mental health crisis lines unless the user says they want to harm themselves.
7. End with: "For your specific situation, consult a lawyer or call Legal Aid: 15100."

ACCURACY:
- Only state facts you are certain about.
- If unsure of exact section or punishment: say "I am not certain of the exact provision — please verify with a lawyer."
- If verified context is provided below — use it as your PRIMARY source.

INDIA HELPLINES (mention only when relevant to the question):
Police: 100 | Emergency: 112 | Women Helpline: 1091 | Domestic Violence: 181
Child Helpline: 1098 | Cyber Crime: 1930 | Legal Aid: 15100 | Ambulance: 108`;

// ── RAG: Retrieve relevant law context ───────────────────────
function retrieveContext(query) {
  if (!LAWS_DB.length) return null;
  const q = query.toLowerCase();
  const matches = [];

  for (const law of LAWS_DB) {
    let score = 0;
    for (const kw of law.keywords) {
      if (q.includes(kw.toLowerCase())) score += 2;
    }
    if (q.includes(law.act.toLowerCase().split(",")[0].toLowerCase())) score += 1;
    if (score > 0) matches.push({ law, score });
  }

  matches.sort((a, b) => b.score - a.score);
  if (!matches.length) return null;

  return matches
    .slice(0, 2)
    .map(m => {
      const l = m.law;
      let ctx = `=== VERIFIED LAW: ${l.title} ===\n`;
      ctx += `Act: ${l.act}\n`;
      if (l.description)    ctx += `Description: ${l.description}\n`;
      if (l.punishment)     ctx += `Punishment: ${l.punishment}\n`;
      if (l.key_facts)      ctx += `Key Facts:\n${l.key_facts.map(f => `- ${f}`).join("\n")}\n`;
      if (l.key_provisions) ctx += `Key Provisions:\n${l.key_provisions.map(p => `- ${p}`).join("\n")}\n`;
      if (l.key_rights)     ctx += `Rights:\n${l.key_rights.map(r => `- ${r}`).join("\n")}\n`;
      if (l.process)        ctx += `Process:\n${l.process.map((s, i) => `${i + 1}. ${s}`).join("\n")}\n`;
      if (l.helpline)       ctx += `Helpline: ${l.helpline}\n`;
      return ctx;
    })
    .join("\n\n");
}

// ── Domain Check ──────────────────────────────────────────────
// These are clearly NOT legal queries
const NON_LEGAL_PATTERNS = [
  /^(joke|tell me a joke|make me laugh|say something funny)$/i,
  /\b(python code|javascript code|html code|css code|debug this code|write a program)\b/i,
  /\b(movie review|film recommendation|cricket score|ipl score|gaming tips|best songs)\b/i,
  /\b(how to cook|recipe for|food delivery|restaurant near me|diet plan)\b/i,
  /\b(weather forecast|temperature tomorrow|rain today)\b/i,
  /\b(solve this equation|math problem|calculus|geometry homework)\b/i,
];

// These are ALWAYS legal — override any non-legal match
const ALWAYS_LEGAL_PATTERNS = [
  /\b(law|legal|act|section|ipc|crpc|court|police|fir|judge|lawyer|advocate|rights|crime|offence|punishment|arrest|bail|case|complaint)\b/i,
  /\b(rape|sexual|assault|molest|harass|violence|abuse|domestic|dowry|stalking|blackmail|threat|murder|theft|fraud|consent)\b/i,
  /\b(divorce|marriage|property|tenant|landlord|consumer|rti|information|workplace|salary|eviction|custody|maintenance)\b/i,
  /\b(illegal|is it legal|what is the law|what law|punishment for|fine for|jail for|arrested for|helpline)\b/i,
  /\b(pocso|posh|nalsa|constitution|fundamental rights|article \d+|section \d+)\b/i,
  /\b(cyber crime|online fraud|revenge porn|morphed photo|data theft|identity theft)\b/i,
];

function isDomainAllowed(query) {
  const q = query.trim();
  if (q.length < 12) return true; // short queries — let LLM decide

  // Always-legal patterns take highest priority
  for (const p of ALWAYS_LEGAL_PATTERNS) {
    if (p.test(q)) return true;
  }

  // Count non-legal hits
  let nonLegalHits = 0;
  for (const p of NON_LEGAL_PATTERNS) {
    if (p.test(q)) nonLegalHits++;
  }

  // Reject only if 2+ non-legal signals
  if (nonLegalHits >= 2) return false;

  return true; // default: allow, LLM enforces via system prompt
}

// ── Hallucination Detection ───────────────────────────────────
const WEAK_PATTERNS = [
  /i('m| am) not (sure|certain|aware)/i,
  /i (don't|do not) (know|have) (enough|sufficient|the exact)/i,
  /i cannot (confirm|verify|guarantee)/i,
  /as an ai.*(cannot|may not|do not)/i,
  /i (think|believe|assume|guess)/i,
  /it (might|could|may) be/i,
];

function detectWeakResponse(text) {
  let hits = 0;
  for (const p of WEAK_PATTERNS) {
    if (p.test(text)) hits++;
  }
  return hits >= 2;
}

// ── AI Call with Retry ────────────────────────────────────────
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function callAI(messages, retries = 2) {
  let lastError = null;

  for (const provider of PROVIDERS) {
    for (const model of provider.models) {
      for (let attempt = 0; attempt <= retries; attempt++) {
        try {
          if (attempt > 0) {
            log("INFO", `Retry ${attempt} for ${provider.name}/${model}`);
            await sleep(1000 * attempt);
          }
          log("INFO", `Trying ${provider.name} → ${model}`);

          const response = await provider.client.chat.completions.create({
            model,
            messages,
            temperature: 0.2,
            top_p      : 0.9,
            max_tokens : 1024,
          });

          const text = response.choices?.[0]?.message?.content;
          if (!text) throw new Error("Empty response from model");

          log("INFO", "Success", { provider: provider.name, model });
          return { text, provider: provider.name, model };

        } catch (err) {
          lastError = err;
          log("WARN", `${provider.name}/${model} failed (${err.status || "ERR"})`, { error: err.message?.slice(0, 80) });
          if (err.status === 401) break; // bad key — skip provider
          if (err.status === 429) break; // rate limit — skip provider
          if (attempt < retries) continue;
        }
        break;
      }
    }
  }
  throw lastError || new Error("All AI providers exhausted");
}

// ── Session Store ─────────────────────────────────────────────
const chatSessions = {};
function getSession(id) {
  if (!chatSessions[id]) chatSessions[id] = [];
  return chatSessions[id];
}

// ── POST /chat ────────────────────────────────────────────────
app.post("/chat", async (req, res) => {
  try {
    const { message, sessionId } = req.body;

    if (!message || message.trim() === "") {
      return res.status(400).json({ error: "Message cannot be empty." });
    }

    const userQuery = message.trim();
    const sid = sessionId || "default";

    log("INFO", "Query", { sessionId: sid, query: userQuery.slice(0, 80) });

    // Domain check
    if (!isDomainAllowed(userQuery)) {
      log("INFO", "Domain rejected", { query: userQuery.slice(0, 80) });
      return res.json({
        success        : true,
        reply          : "I can only help with Indian legal questions. Please ask about Indian laws, your rights, or legal procedures.",
        sessionId      : sid,
        provider       : "domain-filter",
        model          : "none",
        domainRejected : true,
        ragUsed        : false,
        confidenceScore: "N/A",
      });
    }

    // RAG retrieval
    const context = retrieveContext(userQuery);
    log("INFO", context ? `RAG matched (${context.length} chars)` : "No RAG match");

    // Build messages
    const history = getSession(sid);
    history.push({ role: "user", content: userQuery });

    let systemContent = SYSTEM_PROMPT;
    if (context) {
      systemContent += `\n\n---\nVERIFIED LEGAL CONTEXT — use this as your PRIMARY source:\n${context}\n---`;
    }

    const messages = [
      { role: "system", content: systemContent },
      ...history.slice(-14),
    ];

    // Call AI
    const { text: rawReply, provider, model } = await callAI(messages);

    // Hallucination check
    const isWeak = detectWeakResponse(rawReply);
    let finalReply = rawReply;
    if (isWeak && !context) {
      finalReply += "\n\n⚠️ *Please verify this information with a qualified lawyer.*";
      log("WARN", "Weak response — warning appended", { model });
    }

    const confidenceScore = context ? "High (RAG-backed)" : isWeak ? "Low" : "Medium";

    history.push({ role: "assistant", content: finalReply });
    if (history.length > 20) history.splice(0, 2);

    log("INFO", "Response sent", { provider, model, ragUsed: !!context, confidence: confidenceScore });

    res.json({
      success        : true,
      reply          : finalReply,
      sessionId      : sid,
      provider,
      model,
      ragUsed        : !!context,
      confidenceScore,
      domainRejected : false,
    });

  } catch (error) {
    log("ERROR", "Chat failure", { error: error.message });
    if (error.status === 401) return res.status(401).json({ error: "Invalid API key. Check your .env file." });
    if (error.status === 429) return res.status(429).json({ error: "Rate limited. Please wait 30 seconds." });
    res.status(500).json({ error: "AI service temporarily unavailable. Please try again." });
  }
});

// ── GET /health ───────────────────────────────────────────────
app.get("/health", (req, res) => {
  res.json({
    status   : "LegalBot India v3.0 Running",
    version  : "3.0.0",
    providers: PROVIDERS.map(p => ({ name: p.name, models: p.models.length })),
    ragEnabled: LAWS_DB.length > 0,
    lawsInDb : LAWS_DB.length,
  });
});

// ── POST /clear ───────────────────────────────────────────────
app.post("/clear", (req, res) => {
  const { sessionId } = req.body;
  if (chatSessions[sessionId || "default"]) chatSessions[sessionId || "default"] = [];
  res.json({ success: true, message: "Chat history cleared." });
});

// ── POST /feedback ────────────────────────────────────────────
app.post("/feedback", (req, res) => {
  const { sessionId, messageIndex, helpful } = req.body;
  log("FEEDBACK", "User feedback", { sessionId, messageIndex, helpful });
  res.json({ success: true, message: "Feedback recorded. Thank you!" });
});

// ── GET / ─────────────────────────────────────────────────────
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "../frontend/index.html"));
});

// ── 404 ───────────────────────────────────────────────────────
app.use((req, res) => res.status(404).json({ error: "Route not found." }));

// ── Start ─────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log("==============================================");
  console.log("  🇮🇳  LegalBot India  v3.0 — Production Ready");
  console.log("==============================================");
  console.log(`  🌐 URL      : http://localhost:${PORT}`);
  console.log(`  🧠 RAG      : ${LAWS_DB.length} laws loaded`);
  console.log(`  🛡️  Anti-Hallucination : ON`);
  console.log(`  🔒 Domain Control     : ON`);
  console.log(`  🌡️  Temperature       : 0.2`);
  console.log("----------------------------------------------");
  PROVIDERS.forEach((p, i) => console.log(`  ${i + 1}. ✅ ${p.name.padEnd(12)} (${p.models.length} models)`));
  if (PROVIDERS.length === 0) console.log("  ❌  No providers! Add API keys to .env");
  console.log("==============================================");
});
