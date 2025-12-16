
import React, { useState, useEffect, useRef } from 'react';
import { EditorTab } from './components/EditorTab';
import { SettingsTab } from './components/SettingsTab';
import { VisualizerTab } from './components/VisualizerTab';
import { WorkshopTab } from './components/WorkshopTab'; // Consolidated Tab
import { AliceWidget } from './components/AliceWidget';
import { Dialog, ModalType } from './components/Modal';
import { TabId, EditorFile, SupportedLanguage, AppSettings, AIPlan, AIModelId, SessionData, ThemeStudioState, ConceptLesson, WorkflowState } from './types';
import { CodeBracketIcon, Square2StackIcon, Cog6ToothIcon, SparklesIcon, ArrowPathIcon, DocumentTextIcon, CheckIcon, XMarkIcon, WrenchScrewdriverIcon } from './components/Icons'; // Removed unused icons
import JSZip from 'jszip';

// Helper to sanitize IDs on load
const assignUniqueIds = (blocks: any[], prefix: string = ''): any[] => {
  if (!Array.isArray(blocks)) return [];
  return blocks.map((block, index) => {
    // Generate a unique ID if missing or colliding
    const uniqueId = `${prefix}-${index}-${Math.random().toString(36).substr(2, 9)}`;
    return {
      ...block,
      id: uniqueId,
      children: block.children ? assignUniqueIds(block.children, uniqueId) : []
    };
  });
};

/**
 * Main App Component
 */
