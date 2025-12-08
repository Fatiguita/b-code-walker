
import React, { useState } from 'react';
import { AIPlan, AICodeBlock, VisualType } from '../types';
import { Mermaid } from './Mermaid';
import { 
  ProcessVisual, 
  DatabaseVisual, 
  UIVisual, 
  ApiVisual, 
  LogicVisual 
} from './Visuals';
import { 
  CodeBracketIcon, 
  Square2StackIcon, 
  DocumentTextIcon, 
  InformationCircleIcon, 
  ArrowPathIcon,
  EyeIcon,
  XMarkIcon
} from './Icons';

interface VisualizerTabProps {
  aiPlans: AIPlan[];
  activePlanId: string | null;
  setActivePlanId: React.Dispatch<React.SetStateAction<string | null>>;
  setAiPlans: React.Dispatch<React.SetStateAction<AIPlan[]>>;
}

export const VisualizerTab: React.FC<VisualizerTabProps> = ({ 
  aiPlans, 
  activePlanId, 
  setActivePlanId,
  setAiPlans
}) => {
  const activePlan = aiPlans.find(p => p.id === activePlanId);

  const closePlan = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    const newPlans = aiPlans.filter(p => p.id !== id);
    setAiPlans(newPlans);
    if (activePlanId === id && newPlans.length > 0) {
      setActivePlanId(newPlans[newPlans.length - 1].id);
    } else if (newPlans.length === 0) {
      setActivePlanId(null);
    }
  };

  if (aiPlans.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-[var(--text-secondary)]">
        <Square2StackIcon className="w-20 h-20 mb-6 opacity-20" />
        <h2 className="text-2xl font-bold mb-2">No Visualization Available</h2>
        <p className="max-w-md text-center">
          Use the "Generate Code" feature in the Editor tab to create a visualization plan.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-[var(--bg-primary)] transition-colors duration-300">
      
      {/* Plan Tabs Bar */}
      <div className="flex-none bg-[var(--bg-secondary)] border-b border-[var(--border-color)] px-2 pt-2 flex items-center overflow-x-auto no-scrollbar">
         {aiPlans.map(plan => (
            <div 
               key={plan.id}
               onClick={() => setActivePlanId(plan.id)}
               className={`
                  group flex items-center gap-2 px-4 py-2 min-w-[150px] max-w-[240px] text-sm cursor-pointer rounded-t-lg select-none border-t border-l border-r
                  ${activePlanId === plan.id 
                    ? 'bg-[var(--bg-primary)] border-[var(--border-color)] text-[var(--text-primary)] font-medium' 
                    : 'bg-[var(--bg-secondary)] border-transparent text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]'}
               `}
            >
               <span className="truncate flex-1">{plan.name || 'Untitled Plan'}</span>
               <button 
                  onClick={(e) => closePlan(e, plan.id)}
                  className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-red-500/20 hover:text-red-400 transition-all"
               >
                  <XMarkIcon className="w-3.5 h-3.5" />
               </button>
            </div>
         ))}
      </div>

      {/* Main Visualizer Content */}
      <div className="flex-1 overflow-y-auto p-6">
        {activePlan ? (
          <div className="max-w-6xl mx-auto space-y-8 animate-fade-in">
            {/* Header */}
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center space-x-3">
                <div className="p-3 bg-blue-600/20 rounded-lg">
                   <Square2StackIcon className="w-8 h-8 text-blue-400" />
                </div>
                <div>
                  <h1 className="text-3xl font-bold text-[var(--text-primary)]">{activePlan.name}</h1>
                  <p className="text-[var(--text-secondary)] text-sm">
                    Generated on {new Date(activePlan.timestamp).toLocaleString()} • {activePlan.language}
                  </p>
                </div>
              </div>
            </div>

            {/* Global View Card */}
            <div className="bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-xl overflow-hidden shadow-lg">
               <div className="bg-[var(--bg-tertiary)] px-6 py-3 border-b border-[var(--border-color)] flex items-center gap-2">
                  <EyeIcon className="w-5 h-5 text-purple-400" />
                  <h2 className="text-lg font-semibold text-[var(--text-primary)]">Global Overview</h2>
               </div>
               
               <div className="p-6 grid grid-cols-1 lg:grid-cols-2 gap-8">
                  <div className="space-y-4">
                     <h3 className="text-sm font-bold text-[var(--text-secondary)] uppercase tracking-wider">Concept</h3>
                     <div className="prose prose-invert max-w-none text-sm text-[var(--text-primary)] leading-relaxed">
                        {activePlan.globalExplanation || "No global explanation provided."}
                     </div>
                  </div>
                  <div className="min-h-[200px] flex items-center justify-center bg-[var(--bg-primary)] rounded border border-[var(--border-color)] p-2">
                     {activePlan.globalMermaid ? (
                       <Mermaid chart={activePlan.globalMermaid} />
                     ) : (
                       <p className="text-[var(--text-secondary)] italic">No diagram available.</p>
                     )}
                  </div>
               </div>
            </div>

            {/* Individual Blocks */}
            <div className="grid grid-cols-1 gap-6">
               {(activePlan.blocks || []).map((block) => (
                  <VisualBlockCard key={block.id} block={block} />
               ))}
               {(!activePlan.blocks || activePlan.blocks.length === 0) && (
                  <div className="text-center py-10 text-[var(--text-secondary)] bg-[var(--bg-secondary)] rounded-xl border border-[var(--border-color)]">
                    No individual code blocks analyzed.
                  </div>
               )}
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center h-full text-[var(--text-secondary)]">
             <p>Select a plan to view details.</p>
          </div>
        )}
      </div>
    </div>
  );
};

