import React, { useState, useEffect, useRef } from 'react';
import { GoogleGenAI } from "@google/genai";
import { AppSettings, EditorFile } from '../types';
import { MicrophoneIcon, PaperAirplaneIcon, XMarkIcon, SparklesIcon, ChatBubbleLeftRightIcon, TrashIcon } from './Icons';

interface AliceWidgetProps {
  settings: AppSettings;
  activeFile?: EditorFile;
}

interface Message {
  role: 'user' | 'bruno';
  text: string;
}

const INITIAL_MESSAGE: Message = { role: 'bruno', text: "Hi! I'm Bruno. I can help you clarify code concepts or debug logic. Try speaking or typing!" };

export const AliceWidget: React.FC<AliceWidgetProps> = ({ settings, activeFile }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([INITIAL_MESSAGE]);
  const [inputValue, setInputValue] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [isThinking, setIsThinking] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    if (isOpen && messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen]);

  // Setup Speech Recognition
  useEffect(() => {
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = false;
      recognitionRef.current.interimResults = false;
      recognitionRef.current.lang = 'en-US';

      recognitionRef.current.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        setInputValue(transcript);
        setIsListening(false);
      };

      recognitionRef.current.onerror = () => setIsListening(false);
      recognitionRef.current.onend = () => setIsListening(false);
    }
  }, []);

  const toggleListening = () => {
    if (!recognitionRef.current) {
      alert("Voice recognition not supported in this browser.");
      return;
    }
    if (isListening) {
      recognitionRef.current.stop();
    } else {
      setIsListening(true);
      recognitionRef.current.start();
    }
  };

  const resetChat = () => {
      setMessages([INITIAL_MESSAGE]);
      setIsThinking(false);
  };

  const handleSend = async () => {
    if (!inputValue.trim()) return;
    
    const userMsg = inputValue;
    setMessages(prev => [...prev, { role: 'user', text: userMsg }]);
    setInputValue('');
    setIsThinking(true);

    // Retrieve API Key with fallback check
    // 1. LocalStorage (Primary for BYOK)
    // 2. Env Var (If configured in build)
    const storedKey = localStorage.getItem('b_code_walker_api_key');
    const apiKey = storedKey || (import.meta as any).env?.VITE_API_KEY;

    if (!apiKey) {
      setMessages(prev => [...prev, { role: 'bruno', text: "I need an API key to think! Please go to the Settings tab and add your Google GenAI Key." }]);
      setIsThinking(false);
      return;
    }

    try {
      const ai = new GoogleGenAI({ apiKey });
      
      const fileContext = activeFile ? `
CURRENT EDITOR FILE CONTEXT:
File Name: ${activeFile.name}
Language: ${activeFile.language}
Code:
\`\`\`${activeFile.language}
${activeFile.content}
\`\`\`
` : "No active file open.";

      // Keep context short
      const history = messages.slice(-4).map(m => `${m.role === 'user' ? 'User' : 'Bruno'}: ${m.text}`).join('\n');
      const prompt = `
        You are Bruno, a helpful coding assistant in the b-code-walker IDE.
        Be concise, friendly, and helpful. 
        ${fileContext}
        
        Conversation History:
        ${history}
        User: ${userMsg}
        Bruno:
      `;

      const response = await ai.models.generateContent({
        model: settings.activeModel,
        contents: prompt
      });

      const reply = response.text || "I'm not sure what to say.";
      setMessages(prev => [...prev, { role: 'bruno', text: reply }]);
      
      // Voice Output Disabled by user request

    } catch (e: any) {
      console.error(e);
      setMessages(prev => [...prev, { role: 'bruno', text: "My brain is offline. Check your API key in Settings." }]);
    } finally {
      setIsThinking(false);
    }
  };

  return (
    <div className="fixed bottom-6 right-6 z-[60] flex flex-col items-end">
      {/* Chat Window */}
      {isOpen && (
        <div className="mb-4 w-80 h-96 bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-fade-in origin-bottom-right">
          <div className="p-3 bg-[var(--bg-tertiary)] border-b border-[var(--border-color)] flex justify-between items-center">
             <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                <span className="font-bold text-sm text-[var(--text-primary)]">Bruno</span>
             </div>
             <div className="flex items-center gap-1">
                <button onClick={resetChat} className="text-[var(--text-secondary)] hover:text-red-400 p-1 rounded" title="Reset Chat">
                    <TrashIcon className="w-4 h-4" />
                </button>
                <button onClick={() => setIsOpen(false)} className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] p-1 rounded">
                    <XMarkIcon className="w-4 h-4" />
                </button>
             </div>
          </div>
          
          <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-[var(--bg-primary)]">
             {messages.map((m, i) => (
               <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[85%] p-2 rounded-lg text-xs leading-relaxed ${m.role === 'user' ? 'bg-[var(--accent-primary)] text-white' : 'bg-[var(--bg-tertiary)] text-[var(--text-primary)] border border-[var(--border-color)]'}`}>
                     {m.text}
                  </div>
               </div>
             ))}
             {isThinking && (
               <div className="flex justify-start">
                  <div className="bg-[var(--bg-tertiary)] p-2 rounded-lg text-xs text-[var(--text-secondary)] italic flex items-center gap-1">
                     <SparklesIcon className="w-3 h-3 animate-spin" /> Thinking...
                  </div>
               </div>
             )}
             <div ref={messagesEndRef} />
          </div>

          <div className="p-2 bg-[var(--bg-secondary)] border-t border-[var(--border-color)] flex gap-2">
             <button 
                onClick={toggleListening}
                className={`p-2 rounded-full transition-colors ${isListening ? 'bg-red-500 text-white animate-pulse' : 'bg-[var(--bg-tertiary)] text-[var(--text-secondary)] hover:bg-[var(--bg-primary)]'}`}
             >
                <MicrophoneIcon className="w-4 h-4" />
             </button>
             <input 
                type="text" 
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                placeholder="Ask Bruno..."
                className="flex-1 bg-[var(--bg-tertiary)] rounded-full px-3 text-xs text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-primary)] border border-transparent"
             />
             <button 
                onClick={handleSend}
                disabled={!inputValue.trim()}
                className="p-2 rounded-full bg-[var(--accent-primary)] text-white disabled:opacity-50 hover:opacity-90 transition-opacity"
             >
                <PaperAirplaneIcon className="w-4 h-4" />
             </button>
          </div>
        </div>
      )}

      {/* Floating Toggle Button */}
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="w-14 h-14 rounded-full bg-[var(--accent-primary)] text-white shadow-lg hover:scale-110 transition-transform flex items-center justify-center relative group"
      >
        {isOpen ? <XMarkIcon className="w-6 h-6" /> : <ChatBubbleLeftRightIcon className="w-6 h-6" />}
        {!isOpen && (
           <span className="absolute right-0 top-0 flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-green-400"></span>
           </span>
        )}
      </button>
    </div>
  );
};