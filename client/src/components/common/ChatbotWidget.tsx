import React, { useState, useRef, useEffect } from 'react';
import { MessageSquare, X, Send, Loader2, Bot, User } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import axios from 'axios';

interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  audioUrl?: string;
}

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

export default function ChatbotWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    { id: '0', role: 'assistant', content: "नमस्ते! I am AyurVaidya, your digital Ayurvedic health assistant. How can I guide you towards better health today?" }
  ]);
  const [input, setInput] = useState('');
  const [language, setLanguage] = useState('en');
  const [isLoading, setIsLoading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const audioPlayerRef = useRef<HTMLAudioElement>(null);
  const recognitionRef = useRef<any>(null);
  const { user } = useAuth();
  const [hasUnread, setHasUnread] = useState(false);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // Initialize Speech Recognition
  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (SpeechRecognition) {
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = false;
      recognitionRef.current.interimResults = true;

      recognitionRef.current.onstart = () => {
        setIsRecording(true);
      };

      recognitionRef.current.onresult = (event: any) => {
        let interim = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          interim += event.results[i][0].transcript;
        }
        setTranscript(interim);
        setInput(interim);
      };

      recognitionRef.current.onend = () => {
        setIsRecording(false);
      };

      recognitionRef.current.onerror = (event: any) => {
        console.error('Speech recognition error:', event.error);
        setIsRecording(false);
      };
    }
  }, []);

  const toggleVoiceInput = () => {
    if (!recognitionRef.current) {
      alert('Speech Recognition not supported in your browser');
      return;
    }

    if (isRecording) {
      recognitionRef.current.stop();
    } else {
      const langMap: { [key: string]: string } = {
        en: 'en-US',
        hi: 'hi-IN',
        mr: 'mr-IN',
        gu: 'gu-IN',
      };

      recognitionRef.current.lang = langMap[language] || 'en-US';
      recognitionRef.current.start();
      setTranscript('');
    }
  };

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
      setHasUnread(false);
    }
  }, [messages, isOpen]);

  const toggleWidget = () => {
    setIsOpen(!isOpen);
    if (!isOpen) {
      setHasUnread(false);
    }
  };

  const handleSend = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage = input.trim();
    setInput('');
    setTranscript('');
    
    // Add user message to UI immediately
    setMessages(prev => [...prev, { id: String(Date.now()), role: 'user', content: userMessage }]);
    setIsLoading(true);

    try {
      console.log(`[Chat] Sending to ${API_URL}/api/chatbot/chat`);
      const response = await axios.post(`${API_URL}/api/chatbot/chat`, {
        message: userMessage,
        language: language,
      });
      
      console.log('[Chat] Response:', response.data);
      
      if (response.data.success) {
        const botReply = response.data.reply || response.data.bot_response;
        setMessages(prev => [...prev, { 
          id: String(Date.now() + 1), 
          role: 'assistant', 
          content: botReply 
        }]);
        if (!isOpen) setHasUnread(true);

        // Generate speech
        generateSpeech(botReply, language);
      } else {
        throw new Error(response.data.error || 'Failed to get response');
      }
    } catch (error: any) {
      console.error('[Chat Error]', error.message);
      
      let errorMsg = "I'm sorry, I'm having trouble connecting right now. Please try again in a moment.";
      
      if (error.message.includes('ERR_INVALID_URL')) {
        errorMsg = "⚠️ API URL not configured. Check VITE_API_URL environment variable.";
      } else if (error.code === 'ECONNREFUSED') {
        errorMsg = "❌ Cannot connect to server. Is it running?";
      } else if (error.response?.status === 500) {
        errorMsg = "❌ Server error: Check Python service is running on port 8000";
      }
      
      setMessages(prev => [...prev, { 
        id: String(Date.now()), 
        role: 'assistant', 
        content: errorMsg
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const generateSpeech = async (text: string, lang: string) => {
    try {
      const response = await axios.post(`${API_URL}/api/chatbot/generate-speech`, {
        message: text,
        language: lang,
      });

      if (response.data.status === 'success' && audioPlayerRef.current) {
        audioPlayerRef.current.src = response.data.audio_url;
        audioPlayerRef.current.play().catch(err => console.log('Audio play error:', err));
      }
    } catch (error) {
      console.error('Speech generation error:', error);
    }
  };

  const playAudio = (audioUrl: string) => {
    if (audioPlayerRef.current) {
      audioPlayerRef.current.src = audioUrl;
      audioPlayerRef.current.play().catch(err => console.log('Audio play error:', err));
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end">
      {/* Chat Window */}
      {isOpen && (
        <div className="bg-white w-80 sm:w-96 rounded-2xl shadow-2xl border border-gray-100 mb-4 overflow-hidden flex flex-col h-[500px] max-h-[80vh] font-inter animate-in slide-in-from-bottom-5">
          {/* Header */}
          <div className="bg-gradient-to-r from-primary to-green-600 p-4 text-white flex justify-between items-center shadow-md">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center backdrop-blur-sm">
                <Bot className="w-6 h-6 text-white" />
              </div>
              <div>
                <h3 className="font-semibold text-lg leading-tight">Digital Vaidya</h3>
                <p className="text-white/80 text-xs flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-green-300"></span> Online
                </p>
              </div>
            </div>
            <button 
              onClick={toggleWidget}
              className="p-2 hover:bg-white/20 rounded-full transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Language Selector */}
          <div className="px-4 py-3 bg-slate-50 border-b border-gray-100 flex items-center gap-3">
            <label htmlFor="lang-select" className="text-xs font-medium text-gray-600">Language:</label>
            <select
              id="lang-select"
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              className="text-xs px-2 py-1 border border-gray-300 rounded bg-white focus:outline-none focus:ring-2 focus:ring-primary/20"
            >
              <option value="en">🇬🇧 English</option>
              <option value="hi">🇮🇳 Hindi</option>
              <option value="mr">🇮🇳 Marathi</option>
              <option value="gu">🇮🇳 Gujarati</option>
            </select>
          </div>

          {/* Messages Area */}
          <div className="flex-1 p-4 overflow-y-auto bg-slate-50 flex flex-col gap-4">
            <div className="text-center text-xs text-slate-400 my-2">
              <span className="bg-white px-2 py-1 rounded-full shadow-sm border border-slate-100">
                Voice & Text Support
              </span>
            </div>
            
            {messages.map((msg) => (
              <div 
                key={msg.id} 
                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div className={`flex max-w-[85%] gap-2 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                  
                  {/* Avatar */}
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 mt-auto ${
                    msg.role === 'user' ? 'bg-primary/20 text-primary' : 'bg-amber-100 text-amber-700'
                  }`}>
                    {msg.role === 'user' ? <User className="w-4 h-4" /> : <Bot className="w-5 h-5" />}
                  </div>

                  {/* Message Bubble */}
                  <div className={`p-3 rounded-2xl whitespace-pre-wrap text-sm ${
                    msg.role === 'user' 
                      ? 'bg-primary text-white rounded-br-sm shadow-md' 
                      : 'bg-white text-slate-700 border border-slate-100 shadow-sm rounded-bl-sm'
                  }`}>
                    {msg.content}
                  </div>
                </div>
              </div>
            ))}
            
            {isRecording && (
              <div className="flex justify-start">
                <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-2xl text-xs">
                  🎤 Recording... {transcript && `"${transcript}"`}
                </div>
              </div>
            )}
            
            {isLoading && (
              <div className="flex justify-start">
                <div className="flex gap-2 max-w-[85%] flex-row">
                  <div className="w-8 h-8 rounded-full border border-amber-200 bg-amber-50 flex items-center justify-center flex-shrink-0 mt-auto">
                    <Bot className="w-4 h-4 text-amber-600" />
                  </div>
                  <div className="p-4 bg-white border border-slate-100 shadow-sm rounded-2xl flex items-center gap-2 rounded-bl-sm">
                    <Loader2 className="w-4 h-4 text-primary animate-spin" />
                    <span className="text-xs text-slate-500 font-medium tracking-wide">Vaidya is thinking...</span>
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input Area */}
          <div className="p-3 bg-white border-t border-gray-100">
            <form onSubmit={handleSend} className="flex flex-col gap-2 relative">
              <div className="flex gap-2 items-center">
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={isRecording ? 'Listening...' : 'Ask about herbs, doshas...'}
                  className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all resize-none h-[40px]"
                  disabled={isLoading}
                />
                <button
                  type="button"
                  onClick={toggleVoiceInput}
                  className={`p-2 rounded-lg transition-all ${
                    isRecording 
                      ? 'bg-red-100 text-red-600 border border-red-300 animate-pulse' 
                      : 'bg-slate-100 text-slate-600 border border-slate-300 hover:bg-slate-200'
                  }`}
                  title={isRecording ? 'Stop recording' : 'Start voice input'}
                >
                  🎤
                </button>
                <button
                  type="submit"
                  disabled={!input.trim() || isLoading}
                  className="p-2 bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm"
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
            </form>
            <div className="text-center mt-2 flex justify-center text-[10px] text-slate-400">
              Powered by Groq & gTTS
            </div>
          </div>

          {/* Hidden Audio Player */}
          <audio ref={audioPlayerRef} style={{ display: 'none' }} />
        </div>
      )}

      {/* Toggle Button */}
      <button
        onClick={toggleWidget}
        className="w-14 h-14 bg-primary text-white rounded-full flex items-center justify-center shadow-[0_8px_30px_rgb(0,0,0,0.12)] hover:shadow-[0_8px_30px_rgb(0,0,0,0.2)] hover:scale-105 transition-all duration-300 relative group"
        aria-label="Toggle chat"
      >
        {isOpen ? (
          <X className="w-6 h-6 transition-transform rotate-90" />
        ) : (
          <MessageSquare className="w-6 h-6 transition-transform" />
        )}
        
        {/* Unread Badge indicator */}
        {!isOpen && hasUnread && (
          <span className="absolute -top-1 -right-1 flex h-4 w-4">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-4 w-4 bg-red-500 border-2 border-white"></span>
          </span>
        )}
      </button>
    </div>
  );
}
