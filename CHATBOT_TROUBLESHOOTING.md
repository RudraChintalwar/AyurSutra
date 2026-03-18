# Troubleshooting Chatbot Connection Issues

## Quick Diagnosis

### Step 1: Run the Diagnostic Test
```bash
cd chatbot-service
python test_connection.py
```

This will check:
- ✅ Groq API Key configuration
- ✅ Python service connectivity (port 8000)
- ✅ Chat endpoint response
- ✅ Node.js server connectivity (port 3001)
- ✅ Node proxy routing

## Common Issues & Solutions

### Issue 1: "Cannot connect to Python service"
**Error message in test:** `❌ Cannot connect to Python service at http://localhost:8000`

**Solution:**
```bash
# Terminal 1 - Start Python service
cd chatbot-service
pip install -r requirements.txt  # (if not done before)
python main.py
```

You should see:
```
[Chatbot Init] Loaded GROQ_API_KEY: ✓
Starting Ayurvedic Chatbot Service on http://0.0.0.0:8000
INFO:     Uvicorn running on http://0.0.0.0:8000 (Press CTRL+C to quit)
```

---

### Issue 2: "API Key not found" or "GROQ_API_KEY not configured"
**Error message:** `⚠️ API Key seems invalid` or `❌ GROQ_API_KEY not found`

**Solution:**
1. Go to https://console.groq.com/keys
2. Copy your API key
3. Edit `chatbot-service/.env`:
   ```bash
   GROQ_API_KEY=gsk_YOUR_ACTUAL_KEY_HERE
   ```
4. Restart Python service: `python main.py`

**Verify:**
```bash
python -c "import os; from dotenv import load_dotenv; load_dotenv(); print(os.getenv('GROQ_API_KEY'))"
```

---

### Issue 3: "Bot returned error" message
**Example:** `Error: Invalid API key` or `Error: 401 Unauthorized`

**Cause:** Groq API key is invalid or revoked

**Solution:**
1. Get new key from https://console.groq.com/keys
2. Update `.env` with new key
3. Restart service

---

### Issue 4: "Cannot connect to Node server" (port 3001)
**Error message in test:** `❌ Cannot connect to Node server at http://localhost:3001`

**Solution:**
```bash
# Terminal 2 - Start Node server
cd server
npm install  # (if node_modules missing)
npm run dev
```

You should see:
```
🌿 AyurSutra API Server running on http://localhost:3001
```

---

### Issue 5: "Request timed out" or "internet connection error"
**Cause:** Groq API is unreachable or very slow

**Checklist:**
1. ✅ Internet connection is working
2. ✅ You can reach https://api.groq.com (test in browser)
3. ✅ Not rate-limited (wait 1 minute)
4. ✅ Firewall allows outbound HTTPS (port 443)

**Test:**
```bash
# Check if Groq API is reachable
python -c "import requests; print(requests.get('https://api.groq.com/health').status_code)"
```

---

### Issue 6: Chat works but "no audio response"
**Symptoms:** Text works but button for audio doesn't appear

**Cause:** gTTS (Google Text-to-Speech) might not be working

**Solution:**
```bash
# Check gTTS works
python -c "from gtts import gTTS; gTTS('test', lang='en').save('test.mp3')"
```

If error, reinstall:
```bash
pip install --upgrade gtts
```

---

## Debugging Checklist

### Terminal 1 - Python Service Logs
Watch these messages:
```
✅ [Chatbot Init] Loaded GROQ_API_KEY: ✓
✅ Uvicorn running on http://0.0.0.0:8000

When chatting:
✅ [Chat Request] Message: 'What is...'
✅ [API Call] Sending request to Groq API for language: English
✅ [API Response] Status: 200
✅ [Chat Response] Generated: 'Vata dosha is...'
```

**If you see errors:**
```
❌ [Chatbot Init] Loaded GROQ_API_KEY: ✗ MISSING
❌ [API Error] 401 Unauthorized - invalid API key
❌ [API Timeout] Cannot reach Groq API
```

### Terminal 2 - Node Server Logs
Watch these messages:
```
✅ [Chatbot] Calling Python service: http://localhost:8000/chat
✅ [Chatbot] Message: "What is..."
✅ [Chatbot] Response status: 200
✅ [Chatbot] Response received: {...}
```

### Browser Console (F12 Developer Tools)
Look for:
```
✅ [Chat] Sending to http://localhost:3001/api/chatbot/chat
✅ [Chat] Response: {success: true, reply: "...", language: "en"}
```

---

## Advanced Troubleshooting

### Test Python Service Directly
```bash
# In Python or bash
curl -X POST http://localhost:8000/chat \
  -H "Content-Type: application/json" \
  -d '{"message":"What is Ayurveda?","language":"en"}'
```

Expected response:
```json
{
  "user_message": "What is Ayurveda?",
  "bot_response": "Ayurveda is an ancient...",
  "language": "en"
}
```

### Test Node Server Directly
```bash
curl -X POST http://localhost:3001/api/chatbot/chat \
  -H "Content-Type: application/json" \
  -d '{"message":"What is Vata?","language":"en"}'
```

Expected response:
```json
{
  "success": true,
  "reply": "Vata is one of three doshas...",
  "language": "en"
}
```

### Test React Component
1. Open browser DevTools (F12)
2. Go to Console tab
3. Open the chat widget
4. Send a message
5. Look for: `[Chat]` messages

---

## Quick Fix Checklist

- [ ] Python service running on port 8000? `python main.py`
- [ ] Node server running on port 3001? `npm run dev`
- [ ] React client running on port 5173? `npm run dev`
- [ ] GROQ_API_KEY set in `.env`? Check with `echo $GROQ_API_KEY`
- [ ] Internet connection working?
- [ ] No firewall blocking ports?

---

## Still Not Working?

Collect this info and provide it:

1. **Output from test_connection.py**:
   ```bash
   cd chatbot-service
   python test_connection.py
   ```

2. **Python service log** (last 20 lines):
   Run service, send one message, copy the logs

3. **Node server log** (last 10 lines):
   Run server, check for `[Chatbot]` messages

4. **Browser console output** (F12 > Console):
   Send a message, copy any errors

5. **Confirm all three services running:**
   ```bash
   # Test each port
   curl -i http://localhost:8000/  # Python
   curl -i http://localhost:3001/api/health  # Node
   # React: just check browser shows page at 5173
   ```

---

## Performance Tips

- **First response slow?** Normal (10-30s) - Groq API cold start
- **Response timeout (20s)?** Check firewall, internet speed
- **Audio file not saving?** Check write permissions on `chatbot-service/audio_responses/`

---

## Get Help

If test_connection.py shows all ✅, then:
- Issue is likely browser-specific (use Chrome/Edge for best Web Speech API support)
- Clear browser cache: DevTools > Network > Disable cache

If test_connection.py shows ❌, share the output and we can fix it!
