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
import 'prismjs/components/prism-markup-templating';
import 'prismjs/components/prism-java';
import 'prismjs/components/prism-csharp';
import 'prismjs/components/prism-c';
import 'prismjs/components/prism-cpp';
import 'prismjs/components/prism-go';
import 'prismjs/components/prism-rust';
import 'prismjs/components/prism-php';
import 'prismjs/components/prism-ruby';
import 'prismjs/components/prism-swift';
import 'prismjs/components/prism-kotlin';
import 'prismjs/components/prism-bash';
import 'prismjs/components/prism-yaml';

import { SupportedLanguage, EditorFile, AIPlan, AICodeBlock, AppSettings, APILog, AdvancedConfig } from '../types';
import { GoogleGenAI, Type } from "@google/genai";
import JSZip from 'jszip';
import { Dialog, ModalType } from './Modal';
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
  CheckIcon, 
  PaperAirplaneIcon, 
  CommandLineIcon, 
  ArrowsPointingOutIcon, 
  LanguageIcon
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

// ... [CONSTANTS: DEFAULT_SYSTEM_INSTRUCTION, THINKING_PROTOCOL_INSTRUCTION, PROJECT_SYSTEM_INSTRUCTION] ...
const DEFAULT_SYSTEM_INSTRUCTION = `You are an expert full-stack coding engine and visualizer.\nAnalyze the user's request and the desired language.\nGenerate the FULL implementation code, structured as a hierarchical tree.\n\nCRITICAL RULES:\n1. Separate the code into 'Imports' and 'Blocks'.\n2. 'Blocks' is a recursive list of code regions. \n3. 'signature': The header line of the block.\n4. 'code': The FULL body content.\n5. 'type': 'function', 'class', 'statement', or 'variable'.\n6. 'explanation': A short markdown explanation of what this block does (1-2 sentences).\n7. 'mermaid': A valid Mermaid.js flowchart string representing the logic within this block.\n8. 'visualType': One of 'process', 'database', 'ui', 'api', 'logic'. \n   CRITICAL: Choose the visual metaphor that best acts as a MNEMONIC for the code's behavior.\n9. 'visualSvg': A valid, unique, and ANIMATED SVG string (starting with <svg viewBox="0 0 200 100" xmlns="http://www.w3.org/2000/svg">) that visually represents this SPECIFIC function's logic using abstract geometry.\n   - REQUIREMENT: It MUST contain SVG animations (<animate>, <animateTransform>, <set>, etc.) to bring the metaphor to life.\n   - The visual must be SPECIFIC to the function (e.g., if it's a 'sort' function, show rectangles reordering; if 'fetch', show moving dots; if 'auth', show a key/lock interaction).\n   - Do not use text elements. Use pure geometry.\n   - Use 'currentColor' for main strokes to adapt to themes.\n   - Keep it minimalist, clean, and mnemonic.\n10. 'globalExplanation': An overview of the entire solution.\n11. 'globalMermaid': A Mermaid diagram for the whole system.\n12. Create signatures for code blocks up to 4 levels deep in hierarchy (e.g. Class > Method > Control Flow > Statement).\n13. Make sure to create a signature block for imports at the start\n14. CRITICAL: In the 'code' property, ALWAYS include a professional JSDoc/Docstring comment block immediately before the function/class/variable signature.\n15. 'comment': A concise, one-line technical comment (max 15 words) explaining exactly what this signature does in relation to the higher-level logic/parent block.\n\n!!! MERMAID SYNTAX ZERO-TOLERANCE POLICY !!!\nThe rendering engine is extremely strict. You MUST follow these rules for the 'mermaid' and 'globalMermaid' fields:\n\n1. ALWAYS use 'graph TD' or 'flowchart TD'.\n2. EVERY node label MUST be enclosed in double quotes.\n   - WRONG: A[Process Data]\n   - RIGHT: A["Process Data"]\n3. NEVER use parentheses (), brackets [], or braces {} inside a label unless the label is fully quoted. if you use these inside another loke a function form code, add single quotes inside the func value\n   - WRONG: A[func()]\n   - IMPORTAANT: RIGHT: A["func('any value')"] or empty oneA["func('')"]\n4. Escape double quotes inside strings: "Say \"Hello\"".\n5. DO NOT use semicolons (;) to separate statements. Use newlines.\n6. DO NOT include markdown code blocks (no \`\`\`mermaid).\n7. Node IDs must be alphanumeric strings without spaces (e.g., Node1, Step_A).`.trim();
const THINKING_PROTOCOL_INSTRUCTION = `RESPONSE FORMAT ENFORCEMENT FOR THINKING MODELS:\n\nYou have chain-of-thought capabilities enabled. \n1. You may output thinking/reasoning text at the start of your response.\n2. HOWEVER, the FINAL output MUST be a valid JSON object.\n3. You MUST wrap the final JSON in the following delimiters:\n\n     AVOCADO4\n     { ... your json content ... }\n     GUACAMOLE\n\n- The application will look for content between AVOCADO4 and GUACAMOLE.\n- NO MATTER WHAT YOU MUST RESPOND WITH JSON INSIDE THE DELIMITERS.`.trim();
const PROJECT_SYSTEM_INSTRUCTION = `You are a Modular Project Architect.\nYour goal is to generate a multi-file software project based on the user's request.\n\nOUTPUT STRUCTURE:\nYou must return a valid JSON object.\nThe root object MUST contain a 'blocks' array.\nThe 'blocks' array represents the FILES in the project, not code blocks of a single file.\n\nEXAMPLE JSON STRUCTURE:\n{\n  "globalExplanation": "Project overview...",\n  "imports": ["dependency1", "dependency2"],\n  "blocks": [\n    {\n      "type": "file",\n      "signature": "src/App.tsx",\n      "code": "...",\n      "explanation": "Main app component",\n      "children": []\n    }\n  ]\n}\n\nEACH ITEM IN 'blocks' MUST FOLLOW THIS SCHEMA:\n{\n  "type": "file",\n  "signature": "path/to/filename.ext", (Use forward slashes for folders. E.g. 'src/components/Button.tsx')\n  "code": "FULL CONTENT OF THE FILE",\n  "explanation": "Brief description of this file's purpose",\n  "children": [ ...Recursive list of code blocks INSIDE this file... ]\n}\n\nFOR THE 'children' PROPERTY (Inside each file):\n- Analyze the 'code' of the file.\n- Break it down into the standard hierarchy (Imports, Classes/Functions, Methods).\n- CRITICAL: You MUST generate 'mermaid', 'visualSvg', and 'visualType' for EVERY SIGNIFICANT FUNCTION/CLASS in the 'children' array.\n- The visualization engine relies on these nested blocks to show how the project works. \n- Do NOT leave 'mermaid' or 'visualSvg' empty for functions inside the files.\n- Follow the same visual generation rules as the standard mode (graph TD, double quoted labels, animated SVG).\n\nGLOBAL PROPERTIES:\n- "globalExplanation": Explain the architecture of the project.\n- "globalMermaid": A graph showing how the FILES interact or import each other.\n- "imports": Global dependencies (e.g. package.json dependencies list as strings).\n\nCRITICAL:\n1. Do NOT return a single file content in the root. The root 'blocks' array is the FILE LIST.\n2. Ensure file paths are realistic (e.g., 'index.html', 'css/style.css', 'js/app.js').\n3. Respond in valid JSON only.`.trim();

const getDeepBlockSchema = (depth: number): any => {
  const baseProps = {
    id: { type: Type.STRING },
    type: { type: Type.STRING },
    signature: { type: Type.STRING },
    comment: { type: Type.STRING },
    code: { type: Type.STRING },
    explanation: { type: Type.STRING },
    mermaid: { type: Type.STRING },
    visualType: { type: Type.STRING },
    visualSvg: { type: Type.STRING }
  };

  if (depth === 0) return { type: Type.OBJECT, properties: baseProps };
  return { type: Type.OBJECT, properties: { ...baseProps, children: { type: Type.ARRAY, items: getDeepBlockSchema(depth - 1) } } };
};

const DEFAULT_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    language: { type: Type.STRING },
    imports: { type: Type.ARRAY, items: { type: Type.STRING } },
    globalExplanation: { type: Type.STRING },
    globalMermaid: { type: Type.STRING },
    blocks: { type: Type.ARRAY, items: getDeepBlockSchema(4) }
  }
};

const DEFAULT_CONFIG: AdvancedConfig = {
  systemInstruction: DEFAULT_SYSTEM_INSTRUCTION,
  responseSchema: JSON.stringify(DEFAULT_SCHEMA, null, 2),
  temperature: 0.7,
  maxOutputTokens: 65536,
  thinkingBudget: 16384,
  includeThoughts: true,
  useResponseSchema: false
};

const getCleanImports = (imports: any[]): string[] => {
  if (!Array.isArray(imports)) return [];
  return imports.map(imp => {
    if (typeof imp === 'string') return imp;
    return imp.code || imp.statement || imp.text || JSON.stringify(imp);
  });
};

const assignUniqueIds = (blocks: any[], prefix: string = ''): any[] => {
  if (!Array.isArray(blocks)) return [];
  return blocks.map((block, index) => {
    if (!block || typeof block !== 'object') {
       return { id: `${prefix}-err-${index}`, type: 'comment', code: '', signature: 'Invalid Block', children: [] };
    }
    const uniqueId = block.id || `${prefix}-${index}-${Math.random().toString(36).substr(2, 9)}`;
    return {
      ...block,
      id: uniqueId,
      children: block.children ? assignUniqueIds(block.children, uniqueId) : []
    };
  });
};

// HELPER: Get API Key safely from LocalStorage
const getApiKey = (): string | null => {
    return localStorage.getItem('b_code_walker_api_key');
};

/**
 * Mobile-Responsive Language Selector Component
 * Replaces native <select> which can behave poorly on mobile (going off-screen/collapsing).
 * Features: Searchable dropdown, Full-screen modal on mobile, Keyboard navigation.
 */
