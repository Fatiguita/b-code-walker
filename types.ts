
export enum TabId {
  EDITOR = 'editor',
  SECONDARY = 'secondary', // Visualizer
  WORKSHOP = 'workshop',
  SETTINGS = 'settings'
}

export enum SupportedLanguage {
  JAVASCRIPT = 'javascript',
  TYPESCRIPT = 'typescript',
  PYTHON = 'python',
  HTML = 'html',
  CSS = 'css',
  JSON = 'json',
  MARKDOWN = 'markdown',
  SQL = 'sql',
  JAVA = 'java',
  CSHARP = 'csharp',
  CPP = 'cpp',
  GO = 'go',
  RUST = 'rust',
  PHP = 'php',
  RUBY = 'ruby',
  SWIFT = 'swift',
  KOTLIN = 'kotlin',
  BASH = 'bash',
  YAML = 'yaml',
  XML = 'xml'
}

export type AIModelId = 'gemini-2.5-flash' | 'gemini-2.5-pro' | 'gemini-3-pro-preview' | 'gemini-3-flash-preview';

export interface EditorFile {
  id: string;
  name: string;
  language: SupportedLanguage;
  content: string;
  history: string[];
  historyIndex: number;
}

export interface APILog {
  time: string;
  stage: 'sending' | 'thinking' | 'response' | 'error' | 'ack';
  message: string;
  data?: any;
}

export interface AdvancedConfig {
  systemInstruction: string;
  responseSchema: string;
  temperature: number;
  maxOutputTokens: number;
  thinkingBudget: number;
  includeThoughts: boolean;
  useResponseSchema: boolean;
}

export interface AICodeBlock {
  id: string;
  type: 'function' | 'class' | 'variable' | 'statement' | 'comment' | 'file' | 'imports' | 'method' | 'component';
  signature: string;
  code: string;
  explanation?: string;
  comment?: string;
  mermaid?: string;
  visualType?: 'process' | 'database' | 'ui' | 'api' | 'logic';
  visualSvg?: string;
  children?: AICodeBlock[];
}

export interface AIPlan {
  id: string;
  name: string;
  prompt: string;
  timestamp: number;
  blocks: AICodeBlock[];
  imports: any[];
  globalExplanation?: string;
  globalMermaid?: string;
  config: AdvancedConfig;
  logs: APILog[];
  language?: string;
  isProject?: boolean;
}

export interface CustomPalette {
  bgPrimary: string;
  bgSecondary: string;
  bgTertiary: string;
  textPrimary: string;
  textSecondary: string;
  borderColor: string;
  accentPrimary: string;
  accentSecondary: string;
  textures: Record<string, string>;
}

export interface AppSettings {
  theme: 'dark' | 'light' | 'midnight' | 'forest' | 'synthwave' | 'custom';
  activeModel: AIModelId;
  autoDownloadEnabled: boolean;
  autoDownloadInterval: number;
  autoDownloadFileId: string | null;
  autoSaveToBrowser: boolean;
  autoExportSessionEnabled: boolean;
  autoExportSessionInterval: number;
  customColors: CustomPalette;
}

export interface ThemeStudioState {
  uploadedImage: string | null;
  imageAspectRatio: number;
  widgetImages: Record<string, string>;
  cropOverrides: Record<string, { x: number; y: number; w: number; h: number }>;
  promptInputs: Record<string, string>;
  generatedColors: Partial<CustomPalette>;
  generatedTextures: Record<string, string>;
  generatedExplanations: Record<string, string>;
  extractionMode: 'color' | 'texture';
  showCropControls: string | null;
}

export interface ConceptLesson {
  topic: string;
  explanation: string;
  analogy: string;
  keyTakeaway: string;
  svg: string;
}

export type WorkflowNodeType = 'start' | 'process' | 'decision' | 'input' | 'database' | 'document' | 'note';

export interface WorkflowNode {
  id: string;
  type: WorkflowNodeType;
  x: number;
  y: number;
  label: string;
  color?: string;
  description?: string;
  width?: number;
  height?: number;
}

export interface WorkflowEdge {
  id: string;
  source: string;
  target: string;
  label?: string;
  type?: 'straight' | 'curved';
  controlPoints?: { x: number; y: number }[];
}

export interface WorkflowState {
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  zoom?: number;
}

export interface SessionData {
  version: number;
  name: string;
  timestamp: number;
  files: EditorFile[];
  aiPlans: AIPlan[];
  settings: AppSettings;
  themeStudioState?: ThemeStudioState;
  conceptCache?: Record<string, ConceptLesson>;
  workflowState?: WorkflowState;
}