const VisualBlockCard: React.FC<{ block: AICodeBlock }> = ({ block }) => {
  const [activeTab, setActiveTab] = useState<'info' | 'flow' | 'visual'>('info');

  const getVisualIcon = (type?: VisualType) => {
    switch (type) {
      case 'database': return <DatabaseVisual />;
      case 'ui': return <UIVisual />;
      case 'api': return <ApiVisual />;
      case 'logic': return <LogicVisual />;
      case 'process': default: return <ProcessVisual />;
    }
  };

  return (
    <div className="bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-xl overflow-hidden shadow-md flex flex-col md:flex-row min-h-[300px]">
       {/* Sidebar / Header Area */}
       <div className="md:w-64 bg-[var(--bg-tertiary)] border-r border-[var(--border-color)] p-4 flex flex-col">
          <div className="flex items-center gap-2 mb-4">
             <CodeBracketIcon className="w-5 h-5 text-blue-400" />
             <span className="font-mono text-xs text-[var(--text-secondary)] uppercase">{block.type}</span>
          </div>
          <h3 className="font-bold text-[var(--text-primary)] mb-4 break-words font-mono text-sm border-b border-[var(--border-color)] pb-2">
            {block.signature}
          </h3>
          
          <div className="flex flex-col gap-1 mt-auto">
             <button 
               onClick={() => setActiveTab('info')}
               className={`flex items-center gap-2 px-3 py-2 rounded text-sm transition-colors ${activeTab === 'info' ? 'bg-blue-600 text-white' : 'text-[var(--text-secondary)] hover:bg-[var(--bg-primary)]'}`}
             >
                <InformationCircleIcon className="w-4 h-4" /> Explanation
             </button>
             <button 
               onClick={() => setActiveTab('flow')}
               className={`flex items-center gap-2 px-3 py-2 rounded text-sm transition-colors ${activeTab === 'flow' ? 'bg-blue-600 text-white' : 'text-[var(--text-secondary)] hover:bg-[var(--bg-primary)]'}`}
             >
                <ArrowPathIcon className="w-4 h-4" /> Workflow
             </button>
             <button 
               onClick={() => setActiveTab('visual')}
               className={`flex items-center gap-2 px-3 py-2 rounded text-sm transition-colors ${activeTab === 'visual' ? 'bg-blue-600 text-white' : 'text-[var(--text-secondary)] hover:bg-[var(--bg-primary)]'}`}
             >
                <EyeIcon className="w-4 h-4" /> Representation
             </button>
          </div>
       </div>

       {/* Content Area */}
       <div className="flex-1 p-6 relative bg-[var(--bg-secondary)]">
          {activeTab === 'info' && (
             <div className="animate-fade-in">
                <h4 className="text-lg font-semibold mb-4 text-[var(--text-primary)]">Logic Breakdown</h4>
                <div className="prose prose-invert max-w-none text-sm text-[var(--text-secondary)]">
                   <p>{block.explanation || "No explanation provided for this block."}</p>
                </div>
                {block.code && (
                   <div className="mt-6">
                      <h5 className="text-xs font-bold text-[var(--text-secondary)] uppercase mb-2">Source Preview</h5>
                      <pre className="bg-[var(--bg-primary)] p-3 rounded text-xs font-mono overflow-x-auto text-gray-300 max-h-40">
                         {block.code.split('\n').slice(0, 10).join('\n')}
                         {block.code.split('\n').length > 10 && '\n...'}
                      </pre>
                   </div>
                )}
             </div>
          )}

          {activeTab === 'flow' && (
             <div className="h-full flex flex-col animate-fade-in">
                <h4 className="text-lg font-semibold mb-4 text-[var(--text-primary)]">Execution Flow</h4>
                <div className="flex-1 flex items-center justify-center bg-[var(--bg-primary)] rounded border border-[var(--border-color)] overflow-hidden">
                   {block.mermaid ? (
                      <Mermaid chart={block.mermaid} />
                   ) : (
                      <div className="text-center text-[var(--text-secondary)]">
                         <p>No workflow diagram generated.</p>
                      </div>
                   )}
                </div>
             </div>
          )}

          {activeTab === 'visual' && (
             <div className="h-full flex flex-col animate-fade-in">
                <h4 className="text-lg font-semibold mb-4 text-[var(--text-primary)]">Visual Representation</h4>
                <div className="flex-1 flex flex-col items-center justify-center bg-[var(--bg-primary)] rounded border border-[var(--border-color)] p-8">
                   <div className="w-full max-w-md">
                      {getVisualIcon(block.visualType)}
                   </div>
                   <p className="mt-6 text-sm text-[var(--text-secondary)] text-center uppercase tracking-widest">
                      Type: <span className="text-blue-400 font-bold">{block.visualType || 'Process'}</span>
                   </p>
                </div>
             </div>
          )}
       </div>
    </div>
  );
};
