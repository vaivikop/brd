import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  FileText, 
  Sparkles, 
  Download, 
  Share2, 
  History, 
  ChevronDown, 
  ChevronUp, 
  ShieldCheck, 
  Info, 
  MessageSquare, 
  Network, 
  CheckCircle2, 
  Database, 
  Clock,
  ArrowRight,
  Loader,
  AlertCircle,
  Eye,
  Edit3,
  X,
  Save,
  Trash2,
  Copy,
  Check,
  ChevronRight,
  Lightbulb,
  RefreshCw,
  BadgeCheck
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import Button from './Button';
import Tooltip from './Tooltip';
import { ProjectState, BRDSection, updateBRD, updateProjectStatus, getProjectStats, addActivityLog } from '../utils/db';
import { generateBRD, refineBRD } from '../utils/services/ai';
import { quickExportBRD } from '../utils/pdfExport';
import { SourceBadge, inferSourceType } from '../utils/sourceIcons';
import { computeWordDiff, WordDiff } from '../utils/diffUtils';

// Inline word diff component for highlighting individual changed words
interface InlineWordDiffProps {
  oldContent: string;
  newContent: string;
}

const InlineWordDiff: React.FC<InlineWordDiffProps> = ({ oldContent, newContent }) => {
  const wordDiff = computeWordDiff(oldContent, newContent);
  
  return (
    <div className="prose prose-slate max-w-none prose-headings:text-slate-900 prose-p:text-slate-600 prose-p:leading-relaxed">
      <div className="text-slate-700 leading-relaxed whitespace-pre-wrap">
        {wordDiff.map((word, index) => {
          if (word.type === 'added') {
            return (
              <span
                key={index}
                className="bg-emerald-200 text-emerald-900 px-0.5 rounded font-semibold"
              >
                {word.text}
              </span>
            );
          } else if (word.type === 'removed') {
            return (
              <span
                key={index}
                className="bg-red-200 text-red-800 px-0.5 rounded line-through opacity-60"
              >
                {word.text}
              </span>
            );
          } else {
            return <span key={index}>{word.text}</span>;
          }
        })}
      </div>
    </div>
  );
};

interface BRDGenerationProps {
  project: ProjectState;
  onUpdate: (project: ProjectState) => void;
  onContinue: () => void;
  onEdit?: () => void;
  onNavigateToGraph?: () => void;
  onNavigateToInsights?: () => void;
}

