
import React, { useState, useRef, useEffect } from 'react';
import { AppSettings, EditorFile, ThemeStudioState, CustomPalette } from '../types';
import { GoogleGenAI } from "@google/genai";
import { 
  DocumentTextIcon, 
  ArrowPathIcon, 
  CheckIcon, 
  PencilIcon, 
  SparklesIcon, 
  ArrowUpTrayIcon, 
  PhotoIcon,
  ArrowsPointingOutIcon,
  EyeIcon,
  XMarkIcon
} from './Icons';

interface SettingsTabProps {
  settings: AppSettings;
  setSettings: React.Dispatch<React.SetStateAction<AppSettings>>;
  files: EditorFile[];
  themeStudioState: ThemeStudioState;
  setThemeStudioState: React.Dispatch<React.SetStateAction<ThemeStudioState>>;
}

type ColorKey = Exclude<keyof AppSettings['customColors'], 'textures'>;

// ... [WIDGETS constant and Color Utils remain unchanged] ...
// Re-declaring for completeness of file structure
type WidgetType = 'header' | 'sidebar' | 'editor' | 'accents';
interface WidgetDef { id: WidgetType; name: string; description: string; defaultPrompt: string; cropZone: { x: number, y: number, w: number, h: number }; targetVars: ColorKey[]; textureVar?: keyof NonNullable<AppSettings['customColors']['textures']>; }
const WIDGETS: WidgetDef[] = [
  { id: 'header', name: 'Header Bar', description: 'Top navigation area style', defaultPrompt: 'A seamless horizontal header texture...', cropZone: { x: 0, y: 0, w: 1, h: 0.15 }, targetVars: ['bgSecondary', 'borderColor'], textureVar: 'bgSecondary' },
  { id: 'sidebar', name: 'Sidebar / Tabs', description: 'File explorer and tab styling', defaultPrompt: 'A vertical sidebar texture...', cropZone: { x: 0, y: 0.15, w: 0.25, h: 0.85 }, targetVars: ['bgTertiary', 'textSecondary'], textureVar: 'bgTertiary' },
  { id: 'editor', name: 'Editor Workspace', description: 'Main coding background and text', defaultPrompt: 'A deep dark coding background...', cropZone: { x: 0.25, y: 0.15, w: 0.75, h: 0.85 }, targetVars: ['bgPrimary', 'textPrimary'], textureVar: 'bgPrimary' },
  { id: 'accents', name: 'Buttons & Highlights', description: 'Primary actions and focus states', defaultPrompt: 'A glossy button texture...', cropZone: { x: 0.3, y: 0.3, w: 0.4, h: 0.4 }, targetVars: ['accentPrimary', 'accentSecondary'], textureVar: 'accentPrimary' }
];
const getLuminance = (hex: string) => { const c = hex.substring(1); const rgb = parseInt(c, 16); return 0.2126 * ((rgb >> 16) & 0xff) + 0.7152 * ((rgb >> 8) & 0xff) + 0.0722 * ((rgb >> 0) & 0xff); };
const getContrastColor = (hex: string) => (!hex || !hex.startsWith('#')) ? '#ffffff' : getLuminance(hex) > 128 ? '#111827' : '#f9fafb';
const adjustColorBrightness = (hex: string, percent: number) => { const f = parseInt(hex.slice(1), 16); const t = percent < 0 ? 0 : 255; const p = percent < 0 ? percent * -1 : percent; return "#" + (0x1000000 + (Math.round((t - (f >> 16)) * p) + (f >> 16)) * 0x10000 + (Math.round((t - (f >> 8 & 0x00FF)) * p) + (f >> 8 & 0x00FF)) * 0x100 + (Math.round((t - (f & 0x0000FF)) * p) + (f & 0x0000FF))).toString(16).slice(1); };

