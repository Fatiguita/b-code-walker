
import React, { useState, useEffect } from 'react';
import { AppSettings } from '../types';
import { GoogleGenAI } from "@google/genai";
import Prism from 'prismjs';
import 'prismjs/components/prism-javascript';
import 'prismjs/components/prism-typescript';
import 'prismjs/components/prism-markdown';
import 'prismjs/components/prism-python';
import 'prismjs/components/prism-css';
import { 
  UserGroupIcon, 
  NewspaperIcon, 
  ChatBubbleBottomCenterTextIcon, 
  ArrowPathIcon, 
  ExclamationTriangleIcon,
  CheckIcon,
  ChevronUpIcon
} from './Icons';

interface CommunityTabProps {
  settings: AppSettings;
  initialRequest: { type: 'discussion' | 'blog'; topic: string } | null;
  clearInitialRequest: () => void;
}

export const CommunityTab: React.FC<CommunityTabProps> = ({ settings, initialRequest, clearInitialRequest }) => {
  const [topic, setTopic] = useState('');
  const [activeMode, setActiveMode] = useState<'discussion' | 'blog'>('discussion');
  const [content, setContent] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Auto-trigger if initial request present
  useEffect(() => {
    if (initialRequest) {
      setTopic(initialRequest.topic);
      setActiveMode(initialRequest.type);
      generateContent(initialRequest.topic, initialRequest.type);
      clearInitialRequest();
    }
  }, [initialRequest]);

  const getApiKey = (): string | null => localStorage.getItem('b_code_walker_api_key');

  const generateContent = async (currentTopic: string, mode: 'discussion' | 'blog') => {
    if (!currentTopic.trim()) return;
    
    const apiKey = getApiKey();
    if (!apiKey) {
      setError("Please add your API Key in Settings to generate content.");
      return;
    }

    setIsLoading(true);
    setError(null);
    setContent(null);

    try {
      const ai = new GoogleGenAI({ apiKey });
      let prompt = '';
      
      if (mode === 'discussion') {
        prompt = `
          Simulate a realistic StackOverflow thread about: "${currentTopic}".
          
          Output strictly JSON format:
          {
            "title": "A technical title related to the topic",
            "question": {
              "votes": "Number (e.g. 42)",
              "user": "Username",
              "time": "Time ago (e.g. '2 hours ago')",
              "content": "The question body in Markdown. Include code snippets if relevant."
            },
            "answers": [
              {
                "votes": "Number",
                "user": "Username",
                "time": "Time ago",
                "accepted": boolean,
                "content": "The answer body in Markdown. Include detailed explanation and code fixes."
              }
            ]
          }
          Generate 2 answers. One must be accepted. Use technical jargon appropriate for StackOverflow.
        `;
      } else {
        prompt = `
          Write a passionate "TechForGeeks" style blog post about: "${currentTopic}".
          
          Output strictly JSON format:
          {
            "title": "Catchy Blog Title",
            "author": "Tech Author Name",
            "date": "Current Date",
            "readTime": "e.g. '5 min read'",
            "tags": ["Tag1", "Tag2"],
            "content": "Full blog post content in Markdown. Use headers (##), bold (**text**), lists (- item), and code blocks."
          }
        `;
      }

      const response = await ai.models.generateContent({
        model: settings.activeModel,
        contents: prompt,
        config: { responseMimeType: 'application/json' }
      });

      const text = response.text || "{}";
      const cleanText = text.replace(/```json|```/g, '').trim();
      setContent(JSON.parse(cleanText));

    } catch (e: any) {
      setError("Failed to generate content. " + e.message);
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Robust Markdown Renderer
   * Handles Code Blocks, Headers, Lists, and Bold Text
   */
  const renderMarkdown = (md: string, theme: 'dark' | 'light') => {
    if (!md) return null;

    // Helper to parse inline styles (bold, code)
    const parseInline = (text: string) => {
        const parts = text.split(/(`[^`]+`|\*\*[^*]+\*\*)/g);
        return parts.map((part, i) => {
            if (part.startsWith('`') && part.endsWith('`')) {
                return <code key={i} className={`${theme === 'dark' ? 'bg-gray-800 text-pink-400' : 'bg-gray-100 text-pink-600'} px-1.5 py-0.5 rounded font-mono text-[0.9em] border ${theme === 'dark' ? 'border-gray-700' : 'border-gray-200'}`}>{part.slice(1, -1)}</code>;
            }
            if (part.startsWith('**') && part.endsWith('**')) {
                return <strong key={i} className={`font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{part.slice(2, -2)}</strong>;
            }
            return part;
        });
    };

    // Split content by code blocks first
    const sections = md.split(/(```[\s\S]*?```)/g);

    return sections.map((section, idx) => {
      // 1. Code Block Rendering
      if (section.startsWith('```')) {
        const match = section.match(/```(\w*)\n([\s\S]*?)```/);
        const lang = match && match[1] ? match[1] : 'javascript';
        const code = match && match[2] ? match[2] : section.slice(3, -3);
        const html = Prism.highlight(code, Prism.languages[lang] || Prism.languages.javascript, lang);
        
        return (
          <pre key={idx} className={`my-4 p-4 rounded-lg overflow-x-auto border text-sm font-mono ${theme === 'dark' ? 'bg-black/50 border-gray-700 text-gray-300' : 'bg-gray-900 border-gray-800 text-gray-100'}`}>
            <code dangerouslySetInnerHTML={{ __html: html }} />
          </pre>
        );
      }

      // 2. Text Content Rendering (Headers, Lists, Paragraphs)
      const lines = section.split('\n');
      return (
          <div key={idx}>
              {lines.map((line, lIdx) => {
                  const trimmed = line.trim();
                  if (!trimmed) return <div key={lIdx} className="h-2" />; // Spacer

                  // Headers
                  if (line.startsWith('### ')) return <h3 key={lIdx} className={`text-lg font-bold mt-6 mb-2 ${theme === 'dark' ? 'text-gray-200' : 'text-gray-800'}`}>{parseInline(line.slice(4))}</h3>;
                  if (line.startsWith('## ')) return <h2 key={lIdx} className={`text-xl font-bold mt-8 mb-3 pb-1 border-b ${theme === 'dark' ? 'text-white border-gray-700' : 'text-gray-900 border-gray-200'}`}>{parseInline(line.slice(3))}</h2>;
                  if (line.startsWith('# ')) return <h1 key={lIdx} className={`text-2xl font-bold mt-8 mb-4 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{parseInline(line.slice(2))}</h1>;

                  // List Items
                  if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
                      return (
                          <div key={lIdx} className="flex gap-3 mb-2 ml-2">
                              <span className={`mt-2 w-1.5 h-1.5 rounded-full flex-none ${theme === 'dark' ? 'bg-gray-500' : 'bg-gray-400'}`} />
                              <span className={`leading-relaxed ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>{parseInline(trimmed.slice(2))}</span>
                          </div>
                      );
                  }

                  // Standard Paragraph
                  return <p key={lIdx} className={`mb-3 leading-relaxed ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>{parseInline(line)}</p>;
              })}
          </div>
      );
    });
  };

  return (
    <div className="flex flex-col h-full bg-gray-950 text-gray-200 font-sans relative overflow-hidden">
       {/* Header Input Area */}
       <div className="flex-none p-6 border-b border-gray-800 bg-gray-900/50 z-10">
          <div className="max-w-4xl mx-auto flex flex-col gap-4">
             <div className="flex gap-4">
                <button 
                   onClick={() => setActiveMode('discussion')}
                   className={`flex-1 py-3 rounded-lg border flex items-center justify-center gap-2 transition-all ${activeMode === 'discussion' ? 'bg-orange-600/20 border-orange-500 text-orange-400' : 'bg-gray-800 border-transparent text-gray-500 hover:bg-gray-700'}`}
                >
                   <ChatBubbleBottomCenterTextIcon className="w-5 h-5" /> Stack Discussion
                </button>
                <button 
                   onClick={() => setActiveMode('blog')}
                   className={`flex-1 py-3 rounded-lg border flex items-center justify-center gap-2 transition-all ${activeMode === 'blog' ? 'bg-indigo-600/20 border-indigo-500 text-indigo-400' : 'bg-gray-800 border-transparent text-gray-500 hover:bg-gray-700'}`}
                >
                   <NewspaperIcon className="w-5 h-5" /> Tech Blog
                </button>
             </div>
             
             <div className="flex gap-2">
                <div className="relative flex-1">
                   <input 
                      type="text" 
                      value={topic}
                      onChange={(e) => setTopic(e.target.value)}
                      placeholder={activeMode === 'discussion' ? "e.g. How to fix React useEffect infinite loop?" : "e.g. The future of Rust in Web Development"}
                      className="w-full bg-black/40 border border-gray-700 rounded-lg px-4 py-3 focus:outline-none focus:border-gray-500 text-white placeholder-gray-600"
                      onKeyDown={(e) => e.key === 'Enter' && generateContent(topic, activeMode)}
                   />
                </div>
                <button 
                   onClick={() => generateContent(topic, activeMode)}
                   disabled={isLoading || !topic.trim()}
                   className="bg-green-600 hover:bg-green-500 text-white px-6 rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                   {isLoading ? <ArrowPathIcon className="w-5 h-5 animate-spin" /> : <ArrowPathIcon className="w-5 h-5" />}
                   Generate
                </button>
             </div>
          </div>
       </div>

       {/* Content Area */}
       <div className="flex-1 overflow-y-auto p-6 relative">
          <div className="max-w-4xl mx-auto">
             {error && (
                <div className="mb-6 p-4 bg-red-900/20 border border-red-800 rounded-lg flex items-center gap-3 text-red-300">
                   <ExclamationTriangleIcon className="w-6 h-6" />
                   {error}
                </div>
             )}

             {!content && !isLoading && (
                <div className="flex flex-col items-center justify-center h-64 text-gray-600">
                   <UserGroupIcon className="w-16 h-16 mb-4 opacity-20" />
                   <p>Enter a topic to generate a community discussion or blog post.</p>
                </div>
             )}

             {isLoading && (
                <div className="flex flex-col items-center justify-center h-64 text-gray-500 animate-pulse">
                   <ArrowPathIcon className="w-12 h-12 mb-4 animate-spin text-gray-600" />
                   <p>Consulting the hive mind...</p>
                </div>
             )}

             {content && activeMode === 'discussion' && (
                <div className="space-y-6 animate-fade-in">
                   {/* Question Header */}
                   <div className="border-b border-gray-700 pb-4">
                      <h1 className="text-2xl font-bold text-blue-400 mb-2">{content.title}</h1>
                      <div className="flex items-center gap-4 text-xs text-gray-500">
                         <span>Asked {content.question.time}</span>
                         <span>by <span className="text-blue-300">{content.question.user}</span></span>
                         <span className="bg-orange-900/30 text-orange-400 px-2 py-0.5 rounded border border-orange-800/50">StackOverflow Simulation</span>
                      </div>
                   </div>

                   {/* Question Body */}
                   <div className="flex gap-4">
                      <div className="flex flex-col items-center gap-2 text-gray-400 w-10 pt-2">
                         <ChevronUpIcon className="w-8 h-8 p-1 rounded-full border border-gray-600 hover:bg-orange-500/20 cursor-pointer" />
                         <span className="font-bold text-lg">{content.question.votes}</span>
                         <ChevronUpIcon className="w-8 h-8 p-1 rounded-full border border-gray-600 hover:bg-orange-500/20 cursor-pointer rotate-180" />
                      </div>
                      <div className="flex-1 bg-gray-900/30 p-6 rounded border border-gray-800 text-sm">
                         {renderMarkdown(content.question.content, 'dark')}
                      </div>
                   </div>

                   {/* Answers */}
                   <div className="mt-8">
                      <h3 className="text-lg font-bold text-gray-300 mb-4">{content.answers.length} Answers</h3>
                      <div className="space-y-6">
                         {content.answers.map((ans: any, idx: number) => (
                            <div key={idx} className="flex gap-4 border-t border-gray-800 pt-6">
                               <div className="flex flex-col items-center gap-2 text-gray-400 w-10 pt-2">
                                  <ChevronUpIcon className="w-8 h-8 p-1 rounded-full border border-gray-600 hover:bg-orange-500/20 cursor-pointer" />
                                  <span className="font-bold text-lg">{ans.votes}</span>
                                  <ChevronUpIcon className="w-8 h-8 p-1 rounded-full border border-gray-600 hover:bg-orange-500/20 cursor-pointer rotate-180" />
                                  {ans.accepted && <CheckIcon className="w-8 h-8 text-green-500 mt-2" />}
                               </div>
                               <div className="flex-1">
                                  <div className={`p-6 rounded border text-sm ${ans.accepted ? 'bg-green-900/10 border-green-900/30' : 'bg-gray-900/30 border-gray-800'}`}>
                                     {renderMarkdown(ans.content, 'dark')}
                                  </div>
                                  <div className="mt-2 flex justify-end text-xs text-gray-500 gap-2">
                                     <span>Answered {ans.time}</span>
                                     <span className="text-blue-300">{ans.user}</span>
                                  </div>
                               </div>
                            </div>
                         ))}
                      </div>
                   </div>
                </div>
             )}

             {content && activeMode === 'blog' && (
                <div className="bg-white text-gray-900 rounded-xl overflow-hidden shadow-2xl animate-fade-in max-w-3xl mx-auto">
                   <div className="h-2 bg-indigo-600 w-full" />
                   <div className="p-8 md:p-12">
                      <h1 className="text-4xl font-extrabold text-gray-900 mb-4 leading-tight">{content.title}</h1>
                      <div className="flex items-center gap-4 text-sm text-gray-500 mb-8 border-b border-gray-200 pb-8">
                         <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold">
                               {(content.author || 'A').charAt(0)}
                            </div>
                            <span>{content.author || 'Anonymous'}</span>
                         </div>
                         <span>•</span>
                         <span>{content.date}</span>
                         <span>•</span>
                         <span>{content.readTime}</span>
                      </div>
                      
                      <div className="prose prose-lg prose-indigo max-w-none prose-pre:bg-gray-800 prose-pre:text-gray-100">
                         {renderMarkdown(content.content, 'light')}
                      </div>

                      <div className="mt-12 pt-8 border-t border-gray-200">
                         <div className="flex flex-wrap gap-2">
                            {content.tags && content.tags.map((tag: string) => (
                               <span key={tag} className="bg-gray-100 text-gray-600 px-3 py-1 rounded-full text-sm font-medium">#{tag}</span>
                            ))}
                         </div>
                      </div>
                   </div>
                </div>
             )}
          </div>
       </div>
    </div>
  );
};

