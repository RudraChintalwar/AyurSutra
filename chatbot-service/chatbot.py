import os
import requests
from dotenv import load_dotenv
from langdetect import detect

load_dotenv()

GROQ_API_KEY = os.getenv("GROQ_API_KEY")

print(f"[Chatbot Init] Loaded GROQ_API_KEY: {'✓' if GROQ_API_KEY else '✗ MISSING'}")

def chatbot_response(user_message):
    if not GROQ_API_KEY:
        return "Error: GROQ_API_KEY not configured. Please set it in .env file."

    # 🔍 Detect language
    try:
        lang = detect(user_message)
    except:
        lang = "en"

    # 🎯 Map language
    if lang == "mr":
        language = "Marathi"
        script_rule = "Respond ONLY in Marathi using Devanagari script (मराठी लिपी). Do NOT use Roman Marathi."
    elif lang == "hi":
        language = "Hindi"
        script_rule = "Respond ONLY in Hindi using Devanagari script. Do NOT mix English."
    else:
        language = "English"
        script_rule = "Respond ONLY in English."

    url = "https://api.groq.com/openai/v1/chat/completions"

    headers = {
        "Authorization": f"Bearer {GROQ_API_KEY}",
        "Content-Type": "application/json"
    }

    system_prompt = f"""
You are a warm, friendly, and highly knowledgeable Ayurvedic wellness assistant for the AyurSutra platform.

YOUR PERSONALITY:
- Speak like a caring Ayurvedic doctor or wellness guide
- Be calm, friendly, empathetic, and supportive
- Make the user feel heard and comfortable
- Avoid robotic or overly technical responses

CORE EXPERTISE:
1. Tridosha Theory: Vata (वात), Pitta (पित्त), Kapha (कफ)
2. Panchakarma Therapies: Vamana, Virechana, Basti, Nasya, Raktamokshana
3. Herbal Remedies: Triphala, Chyawanprash, Dashamoola
4. Diet & Lifestyle: Dinacharya, Ritucharya
5. Yoga & Pranayama

STRICT LANGUAGE RULES:
- {script_rule}
- Do NOT mix languages
- Do NOT translate
- Output must be in ONE language only

DOMAIN RULES:
- Only answer Ayurveda, Panchakarma, herbs, lifestyle, and wellness
- Keep explanations simple, practical, and correct
- Avoid modern medical diagnosis unless necessary

CONVERSATION STYLE (VERY IMPORTANT):
- Always start with a warm, natural tone
- Keep answers concise (2–4 sentences)
- After answering, ask 1 relevant follow-up question to understand the user better
- Personalize responses based on user inputs (symptoms, lifestyle, habits)
- If user shares symptoms, gently explore:
  • duration
  • diet habits
  • sleep pattern
  • stress level

FOLLOW-UP QUESTION EXAMPLES:
- "Can you tell me when this started?"
- "How is your digestion and appetite?"
- "Do you feel more heat or cold in your body?"
- "How is your sleep these days?"

GUIDANCE STYLE:
- Suggest small, actionable steps (diet, herbs, routines)
- Prefer natural remedies over complex treatments initially
- For Panchakarma, suggest consulting a practitioner if needed

SAFETY:
- Do not give extreme or risky medical advice
- If condition seems serious, gently suggest consulting a doctor

IF OUTSIDE DOMAIN:
Reply in {language}:
"I specialize in Ayurveda and wellness. I’d be happy to help you with your health, diet, or lifestyle concerns."
"""

    data = {
        "model": "llama-3.1-8b-instant",
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_message}
        ],
        "max_tokens": 120
    }

    try:
        print(f"[API Call] Sending request to Groq API for language: {language}")
        response = requests.post(url, headers=headers, json=data, timeout=30)
        print(f"[API Response] Status: {response.status_code}")
        
        result = response.json()

        if response.status_code != 200:
            error_msg = result.get("error", {}).get("message", "Unknown error")
            print(f"[API Error] {error_msg}")
            return f"Error: {error_msg}"

        if "choices" not in result:
            print(f"[API Error] No choices in response: {result}")
            return "Error: Invalid response format from AI service"

        reply = result["choices"][0]["message"]["content"]

        # 🔥 CLEANUP (remove parenthesized translations/notes but keep the main answer)
        # e.g. "Vata (वात) is ..." => "Vata is ..."
        try:
            import re
            reply = re.sub(r"\s*\([^)]*\)", "", reply)
        except Exception:
            pass

        print(f"[API Success] Generated response ({len(reply)} chars)")
        return reply.strip()

    except requests.exceptions.Timeout:
        error = "Error: API request timed out (30s)"
        print(f"[API Timeout] {error}")
        return error
    except requests.exceptions.ConnectionError:
        error = "Error: Cannot connect to Groq API. Check internet connection."
        print(f"[API Connection Error] {error}")
        return error
    except Exception as e:
        error = f"Error: {str(e)}"
        print(f"[API Exception] {error}")
        return error
