import React, { useState, useRef, useEffect } from "react";
import "./ChatbotWidget.css";

interface ChatMessage {
  id: string;
  type: "user" | "bot";
  text: string;
  audioUrl?: string;
}

const ChatbotWidget: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [language, setLanguage] = useState("en");
  const [isLoading, setIsLoading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState("");
  const chatBoxRef = useRef<HTMLDivElement>(null);
  const audioPlayerRef = useRef<HTMLAudioElement>(null);
  const recognitionRef = useRef<any>(null);

  // Initialize Speech Recognition
  useEffect(() => {
    const SpeechRecognition =
      (window as any).webkitSpeechRecognition;

    if (SpeechRecognition) {
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = false;
      recognitionRef.current.interimResults = true;

      recognitionRef.current.onstart = () => {
        setIsRecording(true);
      };

      recognitionRef.current.onresult = (event: any) => {
        let interim = "";
        for (let i = event.resultIndex; i < event.results.length; i++) {
          interim += event.results[i][0].transcript;
        }
        setTranscript(interim);
        setInputValue(interim);
      };

      recognitionRef.current.onend = () => {
        setIsRecording(false);
      };

      recognitionRef.current.onerror = (event: any) => {
        console.error("Speech recognition error:", event.error);
        setIsRecording(false);
      };
    }
  }, []);

  const toggleVoiceInput = () => {
    if (!recognitionRef.current) {
      alert("Speech Recognition not supported in your browser");
      return;
    }

    if (isRecording) {
      recognitionRef.current.stop();
    } else {
      const langMap: { [key: string]: string } = {
        en: "en-US",
        hi: "hi-IN",
        mr: "mr-IN",
        gu: "gu-IN",
      };

      recognitionRef.current.lang = langMap[language] || "en-US";
      recognitionRef.current.start();
      setTranscript("");
    }
  };

  const sendMessage = async () => {
    if (!inputValue.trim()) return;

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      type: "user",
      text: inputValue,
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputValue("");
    setIsLoading(true);

    try {
      // Send message to server
      const response = await fetch("/api/chatbot/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: inputValue,
          language: language,
        }),
      });

      if (!response.ok) throw new Error("Failed to get response");
      const data = await response.json();

      const botMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        type: "bot",
        text: data.reply || data.bot_response,
      };

      setMessages((prev) => [...prev, botMessage]);

      // Generate and play speech
      generateSpeech(data.reply || data.bot_response, language);
    } catch (error) {
      console.error("Error:", error);
      const errorMessage: ChatMessage = {
        id: Date.now().toString(),
        type: "bot",
        text: "Sorry, I encountered an error. Please try again.",
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }

    // Scroll to bottom
    setTimeout(() => {
      if (chatBoxRef.current) {
        chatBoxRef.current.scrollTop = chatBoxRef.current.scrollHeight;
      }
    }, 100);
  };

  const generateSpeech = async (text: string, lang: string) => {
    try {
      const response = await fetch("/api/chatbot/generate-speech", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: text,
          language: lang,
        }),
      });

      if (!response.ok) throw new Error("Failed to generate speech");
      const data = await response.json();

      if (data.status === "success" && audioPlayerRef.current) {
        audioPlayerRef.current.src = data.audio_url;
        audioPlayerRef.current.play();
      }
    } catch (error) {
      console.error("Speech generation error:", error);
    }
  };

  const playAudio = (audioUrl: string) => {
    if (audioPlayerRef.current) {
      audioPlayerRef.current.src = audioUrl;
      audioPlayerRef.current.play();
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !isLoading) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <>
      {/* Chat Button */}
      <button
        className="chat-button"
        onClick={() => setIsOpen(!isOpen)}
        title="Open Ayurvedic Assistant"
      >
        💬
      </button>

      {/* Chat Container */}
      {isOpen && (
        <div className="chat-container">
          <div className="chat-header">
            <h3>🌿 AyurSutra Vaidya</h3>
            <button
              className="close-btn"
              onClick={() => setIsOpen(false)}
            >
              ✕
            </button>
          </div>

          {/* Language Selector */}
          <div className="chat-controls">
            <label htmlFor="language-select">Language:</label>
            <select
              id="language-select"
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              className="language-select"
            >
              <option value="en">🇬🇧 English</option>
              <option value="hi">🇮🇳 Hindi</option>
              <option value="mr">🇮🇳 Marathi</option>
              <option value="gu">🇮🇳 Gujarati</option>
            </select>
          </div>

          {/* Chat Messages */}
          <div ref={chatBoxRef} className="chat-box">
            {messages.length === 0 && (
              <div className="chat-welcome">
                <p>Hello! I'm your Ayurvedic health assistant.</p>
                <p>Ask me about herbs, doshas, wellness, and more!</p>
              </div>
            )}
            {messages.map((msg) => (
              <div key={msg.id} className={`message message-${msg.type}`}>
                <div className="message-content">
                  <p>{msg.text}</p>
                  {msg.audioUrl && (
                    <button
                      className="audio-btn"
                      onClick={() => playAudio(msg.audioUrl!)}
                      title="Play audio response"
                    >
                      🔊 Play
                    </button>
                  )}
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="message message-bot">
                <div className="typing-indicator">
                  <span></span><span></span><span></span>
                </div>
              </div>
            )}
          </div>

          {/* Recording Status */}
          {isRecording && (
            <div className="recording-status">
              🎤 Recording... ({transcript || "listening"})
            </div>
          )}

          {/* Input Area */}
          <div className="chat-input-area">
            <div className="input-group">
              <input
                id="user-input"
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Ask something or use voice..."
                className="chat-input"
                disabled={isLoading}
              />
              <button
                className={`voice-btn ${isRecording ? "recording" : ""}`}
                onClick={toggleVoiceInput}
                title={isRecording ? "Stop recording" : "Start voice input"}
              >
                🎤
              </button>
              <button
                className="send-btn"
                onClick={sendMessage}
                disabled={isLoading || !inputValue.trim()}
                title="Send message"
              >
                ➤
              </button>
            </div>
          </div>

          {/* Hidden Audio Player */}
          <audio ref={audioPlayerRef} style={{ display: "none" }} />
        </div>
      )}
    </>
  );
};

export default ChatbotWidget;
