

import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import Editor from 'react-simple-code-editor';
import Prism from 'prismjs';
import 'prismjs/components/prism-javascript';
import 'prismjs/components/prism-typescript';
import 'prismjs/components/prism-css';
import 'prismjs/components/prism-json';
import 'prismjs/components/prism-python';
import 'prismjs/components/prism-markdown';
import 'prismjs/components/prism-sql';
import 'prismjs/components/prism-markup'; // HTML
import { SupportedLanguage, EditorFile, AIPlan, AICodeBlock, AppSettings } from '../types';
import { GoogleGenAI, Type } from "@google/genai";
import { 
  XMarkIcon, 
  PlusIcon,
  ChevronDownIcon,
  MagnifyingGlassIcon,
  ChevronUpIcon,
  ArrowPathIcon,
  SparklesIcon,
  ExclamationTriangleIcon,
  StopCircleIcon,
  CodeBracketIcon,
  ChatBubbleLeftRightIcon,
  EyeIcon,
  DocumentTextIcon,
  Square2StackIcon,
  PencilIcon,
  CheckIcon
} from './Icons';

interface EditorTabProps {
  files: EditorFile[];
  setFiles: React.Dispatch<React.SetStateAction<EditorFile[]>>;
  activeFileId: string;
  setActiveFileId: React.Dispatch<React.SetStateAction<string>>;
  settings: AppSettings;
  aiPlans: AIPlan[];
  setAiPlans: React.Dispatch<React.SetStateAction<AIPlan[]>>;
  activePlanId: string | null;
  setActivePlanId: React.Dispatch<React.SetStateAction<string | null>>;
}

/**
 * EditorTab Component
 */
