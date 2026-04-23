# 🇮🇳 LegalBot India — Quick Start Guide

## ✅ STEP 1: Get Your FREE Gemini API Key
1. Open → https://aistudio.google.com/app/apikey
2. Sign in with Google account
3. Click **"Create API Key"**
4. Copy the key (looks like: AIzaSy...)

## ✅ STEP 2: Add Key to .env File
Open: `backend/.env`
Replace the placeholder:
```
GEMINI_API_KEY=AIzaSy_YOUR_REAL_KEY_HERE
```

## ✅ STEP 3: Start Backend Server
Open terminal in the `backend/` folder and run:
```bash
node server.js
```
You should see:
```
🇮🇳 LegalBot India Backend Started!
🚀 Server running at http://localhost:5000
🔑 API Key: ✅ Loaded
```

## ✅ STEP 4: Open the Chatbot
- Open Chrome browser
- Open file: `frontend/index.html`
- OR use VS Code → Right-click index.html → "Open with Live Server"

## ✅ STEP 5: Test Voice Feature
- Make sure you're using **Chrome** browser
- Click the 🎤 mic button
- Allow microphone permission when Chrome asks
- Speak your question in Hindi or English
- Bot will reply and speak back!

---

## 🔄 Restart Server (if stopped)
```bash
cd backend
node server.js
```

## ☁️ Deploy Online (Free)
- Backend → https://render.com
- Frontend → https://vercel.com
- See README.md for full deployment steps
