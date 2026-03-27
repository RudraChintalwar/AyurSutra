# AyurSutra Chatbot Service Setup Guide

## Overview
This guide explains how to set up and run the integrated voice-enabled chatbot service for AyurSutra with Groq AI and text-to-speech functionality.

## Architecture
The chatbot consists of three components:
1. **Python FastAPI Backend** (`chatbot-service/`) - Handles chat AI and speech generation
2. **Node.js Express Proxy** (`server/src/routes/chatbot.js`) - Proxies requests to Python service
3. **React Frontend** (`client/src/components/common/ChatbotWidget.tsx`) - Voice-enabled chat UI

## Prerequisites
- Python 3.8+ (installed)
- Node.js 18+ (installed)
- Groq API Key (free tier available at https://console.groq.com)

## Step 1: Set up Python Chatbot Service

### Install Dependencies
```bash
cd chatbot-service
pip install -r requirements.txt
```

### Configure Environment
1. Copy `.env` and add your Groq API key:
```bash
# chatbot-service/.env
GROQ_API_KEY=your_actual_groq_api_key_here
```

Get your Groq API key from: https://console.groq.com/keys

### Run Python Service
```bash
python main.py
```

The service will start on `http://localhost:8000`

You should see:
```
INFO:     Uvicorn running on http://0.0.0.0:8000
```

## Step 2: Configure Node.js Server

The server will automatically proxy requests to the Python service at `http://localhost:8000`

If you need to change the port, update in `.env`:
```bash
PYTHON_CHATBOT_URL=http://localhost:8000
```

## Step 3: Run the Application

### Terminal 1 - Python Service
```bash
cd chatbot-service
python main.py
```

### Terminal 2 - Node.js Server
```bash
cd server
npm run dev
```

The server runs on `http://localhost:3001`

### Terminal 3 - React Client
```bash
cd client
npm run dev
```

The client runs on `http://localhost:5173`

## Features

### Voice-to-Text
- Click the 🎤 microphone button to start recording
- Supports English, Hindi, Marathi, and Gujarati
- Uses Web Speech API (browser-native, no additional libraries needed)

### Text-to-Speech
- Bot responses are automatically converted to speech
- Supports multiple languages via Google Text-to-Speech (gTTS)
- Audio plays automatically after bot response

### Language Support
- English (en-US)
- Hindi (hi-IN)
- Marathi (mr-IN)
- Gujarati (gu-IN)

## API Endpoints

### POST `/api/chatbot/chat`
Send a message to the chatbot.

**Request:**
```json
{
  "message": "What is Vata dosha?",
  "language": "en"
}
```

**Response:**
```json
{
  "success": true,
  "reply": "Vata dosha is one of three doshas in Ayurveda...",
  "language": "en"
}
```

### POST `/api/chatbot/generate-speech`
Generate audio for text response.

**Request:**
```json
{
  "message": "Vata dosha is one of three doshas...",
  "language": "en"
}
```

**Response:**
```json
{
  "status": "success",
  "audio_url": "/audio/response_12345.mp3"
}
```

## Troubleshooting

### Issue: "Failed to get response from AyurVaidya"
**Solutions:**
1. Check Python service is running on port 8000
2. Verify Groq API key is correct in `.env`
3. Check internet connection for API calls
4. Verify CORS settings in FastAPI

### Issue: Speech Recognition Not Working
**Solutions:**
1. Use HTTPS or localhost (required for Web Speech API)
2. Browser must support Web Speech API (Chrome, Edge, Safari work best)
3. Grant microphone permissions when prompted

### Issue: Audio Not Playing
**Solutions:**
1. Check browser allows audio autoplay
2. Verify audio URL is accessible
3. Check browser console for CORS errors
4. Ensure gTTS can reach Google servers

### Issue: Wrong Language Response
**Solutions:**
1. Language detection uses `langdetect` library
2. Ensure your input is clearly in the chosen language
3. Try specifying language explicitly in UI dropdown

## Environment Variables

### Python Service (.env)
```bash
GROQ_API_KEY=your_groq_api_key
```

### Node Server (.env - optional)
```bash
PYTHON_CHATBOT_URL=http://localhost:8000
PORT=3001
```

## File Structure
```
AyurSutra/
├── chatbot-service/           # Python FastAPI backend
│   ├── main.py               # FastAPI app with endpoints
│   ├── chatbot.py            # Groq AI integration
│   ├── requirements.txt       # Python dependencies
│   └── .env                  # API keys
├── server/
│   └── src/routes/
│       └── chatbot.js        # Node proxy routes
└── client/
    └── src/components/common/
        └── ChatbotWidget.tsx # React chat component
```

## Performance Tips
1. **Groq API**: Free tier has rate limits (100-1000 requests/min)
2. **Audio**: Audio files are cached in `chatbot-service/audio_responses/`
3. **Language**: Language auto-detection adds ~100ms latency

## Security Considerations
1. Never commit `.env` files with API keys
2. Use environment variables in production
3. Rate limit API calls in production deployment
4. Validate user input on backend

## Production Deployment

### Using Docker
```dockerfile
# chatbot-service/Dockerfile
FROM python:3.10-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install -r requirements.txt
COPY . .
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
```

### Using systemd (Linux)
```ini
[Unit]
Description=AyurSutra Chatbot Service
After=network.target

[Service]
Type=simple
User=ayursutra
WorkingDirectory=/opt/ayursutra/chatbot-service
ExecStart=/usr/bin/python3 main.py
Restart=always

[Install]
WantedBy=multi-user.target
```

## Testing the API

### Using cURL
```bash
# Test chat endpoint
curl -X POST http://localhost:8000/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "What is Ayurveda?", "language": "en"}'

# Test speech endpoint
curl -X POST http://localhost:8000/generate-speech \
  -H "Content-Type: application/json" \
  -d '{"message": "Ayurveda is an ancient healing system.", "language": "en"}'
```

## Support & Debugging
1. Check Python service logs for API errors
2. Check Node server logs for proxy issues
3. Check browser console for frontend errors
4. Enable verbose logging in FastAPI for debugging

## Next Steps
1. ✅ Set up Python service
2. ✅ Configure Groq API key
3. ✅ Run Node proxy server
4. ✅ Start React client
5. Test chat functionality
6. Deploy to production (optional)
