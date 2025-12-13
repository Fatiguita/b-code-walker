
export enum SupportedLanguage {
  JAVASCRIPT = 'javascript',
  TYPESCRIPT = 'typescript',
  HTML = 'html',
  CSS = 'css',
  PYTHON = 'python',
  JSON = 'json',
  MARKDOWN = 'markdown',
  SQL = 'sql'
}

export interface EditorFile {
  id: string;
  name: string;
  content: string;
  language: SupportedLanguage;
  history: string[];
  historyIndex: number;
}

export interface EditorState {
  files: EditorFile[];
  activeFileId: string;
}

export enum TabId {
  EDITOR = 'editor',
  SECONDARY = 'secondary',
  SETTINGS = 'settings'
}

// Supported AI Models
export type AIModelId = 'gemini-2.5-flash' | 'gemini-2.5-pro' | 'gemini-3-pro-preview';

export interface CustomPalette {
  bgPrimary: string;
  bgSecondary: string;
  bgTertiary: string;
  textPrimary: string;
  textSecondary: string;
  borderColor: string;
  accentPrimary: string;   // Main action buttons (e.g., Blue 600)
  accentSecondary: string; // Highlights/Icons (e.g., Blue 400)
  textures?: {
    bgPrimary?: string;
    bgSecondary?: string;
    bgTertiary?: string;
    accentPrimary?: string;
  };
}

export interface AppSettings {
  theme: 'dark' | 'light' | 'midnight' | 'forest' | 'synthwave' | 'custom';
  customColors: CustomPalette;
  activeModel: AIModelId; 
  
  // File Auto-Download
  autoDownloadEnabled: boolean;
  autoDownloadInterval: number; 
  autoDownloadFileId: string | null; 
  
  // Session Automation
  autoSaveToBrowser: boolean; // Persist to LocalStorage automatically
  autoExportSessionEnabled: boolean; // Auto-download ZIP
  autoExportSessionInterval: number;
}

export interface ThemeStudioState {
  uploadedImage: string | null;
  imageAspectRatio: number;
  widgetImages: Record<string, string>;
  cropOverrides: Record<string, { x: number, y: number, w: number, h: number }>;
  promptInputs: Record<string, string>;
  generatedColors: Partial<CustomPalette>;
  generatedTextures: Record<string, string>;
  generatedExplanations: Record<string, string>;
  extractionMode: 'color' | 'texture';
  showCropControls: string | null;
}

// AI Assistant Types

export type VisualType = 'process' | 'database' | 'ui' | 'api' | 'logic';

export interface APILog {
  time: string;
  stage: 'sending' | 'ack' | 'thinking' | 'response' | 'error';
  message: string;
  data?: any;
}

export interface AdvancedConfig {
  systemInstruction: string;
  responseSchema: string;
  temperature: number;
  maxOutputTokens: number;
  thinkingBudget: number;
}

export interface AICodeBlock {
  id: string;
  type: 'function' | 'class' | 'variable' | 'statement' | 'comment' | 'file' | 'imports' | 'method';
  signature: string; 
  comment?: string; 
  code: string; 
  explanation?: string;
  mermaid?: string;
  visualType?: VisualType;
  visualSvg?: string; 
  children?: AICodeBlock[];
}

export interface AIPlan {
  id: string;
  name: string;
  prompt: string;
  timestamp: number;
  language: string;
  imports: string[];
  globalExplanation?: string;
  globalMermaid?: string;
  blocks: AICodeBlock[];
  config: AdvancedConfig; 
  logs: APILog[];         
  isProject?: boolean;    
}

export interface SessionData {
  version: number;
  name: string;
  timestamp: number;
  files: EditorFile[];
  aiPlans: AIPlan[];
  settings: AppSettings;
  themeStudioState?: ThemeStudioState; // Added for persistence
}
