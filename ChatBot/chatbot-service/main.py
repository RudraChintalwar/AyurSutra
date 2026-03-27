from fastapi import FastAPI, File, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel
from chatbot import chatbot_response
from gtts import gTTS
from langdetect import detect
import os
import io
import logging

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI()

class ChatRequest(BaseModel):
    message : str
    language: str = "en"
    
    
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Create audio directory if not exists
os.makedirs("audio_responses", exist_ok=True)

@app.get("/")
def home():
    logger.info("Health check endpoint called")
    return {"message":"Ayurvedic Chatbot API running", "status": "ok"}

@app.post("/chat")
def chat(request : ChatRequest):
    logger.info(f"[Chat Request] Message: '{request.message[:50]}...', Language: {request.language}")
    try:
        user_message = request.message
        response = chatbot_response(user_message)
        
        logger.info(f"[Chat Response] Generated: '{response[:50]}...'")
        
        # Detect language from response
        try:
            lang = detect(response)
        except:
            lang = "en"
        
        # Map to language code
        lang_map = {
            "mr": "mr",
            "hi": "hi",
            "en": "en",
            "gu": "gu"
        }
        
        tts_lang = lang_map.get(lang, "en")
        
        return{
            "user_message" : user_message,
            "bot_response" : response,
            "language": tts_lang
        }
    except Exception as e:
        logger.error(f"[Chat Error] {str(e)}")
        return {
            "user_message": request.message,
            "bot_response": f"Error: {str(e)}",
            "language": "en"
        }

@app.post("/generate-speech")
def generate_speech(request: ChatRequest):
    """Convert text response to speech"""
    logger.info(f"[Speech Request] Message: '{request.message[:50]}...', Language: {request.language}")
    try:
        # Detect language from response
        try:
            detected_lang = detect(request.message)
        except:
            detected_lang = "en"
        
        # Map language
        lang_map = {
            "mr": "mr",
            "hi": "hi",
            "en": "en",
            "gu": "gu"
        }
        
        tts_lang = lang_map.get(detected_lang, "en")
        
        # Generate speech
        logger.info(f"[gTTS] Generating speech in {tts_lang}")
        tts = gTTS(text=request.message, lang=tts_lang, slow=False)
        
        # Save to file
        audio_file = f"audio_responses/response_{hash(request.message) % 10000}.mp3"
        tts.save(audio_file)
        
        logger.info(f"[Speech Success] Saved to {audio_file}")
        
        return {
            "audio_url": f"/audio/{os.path.basename(audio_file)}",
            "status": "success"
        }
    except Exception as e:
        logger.error(f"[Speech Error] {str(e)}")
        return {
            "error": str(e),
            "status": "failed"
        }

@app.get("/audio/{filename}")
def get_audio(filename: str):
    """serve audio files"""
    logger.info(f"[Audio Request] {filename}")
    filepath = f"audio_responses/{filename}"
    if os.path.exists(filepath):
        return FileResponse(filepath, media_type="audio/mpeg")
    else:
        logger.warning(f"[Audio Error] File not found: {filepath}")
        return {"error": "File not found"}, 404

if __name__ == "__main__":
    import uvicorn
    logger.info("Starting Ayurvedic Chatbot Service on http://0.0.0.0:8080")
    uvicorn.run(app, host="0.0.0.0", port=8080)
