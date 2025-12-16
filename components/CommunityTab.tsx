
import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
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
  ChevronUpIcon,
  ArrowDownTrayIcon,
  PrinterIcon
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

  // Auto-trigger if initialRequest is present
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
          Generate from 4 to 6 answers. One must be accepted, and others should vary on tone, some reaffirming on accepted (without mentioning, something like improving etc), others negatives, others with alternatives, etc. Use technical jargon appropriate for StackOverflow coming from different personalities.
          Remember stack discussion answers are typically straightforward unless necessary.

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

  const handleDownloadMarkdown = () => {
    if (!content) return;
    let mdContent = '';
    let filename = 'download.md';

    if (activeMode === 'blog') {
      filename = `${content.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.md`;
      mdContent = `# ${content.title}\n\n`;
      mdContent += `> **Author:** ${content.author} | **Date:** ${content.date} | **Read Time:** ${content.readTime}\n`;
      mdContent += `> **Tags:** ${content.tags?.join(', ')}\n\n`;
      mdContent += `---\n\n`;
      mdContent += content.content;
    } else {
      filename = `${content.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_discussion.md`;
      mdContent = `# ${content.title}\n\n`;
      mdContent += `## Question\n`;
      mdContent += `**Asked by:** ${content.question.user} | **Votes:** ${content.question.votes}\n\n`;
      mdContent += `${content.question.content}\n\n`;
      mdContent += `---\n\n## ${content.answers.length} Answers\n\n`;
      content.answers.forEach((ans: any) => {
          mdContent += `### Answer by ${ans.user} ${ans.accepted ? '✅' : ''}\n`;
          mdContent += `**Votes:** ${ans.votes}\n\n`;
          mdContent += `${ans.content}\n\n---\n\n`;
      });
    }

    const blob = new Blob([mdContent], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handlePrint = () => {
      window.print();
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
          <pre key={idx} className={`my-4 p-4 rounded-lg overflow-x-auto border text-sm font-mono break-inside-avoid ${theme === 'dark' ? 'bg-black/50 border-gray-700 text-gray-300' : 'bg-gray-50 border-gray-200 text-gray-800'}`}>
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

  /**
   * PRINT PORTAL
   * Renders a clean, light-mode version of the content specifically for the print media query.
   * This portal sits at document.body level, bypassing all parent overflow:hidden constraints.
   */
  const PrintPortal = ({ children }: { children: React.ReactNode }) => {
    return createPortal(
      <div className="print-portal-root">
        {children}
      </div>,
      document.body
    );
  };

  return (
    <div className="flex flex-col h-full bg-gray-950 text-gray-200 font-sans relative overflow-hidden">
       
       {/* PRINT CSS - Force layout reset */}
       <style>{`
          @media screen {
            .print-portal-root { display: none; }
          }
          @media print {
            /* Hide the entire App React Root */
            #root { display: none !important; }
            
            /* Reset Page settings */
            @page { margin: 1cm; size: auto; }
            html, body { 
              margin: 0 !important; 
              padding: 0 !important; 
              background: white !important; 
              height: auto !important; 
              overflow: visible !important; 
            }

            /* Show and style the Portal */
            .print-portal-root { 
              display: block !important; 
              position: absolute; 
              top: 0; 
              left: 0; 
              width: 100%; 
              background: white; 
              color: black; 
              z-index: 9999;
              font-family: sans-serif;
            }
            
            /* Typography Tweaks for Print */
            .print-portal-root h1 { font-size: 24pt; margin-bottom: 0.5em; color: black; }
            .print-portal-root h2 { font-size: 18pt; margin-top: 1em; border-bottom: 1px solid #ccc; color: #333; }
            .print-portal-root h3 { font-size: 14pt; margin-top: 1em; color: #444; }
            .print-portal-root p { font-size: 11pt; line-height: 1.5; color: #111; }
            .print-portal-root pre { border: 1px solid #ddd; background: #f5f5f5 !important; page-break-inside: avoid; }
            .print-portal-root code { color: #d63384; font-family: monospace; }
          }
       `}</style>

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

             {content && (
                 <div>
                     <div className="mb-6 flex justify-end gap-2">
                         <button onClick={handleDownloadMarkdown} className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium bg-gray-800 hover:bg-gray-700 text-gray-300 rounded border border-gray-700 transition-colors">
                             <ArrowDownTrayIcon className="w-4 h-4" /> Download Markdown
                         </button>
                         <button onClick={handlePrint} className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium bg-gray-800 hover:bg-gray-700 text-gray-300 rounded border border-gray-700 transition-colors">
                             <PrinterIcon className="w-4 h-4" /> Print / Save PDF
                         </button>
                     </div>

                     {/* ON-SCREEN DISPLAY (Dark Mode) */}
                     {activeMode === 'discussion' && (
                        <div className="space-y-6 animate-fade-in">
                           <div className="border-b border-gray-700 pb-4">
                              <h1 className="text-2xl font-bold text-blue-400 mb-2">{content.title}</h1>
                              <div className="flex items-center gap-4 text-xs text-gray-500">
                                 <span>Asked {content.question.time}</span>
                                 <span>by <span className="text-blue-300 font-bold">{content.question.user}</span></span>
                                 <span className="bg-orange-900/30 text-orange-400 px-2 py-0.5 rounded border border-orange-800/50">StackOverflow Simulation</span>
                              </div>
                           </div>
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
                                             <span className="text-blue-300 font-bold">{ans.user}</span>
                                             {ans.accepted && <span className="font-bold text-green-600">(Accepted)</span>}
                                          </div>
                                       </div>
                                    </div>
                                 ))}
                              </div>
                           </div>
                        </div>
                     )}

                     {activeMode === 'blog' && (
                        <div className="bg-white text-gray-900 rounded-xl overflow-hidden shadow-2xl animate-fade-in max-w-3xl mx-auto">
                           <div className="h-2 bg-indigo-600 w-full" />
                           <div className="p-8 md:p-12">
                              <h1 className="text-4xl font-extrabold text-gray-900 mb-4 leading-tight">{content.title}</h1>
                              <div className="flex items-center gap-4 text-sm text-gray-500 mb-8 border-b border-gray-200 pb-8">
                                 <div className="flex items-center gap-2">
                                    <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold border border-transparent">
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

                     {/* PRINT PORTAL (Light Mode / Document Style) */}
                     <PrintPortal>
                        <div className="p-8 max-w-4xl mx-auto">
                           {activeMode === 'discussion' ? (
                              <div className="space-y-6">
                                 <div className="border-b border-gray-300 pb-4 mb-4">
                                    <h1 className="text-3xl font-bold mb-2">{content.title}</h1>
                                    <p className="text-sm text-gray-600">
                                       Discussion Thread • Asked by <strong>{content.question.user}</strong> • {content.question.time}
                                    </p>
                                 </div>
                                 
                                 <div className="mb-8">
                                    <h2 className="text-xl font-bold mb-2 border-l-4 border-orange-500 pl-2">Question</h2>
                                    <div>{renderMarkdown(content.question.content, 'light')}</div>
                                 </div>

                                 <div>
                                    <h2 className="text-xl font-bold mb-4">{content.answers.length} Answers</h2>
                                    <div className="space-y-8">
                                       {content.answers.map((ans: any, idx: number) => (
                                          <div key={idx} className={`border-l-4 pl-4 py-2 ${ans.accepted ? 'border-green-500 bg-green-50/50' : 'border-gray-300'}`}>
                                             <div className="flex justify-between items-center mb-2">
                                                <span className="font-bold text-sm text-gray-700">{ans.user}</span>
                                                <span className="text-xs text-gray-500">Votes: {ans.votes} {ans.accepted && '• Accepted Answer'}</span>
                                             </div>
                                             <div>{renderMarkdown(ans.content, 'light')}</div>
                                          </div>
                                       ))}
                                    </div>
                                 </div>
                              </div>
                           ) : (
                              <div>
                                 <h1 className="text-4xl font-bold mb-2">{content.title}</h1>
                                 <div className="text-sm text-gray-600 mb-8 pb-4 border-b border-gray-300 flex gap-4">
                                    <span>By <strong>{content.author}</strong></span>
                                    <span>{content.date}</span>
                                    <span>{content.readTime}</span>
                                 </div>
                                 <div className="prose max-w-none">
                                    {renderMarkdown(content.content, 'light')}
                                 </div>
                                 <div className="mt-8 pt-4 border-t border-gray-300 text-xs text-gray-500">
                                    Tags: {content.tags?.join(', ')}
                                 </div>
                              </div>
                           )}
                        </div>
                     </PrintPortal>
                 </div>
             )}
          </div>
       </div>
    </div>
  );
};