const LanguageSelector = ({ current, onChange }: { current: SupportedLanguage, onChange: (lang: SupportedLanguage) => void }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleOutside = (e: MouseEvent) => {
        if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
            setIsOpen(false);
        }
    };
    if (isOpen) document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, [isOpen]);

  // Filter languages
  const filtered = Object.values(SupportedLanguage).filter(l => l.includes(search.toLowerCase()));

  return (
      <div className="relative" ref={containerRef}>
          <button 
             onClick={() => { setIsOpen(!isOpen); setSearch(''); }} 
             className="flex items-center gap-2 bg-[var(--bg-tertiary)] hover:bg-[var(--bg-primary)] border border-[var(--border-color)] rounded px-3 py-1 text-xs font-semibold text-[var(--accent-primary)] transition-colors min-w-[120px] justify-between"
             title="Select Language"
          >
              <span className="uppercase truncate">{current}</span>
              <ChevronDownIcon className="w-3 h-3 text-[var(--text-secondary)] flex-none" />
          </button>
          
          {isOpen && (
              <div className="hidden md:flex absolute top-full left-0 mt-1 w-64 max-h-[60vh] flex-col bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-lg shadow-2xl z-[100] animate-fade-in overflow-hidden">
                  <div className="p-2 border-b border-[var(--border-color)] bg-[var(--bg-tertiary)] sticky top-0 z-10">
                      <div className="flex items-center gap-2 bg-[var(--bg-primary)] px-2 py-1 rounded border border-[var(--border-color)]">
                          <MagnifyingGlassIcon className="w-3 h-3 text-gray-500" />
                          <input 
                              autoFocus
                              className="bg-transparent border-none focus:outline-none text-xs text-[var(--text-primary)] w-full"
                              placeholder="Search..."
                              value={search}
                              onChange={e => setSearch(e.target.value)}
                          />
                      </div>
                  </div>
                  <div className="overflow-y-auto p-1 custom-scrollbar bg-[var(--bg-secondary)]">
                      {filtered.map(lang => (
                          <button
                              key={lang}
                              onClick={() => { onChange(lang); setIsOpen(false); }}
                              className={`w-full text-left px-3 py-2 text-xs rounded flex items-center justify-between hover:bg-[var(--bg-tertiary)] ${current === lang ? 'text-[var(--accent-primary)] bg-[var(--accent-primary)]/5 font-bold' : 'text-[var(--text-secondary)]'}`}
                          >
                              <span className="uppercase">{lang}</span>
                              {current === lang && <CheckIcon className="w-3 h-3" />}
                          </button>
                      ))}
                      {filtered.length === 0 && <div className="p-3 text-center text-[var(--text-secondary)] text-xs italic">No results</div>}
                  </div>
              </div>
          )}
          
          {/* Mobile Overlay (Full Screen Modal) */}
          {isOpen && (
             <div className="md:hidden fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
                 <div className="bg-[var(--bg-secondary)] w-full max-w-sm max-h-[80vh] rounded-xl shadow-2xl flex flex-col border border-[var(--border-color)] overflow-hidden">
                      <div className="p-3 border-b border-[var(--border-color)] flex justify-between items-center bg-[var(--bg-tertiary)]">
                          <span className="font-bold text-sm text-[var(--text-primary)]">Select Language</span>
                          <button onClick={() => setIsOpen(false)} className="p-1 hover:bg-white/10 rounded"><XMarkIcon className="w-5 h-5 text-[var(--text-secondary)]" /></button>
                      </div>
                      <div className="p-3 border-b border-[var(--border-color)] bg-[var(--bg-secondary)]">
                         <div className="flex items-center gap-2 bg-[var(--bg-primary)] px-3 py-2 rounded border border-[var(--border-color)]">
                              <MagnifyingGlassIcon className="w-4 h-4 text-gray-500" />
                              <input 
                                  autoFocus
                                  className="bg-transparent border-none focus:outline-none text-sm text-[var(--text-primary)] w-full"
                                  placeholder="Search language..."
                                  value={search}
                                  onChange={e => setSearch(e.target.value)}
                              />
                          </div>
                      </div>
                      <div className="overflow-y-auto p-2 flex-1 custom-scrollbar">
                          {filtered.map(lang => (
                              <button
                                  key={lang}
                                  onClick={() => { onChange(lang); setIsOpen(false); }}
                                  className={`w-full text-left px-4 py-3 text-sm rounded-lg flex items-center justify-between mb-1 ${current === lang ? 'bg-[var(--accent-primary)] text-white font-bold' : 'text-[var(--text-secondary)] bg-[var(--bg-tertiary)]'}`}
                              >
                                  <span className="uppercase">{lang}</span>
                                  {current === lang && <CheckIcon className="w-4 h-4" />}
                              </button>
                          ))}
                          {filtered.length === 0 && <div className="p-4 text-center text-[var(--text-secondary)]">No matching languages found.</div>}
                      </div>
                 </div>
             </div>
          )}
      </div>
  );
};

