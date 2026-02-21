import React, { useState, useEffect, useRef } from 'react';
import { 
  Sparkles, 
  ArrowLeft, 
  Check, 
  X, 
  Loader, 
  Info, 
  ShieldCheck, 
  Database, 
  MessageSquare, 
  Zap,
  ArrowRight,
  History,
  Save,
  AlertCircle,
  Eye,
  FileText,
  ChevronRight,
  RotateCcw
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import Markdown from 'react-markdown';
import Button from './Button';
import Tooltip from './Tooltip';
import { ProjectState, BRDSection, updateBRD } from '../utils/db';
import { proposeBRDEdit, BRDEditProposal } from '../utils/services/ai';

interface BRDEditProps {
  project: ProjectState;
  onUpdate: (project: ProjectState) => void;
  onBack: () => void;
}

const BRDEdit: React.FC<BRDEditProps> = ({ project, onUpdate, onBack }) => {
  const [instruction, setInstruction] = useState('');
  const [isProposing, setIsProposing] = useState(false);
  const [proposal, setProposal] = useState<BRDEditProposal | null>(null);
  const [activeSectionId, setActiveSectionId] = useState<string | null>(null);
  const [isApplying, setIsApplying] = useState(false);
  
  const brd = project.brd;
  const sections = brd?.sections || [];

  const handlePropose = async () => {
    if (!brd || !instruction.trim()) return;
    setIsProposing(true);
    setProposal(null);
    try {
      const result = await proposeBRDEdit({ sections: brd.sections }, instruction, project.insights || []);
      setProposal(result);
    } catch (error) {
      console.error("Failed to propose edit", error);
    } finally {
      setIsProposing(false);
    }
  };

  const handleApply = async () => {
    if (!brd || !proposal) return;
    setIsApplying(true);
    try {
      const updatedSections = brd.sections.map(section => {
        const update = proposal.updatedSections.find(u => u.title === section.title);
        if (update) {
          return { ...section, content: update.content };
        }
        return section;
      });

      const newBRD = {
        ...brd,
        sections: updatedSections,
        version: brd.version + 1,
        generatedAt: new Date().toISOString()
      };

      const updated = await updateBRD(newBRD);
      onUpdate(updated);
      setProposal(null);
      setInstruction('');
    } catch (error) {
      console.error("Failed to apply edit", error);
    } finally {
      setIsApplying(false);
    }
  };

  const handleDiscard = () => {
    setProposal(null);
    setInstruction('');
  };

  return (
    <div className="max-w-[1600px] mx-auto h-[calc(100vh-120px)] flex flex-col animate-in fade-in duration-500">
      {/* Top Bar */}
      <div className="flex items-center justify-between mb-6 px-4">
        <div className="flex items-center gap-4">
          <button 
            onClick={onBack}
            className="p-2 hover:bg-white rounded-xl text-slate-400 hover:text-slate-900 transition-all shadow-sm border border-transparent hover:border-slate-200"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">AI-Assisted Editor</h1>
            <p className="text-sm text-slate-500 font-medium">Refining: <span className="text-slate-900">{project.name}</span></p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="px-3 py-1.5 bg-emerald-50 text-emerald-600 rounded-lg text-[10px] font-bold uppercase tracking-widest border border-emerald-100 flex items-center gap-2">
            <ShieldCheck className="h-3.5 w-3.5" /> Safe Edit Mode Active
          </div>
        </div>
      </div>

      <div className="flex-1 flex gap-8 min-h-0 px-4">
        {/* Left: Document View */}
        <div className="flex-1 bg-white rounded-[2.5rem] shadow-xl shadow-slate-200/50 border border-slate-100 flex flex-col min-w-0 overflow-hidden">
          <div className="p-6 border-b border-slate-50 flex items-center justify-between bg-slate-50/50">
            <div className="flex items-center gap-3">
              <FileText className="h-5 w-5 text-slate-400" />
              <span className="text-sm font-bold text-slate-700 uppercase tracking-wider">Document Preview</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold text-slate-400 uppercase">v{brd?.version}.0</span>
            </div>
          </div>
          
          <div className="flex-1 overflow-y-auto p-12 hide-scrollbar">
            <div className="max-w-3xl mx-auto space-y-16">
              {sections.map((section) => {
                const isAffected = proposal?.affectedSectionTitles.includes(section.title);
                const update = proposal?.updatedSections.find(u => u.title === section.title);
                
                return (
                  <section 
                    key={section.id} 
                    className={`relative transition-all duration-500 p-8 rounded-3xl border-2 ${
                      isAffected 
                        ? 'bg-blue-50/30 border-blue-200 shadow-lg shadow-blue-500/5' 
                        : 'border-transparent'
                    }`}
                  >
                    {isAffected && (
                      <div className="absolute -left-4 top-8 w-1 h-12 bg-blue-500 rounded-full animate-pulse"></div>
                    )}
                    
                    <div className="flex items-center justify-between mb-6">
                      <h2 className={`text-2xl font-black tracking-tight ${isAffected ? 'text-blue-700' : 'text-slate-900'}`}>
                        {section.title}
                      </h2>
                      {isAffected && (
                        <span className="px-3 py-1 bg-blue-100 text-blue-600 text-[10px] font-bold rounded-full uppercase tracking-widest animate-in zoom-in duration-300">
                          Proposed Change
                        </span>
                      )}
                    </div>

                    <div className="prose prose-slate max-w-none">
                      {update ? (
                        <div className="relative">
                          <div className="absolute -inset-4 bg-emerald-50/50 rounded-2xl -z-10 border border-emerald-100/50"></div>
                          <Markdown>{update.content}</Markdown>
                        </div>
                      ) : (
                        <Markdown>{section.content}</Markdown>
                      )}
                    </div>

                    {update && (
                      <motion.div 
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="mt-8 p-6 bg-white rounded-2xl border border-blue-100 shadow-sm"
                      >
                        <div className="flex items-center gap-2 mb-3 text-blue-600">
                          <Zap className="h-4 w-4" />
                          <span className="text-xs font-bold uppercase tracking-wider">AI Reasoning</span>
                        </div>
                        <p className="text-sm text-slate-600 font-medium mb-4 leading-relaxed">
                          {update.reasoning}
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {update.referencedInsights.map((insight, i) => (
                            <span key={i} className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-slate-50 border border-slate-100 rounded-lg text-[10px] font-bold text-slate-500">
                              <Database className="h-3 w-3" /> {insight}
                            </span>
                          ))}
                        </div>
                      </motion.div>
                    )}
                  </section>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right: AI Command Center */}
        <div className="w-[400px] flex flex-col gap-6">
          <div className="bg-white p-8 rounded-[2.5rem] shadow-xl shadow-slate-200/50 border border-slate-100 flex flex-col">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2.5 bg-blue-600 text-white rounded-2xl shadow-lg shadow-blue-500/30">
                <Sparkles className="h-5 w-5" />
              </div>
              <h3 className="text-xl font-black text-slate-900 tracking-tight">AI Command Center</h3>
            </div>

            <p className="text-sm text-slate-500 font-medium mb-6 leading-relaxed">
              Describe the changes you want to make. I'll propose specific updates to affected sections.
            </p>

            <div className="relative mb-6">
              <textarea 
                value={instruction}
                onChange={(e) => setInstruction(e.target.value)}
                placeholder="e.g. 'Add a section about data privacy compliance' or 'Make the executive summary more concise for leadership'..."
                className="w-full h-40 p-5 bg-slate-50 border border-slate-100 rounded-3xl text-sm font-medium outline-none focus:ring-4 focus:ring-blue-500/10 transition-all resize-none placeholder-slate-400"
                disabled={isProposing || !!proposal}
              />
              {!proposal && (
                <div className="absolute bottom-4 right-4 flex gap-2">
                  <button 
                    onClick={handlePropose}
                    disabled={!instruction.trim() || isProposing}
                    className="p-3 bg-blue-600 text-white rounded-2xl shadow-xl shadow-blue-500/30 hover:bg-blue-700 transition-all disabled:opacity-50 group"
                  >
                    {isProposing ? <Loader className="h-5 w-5 animate-spin" /> : <ArrowRight className="h-5 w-5 group-hover:translate-x-1 transition-transform" />}
                  </button>
                </div>
              )}
            </div>

            <AnimatePresence>
              {proposal ? (
                <motion.div 
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="space-y-6"
                >
                  <div className="p-5 bg-emerald-50 rounded-3xl border border-emerald-100">
                    <div className="flex items-center gap-3 mb-3 text-emerald-700">
                      <Check className="h-5 w-5" />
                      <span className="text-xs font-bold uppercase tracking-widest">Proposal Ready</span>
                    </div>
                    <p className="text-xs text-emerald-600/80 font-medium leading-relaxed">
                      I've identified <span className="font-bold">{proposal.affectedSectionTitles.length} affected sections</span>. Review the highlights in the document.
                    </p>
                  </div>

                  <div className="space-y-3">
                    <Button 
                      onClick={handleApply}
                      disabled={isApplying}
                      className="w-full h-14 rounded-2xl text-base font-bold shadow-xl shadow-blue-600/20"
                    >
                      {isApplying ? <Loader className="h-5 w-5 animate-spin" /> : <><Save className="mr-2 h-5 w-5" /> Apply All Changes</>}
                    </Button>
                    <Button 
                      variant="outline" 
                      onClick={handleDiscard}
                      className="w-full h-14 rounded-2xl text-base font-bold border-slate-200 text-slate-500 hover:bg-slate-50"
                    >
                      <RotateCcw className="mr-2 h-5 w-5" /> Discard Proposal
                    </Button>
                  </div>
                </motion.div>
              ) : (
                <div className="space-y-4">
                  <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Suggested Commands</h4>
                  <div className="grid gap-2">
                    {[
                      "Rewrite for leadership audience",
                      "Add compliance requirements",
                      "Make timeline more aggressive",
                      "Clarify success metrics"
                    ].map((cmd, i) => (
                      <button 
                        key={i}
                        onClick={() => setInstruction(cmd)}
                        className="text-left p-3 bg-slate-50 hover:bg-blue-50 hover:text-blue-600 rounded-xl text-xs font-bold text-slate-600 transition-all border border-transparent hover:border-blue-100"
                      >
                        {cmd}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </AnimatePresence>
          </div>

          <div className="bg-white p-6 rounded-[2rem] shadow-lg shadow-slate-200/30 border border-slate-100">
            <div className="flex items-center gap-3 mb-4">
              <Info className="h-5 w-5 text-slate-400" />
              <h4 className="text-sm font-bold text-slate-900">Editor Tips</h4>
            </div>
            <ul className="space-y-3">
              <li className="flex gap-3 text-xs text-slate-500 font-medium leading-relaxed">
                <div className="w-1 h-1 rounded-full bg-blue-500 mt-1.5 shrink-0"></div>
                Changes are only applied to the sections highlighted in blue.
              </li>
              <li className="flex gap-3 text-xs text-slate-500 font-medium leading-relaxed">
                <div className="w-1 h-1 rounded-full bg-blue-500 mt-1.5 shrink-0"></div>
                Use "Restore" in the history tab if you want to undo a finalized edit.
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BRDEdit;
