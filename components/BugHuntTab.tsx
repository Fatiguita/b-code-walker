
import React, { useState } from 'react';
import Editor from 'react-simple-code-editor';
import Prism from 'prismjs';
import 'prismjs/components/prism-javascript';
import 'prismjs/components/prism-typescript';
import 'prismjs/components/prism-python';
import { AppSettings, ConceptLesson } from '../types';
import { GoogleGenAI } from "@google/genai";
import { 
  BugAntIcon, 
  PlayIcon, 
  CheckIcon, 
  XMarkIcon, 
  TrophyIcon, 
  ArrowPathIcon, 
  ChevronDownIcon,
  AcademicCapIcon,
  LightBulbIcon,
  PuzzlePieceIcon,
  BeakerIcon,
  UserGroupIcon,
  NewspaperIcon
} from './Icons';

interface BugHuntTabProps {
  settings: AppSettings;
  onNavigateToCommunity: (type: 'discussion' | 'blog', topic: string) => void;
  conceptCache: Record<string, ConceptLesson>;
  setConceptCache: React.Dispatch<React.SetStateAction<Record<string, ConceptLesson>>>;
}

type Mode = 'concepts' | 'bughunt';
type Difficulty = 'Junior' | 'Mid-Level' | 'Senior';

interface BugLevel {
  id: string;
  difficulty: Difficulty;
  description: string;
  initialCode: string;
  hint: string;
  language: string;
  topic?: string;
}

const PREDEFINED_CONCEPTS = [
  // Fundamentals
  "Big O Notation",
  "Recursion",
  "Bit Manipulation",
  "Memory Management",
  
  // Algorithms
  "Arrays & Hashing",
  "Two Pointers",
  "Sliding Window",
  "Binary Search",
  "Backtracking",
  "Dynamic Programming",
  "Greedy Algorithms",
  "Divide & Conquer",
  
  // Sorting & Searching
  "QuickSort",
  "MergeSort",
  "HeapSort",
  "Topological Sort",
  "Floyd-Warshall",

  // Data Structures
  "Linked Lists",
  "Trees (DFS/BFS)",
  "Binary Search Trees",
  "Heaps & Priority Queues",
  "Tries (Prefix Trees)",
  "Graphs (Dijkstra, A*)",
  "Stacks & Queues",
  "Hash Maps & Collisions",
  "Disjoint Set (Union-Find)",

  // System Design & Architecture
  "System Design Basics",
  "CAP Theorem",
  "Load Balancing",
  "Caching Strategies",
  "Database Sharding",
  "REST vs GraphQL",
  "Microservices vs Monolith",
  "SOLID Principles",
  "Design Patterns (Singleton, Factory)",
  "Concurrency & Threading",
  "OSI Model Basics"
];

