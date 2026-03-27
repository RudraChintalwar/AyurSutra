import React, { useState, useRef, useEffect } from 'react';
import { MessageSquare, X, Send, Loader2, Bot, User, Mic, MicOff, Volume2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import axios from 'axios';

type SectionText = { heading: string; type: 'text'; content: string };
type SectionList = { heading: string; type: 'list' | 'steps'; items: string[] };
type SectionTable = { heading: string; type: 'table'; rows: { label: string; value: string }[] };
type StructuredSection = SectionText | SectionList | SectionTable;
type StructuredReply = { title?: string; summary?: string; sections?: StructuredSection[]; tip?: string };

interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
  structured?: StructuredReply;
  inScope?: boolean;
  timestamp: Date;
}

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

export default function ChatbotWidget() {
  const { language, t } = useLanguage();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      content: t('chat.initial'),
      timestamp: new Date(),
      inScope: true,
    },
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { user } = useAuth();
  const [hasUnread, setHasUnread] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [autoSpeak, setAutoSpeak] = useState(false);
  const recognitionRef = useRef<any>(null);

  const SpeechRecognitionCtor =
    typeof window !== 'undefined'
      ? (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
      : null;
  const voiceSupported = !!SpeechRecognitionCtor;

  const scrollToBottom = () => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });

  const speakText = (text: string) => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window) || !text) return;
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = language === "hi" ? 'hi-IN' : 'en-IN';
    utterance.rate = 1;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
  };

  const startListening = () => {
    if (!SpeechRecognitionCtor || isListening) return;
    const recognition = new SpeechRecognitionCtor();
    recognition.lang = language === "hi" ? 'hi-IN' : 'en-IN';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognition.onresult = (event: any) => {
      const transcript = event?.results?.[0]?.[0]?.transcript || '';
      setInput((prev) => (prev ? `${prev} ${transcript}` : transcript));
      setIsListening(false);
    };
    recognition.onerror = () => setIsListening(false);
    recognition.onend = () => setIsListening(false);
    recognition.start();
    recognitionRef.current = recognition;
    setIsListening(true);
  };

  const stopListening = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }
    setIsListening(false);
  };

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
      setHasUnread(false);
    }
  }, [messages, isOpen]);

  useEffect(() => {
    setMessages((prev) => {
      if (prev.length === 1 && prev[0].role === "assistant") {
        return [{ ...prev[0], content: t("chat.initial") }];
      }
      return prev;
    });
  }, [t]);

  useEffect(() => {
    return () => {
      if (recognitionRef.current) recognitionRef.current.stop();
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  const toggleWidget = () => {
    setIsOpen(!isOpen);
    if (!isOpen) setHasUnread(false);
  };

  const handleSend = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage = input.trim();
    setInput('');

    const userMsg: Message = { role: 'user', content: userMessage, timestamp: new Date() };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setIsLoading(true);

    try {
      const payload = {
        message: userMessage,
        locale: language,
        conversationHistory: messages.filter((m) => m.role !== 'system').map((m) => ({ role: m.role, content: m.content })),
        userProfile: user
          ? {
              name: user.name || 'Patient',
              dosha: user.dosha || null,
              healthScore: (user as any).healthScore || null,
            }
          : null,
      };

      const response = await axios.post(`${API_URL}/api/chatbot/chat`, payload);
      if (!response.data.success) throw new Error(response.data.error || 'Failed to get response');

      const assistantMsg: Message = {
        role: 'assistant',
        content: response.data.reply || 'I can help with Ayurveda and wellness concerns.',
        structured: response.data.structured,
        inScope: response.data.inScope !== false,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, assistantMsg]);
      if (autoSpeak) speakText(assistantMsg.content);
      if (!isOpen) setHasUnread(true);
    } catch (error) {
      console.error('Chat error:', error);
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: t('chat.error'),
          timestamp: new Date(),
          inScope: true,
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const renderStructured = (structured?: StructuredReply) => {
    if (!structured) return null;
    return (
      <div className="space-y-2">
        {structured.title ? <div className="font-semibold text-sm">{structured.title}</div> : null}
        {structured.summary ? <div className="text-sm">{structured.summary}</div> : null}
        {(structured.sections || []).map((section, idx) => {
          if (section.type === 'text') {
            return (
              <div key={idx} className="text-sm">
                {section.heading ? <div className="font-medium mb-1">{section.heading}</div> : null}
                <div>{section.content}</div>
              </div>
            );
          }
          if (section.type === 'list' || section.type === 'steps') {
            return (
              <div key={idx} className="text-sm">
                {section.heading ? <div className="font-medium mb-1">{section.heading}</div> : null}
                <ul className="space-y-1">
                  {section.items.map((it, i) => (
                    <li key={i} className="flex gap-2">
                      <span>{section.type === 'steps' ? `${i + 1}.` : '•'}</span>
                      <span>{it}</span>
                    </li>
                  ))}
                </ul>
              </div>
            );
          }
          if (section.type === 'table') {
            return (
              <div key={idx} className="text-sm">
                {section.heading ? <div className="font-medium mb-1">{section.heading}</div> : null}
                <div className="border rounded-md overflow-hidden">
                  {section.rows.map((r, i) => (
                    <div key={i} className={`grid grid-cols-3 gap-2 px-2 py-1 ${i % 2 === 0 ? 'bg-slate-50/70' : 'bg-white'}`}>
                      <div className="font-medium col-span-1">{r.label}</div>
                      <div className="col-span-2">{r.value}</div>
                    </div>
                  ))}
                </div>
              </div>
            );
          }
          return null;
        })}
        {structured.tip ? (
          <div className="text-xs border border-amber-200 bg-amber-50 text-amber-800 rounded-md px-2 py-1">
            {t("chat.tip")}: {structured.tip}
          </div>
        ) : null}
      </div>
    );
  };

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end">
      {isOpen && (
        <div className="bg-white w-80 sm:w-96 rounded-2xl shadow-2xl border border-gray-100 mb-4 overflow-hidden flex flex-col h-[540px] max-h-[82vh] font-inter animate-in slide-in-from-bottom-5">
          <div className="bg-gradient-to-r from-primary to-green-600 p-4 text-white flex justify-between items-center shadow-md">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center backdrop-blur-sm">
                <Bot className="w-6 h-6 text-white" />
              </div>
              <div>
                <h3 className="font-semibold text-lg leading-tight">{t("chat.title")}</h3>
                <p className="text-white/80 text-xs flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-green-300" /> {t("chat.online")}
                </p>
              </div>
            </div>
            <button onClick={toggleWidget} className="p-2 hover:bg-white/20 rounded-full transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="px-3 py-2 bg-amber-50 border-b border-amber-100 flex items-center justify-between text-[11px] text-amber-800">
            <span>{t("chat.banner")}</span>
            <button
              type="button"
              className={`px-2 py-1 rounded-full border ${autoSpeak ? 'bg-primary/10 border-primary/40 text-primary' : 'bg-white border-amber-200 text-amber-800'}`}
              onClick={() => setAutoSpeak((v) => !v)}
            >
              {autoSpeak ? t("chat.voiceOn") : t("chat.voiceOff")}
            </button>
          </div>

          <div className="flex-1 p-4 overflow-y-auto bg-slate-50 flex flex-col gap-4">
            <div className="text-center text-xs text-slate-400 my-2">
              <span className="bg-white px-2 py-1 rounded-full shadow-sm border border-slate-100">
                {t("chat.notEmergency")}
              </span>
            </div>

            {messages.map((msg, index) => (
              <div key={index} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`flex max-w-[90%] gap-2 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 mt-auto ${
                      msg.role === 'user' ? 'bg-primary/20 text-primary' : 'bg-amber-100 text-amber-700'
                    }`}
                  >
                    {msg.role === 'user' ? <User className="w-4 h-4" /> : <Bot className="w-5 h-5" />}
                  </div>

                  <div
                    className={`p-3 rounded-2xl whitespace-pre-wrap text-sm ${
                      msg.role === 'user'
                        ? 'bg-primary text-white rounded-br-sm shadow-md'
                        : `text-slate-700 shadow-sm rounded-bl-sm border ${
                            msg.inScope === false ? 'bg-amber-50 border-amber-200' : 'bg-white border-slate-100'
                          }`
                    }`}
                  >
                    {msg.role === 'assistant' && msg.structured ? renderStructured(msg.structured) : msg.content}
                    {msg.role === 'assistant' ? (
                      <button
                        type="button"
                        className="mt-2 inline-flex items-center gap-1 text-[11px] opacity-80 hover:opacity-100"
                        onClick={() => speakText(msg.content)}
                      >
                        <Volume2 className="w-3 h-3" />
                        {t("chat.readAloud")}
                      </button>
                    ) : null}
                  </div>
                </div>
              </div>
            ))}

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

          <div className="p-3 bg-white border-t border-gray-100">
            <form onSubmit={handleSend} className="flex flex-col gap-2 relative">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask about dosha, herbs, Ayurveda diet..."
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 pr-24 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all resize-none overflow-hidden h-[52px]"
                rows={1}
                disabled={isLoading}
              />
              <button
                type="button"
                onClick={isListening ? stopListening : startListening}
                disabled={!voiceSupported || isLoading}
                className={`absolute right-12 top-2 p-2 rounded-lg transition-all shadow-sm ${
                  isListening ? 'bg-red-500 text-white animate-pulse' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                } disabled:opacity-50 disabled:cursor-not-allowed`}
                title={voiceSupported ? (isListening ? 'Stop voice input' : 'Start voice input') : 'Voice input not supported'}
              >
                {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
              </button>
              <button
                type="submit"
                disabled={!input.trim() || isLoading}
                className="absolute right-2 top-2 p-2 bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>
            <div className="text-center mt-2 flex justify-center text-[10px] text-slate-400">Powered by Groq AI</div>
          </div>
        </div>
      )}

      <button
        onClick={toggleWidget}
        className="w-14 h-14 bg-primary text-white rounded-full flex items-center justify-center shadow-[0_8px_30px_rgb(0,0,0,0.12)] hover:shadow-[0_8px_30px_rgb(0,0,0,0.2)] hover:scale-105 transition-all duration-300 relative group"
        aria-label="Toggle chat"
      >
        {isOpen ? <X className="w-6 h-6 transition-transform rotate-90" /> : <MessageSquare className="w-6 h-6 transition-transform" />}
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
