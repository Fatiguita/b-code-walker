
import React, { useState, useEffect } from 'react';
import { EditorTab } from './components/EditorTab';
import { SettingsTab } from './components/SettingsTab';
import { VisualizerTab } from './components/VisualizerTab';
import { TabId, EditorFile, SupportedLanguage, AppSettings, AIPlan } from './types';
import { CodeBracketIcon, Square2StackIcon, Cog6ToothIcon } from './components/Icons';

/**
 * Main App Component
 */
const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabId>(TabId.EDITOR);
  
  // --- Global State Lifted from Editor ---
  const [files, setFiles] = useState<EditorFile[]>([
    {
      id: '1',
      name: 'script.js',
      language: SupportedLanguage.JAVASCRIPT,
      content: `// Welcome to b-code-walker\nfunction greet(name) {\n  return \`Hello, \${name}!\`;\n}\n\nconsole.log(greet('Developer'));`,
      history: [`// Welcome to b-code-walker\nfunction greet(name) {\n  return \`Hello, \${name}!\`;\n}\n\nconsole.log(greet('Developer'));`],
      historyIndex: 0
    },
    {
      id: '2',
      name: 'styles.css',
      language: SupportedLanguage.CSS,
      content: `body {\n  background-color: #1e1e1e;\n  color: white;\n}`,
      history: [`body {\n  background-color: #1e1e1e;\n  color: white;\n}`],
      historyIndex: 0
    },
    {
      id: '3',
      name: 'index.html',
      language: SupportedLanguage.HTML,
      content: `<!DOCTYPE html>\n<html>\n<body>\n  <h1>Hello World</h1>\n</body>\n</html>`,
      history: [`<!DOCTYPE html>\n<html>\n<body>\n  <h1>Hello World</h1>\n</body>\n</html>`],
      historyIndex: 0
    }
  ]);
  const [activeFileId, setActiveFileId] = useState<string>('1');
  
  // Changed from single plan to array of plans
  const [aiPlans, setAiPlans] = useState<AIPlan[]>([]);
  const [activePlanId, setActivePlanId] = useState<string | null>(null);

  // --- Global Settings ---
  const [settings, setSettings] = useState<AppSettings>(() => {
    try {
      const saved = localStorage.getItem('b_code_walker_settings');
      return saved ? JSON.parse(saved) : {
        theme: 'dark',
        autoDownloadEnabled: false,
        autoDownloadInterval: 60,
        autoDownloadFileId: null
      };
    } catch (e) {
      return {
        theme: 'dark',
        autoDownloadEnabled: false,
        autoDownloadInterval: 60,
        autoDownloadFileId: null
      };
    }
  });

  // Persist settings to localStorage
  useEffect(() => {
    localStorage.setItem('b_code_walker_settings', JSON.stringify(settings));
  }, [settings]);

  // --- Auto-Download Effect ---
  useEffect(() => {
    if (!settings.autoDownloadEnabled || settings.autoDownloadInterval < 5 || !settings.autoDownloadFileId) return;

    const intervalId = setInterval(() => {
      // Find the specific marked file instead of activeFileId
      const targetFile = files.find(f => f.id === settings.autoDownloadFileId);
      
      if (targetFile) {
        // Trigger download
        const blob = new Blob([targetFile.content], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = targetFile.name; // This might append (1), (2) by browser default if repeated
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        console.log(`Auto-downloaded ${targetFile.name}`);
      }
    }, settings.autoDownloadInterval * 1000);

    return () => clearInterval(intervalId);
  }, [settings.autoDownloadEnabled, settings.autoDownloadInterval, settings.autoDownloadFileId, files]);

  // --- Theme Style Injection ---
  // We use CSS variables for dynamic theming without complex tailwind configurations
  const getThemeStyles = () => {
    switch (settings.theme) {
      case 'light':
        return `
          --bg-primary: #ffffff;
          --bg-secondary: #f3f4f6;
          --bg-tertiary: #e5e7eb;
          --text-primary: #111827;
          --text-secondary: #4b5563;
          --border-color: #d1d5db;
          --editor-bg: #f9fafb;
          --tab-active: #ffffff;
          --tab-inactive: #e5e7eb;
        `;
      case 'midnight':
        return `
          --bg-primary: #0f172a;
          --bg-secondary: #1e293b;
          --bg-tertiary: #334155;
          --text-primary: #f8fafc;
          --text-secondary: #94a3b8;
          --border-color: #334155;
          --editor-bg: #0f172a;
          --tab-active: #0f172a;
          --tab-inactive: #1e293b;
        `;
      case 'dark':
      default:
        return `
          --bg-primary: #111827; /* gray-900 */
          --bg-secondary: #1f2937; /* gray-800 */
          --bg-tertiary: #374151; /* gray-700 */
          --text-primary: #f3f4f6; /* gray-100 */
          --text-secondary: #9ca3af; /* gray-400 */
          --border-color: #374151;
          --editor-bg: #111827;
          --tab-active: #111827;
          --tab-inactive: #1f2937;
        `;
    }
  };

  return (
    <div className="flex flex-col h-full bg-[var(--bg-primary)] text-[var(--text-primary)] font-sans transition-colors duration-300">
      <style>{`:root { ${getThemeStyles()} }`}</style>
      
      {/* Top Navigation Bar */}
      <header className="flex-none bg-[var(--bg-secondary)] border-b border-[var(--border-color)] shadow-md transition-colors duration-300">
        <div className="flex items-center px-4 h-14 space-x-4">
          <div className="flex items-center space-x-2 mr-8">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
              <span className="font-bold text-white text-lg">{`<>`}</span>
            </div>
            <h1 className="font-bold text-lg tracking-tight hidden sm:block text-[var(--text-primary)]">b-code-walker</h1>
          </div>

          {/* Tabs */}
          <nav className="flex space-x-1 h-full pt-2">
            <button
              onClick={() => setActiveTab(TabId.EDITOR)}
              className={`
                group flex items-center space-x-2 px-4 py-2 rounded-t-lg border-t border-l border-r border-transparent transition-all
                ${activeTab === TabId.EDITOR 
                  ? 'bg-[var(--bg-primary)] border-[var(--border-color)] text-blue-400 font-medium' 
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)]'}
              `}
            >
              <CodeBracketIcon className="w-5 h-5" />
              <span>Code Editor</span>
            </button>

            <button
              onClick={() => setActiveTab(TabId.SECONDARY)}
              className={`
                group flex items-center space-x-2 px-4 py-2 rounded-t-lg border-t border-l border-r border-transparent transition-all
                ${activeTab === TabId.SECONDARY 
                  ? 'bg-[var(--bg-primary)] border-[var(--border-color)] text-blue-400 font-medium' 
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)]'}
              `}
            >
              <Square2StackIcon className="w-5 h-5" />
              <span>Visualizer</span>
              {aiPlans.length > 0 && (
                <span className="ml-1 px-1.5 py-0.5 bg-blue-600 text-white text-[10px] rounded-full">{aiPlans.length}</span>
              )}
            </button>

            <button
              onClick={() => setActiveTab(TabId.SETTINGS)}
              className={`
                group flex items-center space-x-2 px-4 py-2 rounded-t-lg border-t border-l border-r border-transparent transition-all
                ${activeTab === TabId.SETTINGS 
                  ? 'bg-[var(--bg-primary)] border-[var(--border-color)] text-blue-400 font-medium' 
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)]'}
              `}
            >
              <Cog6ToothIcon className="w-5 h-5" />
              <span>Settings</span>
            </button>
          </nav>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 overflow-hidden relative bg-[var(--bg-primary)]">
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

        {activeTab === TabId.SETTINGS && (
          <SettingsTab settings={settings} setSettings={setSettings} files={files} />
        )}
      </main>
    </div>
  );
};

export default App;
