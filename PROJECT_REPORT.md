# PROJECT REPORT

## Title: LegalBot India — Domain-Specific Generative AI Chatbot for Indian Laws & Women Safety

---

### 1. INTRODUCTION

In India, millions of citizens are unaware of their legal rights. Language barriers, complex legal jargon, and lack of accessible resources make it difficult for the common person — especially women — to understand laws that protect them.

**LegalBot India** is an AI-powered chatbot that bridges this gap by explaining Indian laws in simple **Hinglish** (Hindi + English mix). It supports both **text** and **voice** interaction, making it accessible to users across literacy and language levels.

---

### 2. OBJECTIVES

- Build a domain-specific Generative AI chatbot focused on Indian Laws
- Cover Women Safety Laws (Domestic Violence, Dowry, Sexual Harassment, Rape Laws)
- Support voice-based interaction using browser APIs
- Provide accurate, respectful, and easy-to-understand legal information
- Make legal awareness accessible to the general public

---

### 3. TECHNOLOGY STACK

| Component        | Technology Used                        |
|------------------|----------------------------------------|
| Frontend         | HTML5, CSS3, Vanilla JavaScript        |
| Backend          | Node.js v18+, Express.js v4            |
| AI/LLM           | Google Gemini 1.5 Flash                |
| Voice Input      | Web Speech API (SpeechRecognition)     |
| Voice Output     | Web Speech API (speechSynthesis)       |
| API Integration  | @google/generative-ai npm package      |
| Environment Vars | dotenv                                 |
| Cross-Origin     | cors npm package                       |
| Deployment       | Render (Backend), Vercel (Frontend)    |

---

### 4. SYSTEM ARCHITECTURE

```
[User]
  |
  |--- Types/Speaks Question
  |
[Frontend - Chrome Browser]
  |--- index.html (UI)
  |--- style.css (Styling)
  |--- script.js (Logic + Voice APIs)
  |
  |--- HTTP POST /chat (JSON) --->
  |
[Backend - Node.js + Express]
  |--- server.js
  |--- Validates input
  |--- Maintains chat history (memory)
  |--- Calls Gemini API
  |
  |--- Gemini API Call --->
  |
[Google Gemini 1.5 Flash]
  |--- Processes with System Prompt
  |--- Returns legal answer in Hinglish
  |
  <--- Response JSON ---
  |
[Frontend]
  |--- Displays bot bubble
  |--- Speaks reply (TTS)
```

---

### 5. KEY FEATURES

#### 5.1 Text Chat
- User types question in the input box
- Message sent via fetch() POST request to backend
- Backend calls Gemini AI with system prompt + chat history
- Response displayed as formatted chat bubble

#### 5.2 Voice Input (Speech-to-Text)
- User clicks 🎤 microphone button
- Browser's SpeechRecognition API activates
- Speech converted to text (language: hi-IN)
- Text placed in input box and auto-sent
- Visual wave animation shown while listening

#### 5.3 Voice Output (Text-to-Speech)
- After bot replies, speechSynthesis API speaks the response
- Hindi voice selected if available
- Rate set to 0.9 (slightly slower for clarity)
- Only first 500 characters spoken to avoid long delays

#### 5.4 Chat History (Memory)
- Server maintains last 10 conversation turns per session
- Gemini receives full context for coherent multi-turn conversations
- Each browser tab gets a unique session ID

#### 5.5 Quick Category Buttons
- Women Safety Laws
- Domestic Violence
- Dowry Laws
- Sexual Harassment
- Criminal Law (IPC)
- Divorce Laws
- Traffic Rules
- RTI Act

#### 5.6 Emergency Helpline Display
- Police: 100
- Women Helpline: 1091
- Domestic Violence Helpline: 181
- Child Helpline: 1098
- Legal Aid: 15100

---

### 6. DOMAIN COVERAGE — LAWS & ACTS

| Law / Act                                     | Year | Coverage                                   |
|-----------------------------------------------|------|--------------------------------------------|
| Protection of Women from Domestic Violence Act | 2005 | Physical, mental, economic abuse           |
| Dowry Prohibition Act                          | 1961 | Giving/taking dowry — punishable offence   |
| IPC Section 354                                | —    | Assault on woman to outrage modesty        |
| IPC Section 376                                | —    | Rape — up to life imprisonment             |
| IPC Section 498A                               | —    | Cruelty by husband/relatives               |
| POSH Act (Sexual Harassment at Workplace)      | 2013 | Internal Complaints Committee mandatory    |
| Hindu Marriage Act                             | 1955 | Divorce provisions for Hindu couples       |
| POCSO Act                                      | 2012 | Child sexual abuse protection              |
| Right to Information Act                       | 2005 | Citizens' right to seek govt. information  |
| Motor Vehicles Act                             | 1988 | Traffic rules and fines                    |
| Indian Constitution Articles 14, 15, 21        | 1950 | Equality, non-discrimination, right to life|