export const EditorTab: React.FC<EditorTabProps> = ({ 
  files, 
  setFiles, 
  activeFileId, 
  setActiveFileId,
  // settings is present in props but unused in this component, removing from destructuring to satisfy noUnusedLocals
  aiPlans,
  setAiPlans,
  activePlanId,
  setActivePlanId
}) => {
  // --- State Management ---
  const [activeMenu, setActiveMenu] = useState<string | null>(null);
  const [editingFileId, setEditingFileId] = useState<string | null>(null);
  const [tempFileName, setTempFileName] = useState('');
  
  // View Settings
  const [wordWrap, setWordWrap] = useState(true);
  const [fontSize, setFontSize] = useState(14);
  const [showLineNumbers, setShowLineNumbers] = useState(true);
  
  // Find Widget State
  const [showFind, setShowFind] = useState(false);
  const [findText, setFindText] = useState('');
  const [currentMatchIndex, setCurrentMatchIndex] = useState(0);
  const [totalMatches, setTotalMatches] = useState(0);
  const [matches, setMatches] = useState<{start: number, end: number}[]>([]);

  // AI Assistant State
  const [showAIPanel, setShowAIPanel] = useState(false);
  const [panelWidth, setPanelWidth] = useState(400);
  const [isResizing, setIsResizing] = useState(false);
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiLanguage, setAiLanguage] = useState('');
  const [isGeneratingPlan, setIsGeneratingPlan] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  
  // AI Synoptic Table States
  const [expandedBlocks, setExpandedBlocks] = useState<Set<string>>(new Set());
  const [importsExpanded, setImportsExpanded] = useState(true);
  // Removed unused activeBlockMenu state
  const [visibleCodeBlocks, setVisibleCodeBlocks] = useState<Set<string>>(new Set());
  
  // AI Explanation State
  const [explanations, setExplanations] = useState<Record<string, string>>({});
  const [explainingId, setExplainingId] = useState<string | null>(null);
  
  // Abort controller ref to cancel requests
  const abortControllerRef = useRef<AbortController | null>(null);

  // Refs
  const menuRef = useRef<HTMLDivElement>(null);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const gutterRef = useRef<HTMLDivElement>(null);
  const editorScrollRef = useRef<HTMLDivElement>(null);
  const sidebarRef = useRef<HTMLDivElement>(null);

  // --- Helpers ---
  const activeFile = files.find(f => f.id === activeFileId) || files[0];
  const activeAiPlan = aiPlans.find(p => p.id === activePlanId) || null;

  // --- Undo/Redo Logic ---
  const saveHistory = (fileId: string, newContent: string) => {
    setFiles(prevFiles => prevFiles.map(f => {
      if (f.id === fileId) {
        if (f.history[f.historyIndex] === newContent) return f;
        const newHistory = f.history.slice(0, f.historyIndex + 1);
        newHistory.push(newContent);
        if (newHistory.length > 50) newHistory.shift(); 
        return { ...f, content: newContent, history: newHistory, historyIndex: newHistory.length - 1 };
      }
      return f;
    }));
  };

  const debouncedSaveHistory = (fileId: string, newContent: string) => {
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    debounceTimerRef.current = setTimeout(() => {
      saveHistory(fileId, newContent);
    }, 800);
  };

  const updateActiveFileContent = (newContent: string) => {
    setFiles(files.map(f => f.id === activeFileId ? { ...f, content: newContent } : f));
    debouncedSaveHistory(activeFileId, newContent);
  };

  const undo = () => {
    const file = activeFile;
    if (file.historyIndex > 0) {
      const newIndex = file.historyIndex - 1;
      const newContent = file.history[newIndex];
      setFiles(files.map(f => f.id === activeFileId ? { ...f, content: newContent, historyIndex: newIndex } : f));
    }
  };

  const redo = () => {
    const file = activeFile;
    if (file.historyIndex < file.history.length - 1) {
      const newIndex = file.historyIndex + 1;
      const newContent = file.history[newIndex];
      setFiles(files.map(f => f.id === activeFileId ? { ...f, content: newContent, historyIndex: newIndex } : f));
    }
  };

  // --- Rename Logic ---
  const startRenaming = (e: React.MouseEvent, file: EditorFile) => {
    e.stopPropagation();
    setEditingFileId(file.id);
    setTempFileName(file.name);
  };

  const confirmRename = () => {
    if (editingFileId && tempFileName.trim()) {
      setFiles(files.map(f => f.id === editingFileId ? { ...f, name: tempFileName.trim() } : f));
    }
    setEditingFileId(null);
    setTempFileName('');
  };

  const handleRenameKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') confirmRename();
    if (e.key === 'Escape') setEditingFileId(null);
  };

  // --- Find Logic ---
  const performSearch = useCallback((text: string, term: string) => {
    if (!term) {
      setMatches([]);
      setTotalMatches(0);
      return;
    }
    const escapedTerm = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(escapedTerm, 'gi');
    const newMatches = [];
    let match;
    while ((match = regex.exec(text)) !== null) {
      newMatches.push({ start: match.index, end: match.index + term.length });
    }
    setMatches(newMatches);
    setTotalMatches(newMatches.length);
    setCurrentMatchIndex(0);
  }, []);

  const findNext = () => {
    if (matches.length === 0) return;
    const nextIndex = (currentMatchIndex + 1) % matches.length;
    setCurrentMatchIndex(nextIndex);
  };

  const findPrev = () => {
    if (matches.length === 0) return;
    const prevIndex = (currentMatchIndex - 1 + matches.length) % matches.length;
    setCurrentMatchIndex(prevIndex);
  };

  useEffect(() => {
    if (showFind) {
      performSearch(activeFile.content, findText);
    } else {
      setMatches([]);
    }
  }, [activeFile.content, findText, showFind, performSearch]);

  useEffect(() => {
    if (showFind && matches.length > 0) {
      const el = document.getElementById('current-match-highlight');
      if (el) {
        el.scrollIntoView({ block: 'center', behavior: 'smooth' });
      }
    }
  }, [currentMatchIndex, showFind, matches.length]);

  // --- AI Assistant Logic ---

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isResizing) {
        const newWidth = document.body.clientWidth - e.clientX;
        setPanelWidth(Math.max(250, Math.min(newWidth, 800)));
      }
    };
    const handleMouseUp = () => setIsResizing(false);
    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing]);

  const cancelGeneration = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsGeneratingPlan(false);
    setAiError("Request cancelled by user");
  };

  const getApiKey = () => {
    const stored = localStorage.getItem('b_code_walker_api_key');
    if (stored) return stored;
    // Use Vite env variable instead of process.env for standard build compatibility
    return import.meta.env.VITE_API_KEY || '';
  };

  const generateAIPlan = async () => {
    if (!aiPrompt) return;

    const apiKey = getApiKey();
    if (!apiKey) {
      setAiError("Please set your Google Gemini API Key in the Settings tab.");
      return;
    }

    abortControllerRef.current = new AbortController();
    setIsGeneratingPlan(true);
    setAiError(null);
    setExpandedBlocks(new Set());
    setImportsExpanded(true);
    setExplanations({});
    setVisibleCodeBlocks(new Set());

    try {
      const ai = new GoogleGenAI({ apiKey: apiKey });
      const model = 'gemini-3-pro-preview'; 

      const systemInstruction = `
        You are an expert full-stack coding engine and visualizer.
        Analyze the user's request and the desired language.
        Generate the FULL implementation code, structured as a hierarchical tree.
        
        CRITICAL RULES:
        1. Separate the code into 'Imports' and 'Blocks'.
        2. 'Blocks' is a recursive list of code regions. 
        3. 'signature': The header line of the block.
        4. 'code': The FULL body content.
        5. 'type': 'function', 'class', 'statement', or 'variable'.
        6. 'explanation': A short markdown explanation of what this block does (1-2 sentences).
        7. 'mermaid': A valid Mermaid.js flowchart string representing the logic within this block. Use graph TD;
        8. 'visualType': One of 'process', 'database', 'ui', 'api', 'logic' that best represents this block visually.
        9. 'globalExplanation': An overview of the entire solution.
        10. 'globalMermaid': A Mermaid diagram for the whole system.
        11. Make sure you create as many signatures as present as blocks
        12. Make sure to create a signature block for imports at the start
      `;

      // Helper for recursive schema definition
      const deepBlockSchema = (depth: number): any => {
        if (depth === 0) return {
           type: Type.OBJECT,
           properties: {
             id: { type: Type.STRING },
             type: { type: Type.STRING },
             signature: { type: Type.STRING },
             code: { type: Type.STRING },
             explanation: { type: Type.STRING },
             mermaid: { type: Type.STRING },
             visualType: { type: Type.STRING }
           }
        };
        return {
           type: Type.OBJECT,
           properties: {
             id: { type: Type.STRING },
             type: { type: Type.STRING },
             signature: { type: Type.STRING },
             code: { type: Type.STRING },
             explanation: { type: Type.STRING },
             mermaid: { type: Type.STRING },
             visualType: { type: Type.STRING },
             children: { type: Type.ARRAY, items: deepBlockSchema(depth - 1) }
           }
        };
      };

      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error("Request timed out.")), 300000)
      );

      const apiCall = ai.models.generateContent({
        model: model,
        contents: `Language: ${aiLanguage || 'Auto-detect'}. Request: ${aiPrompt}`,
        config: {
          systemInstruction: systemInstruction,
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              language: { type: Type.STRING },
              imports: { type: Type.ARRAY, items: { type: Type.STRING } },
              globalExplanation: { type: Type.STRING },
              globalMermaid: { type: Type.STRING },
              blocks: {
                type: Type.ARRAY,
                items: deepBlockSchema(3) // Support up to 3 levels of nesting
              }
            }
          }
        }
      });

      const response = await Promise.race([apiCall, timeoutPromise]) as any;
      if (!isGeneratingPlan && abortControllerRef.current === null) return;

      if (response.text) {
        try {
          const rawPlan = JSON.parse(response.text);
          // Pre-expand top-level blocks
          const initialExpanded = new Set<string>();
          if (rawPlan.blocks) {
             rawPlan.blocks.forEach((b: any) => initialExpanded.add(b.id));
          }
          
          const newPlan: AIPlan = {
             ...rawPlan,
             id: Date.now().toString(),
             name: aiPrompt.trim().substring(0, 24) + (aiPrompt.length > 24 ? '...' : ''),
             timestamp: Date.now()
          };
          
          setExpandedBlocks(initialExpanded);
          setAiPlans(prev => [...prev, newPlan]);
          setActivePlanId(newPlan.id);
          
        } catch(e) {
          throw new Error("Failed to parse AI response.");
        }
      }
    } catch (e: any) {
      if (e.message !== "Request cancelled by user") {
         setAiError(e.message || "An unexpected error occurred.");
      }
    } finally {
      setIsGeneratingPlan(false);
      abortControllerRef.current = null;
    }
  };

  const explainCode = async (id: string, code: string) => {
    // Removed setActiveBlockMenu(null) as state was removed
    if (explanations[id]) {
      // Just ensure visible
      return;
    }

    const apiKey = getApiKey();
    if (!apiKey) {
      setExplanations(prev => ({ ...prev, [id]: "Please set API Key in Settings." }));
      return;
    }

    setExplainingId(id);
    
    try {
      const ai = new GoogleGenAI({ apiKey: apiKey });
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: `Explain this code block simply in one or two sentences:\n\n${code}`
      });
      setExplanations(prev => ({ ...prev, [id]: response.text || "No explanation returned." }));
    } catch (e) {
      console.error(e);
      setExplanations(prev => ({ ...prev, [id]: "Failed to generate explanation." }));
    } finally {
      setExplainingId(null);
    }
  };

  const toggleBlock = (id: string) => {
    const newSet = new Set(expandedBlocks);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setExpandedBlocks(newSet);
  };

  const toggleCodeVisibility = (id: string) => {
    const newSet = new Set(visibleCodeBlocks);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setVisibleCodeBlocks(newSet);
  };

  const updateActiveFileLanguage = (newLang: SupportedLanguage) => {
    setFiles(files.map(f => f.id === activeFileId ? { ...f, language: newLang } : f));
  };

  const createNewFile = () => {
    const newId = Date.now().toString();
    const newFile: EditorFile = {
      id: newId,
      name: `untitled-${files.length + 1}.js`,
      language: SupportedLanguage.JAVASCRIPT,
      content: '',
      history: [''],
      historyIndex: 0
    };
    setFiles([...files, newFile]);
    setActiveFileId(newId);
    setActiveMenu(null);
  };

  const closeFile = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (files.length === 1) {
      if (window.confirm("Close the last file? This will clear its content.")) {
        setFiles([{ ...files[0], content: '', name: 'untitled-1.js', history: [''], historyIndex: 0 }]);
      }
      return;
    }
    const newFiles = files.filter(f => f.id !== id);
    setFiles(newFiles);
    if (id === activeFileId) {
      setActiveFileId(newFiles[newFiles.length - 1].id);
    }
  };

  const handleDownload = () => {
    const blob = new Blob([activeFile.content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = activeFile.name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setActiveMenu(null);
  };

  const insertCode = (code: string) => {
    const newContent = activeFile.content + '\n' + code;
    updateActiveFileContent(newContent);
    // Removed setActiveBlockMenu(null)
  };

  // Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault(); undo();
      }
      if (((e.ctrlKey || e.metaKey) && e.key === 'y') || ((e.ctrlKey || e.metaKey) && e.key === 'z' && e.shiftKey)) {
        e.preventDefault(); redo();
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
        e.preventDefault();
        setShowFind(prev => !prev);
        setTimeout(() => document.getElementById('find-input')?.focus(), 100);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeFileId, files]);

  // Click outside to close menus
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setActiveMenu(null);
      }
      if (!(event.target as Element).closest('.function-menu-btn')) {
        // Removed setActiveBlockMenu(null)
      }
      if (editingFileId && !(event.target as Element).closest('.tab-rename-input')) {
         confirmRename();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [editingFileId, tempFileName]);

  // Syntax Highlighting
  const highlight = (code: string) => {
    return Prism.highlight(code, Prism.languages[activeFile.language] || Prism.languages.javascript, activeFile.language);
  };

  // Scroll Sync
  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    if (gutterRef.current) gutterRef.current.scrollTop = e.currentTarget.scrollTop;
  };

  const lineCount = activeFile.content.split('\n').length;
  const lineNumbers = Array.from({ length: lineCount }, (_, i) => i + 1);

  // --- Highlight Overlay ---
  const HighlightOverlay = useMemo(() => {
    if (!showFind || matches.length === 0) return null;
    const fragments = [];
    let lastIndex = 0;
    matches.forEach((match, i) => {
      if (match.start > lastIndex) {
        fragments.push(<span key={`text-${i}`} className="text-transparent">{activeFile.content.slice(lastIndex, match.start)}</span>);
      }
      const isCurrent = i === currentMatchIndex;
      fragments.push(<span key={`match-${i}`} id={isCurrent ? 'current-match-highlight' : `match-${i}`} className={`${isCurrent ? 'bg-orange-500/80' : 'bg-yellow-500/30'} text-transparent rounded-[1px]`}>{activeFile.content.slice(match.start, match.end)}</span>);
      lastIndex = match.end;
    });
    if (lastIndex < activeFile.content.length) {
      fragments.push(<span key="text-end" className="text-transparent">{activeFile.content.slice(lastIndex)}</span>);
    }
    return (
      <pre className="editor-font leading-relaxed absolute top-0 left-0 m-0 pointer-events-none select-none" style={{ fontFamily: '"Fira Code", "Fira Mono", monospace', fontSize: `${fontSize}px`, whiteSpace: wordWrap ? 'pre-wrap' : 'pre', padding: '20px', minHeight: '100%', minWidth: '100%', zIndex: 0, boxSizing: 'border-box', color: 'transparent' }}>{fragments}</pre>
    );
  }, [activeFile.content, matches, currentMatchIndex, showFind, fontSize, wordWrap]);

  const MenuDropdown = ({ label, id, items }: { label: string, id: string, items: { label?: string, action?: () => void, divider?: boolean, check?: boolean }[] }) => (
    <div className="relative">
      <button className={`px-3 py-1 text-sm rounded hover:bg-[var(--bg-tertiary)] ${activeMenu === id ? 'bg-[var(--bg-tertiary)] text-[var(--text-primary)]' : 'text-[var(--text-secondary)]'}`} onClick={() => setActiveMenu(activeMenu === id ? null : id)}>{label}</button>
      {activeMenu === id && (
        <div className="absolute left-0 mt-1 w-48 bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded shadow-xl z-50">
          {items.map((item, idx) => (
            item.divider ? <div key={idx} className="border-t border-[var(--border-color)] my-1"></div> : <button key={idx} className="w-full text-left px-4 py-2 text-sm text-[var(--text-secondary)] hover:bg-blue-600 hover:text-white flex justify-between items-center" onClick={() => { if(item.action) item.action(); if (item.label && !item.label.includes('Wrap') && !item.label.includes('Size') && !item.label.includes('Line')) setActiveMenu(null); }}><span>{item.label}</span>{item.check && <span>✓</span>}</button>
          ))}
        </div>
      )}
    </div>
  );

  // --- Clean Tree Block Renderer ---
  // Fix: Typed as React.FC to support 'key' prop in recursive and list calls
  const BlockRenderer: React.FC<{ block: AICodeBlock, level?: number }> = ({ block, level = 0 }) => {
    const isExpanded = expandedBlocks.has(block.id);
    const isCodeVisible = visibleCodeBlocks.has(block.id);
    const hasChildren = block.children && block.children.length > 0;
    const isControlFlow = block.type === 'statement';
    
    // Type icons
    const TypeIcon = () => {
        if (block.type === 'function') return <CodeBracketIcon className="w-3.5 h-3.5 text-blue-400" />;
        if (block.type === 'class') return <Square2StackIcon className="w-3.5 h-3.5 text-yellow-500" />;
        if (block.type === 'variable') return <DocumentTextIcon className="w-3.5 h-3.5 text-cyan-400" />;
        return <DocumentTextIcon className="w-3.5 h-3.5 text-gray-500" />;
    };

    return (
       <div className="relative">
          {/* Guide Line for Children */}
          {level > 0 && (
              <div 
                className="absolute left-0 top-0 bottom-0 w-px bg-[var(--border-color)]" 
                style={{ left: '-1px' }} 
              />
          )}

          {/* Row Content */}
          <div 
             className={`
                group flex items-center py-1 pr-2 hover:bg-[var(--bg-tertiary)] cursor-pointer transition-colors relative
                ${level === 0 ? 'border-t border-[var(--border-color)]' : ''}
             `}
             style={{ paddingLeft: `${Math.max(4, level * 16)}px` }}
          >
             {/* Left Action: Expand/Collapse */}
             <div 
               onClick={() => toggleBlock(block.id)}
               className="flex items-center justify-center w-5 h-5 mr-1 hover:bg-white/10 rounded flex-none"
             >
                {hasChildren ? (
                    <ChevronDownIcon className={`w-3 h-3 text-[var(--text-secondary)] transition-transform ${isExpanded ? '' : '-rotate-90'}`} />
                ) : (
                    <div className="w-1 h-1 rounded-full bg-gray-600" />
                )}
             </div>

             {/* Content Click: Toggle Code or Expand */}
             <div className="flex items-center flex-1 min-w-0 gap-2" onClick={() => toggleBlock(block.id)}>
                <TypeIcon />
                <span className={`font-mono text-xs truncate select-none ${isControlFlow ? 'text-purple-300' : 'text-[var(--text-secondary)]'}`}>
                    {block.signature}
                </span>
             </div>

             {/* Right Actions: Hover Only */}
             <div className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity gap-1 ml-2">
                <button 
                    onClick={(e) => { e.stopPropagation(); toggleCodeVisibility(block.id); }}
                    className={`p-1 rounded hover:bg-[var(--bg-primary)] ${isCodeVisible ? 'text-blue-400 bg-[var(--bg-primary)]' : 'text-[var(--text-secondary)]'}`}
                    title="Toggle Code"
                >
                    <EyeIcon className="w-3 h-3" />
                </button>
                <button 
                    onClick={(e) => { e.stopPropagation(); insertCode(block.code); }}
                    className="p-1 rounded hover:bg-[var(--bg-primary)] text-[var(--text-secondary)] hover:text-white"
                    title="Insert Code"
                >
                    <PlusIcon className="w-3 h-3" />
                </button>
                <button 
                    onClick={(e) => { e.stopPropagation(); explainCode(block.id, block.code); }}
                    className="p-1 rounded hover:bg-[var(--bg-primary)] text-[var(--text-secondary)] hover:text-white"
                    title="Explain"
                >
                    <ChatBubbleLeftRightIcon className="w-3 h-3" />
                </button>
             </div>
          </div>

          {/* Inline Content Area */}
          <div className="relative">
              {level >= 0 && (
                  <div className="absolute left-0 top-0 bottom-0 w-px bg-[var(--border-color)]" style={{ left: `${(level * 16) + 10}px` }} />
              )}
              
              <div style={{ paddingLeft: `${(level * 16) + 24}px` }}>
                  {/* Explanation Block */}
                  {explanations[block.id] && (
                     <div className="my-1 p-2 bg-blue-900/20 border-l-2 border-blue-500 text-xs text-[var(--text-secondary)] italic">
                        {explainingId === block.id ? 'Thinking...' : explanations[block.id]}
                     </div>
                  )}

                  {/* Code Block (Peek) */}
                  {isCodeVisible && (
                      <div className="my-1 bg-[var(--bg-primary)] border border-[var(--border-color)] rounded p-2 overflow-x-auto group/code relative">
                          <pre className="font-mono text-[10px] leading-relaxed text-[var(--text-secondary)] whitespace-pre">{block.code}</pre>
                          <button 
                              onClick={() => navigator.clipboard.writeText(block.code)}
                              className="absolute top-1 right-1 opacity-0 group-hover/code:opacity-100 bg-[var(--bg-tertiary)] text-white text-[9px] px-1.5 py-0.5 rounded"
                          >
                              Copy
                          </button>
                      </div>
                  )}

                  {/* Recursion */}
                  {isExpanded && hasChildren && (
                      <div className="flex flex-col">
                          {block.children!.map(child => (
                              <BlockRenderer key={child.id} block={child} level={level + 1} />
                          ))}
                      </div>
                  )}
              </div>
          </div>
       </div>
    );
  };

  return (
    <div className="flex flex-col h-full bg-[var(--bg-primary)] relative">
      {/* Search Widget */}
      {showFind && (
        <div className="absolute top-10 right-10 z-50 bg-[var(--bg-secondary)] border border-[var(--border-color)] shadow-2xl p-2 rounded-md flex items-center space-x-2 w-80">
          <MagnifyingGlassIcon className="w-4 h-4 text-[var(--text-secondary)]" />
          <input id="find-input" type="text" placeholder="Find" className="bg-[var(--bg-tertiary)] text-[var(--text-primary)] text-sm px-2 py-1 rounded border border-transparent focus:border-blue-500 focus:outline-none flex-1" value={findText} onChange={(e) => setFindText(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); if (e.shiftKey) findPrev(); else findNext(); } }} />
          <div className="text-xs text-[var(--text-secondary)] whitespace-nowrap min-w-[40px] text-center">{totalMatches > 0 ? `${currentMatchIndex + 1} of ${totalMatches}` : 'No results'}</div>
          <button onClick={findPrev} className="p-1 hover:bg-[var(--bg-tertiary)] rounded"><ChevronUpIcon className="w-4 h-4 text-[var(--text-secondary)]" /></button>
          <button onClick={findNext} className="p-1 hover:bg-[var(--bg-tertiary)] rounded"><ChevronDownIcon className="w-4 h-4 text-[var(--text-secondary)]" /></button>
          <button onClick={() => setShowFind(false)} className="p-1 hover:bg-[var(--bg-tertiary)] rounded ml-1"><XMarkIcon className="w-4 h-4 text-[var(--text-secondary)]" /></button>
        </div>
      )}

      {/* Top Menu Bar */}
      <div ref={menuRef} className="flex-none bg-[var(--bg-secondary)] border-b border-[var(--border-color)] px-2 py-1 flex items-center select-none">
        <MenuDropdown label="File" id="file" items={[{ label: 'New File', action: createNewFile }, { label: 'Download File', action: handleDownload }, { divider: true }, { label: 'Close Tab', action: () => closeFile({ stopPropagation: () => {} } as React.MouseEvent, activeFileId) }]} />
        <MenuDropdown label="Edit" id="edit" items={[{ label: 'Undo', action: undo }, { label: 'Redo', action: redo }, { divider: true }, { label: 'Find', action: () => { setShowFind(true); setTimeout(() => document.getElementById('find-input')?.focus(), 50); } }, { divider: true }, { label: 'Copy All', action: () => navigator.clipboard.writeText(activeFile.content) }, { label: 'Paste', action: async () => { try { const text = await navigator.clipboard.readText(); updateActiveFileContent(activeFile.content + text); } catch(e) {} } }, { divider: true }, { label: 'Clear Editor', action: () => { if(confirm('Clear content?')) updateActiveFileContent(''); } }]} />
        <MenuDropdown label="View" id="view" items={[{ label: 'Toggle Line Numbers', check: showLineNumbers, action: () => setShowLineNumbers(!showLineNumbers) }, { label: 'Toggle Word Wrap', check: wordWrap, action: () => setWordWrap(!wordWrap) }, { divider: true }, { label: 'Zoom In', action: () => setFontSize(prev => Math.min(prev + 2, 30)) }, { label: 'Zoom Out', action: () => setFontSize(prev => Math.max(prev - 2, 10)) }, { label: 'Reset Zoom', action: () => setFontSize(14) }]} />
      </div>

      {/* File Tabs */}
      <div className="flex-none bg-[var(--bg-secondary)] flex items-center overflow-x-auto no-scrollbar pr-2">
        {files.map(file => (
          <div 
             key={file.id} 
             onClick={() => setActiveFileId(file.id)} 
             className={`
                group flex items-center space-x-2 px-3 py-2 min-w-[120px] max-w-[200px] text-sm cursor-pointer border-r border-[var(--border-color)] select-none 
                ${activeFile.id === file.id ? 'bg-[var(--tab-active)] text-[var(--text-primary)] border-t-2 border-t-blue-500' : 'bg-[var(--tab-inactive)] text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]'}
             `}
             onDoubleClick={(e) => startRenaming(e, file)}
          >
            {editingFileId === file.id ? (
              <div className="flex items-center gap-1 flex-1 tab-rename-input">
                <input 
                  autoFocus
                  type="text" 
                  value={tempFileName} 
                  onChange={(e) => setTempFileName(e.target.value)}
                  onKeyDown={handleRenameKeyDown}
                  onBlur={confirmRename}
                  className="w-full bg-[var(--bg-primary)] text-[var(--text-primary)] px-1 rounded text-xs focus:outline-none border border-blue-500"
                />
                <button onMouseDown={confirmRename} className="text-green-500 hover:text-green-400"><CheckIcon className="w-3 h-3" /></button>
              </div>
            ) : (
              <>
                 <span className="truncate flex-1">{file.name}</span>
                 {activeFile.id === file.id && (
                    <button onClick={(e) => startRenaming(e, file)} className="p-0.5 rounded opacity-0 group-hover:opacity-100 text-[var(--text-secondary)] hover:text-blue-400" title="Rename"><PencilIcon className="w-3 h-3" /></button>
                 )}
                 <button onClick={(e) => closeFile(e, file.id)} className={`p-0.5 rounded-md opacity-0 group-hover:opacity-100 hover:bg-[var(--bg-tertiary)] ${files.length === 1 ? 'hidden' : ''}`}><XMarkIcon className="w-3 h-3" /></button>
              </>
            )}
          </div>
        ))}
        <button onClick={createNewFile} className="p-2 text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] transition-colors" title="New File"><PlusIcon className="w-4 h-4" /></button>
        <div className="flex-1"></div>
        <button onClick={() => setShowAIPanel(!showAIPanel)} className={`flex items-center space-x-1 px-3 py-1 text-xs font-medium rounded transition-colors ml-2 ${showAIPanel ? 'bg-blue-600 text-white' : 'bg-[var(--bg-tertiary)] text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)]'}`}><SparklesIcon className="w-3 h-3" /><span>Generate Code</span></button>
      </div>

      {/* Editor Toolbar */}
      <div className="flex-none bg-[var(--bg-secondary)] px-4 py-2 flex justify-between items-center border-b border-[var(--border-color)]">
        <div className="flex items-center space-x-4">
           <div className="relative group">
            <select value={activeFile.language} onChange={(e) => updateActiveFileLanguage(e.target.value as SupportedLanguage)} className="appearance-none bg-[var(--bg-tertiary)] text-blue-400 text-xs font-semibold px-3 py-1 pr-8 rounded border border-[var(--border-color)] focus:outline-none cursor-pointer hover:border-gray-500">
              {Object.values(SupportedLanguage).map((lang) => (<option key={lang} value={lang}>{lang.toUpperCase()}</option>))}
            </select>
            <ChevronDownIcon className="w-3 h-3 absolute right-2 top-1.5 text-[var(--text-secondary)] pointer-events-none" />
          </div>
          <div className="flex items-center space-x-1">
             <button onClick={undo} disabled={activeFile.historyIndex <= 0} className="p-1 hover:bg-[var(--bg-tertiary)] rounded disabled:opacity-30 text-[var(--text-secondary)]"><ArrowPathIcon className="w-3 h-3 -scale-x-100" /></button>
             <button onClick={redo} disabled={activeFile.historyIndex >= activeFile.history.length - 1} className="p-1 hover:bg-[var(--bg-tertiary)] rounded disabled:opacity-30 text-[var(--text-secondary)]"><ArrowPathIcon className="w-3 h-3" /></button>
          </div>
        </div>
        <div className="flex items-center space-x-4 text-xs text-[var(--text-secondary)]">
          <span>Ln {lineCount}</span><span>{fontSize}px</span><span>{activeFile.language}</span><span>UTF-8</span>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 relative bg-[var(--editor-bg)] flex overflow-hidden">
        {/* Code Editor */}
        <div className="flex-1 flex overflow-hidden">
          {showLineNumbers && (
            <div ref={gutterRef} className="flex-none w-12 bg-[var(--editor-bg)] border-r border-[var(--border-color)] text-right pr-3 pt-[20px] select-none text-gray-500 overflow-hidden editor-font leading-relaxed" style={{ fontSize: `${fontSize}px` }}>
              {lineNumbers.map((num) => (<div key={num} className="h-[1.625em]">{num}</div>))}
            </div>
          )}
          <div className="flex-1 overflow-auto relative" ref={editorScrollRef} onScroll={handleScroll}>
            <div className="min-h-full min-w-full relative">
              {HighlightOverlay}
              <div className="relative z-10">
                <Editor textareaId={`editor-textarea-${activeFileId}`} value={activeFile.content} onValueChange={updateActiveFileContent} highlight={highlight} padding={20} className="editor-font leading-relaxed min-h-full" style={{ fontFamily: '"Fira Code", "Fira Mono", monospace', fontSize: `${fontSize}px`, backgroundColor: 'transparent', color: 'var(--text-secondary)', minHeight: '100%', whiteSpace: wordWrap ? 'pre-wrap' : 'pre' }} textareaClassName="focus:outline-none text-[var(--text-primary)]" />
              </div>
            </div>
          </div>
        </div>

        {/* AI Assistant Panel */}
        {showAIPanel && (
          <>
            <div className="w-1 bg-[var(--border-color)] hover:bg-blue-500 cursor-col-resize z-20 flex-none transition-colors" onMouseDown={() => setIsResizing(true)} />
            <div className="bg-[var(--bg-secondary)] border-l border-[var(--border-color)] flex flex-col" style={{ width: panelWidth }}>
              <div className="p-4 border-b border-[var(--border-color)] bg-[var(--bg-tertiary)] flex justify-between items-center">
                <h2 className="text-sm font-bold text-[var(--text-primary)] flex items-center gap-2"><SparklesIcon className="w-4 h-4 text-blue-400" />Code Generator</h2>
                <button onClick={() => setShowAIPanel(false)} className="text-[var(--text-secondary)] hover:text-[var(--text-primary)]"><XMarkIcon className="w-4 h-4" /></button>
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-4" ref={sidebarRef}>
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs text-[var(--text-secondary)] mb-1">Instruction</label>
                    <textarea className="w-full bg-[var(--bg-primary)] border border-[var(--border-color)] rounded p-2 text-sm text-[var(--text-primary)] focus:border-blue-500 focus:outline-none resize-y min-h-[80px]" placeholder="e.g. Create a ToDo list with React hooks..." value={aiPrompt} onChange={(e) => setAiPrompt(e.target.value)} />
                  </div>
                  <div>
                    <label className="block text-xs text-[var(--text-secondary)] mb-1">Language</label>
                    <input type="text" className="w-full bg-[var(--bg-primary)] border border-[var(--border-color)] rounded p-2 text-sm text-[var(--text-primary)] focus:border-blue-500 focus:outline-none" placeholder="e.g. React, Typescript, Python" maxLength={30} value={aiLanguage} onChange={(e) => setAiLanguage(e.target.value)} />
                  </div>
                  
                  {aiError && <div className="p-2 bg-red-900/30 border border-red-800 rounded text-xs text-red-300 flex items-start gap-2"><ExclamationTriangleIcon className="w-4 h-4 flex-none mt-0.5" /><span>{aiError}</span></div>}

                  {isGeneratingPlan ? (
                    <button onClick={cancelGeneration} className="w-full bg-red-600 hover:bg-red-700 text-white py-2 rounded text-sm font-medium transition-colors flex justify-center items-center gap-2"><StopCircleIcon className="w-4 h-4" />Cancel</button>
                  ) : (
                    <button onClick={generateAIPlan} disabled={!aiPrompt} className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2 rounded text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex justify-center items-center gap-2">Generate Code</button>
                  )}
                  {isGeneratingPlan && <div className="flex justify-center items-center gap-2 text-xs text-[var(--text-secondary)]"><ArrowPathIcon className="w-3 h-3 animate-spin" /><span>Generating Logic...</span></div>}
                </div>

                {/* Synoptic Tree View */}
                {activeAiPlan && (
                  <div className="animate-fade-in pb-10">
                    <h3 className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider mb-2 pb-1 border-b border-[var(--border-color)]">Code Structure</h3>
                    
                    {/* IMPORTS BLOCK */}
                    {activeAiPlan.imports && activeAiPlan.imports.length > 0 && (
                      <div className="mb-2">
                        <div 
                            onClick={() => setImportsExpanded(!importsExpanded)} 
                            className="flex items-center gap-2 py-1 px-2 cursor-pointer hover:bg-[var(--bg-tertiary)] rounded text-xs font-mono group"
                        >
                            <ChevronDownIcon className={`w-3 h-3 text-[var(--text-secondary)] transition-transform ${importsExpanded ? '' : '-rotate-90'}`} />
                            <span className="text-pink-400">imports</span>
                        </div>
                        
                        {importsExpanded && (
                           <div className="ml-5 border-l border-[var(--border-color)] pl-2 mt-1">
                             <div className="relative group/imports">
                                <pre className="font-mono text-[10px] text-green-300 whitespace-pre-wrap">{activeAiPlan.imports.join('\n')}</pre>
                                <div className="absolute top-0 right-0 hidden group-hover/imports:flex bg-[var(--bg-tertiary)] border border-[var(--border-color)] rounded">
                                     <button onClick={() => insertCode(activeAiPlan.imports.join('\n'))} className="p-1 hover:text-white text-[var(--text-secondary)]" title="Insert"><PlusIcon className="w-3 h-3" /></button>
                                </div>
                             </div>
                           </div>
                        )}
                      </div>
                    )}

                    {/* RECURSIVE BLOCKS LIST */}
                    <div className="space-y-1">
                        {(activeAiPlan.blocks || []).map((block) => (
                           <BlockRenderer key={block.id} block={block} />
                        ))}
                        {(!activeAiPlan.blocks || activeAiPlan.blocks.length === 0) && (
                          <div className="p-4 text-xs text-[var(--text-secondary)] text-center italic">No complex blocks identified.</div>
                        )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