export const BugHuntTab: React.FC<BugHuntTabProps> = ({ settings, onNavigateToCommunity, conceptCache, setConceptCache }) => {
  const [activeMode, setActiveMode] = useState<Mode>('bughunt');
  const [gameState, setGameState] = useState<'menu' | 'playing' | 'verifying' | 'result'>('menu');
  
  // Bug Hunt State
  const [difficulty, setDifficulty] = useState<Difficulty>('Junior');
  const [selectedLanguage, setSelectedLanguage] = useState<string>('javascript');
  const [selectedBugTopic, setSelectedBugTopic] = useState<string>(''); // Optional topic for bug hunt
  const [currentLevel, setCurrentLevel] = useState<BugLevel | null>(null);
  const [userCode, setUserCode] = useState('');
  const [resultMessage, setResultMessage] = useState<{success: boolean; message: string} | null>(null);
  const [score, setScore] = useState(0);

  // Concept State
  const [selectedConcept, setSelectedConcept] = useState<string | null>(null);
  const [conceptLesson, setConceptLesson] = useState<ConceptLesson | null>(null);
  const [isLoadingLesson, setIsLoadingLesson] = useState(false);

  const [error, setError] = useState<string | null>(null);

  const getApiKey = (): string | null => localStorage.getItem('b_code_walker_api_key');

  // --- CONCEPT LOGIC ---
  const loadConcept = async (topic: string) => {
    setSelectedConcept(topic);
    setError(null);

    // 1. Check Cache
    if (conceptCache[topic]) {
        setConceptLesson(conceptCache[topic]);
        return;
    }

    // 2. Fetch if not cached
    setConceptLesson(null);
    setIsLoadingLesson(true);

    const apiKey = getApiKey();
    if (!apiKey) {
      setError("Please add your API Key in Settings to generate lessons.");
      setIsLoadingLesson(false);
      return;
    }

    try {
      const ai = new GoogleGenAI({ apiKey });
      const prompt = `
        You are an expert Computer Science educator. Create a visual, mnemonic lesson for: "${topic}".
        
        Output strictly JSON format:
        {
          "topic": "${topic}",
          "explanation": "Clear, concise technical explanation (2-3 sentences).",
          "analogy": "A real-world analogy to help remember it (e.g. searching a dictionary).",
          "keyTakeaway": "One sentence summary.",
          "svg": "A VALID, ANIMATED SVG string (viewBox='0 0 200 150') that abstractly visualizes this concept. Use simple shapes (rect, circle, path). CRITICAL: Every <animate>, <animateTransform>, or <set> tag MUST have repeatCount='indefinite' so the animation loops forever. Do NOT use external images. Use 'currentColor' for strokes."
        }
      `;

      const response = await ai.models.generateContent({
        model: settings.activeModel,
        contents: prompt,
        config: { responseMimeType: 'application/json' }
      });

      const text = response.text || "{}";
      const cleanText = text.replace(/```json|```/g, '').trim();
      const lessonData = JSON.parse(cleanText);
      
      setConceptLesson(lessonData);
      setConceptCache(prev => ({ ...prev, [topic]: lessonData })); // Store in cache

    } catch (e: any) {
      setError("Failed to generate lesson. " + e.message);
    } finally {
      setIsLoadingLesson(false);
    }
  };

  // --- BUG HUNT LOGIC ---
  const startGame = async () => {
    const apiKey = getApiKey();
    if (!apiKey) {
      setError("Please add your API Key in Settings to play.");
      return;
    }

    if (!selectedLanguage.trim()) {
        setError("Please define a target language.");
        return;
    }

    setGameState('playing');
    setCurrentLevel(null);
    setUserCode('');
    setResultMessage(null);
    setError(null);

    try {
      const ai = new GoogleGenAI({ apiKey });
      const prompt = `
        You are a Senior Engineer conducting a coding interview. 
        Generate a coding challenge with a SUBTLE bug for a ${difficulty} developer.
        TARGET LANGUAGE: ${selectedLanguage}
        ${selectedBugTopic ? `TARGET TOPIC: ${selectedBugTopic}` : ''}
        
        Output strictly JSON format:
        {
          "description": "Short scenario description (e.g. 'Fix the binary search implementation')",
          "initialCode": "The buggy code string (approx 10-20 lines)",
          "hint": "A helpful hint without giving it away",
          "language": "${selectedLanguage}"
        }
        
        The bug should be logical, off-by-one, mutation, or async related. Not syntax errors.
      `;

      const response = await ai.models.generateContent({
        model: settings.activeModel,
        contents: prompt,
        config: { responseMimeType: 'application/json' }
      });

      const text = response.text || "{}";
      const cleanText = text.replace(/```json|```/g, '').trim();
      const levelData = JSON.parse(cleanText);

      const newLevel: BugLevel = {
        id: Date.now().toString(),
        difficulty,
        description: levelData.description,
        initialCode: levelData.initialCode,
        hint: levelData.hint,
        language: levelData.language || selectedLanguage,
        topic: selectedBugTopic
      };

      setCurrentLevel(newLevel);
      setUserCode(newLevel.initialCode);

    } catch (e: any) {
      setError("Failed to generate level. " + e.message);
      setGameState('menu');
    }
  };

  const verifySolution = async () => {
    if (!currentLevel) return;
    setGameState('verifying');
    const apiKey = getApiKey();
    if (!apiKey) return;

    try {
      const ai = new GoogleGenAI({ apiKey });
      const prompt = `
        Original Buggy Code:
        ${currentLevel.initialCode}

        User's Fixed Code:
        ${userCode}
        
        Language: ${currentLevel.language}

        Did the user fix the bug defined in the original code? 
        The code must be functional and bug-free.
        
        Output strictly JSON:
        {
          "success": boolean,
          "message": "Short feedback on what they did right or wrong."
        }
      `;

      const response = await ai.models.generateContent({
        model: settings.activeModel,
        contents: prompt,
        config: { responseMimeType: 'application/json' }
      });

      const text = response.text || "{}";
      const cleanText = text.replace(/```json|```/g, '').trim();
      const result = JSON.parse(cleanText);

      setResultMessage(result);
      setGameState('result');
      if (result.success) {
        setScore(prev => prev + (difficulty === 'Junior' ? 100 : difficulty === 'Mid-Level' ? 300 : 500));
      }

    } catch (e: any) {
      setError("Verification failed. " + e.message);
      setGameState('playing'); 
    }
  };

  const highlight = (code: string) => Prism.highlight(
    code, 
    Prism.languages[currentLevel?.language || 'javascript'] || Prism.languages.javascript, 
    currentLevel?.language || 'javascript'
  );

  return (
    <div className="flex flex-col h-full bg-gray-950 text-gray-200 font-sans relative overflow-hidden">
      {/* Background Effect */}
      <div className="absolute inset-0 opacity-5 pointer-events-none" 
           style={{ backgroundImage: 'radial-gradient(circle at 50% 50%, rgba(34, 197, 94, 0.1) 0%, transparent 50%)' }} 
      />

      {/* Top Toggle Bar */}
      <div className="flex-none p-4 flex justify-center items-center z-10 gap-4">
         <button 
            onClick={() => setActiveMode('concepts')}
            className={`px-6 py-2 rounded-full flex items-center gap-2 transition-all ${activeMode === 'concepts' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/30' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}
         >
            <AcademicCapIcon className="w-5 h-5" />
            <span className="font-bold">Concepts</span>
         </button>
         <button 
            onClick={() => setActiveMode('bughunt')}
            className={`px-6 py-2 rounded-full flex items-center gap-2 transition-all ${activeMode === 'bughunt' ? 'bg-green-600 text-white shadow-lg shadow-green-500/30' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}
         >
            <BugAntIcon className="w-5 h-5" />
            <span className="font-bold">Bug Hunt</span>
         </button>
      </div>

      <div className="flex-1 overflow-auto p-4 md:p-8 relative z-10 max-w-7xl mx-auto w-full">
        
        {/* ================= CONCEPTS MODE ================= */}
        {activeMode === 'concepts' && (
           <div className="flex flex-col md:flex-row gap-6 h-full min-h-[500px]">
              {/* Left: Concept List */}
              <div className="w-full md:w-1/3 bg-gray-900/50 border border-gray-700 rounded-xl p-4 overflow-y-auto">
                 <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-4 flex items-center gap-2 sticky top-0 bg-gray-900/90 p-2 z-10 backdrop-blur-sm border-b border-gray-700">
                    <LightBulbIcon className="w-4 h-4 text-yellow-500" /> Topic Library
                 </h3>
                 <div className="space-y-2">
                    {PREDEFINED_CONCEPTS.map(concept => (
                       <button 
                          key={concept}
                          onClick={() => loadConcept(concept)}
                          className={`w-full text-left px-4 py-3 rounded-lg border transition-all ${selectedConcept === concept ? 'bg-indigo-900/30 border-indigo-500 text-indigo-300' : 'bg-gray-800/50 border-transparent hover:bg-gray-800 text-gray-400'}`}
                       >
                          <div className="flex justify-between items-center">
                              <span>{concept}</span>
                              {conceptCache[concept] && <span className="w-2 h-2 rounded-full bg-indigo-500" title="Cached"></span>}
                          </div>
                       </button>
                    ))}
                 </div>
              </div>

              {/* Right: Lesson View */}
              <div className="flex-1 bg-gray-900 border border-gray-700 rounded-xl p-6 relative flex flex-col items-center justify-center text-center">
                 {isLoadingLesson ? (
                    <div className="flex flex-col items-center gap-4">
                       <ArrowPathIcon className="w-12 h-12 text-indigo-500 animate-spin" />
                       <p className="text-indigo-400 animate-pulse">Designing visual lesson...</p>
                    </div>
                 ) : conceptLesson ? (
                    <div className="w-full h-full flex flex-col text-left animate-fade-in">
                       <h2 className="text-3xl font-bold text-white mb-6 border-b border-gray-700 pb-4">{conceptLesson.topic}</h2>
                       
                       <div className="flex-1 flex flex-col gap-6">
                          {/* Visual */}
                          <div className="w-full h-64 bg-black/40 rounded-xl border border-gray-700 p-4 overflow-hidden relative group">
                             <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:20px_20px]" />
                             <div 
                                className="w-full h-full text-indigo-400 flex items-center justify-center [&>svg]:w-full [&>svg]:h-full [&>svg]:max-h-full" 
                                dangerouslySetInnerHTML={{ __html: conceptLesson.svg }} 
                             />
                          </div>

                          {/* Content */}
                          <div className="space-y-4">
                             <div className="bg-indigo-900/20 p-4 rounded-lg border-l-4 border-indigo-500">
                                <h4 className="text-sm font-bold text-indigo-400 uppercase mb-1">Concept</h4>
                                <p className="text-gray-300 leading-relaxed">{conceptLesson.explanation}</p>
                             </div>
                             
                             <div className="bg-yellow-900/10 p-4 rounded-lg border-l-4 border-yellow-600">
                                <h4 className="text-sm font-bold text-yellow-500 uppercase mb-1">Analogy</h4>
                                <p className="text-gray-300 italic">"{conceptLesson.analogy}"</p>
                             </div>

                             <div className="flex items-center gap-3 mt-4 text-sm text-gray-400">
                                <CheckIcon className="w-5 h-5 text-green-500" />
                                <span className="font-bold text-white">Takeaway:</span> {conceptLesson.keyTakeaway}
                             </div>
                          </div>

                          {/* Community Actions */}
                          <div className="mt-auto pt-6 border-t border-gray-700 flex gap-4">
                             <button 
                                onClick={() => onNavigateToCommunity('discussion', conceptLesson.topic)}
                                className="flex-1 bg-gray-800 hover:bg-gray-700 border border-gray-600 rounded-lg py-3 flex items-center justify-center gap-2 text-orange-400 transition-colors"
                             >
                                <UserGroupIcon className="w-5 h-5" />
                                Ask Community
                             </button>
                             <button 
                                onClick={() => onNavigateToCommunity('blog', conceptLesson.topic)}
                                className="flex-1 bg-gray-800 hover:bg-gray-700 border border-gray-600 rounded-lg py-3 flex items-center justify-center gap-2 text-blue-400 transition-colors"
                             >
                                <NewspaperIcon className="w-5 h-5" />
                                Read Blog
                             </button>
                          </div>
                       </div>
                    </div>
                 ) : (
                    <div className="text-gray-500 flex flex-col items-center">
                       <PuzzlePieceIcon className="w-16 h-16 mb-4 opacity-20" />
                       <p>Select a concept from the library to start learning.</p>
                    </div>
                 )}
                 {error && <div className="absolute bottom-4 left-4 right-4 bg-red-900/50 border border-red-500 text-red-200 p-3 rounded">{error}</div>}
              </div>
           </div>
        )}

        {/* ================= BUG HUNT MODE ================= */}
        {activeMode === 'bughunt' && (
          <div className="h-full">
            {/* ... Rest of Bug Hunt Mode preserved ... */}
            {gameState === 'menu' && (
              <div className="max-w-2xl mx-auto space-y-8 mt-4 text-center">
                <div className="mb-8">
                   <h1 className="text-4xl font-bold text-white mb-2">Bug Hunt Arena</h1>
                   <div className="flex items-center justify-center gap-2 text-yellow-500">
                      <TrophyIcon className="w-5 h-5" />
                      <span className="font-bold text-xl">{score} Points</span>
                   </div>
                </div>

                <div className="bg-gray-900/50 border border-gray-700 rounded-xl p-8 space-y-6">
                    {/* Settings Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-left">
                        {/* Language */}
                        <div>
                            <label className="block text-xs text-green-500 mb-1 uppercase font-bold">Target Language</label>
                            <input 
                                type="text"
                                value={selectedLanguage} 
                                onChange={(e) => setSelectedLanguage(e.target.value)}
                                placeholder="e.g. JavaScript, Python..."
                                className="block w-full px-4 py-3 bg-black/40 border border-gray-600 rounded-lg focus:border-green-500 text-white placeholder-gray-600 outline-none"
                            />
                        </div>

                        {/* Topic */}
                        <div>
                            <label className="block text-xs text-green-500 mb-1 uppercase font-bold">Topic (Optional)</label>
                            <div className="relative">
                               <select 
                                  value={selectedBugTopic}
                                  onChange={(e) => setSelectedBugTopic(e.target.value)}
                                  className="block w-full px-4 py-3 bg-black/40 border border-gray-600 rounded-lg focus:border-green-500 text-white appearance-none outline-none cursor-pointer"
                               >
                                  <option value="">Random / General</option>
                                  {PREDEFINED_CONCEPTS.map(c => <option key={c} value={c}>{c}</option>)}
                               </select>
                               <ChevronDownIcon className="w-4 h-4 absolute right-3 top-3.5 text-gray-500 pointer-events-none" />
                            </div>
                        </div>
                    </div>

                    {/* Difficulty */}
                    <div>
                        <label className="block text-xs text-green-500 mb-3 text-left uppercase font-bold">Difficulty Level</label>
                        <div className="grid grid-cols-3 gap-4">
                           {(['Junior', 'Mid-Level', 'Senior'] as Difficulty[]).map((level) => (
                             <button 
                                key={level}
                                onClick={() => { setDifficulty(level); }}
                                className={`py-3 rounded-lg border-2 transition-all font-bold text-sm ${difficulty === level ? 'border-green-500 bg-green-500/10 text-white' : 'border-gray-700 bg-gray-800/30 text-gray-500 hover:border-gray-500'}`}
                             >
                                {level}
                             </button>
                           ))}
                        </div>
                    </div>
                </div>
                
                {error && <div className="text-red-400 bg-red-900/20 p-3 rounded border border-red-800">{error}</div>}

                <button 
                  onClick={startGame}
                  className="px-12 py-4 bg-green-600 hover:bg-green-500 text-black font-bold rounded-lg shadow-[0_0_20px_rgba(34,197,94,0.4)] transition-all flex items-center gap-3 mx-auto transform hover:scale-105"
                >
                   <PlayIcon className="w-6 h-6" /> START CHALLENGE
                </button>
              </div>
            )}

            {/* LOADING STATE */}
            {gameState === 'playing' && !currentLevel && (
               <div className="flex flex-col items-center justify-center h-full">
                  <BeakerIcon className="w-16 h-16 animate-pulse text-green-500 mb-6" />
                  <p className="tracking-widest text-green-400 font-mono">SYNTHESIZING BUG...</p>
               </div>
            )}

            {/* PLAYING STATE */}
            {(gameState === 'playing' || gameState === 'verifying' || gameState === 'result') && currentLevel && (
              <div className="max-w-6xl mx-auto h-full flex flex-col gap-4">
                 {/* Mission Brief */}
                 <div className="flex-none bg-black/60 border border-green-500/30 p-4 rounded-lg flex justify-between items-start">
                    <div>
                       <h3 className="text-xs font-bold text-gray-500 uppercase mb-1">Mission Objective</h3>
                       <p className="text-lg text-white font-medium">{currentLevel.description}</p>
                       {currentLevel.topic && <span className="text-xs text-green-400 bg-green-900/20 px-2 py-0.5 rounded border border-green-900/50 mt-2 inline-block">{currentLevel.topic}</span>}
                    </div>
                    <div className="flex gap-2">
                       <button onClick={() => setGameState('menu')} className="px-3 py-1 text-xs border border-red-900/50 text-red-400 hover:bg-red-900/20 rounded">Abort</button>
                       <div className="px-3 py-1 text-xs border border-green-500/30 text-green-400 rounded bg-green-900/10 uppercase font-bold">{currentLevel.difficulty}</div>
                    </div>
                 </div>

                 {/* Editor Arena */}
                 <div className="flex-1 flex flex-col md:flex-row gap-4 min-h-0">
                    <div className="flex-1 bg-black/80 border border-green-500/30 rounded-lg overflow-hidden flex flex-col relative shadow-2xl">
                       <div className="flex-none bg-green-900/10 border-b border-green-500/20 p-2 text-xs flex justify-between text-gray-400 font-mono">
                          <span>buggy_code.{currentLevel.language === 'javascript' ? 'js' : 'txt'}</span>
                          <span className="animate-pulse text-green-500">EDITABLE</span>
                       </div>
                       <div className="flex-1 overflow-auto relative">
                          <Editor
                            value={userCode}
                            onValueChange={setUserCode}
                            highlight={highlight}
                            padding={20}
                            className="font-mono text-sm leading-relaxed"
                            textareaClassName="focus:outline-none"
                            style={{
                              fontFamily: '"Fira Code", monospace',
                              minHeight: '100%',
                              backgroundColor: 'transparent',
                              color: '#f0fdf4'
                            }}
                          />
                       </div>
                    </div>

                    {/* Side Panel */}
                    <div className="md:w-80 flex flex-col gap-4">
                       <div className="bg-black/40 border border-green-500/20 p-4 rounded-lg">
                          <h4 className="text-xs font-bold text-green-600 uppercase mb-2 flex items-center gap-2"><LightBulbIcon className="w-4 h-4"/> Hint System</h4>
                          <p className="text-sm text-gray-400 italic">"{currentLevel.hint}"</p>
                       </div>

                       {resultMessage && (
                          <div className={`p-4 rounded-lg border ${resultMessage.success ? 'bg-green-900/30 border-green-500' : 'bg-red-900/30 border-red-500'} animate-fade-in`}>
                             <div className="flex items-center gap-2 mb-2">
                                {resultMessage.success ? <CheckIcon className="w-5 h-5 text-green-400" /> : <XMarkIcon className="w-5 h-5 text-red-400" />}
                                <span className={`font-bold ${resultMessage.success ? 'text-green-400' : 'text-red-400'}`}>
                                   {resultMessage.success ? 'PATCH SUCCESSFUL' : 'PATCH FAILED'}
                                </span>
                             </div>
                             <p className="text-xs text-white/80">{resultMessage.message}</p>
                          </div>
                       )}

                       <div className="mt-auto">
                          {gameState === 'result' && resultMessage?.success ? (
                             <button onClick={startGame} className="w-full py-3 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded flex justify-center items-center gap-2">
                                NEXT LEVEL <PlayIcon className="w-4 h-4" />
                             </button>
                          ) : (
                             <button 
                               onClick={verifySolution} 
                               disabled={gameState === 'verifying'}
                               className={`w-full py-3 font-bold rounded flex justify-center items-center gap-2 transition-all ${gameState === 'verifying' ? 'bg-gray-700 cursor-not-allowed' : 'bg-green-600 hover:bg-green-500 text-black shadow-[0_0_10px_rgba(34,197,94,0.4)]'}`}
                             >
                                {gameState === 'verifying' ? <ArrowPathIcon className="w-5 h-5 animate-spin" /> : <CheckIcon className="w-5 h-5" />}
                                {gameState === 'verifying' ? 'COMPILING...' : 'DEPLOY FIX'}
                             </button>
                          )}
                       </div>
                    </div>
                 </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