---

### 7. AI MODEL CONFIGURATION

#### Model: Google Gemini 1.5 Flash
- **Why Gemini?** Free API tier, fast response, multilingual support
- **Why Flash?** Lower latency, suitable for real-time chat

#### Parameters:
| Parameter   | Value | Purpose                                               |
|-------------|-------|-------------------------------------------------------|
| Temperature | 0.3   | Low = factual, consistent, accurate legal answers     |
| Top-P       | 0.8   | Moderate diversity while staying on topic             |
| Max Tokens  | 1024  | Enough for detailed legal explanations                |

#### System Prompt Design:
The system prompt defines:
1. Bot's role (Indian legal expert)
2. Language style (simple Hinglish)
3. Key laws to know
4. Behavioral rules (no harmful advice, suggest lawyers)
5. Emergency numbers to mention when relevant

---

### 8. VOICE TECHNOLOGY DETAILS

#### Speech-to-Text (STT):
```
API: window.SpeechRecognition / window.webkitSpeechRecognition
Language: hi-IN (Hindi-India)
Mode: Continuous = false (single utterance)
Interim Results: true (shows partial text while speaking)
Browser: Chrome / Edge only
```

#### Text-to-Speech (TTS):
```
API: window.speechSynthesis
Voice: Hindi (hi-IN) if available, else system default
Rate: 0.9 (slightly slower)
Pitch: 1.0 (natural)
Max chars spoken: 500 (to avoid very long speech)
```

---

### 9. API ENDPOINT DOCUMENTATION

#### POST /chat
```
URL: http://localhost:5000/chat
Method: POST
Content-Type: application/json

Request Body:
{
  "message": "Domestic Violence Act kya hai?",
  "sessionId": "session_1234567890"
}

Response:
{
  "success": true,
  "reply": "Domestic Violence Act 2005 ke baare mein...",
  "sessionId": "session_1234567890"
}
```

#### POST /clear
```
URL: http://localhost:5000/clear
Method: POST
Body: { "sessionId": "session_1234567890" }
Response: { "success": true, "message": "Chat history cleared!" }
```

#### GET /
```
URL: http://localhost:5000/
Response: { "status": "✅ LegalBot India Backend is Running!" }
```

---

### 10. DEPLOYMENT GUIDE

#### Backend → Render.com (Free):
1. Create GitHub repo → push `backend/` folder
2. Go to render.com → New Web Service
3. Connect repo, set Root Directory: `backend`
4. Build: `npm install` | Start: `node server.js`
5. Add env var: `GEMINI_API_KEY`

#### Frontend → Vercel.com (Free):
1. Push `frontend/` to GitHub
2. Import on vercel.com
3. Update `API_URL` in `script.js` to Render URL
4. Deploy → public URL

---

### 11. LIMITATIONS

- Voice feature only works in Chrome/Edge (not Firefox)
- Chat history is stored in RAM — lost on server restart (use MongoDB for production)
- Gemini free tier has rate limits (15 requests/minute)
- Legal information is general — not a substitute for professional legal advice

---

### 12. FUTURE SCOPE

- Multi-language support (Tamil, Telugu, Bengali)
- Document upload (analyze FIR, legal documents)
- Lawyer directory integration
- Mobile app (React Native)
- MongoDB for persistent chat history
- User authentication & case tracking

---

### 13. CONCLUSION

LegalBot India successfully demonstrates the application of Generative AI in the legal awareness domain. By combining the power of Google Gemini with voice interaction through browser-native APIs, the project makes Indian law accessible and understandable to the common person.

The chatbot is especially valuable for women who may not know their rights under the Domestic Violence Act, POSH Act, or Dowry Laws — giving them instant, respectful, and accurate information in their familiar language.

---




### 14. REFERENCES

1. Google Gemini API — https://ai.google.dev/
2. Web Speech API — https://developer.mozilla.org/en-US/docs/Web/API/Web_Speech_API
3. Ministry of Women & Child Development — https://wcd.nic.in/
4. India Code (Legal Database) — https://www.indiacode.nic.in/
5. National Legal Services Authority — https://nalsa.gov.in/
6. IPC Sections — https://indiankanoon.org/
7. Express.js Docs — https://expressjs.com/
8. Node.js Docs — https://nodejs.org/

---

*Project submitted for College Assessment — Generative AI Chatbot (Domain-Specific)*