export const EditorTab: React.FC<EditorTabProps> = ({ 
  files, setFiles, activeFileId, setActiveFileId, settings, aiPlans, setAiPlans, activePlanId, setActivePlanId
}) => {
  const [activeMenu, setActiveMenu] = useState<string | null>(null);
  const [editingFileId, setEditingFileId] = useState<string | null>(null);
  const [tempFileName, setTempFileName] = useState('');
  const [wordWrap, setWordWrap] = useState(true);
  const [fontSize, setFontSize] = useState(14);
  const [showLineNumbers, setShowLineNumbers] = useState(true);
  const [showFind, setShowFind] = useState(false);
  const [findText, setFindText] = useState('');
  const [currentMatchIndex, setCurrentMatchIndex] = useState(0);
  const [totalMatches, setTotalMatches] = useState(0);
  const [matches, setMatches] = useState<{start: number, end: number}[]>([]);
  const [showAIPanel, setShowAIPanel] = useState(false);
  const [panelWidth, setPanelWidth] = useState(400);
  const [logsHeight, setLogsHeight] = useState(250); 
  const [isResizing, setIsResizing] = useState(false);
  const [isResizingLogs, setIsResizingLogs] = useState(false); 
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiLanguage, setAiLanguage] = useState('');
  const [isProjectMode, setIsProjectMode] = useState(false); 
  const [useHierarchyDepth, setUseHierarchyDepth] = useState(false);
  const [hierarchyDepth, setHierarchyDepth] = useState(5);
  const [draftConfig, setDraftConfig] = useState<AdvancedConfig>(DEFAULT_CONFIG);
  const [draftLogs, setDraftLogs] = useState<APILog[]>([]);
  const [dialogState, setDialogState] = useState<{
    isOpen: boolean;
    type: ModalType;
    title: string;
    message?: string;
    onConfirm: (val?: string) => void;
  }>({ isOpen: false, type: 'info', title: '', onConfirm: () => {} });

  const closeDialog = () => setDialogState(prev => ({ ...prev, isOpen: false }));
  const activePlan = aiPlans.find(p => p.id === activePlanId) || null;
  const activeConfig = activePlan ? activePlan.config : draftConfig;
  const activeLogs = activePlan ? activePlan.logs : draftLogs;
  const [isGeneratingPlan, setIsGeneratingPlan] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [showDevMode, setShowDevMode] = useState(false);
  const [showAdvancedConfig, setShowAdvancedConfig] = useState(false); 
  const menuRef = useRef<HTMLDivElement>(null);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const gutterRef = useRef<HTMLDivElement>(null);
  const editorScrollRef = useRef<HTMLDivElement>(null);
  const sidebarRef = useRef<HTMLDivElement>(null);
  const logsEndRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const logsAccumulator = useRef<APILog[]>([]);
  const [expandedBlocks, setExpandedBlocks] = useState<Set<string>>(new Set());
  const [visibleCodeBlocks, setVisibleCodeBlocks] = useState<Set<string>>(new Set());
  const [explanations, setExplanations] = useState<Record<string, string>>({});
  const [annotatedBlocks, setAnnotatedBlocks] = useState<Record<string, string>>({});
  const [annotatingId, setAnnotatingId] = useState<string | null>(null);
  const [explainingId, setExplainingId] = useState<string | null>(null);
  const [queryingBlockId, setQueryingBlockId] = useState<string | null>(null);
  const [userQuestion, setUserQuestion] = useState('');

  const activeFile = files.find(f => f.id === activeFileId) || files[0];
  
  // Model detection: gemini-2.5-flash is NOT a thinking model per user request
  const isThinkingModel = settings.activeModel === 'gemini-2.5-pro' || settings.activeModel.includes('gemini-3');

  const updateConfig = (updates: Partial<AdvancedConfig>) => {
    if (activePlanId) {
      setAiPlans(prev => prev.map(p => p.id === activePlanId ? { ...p, config: { ...p.config, ...updates } } : p));
    } else {
      setDraftConfig(prev => ({ ...prev, ...updates }));
    }
  };

  useEffect(() => {
    if (showDevMode && logsEndRef.current) logsEndRef.current.scrollIntoView({ behavior: 'smooth' });
  }, [activeLogs, showDevMode, activeLogs.length]);

  const addLog = (stage: APILog['stage'], message: string, data?: any) => {
    const newLog: APILog = { time: new Date().toLocaleTimeString(), stage, message, data: data ? JSON.parse(JSON.stringify(data)) : undefined };
    if (activePlanId) {
      setAiPlans(prev => prev.map(p => p.id === activePlanId ? { ...p, logs: [...p.logs, newLog] } : p));
    } else {
      logsAccumulator.current.push(newLog);
      setDraftLogs(prev => [...prev, newLog]);
    }
  };

  const saveHistory = (fileId: string, newContent: string) => { setFiles(prevFiles => prevFiles.map(f => { if (f.id === fileId) { if (f.history[f.historyIndex] === newContent) return f; const newHistory = f.history.slice(0, f.historyIndex + 1); newHistory.push(newContent); if (newHistory.length > 50) newHistory.shift(); return { ...f, content: newContent, history: newHistory, historyIndex: newHistory.length - 1 }; } return f; })); };
  const debouncedSaveHistory = (fileId: string, newContent: string) => { if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current); debounceTimerRef.current = setTimeout(() => { saveHistory(fileId, newContent); }, 800); };
  const updateActiveFileContent = (newContent: string) => { setFiles(files.map(f => f.id === activeFileId ? { ...f, content: newContent } : f)); debouncedSaveHistory(activeFileId, newContent); };
  const undo = () => { const file = activeFile; if (file.historyIndex > 0) { const newIndex = file.historyIndex - 1; const newContent = file.history[newIndex]; setFiles(files.map(f => f.id === activeFileId ? { ...f, content: newContent, historyIndex: newIndex } : f)); } };
  const redo = () => { const file = activeFile; if (file.historyIndex < file.history.length - 1) { const newIndex = file.historyIndex + 1; const newContent = file.history[newIndex]; setFiles(files.map(f => f.id === activeFileId ? { ...f, content: newContent, historyIndex: newIndex } : f)); } };
  const startRenaming = (e: React.MouseEvent, file: EditorFile) => { e.stopPropagation(); setEditingFileId(file.id); setTempFileName(file.name); };
  const confirmRename = () => { if (editingFileId && tempFileName.trim()) { setFiles(files.map(f => f.id === editingFileId ? { ...f, name: tempFileName.trim() } : f)); } setEditingFileId(null); setTempFileName(''); };
  const handleRenameKeyDown = (e: React.KeyboardEvent) => { if (e.key === 'Enter') confirmRename(); if (e.key === 'Escape') setEditingFileId(null); };

  const performSearch = useCallback((text: string, term: string) => { if (!term) { setMatches([]); setTotalMatches(0); return; } const escapedTerm = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); const regex = new RegExp(escapedTerm, 'gi'); const newMatches = []; let match; while ((match = regex.exec(text)) !== null) { newMatches.push({ start: match.index, end: match.index + term.length }); } setMatches(newMatches); setTotalMatches(newMatches.length); setCurrentMatchIndex(0); }, []);
  const findNext = () => { if (matches.length === 0) return; const nextIndex = (currentMatchIndex + 1) % matches.length; setCurrentMatchIndex(nextIndex); };
  const findPrev = () => { if (matches.length === 0) return; const prevIndex = (currentMatchIndex - 1 + matches.length) % matches.length; setCurrentMatchIndex(prevIndex); };
  useEffect(() => { if (showFind) performSearch(activeFile.content, findText); else setMatches([]); }, [activeFile.content, findText, showFind, performSearch]);
  useEffect(() => { if (showFind && matches.length > 0) { const el = document.getElementById('current-match-highlight'); if (el) el.scrollIntoView({ block: 'center', behavior: 'smooth' }); } }, [currentMatchIndex, showFind, matches.length]);
  useEffect(() => { const handleMouseMove = (e: MouseEvent) => { if (isResizing) { const newWidth = document.body.clientWidth - e.clientX; setPanelWidth(Math.max(250, Math.min(newWidth, 800))); } if (isResizingLogs) { const newHeight = window.innerHeight - e.clientY; setLogsHeight(Math.max(50, Math.min(newHeight, window.innerHeight - 150))); } }; const handleMouseUp = () => { setIsResizing(false); setIsResizingLogs(false); }; if (isResizing || isResizingLogs) { document.addEventListener('mousemove', handleMouseMove); document.addEventListener('mouseup', handleMouseUp); document.body.style.userSelect = 'none'; document.body.style.cursor = isResizing ? 'col-resize' : 'row-resize'; } else { document.body.style.userSelect = ''; document.body.style.cursor = ''; } return () => { document.removeEventListener('mousemove', handleMouseMove); document.removeEventListener('mouseup', handleMouseUp); }; }, [isResizing, isResizingLogs]);

  const cancelGeneration = () => { if (abortControllerRef.current) { abortControllerRef.current.abort(); abortControllerRef.current = null; } setIsGeneratingPlan(false); setAiError("Request cancelled by user"); addLog('error', 'Request cancelled by user'); };

  const generateAIPlan = async () => {
    if (!aiPrompt) return;
    const apiKey = getApiKey();
    if (!apiKey) {
        setAiError("API Key missing. Please go to Settings and enter your Google GenAI Key.");
        addLog('error', 'API Key Missing. Request blocked.');
        return;
    }
    abortControllerRef.current = new AbortController();
    setIsGeneratingPlan(true);
    setAiError(null);
    setExpandedBlocks(new Set());
    setExplanations({});
    setAnnotatedBlocks({});
    setVisibleCodeBlocks(new Set());
    if (!activePlanId) { setDraftLogs([]); logsAccumulator.current = []; }
    addLog('sending', 'Preparing API Request...');
    
    try {
      const ai = new GoogleGenAI({ apiKey: apiKey });
      let parsedSchema;
      try { parsedSchema = JSON.parse(activeConfig.responseSchema); } catch (e) { throw new Error("Invalid JSON Schema in Dev Settings"); }
      let effectiveSystemInstruction = isProjectMode ? PROJECT_SYSTEM_INSTRUCTION : activeConfig.systemInstruction;
      if (isProjectMode) addLog('thinking', 'Project Mode Activated. Swapped System Instruction for Modular Architecture.');
      
      const config: any = { temperature: activeConfig.temperature };
      
      // Conditional Response Schema
      if (activeConfig.useResponseSchema) {
          config.responseSchema = parsedSchema;
          addLog('thinking', 'Enforcing Response Schema via API config.');
      } else {
          addLog('thinking', 'Response Schema enforcement disabled (using System Prompt only).');
      }
      
      if (isThinkingModel) {
        config.maxOutputTokens = activeConfig.maxOutputTokens;
        
        // Unified Logic: All Thinking models use thinkingBudget now
        config.thinkingConfig = { 
             includeThoughts: activeConfig.includeThoughts ?? true
        };

        if (activeConfig.thinkingBudget === -1) {
             // Auto/Default budget
             addLog('thinking', `Thinking Model Detected. Using Auto Budget (Model Default).`);
        } else {
             config.thinkingConfig.thinkingBudget = activeConfig.thinkingBudget;
             addLog('thinking', `Thinking Model Detected. Using Budget: ${activeConfig.thinkingBudget} tokens.`);
        }
        
        effectiveSystemInstruction += `\n\n${THINKING_PROTOCOL_INSTRUCTION}\n\n*** REQUIRED JSON STRUCTURE ***\nSince you are in Thinking Mode, you must ensure your final output inside the AVOCADO4 block adheres to this JSON schema:\n${JSON.stringify(parsedSchema, null, 2)}`;
      } else {
        config.responseMimeType = "application/json";
        config.maxOutputTokens = activeConfig.maxOutputTokens;
        addLog('sending', `Standard Model Detected. JSON MimeType enforced.`);
      }
      
      config.systemInstruction = effectiveSystemInstruction;
      let effectivePrompt = aiPrompt;
      if (useHierarchyDepth && isThinkingModel) effectivePrompt += ` ${hierarchyDepth} levels of hierchy in return json`;
      const configObj = { model: settings.activeModel, contents: `Language: ${aiLanguage || 'Auto-detect'}. Request: ${effectivePrompt}`, config: config };
      addLog('sending', 'Payload constructed. Sending to API...', configObj);
      addLog('ack', 'Request Acknowledged. Waiting for response...');
      const response = await ai.models.generateContent(configObj);
      addLog('response', 'Response Received', { candidates: response.candidates?.length, usage: response.usageMetadata, rawTextPreview: response.text?.substring(0, 100) + '...' });
      if (!isGeneratingPlan && abortControllerRef.current === null) return;
      if (response.text) {
        try {
          let cleanedText = response.text || '';
          if (cleanedText.includes('AVOCADO4') && cleanedText.includes('GUACAMOLE')) {
             addLog('thinking', 'Detected AVOCADO4/GUACAMOLE markers. Extracting JSON...');
             const customMatch = cleanedText.match(/AVOCADO4\s*([\s\S]*?)\s*GUACAMOLE/);
             if (customMatch && customMatch[1]) cleanedText = customMatch[1].trim();
          } else {
            const markdownMatch = cleanedText.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/);
            if (markdownMatch) cleanedText = markdownMatch[1];
            else {
              const firstBrace = cleanedText.indexOf('{');
              const lastBrace = cleanedText.lastIndexOf('}');
              if (firstBrace !== -1 && lastBrace !== -1 && lastBrace >= firstBrace) cleanedText = cleanedText.substring(firstBrace, lastBrace + 1);
            }
          }
          if (cleanedText.startsWith('```')) cleanedText = cleanedText.replace(/^```(?:json)?/, '').replace(/```$/, '').trim();
          const rawPlan = JSON.parse(cleanedText);
          addLog('response', 'Response Parsed Successfully', rawPlan);
          if (!rawPlan.blocks || !Array.isArray(rawPlan.blocks)) {
             if (rawPlan.type === 'file' || rawPlan.code) rawPlan.blocks = [rawPlan]; else rawPlan.blocks = [];
          }
          if (!rawPlan.imports || !Array.isArray(rawPlan.imports)) rawPlan.imports = [];
          if (rawPlan.blocks) rawPlan.blocks = assignUniqueIds(rawPlan.blocks, 'blk');
          const initialExpanded = new Set<string>();
          const newId = Date.now().toString();
          initialExpanded.add(`root-${newId}`);
          initialExpanded.add(`imports-${newId}`);
          if (rawPlan.blocks) rawPlan.blocks.forEach((b: any) => initialExpanded.add(b.id));
          const newPlan: AIPlan = { ...rawPlan, id: newId, name: aiPrompt.trim().substring(0, 24) + (aiPrompt.length > 24 ? '...' : ''), prompt: aiPrompt, timestamp: Date.now(), config: { ...activeConfig }, isProject: isProjectMode, logs: activePlanId ? [] : [...logsAccumulator.current, { time: new Date().toLocaleTimeString(), stage: 'response', message: 'Plan Created' }] };
          setExpandedBlocks(initialExpanded);
          setAiPlans(prev => [...prev, newPlan]);
          setActivePlanId(newPlan.id);
          if (!activePlanId) { setDraftLogs([]); logsAccumulator.current = []; }
        } catch(e) {
          console.error("JSON Parse Error", e);
          addLog('error', 'Failed to parse JSON response', { text: response.text, error: e });
          throw new Error("Failed to parse AI response. The model did not return valid JSON or failed the AVOCADO4 protocol.");
        }
      }
    } catch (e: any) {
      if (e.message !== "Request cancelled by user") { setAiError(e.message || "An unexpected error occurred."); addLog('error', 'API Error', e.message); }
    } finally {
      setIsGeneratingPlan(false);
      abortControllerRef.current = null;
    }
  };

  const explainCode = async (id: string, code: string, question?: string) => {
    const apiKey = getApiKey();
    if (!apiKey) { setExplanations(prev => ({ ...prev, [id]: "API Key Missing. Check Settings." })); return; }
    if (explanations[id] && !question) return;
    setExplainingId(id);
    addLog('sending', `Requesting explanation for block ${id}...`);
    try {
      const ai = new GoogleGenAI({ apiKey: apiKey });
      let prompt = '';
      if (question) {
         const contextPlan = activePlan ? JSON.stringify({ imports: activePlan.imports, globalExplanation: activePlan.globalExplanation, blocks: activePlan.blocks }, null, 2) : "No full plan context available.";
         prompt = `You are a coding assistant analyzing a specific part of a larger software plan.\n\nFULL PLAN CONTEXT (JSON):\n${contextPlan}\n\nTARGET BLOCK ID: ${id}\nTARGET BLOCK CODE:\n${code}\n\nUSER QUESTION: ${question}\n\nInstructions:\n1. Analyze the Target Block in the context of the Full Plan.\n2. Answer the user's question specifically about this block, citing relationships with other blocks if necessary.\n3. Be concise.`;
      } else { prompt = `Explain this code block simply in one or two sentences:\n\n${code}`; }
      const response = await ai.models.generateContent({ model: settings.activeModel, contents: prompt });
      addLog('response', `Explanation received for block ${id}`);
      setExplanations(prev => ({ ...prev, [id]: response.text || "No explanation returned." }));
    } catch (e: any) {
      addLog('error', `Explanation failed for block ${id}`, e.message);
      setExplanations(prev => ({ ...prev, [id]: "Failed to generate explanation." }));
    } finally { setExplainingId(null); }
  };

  const handleAnnotateCode = async (id: string, code: string, language: string) => {
    const apiKey = getApiKey();
    if (!apiKey) { setAnnotatedBlocks(prev => ({ ...prev, [id]: "// API Key Missing. Please check settings." })); return; }
    if (annotatedBlocks[id]) { setAnnotatedBlocks(prev => { const n = {...prev}; delete n[id]; return n; }); return; }
    setAnnotatingId(id);
    addLog('sending', `Generating natural language translation for block ${id}...`);
    try {
        const ai = new GoogleGenAI({ apiKey });
        const prompt = `Task: Rewrite the following ${language} code into "Structured Natural Language".\nObjective: Explain what the code does by REPLACING code lines with plain English summaries, but strictly PRESERVING the original indentation and control flow structure.\n\nRules:\n1. PRESERVE exact indentation and brace style ({ }).\n2. KEEP control flow keywords (if, else, for, while, return, try, catch) to maintain the logic flow.\n3. REPLACE variable assignments, function calls, and logic expressions with concise English sentences describing the action.\n4. Do NOT output valid code. Output readable logic.\n5. Do NOT add extra comments. The English text IS the code.\n\nExample Input:\n  const data = await fetchData();\n  if (data.isValid) {\n    process(data);\n  }\n\nExample Output:\n  Fetch the data from the source\n  if (the data is valid) {\n    Process the data\n  }\n\nCode to Rewrite:\n${code}`;
        const response = await ai.models.generateContent({ model: settings.activeModel, contents: prompt });
        const result = response.text || "// No response generated.";
        const cleanResult = result.replace(/^```[a-z]*\n/i, '').replace(/\n```$/, '');
        setAnnotatedBlocks(prev => ({ ...prev, [id]: cleanResult }));
        addLog('response', `Translation generated for block ${id}`);
    } catch (e: any) {
        addLog('error', `Translation failed for block ${id}`, e.message);
        setAnnotatedBlocks(prev => ({ ...prev, [id]: `// Error generating translation: ${e.message}` }));
    } finally { setAnnotatingId(null); }
  };

  const toggleBlock = (id: string) => { const newSet = new Set(expandedBlocks); if (newSet.has(id)) newSet.delete(id); else newSet.add(id); setExpandedBlocks(newSet); };
  const toggleCodeVisibility = (id: string) => { const newSet = new Set(visibleCodeBlocks); if (newSet.has(id)) newSet.delete(id); else newSet.add(id); setVisibleCodeBlocks(newSet); };
  const updateActiveFileLanguage = (newLang: SupportedLanguage) => { setFiles(files.map(f => f.id === activeFileId ? { ...f, language: newLang } : f)); };
  const createNewFile = () => { const newId = Date.now().toString(); const newFile: EditorFile = { id: newId, name: `untitled-${files.length + 1}.js`, language: SupportedLanguage.JAVASCRIPT, content: '', history: [''], historyIndex: 0 }; setFiles([...files, newFile]); setActiveFileId(newId); setActiveMenu(null); };
  const closeFile = (e: React.MouseEvent, id: string) => { e.stopPropagation(); if (files.length === 1) { setDialogState({ isOpen: true, type: 'confirm', title: 'Close File', message: "This is the last file. Closing it will clear its content. Continue?", onConfirm: () => { setFiles([{ ...files[0], content: '', name: 'new file', history: [''], historyIndex: 0 }]); } }); return; } const newFiles = files.filter(f => f.id !== id); setFiles(newFiles); if (id === activeFileId) setActiveFileId(newFiles[newFiles.length - 1].id); };
  const handleDownload = () => { const blob = new Blob([activeFile.content], { type: 'text/plain' }); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = activeFile.name; document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url); setActiveMenu(null); };
  const insertCode = (code: string) => { const newContent = activeFile.content + '\n' + code; updateActiveFileContent(newContent); };
  const loadPromptFromPlan = (plan: AIPlan) => { setAiPrompt(plan.prompt || plan.name); setDraftConfig(plan.config); setIsProjectMode(!!plan.isProject); setActivePlanId(null); };
  const downloadProjectZip = async () => { if (!activePlan || !activePlan.isProject || !activePlan.blocks) return; const zip = new JSZip(); activePlan.blocks.forEach(block => { if (block.code && block.signature) zip.file(block.signature, block.code); }); const blob = await zip.generateAsync({type:"blob"}); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = `${activePlan.name.replace(/\s+/g, '_')}_project.zip`; document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url); };
  const applyProjectToWorkspace = () => { if (!activePlan || !activePlan.isProject || !activePlan.blocks) return; const validBlocks = activePlan.blocks.filter(b => b.code && b.signature); if (validBlocks.length === 0) { setDialogState({ isOpen: true, type: 'info', title: 'No Files Found', message: "No valid files found in this project plan. The AI might have generated an empty structure.", onConfirm: () => {} }); return; } setDialogState({ isOpen: true, type: 'confirm', title: 'Apply to Workspace', message: `This will add ${validBlocks.length} generated files to your workspace. Continue?`, onConfirm: () => { const newFiles: EditorFile[] = validBlocks.map(block => { let lang = SupportedLanguage.JAVASCRIPT; const ext = block.signature.split('.').pop()?.toLowerCase(); if(ext === 'ts' || ext === 'tsx') lang = SupportedLanguage.TYPESCRIPT; if(ext === 'css') lang = SupportedLanguage.CSS; if(ext === 'html') lang = SupportedLanguage.HTML; if(ext === 'json') lang = SupportedLanguage.JSON; if(ext === 'sql') lang = SupportedLanguage.SQL; if(ext === 'py') lang = SupportedLanguage.PYTHON; if(ext === 'md') lang = SupportedLanguage.MARKDOWN; if(ext === 'java') lang = SupportedLanguage.JAVA; if(ext === 'cs') lang = SupportedLanguage.CSHARP; if(ext === 'cpp' || ext === 'c') lang = SupportedLanguage.CPP; if(ext === 'go') lang = SupportedLanguage.GO; if(ext === 'rs') lang = SupportedLanguage.RUST; if(ext === 'php') lang = SupportedLanguage.PHP; if(ext === 'rb') lang = SupportedLanguage.RUBY; if(ext === 'swift') lang = SupportedLanguage.SWIFT; if(ext === 'kt' || ext === 'kts') lang = SupportedLanguage.KOTLIN; if(ext === 'sh' || ext === 'bash') lang = SupportedLanguage.BASH; if(ext === 'yaml' || ext === 'yml') lang = SupportedLanguage.YAML; if(ext === 'xml') lang = SupportedLanguage.XML; return { id: Date.now() + Math.random().toString(), name: block.signature, content: block.code, language: lang, history: [block.code], historyIndex: 0 }; }); setFiles(prev => [...prev, ...newFiles]); if(newFiles.length > 0) setActiveFileId(newFiles[0].id); setDialogState({ isOpen: true, type: 'info', title: 'Success', message: `Added ${newFiles.length} files to workspace.`, onConfirm: () => {} }); } }); };

  const highlight = (code: string) => Prism.highlight(code, Prism.languages[activeFile.language] || Prism.languages.javascript, activeFile.language);
  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => { if (gutterRef.current) gutterRef.current.scrollTop = e.currentTarget.scrollTop; };
  const lineCount = activeFile.content.split('\n').length;
  const lineNumbers = Array.from({ length: lineCount }, (_, i) => i + 1);
  const HighlightOverlay = useMemo(() => { if (!showFind || matches.length === 0) return null; const fragments = []; let lastIndex = 0; matches.forEach((match, i) => { if (match.start > lastIndex) fragments.push(<span key={`text-${i}`} className="text-transparent">{activeFile.content.slice(lastIndex, match.start)}</span>); const isCurrent = i === currentMatchIndex; fragments.push(<span key={`match-${i}`} id={isCurrent ? 'current-match-highlight' : `match-${i}`} className={`${isCurrent ? 'bg-orange-500/80' : 'bg-yellow-500/30'} text-transparent rounded-[1px]`}>{activeFile.content.slice(match.start, match.end)}</span>); lastIndex = match.end; }); if (lastIndex < activeFile.content.length) fragments.push(<span key="text-end" className="text-transparent">{activeFile.content.slice(lastIndex)}</span>); return ( <pre className="editor-font leading-relaxed absolute top-0 left-0 m-0 pointer-events-none select-none" style={{ fontFamily: '"Fira Code", "Fira Mono", monospace', fontSize: `${fontSize}px`, whiteSpace: wordWrap ? 'pre-wrap' : 'pre', padding: '20px', minHeight: '100%', minWidth: '100%', zIndex: 0, boxSizing: 'border-box', color: 'transparent' }}>{fragments}</pre> ); }, [activeFile.content, matches, currentMatchIndex, showFind, fontSize, wordWrap]);
  
  const MenuDropdown = ({ label, id, items }: { label: string, id: string, items: { label?: string, action?: () => void, divider?: boolean, check?: boolean }[] }) => (
    <div className="relative">
      <button className={`px-3 py-1 text-sm rounded hover:bg-[var(--bg-tertiary)] ${activeMenu === id ? 'bg-[var(--bg-tertiary)] text-[var(--text-primary)]' : 'text-[var(--text-secondary)]'}`} onClick={() => setActiveMenu(activeMenu === id ? null : id)}>{label}</button>
      {activeMenu === id && (
        <div className="absolute left-0 mt-1 w-48 bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded shadow-xl z-50">
          {items.map((item, idx) => ( item.divider ? <div key={idx} className="border-t border-[var(--border-color)] my-1"></div> : <button key={idx} className="w-full text-left px-4 py-2 text-sm text-[var(--text-secondary)] hover:bg-[var(--accent-primary)] hover:text-white flex justify-between items-center" onClick={() => { if(item.action) item.action(); if (item.label && !item.label.includes('Wrap') && !item.label.includes('Size') && !item.label.includes('Line')) setActiveMenu(null); }}><span>{item.label}</span>{item.check && <span>✓</span>}</button> ))}
        </div>
      )}
    </div>
  );

  const BlockRenderer: React.FC<{ block: AICodeBlock, level?: number }> = ({ block, level = 0 }) => {
    const isExpanded = expandedBlocks.has(block.id);
    const isCodeVisible = visibleCodeBlocks.has(block.id);
    const hasChildren = block.children && block.children.length > 0;
    const isControlFlow = block.type === 'statement';
    const TypeIcon = () => {
        if (block.type === 'function') return <CodeBracketIcon className="w-3.5 h-3.5 text-[var(--accent-secondary)]" />;
        if (block.type === 'class') return <Square2StackIcon className="w-3.5 h-3.5 text-yellow-500" />;
        if (block.type === 'variable') return <DocumentTextIcon className="w-3.5 h-3.5 text-cyan-400" />;
        if (block.type === 'file') return <DocumentTextIcon className="w-3.5 h-3.5 text-pink-400" />;
        if (block.type === 'imports') return <Square2StackIcon className="w-3.5 h-3.5 text-orange-400" />;
        if (block.type === 'method') return <CodeBracketIcon className="w-3.5 h-3.5 text-purple-400" />;
        return <DocumentTextIcon className="w-3.5 h-3.5 text-gray-500" />;
    };
    const handleAskQuestion = async () => { if(!userQuestion.trim()) return; await explainCode(block.id, block.code, userQuestion); setQueryingBlockId(null); setUserQuestion(''); };

    return (
       <div className="relative">
          {level > 0 && ( <div className="absolute left-0 top-0 bottom-0 w-px bg-[var(--border-color)]" style={{ left: '-1px' }} /> )}
          <div className={`group flex items-center py-1 pr-2 hover:bg-[var(--bg-tertiary)] cursor-pointer transition-colors relative ${level === 0 ? 'border-t border-[var(--border-color)]' : ''} ${block.type === 'file' ? 'bg-[var(--bg-tertiary)]/50 font-bold mb-1 rounded' : ''}`} style={{ paddingLeft: `${Math.max(4, level * 16)}px` }}>
             <div onClick={() => toggleBlock(block.id)} className="flex items-center justify-center w-5 h-5 mr-1 hover:bg-white/10 rounded flex-none">
                {hasChildren ? ( <ChevronDownIcon className={`w-3 h-3 text-[var(--text-secondary)] transition-transform ${isExpanded ? '' : '-rotate-90'}`} /> ) : ( <div className="w-1 h-1 rounded-full bg-gray-600" /> )}
             </div>
             <div className="flex flex-col flex-1 min-w-0 justify-center" onClick={() => toggleBlock(block.id)}>
                <div className="flex items-center gap-2"> <TypeIcon /> <span className={`font-mono text-xs select-none break-all whitespace-pre-wrap ${isControlFlow ? 'text-purple-300' : 'text-[var(--text-secondary)]'} ${block.type === 'file' ? 'text-[var(--text-primary)]' : ''}`}> {block.signature} </span> </div>
                {block.comment && ( <span className="text-[10px] text-gray-500 ml-6 truncate font-mono italic opacity-70"> // {block.comment} </span> )}
             </div>
             <div className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity gap-1 ml-2 self-start mt-0.5">
                <button onClick={(e) => { e.stopPropagation(); toggleCodeVisibility(block.id); }} className={`p-1 rounded hover:bg-[var(--bg-primary)] ${isCodeVisible ? 'text-[var(--accent-primary)] bg-[var(--bg-primary)]' : 'text-[var(--text-secondary)]'}`} title="Toggle Code"> <EyeIcon className="w-3 h-3" /> </button>
                <button onClick={(e) => { e.stopPropagation(); insertCode(block.code); }} className="p-1 rounded hover:bg-[var(--bg-primary)] text-[var(--text-secondary)] hover:text-white" title="Insert Code"> <PlusIcon className="w-3 h-3" /> </button>
                <button onClick={(e) => { e.stopPropagation(); handleAnnotateCode(block.id, block.code, activeFile.language); }} className={`p-1 rounded hover:bg-[var(--bg-primary)] ${annotatedBlocks[block.id] ? 'text-teal-400 bg-[var(--bg-primary)]' : 'text-[var(--text-secondary)] hover:text-white'}`} title="Translate to Natural Language"> <LanguageIcon className="w-3 h-3" /> </button>
                <button onClick={(e) => { e.stopPropagation(); if (queryingBlockId === block.id) setQueryingBlockId(null); else { setQueryingBlockId(block.id); setUserQuestion(''); } }} className={`p-1 rounded hover:bg-[var(--bg-primary)] ${queryingBlockId === block.id ? 'text-green-400 bg-[var(--bg-primary)]' : 'text-[var(--text-secondary)] hover:text-white'}`} title="Ask Question / Explain"> <ChatBubbleLeftRightIcon className="w-3 h-3" /> </button>
             </div>
          </div>
          <div className="relative">
              {level >= 0 && ( <div className="absolute left-0 top-0 bottom-0 w-px bg-[var(--border-color)]" style={{ left: `${(level * 16) + 10}px` }} /> )}
              <div style={{ paddingLeft: `${(level * 16) + 24}px` }}>
                  {queryingBlockId === block.id && (
                    <div className="my-1 p-2 bg-[var(--bg-tertiary)] border border-[var(--border-color)] rounded flex gap-2 animate-fade-in">
                       <input type="text" autoFocus value={userQuestion} onChange={(e) => setUserQuestion(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleAskQuestion()} placeholder="Ask a question about this block..." className="flex-1 bg-[var(--bg-primary)] border border-[var(--border-color)] rounded px-2 py-1 text-xs text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-primary)]" />
                       <button onClick={handleAskQuestion} disabled={!userQuestion.trim()} className="bg-[var(--accent-primary)] hover:opacity-90 text-white p-1 rounded disabled:opacity-50"> <PaperAirplaneIcon className="w-3 h-3" /> </button>
                    </div>
                  )}
                  {explanations[block.id] && (
                     <div className="my-1 p-2 bg-blue-900/20 border-l-2 border-[var(--accent-primary)] text-xs text-[var(--text-secondary)] relative">
                        {explainingId === block.id ? ( <div className="flex items-center gap-2"> <ArrowPathIcon className="w-3 h-3 animate-spin" /> <span className="italic">Thinking...</span> </div> ) : ( <div> {explanations[block.id]} </div> )}
                        <button onClick={() => setExplanations(prev => { const n = {...prev}; delete n[block.id]; return n; })} className="absolute top-1 right-1 opacity-50 hover:opacity-100"><XMarkIcon className="w-3 h-3" /></button>
                     </div>
                  )}
                  {annotatedBlocks[block.id] && (
                    <div className="my-1 bg-[var(--bg-tertiary)]/50 border-l-2 border-teal-500 rounded p-2 relative group/annotation">
                        {annotatingId === block.id ? (
                            <div className="flex items-center gap-2 text-xs text-teal-400"> <ArrowPathIcon className="w-3 h-3 animate-spin" /> <span>Translating...</span> </div>
                        ) : (
                            <>
                                <div className="flex justify-between items-center mb-1">
                                     <span className="text-[9px] font-bold text-teal-500 uppercase">Natural Language View</span>
                                     <button onClick={() => navigator.clipboard.writeText(annotatedBlocks[block.id])} className="text-[9px] text-[var(--text-secondary)] hover:text-teal-400">Copy</button>
                                </div>
                                <pre className="font-mono text-[10px] leading-relaxed text-[var(--text-secondary)] whitespace-pre overflow-x-auto">
                                    <div dangerouslySetInnerHTML={{ __html: highlight(annotatedBlocks[block.id]) }} />
                                </pre>
                                <button onClick={() => setAnnotatedBlocks(prev => { const n = {...prev}; delete n[block.id]; return n; })} className="absolute top-1 right-1 opacity-50 hover:opacity-100 p-1"><XMarkIcon className="w-3 h-3" /></button>
                            </>
                        )}
                    </div>
                  )}
                  {isCodeVisible && (
                      <div className="my-1 bg-[var(--bg-primary)] border border-[var(--border-color)] rounded p-2 overflow-x-auto group/code relative">
                          <pre className="font-mono text-[10px] leading-relaxed text-[var(--text-secondary)] whitespace-pre">{block.code}</pre>
                          <button onClick={() => navigator.clipboard.writeText(block.code)} className="absolute top-1 right-1 opacity-0 group-hover/code:opacity-100 bg-[var(--bg-tertiary)] text-white text-[9px] px-1.5 py-0.5 rounded"> Copy </button>
                      </div>
                  )}
                  {isExpanded && hasChildren && ( <div className="flex flex-col"> {block.children!.map(child => ( <BlockRenderer key={child.id} block={child} level={level + 1} /> ))} </div> )}
              </div>
          </div>
       </div>
    );
  };

  return (
    <div className="flex flex-col h-full bg-[var(--bg-primary)] relative">
      <Dialog isOpen={dialogState.isOpen} type={dialogState.type} title={dialogState.title} message={dialogState.message} onConfirm={dialogState.onConfirm} onClose={closeDialog} />
      {showFind && (
        <div className="absolute top-14 right-2 sm:top-10 sm:right-10 z-50 bg-[var(--bg-secondary)] border border-[var(--border-color)] shadow-2xl p-2 rounded-md flex items-center space-x-2 w-[calc(100%-1rem)] sm:w-80">
          <MagnifyingGlassIcon className="w-4 h-4 text-[var(--text-secondary)]" />
          <input id="find-input" type="text" placeholder="Find" className="bg-[var(--bg-tertiary)] text-[var(--text-primary)] text-sm px-2 py-1 rounded border border-transparent focus:border-[var(--accent-primary)] focus:outline-none flex-1" value={findText} onChange={(e) => setFindText(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); if (e.shiftKey) findPrev(); else findNext(); } }} />
          <div className="text-xs text-[var(--text-secondary)] whitespace-nowrap min-w-[40px] text-center">{totalMatches > 0 ? `${currentMatchIndex + 1} of ${totalMatches}` : 'No results'}</div>
          <button onClick={findPrev} className="p-1 hover:bg-[var(--bg-tertiary)] rounded"><ChevronUpIcon className="w-4 h-4 text-[var(--text-secondary)]" /></button>
          <button onClick={findNext} className="p-1 hover:bg-[var(--bg-tertiary)] rounded"><ChevronDownIcon className="w-4 h-4 text-[var(--text-secondary)]" /></button>
          <button onClick={() => setShowFind(false)} className="p-1 hover:bg-[var(--bg-tertiary)] rounded ml-1"><XMarkIcon className="w-4 h-4 text-[var(--text-secondary)]" /></button>
        </div>
      )}
      
      <div ref={menuRef} className="flex-none bg-[var(--bg-secondary)] border-b border-[var(--border-color)] px-2 py-1 flex items-center select-none relative z-50">
        <MenuDropdown label="File" id="file" items={[{ label: 'New File', action: createNewFile }, { label: 'Download File', action: handleDownload }, { divider: true }, { label: 'Close Tab', action: () => closeFile({ stopPropagation: () => {} } as React.MouseEvent, activeFileId) }]} />
        <MenuDropdown label="Edit" id="edit" items={[ { label: 'Undo', action: undo }, { label: 'Redo', action: redo }, { divider: true }, { label: 'Find', action: () => { setShowFind(true); setTimeout(() => document.getElementById('find-input')?.focus(), 50); } }, { divider: true }, { label: 'Copy All', action: () => navigator.clipboard.writeText(activeFile.content) }, { label: 'Paste', action: async () => { try { const text = await navigator.clipboard.readText(); updateActiveFileContent(activeFile.content + text); } catch(e) {} } }, { divider: true }, { label: 'Clear Editor', action: () => { setDialogState({ isOpen: true, type: 'confirm', title: 'Clear Editor', message: "Are you sure you want to clear all content from this file?", onConfirm: () => updateActiveFileContent('') }); } } ]} />
        <MenuDropdown label="View" id="view" items={[{ label: 'Toggle Line Numbers', check: showLineNumbers, action: () => setShowLineNumbers(!showLineNumbers) }, { label: 'Toggle Word Wrap', check: wordWrap, action: () => setWordWrap(!wordWrap) }, { divider: true }, { label: 'Zoom In', action: () => setFontSize(prev => Math.min(prev + 2, 30)) }, { label: 'Zoom Out', action: () => setFontSize(prev => Math.max(prev - 2, 10)) }, { label: 'Reset Zoom', action: () => setFontSize(14) }]} />
      </div>
      
      <div className="flex-none bg-[var(--bg-secondary)] flex items-center border-b border-[var(--border-color)]">
        <div className="flex-1 flex items-center overflow-x-auto no-scrollbar pr-2">
            {files.map(file => (
            <div key={file.id} onClick={() => setActiveFileId(file.id)} className={`group flex items-center space-x-2 px-3 py-2 min-w-[120px] max-w-[200px] text-sm cursor-pointer border-r border-[var(--border-color)] select-none ${activeFile.id === file.id ? 'bg-[var(--tab-active)] text-[var(--text-primary)] border-t-2 border-t-[var(--accent-primary)]' : 'bg-[var(--tab-inactive)] text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]'}`} onDoubleClick={(e) => startRenaming(e, file)}>
                {editingFileId === file.id ? (
                <div className="flex items-center gap-1 flex-1 tab-rename-input min-w-0"> <input autoFocus type="text" value={tempFileName} onChange={(e) => setTempFileName(e.target.value)} onKeyDown={handleRenameKeyDown} onBlur={confirmRename} className="w-full bg-[var(--bg-primary)] text-[var(--text-primary)] px-1 rounded text-xs focus:outline-none border border-[var(--accent-primary)]" /> <button onMouseDown={confirmRename} className="text-green-500 hover:text-green-400 flex-none"><CheckIcon className="w-3 h-3" /></button> </div>
                ) : ( <> <span className="truncate flex-1">{file.name}</span> {activeFile.id === file.id && ( <button onClick={(e) => startRenaming(e, file)} className="p-0.5 rounded opacity-0 group-hover:opacity-100 text-[var(--text-secondary)] hover:text-[var(--accent-primary)] flex-none" title="Rename"><PencilIcon className="w-3 h-3" /></button> )} <button onClick={(e) => closeFile(e, file.id)} className={`p-0.5 rounded-md opacity-0 group-hover:opacity-100 hover:bg-[var(--bg-tertiary)] flex-none ${files.length === 1 ? 'hidden' : ''}`}><XMarkIcon className="w-3 h-3" /></button> </> )}
            </div>
            ))}
            <button onClick={createNewFile} className="p-2 text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] transition-colors flex-none" title="New File"><PlusIcon className="w-4 h-4" /></button>
        </div>

        <div className="flex-none px-2 border-l border-[var(--border-color)] bg-[var(--bg-secondary)] z-10">
            <button onClick={() => setShowAIPanel(!showAIPanel)} className={`flex items-center space-x-1 px-3 py-1 text-xs font-medium rounded transition-colors ${showAIPanel ? 'bg-[var(--accent-primary)] text-white' : 'bg-[var(--bg-tertiary)] text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)]'}`}><SparklesIcon className="w-3 h-3" /><span>Generate Code</span></button>
        </div>
      </div>

      <div className="flex-none bg-[var(--bg-secondary)] px-4 py-2 flex flex-wrap justify-between items-center gap-2 border-b border-[var(--border-color)]">
        <div className="flex items-center gap-4">
           {/* Custom Responsive Language Selector */}
           <LanguageSelector current={activeFile.language} onChange={updateActiveFileLanguage} />

          <div className="flex items-center gap-1">
             <button onClick={undo} disabled={activeFile.historyIndex <= 0} className="p-1 hover:bg-[var(--bg-tertiary)] rounded disabled:opacity-30 text-[var(--text-secondary)]"><ArrowPathIcon className="w-3 h-3 -scale-x-100" /></button>
             <button onClick={redo} disabled={activeFile.historyIndex >= activeFile.history.length - 1} className="p-1 hover:bg-[var(--bg-tertiary)] rounded disabled:opacity-30 text-[var(--text-secondary)]"><ArrowPathIcon className="w-3 h-3" /></button>
          </div>
        </div>
        <div className="flex items-center space-x-4 text-xs text-[var(--text-secondary)]"> <span>Ln {lineCount}</span><span>{fontSize}px</span><span>{activeFile.language}</span><span>UTF-8</span> </div>
      </div>
      <div className="flex-1 relative bg-[var(--editor-bg)] flex overflow-hidden">
        <div className="flex-1 flex overflow-hidden">
          {showLineNumbers && ( <div ref={gutterRef} className="flex-none w-12 bg-[var(--editor-bg)] border-r border-[var(--border-color)] text-right pr-3 pt-[20px] select-none text-gray-500 overflow-hidden editor-font leading-relaxed" style={{ fontSize: `${fontSize}px` }}> {lineNumbers.map((num) => (<div key={num} className="h-[1.625em]">{num}</div>))} </div> )}
          <div className="flex-1 overflow-auto relative" ref={editorScrollRef} onScroll={handleScroll}>
            <div className="min-h-full min-w-full relative"> {HighlightOverlay} <div className="relative z-10"> <Editor textareaId={`editor-textarea-${activeFileId}`} value={activeFile.content} onValueChange={updateActiveFileContent} highlight={highlight} padding={20} className="editor-font leading-relaxed min-h-full" style={{ fontFamily: '"Fira Code", "Fira Mono", monospace', fontSize: `${fontSize}px`, backgroundColor: 'transparent', color: 'var(--text-secondary)', minHeight: '100%', whiteSpace: wordWrap ? 'pre-wrap' : 'pre' }} textareaClassName="focus:outline-none text-[var(--text-primary)]" /> </div> </div>
          </div>
        </div>
        {showAIPanel && (
          <>
            <div className="hidden md:block w-1 bg-[var(--border-color)] hover:bg-[var(--accent-primary)] cursor-col-resize z-20 flex-none transition-colors" onMouseDown={() => setIsResizing(true)} />
            <div 
               className="bg-[var(--bg-secondary)] border-l border-[var(--border-color)] flex flex-col fixed inset-0 z-50 md:relative md:inset-auto md:z-auto" 
               style={{ width: window.innerWidth < 768 ? '100%' : panelWidth }}
            >
              <div className="p-4 border-b border-[var(--border-color)] bg-[var(--bg-tertiary)] flex justify-between items-center flex-none">
                <h2 className="text-sm font-bold text-[var(--text-primary)] flex items-center gap-2"><SparklesIcon className="w-4 h-4 text-[var(--accent-secondary)]" />Code Generator</h2>
                <div className="flex items-center gap-1"> <button onClick={() => setShowDevMode(!showDevMode)} className={`p-1 rounded transition-colors ${showDevMode ? 'text-green-400 bg-green-400/10' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'}`} title="Developer Mode (API Logs)"> <CommandLineIcon className="w-4 h-4" /> </button> <button onClick={() => setShowAIPanel(false)} className="p-1 rounded text-[var(--text-secondary)] hover:text-[var(--text-primary)]"><XMarkIcon className="w-4 h-4" /></button> </div>
              </div>
              {!showDevMode && (
                <div className="flex-none flex items-center gap-2 p-2 bg-[var(--bg-primary)] border-b border-[var(--border-color)] overflow-x-auto no-scrollbar">
                    <button onClick={() => setActivePlanId(null)} className={`flex-none px-3 py-1.5 text-xs rounded border transition-colors flex items-center gap-1 ${activePlanId === null ? 'bg-[var(--accent-primary)] text-white border-[var(--accent-primary)]' : 'bg-[var(--bg-primary)] border-[var(--border-color)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'}`}> <PlusIcon className="w-3 h-3" /> <span>New</span> </button>
                    {aiPlans.map(plan => ( <div key={plan.id} className="relative group/tab flex items-center"> <button onClick={() => setActivePlanId(plan.id)} className={`flex-none px-3 py-1.5 text-xs rounded-l border-y border-l border-r-0 transition-colors max-w-[120px] truncate ${activePlanId === plan.id ? 'bg-[var(--accent-primary)]/20 text-[var(--accent-secondary)] border-[var(--accent-primary)]/50' : 'bg-[var(--bg-primary)] border-[var(--border-color)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'}`} title={plan.name}> {plan.name} </button> <button onClick={(e) => { e.stopPropagation(); const newPlans = aiPlans.filter(p => p.id !== plan.id); setAiPlans(newPlans); if (activePlanId === plan.id) setActivePlanId(null); }} className={`flex-none px-1 py-1.5 text-xs rounded-r border transition-colors ${activePlanId === plan.id ? 'bg-[var(--accent-primary)]/20 text-[var(--accent-secondary)] border-[var(--accent-primary)]/50 hover:bg-red-500/20 hover:text-red-400' : 'bg-[var(--bg-primary)] border-[var(--border-color)] text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] hover:text-red-400'}`}> <XMarkIcon className="w-3 h-3" /> </button> </div> ))}
                </div>
              )}
              {showDevMode ? (
                <div className="flex-1 flex flex-col overflow-hidden bg-[var(--bg-primary)] font-mono text-xs relative">
                   <div className="flex-none p-3 border-b border-[var(--border-color)] flex items-center justify-between bg-[var(--bg-tertiary)]"> <div className="flex items-center gap-2 text-green-400 font-bold uppercase tracking-wider"> <CommandLineIcon className="w-4 h-4" /> <span>Dev Console</span> {activePlan && <span className="text-[9px] text-[var(--text-secondary)] bg-[var(--bg-primary)] px-1 rounded">PLAN: {activePlan?.name}</span>} </div> <div className="flex items-center gap-2"> <span className="text-[10px] text-[var(--text-secondary)]">Advanced Config</span> <button onClick={() => setShowAdvancedConfig(!showAdvancedConfig)} className={`w-8 h-4 rounded-full relative transition-colors ${showAdvancedConfig ? 'bg-green-500' : 'bg-gray-600'}`}> <div className={`absolute top-0.5 left-0.5 w-3 h-3 rounded-full bg-white transition-transform ${showAdvancedConfig ? 'translate-x-4' : ''}`} /> </button> </div> </div>
                   <div className="flex-1 overflow-y-auto bg-[var(--bg-primary)]">
                    {showAdvancedConfig && (
                     <div className="p-4 space-y-4 border-b border-[var(--border-color)]">
                        <div> <label className="block text-xs text-[var(--text-secondary)] mb-1 font-bold">System Instruction</label> <textarea value={activeConfig.systemInstruction} onChange={(e) => updateConfig({ systemInstruction: e.target.value })} className="w-full bg-[var(--bg-tertiary)] border border-[var(--border-color)] rounded p-2 text-[10px] text-[var(--text-primary)] focus:border-[var(--accent-primary)] focus:outline-none h-32" spellCheck={false} /> </div>
                        <div> 
                            <label className="block text-xs text-[var(--text-secondary)] mb-1 font-bold flex justify-between">
                                JSON Response Schema 
                                <div className="flex items-center gap-1">
                                    <input 
                                        type="checkbox" 
                                        id="useResponseSchema" 
                                        checked={activeConfig.useResponseSchema ?? false}
                                        onChange={(e) => updateConfig({ useResponseSchema: e.target.checked })}
                                        className="rounded border-gray-600 bg-gray-700 text-[var(--accent-primary)] focus:ring-[var(--accent-primary)] cursor-pointer" 
                                    />
                                    <label htmlFor="useResponseSchema" className="text-[9px] font-normal cursor-pointer select-none text-[var(--accent-secondary)]">
                                        Enforce via API Config
                                    </label>
                                </div>
                            </label> 
                            <textarea value={activeConfig.responseSchema} onChange={(e) => updateConfig({ responseSchema: e.target.value })} className={`w-full bg-[var(--bg-tertiary)] border border-[var(--border-color)] rounded p-2 text-[10px] text-[var(--text-primary)] focus:border-[var(--accent-primary)] focus:outline-none h-32 ${!activeConfig.useResponseSchema ? 'opacity-50' : ''}`} spellCheck={false} /> 
                        </div>
                        <div className="grid grid-cols-2 gap-4"> <div> <label className="block text-xs text-[var(--text-secondary)] mb-1 font-bold">Temperature: {activeConfig.temperature}</label> <input type="range" min="0" max="2" step="0.1" value={activeConfig.temperature} onChange={(e) => updateConfig({ temperature: parseFloat(e.target.value) })} className="w-full accent-[var(--accent-primary)]" /> </div> <div> <label className="block text-xs text-[var(--text-secondary)] mb-1 font-bold">Max Output Tokens</label> <select value={activeConfig.maxOutputTokens} onChange={(e) => updateConfig({ maxOutputTokens: parseInt(e.target.value) })} className="w-full bg-[var(--bg-tertiary)] border border-[var(--border-color)] rounded p-1 text-[10px] text-[var(--text-primary)] focus:border-[var(--accent-primary)] focus:outline-none"> <option value={2048}>2,048 (2k)</option> <option value={4096}>4,096 (4k)</option> <option value={8192}>8,192 (8k)</option> <option value={16384}>16,384 (16k)</option> <option value={32768}>32,768 (32k)</option> <option value={65536}>65,536 (64k)</option> <option value={131072}>131,072 (128k)</option> <option value={1048576}>1,048,576 (1M)</option> </select> </div> </div>
                        {isThinkingModel && ( 
                            <div className="bg-blue-900/10 p-2 rounded border border-blue-800/30"> 
                                <label className="block text-xs text-[var(--accent-secondary)] mb-1 font-bold flex items-center gap-1"> 
                                    <SparklesIcon className="w-3 h-3" /> Thinking Budget ({settings.activeModel}) 
                                </label> 
                                <select value={activeConfig.thinkingBudget} onChange={(e) => updateConfig({ thinkingBudget: Number(e.target.value) })} className="w-full bg-[var(--bg-tertiary)] border border-[var(--border-color)] rounded p-1 text-[10px] text-[var(--text-primary)] focus:border-[var(--accent-primary)] focus:outline-none"> 
                                    <option value={-1}>Auto (-1)</option>
                                    <option value={0}>Disabled (0)</option> 
                                    <option value={2048}>Light (2k)</option> 
                                    <option value={8192}>Standard (8k)</option> 
                                    <option value={16384}>High (16k)</option> 
                                    <option value={32768}>Extended (32k)</option> 
                                    <option value={48000}>Deep (48k)</option> 
                                    <option value={65536}>Maximum (64k)</option> 
                                </select> 
                                <div className="mt-2 flex items-center gap-2">
                                  <input 
                                    type="checkbox" 
                                    id="includeThoughts" 
                                    checked={activeConfig.includeThoughts ?? true}
                                    onChange={(e) => updateConfig({ includeThoughts: e.target.checked })}
                                    className="rounded border-gray-600 bg-gray-700 text-[var(--accent-primary)] focus:ring-[var(--accent-primary)] cursor-pointer" 
                                  />
                                  <label htmlFor="includeThoughts" className="text-[10px] text-[var(--text-secondary)] cursor-pointer select-none">
                                    Include Thoughts
                                  </label>
                                </div>
                            </div> 
                        )}
                     </div>
                    )}
                   </div>
                   <div className="h-1 bg-[var(--border-color)] hover:bg-[var(--accent-primary)] cursor-row-resize flex-none transition-colors z-10" onMouseDown={() => setIsResizingLogs(true)} />
                   <div className="flex-none flex flex-col bg-black border-t border-gray-800 transition-all" style={{ height: logsHeight }}> <div className="flex-none p-1 bg-gray-900 flex justify-between items-center px-2 cursor-row-resize" onMouseDown={() => setIsResizingLogs(true)}> <span className="text-gray-500 font-bold text-[10px] flex items-center gap-2"> <ArrowsPointingOutIcon className="w-3 h-3 rotate-45" /> Real-time API Logs {activePlanId ? '(History)' : '(Live)'} </span> <button onClick={() => { if (activePlanId) { setAiPlans(prev => prev.map(p => p.id === activePlanId ? { ...p, logs: [] } : p)); } else { setDraftLogs([]); logsAccumulator.current = []; } }} className="text-[10px] text-gray-500 hover:text-white"> Clear </button> </div> <div className="flex-1 overflow-y-auto p-2 space-y-2"> {activeLogs.map((log, idx) => ( <div key={idx} className="flex flex-col gap-0.5 border-l-2 pl-2" style={{ borderColor: log.stage === 'error' ? '#ef4444' : log.stage === 'sending' ? '#3b82f6' : log.stage === 'response' ? '#10b981' : '#6b7280' }}> <div className="flex items-center gap-2 text-[9px] text-gray-500"> <span className="uppercase">{log.stage}</span> <span>{log.time}</span> </div> <div className="text-[10px] text-gray-300 truncate">{log.message}</div> {log.data && ( <details className="mt-1 group/details"> <summary className="cursor-pointer text-[9px] text-[var(--accent-secondary)] hover:text-white select-none flex items-center gap-1 w-fit"> <ChevronDownIcon className="w-2.5 h-2.5 transition-transform group-open/details:rotate-180" /> <span>View Content</span> </summary> <div className="mt-1 p-1 bg-gray-900 rounded border border-gray-800"> <pre className="text-[9px] text-green-300 overflow-x-auto whitespace-pre-wrap font-mono"> {typeof log.data === 'string' ? log.data : JSON.stringify(log.data, null, 2)} </pre> </div> </details> )} </div> ))} <div ref={logsEndRef} /> </div> </div>
                </div>
              ) : (
                <div className="flex-1 overflow-y-auto overflow-x-auto p-4 space-y-4" ref={sidebarRef}>
                  {activePlanId === null && (
                    <div className="space-y-3 animate-fade-in">
                      <div className="text-xs font-mono text-gray-500 mb-2 flex items-center justify-between"> <span>Model: <span className="text-[var(--accent-secondary)]">{settings.activeModel}</span></span> <span className={`text-[10px] ${getApiKey() ? 'text-green-500' : 'text-red-500'} font-bold`}>{getApiKey() ? 'API Key Active' : 'API Key Missing'}</span> </div>
                      <div className="flex items-center justify-between p-2 bg-[var(--bg-tertiary)] rounded border border-[var(--border-color)]"> <div className="flex items-center gap-2"> <Square2StackIcon className={`w-4 h-4 ${isProjectMode ? 'text-[var(--accent-primary)]' : 'text-gray-500'}`} /> <span className="text-xs font-medium">Modular Project</span> </div> <label className="relative inline-flex items-center cursor-pointer"> <input type="checkbox" className="sr-only peer" checked={isProjectMode} onChange={(e) => setIsProjectMode(e.target.checked)} /> <div className="w-9 h-5 bg-gray-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[var(--accent-primary)]"></div> </label> </div>
                      <div> <label className="block text-xs text-[var(--text-secondary)] mb-1">Instruction</label> <textarea className="w-full bg-[var(--bg-primary)] border border-[var(--border-color)] rounded p-2 text-sm text-[var(--text-primary)] focus:border-[var(--accent-primary)] focus:outline-none resize-y min-h-[80px]" placeholder={isProjectMode ? "e.g. Create a Todo App with components/TodoItem.tsx, utils/api.ts..." : "e.g. Create a React hook for fetching user data..."} value={aiPrompt} onChange={(e) => setAiPrompt(e.target.value)} /> </div>
                      <div> <label className="block text-xs text-[var(--text-secondary)] mb-1">Language</label> <input type="text" className="w-full bg-[var(--bg-primary)] border border-[var(--border-color)] rounded p-2 text-sm text-[var(--text-primary)] focus:border-[var(--accent-primary)] focus:outline-none" placeholder="e.g. React, Typescript, Python" maxLength={30} value={aiLanguage} onChange={(e) => setAiLanguage(e.target.value)} /> </div>
                      {isThinkingModel && ( <div className="flex items-center justify-between p-2 bg-[var(--bg-tertiary)]/50 rounded border border-[var(--border-color)]"> <div className="flex items-center gap-2"> <input type="checkbox" id="chkHierarchy" checked={useHierarchyDepth} onChange={(e) => setUseHierarchyDepth(e.target.checked)} className="rounded border-gray-600 bg-gray-700 text-[var(--accent-primary)] focus:ring-[var(--accent-primary)] cursor-pointer" /> <label htmlFor="chkHierarchy" className="text-xs text-[var(--text-secondary)] cursor-pointer select-none"> Max Hierarchy Depth </label> </div> <select value={hierarchyDepth} onChange={(e) => setHierarchyDepth(Number(e.target.value))} disabled={!useHierarchyDepth} className={`bg-[var(--bg-primary)] border border-[var(--border-color)] rounded px-2 py-1 text-xs text-[var(--text-primary)] focus:outline-none w-16 text-center transition-opacity ${!useHierarchyDepth ? 'opacity-40' : ''}`}> {[1,2,3,4,5,6,7].map(n => <option key={n} value={n}>{n}</option>)} </select> </div> )}
                      {isThinkingModel && ( 
                        <div> 
                            <label className="block text-xs text-[var(--text-secondary)] mb-1 flex justify-between"> 
                                Thinking Intensity {showAdvancedConfig && <span className="text-orange-400 text-[10px]">(Managed in Dev Console)</span>} 
                            </label> 
                            <select value={activeConfig.thinkingBudget} onChange={(e) => updateConfig({ thinkingBudget: Number(e.target.value) })} disabled={showAdvancedConfig} className={`w-full bg-[var(--bg-primary)] border border-[var(--border-color)] rounded p-2 text-sm text-[var(--text-primary)] focus:border-[var(--accent-primary)] focus:outline-none ${showAdvancedConfig ? 'opacity-50 cursor-not-allowed' : ''}`}> 
                                <option value={-1}>Auto (-1)</option>
                                <option value={0}>Disabled (0)</option>
                                <option value={2048}>Light (2k Tokens)</option> 
                                <option value={4096}>Medium (4k Tokens)</option> 
                                <option value={8192}>High (8k Tokens)</option> 
                                <option value={16384}>Balanced (16k Tokens)</option> 
                                <option value={32768}>Extended (32k Tokens)</option> 
                                <option value={48000}>Deep (48k Tokens)</option> 
                                <option value={65536}>Maximum (64k Tokens)</option>
                            </select> 
                        </div> 
                      )}
                      {aiError && <div className="p-2 bg-red-900/30 border border-red-800 rounded text-xs text-red-300 flex items-start gap-2"><ExclamationTriangleIcon className="w-4 h-4 flex-none mt-0.5" /><span>{aiError}</span></div>}
                      {isGeneratingPlan ? ( <button onClick={cancelGeneration} className="w-full bg-red-600 hover:bg-red-700 text-white py-2 rounded text-sm font-medium transition-colors flex justify-center items-center gap-2"><StopCircleIcon className="w-4 h-4" />Cancel</button> ) : ( <button onClick={generateAIPlan} disabled={!aiPrompt} className="w-full bg-[var(--accent-primary)] hover:opacity-90 text-white py-2 rounded text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex justify-center items-center gap-2">Generate {isProjectMode ? 'Project' : 'Code'}</button> )}
                      {isGeneratingPlan && ( <div className="mt-3 p-2 bg-[var(--accent-primary)]/10 border border-[var(--accent-primary)]/30 rounded text-center"> <div className="flex items-center justify-center gap-2 text-xs text-[var(--accent-secondary)] font-medium mb-0.5"> <ArrowPathIcon className="w-3 h-3 animate-spin" /> <span>Processing Request...</span> </div> <p className="text-[10px] text-[var(--text-secondary)]"> Request received. Waiting for model response. </p> </div> )}
                    </div>
                  )}
                  {activePlanId !== null && activePlan && (
                    <div className="animate-fade-in pb-10">
                      <div className="mb-4 p-3 bg-[var(--bg-tertiary)] rounded border border-[var(--border-color)] relative group/prompt"> <div className="flex justify-between items-center mb-1"> <div className="text-[10px] text-[var(--text-secondary)] uppercase font-bold">Original Request</div> <button onClick={() => loadPromptFromPlan(activePlan)} className="text-[10px] text-[var(--accent-secondary)] hover:underline flex items-center gap-1 opacity-0 group-hover/prompt:opacity-100 transition-opacity"> <PencilIcon className="w-3 h-3" /> Edit / Reuse </button> </div> <p className="text-xs text-[var(--text-primary)] italic whitespace-pre-wrap">{activePlan.prompt || activePlan.name}</p> </div>
                      <h3 className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider mb-2 pb-1 border-b border-[var(--border-color)] flex items-center justify-between"> <span>Code Structure</span> {activePlan.isProject && <span className="text-[10px] bg-blue-900/50 text-[var(--accent-secondary)] px-1.5 py-0.5 rounded border border-blue-800">PROJECT</span>} </h3>
                      {(() => {
                         if (activePlan.isProject) {
                            return ( <div className="space-y-1"> <div className="flex gap-2 mb-3"> <button onClick={applyProjectToWorkspace} className="flex-1 bg-green-700/20 border border-green-700/50 text-green-400 hover:bg-green-700/30 py-1.5 rounded text-xs font-medium flex items-center justify-center gap-1"> <Square2StackIcon className="w-3.5 h-3.5" /> Apply to Workspace </button> <button onClick={downloadProjectZip} className="flex-1 bg-[var(--accent-primary)]/20 border border-[var(--accent-primary)]/50 text-[var(--accent-secondary)] hover:bg-[var(--accent-primary)]/30 py-1.5 rounded text-xs font-medium flex items-center justify-center gap-1"> <ArrowPathIcon className="w-3.5 h-3.5 rotate-180" /> Download ZIP </button> </div> {activePlan.blocks.map(block => ( <BlockRenderer key={block.id} block={block} /> ))} </div> );
                         }
                         const cleanImports = getCleanImports(activePlan.imports);
                         const fullImportCode = cleanImports.join('\n');
                         const importsBlock: AICodeBlock = { id: `imports-${activePlan.id}`, type: 'imports', signature: '📦 Imports', code: fullImportCode, comment: 'External libraries and dependencies', children: [] };
                         const rootBlock: AICodeBlock = { id: `root-${activePlan.id}`, type: 'file', signature: `📄 ${activePlan.name || 'Full Source Code'}`, code: `${fullImportCode}\n\n${(activePlan.blocks || []).map(b => b.code).join('\n\n')}`, comment: 'Complete file structure', children: [ ...(cleanImports.length > 0 ? [importsBlock] : []), ...(activePlan.blocks || []) ] };
                         return ( <div className="space-y-1"> <BlockRenderer block={rootBlock} /> {(!activePlan.blocks || activePlan.blocks.length === 0) && cleanImports.length === 0 && ( <div className="p-4 text-xs text-[var(--text-secondary)] text-center italic">No complex blocks identified.</div> )} </div> );
                      })()}
                    </div>
                  )}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};