const DEFAULT_PALETTE: CustomPalette = {
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

export const SettingsTab: React.FC<SettingsTabProps> = ({ 
  settings, 
  setSettings, 
  files,
  themeStudioState,
  setThemeStudioState
}) => {
  // --- API Key State (BYOK) ---
  const [apiKey, setApiKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [isKeySaved, setIsKeySaved] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem('b_code_walker_api_key');
    if (stored) setApiKey(stored);
  }, []);

  const handleSaveKey = () => {
    localStorage.setItem('b_code_walker_api_key', apiKey);
    setIsKeySaved(true);
    setTimeout(() => setIsKeySaved(false), 2000);
  };

  // --- Theme Studio State ---
  const { uploadedImage, imageAspectRatio, widgetImages, cropOverrides, promptInputs, generatedColors, generatedTextures, generatedExplanations, extractionMode, showCropControls } = themeStudioState;
  const [isProcessing, setIsProcessing] = useState<string | null>(null); 
  const [lastError, setLastError] = useState<string | null>(null);
  const [dragState, setDragState] = useState<{ isDragging: boolean; isResizing: boolean; startX: number; startY: number; startRect: { x: number, y: number, w: number, h: number }; }>({ isDragging: false, isResizing: false, startX: 0, startY: 0, startRect: {x:0,y:0,w:0,h:0} });

  const fileInputRef = useRef<HTMLInputElement>(null);
  const widgetFileInputRef = useRef<HTMLInputElement>(null); 
  const activeWidgetIdRef = useRef<string | null>(null); 
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imageContainerRef = useRef<HTMLDivElement>(null);

  const updateState = (updates: Partial<ThemeStudioState>) => { setThemeStudioState(prev => ({ ...prev, ...updates })); };
  
  // ... [Handlers for Theme Studio] ...
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => { const file = e.target.files?.[0]; if (file) { const reader = new FileReader(); reader.onload = (event) => { const result = event.target?.result as string; const img = new Image(); img.onload = () => { updateState({ uploadedImage: result, generatedTextures: {}, imageAspectRatio: img.width / img.height }); }; img.src = result; }; reader.readAsDataURL(file); } };
  const handleWidgetImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => { const file = e.target.files?.[0]; const targetId = activeWidgetIdRef.current; if (file && targetId) { const reader = new FileReader(); reader.onload = (event) => { const newWidgetImages = { ...widgetImages, [targetId]: event.target?.result as string }; const newGeneratedTextures = { ...generatedTextures }; delete newGeneratedTextures[targetId]; updateState({ widgetImages: newWidgetImages, generatedTextures: newGeneratedTextures }); }; reader.readAsDataURL(file); } if(widgetFileInputRef.current) widgetFileInputRef.current.value = ''; };
  const triggerWidgetUpload = (widgetId: string) => { activeWidgetIdRef.current = widgetId; widgetFileInputRef.current?.click(); };
  const getClientCoordinates = (e: React.MouseEvent | React.TouchEvent) => { if ('touches' in e) return { clientX: e.touches[0].clientX, clientY: e.touches[0].clientY }; return { clientX: (e as React.MouseEvent).clientX, clientY: (e as React.MouseEvent).clientY }; };
  const handleCropMouseDown = (e: React.MouseEvent | React.TouchEvent, action: 'move' | 'resize', widgetId: string) => { e.preventDefault(); e.stopPropagation(); const currentRect = cropOverrides[widgetId] || WIDGETS.find(w => w.id === widgetId)?.cropZone || {x:0, y:0, w:0.5, h:0.5}; const { clientX, clientY } = getClientCoordinates(e); setDragState({ isDragging: action === 'move', isResizing: action === 'resize', startX: clientX, startY: clientY, startRect: { ...currentRect } }); };
  
  useEffect(() => {
      const handleMouseMove = (e: MouseEvent | TouchEvent) => {
          if ((!dragState.isDragging && !dragState.isResizing) || !showCropControls || !imageContainerRef.current) return;
          const widgetId = showCropControls; const container = imageContainerRef.current.getBoundingClientRect(); let clientX, clientY; if ('touches' in e) { clientX = e.touches[0].clientX; clientY = e.touches[0].clientY; } else { clientX = (e as MouseEvent).clientX; clientY = (e as MouseEvent).clientY; }
          const deltaX = (clientX - dragState.startX) / container.width; const deltaY = (clientY - dragState.startY) / container.height; const newRect = { ...dragState.startRect };
          if (dragState.isDragging) { newRect.x = Math.max(0, Math.min(1 - newRect.w, dragState.startRect.x + deltaX)); newRect.y = Math.max(0, Math.min(1 - newRect.h, dragState.startRect.y + deltaY)); } else if (dragState.isResizing) { const widget = WIDGETS.find(w => w.id === widgetId); const targetRatio = widget ? (widget.cropZone.w / widget.cropZone.h) : 1; const containerRatio = container.width / container.height; let newW = Math.max(0.05, Math.min(1 - newRect.x, dragState.startRect.w + deltaX)); let newH = newW * containerRatio / targetRatio; if (newRect.y + newH > 1) { newH = 1 - newRect.y; newW = newH * targetRatio / containerRatio; } newRect.w = newW; newRect.h = newH; }
          updateState({ cropOverrides: { ...cropOverrides, [widgetId]: newRect } });
      };
      const handleMouseUp = () => { setDragState(prev => ({ ...prev, isDragging: false, isResizing: false })); };
      if (dragState.isDragging || dragState.isResizing) { window.addEventListener('mousemove', handleMouseMove); window.addEventListener('mouseup', handleMouseUp); window.addEventListener('touchmove', handleMouseMove); window.addEventListener('touchend', handleMouseUp); } return () => { window.removeEventListener('mousemove', handleMouseMove); window.removeEventListener('mouseup', handleMouseUp); window.removeEventListener('touchmove', handleMouseMove); window.removeEventListener('touchend', handleMouseUp); };
  }, [dragState, showCropControls, cropOverrides]);

  const getProcessedWidgetImage = async (widget: WidgetDef, maxDim = 512): Promise<string> => { return new Promise((resolve, reject) => { if (widgetImages[widget.id]) { const img = new Image(); img.onload = () => { const canvas = canvasRef.current!; const ctx = canvas.getContext('2d')!; const scale = Math.min(maxDim / img.width, maxDim / img.height, 1); canvas.width = img.width * scale; canvas.height = img.height * scale; ctx.drawImage(img, 0, 0, canvas.width, canvas.height); resolve(canvas.toDataURL('image/jpeg', 0.8)); }; img.src = widgetImages[widget.id]; return; } if (!uploadedImage || !canvasRef.current) return reject('No image source'); const img = new Image(); img.onload = () => { const canvas = canvasRef.current!; const ctx = canvas.getContext('2d')!; const rect = cropOverrides[widget.id] || widget.cropZone; const sx = Math.floor(rect.x * img.width); const sy = Math.floor(rect.y * img.height); const sWidth = Math.floor(rect.w * img.width); const sHeight = Math.floor(rect.h * img.height); const scale = Math.min(maxDim / sWidth, maxDim / sHeight, 1); canvas.width = sWidth * scale; canvas.height = sHeight * scale; ctx.drawImage(img, sx, sy, sWidth, sHeight, 0, 0, canvas.width, canvas.height); resolve(canvas.toDataURL('image/jpeg', 0.8)); }; img.src = uploadedImage; }); };
  const extractLocalColors = (canvas: HTMLCanvasElement, count: number): string[] => { const ctx = canvas.getContext('2d'); if (!ctx) return []; const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height).data; const colorCounts: Record<string, number> = {}; const quantization = 24; for (let i = 0; i < imageData.length; i += 4 * 10) { const r = Math.round(imageData[i] / quantization) * quantization; const g = Math.round(imageData[i + 1] / quantization) * quantization; const b = Math.round(imageData[i + 2] / quantization) * quantization; const hex = "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1); colorCounts[hex] = (colorCounts[hex] || 0) + 1; } return Object.entries(colorCounts).sort((a, b) => b[1] - a[1]).slice(0, Math.max(count, 5)).map(entry => entry[0]); };
  const generateWidgetTheme = async (widget: WidgetDef, forceLocal = false) => { if (extractionMode === 'texture') return; setIsProcessing(widget.id); setLastError(null); try { const base64Image = await getProcessedWidgetImage(widget); let colors: Partial<CustomPalette> = {}; if (!forceLocal) { try { const rawBase64 = base64Image.split(',')[1]; const ai = new GoogleGenAI({ apiKey: apiKey }); const existingContext = JSON.stringify(generatedColors); const prompt = `Analyze this UI image slice (Context: ${widget.name}). Extract aesthetic colors for CSS variables. CONTEXT: ${existingContext}. Required Keys: ${widget.targetVars.map(v => `- ${v}`).join('\n')}. Return STRICTLY a JSON object.`; const response = await ai.models.generateContent({ model: 'gemini-2.5-flash-image', contents: { parts: [{ inlineData: { mimeType: 'image/jpeg', data: rawBase64 } }, { text: prompt }] } }); let jsonText = response.text?.replace(/```json|```/g, '').trim(); const firstBrace = jsonText?.indexOf('{') ?? -1; const lastBrace = jsonText?.lastIndexOf('}') ?? -1; if (firstBrace !== -1 && lastBrace !== -1) { jsonText = jsonText?.substring(firstBrace, lastBrace + 1); colors = JSON.parse(jsonText || '{}'); } else { throw new Error("Invalid AI JSON"); } } catch (aiError) { setLastError("AI unavailable. Using smart local analysis."); } } if (Object.keys(colors).length === 0) { if (canvasRef.current) { const localSwatches = extractLocalColors(canvasRef.current, 5); if (localSwatches.length > 0) { const dominant = localSwatches[0]; const existingBgPrimary = generatedColors.bgPrimary || settings.customColors.bgPrimary; widget.targetVars.forEach((key) => { if (key.startsWith('bg')) { if (key !== 'bgPrimary' && dominant === existingBgPrimary) { colors[key] = getLuminance(dominant) > 128 ? adjustColorBrightness(dominant, -0.1) : adjustColorBrightness(dominant, 0.1); } else { colors[key] = dominant; } } else if (key.startsWith('text')) { const bgContext = colors.bgPrimary || colors.bgSecondary || colors.bgTertiary || existingBgPrimary || '#000000'; colors[key] = getContrastColor(bgContext); } else if (key.startsWith('border')) { const bgContext = colors.bgPrimary || colors.bgSecondary || existingBgPrimary || '#000000'; colors[key] = getLuminance(bgContext) > 128 ? adjustColorBrightness(bgContext, -0.2) : adjustColorBrightness(bgContext, 0.2); } else if (key.startsWith('accent')) { if (localSwatches.length > 1) { colors[key] = localSwatches[1]; } else { colors[key] = adjustColorBrightness(dominant, 0.3); } } }); if (!forceLocal && !lastError) setLastError("Using local analysis (Offline Mode)"); } } } updateState({ generatedColors: { ...generatedColors, ...colors } }); } catch (e: any) { setLastError("Extraction failed completely."); } finally { setIsProcessing(null); } };
  const handleGenerateTexture = async (widget: WidgetDef) => { setIsProcessing(widget.id); const newExplanations = { ...generatedExplanations }; delete newExplanations[widget.id]; updateState({ generatedExplanations: newExplanations }); try { const ai = new GoogleGenAI({ apiKey: apiKey }); const userPrompt = promptInputs[widget.id] || widget.defaultPrompt; let parts: any[] = []; let base64Image = null; try { base64Image = await getProcessedWidgetImage(widget); } catch(e) {} if (base64Image) { const rawBase64 = base64Image.split(',')[1]; parts.push({ inlineData: { mimeType: 'image/jpeg', data: rawBase64 } }); parts.push({ text: `Create a new seamless texture image based on this input image. Request: ${userPrompt}. The output should be a texture pattern suitable for a website background.` }); } else { parts.push({ text: `Create a seamless texture image for a UI background. Description: ${userPrompt}. Return only the image.` }); } const response = await ai.models.generateContent({ model: 'gemini-2.5-flash-image', contents: { parts } }); let foundImage = false; let accumulatedText = ''; if (response.candidates?.[0]?.content?.parts) { for (const part of response.candidates[0].content.parts) { if (part.inlineData) { const newTexture = `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`; updateState({ generatedTextures: { ...generatedTextures, [widget.id]: newTexture } }); foundImage = true; } else if (part.text) { accumulatedText += part.text; } } } if (accumulatedText) updateState({ generatedExplanations: { ...newExplanations, [widget.id]: accumulatedText.trim() } }); if (!foundImage && accumulatedText) alert("The model returned text only. See explanation."); else if (!foundImage && !accumulatedText) alert("The model returned no content."); } catch(e) { alert("Generation failed. Check API key."); } finally { setIsProcessing(null); } };
  const setCropAsTexture = async (widget: WidgetDef) => { try { const base64Image = await getProcessedWidgetImage(widget); updateState({ generatedTextures: { ...generatedTextures, [widget.id]: base64Image } }); } catch (e) { alert("No image source found."); } };
  const applyGeneratedColors = async (widget: WidgetDef) => { setIsProcessing(widget.id); const colorUpdates: any = {}; const textureUpdates: any = {}; let hasUpdates = false; widget.targetVars.forEach((key) => { const val = (generatedColors as any)[key]; if (val) { colorUpdates[key] = val; hasUpdates = true; } }); if (extractionMode === 'texture' && widget.textureVar) { let textureToApply = generatedTextures[widget.id]; if (!textureToApply) { try { textureToApply = await getProcessedWidgetImage(widget); } catch(e) {} } if (textureToApply) { textureUpdates[widget.textureVar] = textureToApply; hasUpdates = true; } } if (hasUpdates) { setSettings(prev => ({ ...prev, theme: 'custom', customColors: { ...prev.customColors, ...colorUpdates, textures: { ...prev.customColors.textures, ...textureUpdates } } })); } else { alert("No generated colors or textures found."); } setIsProcessing(null); };

  const ColorInput = ({ label, propKey }: { label: string, propKey: ColorKey }) => ( <div className="flex items-center justify-between p-2 bg-[var(--bg-primary)] rounded border border-[var(--border-color)]"> <span className="text-xs font-medium text-[var(--text-secondary)]">{label}</span> <div className="flex items-center gap-2"> <span className="text-[10px] font-mono text-[var(--text-secondary)] uppercase">{settings.customColors[propKey]}</span> <input type="color" value={settings.customColors[propKey]} onChange={(e) => handleColorChange(propKey, e.target.value)} className="w-8 h-8 rounded cursor-pointer border-0 p-0 bg-transparent" /> </div> </div> );
  
  const themes = [ { id: 'dark', name: 'Dark Nebula', colors: 'bg-gray-900', description: 'Standard dark mode' }, { id: 'light', name: 'Cloud White', colors: 'bg-gray-100 border border-gray-300 text-gray-900', description: 'Clean light mode' }, { id: 'midnight', name: 'Midnight Blue', colors: 'bg-slate-900', description: 'Deep blue tones' }, { id: 'forest', name: 'Emerald Forest', colors: 'bg-green-950', description: 'Dark green aesthetic' }, { id: 'synthwave', name: 'Synthwave', colors: 'bg-purple-950', description: 'Retro futuristic neon' }, { id: 'custom', name: 'Custom Palette', colors: 'bg-[var(--bg-primary)] border-2 border-dashed border-[var(--accent-secondary)]', description: 'User defined colors' } ];
  const handleColorChange = (key: keyof AppSettings['customColors'], value: string) => { setSettings(prev => ({ ...prev, theme: 'custom', customColors: { ...prev.customColors, [key]: value } })); };

  // New Handlers for Reset/Clear
  const handleResetDefaults = () => {
    if (window.confirm("Reset Custom Palette to default Dark Theme? This will remove all custom colors and textures.")) {
        setSettings(prev => ({ ...prev, customColors: { ...DEFAULT_PALETTE } }));
    }
  };

  const handleClearActiveTextures = () => {
    if (window.confirm("Clear all active background textures from the current theme? Colors will remain.")) {
        setSettings(prev => ({ 
            ...prev, 
            customColors: { 
                ...prev.customColors, 
                textures: {} 
            } 
        }));
    }
  };

  const handleClearStudioData = () => {
      if (window.confirm("Clear all Theme Studio data? This includes uploaded images, generated textures, and prompt history.")) {
          updateState({
              uploadedImage: null,
              widgetImages: {},
              generatedColors: {},
              generatedTextures: {},
              generatedExplanations: {},
              promptInputs: {},
              showCropControls: null
          });
      }
  };

  return (
    <div className="flex flex-col h-full bg-[var(--bg-primary)] text-[var(--text-primary)] p-8 overflow-y-auto transition-colors duration-300">
      <canvas ref={canvasRef} className="hidden" />
      <input type="file" ref={widgetFileInputRef} className="hidden" accept="image/*" onChange={handleWidgetImageUpload} />

      <div className="max-w-5xl mx-auto w-full space-y-8">
        <div>
          <h2 className="text-3xl font-bold mb-2">Settings</h2>
          <p className="text-[var(--text-secondary)]">Customize your development environment.</p>
        </div>

        {/* --- BYOK API KEY SECTION --- */}
        <div className="bg-[var(--bg-secondary)] p-6 rounded-lg border border-[var(--border-color)] shadow-sm">
          <h3 className="text-xl font-semibold mb-4">API Configuration (BYOK)</h3>
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
                    className="w-full bg-[var(--bg-primary)] border border-[var(--border-color)] rounded px-3 py-2 text-sm text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-primary)] font-mono"
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
                  className={`px-4 py-2 rounded text-sm font-medium transition-colors flex items-center gap-2 ${isKeySaved ? 'bg-green-600 text-white' : 'bg-[var(--accent-primary)] hover:opacity-90 text-white'}`}
                >
                  {isKeySaved ? <CheckIcon className="w-4 h-4" /> : 'Save'}
                  {isKeySaved ? 'Saved' : 'Update'}
                </button>
              </div>
            </div>
            <p className="text-xs text-[var(--text-secondary)] italic">
               This key is stored locally in your browser's LocalStorage. It is never sent to a middleman server.
            </p>
          </div>
        </div>

        {/* --- AI THEME STUDIO --- */}
        <div className="bg-[var(--bg-secondary)] rounded-lg border border-[var(--border-color)] overflow-hidden shadow-sm">
           <div className="p-6 border-b border-[var(--border-color)] bg-gradient-to-r from-[var(--bg-tertiary)] to-[var(--bg-secondary)] flex justify-between items-center flex-wrap gap-4">
              <div>
                <h3 className="text-xl font-semibold flex items-center gap-2 text-[var(--text-primary)]">
                    <SparklesIcon className="w-5 h-5 text-purple-400" />
                    AI Theme Studio
                </h3>
                <p className="text-xs text-[var(--text-secondary)] mt-1">Upload an interface image to extract styles or generate textures.</p>
              </div>
              <div className="flex items-center gap-2">
                  <div className="flex bg-[var(--bg-primary)] rounded-lg p-1 border border-[var(--border-color)] mr-2">
                      <button onClick={() => updateState({ extractionMode: 'color' })} className={`px-3 py-1.5 rounded text-xs font-medium transition-all ${extractionMode === 'color' ? 'bg-[var(--accent-primary)] text-white shadow-sm' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'}`}>🎨 Extract Colors</button>
                      <button onClick={() => updateState({ extractionMode: 'texture' })} className={`px-3 py-1.5 rounded text-xs font-medium transition-all ${extractionMode === 'texture' ? 'bg-[var(--accent-primary)] text-white shadow-sm' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'}`}>🖼️ Apply Texture</button>
                  </div>
                  {(uploadedImage || Object.keys(widgetImages).length > 0 || Object.keys(generatedTextures).length > 0) && (
                      <button onClick={handleClearStudioData} className="text-xs text-red-400 hover:text-red-300 hover:bg-red-900/20 px-3 py-1.5 rounded border border-red-900/30 transition-colors flex items-center gap-1">
                          <XMarkIcon className="w-3 h-3" /> Clear Data
                      </button>
                  )}
              </div>
           </div>
           
           <div className="p-6 space-y-6">
              {!uploadedImage && Object.keys(widgetImages).length === 0 ? (
                <div onClick={() => fileInputRef.current?.click()} className="border-2 border-dashed border-[var(--border-color)] rounded-xl p-10 flex flex-col items-center justify-center cursor-pointer hover:bg-[var(--bg-tertiary)] hover:border-[var(--accent-primary)] transition-all group">
                   <PhotoIcon className="w-12 h-12 text-[var(--text-secondary)] group-hover:text-[var(--accent-primary)] mb-3" />
                   <p className="text-sm font-medium text-[var(--text-primary)]">Click to upload reference UI image (Optional)</p>
                   <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleImageUpload} />
                </div>
              ) : (
                <div className="flex flex-col gap-6">
                   {uploadedImage && (
                       <div className="relative w-full bg-[var(--bg-black)] rounded-lg overflow-hidden border border-[var(--border-color)] select-none group/preview">
                           <div ref={imageContainerRef} className="relative w-full mx-auto" style={{ maxWidth: '100%', aspectRatio: `${imageAspectRatio}`, backgroundImage: `url(${uploadedImage})`, backgroundSize: 'contain', backgroundRepeat: 'no-repeat', backgroundPosition: 'center' }}>
                               {showCropControls && (
                                   <>
                                      <div className="absolute inset-0 bg-black/50 transition-opacity duration-300" />
                                      {(() => {
                                          const activeWidget = WIDGETS.find(w => w.id === showCropControls);
                                          const rect = cropOverrides[showCropControls] || activeWidget?.cropZone || {x:0, y:0, w:0.5, h:0.5};
                                          return (
                                              <div className="absolute border-2 border-[var(--accent-primary)] bg-transparent shadow-[0_0_0_9999px_rgba(0,0,0,0.5)] cursor-move group/crop" style={{ left: `${rect.x * 100}%`, top: `${rect.y * 100}%`, width: `${rect.w * 100}%`, height: `${rect.h * 100}%` }} onMouseDown={(e) => handleCropMouseDown(e, 'move', showCropControls)} onTouchStart={(e) => handleCropMouseDown(e, 'move', showCropControls)}>
                                                  <div className="absolute -top-6 left-0 bg-[var(--accent-primary)] text-white text-[9px] font-bold px-1.5 py-0.5 rounded-t">{activeWidget?.name}</div>
                                                  <div className="absolute -bottom-1.5 -right-1.5 w-4 h-4 bg-[var(--accent-primary)] border border-white cursor-nwse-resize z-50 rounded-sm shadow-sm hover:scale-125 transition-transform" onMouseDown={(e) => handleCropMouseDown(e, 'resize', showCropControls)} onTouchStart={(e) => handleCropMouseDown(e, 'resize', showCropControls)} />
                                              </div>
                                          );
                                      })()}
                                   </>
                               )}
                           </div>
                           <div className="absolute top-2 right-2 flex gap-2">
                               <button onClick={() => updateState({ uploadedImage: null, generatedColors: {}, generatedTextures: {}, widgetImages: {}, generatedExplanations: {}, showCropControls: null })} className="bg-black/70 hover:bg-red-900/80 text-white p-2 rounded-full transition-colors"><ArrowPathIcon className="w-4 h-4" /></button>
                           </div>
                       </div>
                   )}
                   
                   <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {WIDGETS.map(widget => {
                         const hasCustomImage = !!widgetImages[widget.id];
                         const activeSource = widgetImages[widget.id] || uploadedImage;
                         const isCropping = showCropControls === widget.id;
                         return (
                           <div key={widget.id} className={`bg-[var(--bg-tertiary)] rounded-lg p-3 border transition-colors relative flex flex-col gap-3 ${isCropping ? 'border-[var(--accent-primary)] ring-1 ring-[var(--accent-primary)] bg-[var(--bg-secondary)]' : 'border-[var(--border-color)] hover:border-[var(--accent-primary)]/50'}`}>
                              <div className="flex justify-between items-start">
                                 <div><h4 className="font-bold text-sm text-[var(--text-primary)]">{widget.name}</h4><p className="text-[10px] text-[var(--text-secondary)]">{widget.description}</p></div>
                                 <div className="flex gap-1">
                                    <button onClick={() => triggerWidgetUpload(widget.id)} className={`p-1.5 rounded hover:bg-[var(--bg-primary)] ${hasCustomImage ? 'text-[var(--accent-primary)]' : 'text-[var(--text-secondary)]'}`}><ArrowUpTrayIcon className="w-3.5 h-3.5" /></button>
                                    {!hasCustomImage && uploadedImage && (<button onClick={() => updateState({ showCropControls: isCropping ? null : widget.id })} className={`p-1.5 rounded hover:bg-[var(--bg-primary)] transition-all ${isCropping ? 'bg-[var(--accent-primary)] text-white shadow-sm' : 'text-[var(--text-secondary)]'}`}><ArrowsPointingOutIcon className="w-3.5 h-3.5" /></button>)}
                                 </div>
                              </div>
                              {extractionMode === 'color' ? (
                                   <div className="flex gap-2 h-10 items-center justify-center bg-[var(--bg-primary)]/30 rounded border border-[var(--border-color)]">
                                         {widget.targetVars.map(v => ( <div key={v} className="w-6 h-6 rounded-full border border-white/20 shadow-sm" style={{ backgroundColor: (generatedColors as any)[v] }} title={v} /> ))}
                                   </div>
                               ) : (
                                   <div className="space-y-2">
                                       <div className="h-24 rounded w-full bg-cover bg-center border border-white/10 shadow-inner relative overflow-hidden group" style={{ backgroundImage: `url(${generatedTextures[widget.id] || activeSource || ''})` }}>
                                           {!generatedTextures[widget.id] && !activeSource && <div className="absolute inset-0 flex items-center justify-center text-[9px]">Text-to-Image Ready</div>}
                                       </div>
                                       <div className="bg-[var(--bg-primary)] p-2 rounded border border-[var(--border-color)]">
                                           <textarea className="w-full bg-transparent text-[10px] text-[var(--text-primary)] focus:outline-none resize-none h-10 mb-1" placeholder="Describe texture..." value={promptInputs[widget.id] !== undefined ? promptInputs[widget.id] : widget.defaultPrompt} onChange={(e) => updateState({ promptInputs: { ...promptInputs, [widget.id]: e.target.value } })} />
                                           <div className="flex justify-between items-center">
                                               {activeSource && (<button onClick={() => setCropAsTexture(widget)} className="text-[9px] text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-[var(--border-color)] px-1.5 py-0.5 rounded">Use Crop</button>)}
                                               <button onClick={() => handleGenerateTexture(widget)} disabled={isProcessing === widget.id} className="bg-purple-600 hover:bg-purple-700 text-white text-[9px] px-2 py-1 rounded flex items-center gap-1 transition-colors ml-auto">{isProcessing === widget.id ? <ArrowPathIcon className="w-3 h-3 animate-spin" /> : <SparklesIcon className="w-3 h-3" />} Generate</button>
                                           </div>
                                       </div>
                                   </div>
                               )}
                              <div className="flex gap-2 mt-auto pt-2 border-t border-[var(--border-color)]">
                                 {extractionMode === 'color' && (<> <button onClick={() => generateWidgetTheme(widget)} disabled={isProcessing === widget.id || !activeSource} className="flex-1 bg-[var(--bg-secondary)] hover:bg-[var(--bg-primary)] border border-[var(--border-color)] text-[var(--text-primary)] py-1.5 rounded text-xs transition-colors flex items-center justify-center gap-1 disabled:opacity-50"><ArrowPathIcon className={`w-3 h-3 ${isProcessing === widget.id ? 'animate-spin' : ''}`} /> Capture (AI)</button> <button onClick={() => generateWidgetTheme(widget, true)} disabled={isProcessing === widget.id || !activeSource} className="px-2 bg-[var(--bg-tertiary)] hover:bg-[var(--bg-primary)] border border-[var(--border-color)] text-[var(--text-secondary)] py-1.5 rounded text-xs transition-colors"><div className="w-3 h-3 border-2 border-current rounded-sm"></div></button> </>)}
                                 <button onClick={() => applyGeneratedColors(widget)} disabled={isProcessing === widget.id} className="flex-1 bg-[var(--accent-primary)] hover:bg-[var(--accent-primary)]/90 text-white py-1.5 rounded text-xs transition-colors flex items-center justify-center gap-1 disabled:opacity-50"><CheckIcon className="w-3 h-3" /> Apply</button>
                              </div>
                           </div>
                         );
                      })}
                   </div>
                </div>
              )}
           </div>
        </div>

        {/* Theme Presets and Custom Palette UI */}
        <div className="bg-[var(--bg-secondary)] p-6 rounded-lg border border-[var(--border-color)]">
          <h3 className="text-xl font-semibold mb-4">Theme Presets</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {themes.map((theme) => (
              <button key={theme.id} onClick={() => setSettings({ ...settings, theme: theme.id as any })} className={`relative p-4 rounded-xl flex flex-col items-start justify-center transition-all min-h-[80px] text-left ${theme.colors} ${settings.theme === theme.id ? 'ring-2 ring-[var(--accent-primary)] shadow-lg scale-102' : 'hover:scale-102 opacity-80 hover:opacity-100 hover:shadow-md'}`}>
                <span className={`font-bold ${theme.id === 'light' ? 'text-gray-900' : 'text-white'}`}>{theme.name}</span>
                {settings.theme === theme.id && <div className="absolute top-2 right-2 bg-[var(--accent-primary)] text-white p-1 rounded-full"><CheckIcon className="w-3 h-3" /></div>}
              </button>
            ))}
          </div>
        </div>

        <div className={`bg-[var(--bg-secondary)] p-6 rounded-lg border border-[var(--border-color)] transition-all duration-500 ${settings.theme === 'custom' ? 'opacity-100' : 'opacity-60 grayscale'}`}>
           <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-semibold">Custom Palette</h3>
              <div className="flex gap-2">
                  {Object.keys(settings.customColors.textures || {}).length > 0 && (
                      <button onClick={handleClearActiveTextures} className="text-xs px-3 py-1 rounded bg-[var(--bg-tertiary)] hover:bg-red-900/30 hover:text-red-400 border border-[var(--border-color)] hover:border-red-900/50 transition-colors flex items-center gap-1">
                          <XMarkIcon className="w-3 h-3" /> Clear Textures
                      </button>
                  )}
                  <button onClick={handleResetDefaults} className="text-xs px-3 py-1 rounded bg-[var(--bg-tertiary)] hover:bg-[var(--bg-primary)] hover:text-orange-400 border border-[var(--border-color)] transition-colors flex items-center gap-1">
                      <ArrowPathIcon className="w-3 h-3" /> Reset Defaults
                  </button>
                  {settings.theme !== 'custom' && <button onClick={() => setSettings({...settings, theme: 'custom'})} className="text-xs bg-[var(--bg-tertiary)] px-3 py-1 rounded hover:bg-[var(--accent-primary)] hover:text-white transition-colors flex items-center gap-1"><PencilIcon className="w-3 h-3" /> Enable</button>}
              </div>
           </div>
           <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pointer-events-auto">
              <div className="space-y-3">
                 <h4 className="text-xs font-bold uppercase text-[var(--text-secondary)] mb-2 border-b border-[var(--border-color)] pb-1">Structural</h4>
                 <ColorInput label="Primary Background" propKey="bgPrimary" />
                 <ColorInput label="Secondary Background" propKey="bgSecondary" />
                 <ColorInput label="Tertiary Background" propKey="bgTertiary" />
                 <ColorInput label="Border Color" propKey="borderColor" />
              </div>
              <div className="space-y-3">
                 <h4 className="text-xs font-bold uppercase text-[var(--text-secondary)] mb-2 border-b border-[var(--border-color)] pb-1">Content & Accent</h4>
                 <ColorInput label="Primary Text" propKey="textPrimary" />
                 <ColorInput label="Secondary Text" propKey="textSecondary" />
                 <ColorInput label="Accent Color" propKey="accentPrimary" />
                 <ColorInput label="Accent Highlight" propKey="accentSecondary" />
              </div>
           </div>
        </div>

        {/* --- SESSION AUTOMATION SETTINGS --- */}
        <div className="bg-[var(--bg-secondary)] p-6 rounded-lg border border-[var(--border-color)]">
          <h3 className="text-xl font-semibold mb-4">Automation & Backup</h3>
          <div className="space-y-6">
            
            {/* Auto Save to Browser */}
            <div className="flex items-center justify-between">
              <label className="flex items-center cursor-pointer">
                <div className="relative">
                  <input type="checkbox" className="sr-only" checked={settings.autoSaveToBrowser} onChange={(e) => setSettings({...settings, autoSaveToBrowser: e.target.checked})} />
                  <div className={`block w-14 h-8 rounded-full transition-colors ${settings.autoSaveToBrowser ? 'bg-[var(--accent-primary)]' : 'bg-gray-600'}`}></div>
                  <div className={`dot absolute left-1 top-1 bg-white w-6 h-6 rounded-full transition-transform ${settings.autoSaveToBrowser ? 'transform translate-x-6' : ''}`}></div>
                </div>
                <div className="ml-3">
                  <div className="text-[var(--text-primary)] font-medium">Keep Session in Browser Memory</div>
                  <div className="text-xs text-[var(--text-secondary)]">Auto-saves to LocalStorage. Images are omitted to save space.</div>
                </div>
              </label>
            </div>

            {/* Auto Export ZIP */}
            <div className="flex items-center justify-between border-t border-[var(--border-color)] pt-4">
              <label className="flex items-center cursor-pointer">
                <div className="relative">
                  <input type="checkbox" className="sr-only" checked={settings.autoExportSessionEnabled} onChange={(e) => setSettings({...settings, autoExportSessionEnabled: e.target.checked})} />
                  <div className={`block w-14 h-8 rounded-full transition-colors ${settings.autoExportSessionEnabled ? 'bg-[var(--accent-primary)]' : 'bg-gray-600'}`}></div>
                  <div className={`dot absolute left-1 top-1 bg-white w-6 h-6 rounded-full transition-transform ${settings.autoExportSessionEnabled ? 'transform translate-x-6' : ''}`}></div>
                </div>
                <div className="ml-3">
                   <div className="text-[var(--text-primary)] font-medium">Auto-Export Session (ZIP)</div>
                   <div className="text-xs text-[var(--text-secondary)]">Downloads a full backup including images every {settings.autoExportSessionInterval / 60} minutes.</div>
                </div>
              </label>
              
              {settings.autoExportSessionEnabled && (
                  <div className="flex items-center gap-2">
                     <span className="text-sm text-[var(--text-secondary)]">Interval:</span>
                     <select 
                        value={settings.autoExportSessionInterval} 
                        onChange={(e) => setSettings({...settings, autoExportSessionInterval: Number(e.target.value)})}
                        className="bg-[var(--bg-primary)] border border-[var(--border-color)] rounded px-2 py-1 text-sm focus:outline-none focus:border-[var(--accent-primary)]"
                     >
                        <option value={300}>5 Minutes</option>
                        <option value={600}>10 Minutes</option>
                        <option value={1800}>30 Minutes</option>
                        <option value={3600}>1 Hour</option>
                     </select>
                  </div>
              )}
            </div>

            {/* Auto-Download File (Snapshots) */}
            <div className="border-t border-[var(--border-color)] pt-4">
                <div className="flex items-center justify-between">
                    <label className="flex items-center cursor-pointer">
                        <div className="relative">
                        <input type="checkbox" className="sr-only" checked={settings.autoDownloadEnabled} onChange={(e) => setSettings({...settings, autoDownloadEnabled: e.target.checked})} />
                        <div className={`block w-14 h-8 rounded-full transition-colors ${settings.autoDownloadEnabled ? 'bg-[var(--accent-primary)]' : 'bg-gray-600'}`}></div>
                        <div className={`dot absolute left-1 top-1 bg-white w-6 h-6 rounded-full transition-transform ${settings.autoDownloadEnabled ? 'transform translate-x-6' : ''}`}></div>
                        </div>
                        <div className="ml-3 text-[var(--text-primary)] font-medium">
                        Enable Auto-Download Snapshots
                        </div>
                    </label>
                </div>

                {settings.autoDownloadEnabled && (
                    <div className="mt-3 p-4 bg-[var(--bg-tertiary)] rounded border border-[var(--border-color)] space-y-3 animate-fade-in">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-2">
                                <ArrowPathIcon className="w-5 h-5 text-[var(--accent-secondary)]" />
                                <span className="text-sm">Interval (seconds):</span>
                            </div>
                            <input 
                                type="number" 
                                min="5" 
                                max="3600"
                                value={settings.autoDownloadInterval}
                                onChange={(e) => setSettings({...settings, autoDownloadInterval: Math.max(5, parseInt(e.target.value) || 30)})}
                                className="w-24 bg-[var(--bg-primary)] border border-[var(--border-color)] rounded px-2 py-1 text-center focus:outline-none focus:border-[var(--accent-primary)]"
                            />
                        </div>
                        
                        <div className="flex items-center justify-between">
                            <span className="text-sm ml-7">Target File:</span>
                            <select
                                value={settings.autoDownloadFileId || ''}
                                onChange={(e) => setSettings({...settings, autoDownloadFileId: e.target.value})}
                                className="w-48 bg-[var(--bg-primary)] border border-[var(--border-color)] rounded px-2 py-1 text-sm focus:outline-none focus:border-[var(--accent-primary)]"
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
        </div>

        {/* Open Files List (Restored) */}
        <div className="bg-[var(--bg-secondary)] p-6 rounded-lg border border-[var(--border-color)]">
          <div className="flex items-center justify-between mb-4">
             <h3 className="text-xl font-semibold">Open Files</h3>
             <span className="text-xs bg-[var(--accent-primary)]/20 text-[var(--accent-secondary)] px-2 py-1 rounded border border-[var(--accent-primary)]/30">{files.length} Active</span>
          </div>
          
          <div className="grid gap-2">
            {files.map(file => (
              <div key={file.id} className="flex items-center justify-between p-3 bg-[var(--bg-tertiary)] rounded border border-[var(--border-color)] hover:border-[var(--accent-primary)]/50 transition-colors">
                <div className="flex items-center gap-3">
                  <DocumentTextIcon className="w-5 h-5 text-[var(--accent-secondary)]" />
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
                        URL.revokeObjectURL(url);
                      }}
                      className="text-xs text-[var(--accent-secondary)] hover:text-white hover:underline mt-1 cursor-pointer"
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
