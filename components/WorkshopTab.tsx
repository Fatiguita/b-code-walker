
import React, { useState } from 'react';
import { AppSettings, ConceptLesson, WorkflowState } from '../types';
import { BugHuntTab } from './BugHuntTab';
import { CommunityTab } from './CommunityTab';
import { WorkflowTab } from './WorkflowTab';
import { 
  AcademicCapIcon, 
  UserGroupIcon, 
  DiagramIcon
} from './Icons';

interface WorkshopTabProps {
  settings: AppSettings;
  // Bug Hunt / Concepts Props
  conceptCache: Record<string, ConceptLesson>;
  setConceptCache: React.Dispatch<React.SetStateAction<Record<string, ConceptLesson>>>;
  // Community Props
  initialCommunityRequest: { type: 'discussion' | 'blog'; topic: string } | null;
  clearCommunityRequest: () => void;
  // Workflow Props
  workflowState: WorkflowState;
  setWorkflowState: React.Dispatch<React.SetStateAction<WorkflowState>>;
  // Navigation Helper
  onInternalNavigate: (to: 'community' | 'learn', topic?: string, type?: 'discussion' | 'blog') => void;
}

export const WorkshopTab: React.FC<WorkshopTabProps> = ({
  settings,
  conceptCache,
  setConceptCache,
  initialCommunityRequest,
  clearCommunityRequest,
  workflowState,
  setWorkflowState,
  onInternalNavigate
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'learn' | 'community' | 'workflow'>('learn');

  // Handle cross-tab requests (e.g. from Concept to Community)
  const handleNavigateToCommunity = (type: 'discussion' | 'blog', topic: string) => {
      setActiveSubTab('community');
      onInternalNavigate('community', topic, type);
  };

  // If a request comes in from props (from App wrapper), auto-switch tab
  React.useEffect(() => {
      if (initialCommunityRequest && activeSubTab !== 'community') {
          setActiveSubTab('community');
      }
  }, [initialCommunityRequest]);

  return (
    <div className="flex flex-col h-full bg-[var(--bg-primary)]">
      {/* Sub-Navigation Bar */}
      <div className="flex-none bg-[var(--bg-secondary)] border-b border-[var(--border-color)] px-4">
         <div className="flex space-x-1">
            <button
               onClick={() => setActiveSubTab('learn')}
               className={`flex items-center gap-2 px-4 py-3 border-b-2 transition-colors text-sm font-medium ${activeSubTab === 'learn' ? 'border-[var(--accent-primary)] text-[var(--accent-primary)]' : 'border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]'}`}
            >
               <AcademicCapIcon className="w-4 h-4" />
               Learn & Play
            </button>
            <button
               onClick={() => setActiveSubTab('community')}
               className={`flex items-center gap-2 px-4 py-3 border-b-2 transition-colors text-sm font-medium ${activeSubTab === 'community' ? 'border-orange-500 text-orange-500' : 'border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]'}`}
            >
               <UserGroupIcon className="w-4 h-4" />
               Community
            </button>
            <button
               onClick={() => setActiveSubTab('workflow')}
               className={`flex items-center gap-2 px-4 py-3 border-b-2 transition-colors text-sm font-medium ${activeSubTab === 'workflow' ? 'border-purple-500 text-purple-500' : 'border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]'}`}
            >
               <DiagramIcon className="w-4 h-4" />
               Workflow
            </button>
         </div>
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-hidden relative">
         {activeSubTab === 'learn' && (
            <BugHuntTab 
               settings={settings} 
               conceptCache={conceptCache} 
               setConceptCache={setConceptCache}
               onNavigateToCommunity={handleNavigateToCommunity}
            />
         )}
         {activeSubTab === 'community' && (
            <CommunityTab 
               settings={settings}
               initialRequest={initialCommunityRequest}
               clearInitialRequest={clearCommunityRequest}
            />
         )}
         {activeSubTab === 'workflow' && (
            <WorkflowTab 
               workflowState={workflowState}
               setWorkflowState={setWorkflowState}
            />
         )}
      </div>
    </div>
  );
};