const BRDGeneration: React.FC<BRDGenerationProps> = ({ project, onUpdate, onContinue, onEdit, onNavigateToGraph, onNavigateToInsights }) => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [expandedSections, setExpandedSections] = useState<string[]>([]);
  const [showExplainability, setShowExplainability] = useState<string | null>(null);
  const [editPrompt, setEditPrompt] = useState('');
  const [isAILoading, setIsAILoading] = useState(false);
  const [editingSectionId, setEditingSectionId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');
  const [showHistory, setShowHistory] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isFinalizing, setIsFinalizing] = useState(false);
  const [lastChangedSectionIds, setLastChangedSectionIds] = useState<string[]>([]);
  const [isExporting, setIsExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [generationError, setGenerationError] = useState<string | null>(null);
  const [showFinalizeSuccess, setShowFinalizeSuccess] = useState(false);
  
  // Track previous section content for word-level diff
  const previousSectionsRef = useRef<Map<string, string>>(new Map());
  
  const documentRef = useRef<HTMLDivElement>(null);

  const brd = project.brd;

  // Get computed project stats
  const projectStats = useMemo(() => getProjectStats(project), [project]);

  // Check if there are new approved insights not in BRD
  const hasNewInsights = useMemo(() => {
    if (!brd) return false;
    const approvedInsights = project.insights?.filter(i => i.status === 'approved') || [];
    const insightsInBRD = project.insights?.filter(i => i.includedInBRD) || [];
    return approvedInsights.length > insightsInBRD.length;
  }, [project.insights, brd]);

  useEffect(() => {
    if (brd?.sections) {
      setExpandedSections(brd.sections.map(s => s.id));
    }
  }, [brd]);

  const handleGenerate = async () => {
    setIsGenerating(true);
    setGenerationError(null);
    try {
      const sectionsData = await generateBRD(
        { name: project.name, description: project.description, goals: project.goals },
        project.insights || [],
        project.sources || []
      );
      
      const newBRD = {
        sections: sectionsData.map((s, i) => ({ ...s, id: `sec_${Date.now()}_${i}` })),
        generatedAt: new Date().toISOString(),
        version: (brd?.version || 0) + 1
      };
      
      // This will also mark insights as included in BRD
      const updated = await updateBRD(newBRD, true);
      onUpdate(updated);
      
      // Log activity
      await addActivityLog(`BRD v${newBRD.version} generated with ${sectionsData.length} sections`, 'AI Agent');
    } catch (error) {
      console.error("Failed to generate BRD", error);
      setGenerationError(error instanceof Error ? error.message : "Failed to generate BRD. Please try again.");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleRefineWithAI = async () => {
    if (!brd || !editPrompt.trim()) return;
    setIsAILoading(true);
    setGenerationError(null);
    try {
      const refinedSections = await refineBRD({ sections: brd.sections }, editPrompt);
      
      // Store current content before updating for diff comparison
      brd.sections.forEach(s => {
        previousSectionsRef.current.set(s.id, s.content);
      });
      
      // Identify what changed (simple title match for now)
      const changedIds: string[] = [];
      const newSections = refinedSections.map((s, i) => {
        const existing = brd.sections.find(ex => ex.title === s.title);
        const id = existing?.id || `sec_${Date.now()}_${i}`;
        if (!existing || existing.content !== s.content) {
          changedIds.push(id);
        }
        return { ...s, id };
      });

      const newBRD = {
        sections: newSections,
        generatedAt: new Date().toISOString(),
        version: brd.version + 1
      };
      
      const updated = await updateBRD(newBRD, false); // Don't re-sync insights for refinement
      onUpdate(updated);
      setEditPrompt('');
      setLastChangedSectionIds(changedIds);
      
      // Log activity
      await addActivityLog(`BRD refined: "${editPrompt.slice(0, 50)}..."`, 'AI Agent');
      
      // Clear highlights after 5 seconds
      setTimeout(() => {
        setLastChangedSectionIds([]);
        previousSectionsRef.current.clear();
      }, 8000);
    } catch (error) {
      console.error("Failed to refine BRD", error);
      setGenerationError(error instanceof Error ? error.message : "Failed to refine BRD. Please try again.");
    } finally {
      setIsAILoading(false);
    }
  };

  const handleManualEdit = (section: BRDSection) => {
    setEditingSectionId(section.id);
    setEditContent(section.content);
  };

  const saveManualEdit = async () => {
    if (!brd || !editingSectionId) return;
    const updatedSections = brd.sections.map(s => 
      s.id === editingSectionId ? { ...s, content: editContent } : s
    );
    const newBRD = {
      ...brd,
      sections: updatedSections,
      version: brd.version + 1,
      generatedAt: new Date().toISOString()
    };
    const updated = await updateBRD(newBRD);
    onUpdate(updated);
    setEditingSectionId(null);
  };

  const handleRestoreVersion = async (version: any) => {
    if (!version) return;
    // Just show the version without creating a new version
    const updated = await updateBRD({
      ...version
    });
    onUpdate(updated);
    setShowHistory(false);
  };

  const handleExportPDF = async () => {
    if (!brd || isExporting) return;
    
    setIsExporting(true);
    setExportError(null);
    
    try {
      await quickExportBRD(project);
    } catch (error) {
      console.error('PDF export failed:', error);
      setExportError(error instanceof Error ? error.message : 'Failed to export PDF');
      // Fallback to print if PDF generation fails
      setTimeout(() => setExportError(null), 5000);
    } finally {
      setIsExporting(false);
    }
  };

  const handleShare = () => {
    const url = window.location.href;
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleFinalize = async () => {
    setIsFinalizing(true);
    setGenerationError(null);
    try {
      const updated = await updateProjectStatus('Final');
      await addActivityLog('BRD finalized and approved', 'User');
      onUpdate(updated);
      setShowFinalizeSuccess(true);
      
      // Show success for 3 seconds then navigate
      setTimeout(() => {
        setShowFinalizeSuccess(false);
        onContinue();
      }, 2500);
    } catch (error) {
      console.error("Finalization failed", error);
      setGenerationError("Failed to finalize BRD. Please try again.");
    } finally {
      setIsFinalizing(false);
    }
  };

  const toggleSection = (id: string) => {
    setExpandedSections(prev => 
      prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]
    );
  };

  if (!brd && !isGenerating) {
    const approvedInsightsCount = project.insights?.filter(i => i.status === 'approved').length || 0;
    const hasApprovedInsights = approvedInsightsCount > 0;
    
    return (
      <div className="max-w-4xl mx-auto py-20 text-center animate-in fade-in slide-in-from-bottom-4 duration-500">
        {/* Error Display */}
        <AnimatePresence>
          {generationError && (
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="mb-8 p-4 bg-red-50 border border-red-200 rounded-2xl flex items-center justify-center gap-3 text-red-700"
            >
              <AlertCircle className="h-5 w-5" />
              <span className="font-medium">{generationError}</span>
              <button onClick={() => setGenerationError(null)} className="ml-4 p-1 hover:bg-red-100 rounded">
                <X className="h-4 w-4" />
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="w-24 h-24 bg-blue-50 rounded-[2rem] flex items-center justify-center mx-auto mb-8 text-blue-600 shadow-xl shadow-blue-500/10">
          <FileText className="h-12 w-12" />
        </div>
        <h1 className="text-4xl font-bold text-slate-900 mb-4 tracking-tight">Ready to build your BRD?</h1>
        <p className="text-xl text-slate-600 mb-8 max-w-2xl mx-auto leading-relaxed">
          I have all the reviewed insights and project context needed to generate a professional, 
          structured Business Requirements Document for you.
        </p>

        {/* Insights Summary */}
        <div className="mb-12 p-6 bg-white rounded-2xl border border-slate-100 shadow-sm max-w-md mx-auto">
          <div className="flex items-center justify-center gap-4 mb-4">
            <div className="p-2 bg-blue-50 text-blue-600 rounded-xl">
              <Lightbulb className="h-5 w-5" />
            </div>
            <div className="text-left">
              <div className="text-2xl font-bold text-slate-900">{approvedInsightsCount}</div>
              <div className="text-xs text-slate-500 font-medium uppercase tracking-wider">Approved Insights</div>
            </div>
          </div>
          {!hasApprovedInsights && (
            <p className="text-sm text-amber-600 bg-amber-50 p-3 rounded-xl border border-amber-100">
              No approved insights yet. Review your insights first for better BRD quality.
            </p>
          )}
        </div>
        
        <div className="grid sm:grid-cols-3 gap-6 mb-12 text-left">
          <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
            <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg w-fit mb-4">
              <CheckCircle2 className="h-5 w-5" />
            </div>
            <h3 className="font-bold text-slate-900 mb-2">Verified Truth</h3>
            <p className="text-sm text-slate-500">Only uses insights you have reviewed and approved.</p>
          </div>
          <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
            <div className="p-2 bg-blue-50 text-blue-600 rounded-lg w-fit mb-4">
              <Sparkles className="h-5 w-5" />
            </div>
            <h3 className="font-bold text-slate-900 mb-2">AI Structured</h3>
            <p className="text-sm text-slate-500">Organized into industry-standard professional sections.</p>
          </div>
          <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
            <div className="p-2 bg-purple-50 text-purple-600 rounded-lg w-fit mb-4">
              <Network className="h-5 w-5" />
            </div>
            <h3 className="font-bold text-slate-900 mb-2">Traceable</h3>
            <p className="text-sm text-slate-500">Every requirement links back to its original source.</p>
          </div>
        </div>

        <div className="flex items-center justify-center gap-4">
          {!hasApprovedInsights && onNavigateToInsights && (
            <Button 
              variant="outline"
              size="lg"
              onClick={onNavigateToInsights}
              className="h-16 px-8 text-lg font-bold rounded-2xl border-slate-200"
            >
              Review Insights First
            </Button>
          )}
          <Button 
            size="lg" 
            onClick={handleGenerate}
            className="h-16 px-12 text-xl font-bold rounded-2xl shadow-2xl shadow-blue-500/30"
          >
            Generate BRD Now <Sparkles className="ml-3 h-6 w-6" />
          </Button>
        </div>
      </div>
    );
  }

  if (isGenerating) {
    return (
      <div className="max-w-4xl mx-auto py-32 text-center animate-in fade-in duration-500">
        <div className="relative w-32 h-32 mx-auto mb-10">
          <motion.div 
            animate={{ rotate: 360 }}
            transition={{ repeat: Infinity, duration: 2, ease: "linear" }}
            className="absolute inset-0 border-4 border-blue-100 border-t-blue-600 rounded-full"
          />
          <div className="absolute inset-0 flex items-center justify-center text-blue-600">
            <FileText className="h-12 w-12 animate-pulse" />
          </div>
        </div>
        <h2 className="text-3xl font-bold text-slate-900 mb-4">Synthesizing Document...</h2>
        <div className="max-w-md mx-auto space-y-4">
          <p className="text-slate-500 font-medium">
            Applying professional structure to {project.insights?.filter(i => i.status === 'approved').length} approved insights.
          </p>
          <div className="flex justify-center gap-2">
            <div className="w-2 h-2 bg-blue-600 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
            <div className="w-2 h-2 bg-blue-600 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
            <div className="w-2 h-2 bg-blue-600 rounded-full animate-bounce"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto pb-20 animate-in fade-in slide-in-from-bottom-4 duration-500 print:max-w-none print:pb-0">
      {/* Generation Error Toast */}
      <AnimatePresence>
        {generationError && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-6 right-6 z-50 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl flex items-center gap-3 shadow-lg print:hidden"
          >
            <AlertCircle className="h-5 w-5" />
            <span className="font-medium">{generationError}</span>
            <button onClick={() => setGenerationError(null)} className="p-1 hover:bg-red-100 rounded">
              <X className="h-4 w-4" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* New Insights Banner */}
      {hasNewInsights && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-2xl flex items-center justify-between print:hidden"
        >
          <div className="flex items-center gap-3 text-amber-700">
            <RefreshCw className="h-5 w-5" />
            <span className="font-medium">
              New insights have been approved since the last BRD generation.
            </span>
          </div>
          <Button 
            variant="outline"
            onClick={handleGenerate}
            className="border-amber-300 text-amber-700 hover:bg-amber-100"
          >
            Regenerate BRD
          </Button>
        </motion.div>
      )}

      {/* Header */}
      <header className="mb-6 lg:mb-10 flex flex-col gap-6 lg:gap-8 print:hidden">
        <div className="max-w-3xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-900 text-white text-[10px] font-bold uppercase tracking-widest mb-3 lg:mb-4">
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" /> Verified Document • v{brd?.version}
          </div>
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black text-slate-900 mb-3 lg:mb-4 tracking-tight">Business Requirements Document</h1>
          <p className="text-base lg:text-xl text-slate-500 leading-relaxed font-medium">
            Project: <span className="text-slate-900">{project.name}</span> • 
            Generated <span className="text-slate-900">{new Date(brd!.generatedAt).toLocaleDateString()}</span>
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <Button 
            variant="outline" 
            onClick={handleExportPDF} 
            disabled={isExporting}
            className="rounded-xl border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-50 flex-1 sm:flex-none justify-center"
          >
            {isExporting ? (
              <>
                <Loader className="h-4 w-4 mr-2 animate-spin" /> Exporting...
              </>
            ) : (
              <>
                <Download className="h-4 w-4 mr-2" /> <span className="hidden sm:inline">Export </span>PDF
              </>
            )}
          </Button>
          <Button variant="outline" onClick={() => setShowShareModal(true)} className="rounded-xl border-slate-200 text-slate-600 hover:bg-slate-50">
            <Share2 className="h-4 w-4 sm:mr-2" /> <span className="hidden sm:inline">Share</span>
          </Button>
          <Button variant="outline" onClick={() => setShowHistory(true)} className="rounded-xl border-slate-200 text-slate-600 hover:bg-slate-50">
            <History className="h-4 w-4 sm:mr-2" /> <span className="hidden sm:inline">History</span>
          </Button>
          <Button 
            variant="outline" 
            onClick={handleGenerate}
            disabled={isGenerating}
            className="rounded-xl border-slate-200 text-slate-600 hover:bg-slate-50"
          >
            <RefreshCw className={`h-4 w-4 sm:mr-2 ${isGenerating ? 'animate-spin' : ''}`} /> 
            <span className="hidden sm:inline">Regenerate BRD</span>
          </Button>
        </div>
        
        {/* Export Error Toast */}
        {exportError && (
          <div className="fixed bottom-6 right-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl flex items-center gap-2 shadow-lg animate-in slide-in-from-bottom-4">
            <AlertCircle className="h-4 w-4" />
            <span className="text-sm font-medium">{exportError}</span>
          </div>
        )}
      </header>

      {/* Print Header */}
      <div className="hidden print:block mb-10 border-b-2 border-slate-900 pb-8">
        <h1 className="text-4xl font-bold mb-2">Business Requirements Document</h1>
        <p className="text-lg text-slate-600">Project: {project.name}</p>
        <p className="text-sm text-slate-400">Version {brd?.version}.0 • Generated on {new Date(brd!.generatedAt).toLocaleString()}</p>
      </div>

      <div className="grid lg:grid-cols-4 gap-6 lg:gap-10 print:block">
        {/* Main Document Content */}
        <div className="lg:col-span-3 space-y-6 print:space-y-10">
          <div className="bg-white rounded-2xl lg:rounded-[2.5rem] shadow-xl shadow-slate-200/50 border border-slate-100 overflow-hidden print:shadow-none print:border-none" ref={documentRef}>
            <div className="p-6 lg:p-12 print:p-0">
              <div className="space-y-12 print:space-y-16">
                {brd?.sections.map((section) => (
                  <section 
                    key={section.id} 
                    className={`scroll-mt-24 group break-inside-avoid p-6 -mx-6 rounded-3xl transition-all duration-1000 ${
                      lastChangedSectionIds.includes(section.id) 
                        ? 'bg-blue-50/50 ring-2 ring-blue-200 shadow-lg shadow-blue-500/5' 
                        : ''
                    }`}
                  >
                    <div className="flex items-center justify-between mb-6 print:mb-4">
                      <div className="flex items-center gap-4">
                        <div className={`w-1.5 h-8 rounded-full print:bg-slate-900 ${
                          lastChangedSectionIds.includes(section.id) ? 'bg-blue-500 animate-pulse' : 'bg-blue-600'
                        }`}></div>
                        <h2 className="text-2xl font-black text-slate-900 tracking-tight print:text-3xl">
                          {section.title}
                          {lastChangedSectionIds.includes(section.id) && (
                            <span className="ml-3 text-[10px] font-bold text-blue-600 bg-blue-100 px-2 py-0.5 rounded-full uppercase tracking-widest animate-in zoom-in">
                              Updated
                            </span>
                          )}
                        </h2>
                      </div>
                      <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity print:hidden">
                        <Tooltip content="View Sources">
                          <button 
                            onClick={() => setShowExplainability(showExplainability === section.id ? null : section.id)}
                            className={`p-2 rounded-lg transition-colors ${showExplainability === section.id ? 'bg-blue-50 text-blue-600' : 'text-slate-400 hover:bg-slate-50 hover:text-blue-600'}`}
                          >
                            <Eye className="h-4 w-4" />
                          </button>
                        </Tooltip>
                        <Tooltip content="Manual Edit">
                          <button 
                            onClick={() => handleManualEdit(section)}
                            className="p-2 text-slate-400 hover:bg-slate-50 rounded-lg transition-colors"
                          >
                            <Edit3 className="h-4 w-4" />
                          </button>
                        </Tooltip>
                        <button 
                          onClick={() => toggleSection(section.id)}
                          className="p-2 text-slate-400 hover:bg-slate-50 rounded-lg transition-colors"
                        >
                          {expandedSections.includes(section.id) ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                        </button>
                      </div>
                    </div>

                    <AnimatePresence initial={false}>
                      {expandedSections.includes(section.id) && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          className="overflow-hidden"
                        >
                          {editingSectionId === section.id ? (
                            <div className="space-y-4 animate-in fade-in duration-300">
                              <textarea 
                                value={editContent}
                                onChange={(e) => setEditContent(e.target.value)}
                                className="w-full h-64 p-6 bg-slate-50 border-2 border-blue-100 rounded-3xl text-slate-700 font-medium outline-none focus:ring-4 focus:ring-blue-500/10 transition-all resize-y"
                              />
                              <div className="flex justify-end gap-3">
                                <Button variant="ghost" onClick={() => setEditingSectionId(null)} className="rounded-xl">Cancel</Button>
                                <Button onClick={saveManualEdit} className="rounded-xl px-6"><Save className="h-4 w-4 mr-2" /> Save Changes</Button>
                              </div>
                            </div>
                          ) : (
                            <div className="prose prose-slate max-w-none prose-headings:text-slate-900 prose-p:text-slate-600 prose-p:leading-relaxed prose-strong:text-slate-900 prose-ul:text-slate-600 prose-table:w-full prose-th:bg-slate-100 prose-th:border prose-th:border-slate-200 prose-th:px-4 prose-th:py-2 prose-th:text-left prose-th:font-semibold prose-th:text-slate-700 prose-td:border prose-td:border-slate-200 prose-td:px-4 prose-td:py-2 prose-td:text-slate-600 print:prose-p:text-black print:prose-headings:text-black">
                              {lastChangedSectionIds.includes(section.id) && previousSectionsRef.current.has(section.id) ? (
                                <InlineWordDiff 
                                  oldContent={previousSectionsRef.current.get(section.id)!} 
                                  newContent={section.content} 
                                />
                              ) : (
                                <Markdown remarkPlugins={[remarkGfm]}>{section.content}</Markdown>
                              )}
                            </div>
                          )}
                          
                          {showExplainability === section.id && (
                            <motion.div 
                              initial={{ opacity: 0, y: 10 }}
                              animate={{ opacity: 1, y: 0 }}
                              className="mt-8 p-6 bg-slate-50 rounded-3xl border border-slate-100 print:hidden"
                            >
                              <div className="flex items-center justify-between mb-4">
                                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                  <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" /> Source Traceability
                                </h4>
                                <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-100">
                                  {section.confidence}% Confidence
                                </span>
                              </div>
                              <div className="space-y-3">
                                <p className="text-xs text-slate-500 font-medium">This section was synthesized from the following verified sources:</p>
                                <div className="flex flex-wrap gap-2">
                                  {(section.sources || []).map((source, i) => (
                                    <SourceBadge key={i} sourceName={source} />
                                  ))}
                                </div>
                              </div>
                            </motion.div>
                          )}
                        </motion.div>
                      )}
                    </AnimatePresence>
                    
                    {!expandedSections.includes(section.id) && (
                      <div className="h-px bg-slate-100 w-full mt-4 print:hidden"></div>
                    )}
                  </section>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Sidebar Actions */}
        <div className="space-y-8 print:hidden">
          <div className="bg-white p-8 rounded-[2.5rem] shadow-xl shadow-slate-200/50 border border-slate-100 sticky top-8">
            <h3 className="text-lg font-bold text-slate-900 mb-6">Document Controls</h3>
            
            <div className="space-y-4 mb-8">
              <div className="p-4 bg-blue-50 rounded-2xl border border-blue-100">
                <div className="flex items-center gap-3 mb-2 text-blue-700">
                  <Sparkles className="h-4 w-4" />
                  <span className="text-xs font-bold uppercase tracking-wider">Quick AI Refine</span>
                </div>
                <p className="text-xs text-blue-600/80 leading-relaxed font-medium">
                  Talk to AI to update the document instantly.
                </p>
              </div>
              
              <div className="relative">
                <textarea 
                  value={editPrompt}
                  onChange={(e) => setEditPrompt(e.target.value)}
                  placeholder="e.g. 'Make the timeline more aggressive'..."
                  className="w-full h-32 p-4 bg-slate-50 border border-slate-100 rounded-2xl text-sm outline-none focus:ring-2 focus:ring-blue-500 transition-all resize-none placeholder-slate-400 font-medium"
                />
                <button 
                  onClick={handleRefineWithAI}
                  disabled={!editPrompt.trim() || isAILoading}
                  className="absolute bottom-3 right-3 p-2 bg-blue-600 text-white rounded-xl shadow-lg shadow-blue-500/20 hover:bg-blue-700 transition-colors disabled:opacity-50"
                >
                  {isAILoading ? <Loader className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
                </button>
              </div>

              <div className="pt-4">
                <Button 
                  variant="outline"
                  onClick={onEdit}
                  className="w-full border-slate-200 text-slate-600 hover:bg-slate-50 rounded-2xl font-bold py-3 text-xs"
                >
                  Open Advanced Editor <ChevronRight className="ml-2 h-3 w-3" />
                </Button>
              </div>
            </div>

            <div className="space-y-3">
              <button 
                onClick={onNavigateToGraph}
                className="w-full flex items-center justify-between p-4 bg-slate-50 hover:bg-slate-100 rounded-2xl transition-all group"
              >
                <div className="flex items-center gap-3">
                  <Network className="h-5 w-5 text-slate-400 group-hover:text-blue-600" />
                  <span className="text-sm font-bold text-slate-700">Requirement Graph</span>
                </div>
                <ArrowRight className="h-4 w-4 text-slate-300" />
              </button>
              <button 
                onClick={onNavigateToInsights}
                className="w-full flex items-center justify-between p-4 bg-slate-50 hover:bg-slate-100 rounded-2xl transition-all group"
              >
                <div className="flex items-center gap-3">
                  <MessageSquare className="h-5 w-5 text-slate-400 group-hover:text-blue-600" />
                  <span className="text-sm font-bold text-slate-700">Stakeholder Feedback</span>
                </div>
                <ArrowRight className="h-4 w-4 text-slate-300" />
              </button>
              <button 
                onClick={() => handleGenerate()}
                className="w-full flex items-center justify-between p-4 bg-slate-50 hover:bg-slate-100 rounded-2xl transition-all group"
              >
                <div className="flex items-center gap-3">
                  <Sparkles className="h-5 w-5 text-slate-400 group-hover:text-blue-600" />
                  <span className="text-sm font-bold text-slate-700">Regenerate Full BRD</span>
                </div>
                <ArrowRight className="h-4 w-4 text-slate-300" />
              </button>
            </div>

            <div className="mt-10 pt-8 border-t border-slate-100">
              {showFinalizeSuccess ? (
                <div className="text-center py-6 animate-in zoom-in duration-300">
                  <div className="w-16 h-16 bg-emerald-50 rounded-full flex items-center justify-center mx-auto mb-4">
                    <BadgeCheck className="h-8 w-8 text-emerald-500" />
                  </div>
                  <p className="text-lg font-bold text-emerald-600">BRD Finalized!</p>
                  <p className="text-sm text-slate-500 mt-1">Redirecting to dashboard...</p>
                </div>
              ) : project.status === 'Final' ? (
                <div className="text-center">
                  <div className="inline-flex items-center gap-2 px-4 py-3 bg-emerald-50 text-emerald-700 rounded-2xl border border-emerald-100 mb-4">
                    <BadgeCheck className="h-5 w-5" />
                    <span className="font-bold">BRD Approved & Finalized</span>
                  </div>
                  <p className="text-sm text-slate-500">
                    This document has been finalized on {project.lastUpdated ? new Date(project.lastUpdated).toLocaleDateString() : 'N/A'}
                  </p>
                </div>
              ) : (
                <>
                  <Button 
                    onClick={handleFinalize}
                    disabled={isFinalizing}
                    className="w-full h-16 rounded-2xl text-lg font-bold shadow-xl shadow-blue-600/20"
                  >
                    {isFinalizing ? <Loader className="h-5 w-5 animate-spin" /> : <><CheckCircle2 className="mr-2 h-5 w-5" /> Finalize & Approve</>}
                  </Button>
                  <p className="mt-4 text-center text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center justify-center gap-2">
                    <Clock className="h-3 w-3" /> Auto-saved to Workspace
                  </p>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* History Modal */}
      <AnimatePresence>
        {showHistory && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowHistory(false)}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="relative w-full max-w-2xl bg-white rounded-[2.5rem] shadow-2xl overflow-hidden"
            >
              <div className="p-8 border-b border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <h3 className="text-2xl font-black text-slate-900">Document History</h3>
                  <Button 
                    onClick={() => { setShowHistory(false); handleGenerate(); }}
                    disabled={isGenerating}
                    className="rounded-xl"
                  >
                    <RefreshCw className={`h-4 w-4 mr-2 ${isGenerating ? 'animate-spin' : ''}`} />
                    Regenerate
                  </Button>
                </div>
                <button onClick={() => setShowHistory(false)} className="p-2 hover:bg-slate-100 rounded-xl transition-colors">
                  <X className="h-6 w-6 text-slate-400" />
                </button>
              </div>
              <div className="p-8 max-h-[60vh] overflow-y-auto space-y-4">
                {project.brdHistory && project.brdHistory.length > 0 ? (
                  [...project.brdHistory].reverse().map((version, i) => (
                    <div key={i} className="p-6 bg-slate-50 rounded-3xl border border-slate-100 flex items-center justify-between group hover:border-blue-200 transition-all">
                      <div>
                        <div className="flex items-center gap-3 mb-1">
                          <span className="text-lg font-bold text-slate-900">Version {version.version}.0</span>
                          <span className="px-2 py-0.5 bg-blue-100 text-blue-600 text-[10px] font-bold rounded-full uppercase">Archived</span>
                        </div>
                        <p className="text-sm text-slate-500 flex items-center gap-2">
                          <Clock className="h-3.5 w-3.5" /> {new Date(version.generatedAt).toLocaleString()}
                        </p>
                      </div>
                      <Button variant="outline" onClick={() => handleRestoreVersion(version)} className="rounded-xl">
                        <Eye className="h-4 w-4 mr-2" /> View
                      </Button>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-12">
                    <History className="h-12 w-12 text-slate-200 mx-auto mb-4" />
                    <p className="text-slate-400 font-medium">No previous versions found.</p>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Share Modal */}
      <AnimatePresence>
        {showShareModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowShareModal(false)}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="relative w-full max-w-md bg-white rounded-[2.5rem] shadow-2xl overflow-hidden"
            >
              <div className="p-8 border-b border-slate-100 flex items-center justify-between">
                <h3 className="text-2xl font-black text-slate-900">Share Document</h3>
                <button onClick={() => setShowShareModal(false)} className="p-2 hover:bg-slate-100 rounded-xl transition-colors">
                  <X className="h-6 w-6 text-slate-400" />
                </button>
              </div>
              <div className="p-8 space-y-6">
                <p className="text-slate-600 font-medium">Share this BRD with your team or stakeholders via a direct link.</p>
                <div className="flex gap-2">
                  <div className="flex-1 p-4 bg-slate-50 border border-slate-100 rounded-2xl text-sm text-slate-500 font-medium truncate">
                    {window.location.href}
                  </div>
                  <Button onClick={handleShare} className="rounded-2xl px-6">
                    {copied ? <Check className="h-5 w-5" /> : <Copy className="h-5 w-5" />}
                  </Button>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <button className="p-4 bg-slate-50 hover:bg-slate-100 rounded-2xl border border-slate-100 transition-all flex flex-col items-center gap-2">
                    <div className="p-2 bg-blue-50 text-blue-600 rounded-lg"><MessageSquare className="h-5 w-5" /></div>
                    <span className="text-xs font-bold text-slate-700">Slack</span>
                  </button>
                  <button className="p-4 bg-slate-50 hover:bg-slate-100 rounded-2xl border border-slate-100 transition-all flex flex-col items-center gap-2">
                    <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg"><CheckCircle2 className="h-5 w-5" /></div>
                    <span className="text-xs font-bold text-slate-700">Teams</span>
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default BRDGeneration;