const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabId>(TabId.EDITOR);
  const [showSessionModal, setShowSessionModal] = useState(false);
  
  // Cross-Tab Communication
  const [communityRequest, setCommunityRequest] = useState<{ type: 'discussion' | 'blog'; topic: string } | null>(null);

  // --- Global State Lifted from Editor ---
  // Default to empty new file
  const [files, setFiles] = useState<EditorFile[]>([
    {
      id: '1',
      name: 'new file',
      language: SupportedLanguage.JAVASCRIPT,
      content: '',
      history: [''],
      historyIndex: 0
    }
  ]);
  const [activeFileId, setActiveFileId] = useState<string>('1');
  
  // Changed from single plan to array of plans
  const [aiPlans, setAiPlans] = useState<AIPlan[]>([]);
  const [activePlanId, setActivePlanId] = useState<string | null>(null);

  // --- Concept Cache ---
  const [conceptCache, setConceptCache] = useState<Record<string, ConceptLesson>>({});

  // --- Workflow State ---
  const [workflowState, setWorkflowState] = useState<WorkflowState>({ nodes: [], edges: [], zoom: 1 });

  // --- Theme Studio Persistent State ---
  const [themeStudioState, setThemeStudioState] = useState<ThemeStudioState>({
    uploadedImage: null,
    imageAspectRatio: 16/9,
    widgetImages: {},
    cropOverrides: {},
    promptInputs: {},
    generatedColors: {},
    generatedTextures: {},
    generatedExplanations: {},
    extractionMode: 'color',
    showCropControls: null
  });

  // --- Modal State ---
  const [dialogState, setDialogState] = useState<{
    isOpen: boolean;
    type: ModalType;
    title: string;
    message?: string;
    onConfirm: (val?: string) => void;
    inputValue?: string;
    confirmText?: string;
  }>({
    isOpen: false,
    type: 'info',
    title: '',
    onConfirm: () => {}
  });

  const closeDialog = () => setDialogState(prev => ({ ...prev, isOpen: false }));

  const showAlert = (message: string) => {
    setDialogState({
      isOpen: true,
      type: 'info',
      title: 'Notification',
      message,
      onConfirm: () => {}
    });
  };

  // --- Global Settings ---
  const [settings, setSettings] = useState<AppSettings>(() => {
    try {
      const saved = localStorage.getItem('b_code_walker_settings');
      const parsed = saved ? JSON.parse(saved) : {};
      
      const defaultCustomColors = {
        bgPrimary: '#111827',
        bgSecondary: '#1f2937',
        bgTertiary: '#374151',
        textPrimary: '#f3f4f6',
        textSecondary: '#9ca3af',
        borderColor: '#374151',
        accentPrimary: '#2563eb', 
        accentSecondary: '#60a5fa', 
        textures: {}
      };

      return {
        theme: 'dark',
        activeModel: 'gemini-2.5-flash',
        autoDownloadEnabled: false,
        autoDownloadInterval: 60,
        autoDownloadFileId: null,
        autoSaveToBrowser: false, 
        autoExportSessionEnabled: false, 
        autoExportSessionInterval: 300, 
        customColors: defaultCustomColors,
        ...parsed 
      };
    } catch (e) {
      return {
        theme: 'dark',
        activeModel: 'gemini-2.5-flash',
        autoDownloadEnabled: false,
        autoDownloadInterval: 60,
        autoDownloadFileId: null,
        autoSaveToBrowser: false,
        autoExportSessionEnabled: false,
        autoExportSessionInterval: 300,
        customColors: {
            bgPrimary: '#111827',
            bgSecondary: '#1f2937',
            bgTertiary: '#374151',
            textPrimary: '#f3f4f6',
            textSecondary: '#9ca3af',
            borderColor: '#374151',
            accentPrimary: '#2563eb',
            accentSecondary: '#60a5fa',
            textures: {}
        }
      };
    }
  });

  // Persist settings to localStorage
  useEffect(() => {
    localStorage.setItem('b_code_walker_settings', JSON.stringify(settings));
  }, [settings]);

  // --- Auto-Save FILE Effect ---
  useEffect(() => {
    if (!settings.autoDownloadEnabled || settings.autoDownloadInterval < 5 || !settings.autoDownloadFileId) return;
    const intervalId = setInterval(() => {
      const targetFile = files.find(f => f.id === settings.autoDownloadFileId);
      if (targetFile) {
        const blob = new Blob([targetFile.content], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = targetFile.name;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }
    }, settings.autoDownloadInterval * 1000);
    return () => clearInterval(intervalId);
  }, [settings.autoDownloadEnabled, settings.autoDownloadInterval, settings.autoDownloadFileId, files]);

  // --- Auto-Save SESSION to Browser Effect ---
  useEffect(() => {
    if (!settings.autoSaveToBrowser) return;

    const saveTimeout = setTimeout(() => {
        // Strip heavy images for auto-save to allow basic recovery without hitting quota
        const strippedStudioState: ThemeStudioState = {
            ...themeStudioState,
            uploadedImage: null, 
            widgetImages: {}     
        };
        
        const autoSaveData: SessionData = {
            version: 2,
            name: 'Auto-Save',
            timestamp: Date.now(),
            files: files.map(f => ({ ...f, history: [f.content], historyIndex: 0 })), 
            aiPlans,
            settings,
            themeStudioState: strippedStudioState,
            conceptCache,
            workflowState 
        };
        
        try {
            localStorage.setItem('bcw_autosave', JSON.stringify(autoSaveData));
            localStorage.setItem('bcw_autosave_ts', Date.now().toString());
        } catch (e) {
            console.warn("Auto-save failed (Storage Full)", e);
        }
    }, 5000); 

    return () => clearTimeout(saveTimeout);
  }, [files, aiPlans, settings, themeStudioState, conceptCache, workflowState, settings.autoSaveToBrowser]);

  // --- Auto-Export SESSION ZIP Effect ---
  useEffect(() => {
    if (!settings.autoExportSessionEnabled || settings.autoExportSessionInterval < 60) return;
    
    const intervalId = setInterval(() => {
        exportSessionZip(`autosave-${new Date().toISOString().slice(0,19).replace(/:/g, '-')}`);
    }, settings.autoExportSessionInterval * 1000);

    return () => clearInterval(intervalId);
  }, [settings.autoExportSessionEnabled, settings.autoExportSessionInterval, files, aiPlans, settings, themeStudioState, conceptCache, workflowState]);

  // --- Theme Style Injection ---
  const getThemeStyles = () => {
    if (settings.theme === 'custom') {
        const c = settings.customColors;
        const t = c.textures || {};
        return `
          --bg-primary: ${c.bgPrimary};
          --bg-primary-tex: ${t.bgPrimary ? `url(${t.bgPrimary})` : 'none'};
          --bg-secondary: ${c.bgSecondary};
          --bg-secondary-tex: ${t.bgSecondary ? `url(${t.bgSecondary})` : 'none'};
          --bg-tertiary: ${c.bgTertiary};
          --bg-tertiary-tex: ${t.bgTertiary ? `url(${t.bgTertiary})` : 'none'};
          --text-primary: ${c.textPrimary};
          --text-secondary: ${c.textSecondary};
          --border-color: ${c.borderColor};
          --editor-bg: ${c.bgPrimary};
          --tab-active: ${c.bgPrimary};
          --tab-inactive: ${c.bgSecondary};
          --accent-primary: ${c.accentPrimary};
          --accent-primary-tex: ${t.accentPrimary ? `url(${t.accentPrimary})` : 'none'};
          --accent-secondary: ${c.accentSecondary};
        `;
    }

    const presets: Record<string, any> = {
      light: { '--bg-primary': '#ffffff', '--bg-secondary': '#f3f4f6', '--bg-tertiary': '#e5e7eb', '--text-primary': '#111827', '--text-secondary': '#4b5563', '--border-color': '#d1d5db', '--editor-bg': '#f9fafb', '--tab-active': '#ffffff', '--tab-inactive': '#e5e7eb', '--accent-primary': '#2563eb', '--accent-secondary': '#60a5fa' },
      midnight: { '--bg-primary': '#0f172a', '--bg-secondary': '#1e293b', '--bg-tertiary': '#334155', '--text-primary': '#f8fafc', '--text-secondary': '#94a3b8', '--border-color': '#334155', '--editor-bg': '#0f172a', '--tab-active': '#0f172a', '--tab-inactive': '#1e293b', '--accent-primary': '#3b82f6', '--accent-secondary': '#93c5fd' },
      forest: { '--bg-primary': '#051a15', '--bg-secondary': '#0a2923', '--bg-tertiary': '#124037', '--text-primary': '#ecfdf5', '--text-secondary': '#6ee7b7', '--border-color': '#064e3b', '--editor-bg': '#051a15', '--tab-active': '#051a15', '--tab-inactive': '#0a2923', '--accent-primary': '#10b981', '--accent-secondary': '#34d399' },
      synthwave: { '--bg-primary': '#1a0b2e', '--bg-secondary': '#2e1065', '--bg-tertiary': '#4c1d95', '--text-primary': '#fdf4ff', '--text-secondary': '#e879f9', '--border-color': '#701a75', '--editor-bg': '#1a0b2e', '--tab-active': '#1a0b2e', '--tab-inactive': '#2e1065', '--accent-primary': '#d946ef', '--accent-secondary': '#f0abfc' },
      dark: { '--bg-primary': '#111827', '--bg-secondary': '#1f2937', '--bg-tertiary': '#374151', '--text-primary': '#f3f4f6', '--text-secondary': '#9ca3af', '--border-color': '#374151', '--editor-bg': '#111827', '--tab-active': '#111827', '--tab-inactive': '#1f2937', '--accent-primary': '#2563eb', '--accent-secondary': '#60a5fa' }
    };

    const active = presets[settings.theme] || presets['dark'];
    return Object.entries(active).map(([key, val]) => `${key}: ${val};`).join('\n');
  };

  // --- Session Management ---
  const [savedSessions, setSavedSessions] = useState<string[]>([]);

  useEffect(() => {
    if (showSessionModal) {
        const keys = Object.keys(localStorage).filter(k => k.startsWith('bcw_session_'));
        const autoSave = localStorage.getItem('bcw_autosave') ? ['Auto-Save (Browser Memory)'] : [];
        setSavedSessions([...autoSave, ...keys.map(k => k.replace('bcw_session_', ''))]);
    }
  }, [showSessionModal]);

  const handleSaveSessionRequest = () => {
    setDialogState({
        isOpen: true,
        type: 'prompt',
        title: 'Save Session',
        message: 'Enter a name for this workspace session:',
        inputValue: `session-${new Date().toISOString().slice(0,10)}`,
        onConfirm: (name) => {
            if (name) saveSession(name);
        }
    });
  };

  const saveSession = async (name: string) => {
    try {
        const optimizedFiles = files.map(f => ({ ...f, history: [f.content], historyIndex: 0 }));
        
        const strippedStudioState: ThemeStudioState = {
            ...themeStudioState,
            uploadedImage: null,
            widgetImages: {}
        };

        const sessionData: SessionData = { 
            version: 2, 
            name, 
            timestamp: Date.now(), 
            files: optimizedFiles, 
            aiPlans, 
            settings,
            themeStudioState: strippedStudioState,
            conceptCache,
            workflowState
        };
        
        const stringified = JSON.stringify(sessionData);
        
        if (stringified.length > 4500000) {
             throw new Error("Quota Exceeded");
        }
        
        localStorage.setItem(`bcw_session_${name}`, stringified);
        setSavedSessions(prev => { if (prev.includes(name)) return prev; return [...prev, name]; });
        showAlert('Session saved! (Note: Large images are not saved to browser memory to save space. Use Export ZIP for full backup.)');
    } catch (e: any) {
        if (e.name === 'QuotaExceededError' || e.message === "Quota Exceeded") showAlert('Failed to save: Browser Storage is full. Try "Export ZIP" instead.');
        else showAlert('Failed to save session due to an error.');
    }
  };

  const loadSession = (name: string) => {
    let raw;
    if (name === 'Auto-Save (Browser Memory)') {
        raw = localStorage.getItem('bcw_autosave');
    } else {
        raw = localStorage.getItem(`bcw_session_${name}`);
    }

    if (raw) {
      try {
        const data: SessionData = JSON.parse(raw);
        setFiles(data.files);
        const sanitizedPlans = (data.aiPlans || []).map(p => ({ ...p, blocks: assignUniqueIds(p.blocks || [], `restored-${p.id}`) }));
        setAiPlans(sanitizedPlans);
        setSettings(data.settings);
        if (data.themeStudioState) setThemeStudioState(data.themeStudioState);
        if (data.conceptCache) setConceptCache(data.conceptCache);
        if (data.workflowState) setWorkflowState(data.workflowState);

        setActiveFileId(data.files[0]?.id || '1');
        setShowSessionModal(false);
      } catch (e) { showAlert('Failed to load session'); }
    }
  };

  const handleDeleteSessionRequest = (name: string) => {
      if (name === 'Auto-Save (Browser Memory)') return; 
      setDialogState({
          isOpen: true,
          type: 'danger',
          title: 'Delete Session',
          message: `Delete session "${name}"?`,
          confirmText: 'Delete',
          onConfirm: () => {
              localStorage.removeItem(`bcw_session_${name}`);
              setSavedSessions(prev => prev.filter(s => s !== name));
          }
      });
  };

  const exportSessionZip = async (sessionName?: string) => {
    const nameToExport = sessionName || `session-${new Date().toISOString().slice(0,10)}`;
    const zip = new JSZip();
    const sessionData: SessionData = { 
        version: 2, 
        name: nameToExport, 
        timestamp: Date.now(), 
        files, 
        aiPlans, 
        settings,
        themeStudioState, 
        conceptCache, 
        workflowState 
    };
    zip.file("session.json", JSON.stringify(sessionData, null, 2));
    const filesFolder = zip.folder("files");
    files.forEach(f => { filesFolder?.file(f.name, f.content); });
    const blob = await zip.generateAsync({type:"blob"});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${nameToExport}.bcw.zip`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const importSessionZip = async (file: File) => {
    try {
      const zip = await JSZip.loadAsync(file);
      const metadataFile = zip.file("session.json");
      if (!metadataFile) throw new Error("Invalid session file");
      const metadataText = await metadataFile.async("string");
      const data: SessionData = JSON.parse(metadataText);
      setFiles(data.files);
      const sanitizedPlans = (data.aiPlans || []).map(p => ({ ...p, blocks: assignUniqueIds(p.blocks || [], `imported-${p.id}`) }));
      setAiPlans(sanitizedPlans);
      setSettings(data.settings);
      if (data.themeStudioState) setThemeStudioState(data.themeStudioState);
      if (data.conceptCache) setConceptCache(data.conceptCache);
      if (data.workflowState) setWorkflowState(data.workflowState);

      setActiveFileId(data.files[0]?.id || '1');
      setShowSessionModal(false);
      showAlert("Session Imported Successfully!");
    } catch (e) { console.error(e); showAlert("Failed to import session."); }
  };

  const fileInputRef = useRef<HTMLInputElement>(null);

  // --- Dynamic Style for Textures ---
  const texturedBgStyle = (variableName: string, textureVarName: string) => ({
      background: `var(${textureVarName}, none) center/cover no-repeat, var(${variableName})`,
      backgroundBlendMode: 'overlay' 
  });

  return (
    <div className="flex flex-col h-full bg-[var(--bg-primary)] text-[var(--text-primary)] font-sans transition-colors duration-300">
      <style>{`:root { ${getThemeStyles()} }`}</style>
      
      {/* Global Dialog */}
      <Dialog 
        isOpen={dialogState.isOpen}
        type={dialogState.type}
        title={dialogState.title}
        message={dialogState.message}
        onConfirm={dialogState.onConfirm}
        onClose={closeDialog}
        initialValue={dialogState.inputValue}
        confirmText={dialogState.confirmText}
      />

      {/* Floating Alice Assistant */}
      <AliceWidget settings={settings} />

      {/* Top Navigation Bar */}
      <header 
        className="flex-none border-b border-[var(--border-color)] shadow-md transition-all duration-300"
        style={texturedBgStyle('--bg-secondary', '--bg-secondary-tex')}
      >
        <div className="flex items-center justify-between px-4 h-14 bg-transparent">
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2 mr-4">
              <div 
                 className="w-8 h-8 rounded-lg flex items-center justify-center shadow-sm"
                 style={texturedBgStyle('--accent-primary', '--accent-primary-tex')}
              >
                <span className="font-bold text-white text-lg drop-shadow-md">{`<>`}</span>
              </div>
              <h1 className="font-bold text-lg tracking-tight hidden sm:block text-[var(--text-primary)] drop-shadow-sm">b-code-walker</h1>
            </div>

            {/* Tabs */}
            <nav className="flex space-x-1 h-full pt-2 overflow-x-auto no-scrollbar">
              <button
                onClick={() => setActiveTab(TabId.EDITOR)}
                className={`
                  group flex items-center space-x-2 px-4 py-2 rounded-t-lg border-t border-l border-r border-transparent transition-all backdrop-blur-sm whitespace-nowrap
                  ${activeTab === TabId.EDITOR 
                    ? 'bg-[var(--bg-primary)] border-[var(--border-color)] text-[var(--accent-secondary)] font-medium' 
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)]/50'}
                `}
                style={activeTab === TabId.EDITOR ? texturedBgStyle('--bg-primary', '--bg-primary-tex') : {}}
              >
                <CodeBracketIcon className="w-5 h-5" />
                <span className="hidden sm:inline">Editor</span>
              </button>

              <button
                onClick={() => setActiveTab(TabId.SECONDARY)}
                className={`
                  group flex items-center space-x-2 px-4 py-2 rounded-t-lg border-t border-l border-r border-transparent transition-all backdrop-blur-sm whitespace-nowrap
                  ${activeTab === TabId.SECONDARY 
                    ? 'bg-[var(--bg-primary)] border-[var(--border-color)] text-[var(--accent-secondary)] font-medium' 
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)]/50'}
                `}
                style={activeTab === TabId.SECONDARY ? texturedBgStyle('--bg-primary', '--bg-primary-tex') : {}}
              >
                <Square2StackIcon className="w-5 h-5" />
                <span className="hidden sm:inline">Visualizer</span>
                {aiPlans.length > 0 && (
                  <span className="ml-1 px-1.5 py-0.5 bg-[var(--accent-primary)] text-white text-[10px] rounded-full shadow-sm">{aiPlans.length}</span>
                )}
              </button>

              <button
                onClick={() => setActiveTab(TabId.WORKSHOP)}
                className={`
                  group flex items-center space-x-2 px-4 py-2 rounded-t-lg border-t border-l border-r border-transparent transition-all backdrop-blur-sm whitespace-nowrap
                  ${activeTab === TabId.WORKSHOP 
                    ? 'bg-[var(--bg-primary)] border-[var(--border-color)] text-orange-400 font-medium' 
                    : 'text-[var(--text-secondary)] hover:text-orange-400 hover:bg-[var(--bg-tertiary)]/50'}
                `}
                style={activeTab === TabId.WORKSHOP ? texturedBgStyle('--bg-primary', '--bg-primary-tex') : {}}
              >
                <WrenchScrewdriverIcon className="w-5 h-5" />
                <span className="hidden sm:inline">Workshop</span>
              </button>

              <button
                onClick={() => setActiveTab(TabId.SETTINGS)}
                className={`
                  group flex items-center space-x-2 px-4 py-2 rounded-t-lg border-t border-l border-r border-transparent transition-all backdrop-blur-sm whitespace-nowrap
                  ${activeTab === TabId.SETTINGS 
                    ? 'bg-[var(--bg-primary)] border-[var(--border-color)] text-[var(--accent-secondary)] font-medium' 
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)]/50'}
                `}
                style={activeTab === TabId.SETTINGS ? texturedBgStyle('--bg-primary', '--bg-primary-tex') : {}}
              >
                <Cog6ToothIcon className="w-5 h-5" />
                <span className="hidden sm:inline">Settings</span>
              </button>
            </nav>
          </div>

          {/* Right Side: Session & Model Selector */}
          <div className="flex items-center gap-3">
             <button 
                onClick={() => setShowSessionModal(true)}
                className="flex items-center gap-2 px-3 py-1 bg-[var(--bg-tertiary)]/80 hover:bg-[var(--bg-secondary)] text-[var(--text-secondary)] hover:text-[var(--accent-secondary)] rounded border border-[var(--border-color)] text-xs font-medium transition-colors backdrop-blur-sm"
             >
                <DocumentTextIcon className="w-4 h-4" />
                <span>Sessions</span>
             </button>

             <div className="flex items-center bg-[var(--bg-tertiary)]/80 rounded-md border border-[var(--border-color)] px-2 py-1 backdrop-blur-sm">
                <SparklesIcon className="w-4 h-4 text-[var(--accent-secondary)] mr-2" />
                <select 
                  value={settings.activeModel}
                  onChange={(e) => setSettings({...settings, activeModel: e.target.value as AIModelId})}
                  className="bg-transparent text-xs text-[var(--text-primary)] focus:outline-none cursor-pointer border-none font-medium min-w-[140px]"
                >
                  <option value="gemini-2.5-flash">Gemini 2.5 Flash</option>
                  <option value="gemini-2.5-pro">Gemini 2.5 Pro</option>
                  <option value="gemini-3-pro-preview">Gemini 3.0 Pro</option>
                </select>
             </div>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main 
        className="flex-1 overflow-hidden relative"
        style={texturedBgStyle('--bg-primary', '--bg-primary-tex')}
      >
        {activeTab === TabId.EDITOR && (
          <EditorTab 
            files={files} 
            setFiles={setFiles}
            activeFileId={activeFileId}
            setActiveFileId={setActiveFileId}
            settings={settings}
            aiPlans={aiPlans}
            setAiPlans={setAiPlans}
            activePlanId={activePlanId}
            setActivePlanId={setActivePlanId}
          />
        )}
        
        {activeTab === TabId.SECONDARY && (
          <VisualizerTab 
            aiPlans={aiPlans}
            setAiPlans={setAiPlans}
            activePlanId={activePlanId}
            setActivePlanId={setActivePlanId}
          />
        )}

        {activeTab === TabId.WORKSHOP && (
          <WorkshopTab
            settings={settings}
            conceptCache={conceptCache}
            setConceptCache={setConceptCache}
            initialCommunityRequest={communityRequest}
            clearCommunityRequest={() => setCommunityRequest(null)}
            workflowState={workflowState}
            setWorkflowState={setWorkflowState}
            onInternalNavigate={(to, topic, type) => {
               if(to === 'community' && topic) setCommunityRequest({ type: type || 'discussion', topic });
            }}
          />
        )}

        {activeTab === TabId.SETTINGS && (
          <SettingsTab 
            settings={settings} 
            setSettings={setSettings} 
            files={files} 
            themeStudioState={themeStudioState}
            setThemeStudioState={setThemeStudioState}
          />
        )}
      </main>

      {/* Session Management Modal */}
      {showSessionModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
           <div className="bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[80vh]">
              <div className="p-4 border-b border-[var(--border-color)] flex justify-between items-center bg-[var(--bg-tertiary)]">
                 <h3 className="font-bold text-[var(--text-primary)]">Session Manager</h3>
                 <button onClick={() => setShowSessionModal(false)} className="p-1 hover:bg-red-500/20 hover:text-red-400 rounded"><XMarkIcon className="w-5 h-5" /></button>
              </div>
              
              <div className="p-4 flex-1 overflow-y-auto space-y-4">
                 {/* Current Session Controls */}
                 <div className="p-4 rounded bg-[var(--bg-primary)] border border-[var(--border-color)]">
                    <h4 className="text-xs font-bold uppercase text-[var(--text-secondary)] mb-3">Current Workspace</h4>
                    <div className="flex gap-2">
                       <button 
                          onClick={handleSaveSessionRequest}
                          className="flex-1 bg-[var(--accent-primary)] hover:opacity-90 text-white px-3 py-2 rounded text-sm flex items-center justify-center gap-2"
                       >
                          <CheckIcon className="w-4 h-4" /> Save Local
                       </button>
                       <button 
                          onClick={() => exportSessionZip()}
                          className="flex-1 bg-[var(--bg-tertiary)] hover:bg-[var(--bg-secondary)] border border-[var(--border-color)] text-[var(--text-primary)] px-3 py-2 rounded text-sm flex items-center justify-center gap-2"
                       >
                          <Square2StackIcon className="w-4 h-4" /> Export ZIP
                       </button>
                    </div>
                 </div>

                 {/* Import */}
                 <div className="p-4 rounded bg-[var(--bg-primary)] border border-[var(--border-color)] border-dashed">
                    <input 
                      type="file" 
                      ref={fileInputRef} 
                      className="hidden" 
                      accept=".zip"
                      onChange={(e) => {
                         if(e.target.files?.[0]) importSessionZip(e.target.files[0]);
                         e.target.value = ''; // Reset
                      }}
                    />
                    <button 
                       onClick={() => fileInputRef.current?.click()}
                       className="w-full text-[var(--text-secondary)] hover:text-[var(--accent-secondary)] text-sm flex flex-col items-center gap-2 py-4"
                    >
                       <ArrowPathIcon className="w-6 h-6" />
                       <span>Click to Import Session (.zip)</span>
                    </button>
                 </div>

                 {/* Saved Sessions List */}
                 <div>
                    <h4 className="text-xs font-bold uppercase text-[var(--text-secondary)] mb-2">Saved Sessions</h4>
                    {savedSessions.length === 0 ? (
                       <p className="text-xs text-[var(--text-secondary)] italic">No locally saved sessions found.</p>
                    ) : (
                       <div className="space-y-2">
                          {savedSessions.map(name => (
                             <div key={name} className="flex items-center justify-between p-2 bg-[var(--bg-primary)] border border-[var(--border-color)] rounded">
                                <span className={`text-sm font-medium pl-2 ${name === 'Auto-Save (Browser Memory)' ? 'text-[var(--accent-secondary)] italic' : ''}`}>{name}</span>
                                <div className="flex items-center gap-1">
                                   <button 
                                      onClick={() => loadSession(name)}
                                      className="px-2 py-1 text-xs bg-green-900/30 text-green-400 border border-green-800 rounded hover:bg-green-900/50"
                                   >
                                      Load
                                   </button>
                                   <button 
                                      onClick={() => exportSessionZip(name)}
                                      className="p-1 text-[var(--accent-secondary)] hover:bg-[var(--bg-tertiary)] rounded"
                                      title="Download Zip"
                                   >
                                      <Square2StackIcon className="w-4 h-4" />
                                   </button>
                                   {name !== 'Auto-Save (Browser Memory)' && (
                                       <button 
                                          onClick={() => handleDeleteSessionRequest(name)}
                                          className="p-1 text-red-400 hover:bg-red-900/30 rounded"
                                          title="Delete"
                                       >
                                          <XMarkIcon className="w-4 h-4" />
                                       </button>
                                   )}
                                </div>
                             </div>
                          ))}
                       </div>
                    )}
                 </div>
              </div>
           </div>
        </div>
      )}
    </div>
  );
};

export default App;
