
import React, { useState, useEffect } from 'react';
import { AppSettings, EditorFile } from '../types';
import { DocumentTextIcon, ArrowPathIcon, EyeIcon, CheckIcon } from './Icons';

interface SettingsTabProps {
  settings: AppSettings;
  setSettings: React.Dispatch<React.SetStateAction<AppSettings>>;
  files: EditorFile[];
}

export const SettingsTab: React.FC<SettingsTabProps> = ({ settings, setSettings, files }) => {
  const [apiKey, setApiKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [isSaved, setIsSaved] = useState(false);

  useEffect(() => {
    const storedKey = localStorage.getItem('b_code_walker_api_key');
    if (storedKey) {
      setApiKey(storedKey);
    }
  }, []);

  const handleSaveKey = () => {
    localStorage.setItem('b_code_walker_api_key', apiKey);
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 2000);
  };

  const themes = [
    { id: 'dark', name: 'Dark Nebula', colors: 'bg-gray-900' },
    { id: 'light', name: 'Cloud White', colors: 'bg-gray-100 border border-gray-300' },
    { id: 'midnight', name: 'Midnight Blue', colors: 'bg-blue-950' },
  ];

  return (
    <div className="flex flex-col h-full bg-[var(--bg-primary)] text-[var(--text-primary)] p-8 overflow-y-auto transition-colors duration-300">
      <div className="max-w-4xl mx-auto w-full space-y-8">
        
        {/* Header */}
        <div>
          <h2 className="text-3xl font-bold mb-2">Settings</h2>
          <p className="text-[var(--text-secondary)]">Customize your development environment.</p>
        </div>

        {/* Theme Selection */}
        <div className="bg-[var(--bg-secondary)] p-6 rounded-lg border border-[var(--border-color)]">
          <h3 className="text-xl font-semibold mb-4">Theme</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {themes.map((theme) => (
              <button
                key={theme.id}
                onClick={() => setSettings({ ...settings, theme: theme.id as any })}
                className={`
                  relative h-24 rounded-lg flex items-center justify-center transition-all
                  ${theme.colors}
                  ${settings.theme === theme.id ? 'ring-2 ring-blue-500 shadow-lg scale-105' : 'hover:scale-102 opacity-80 hover:opacity-100'}
                `}
              >
                <span className={`font-medium ${theme.id === 'light' ? 'text-gray-900' : 'text-white'}`}>
                  {theme.name}
                </span>
                {settings.theme === theme.id && (
                  <div className="absolute top-2 right-2 w-2 h-2 bg-blue-500 rounded-full" />
                )}
              </button>
            ))}
          </div>
        </div>

        {/* API Key Section */}
        <div className="bg-[var(--bg-secondary)] p-6 rounded-lg border border-[var(--border-color)]">
          <h3 className="text-xl font-semibold mb-4">API Configuration</h3>
          <div className="p-4 bg-[var(--bg-tertiary)] rounded border border-[var(--border-color)] space-y-3">
            <div>
              <p className="font-medium text-sm text-[var(--text-secondary)] uppercase tracking-wider mb-2">Google GenAI API Key</p>
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <input 
                    type={showKey ? "text" : "password"}
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder="Enter your Gemini API Key"
                    className="w-full bg-[var(--bg-primary)] border border-[var(--border-color)] rounded px-3 py-2 text-sm text-[var(--text-primary)] focus:outline-none focus:border-blue-500 font-mono"
                  />
                  <button 
                    onClick={() => setShowKey(!showKey)}
                    className="absolute right-2 top-2 text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                  >
                    <EyeIcon className="w-4 h-4" />
                  </button>
                </div>
                <button 
                  onClick={handleSaveKey}
                  className={`px-4 py-2 rounded text-sm font-medium transition-colors flex items-center gap-2 ${isSaved ? 'bg-green-600 text-white' : 'bg-blue-600 hover:bg-blue-700 text-white'}`}
                >
                  {isSaved ? <CheckIcon className="w-4 h-4" /> : 'Save'}
                  {isSaved ? 'Saved' : 'Update'}
                </button>
              </div>
            </div>
          </div>
          <p className="mt-2 text-xs text-[var(--text-secondary)]">
            Your API key is stored locally in your browser (localStorage). It is never transmitted to our servers.
          </p>
        </div>

        {/* Auto Download Settings */}
        <div className="bg-[var(--bg-secondary)] p-6 rounded-lg border border-[var(--border-color)]">
          <h3 className="text-xl font-semibold mb-4">Auto-Save & Download</h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <label className="flex items-center cursor-pointer">
                <div className="relative">
                  <input 
                    type="checkbox" 
                    className="sr-only" 
                    checked={settings.autoDownloadEnabled}
                    onChange={(e) => setSettings({...settings, autoDownloadEnabled: e.target.checked})}
                  />
                  <div className={`block w-14 h-8 rounded-full transition-colors ${settings.autoDownloadEnabled ? 'bg-blue-600' : 'bg-gray-600'}`}></div>
                  <div className={`dot absolute left-1 top-1 bg-white w-6 h-6 rounded-full transition-transform ${settings.autoDownloadEnabled ? 'transform translate-x-6' : ''}`}></div>
                </div>
                <div className="ml-3 text-[var(--text-primary)] font-medium">
                  Enable Auto-Download Snapshots
                </div>
              </label>
            </div>

            {settings.autoDownloadEnabled && (
               <div className="space-y-3 p-4 bg-[var(--bg-tertiary)] rounded animate-fade-in border border-[var(--border-color)]">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                       <ArrowPathIcon className="w-5 h-5 text-blue-400" />
                       <span className="text-sm">Interval (seconds):</span>
                    </div>
                    <input 
                      type="number" 
                      min="5" 
                      max="3600"
                      value={settings.autoDownloadInterval}
                      onChange={(e) => setSettings({...settings, autoDownloadInterval: Math.max(5, parseInt(e.target.value) || 30)})}
                      className="w-24 bg-[var(--bg-primary)] border border-[var(--border-color)] rounded px-2 py-1 text-center focus:outline-none focus:border-blue-500"
                    />
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <span className="text-sm ml-7">Target File:</span>
                    <select
                      value={settings.autoDownloadFileId || ''}
                      onChange={(e) => setSettings({...settings, autoDownloadFileId: e.target.value})}
                      className="w-48 bg-[var(--bg-primary)] border border-[var(--border-color)] rounded px-2 py-1 text-sm focus:outline-none focus:border-blue-500"
                    >
                      <option value="" disabled>Select a file...</option>
                      {files.map(f => (
                        <option key={f.id} value={f.id}>{f.name}</option>
                      ))}
                    </select>
                  </div>
                  <p className="text-xs text-[var(--text-secondary)] italic mt-1 ml-7">
                    * This specific file will be downloaded repeatedly.
                  </p>
               </div>
            )}
          </div>
        </div>

        {/* Open Files List */}
        <div className="bg-[var(--bg-secondary)] p-6 rounded-lg border border-[var(--border-color)]">
          <div className="flex items-center justify-between mb-4">
             <h3 className="text-xl font-semibold">Open Files</h3>
             <span className="text-xs bg-blue-900/50 text-blue-300 px-2 py-1 rounded">{files.length} Active</span>
          </div>
          
          <div className="grid gap-2">
            {files.map(file => (
              <div key={file.id} className="flex items-center justify-between p-3 bg-[var(--bg-tertiary)] rounded border border-[var(--border-color)] hover:border-blue-500/50 transition-colors">
                <div className="flex items-center gap-3">
                  <DocumentTextIcon className="w-5 h-5 text-blue-400" />
                  <div>
                    <p className="font-medium text-sm">{file.name}</p>
                    <p className="text-xs text-[var(--text-secondary)] uppercase">{file.language}</p>
                  </div>
                </div>
                <div className="text-right">
                   <p className="text-xs text-[var(--text-secondary)] font-mono">{file.content.length} chars</p>
                   <button 
                      onClick={() => {
                        const blob = new Blob([file.content], { type: 'text/plain' });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = file.name;
                        document.body.appendChild(a);
                        a.click();
                        document.body.removeChild(a);
                      }}
                      className="text-xs text-blue-400 hover:text-blue-300 hover:underline mt-1"
                   >
                     Download Now
                   </button>
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
};
