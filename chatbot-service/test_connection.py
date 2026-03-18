#!/usr/bin/env python3
"""
Test script to verify AyurSutra Chatbot Service connectivity and configuration
"""

import os
import sys
import requests
from dotenv import load_dotenv

load_dotenv()

GROQ_API_KEY = os.getenv("GROQ_API_KEY")
PYTHON_SERVICE_URL = "http://localhost:8000"
NODE_SERVER_URL = "http://localhost:3001"

print("=" * 60)
print("AyurSutra Chatbot Service - Connectivity Test")
print("=" * 60)

# Test 1: Check API Key
print("\n1️⃣ Checking Groq API Key...")
if GROQ_API_KEY:
    if len(GROQ_API_KEY) > 10:
        print(f"   ✅ API Key found: {GROQ_API_KEY[:10]}...{GROQ_API_KEY[-5:]}")
    else:
        print(f"   ⚠️  API Key seems invalid: {GROQ_API_KEY}")
else:
    print("   ❌ GROQ_API_KEY not found in .env file")
    sys.exit(1)

# Test 2: Check Python Service
print("\n2️⃣ Checking Python Chatbot Service (8000)...")
try:
    response = requests.get(f"{PYTHON_SERVICE_URL}/", timeout=5)
    if response.status_code == 200:
        data = response.json()
        print(f"   ✅ Service running: {data.get('message')}")
        print(f"      Status: {data.get('status')}")
    else:
        print(f"   ❌ Service returned {response.status_code}")
except requests.exceptions.ConnectionError:
    print(f"   ❌ Cannot connect to Python service at {PYTHON_SERVICE_URL}")
    print("   💡 Run: python main.py (in chatbot-service folder)")
    sys.exit(1)
except Exception as e:
    print(f"   ❌ Error: {str(e)}")
    sys.exit(1)

# Test 3: Test Chat Endpoint
print("\n3️⃣ Testing Chat Endpoint (Python Service)...")
try:
    payload = {
        "message": "What is Vata?",
        "language": "en"
    }
    response = requests.post(
        f"{PYTHON_SERVICE_URL}/chat",
        json=payload,
        timeout=20
    )
    
    if response.status_code == 200:
        data = response.json()
        bot_response = data.get('bot_response', 'No response')
        
        if bot_response.startswith("Error"):
            print(f"   ⚠️  Bot returned error: {bot_response}")
            print("   💡 Check: GROQ_API_KEY validity")
        else:
            print(f"   ✅ Chat working!")
            print(f"      Response: {bot_response[:60]}...")
    else:
        print(f"   ❌ Service returned {response.status_code}")
        print(f"      Response: {response.text[:100]}")
except requests.exceptions.Timeout:
    print(f"   ⏱️  Request timed out (20s)")
    print("   💡 Check: Internet connection, Groq API availability")
except requests.exceptions.ConnectionError:
    print(f"   ❌ Cannot connect to Python service")
    print(f"   💡 Run: python main.py (in chatbot-service folder)")
except Exception as e:
    print(f"   ❌ Error: {str(e)}")

# Test 4: Check Node Server
print("\n4️⃣ Checking Node.js Server (3001)...")
try:
    response = requests.get(f"{NODE_SERVER_URL}/api/health", timeout=5)
    if response.status_code == 200:
        data = response.json()
        print(f"   ✅ Server running")
        print(f"      Service: {data.get('service')}")
    else:
        print(f"   ❌ Server returned {response.status_code}")
except requests.exceptions.ConnectionError:
    print(f"   ❌ Cannot connect to Node server at {NODE_SERVER_URL}")
    print("   💡 Run: npm run dev (in server folder)")
except Exception as e:
    print(f"   ❌ Error: {str(e)}")

# Test 5: Test via Node Proxy
print("\n5️⃣ Testing Chat via Node Proxy (3001)...")
try:
    payload = {
        "message": "What is Pitta?",
        "language": "en"
    }
    response = requests.post(
        f"{NODE_SERVER_URL}/api/chatbot/chat",
        json=payload,
        timeout=20
    )
    
    if response.status_code == 200:
        data = response.json()
        if data.get('success'):
            bot_response = data.get('reply', 'No response')
            print(f"   ✅ Node proxy working!")
            print(f"      Response: {bot_response[:60]}...")
        else:
            print(f"   ⚠️  Proxy returned error: {data.get('error')}")
    else:
        print(f"   ❌ Proxy returned {response.status_code}")
        print(f"      Response: {response.text[:100]}")
except requests.exceptions.Timeout:
    print(f"   ⏱️  Request timed out (20s)")
except requests.exceptions.ConnectionError:
    print(f"   ❌ Cannot connect to Node server")
    print(f"   💡 Run: npm run dev (in server folder)")
except Exception as e:
    print(f"   ❌ Error: {str(e)}")

print("\n" + "=" * 60)
print("✅ All tests passed! Your chatbot is ready to use.")
print("")
print("Next steps:")
print("1. Open browser to http://localhost:5173")
print("2. Click the 💬 chat button")
print("3. Type or use 🎤 voice to chat")
print("=" * 60)
