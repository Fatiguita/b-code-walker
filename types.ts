
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

export interface AppSettings {
  theme: 'dark' | 'light' | 'midnight';
  autoDownloadEnabled: boolean;
  autoDownloadInterval: number; // seconds
  autoDownloadFileId: string | null; // ID of the specific file to download
}

// AI Assistant Types

export type VisualType = 'process' | 'database' | 'ui' | 'api' | 'logic';

export interface AICodeBlock {
  id: string;
  type: 'function' | 'class' | 'variable' | 'statement' | 'comment';
  signature: string; // The definition line, e.g., "function init()" or "if (x==0)"
  code: string; // The implementation body
  explanation?: string;
  mermaid?: string;
  visualType?: VisualType;
  children?: AICodeBlock[];
}

export interface AIPlan {
  id: string;
  name: string;
  timestamp: number;
  language: string;
  imports: string[];
  globalExplanation?: string;
  globalMermaid?: string;
  blocks: AICodeBlock[];
}
