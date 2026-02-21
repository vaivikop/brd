import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
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
  Copy,
  Check,
  ChevronRight,
  ChevronLeft,
  Lightbulb,
  RefreshCw,
  BadgeCheck,
  Target,
  Users,
  Briefcase,
  Zap,
  FileCode,
  FileType,
  Globe,
  Menu,
  Settings,
  Filter,
  BarChart3,
  AlertTriangle,
  MessageCircle,
  Plus,
  Trash2,
  GitCompare,
  Layers,
  BookOpen,
  Send,
  ThumbsUp,
  ThumbsDown,
  MoreHorizontal,
  Keyboard
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import Button from './Button';
import Tooltip from './Tooltip';
import { ProjectState, BRDSection, updateBRD, updateProjectStatus, getProjectStats, addActivityLog, Insight } from '../utils/db';
import { generateBRDAdvanced, refineBRDSection, analyzeGaps, BRDTemplate, BRDAudience, BRDTone } from '../utils/services/ai';
import { quickExportBRD, exportToWord, exportToHTML, exportToConfluence } from '../utils/pdfExport';
import { SourceBadge, inferSourceType } from '../utils/sourceIcons';

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

interface SectionComment {
  id: string;
  sectionId: string;
  author: string;
  text: string;
  timestamp: string;
  resolved: boolean;
  reactions?: { userId: string; type: 'like' | 'dislike' }[];
}

interface SectionApproval {
  sectionId: string;
  status: 'pending' | 'approved' | 'needs-revision';
  approvedBy?: string;
  approvedAt?: string;
  notes?: string;
}

interface GapAnalysisItem {
  area: string;
  severity: 'critical' | 'major' | 'minor';
  description: string;
  recommendation: string;
  affectedSections: string[];
}

interface BRDGenerationEnterpriseProps {
  project: ProjectState;
  onUpdate: (project: ProjectState) => void;
  onContinue: () => void;
  onEdit?: () => void;
  onNavigateToGraph?: () => void;
  onNavigateToInsights?: () => void;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const TEMPLATES: { id: BRDTemplate; name: string; description: string; icon: React.ReactNode }[] = [
  { id: 'enterprise', name: 'Enterprise', description: 'Comprehensive format for large organizations', icon: <Briefcase className="h-4 w-4" /> },
  { id: 'agile', name: 'Agile', description: 'Lean format focused on user stories', icon: <Zap className="h-4 w-4" /> },
  { id: 'waterfall', name: 'Waterfall', description: 'Traditional sequential approach', icon: <Layers className="h-4 w-4" /> },
  { id: 'lean', name: 'Lean Startup', description: 'MVP-focused minimal documentation', icon: <Target className="h-4 w-4" /> },
];

const AUDIENCES: { id: BRDAudience; name: string; description: string; icon: React.ReactNode }[] = [
  { id: 'executive', name: 'Executive', description: 'High-level strategic overview', icon: <Briefcase className="h-4 w-4" /> },
  { id: 'technical', name: 'Technical', description: 'Detailed technical specifications', icon: <FileCode className="h-4 w-4" /> },
  { id: 'stakeholder', name: 'Stakeholder', description: 'Business-focused requirements', icon: <Users className="h-4 w-4" /> },
  { id: 'compliance', name: 'Compliance', description: 'Regulatory and audit focused', icon: <ShieldCheck className="h-4 w-4" /> },
];

const TONES: { id: BRDTone; name: string; description: string }[] = [
  { id: 'formal', name: 'Formal', description: 'Professional corporate language' },
  { id: 'concise', name: 'Concise', description: 'Brief and to the point' },
  { id: 'detailed', name: 'Detailed', description: 'Comprehensive explanations' },
  { id: 'technical', name: 'Technical', description: 'Developer-oriented language' },
];

const EXPORT_FORMATS = [
  { id: 'pdf', name: 'PDF', icon: <FileText className="h-4 w-4" />, description: 'Portable Document Format' },
  { id: 'word', name: 'Word', icon: <FileType className="h-4 w-4" />, description: 'Microsoft Word (.docx)' },
  { id: 'html', name: 'HTML', icon: <Globe className="h-4 w-4" />, description: 'Web page format' },
  { id: 'confluence', name: 'Confluence', icon: <BookOpen className="h-4 w-4" />, description: 'Atlassian Confluence markup' },
];

const QUICK_ACTIONS = [
  { id: 'expand', label: 'Expand Details', prompt: 'Add more specific details and examples to this section' },
  { id: 'simplify', label: 'Simplify', prompt: 'Make this section more concise and easier to understand' },
  { id: 'examples', label: 'Add Examples', prompt: 'Add concrete real-world examples to illustrate the points' },
  { id: 'technical', label: 'Make Technical', prompt: 'Add more technical depth and specifications' },
  { id: 'executive', label: 'Executive Summary', prompt: 'Rewrite for executive audience, focus on business value' },
];

// ============================================================================
// MAIN COMPONENT
// ============================================================================

const BRDGenerationEnterprise: React.FC<BRDGenerationEnterpriseProps> = ({ 
  project, 
  onUpdate, 
  onContinue, 
  onEdit, 
  onNavigateToGraph, 
  onNavigateToInsights 
}) => {
  // ========== STATE ==========
  // Generation state
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationProgress, setGenerationProgress] = useState<{ current: number; total: number; section: string } | null>(null);
  const [generationError, setGenerationError] = useState<string | null>(null);
  
  // Configuration state
  const [selectedTemplate, setSelectedTemplate] = useState<BRDTemplate>('enterprise');
  const [selectedAudience, setSelectedAudience] = useState<BRDAudience>('stakeholder');
  const [selectedTone, setSelectedTone] = useState<BRDTone>('formal');
  const [showConfigPanel, setShowConfigPanel] = useState(false);
  
  // View state - persist to localStorage
  const [expandedSections, setExpandedSections] = useState<string[]>([]);
  const [activeSection, setActiveSection] = useState<string | null>(null);
  const [showTOC, setShowTOC] = useState(() => {
    const saved = localStorage.getItem('clarityai_brd_sidebar');
    return saved !== 'false'; // Default to true
  });
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const [showMobileSidebar, setShowMobileSidebar] = useState(false);
  const [viewMode, setViewMode] = useState<'document' | 'compare' | 'comments'>(() => {
    const saved = localStorage.getItem('clarityai_brd_viewmode');
    return (saved as 'document' | 'compare' | 'comments') || 'document';
  });
  
  // Persist sidebar and viewMode changes
  const handleSetShowTOC = (value: boolean) => {
    setShowTOC(value);
    localStorage.setItem('clarityai_brd_sidebar', String(value));
  };
  
  const handleSetViewMode = (mode: 'document' | 'compare' | 'comments') => {
    setViewMode(mode);
    localStorage.setItem('clarityai_brd_viewmode', mode);
  };
  
  // Edit state
  const [editPrompt, setEditPrompt] = useState('');
  const [isAILoading, setIsAILoading] = useState(false);
  const [editingSectionId, setEditingSectionId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');
  const [regeneratingSection, setRegeneratingSection] = useState<string | null>(null);
  
  // Traceability state
  const [showExplainability, setShowExplainability] = useState<string | null>(null);
  const [lastChangedSectionIds, setLastChangedSectionIds] = useState<string[]>([]);
  
  // Comments & Approval state
  const [comments, setComments] = useState<SectionComment[]>([]);
  const [approvals, setApprovals] = useState<SectionApproval[]>([]);
  const [newCommentText, setNewCommentText] = useState('');
  const [commentingSectionId, setCommentingSectionId] = useState<string | null>(null);
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editCommentText, setEditCommentText] = useState('');
  
  // Gap Analysis state
  const [gapAnalysis, setGapAnalysis] = useState<GapAnalysisItem[]>([]);
  const [isAnalyzingGaps, setIsAnalyzingGaps] = useState(false);
  const [showGapAnalysis, setShowGapAnalysis] = useState(false);
  
  // Modal state
  const [showHistory, setShowHistory] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [showKeyboardShortcuts, setShowKeyboardShortcuts] = useState(false);
  const [copied, setCopied] = useState(false);
  
  // Finalize state
  const [isFinalizing, setIsFinalizing] = useState(false);
  const [showFinalizeSuccess, setShowFinalizeSuccess] = useState(false);
  
  // Export state
  const [isExporting, setIsExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [selectedExportFormat, setSelectedExportFormat] = useState('pdf');
  
  // Compare state (for diff view)
  const [compareVersion, setCompareVersion] = useState<number | null>(null);
  
  // Refs
  const documentRef = useRef<HTMLDivElement>(null);
  const sectionRefs = useRef<{ [key: string]: HTMLElement | null }>({});
  
  const brd = project.brd;
  const projectStats = useMemo(() => getProjectStats(project), [project]);
  
  // ========== COMPUTED VALUES ==========
  const hasNewInsights = useMemo(() => {
    if (!brd) return false;
    const approvedInsights = project.insights?.filter(i => i.status === 'approved') || [];
    const insightsInBRD = project.insights?.filter(i => i.includedInBRD) || [];
    return approvedInsights.length > insightsInBRD.length;
  }, [project.insights, brd]);
  
  const confidenceMap = useMemo(() => {
    if (!brd) return {};
    return brd.sections.reduce((acc, s) => {
      acc[s.id] = s.confidence;
      return acc;
    }, {} as Record<string, number>);
  }, [brd]);
  
  const overallCompletion = useMemo(() => {
    if (!brd) return 0;
    const totalApprovals = approvals.filter(a => a.status === 'approved').length;
    return Math.round((totalApprovals / brd.sections.length) * 100);
  }, [brd, approvals]);
  
  // ========== EFFECTS ==========
  useEffect(() => {
    if (brd?.sections) {
      setExpandedSections(brd.sections.map(s => s.id));
      // Load approvals from BRD sections (persisted) - don't reset on refresh
      setApprovals(brd.sections.map(s => ({
        sectionId: s.id,
        status: s.approval?.status || 'pending',
        approvedBy: s.approval?.approvedBy,
        approvedAt: s.approval?.approvedAt,
        notes: s.approval?.notes
      })));
      // Load comments from BRD sections (persisted)
      const allComments: SectionComment[] = [];
      brd.sections.forEach(s => {
        if (s.comments) {
          s.comments.forEach(c => {
            allComments.push({ ...c, sectionId: s.id, reactions: [] });
          });
        }
      });
      if (allComments.length > 0) {
        setComments(allComments);
      }
    }
  }, [brd?.sections?.length, brd?.version]);
  
  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl/Cmd + S = Save
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        // Auto-save is always on, but we can show a toast
      }
      // Ctrl/Cmd + E = Export
      if ((e.ctrlKey || e.metaKey) && e.key === 'e') {
        e.preventDefault();
        setShowExportModal(true);
      }
      // Ctrl/Cmd + G = Generate/Regenerate
      if ((e.ctrlKey || e.metaKey) && e.key === 'g') {
        e.preventDefault();
        if (!isGenerating && !brd) handleGenerate();
      }
      // Ctrl/Cmd + / = Show shortcuts
      if ((e.ctrlKey || e.metaKey) && e.key === '/') {
        e.preventDefault();
        setShowKeyboardShortcuts(true);
      }
      // Escape = Close modals
      if (e.key === 'Escape') {
        setShowHistory(false);
        setShowShareModal(false);
        setShowExportModal(false);
        setShowGapAnalysis(false);
        setShowKeyboardShortcuts(false);
        setEditingSectionId(null);
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isGenerating, brd]);
  
  // Scroll spy for active section
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            setActiveSection(entry.target.id.replace('section-', ''));
          }
        });
      },
      { rootMargin: '-20% 0px -60% 0px' }
    );
    
    Object.values(sectionRefs.current).forEach(ref => {
      if (ref) observer.observe(ref);
    });
    
    return () => observer.disconnect();
  }, [brd]);
  
  // ========== HANDLERS ==========
  const handleGenerate = async () => {
    setIsGenerating(true);
    setGenerationError(null);
    setGenerationProgress({ current: 0, total: 8, section: 'Preparing...' });
    
    try {
      const sectionsData = await generateBRDAdvanced(
        { name: project.name, description: project.description, goals: project.goals },
        project.insights || [],
        { template: selectedTemplate, audience: selectedAudience, tone: selectedTone },
        (progress) => setGenerationProgress(progress)
      );
      
      const newBRD = {
        sections: sectionsData.map((s, i) => ({ ...s, id: `sec_${Date.now()}_${i}` })),
        generatedAt: new Date().toISOString(),
        version: (brd?.version || 0) + 1
      };
      
      const updated = await updateBRD(newBRD, true);
      onUpdate(updated);
      
      await addActivityLog(`BRD v${newBRD.version} generated (${selectedTemplate} template, ${selectedAudience} audience)`, 'AI Agent');
    } catch (error) {
      console.error("Failed to generate BRD", error);
      setGenerationError(error instanceof Error ? error.message : "Failed to generate BRD. Please try again.");
    } finally {
      setIsGenerating(false);
      setGenerationProgress(null);
    }
  };
  
  const handleRegenerateSection = async (sectionId: string, customPrompt?: string) => {
    if (!brd) return;
    const section = brd.sections.find(s => s.id === sectionId);
    if (!section) return;
    
    setRegeneratingSection(sectionId);
    try {
      const refinedContent = await refineBRDSection(
        section,
        customPrompt || `Regenerate this ${section.title} section with fresh content`,
        project.insights?.filter(i => i.status === 'approved') || [],
        { audience: selectedAudience, tone: selectedTone }
      );
      
      const updatedSections = brd.sections.map(s => 
        s.id === sectionId ? { ...s, content: refinedContent.content, confidence: refinedContent.confidence } : s
      );
      
      const newBRD = {
        ...brd,
        sections: updatedSections,
        version: brd.version + 1,
        generatedAt: new Date().toISOString()
      };
      
      const updated = await updateBRD(newBRD, false);
      onUpdate(updated);
      setLastChangedSectionIds([sectionId]);
      
      await addActivityLog(`Section "${section.title}" regenerated`, 'AI Agent');
      setTimeout(() => setLastChangedSectionIds([]), 5000);
    } catch (error) {
      console.error("Failed to regenerate section", error);
      setGenerationError(`Failed to regenerate section: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setRegeneratingSection(null);
    }
  };
  
  const handleQuickAction = async (sectionId: string, action: typeof QUICK_ACTIONS[0]) => {
    await handleRegenerateSection(sectionId, action.prompt);
  };
  
  const handleRefineWithAI = async () => {
    if (!brd || !editPrompt.trim()) return;
    setIsAILoading(true);
    setGenerationError(null);
    
    try {
      // Determine which sections might be affected by the prompt
      const changedIds: string[] = [];
      const newSections = await Promise.all(
        brd.sections.map(async (section) => {
          // Simple heuristic: check if prompt mentions section keywords
          const promptLower = editPrompt.toLowerCase();
          const titleLower = section.title.toLowerCase();
          const shouldRefine = promptLower.includes(titleLower.split(' ')[0]) || 
                              promptLower.includes('all') ||
                              !promptLower.match(/executive|objective|stakeholder|functional|non-functional|assumption|success|timeline/i);
          
          if (shouldRefine) {
            const refined = await refineBRDSection(
              section,
              editPrompt,
              project.insights?.filter(i => i.status === 'approved') || [],
              { audience: selectedAudience, tone: selectedTone }
            );
            changedIds.push(section.id);
            return { ...section, content: refined.content, confidence: refined.confidence };
          }
          return section;
        })
      );
      
      const newBRD = {
        sections: newSections,
        generatedAt: new Date().toISOString(),
        version: brd.version + 1
      };
      
      const updated = await updateBRD(newBRD, false);
      onUpdate(updated);
      setEditPrompt('');
      setLastChangedSectionIds(changedIds);
      
      await addActivityLog(`BRD refined: "${editPrompt.slice(0, 50)}..."`, 'AI Agent');
      setTimeout(() => setLastChangedSectionIds([]), 5000);
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
    setLastChangedSectionIds([editingSectionId]);
    setTimeout(() => setLastChangedSectionIds([]), 5000);
  };
  
  const handleAnalyzeGaps = async () => {
    if (!brd) return;
    setIsAnalyzingGaps(true);
    try {
      const gaps = await analyzeGaps(
        brd.sections,
        project.insights?.filter(i => i.status === 'approved') || [],
        selectedTemplate
      );
      setGapAnalysis(gaps);
      setShowGapAnalysis(true);
    } catch (error) {
      console.error("Gap analysis failed", error);
    } finally {
      setIsAnalyzingGaps(false);
    }
  };
  
  const handleAddComment = async (sectionId: string) => {
    if (!newCommentText.trim() || !brd) return;
    const newComment: SectionComment = {
      id: `comment_${Date.now()}`,
      sectionId,
      author: 'Current User',
      text: newCommentText,
      timestamp: new Date().toISOString(),
      resolved: false,
      reactions: []
    };
    setComments(prev => [...prev, newComment]);
    setNewCommentText('');
    setCommentingSectionId(null);
    
    // Persist comment to BRD
    const updatedSections = brd.sections.map(s => 
      s.id === sectionId 
        ? { ...s, comments: [...(s.comments || []), { id: newComment.id, author: newComment.author, text: newComment.text, timestamp: newComment.timestamp, resolved: false }] }
        : s
    );
    await updateBRD({ ...brd, sections: updatedSections });
  };

  const handleEditComment = async (commentId: string) => {
    if (!editCommentText.trim() || !brd) return;
    
    // Update local state
    setComments(prev => prev.map(c => 
      c.id === commentId ? { ...c, text: editCommentText.trim() } : c
    ));
    
    // Persist to BRD
    const updatedSections = brd.sections.map(s => ({
      ...s,
      comments: (s.comments || []).map(c => 
        c.id === commentId ? { ...c, text: editCommentText.trim() } : c
      )
    }));
    await updateBRD({ ...brd, sections: updatedSections });
    
    setEditingCommentId(null);
    setEditCommentText('');
  };

  const handleDeleteComment = async (commentId: string) => {
    if (!brd) return;
    
    // Update local state
    setComments(prev => prev.filter(c => c.id !== commentId));
    
    // Persist to BRD
    const updatedSections = brd.sections.map(s => ({
      ...s,
      comments: (s.comments || []).filter(c => c.id !== commentId)
    }));
    await updateBRD({ ...brd, sections: updatedSections });
  };

  const startEditComment = (comment: SectionComment) => {
    setEditingCommentId(comment.id);
    setEditCommentText(comment.text);
  };
  
  const handleApproveSection = async (sectionId: string, status: SectionApproval['status'], notes?: string) => {
    const approvalData = { status, approvedBy: 'Current User', approvedAt: new Date().toISOString(), notes };
    setApprovals(prev => prev.map(a => 
      a.sectionId === sectionId 
        ? { ...a, ...approvalData }
        : a
    ));
    
    // Persist approval to BRD
    if (brd) {
      const updatedSections = brd.sections.map(s => 
        s.id === sectionId 
          ? { ...s, approval: approvalData }
          : s
      );
      const updated = await updateBRD({ ...brd, sections: updatedSections });
      onUpdate(updated);
    }
  };
  
  const handleApproveAll = async () => {
    if (!brd) return;
    const approvalData = { status: 'approved' as const, approvedBy: 'Current User', approvedAt: new Date().toISOString() };
    
    // Update local state
    setApprovals(prev => prev.map(a => ({ ...a, ...approvalData })));
    
    // Persist to BRD
    const updatedSections = brd.sections.map(s => ({ ...s, approval: approvalData }));
    const updated = await updateBRD({ ...brd, sections: updatedSections });
    onUpdate(updated);
  };
  
  const handleExport = async (format: string) => {
    if (!brd || isExporting) return;
    setIsExporting(true);
    setExportError(null);
    
    try {
      switch (format) {
        case 'pdf':
          await quickExportBRD(project);
          break;
        case 'word':
          await exportToWord(project);
          break;
        case 'html':
          await exportToHTML(project);
          break;
        case 'confluence':
          await exportToConfluence(project);
          break;
      }
      setShowExportModal(false);
    } catch (error) {
      console.error('Export failed:', error);
      setExportError(error instanceof Error ? error.message : 'Failed to export');
    } finally {
      setIsExporting(false);
    }
  };
  
  const handleRestoreVersion = async (version: any) => {
    if (!version) return;
    const updated = await updateBRD({
      ...version,
      version: (brd?.version || 0) + 1,
      generatedAt: new Date().toISOString()
    });
    onUpdate(updated);
    setShowHistory(false);
    await addActivityLog(`Restored BRD to version ${version.version}`, 'User');
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
      // Approve all sections when finalizing the BRD
      await handleApproveAll();
      const updated = await updateProjectStatus('Final');
      await addActivityLog('BRD finalized and all sections approved', 'User');
      onUpdate(updated);
      setShowFinalizeSuccess(true);
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
  
  const scrollToSection = (sectionId: string) => {
    const element = sectionRefs.current[sectionId];
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
      setActiveSection(sectionId);
    }
    setShowMobileMenu(false);
  };
  
  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 80) return 'emerald';
    if (confidence >= 60) return 'blue';
    if (confidence >= 40) return 'amber';
    return 'red';
  };
  
  // ========== PRE-GENERATION VIEW ==========
  if (!brd && !isGenerating) {
    const approvedInsightsCount = project.insights?.filter(i => i.status === 'approved').length || 0;
    const hasApprovedInsights = approvedInsightsCount > 0;
    
    return (
      <div className="max-w-5xl mx-auto py-12 px-4 sm:px-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
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

        <div className="text-center mb-12">
          <div className="w-24 h-24 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-[2rem] flex items-center justify-center mx-auto mb-8 text-white shadow-2xl shadow-blue-500/30">
            <FileText className="h-12 w-12" />
          </div>
          <h1 className="text-4xl sm:text-5xl font-black text-slate-900 mb-4 tracking-tight">Enterprise BRD Generator</h1>
          <p className="text-lg sm:text-xl text-slate-600 max-w-2xl mx-auto leading-relaxed">
            Generate professional, industry-standard Business Requirements Documents with AI-powered insights and full traceability.
          </p>
        </div>

        {/* Configuration Panel */}
        <div className="bg-white rounded-3xl border border-slate-200 shadow-xl shadow-slate-200/50 p-6 sm:p-8 mb-8">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-slate-900 flex items-center gap-3">
              <Settings className="h-5 w-5 text-slate-400" />
              Generation Settings
            </h2>
            <button 
              onClick={() => setShowConfigPanel(!showConfigPanel)}
              className="text-sm font-medium text-blue-600 hover:text-blue-700"
            >
              {showConfigPanel ? 'Hide Options' : 'Show Options'}
            </button>
          </div>
          
          <AnimatePresence>
            {showConfigPanel && (
              <motion.div 
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                {/* Template Selection */}
                <div className="mb-8">
                  <h3 className="text-sm font-bold text-slate-700 mb-4 uppercase tracking-wider">Document Template</h3>
                  <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
                    {TEMPLATES.map(template => (
                      <button
                        key={template.id}
                        onClick={() => setSelectedTemplate(template.id)}
                        className={`p-4 rounded-2xl border-2 text-left transition-all ${
                          selectedTemplate === template.id
                            ? 'border-blue-500 bg-blue-50 shadow-lg shadow-blue-500/10'
                            : 'border-slate-100 hover:border-slate-200 hover:bg-slate-50'
                        }`}
                      >
                        <div className={`p-2 rounded-lg w-fit mb-3 ${
                          selectedTemplate === template.id ? 'bg-blue-500 text-white' : 'bg-slate-100 text-slate-500'
                        }`}>
                          {template.icon}
                        </div>
                        <div className="font-bold text-slate-900 mb-1">{template.name}</div>
                        <div className="text-xs text-slate-500">{template.description}</div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Audience Selection */}
                <div className="mb-8">
                  <h3 className="text-sm font-bold text-slate-700 mb-4 uppercase tracking-wider">Target Audience</h3>
                  <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
                    {AUDIENCES.map(audience => (
                      <button
                        key={audience.id}
                        onClick={() => setSelectedAudience(audience.id)}
                        className={`p-4 rounded-2xl border-2 text-left transition-all ${
                          selectedAudience === audience.id
                            ? 'border-emerald-500 bg-emerald-50 shadow-lg shadow-emerald-500/10'
                            : 'border-slate-100 hover:border-slate-200 hover:bg-slate-50'
                        }`}
                      >
                        <div className={`p-2 rounded-lg w-fit mb-3 ${
                          selectedAudience === audience.id ? 'bg-emerald-500 text-white' : 'bg-slate-100 text-slate-500'
                        }`}>
                          {audience.icon}
                        </div>
                        <div className="font-bold text-slate-900 mb-1">{audience.name}</div>
                        <div className="text-xs text-slate-500">{audience.description}</div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Tone Selection */}
                <div className="mb-6">
                  <h3 className="text-sm font-bold text-slate-700 mb-4 uppercase tracking-wider">Writing Tone</h3>
                  <div className="flex flex-wrap gap-2">
                    {TONES.map(tone => (
                      <button
                        key={tone.id}
                        onClick={() => setSelectedTone(tone.id)}
                        className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                          selectedTone === tone.id
                            ? 'bg-slate-900 text-white'
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                      >
                        {tone.name}
                      </button>
                    ))}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Always visible summary */}
          {!showConfigPanel && (
            <div className="flex flex-wrap items-center gap-4 text-sm">
              <span className="px-3 py-1 bg-blue-50 text-blue-700 rounded-lg font-medium">{TEMPLATES.find(t => t.id === selectedTemplate)?.name} Template</span>
              <span className="px-3 py-1 bg-emerald-50 text-emerald-700 rounded-lg font-medium">{AUDIENCES.find(a => a.id === selectedAudience)?.name} Audience</span>
              <span className="px-3 py-1 bg-slate-100 text-slate-700 rounded-lg font-medium">{TONES.find(t => t.id === selectedTone)?.name} Tone</span>
            </div>
          )}
        </div>

        {/* Insights Summary */}
        <div className="bg-white rounded-3xl border border-slate-200 shadow-xl shadow-slate-200/50 p-6 sm:p-8 mb-8">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-slate-900 flex items-center gap-3">
              <Lightbulb className="h-5 w-5 text-amber-500" />
              Data Source Summary
            </h2>
            {onNavigateToInsights && (
              <button onClick={onNavigateToInsights} className="text-sm font-medium text-blue-600 hover:text-blue-700 flex items-center gap-1">
                View Insights <ChevronRight className="h-4 w-4" />
              </button>
            )}
          </div>
          
          <div className="grid sm:grid-cols-3 gap-6">
            <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-100">
              <div className="text-3xl font-black text-emerald-600 mb-1">{approvedInsightsCount}</div>
              <div className="text-sm font-medium text-emerald-700">Approved Insights</div>
            </div>
            <div className="p-4 bg-blue-50 rounded-2xl border border-blue-100">
              <div className="text-3xl font-black text-blue-600 mb-1">{project.sources?.length || 0}</div>
              <div className="text-sm font-medium text-blue-700">Connected Sources</div>
            </div>
            <div className="p-4 bg-purple-50 rounded-2xl border border-purple-100">
              <div className="text-3xl font-black text-purple-600 mb-1">{project.overallConfidence || 0}%</div>
              <div className="text-sm font-medium text-purple-700">Confidence Score</div>
            </div>
          </div>

          {!hasApprovedInsights && (
            <div className="mt-6 p-4 bg-amber-50 border border-amber-200 rounded-2xl flex items-center gap-3 text-amber-700">
              <AlertTriangle className="h-5 w-5 shrink-0" />
              <div>
                <span className="font-medium">No approved insights yet.</span>
                <span className="ml-1 text-amber-600">Review your insights first for better BRD quality.</span>
              </div>
            </div>
          )}
        </div>

        {/* Feature Cards */}
        <div className="grid sm:grid-cols-3 gap-4 mb-10">
          <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
            <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg w-fit mb-4">
              <CheckCircle2 className="h-5 w-5" />
            </div>
            <h3 className="font-bold text-slate-900 mb-2">Full Traceability</h3>
            <p className="text-sm text-slate-500">Every requirement links back to source insights with confidence scores.</p>
          </div>
          <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
            <div className="p-2 bg-blue-50 text-blue-600 rounded-lg w-fit mb-4">
              <GitCompare className="h-5 w-5" />
            </div>
            <h3 className="font-bold text-slate-900 mb-2">Version Control</h3>
            <p className="text-sm text-slate-500">Compare versions, track changes, and restore previous states.</p>
          </div>
          <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
            <div className="p-2 bg-purple-50 text-purple-600 rounded-lg w-fit mb-4">
              <MessageCircle className="h-5 w-5" />
            </div>
            <h3 className="font-bold text-slate-900 mb-2">Collaboration</h3>
            <p className="text-sm text-slate-500">Comment, approve sections, and collaborate with stakeholders.</p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          {!hasApprovedInsights && onNavigateToInsights && (
            <Button 
              variant="outline"
              size="lg"
              onClick={onNavigateToInsights}
              className="h-14 px-8 text-base font-bold rounded-2xl border-slate-200 w-full sm:w-auto"
            >
              Review Insights First
            </Button>
          )}
          <Button 
            size="lg" 
            onClick={handleGenerate}
            className="h-14 px-10 text-lg font-bold rounded-2xl shadow-2xl shadow-blue-500/30 w-full sm:w-auto"
          >
            Generate BRD <Sparkles className="ml-3 h-5 w-5" />
          </Button>
        </div>
        
        <p className="text-center text-xs text-slate-400 mt-4">
          Press <kbd className="px-1.5 py-0.5 bg-slate-100 rounded text-slate-500 font-mono">Ctrl</kbd> + <kbd className="px-1.5 py-0.5 bg-slate-100 rounded text-slate-500 font-mono">G</kbd> to generate
        </p>
      </div>
    );
  }

  // ========== GENERATING VIEW ==========
  if (isGenerating) {
    return (
      <div className="max-w-4xl mx-auto py-24 sm:py-32 px-4 text-center animate-in fade-in duration-500">
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
        
        <h2 className="text-3xl font-black text-slate-900 mb-4">Generating Your BRD...</h2>
        
        {generationProgress && (
          <div className="max-w-md mx-auto mb-8">
            <div className="flex items-center justify-between text-sm text-slate-500 mb-2">
              <span>Section {generationProgress.current} of {generationProgress.total}</span>
              <span>{Math.round((generationProgress.current / generationProgress.total) * 100)}%</span>
            </div>
            <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
              <motion.div 
                className="h-full bg-gradient-to-r from-blue-500 to-indigo-500"
                initial={{ width: 0 }}
                animate={{ width: `${(generationProgress.current / generationProgress.total) * 100}%` }}
                transition={{ duration: 0.3 }}
              />
            </div>
            <p className="mt-3 text-slate-600 font-medium">{generationProgress.section}</p>
          </div>
        )}
        
        <div className="bg-slate-50 rounded-2xl p-6 max-w-md mx-auto">
          <p className="text-sm text-slate-600 mb-4">
            Creating a <span className="font-bold text-slate-900">{TEMPLATES.find(t => t.id === selectedTemplate)?.name}</span> document 
            for <span className="font-bold text-slate-900">{AUDIENCES.find(a => a.id === selectedAudience)?.name}</span> audience
          </p>
          <div className="flex items-center justify-center gap-2 text-slate-400">
            <div className="w-2 h-2 bg-blue-600 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
            <div className="w-2 h-2 bg-blue-600 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
            <div className="w-2 h-2 bg-blue-600 rounded-full animate-bounce"></div>
          </div>
        </div>
      </div>
    );
  }

  // ========== MAIN DOCUMENT VIEW ==========
  return (
    <div className="h-[calc(100vh-80px)] flex flex-col animate-in fade-in duration-500 print:block print:h-auto">
      {/* Error Toast */}
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

      {/* Mobile Menu Buttons */}
      <div className="lg:hidden fixed top-4 left-4 right-4 z-40 flex justify-between print:hidden">
        <button
          onClick={() => setShowMobileMenu(true)}
          className="p-2 bg-white rounded-xl shadow-lg border border-slate-200"
        >
          <Menu className="h-5 w-5 text-slate-600" />
        </button>
        <button
          onClick={() => setShowMobileSidebar(true)}
          className="p-2 bg-white rounded-xl shadow-lg border border-slate-200 flex items-center gap-2"
        >
          <Settings className="h-5 w-5 text-slate-600" />
          {comments.filter(c => !c.resolved).length > 0 && (
            <span className="w-5 h-5 rounded-full bg-amber-500 text-white text-[10px] font-bold flex items-center justify-center">
              {comments.filter(c => !c.resolved).length}
            </span>
          )}
        </button>
      </div>

      {/* Mobile Drawer */}
      <AnimatePresence>
        {showMobileMenu && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowMobileMenu(false)}
              className="lg:hidden fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm print:hidden"
            />
            <motion.div
              initial={{ x: -300 }}
              animate={{ x: 0 }}
              exit={{ x: -300 }}
              transition={{ type: 'spring', damping: 30, stiffness: 300 }}
              className="lg:hidden fixed left-0 top-0 bottom-0 w-80 z-50 bg-white shadow-2xl overflow-y-auto print:hidden hide-scrollbar"
            >
              <div className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="font-bold text-slate-900">Table of Contents</h2>
                  <button onClick={() => setShowMobileMenu(false)} className="p-2 hover:bg-slate-100 rounded-lg">
                    <X className="h-5 w-5 text-slate-400" />
                  </button>
                </div>
                <nav className="space-y-2">
                  {brd?.sections.map((section, i) => {
                    const conf = confidenceMap[section.id] || 0;
                    const confColor = getConfidenceColor(conf);
                    return (
                      <button
                        key={section.id}
                        onClick={() => scrollToSection(section.id)}
                        className={`w-full text-left px-4 py-3 rounded-xl text-sm font-medium transition-all flex items-center justify-between ${
                          activeSection === section.id 
                            ? 'bg-blue-50 text-blue-700' 
                            : 'text-slate-600 hover:bg-slate-50'
                        }`}
                      >
                        <span className="flex items-center gap-3">
                          <span className="w-6 h-6 rounded-lg bg-slate-100 flex items-center justify-center text-xs font-bold text-slate-500">{i + 1}</span>
                          <span className="truncate">{section.title}</span>
                        </span>
                        <span className={`w-2 h-2 rounded-full bg-${confColor}-400`}></span>
                      </button>
                    );
                  })}
                </nav>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Mobile Right Sidebar Drawer */}
      <AnimatePresence>
        {showMobileSidebar && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowMobileSidebar(false)}
              className="lg:hidden fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm print:hidden"
            />
            <motion.div
              initial={{ x: 300 }}
              animate={{ x: 0 }}
              exit={{ x: 300 }}
              transition={{ type: 'spring', damping: 30, stiffness: 300 }}
              className="lg:hidden fixed right-0 top-0 bottom-0 w-80 z-50 bg-white shadow-2xl flex flex-col print:hidden"
            >
              {/* Mobile Sidebar Header */}
              <div className="p-4 border-b border-slate-100 bg-slate-50/50 shrink-0">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="font-bold text-slate-900 text-sm">{viewMode === 'comments' ? 'Comments' : 'Document Controls'}</h2>
                  <button onClick={() => setShowMobileSidebar(false)} className="p-1.5 hover:bg-slate-200 rounded-lg text-slate-400">
                    <X className="h-4 w-4" />
                  </button>
                </div>
                {/* Quick Stats */}
                {viewMode !== 'comments' ? (
                  <div className="grid grid-cols-2 gap-2">
                    <div className="p-2.5 bg-white rounded-xl border border-slate-100 text-center">
                      <div className="text-xl font-bold text-slate-900">{brd?.sections.length || 0}</div>
                      <div className="text-[10px] text-slate-500 uppercase font-medium">Sections</div>
                    </div>
                    <div className="p-2.5 bg-emerald-50 rounded-xl border border-emerald-100 text-center">
                      <div className="text-xl font-bold text-emerald-600">{overallCompletion}%</div>
                      <div className="text-[10px] text-emerald-600 uppercase font-medium">Approved</div>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-2">
                    <div className="p-2.5 bg-amber-50 rounded-xl border border-amber-100 text-center">
                      <div className="text-xl font-bold text-amber-600">{comments.filter(c => !c.resolved).length}</div>
                      <div className="text-[10px] text-amber-600 uppercase font-medium">Open</div>
                    </div>
                    <div className="p-2.5 bg-emerald-50 rounded-xl border border-emerald-100 text-center">
                      <div className="text-xl font-bold text-emerald-600">{comments.filter(c => c.resolved).length}</div>
                      <div className="text-[10px] text-emerald-600 uppercase font-medium">Resolved</div>
                    </div>
                  </div>
                )}
              </div>

              {/* Mobile View Mode Toggle */}
              <div className="p-4 border-b border-slate-100 shrink-0">
                <div className="flex gap-1">
                  <button 
                    onClick={() => handleSetViewMode('document')}
                    className={`flex-1 px-3 py-2 rounded-lg text-xs font-medium transition-all flex items-center justify-center gap-1.5 ${viewMode === 'document' ? 'bg-blue-50 text-blue-700' : 'text-slate-500 hover:bg-slate-50'}`}
                  >
                    <FileText className="h-3.5 w-3.5" /> Doc
                  </button>
                  <button 
                    onClick={() => handleSetViewMode('compare')}
                    className={`flex-1 px-3 py-2 rounded-lg text-xs font-medium transition-all flex items-center justify-center gap-1.5 ${viewMode === 'compare' ? 'bg-blue-50 text-blue-700' : 'text-slate-500 hover:bg-slate-50'}`}
                  >
                    <GitCompare className="h-3.5 w-3.5" /> Compare
                  </button>
                  <button 
                    onClick={() => handleSetViewMode('comments')}
                    className={`flex-1 px-3 py-2 rounded-lg text-xs font-medium transition-all flex items-center justify-center gap-1.5 ${viewMode === 'comments' ? 'bg-blue-50 text-blue-700' : 'text-slate-500 hover:bg-slate-50'}`}
                  >
                    <MessageCircle className="h-3.5 w-3.5" />
                    {comments.filter(c => !c.resolved).length > 0 && (
                      <span className="w-4 h-4 rounded-full bg-amber-500 text-white text-[9px] flex items-center justify-center">
                        {comments.filter(c => !c.resolved).length}
                      </span>
                    )}
                  </button>
                </div>
              </div>

              {/* Mobile Scrollable Content */}
              <div className="flex-1 overflow-y-auto p-4 hide-scrollbar">
                {viewMode === 'comments' ? (
                  /* Comments Panel */
                  <div className="space-y-3">
                    {comments.length === 0 ? (
                      <div className="text-center py-8">
                        <MessageCircle className="h-10 w-10 text-slate-200 mx-auto mb-3" />
                        <p className="text-sm text-slate-500 font-medium">No comments yet</p>
                      </div>
                    ) : (
                      <>
                        {comments.filter(c => !c.resolved).map(comment => {
                          const section = brd?.sections.find(s => s.id === comment.sectionId);
                          const isEditing = editingCommentId === comment.id;
                          return (
                            <div 
                              key={comment.id} 
                              className="p-3 bg-amber-50 rounded-xl border border-amber-100"
                            >
                              <div className="flex items-center gap-2 mb-2">
                                <div className="w-6 h-6 rounded-full bg-amber-500 text-white text-[10px] font-bold flex items-center justify-center">
                                  {comment.author.charAt(0)}
                                </div>
                                <span className="text-xs font-medium text-slate-700">{comment.author}</span>
                                <div className="ml-auto flex items-center gap-1">
                                  <button
                                    onClick={(e) => { e.stopPropagation(); startEditComment(comment); }}
                                    className="p-1 hover:bg-amber-100 rounded text-slate-400 hover:text-slate-600"
                                    title="Edit"
                                  >
                                    <Edit3 className="h-3 w-3" />
                                  </button>
                                  <button
                                    onClick={(e) => { e.stopPropagation(); handleDeleteComment(comment.id); }}
                                    className="p-1 hover:bg-red-100 rounded text-slate-400 hover:text-red-500"
                                    title="Delete"
                                  >
                                    <Trash2 className="h-3 w-3" />
                                  </button>
                                </div>
                              </div>
                              {isEditing ? (
                                <div className="space-y-2">
                                  <textarea
                                    value={editCommentText}
                                    onChange={(e) => setEditCommentText(e.target.value)}
                                    className="w-full p-2 text-sm border border-amber-200 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-amber-400"
                                    rows={2}
                                    autoFocus
                                  />
                                  <div className="flex gap-2">
                                    <button
                                      onClick={() => handleEditComment(comment.id)}
                                      className="px-2 py-1 text-[10px] bg-amber-500 text-white rounded font-medium hover:bg-amber-600"
                                    >
                                      Save
                                    </button>
                                    <button
                                      onClick={() => { setEditingCommentId(null); setEditCommentText(''); }}
                                      className="px-2 py-1 text-[10px] text-slate-500 hover:text-slate-700"
                                    >
                                      Cancel
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                <>
                                  <p 
                                    className="text-sm text-slate-600 mb-2 cursor-pointer hover:text-slate-800"
                                    onClick={() => { scrollToSection(comment.sectionId); setShowMobileSidebar(false); }}
                                  >
                                    {comment.text}
                                  </p>
                                  <div className="flex items-center justify-between">
                                    <span className="text-[10px] text-slate-400 bg-slate-100 px-2 py-0.5 rounded">{section?.title || 'Unknown'}</span>
                                    <button 
                                      onClick={(e) => { e.stopPropagation(); setComments(prev => prev.map(c => c.id === comment.id ? { ...c, resolved: true } : c)); }}
                                      className="text-[10px] text-emerald-600 font-medium"
                                    >
                                      Resolve
                                    </button>
                                  </div>
                                </>
                              )}
                            </div>
                          );
                        })}
                      </>
                    )}
                  </div>
                ) : (
                  /* Quick Actions + TOC */
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-2">
                      <button onClick={() => { setShowExportModal(true); setShowMobileSidebar(false); }} className="p-3 bg-slate-50 hover:bg-slate-100 rounded-xl text-slate-600 transition-colors flex flex-col items-center gap-1.5">
                        <Download className="h-4 w-4" />
                        <span className="text-[10px] font-medium">Export</span>
                      </button>
                      <button onClick={() => { setShowShareModal(true); setShowMobileSidebar(false); }} className="p-3 bg-slate-50 hover:bg-slate-100 rounded-xl text-slate-600 transition-colors flex flex-col items-center gap-1.5">
                        <Share2 className="h-4 w-4" />
                        <span className="text-[10px] font-medium">Share</span>
                      </button>
                    </div>
                    <nav className="space-y-1">
                      {brd?.sections.map((section, i) => {
                        const approval = approvals.find(a => a.sectionId === section.id);
                        return (
                          <button
                            key={section.id}
                            onClick={() => { scrollToSection(section.id); setShowMobileSidebar(false); }}
                            className={`w-full text-left px-3 py-2 rounded-lg text-xs transition-all ${
                              activeSection === section.id ? 'bg-blue-50 text-blue-700 font-medium' : 'text-slate-600 hover:bg-slate-50'
                            }`}
                          >
                            <div className="flex items-center gap-2">
                              <span className="w-5 h-5 rounded-md bg-slate-100 flex items-center justify-center text-[10px] font-bold text-slate-500">{i + 1}</span>
                              <span className="truncate flex-1">{section.title}</span>
                              {approval?.status === 'approved' && <CheckCircle2 className="h-3 w-3 text-emerald-500 shrink-0" />}
                            </div>
                          </button>
                        );
                      })}
                    </nav>
                  </div>
                )}
              </div>

              {/* Mobile Footer */}
              <div className="p-4 border-t border-slate-100 bg-slate-50/50 shrink-0">
                {overallCompletion < 100 && (
                  <Button
                    variant="outline"
                    onClick={() => { handleApproveAll(); setShowMobileSidebar(false); }}
                    className="w-full rounded-xl text-xs border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                  >
                    <CheckCircle2 className="h-3.5 w-3.5 mr-2" />
                    Approve All
                  </Button>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Main Content Area - Two Column Layout: BRD Hero Left, Controls Right */}
      <div className="flex-1 flex overflow-hidden print:block">
        {/* LEFT: BRD Document Viewer (Hero - Maximum Space) */}
        <main className="flex-1 flex flex-col min-w-0 overflow-hidden print:overflow-visible">
          {/* Minimal Header Bar */}
          <header className="bg-white border-b border-slate-100 px-6 py-3 print:hidden shrink-0">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-900 text-white text-xs font-bold">
                  <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" /> v{brd?.version}
                </span>
                <h1 className="text-xl font-bold text-slate-900">{project.name}</h1>
              </div>
              
              {/* Centered AI Refine Input */}
              <div className="flex-1 max-w-2xl mx-4">
                <div className="flex items-center gap-2 p-1.5 bg-slate-50 rounded-xl border border-slate-200 focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-blue-500 transition-all">
                  <Sparkles className="h-4 w-4 text-blue-500 ml-3" />
                  <input
                    type="text"
                    value={editPrompt}
                    onChange={(e) => setEditPrompt(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleRefineWithAI()}
                    placeholder="Ask AI to refine the document..."
                    className="flex-1 py-1.5 px-2 bg-transparent text-sm outline-none placeholder-slate-400"
                  />
                  <button
                    onClick={handleRefineWithAI}
                    disabled={!editPrompt.trim() || isAILoading}
                    className="p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isAILoading ? <Loader className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              
              {/* Finalize Action */}
              {showFinalizeSuccess ? (
                <div className="px-4 py-2 bg-emerald-50 text-emerald-600 rounded-xl flex items-center gap-2 font-semibold animate-in zoom-in">
                  <BadgeCheck className="h-5 w-5" />
                  Finalized!
                </div>
              ) : project.status === 'Final' ? (
                <div className="px-4 py-2 bg-emerald-50 text-emerald-700 rounded-xl flex items-center gap-2 text-sm font-medium">
                  <BadgeCheck className="h-4 w-4" />
                  Approved
                </div>
              ) : (
                <Button
                  onClick={handleFinalize}
                  disabled={isFinalizing}
                  className="rounded-xl shadow-lg shadow-blue-500/25 px-5"
                >
                  {isFinalizing ? (
                    <Loader className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      <CheckCircle2 className="h-4 w-4 mr-2" />
                      Finalize BRD
                    </>
                  )}
                </Button>
              )}
            </div>
            
            {/* New Insights Banner */}
            {hasNewInsights && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className="mt-3 p-2.5 bg-amber-50 border border-amber-200 rounded-xl flex items-center justify-between"
              >
                <div className="flex items-center gap-2 text-amber-700 text-sm">
                  <RefreshCw className="h-4 w-4" />
                  <span className="font-medium">New insights available since last generation.</span>
                </div>
                <Button variant="outline" size="sm" onClick={handleGenerate} className="border-amber-300 text-amber-700 hover:bg-amber-100 text-xs h-7">
                  Regenerate
                </Button>
              </motion.div>
            )}
          </header>

          {/* BRD Document Content - Full Width Hero */}
          <div className="flex-1 overflow-y-auto bg-slate-50 print:overflow-visible print:bg-white" ref={documentRef}>
            {/* Compare Mode Global Header */}
            {viewMode === 'compare' && (
              <div className="sticky top-0 z-10 bg-white border-b border-slate-200 px-6 lg:px-12 xl:px-20 py-4 shadow-sm">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <GitCompare className="h-5 w-5 text-blue-600" />
                    <span className="font-bold text-slate-900">Compare Versions</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm text-slate-500">Compare current (v{brd?.version}) with:</span>
                    <select 
                      value={compareVersion || ''}
                      onChange={(e) => setCompareVersion(e.target.value ? Number(e.target.value) : null)}
                      className="text-sm bg-white border border-slate-200 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500 min-w-[200px]"
                    >
                      <option value="">Select version to compare...</option>
                      {project.brdHistory?.map((v) => (
                        <option key={v.version} value={v.version}>Version {v.version} ({new Date(v.generatedAt).toLocaleDateString()})</option>
                      ))}
                    </select>
                    {compareVersion && (
                      <div className="flex items-center gap-4 ml-4 text-xs">
                        <span className="flex items-center gap-1.5 text-red-600"><span className="w-3 h-3 rounded bg-red-100 border border-red-200"></span> v{compareVersion} (old)</span>
                        <span className="flex items-center gap-1.5 text-emerald-600"><span className="w-3 h-3 rounded bg-emerald-100 border border-emerald-200"></span> v{brd?.version} (current)</span>
                      </div>
                    )}
                  </div>
                </div>
                {!project.brdHistory?.length && (
                  <div className="mt-3 p-3 bg-slate-50 rounded-lg text-center">
                    <p className="text-sm text-slate-500">No previous versions available. Regenerate the BRD to create version history.</p>
                  </div>
                )}
              </div>
            )}
            
            <div className="max-w-none px-6 lg:px-12 xl:px-20 py-8 print:max-w-none print:p-0">
              {/* Print Header */}
              <div className="hidden print:block mb-10 border-b-2 border-slate-900 pb-8">
                <h1 className="text-4xl font-bold mb-2">Business Requirements Document</h1>
                <p className="text-lg text-slate-600">Project: {project.name}</p>
                <p className="text-sm text-slate-400">Version {brd?.version}.0 • Generated on {new Date(brd!.generatedAt).toLocaleString()}</p>
              </div>

              {/* BRD Sections */}
              <div className="space-y-6 print:space-y-12">
                {brd?.sections.map((section, index) => {
                  const conf = confidenceMap[section.id] || 0;
                  const confColor = getConfidenceColor(conf);
                  const approval = approvals.find(a => a.sectionId === section.id);
                  const sectionComments = comments.filter(c => c.sectionId === section.id);
                  const isRegenerating = regeneratingSection === section.id;
                  const isChanged = lastChangedSectionIds.includes(section.id);
                  
                  return (
                    <motion.section
                      key={section.id}
                      id={`section-${section.id}`}
                      ref={el => { sectionRefs.current[section.id] = el; }}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.05 }}
                      className={`bg-white rounded-2xl shadow-lg shadow-slate-200/50 border overflow-hidden transition-all duration-500 print:shadow-none print:border-none print:rounded-none ${
                        isChanged 
                          ? 'border-blue-300 ring-2 ring-blue-200 shadow-blue-500/10' 
                          : 'border-slate-100'
                      }`}
                    >
                      {/* Section Header */}
                      <div className="p-4 sm:p-6 border-b border-slate-100 print:border-slate-300">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex items-start gap-3 sm:gap-4 flex-1 min-w-0">
                            <div className={`w-8 h-8 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center text-white font-bold text-sm shrink-0 ${
                              approval?.status === 'approved' ? 'bg-emerald-500' : 'bg-slate-900'
                            }`}>
                              {index + 1}
                            </div>
                            <div className="flex-1 min-w-0">
                              <h2 className="text-lg sm:text-xl font-bold text-slate-900 pr-4">
                                {section.title}
                                {isChanged && (
                                  <span className="ml-2 text-[10px] font-bold text-blue-600 bg-blue-100 px-2 py-0.5 rounded-full uppercase tracking-wider animate-pulse">
                                    Updated
                                  </span>
                                )}
                              </h2>
                              <div className="flex flex-wrap items-center gap-2 sm:gap-3 mt-2">
                                {/* Confidence Badge */}
                                <Tooltip content={`${conf}% confidence based on source quality`}>
                                  <div className={`flex items-center gap-1.5 px-2 py-1 bg-${confColor}-50 text-${confColor}-700 rounded-lg text-xs font-medium`}>
                                    <div className={`w-8 h-1.5 bg-${confColor}-200 rounded-full overflow-hidden`}>
                                      <div className={`h-full bg-${confColor}-500 rounded-full`} style={{ width: `${conf}%` }} />
                                    </div>
                                    <span>{conf}%</span>
                                  </div>
                                </Tooltip>
                                
                                {/* Sources count */}
                                <span className="text-xs text-slate-400 font-medium flex items-center gap-1">
                                  {section.sources.length > 0 ? (
                                    <><Database className="h-3 w-3" /> {section.sources.length} sources</>
                                  ) : (
                                    <><Sparkles className="h-3 w-3" /> AI Generated</>
                                  )}
                                </span>
                                
                                {/* Comments indicator */}
                                {sectionComments.length > 0 && (
                                  <span className="text-xs text-amber-600 font-medium flex items-center gap-1">
                                    <MessageCircle className="h-3 w-3" /> {sectionComments.length}
                                  </span>
                                )}
                                
                                {/* Approval status */}
                                {approval?.status === 'approved' && (
                                  <span className="text-xs text-emerald-600 font-medium flex items-center gap-1">
                                    <CheckCircle2 className="h-3 w-3" /> Approved
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                          
                          {/* Section Actions */}
                          <div className="flex items-center gap-1 shrink-0 print:hidden">
                            {isRegenerating ? (
                              <div className="px-3 py-2 text-blue-600">
                                <Loader className="h-4 w-4 animate-spin" />
                              </div>
                            ) : (
                              <>
                                {/* Quick Actions Dropdown */}
                                <div className="relative group">
                                  <button className="p-2 hover:bg-slate-100 rounded-lg text-slate-400 transition-colors">
                                    <Sparkles className="h-4 w-4" />
                                  </button>
                                  <div className="absolute right-0 top-full mt-1 w-48 bg-white rounded-xl shadow-xl border border-slate-100 py-1 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-20">
                                    <div className="px-3 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Quick Actions</div>
                                    {QUICK_ACTIONS.map(action => (
                                      <button
                                        key={action.id}
                                        onClick={() => handleQuickAction(section.id, action)}
                                        className="w-full text-left px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
                                      >
                                        {action.label}
                                      </button>
                                    ))}
                                    <div className="border-t border-slate-100 mt-1 pt-1">
                                      <button
                                        onClick={() => handleRegenerateSection(section.id)}
                                        className="w-full text-left px-3 py-2 text-sm text-blue-600 hover:bg-blue-50 transition-colors flex items-center gap-2"
                                      >
                                        <RefreshCw className="h-3.5 w-3.5" /> Regenerate Section
                                      </button>
                                    </div>
                                  </div>
                                </div>
                                
                                {section.sources.length > 0 && (
                                  <Tooltip content="View Sources">
                                    <button 
                                      onClick={() => setShowExplainability(showExplainability === section.id ? null : section.id)}
                                      className={`p-2 rounded-lg transition-colors ${showExplainability === section.id ? 'bg-blue-50 text-blue-600' : 'text-slate-400 hover:bg-slate-100'}`}
                                    >
                                      <Eye className="h-4 w-4" />
                                    </button>
                                  </Tooltip>
                                )}
                                
                                <Tooltip content="Edit">
                                  <button 
                                    onClick={() => handleManualEdit(section)}
                                    className="p-2 text-slate-400 hover:bg-slate-100 rounded-lg transition-colors"
                                  >
                                    <Edit3 className="h-4 w-4" />
                                  </button>
                                </Tooltip>
                                
                                <Tooltip content="Comment">
                                  <button 
                                    onClick={() => setCommentingSectionId(commentingSectionId === section.id ? null : section.id)}
                                    className={`p-2 rounded-lg transition-colors ${commentingSectionId === section.id ? 'bg-amber-50 text-amber-600' : 'text-slate-400 hover:bg-slate-100'}`}
                                  >
                                    <MessageSquare className="h-4 w-4" />
                                  </button>
                                </Tooltip>
                                
                                <button 
                                  onClick={() => toggleSection(section.id)}
                                  className="p-2 text-slate-400 hover:bg-slate-100 rounded-lg transition-colors"
                                >
                                  {expandedSections.includes(section.id) ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                                </button>
                              </>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Section Content */}
                      <AnimatePresence initial={false}>
                        {expandedSections.includes(section.id) && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className="overflow-hidden"
                          >
                            <div className="p-4 sm:p-6 lg:p-8">
                              {editingSectionId === section.id ? (
                                <div className="space-y-4 animate-in fade-in duration-300">
                                  <textarea 
                                    value={editContent}
                                    onChange={(e) => setEditContent(e.target.value)}
                                    className="w-full h-72 p-4 bg-slate-50 border border-slate-200 rounded-2xl text-slate-700 font-mono text-sm outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all resize-y"
                                    placeholder="Enter markdown content..."
                                  />
                                  <div className="flex justify-end gap-3">
                                    <Button variant="ghost" onClick={() => setEditingSectionId(null)} className="rounded-xl">
                                      Cancel
                                    </Button>
                                    <Button onClick={saveManualEdit} className="rounded-xl px-6">
                                      <Save className="h-4 w-4 mr-2" /> Save Changes
                                    </Button>
                                  </div>
                                </div>
                              ) : viewMode === 'compare' && compareVersion && project.brdHistory ? (
                                <div className="grid grid-cols-2 gap-4">
                                  {/* Previous Version */}
                                  <div className="p-4 bg-red-50 rounded-xl border border-red-200">
                                    <div className="flex items-center gap-2 mb-3 text-red-700">
                                      <History className="h-4 w-4" />
                                      <span className="text-xs font-bold uppercase">Version {compareVersion}</span>
                                    </div>
                                    <div className="prose prose-sm prose-slate max-w-none">
                                      <Markdown remarkPlugins={[remarkGfm]}>
                                        {project.brdHistory?.find(v => v.version === compareVersion)?.sections[index]?.content || '*Section not found in this version*'}
                                      </Markdown>
                                    </div>
                                  </div>
                                  {/* Current Version */}
                                  <div className="p-4 bg-emerald-50 rounded-xl border border-emerald-200">
                                    <div className="flex items-center gap-2 mb-3 text-emerald-700">
                                      <CheckCircle2 className="h-4 w-4" />
                                      <span className="text-xs font-bold uppercase">Current (v{brd?.version})</span>
                                    </div>
                                    <div className="prose prose-sm prose-slate max-w-none">
                                      <Markdown remarkPlugins={[remarkGfm]}>{section.content}</Markdown>
                                    </div>
                                  </div>
                                </div>
                              ) : (
                                <div className="prose prose-slate max-w-none prose-headings:text-slate-900 prose-headings:font-bold prose-p:text-slate-600 prose-p:leading-relaxed prose-strong:text-slate-900 prose-ul:text-slate-600 prose-li:marker:text-slate-400 prose-table:w-full prose-th:bg-slate-100 prose-th:border prose-th:border-slate-200 prose-th:px-4 prose-th:py-2 prose-th:text-left prose-th:font-semibold prose-th:text-slate-700 prose-td:border prose-td:border-slate-200 prose-td:px-4 prose-td:py-2 prose-td:text-slate-600">
                                  <Markdown remarkPlugins={[remarkGfm]}>{section.content}</Markdown>
                                </div>
                              )}
                              
                              {/* Source Traceability Panel */}
                              <AnimatePresence>
                                {showExplainability === section.id && (
                                  <motion.div 
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: 10 }}
                                    className="mt-6 p-5 bg-slate-50 rounded-2xl border border-slate-100 print:hidden"
                                  >
                                    <div className="flex items-center justify-between mb-4">
                                      <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2">
                                        <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" /> Source Traceability
                                      </h4>
                                      <div className={`px-2 py-1 bg-${confColor}-100 text-${confColor}-700 rounded-lg text-xs font-bold`}>
                                        {conf}% Confidence
                                      </div>
                                    </div>
                                    {section.sources.length > 0 ? (
                                      <>
                                        <p className="text-sm text-slate-500 mb-4">This section was synthesized from the following verified sources:</p>
                                        <div className="flex flex-wrap gap-2">
                                          {section.sources.map((source, i) => (
                                            <SourceBadge key={i} sourceName={source} />
                                          ))}
                                        </div>
                                      </>
                                    ) : (
                                      <div className="flex items-center gap-3 p-4 bg-blue-50 rounded-xl">
                                        <Sparkles className="h-5 w-5 text-blue-500" />
                                        <div>
                                          <p className="text-sm font-medium text-blue-700">AI Generated Content</p>
                                          <p className="text-xs text-blue-600">This section was generated by AI based on project context and approved insights.</p>
                                        </div>
                                      </div>
                                    )}
                                  </motion.div>
                                )}
                              </AnimatePresence>
                              
                              {/* Comment Input */}
                              <AnimatePresence>
                                {commentingSectionId === section.id && (
                                  <motion.div
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: 10 }}
                                    className="mt-6 p-5 bg-amber-50 rounded-2xl border border-amber-100 print:hidden"
                                  >
                                    <div className="flex items-center gap-2 mb-3 text-amber-700">
                                      <MessageSquare className="h-4 w-4" />
                                      <span className="text-xs font-bold uppercase tracking-wider">Add Comment</span>
                                    </div>
                                    <div className="flex gap-3">
                                      <textarea
                                        value={newCommentText}
                                        onChange={(e) => setNewCommentText(e.target.value)}
                                        placeholder="Add a comment or feedback..."
                                        className="flex-1 p-3 bg-white border border-amber-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-amber-500 resize-none"
                                        rows={2}
                                      />
                                      <Button 
                                        onClick={() => handleAddComment(section.id)}
                                        disabled={!newCommentText.trim()}
                                        className="px-4 bg-amber-600 hover:bg-amber-700"
                                      >
                                        <Send className="h-4 w-4" />
                                      </Button>
                                    </div>
                                  </motion.div>
                                )}
                              </AnimatePresence>
                              
                              {/* Inline comment indicator - click to view in sidebar */}
                              {sectionComments.filter(c => !c.resolved).length > 0 && viewMode !== 'comments' && (
                                <div 
                                  className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-center justify-between cursor-pointer hover:bg-amber-100 transition-colors print:hidden"
                                  onClick={() => handleSetViewMode('comments')}
                                >
                                  <div className="flex items-center gap-2 text-amber-700">
                                    <MessageCircle className="h-4 w-4" />
                                    <span className="text-sm font-medium">{sectionComments.filter(c => !c.resolved).length} open comment{sectionComments.filter(c => !c.resolved).length > 1 ? 's' : ''}</span>
                                  </div>
                                  <span className="text-xs text-amber-600">View in sidebar →</span>
                                </div>
                              )}
                              
                              {/* Approval Actions - Only show if not approved */}
                              {approval?.status === 'approved' ? (
                                <div className="mt-6 pt-6 border-t border-slate-100 print:hidden">
                                  <div className="flex items-center gap-2 text-emerald-600">
                                    <CheckCircle2 className="h-4 w-4" />
                                    <span className="text-sm font-medium">Approved by {approval.approvedBy}</span>
                                    <span className="text-xs text-slate-400 ml-2">{new Date(approval.approvedAt!).toLocaleDateString()}</span>
                                  </div>
                                </div>
                              ) : (
                                <div className="mt-6 pt-6 border-t border-slate-100 flex items-center justify-between print:hidden">
                                  <div className="text-xs text-slate-400">
                                    This section needs review and approval
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() => handleApproveSection(section.id, 'needs-revision')}
                                      className="text-xs border-amber-200 text-amber-600 hover:bg-amber-50"
                                    >
                                      <AlertCircle className="h-3.5 w-3.5 mr-1" /> Needs Revision
                                    </Button>
                                    <Button
                                      size="sm"
                                      onClick={() => handleApproveSection(section.id, 'approved')}
                                      className="text-xs bg-emerald-600 hover:bg-emerald-700"
                                    >
                                      <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Approve
                                    </Button>
                                  </div>
                                </div>
                              )}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </motion.section>
                  );
                })}
              </div>
            </div>
          </div>
        </main>

        {/* RIGHT: Controls Sidebar */}
        <aside className={`hidden lg:flex flex-col w-72 xl:w-80 bg-white border-l border-slate-100 print:hidden transition-all ${!showTOC ? 'lg:hidden' : ''}`}>
          <style>{`
            .hide-scrollbar::-webkit-scrollbar { display: none; }
            .hide-scrollbar { scrollbar-width: none; -ms-overflow-style: none; }
          `}</style>
          {/* Sidebar Header */}
          <div className="p-4 border-b border-slate-100 bg-slate-50/50">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-bold text-slate-900 text-sm">{viewMode === 'comments' ? 'Comments' : 'Document Controls'}</h2>
              <button onClick={() => handleSetShowTOC(false)} className="p-1.5 hover:bg-slate-200 rounded-lg text-slate-400">
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
            {/* Quick Stats - hidden in comments mode */}
            {viewMode !== 'comments' && (
              <div className="grid grid-cols-2 gap-2">
                <div className="p-2.5 bg-white rounded-xl border border-slate-100 text-center">
                  <div className="text-xl font-bold text-slate-900">{brd?.sections.length || 0}</div>
                  <div className="text-[10px] text-slate-500 uppercase font-medium">Sections</div>
                </div>
                <div className="p-2.5 bg-emerald-50 rounded-xl border border-emerald-100 text-center">
                  <div className="text-xl font-bold text-emerald-600">{overallCompletion}%</div>
                  <div className="text-[10px] text-emerald-600 uppercase font-medium">Approved</div>
                </div>
              </div>
            )}
            {/* Comments summary in comments mode */}
            {viewMode === 'comments' && (
              <div className="grid grid-cols-2 gap-2">
                <div className="p-2.5 bg-amber-50 rounded-xl border border-amber-100 text-center">
                  <div className="text-xl font-bold text-amber-600">{comments.filter(c => !c.resolved).length}</div>
                  <div className="text-[10px] text-amber-600 uppercase font-medium">Open</div>
                </div>
                <div className="p-2.5 bg-emerald-50 rounded-xl border border-emerald-100 text-center">
                  <div className="text-xl font-bold text-emerald-600">{comments.filter(c => c.resolved).length}</div>
                  <div className="text-[10px] text-emerald-600 uppercase font-medium">Resolved</div>
                </div>
              </div>
            )}
          </div>

          {/* Quick Actions - hidden in comments mode */}
          {viewMode !== 'comments' && (
            <div className="p-4 border-b border-slate-100">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Quick Actions</h3>
              <div className="grid grid-cols-2 gap-2">
                <button onClick={() => setShowExportModal(true)} className="p-3 bg-slate-50 hover:bg-slate-100 rounded-xl text-slate-600 transition-colors flex flex-col items-center gap-1.5">
                  <Download className="h-4 w-4" />
                  <span className="text-[10px] font-medium">Export</span>
                </button>
                <button onClick={() => setShowShareModal(true)} className="p-3 bg-slate-50 hover:bg-slate-100 rounded-xl text-slate-600 transition-colors flex flex-col items-center gap-1.5">
                  <Share2 className="h-4 w-4" />
                  <span className="text-[10px] font-medium">Share</span>
                </button>
                <button onClick={() => setShowHistory(true)} className="p-3 bg-slate-50 hover:bg-slate-100 rounded-xl text-slate-600 transition-colors flex flex-col items-center gap-1.5">
                  <History className="h-4 w-4" />
                  <span className="text-[10px] font-medium">History</span>
                </button>
                <button 
                  onClick={handleAnalyzeGaps} 
                  disabled={isAnalyzingGaps}
                  className="p-3 bg-slate-50 hover:bg-slate-100 rounded-xl text-slate-600 transition-colors flex flex-col items-center gap-1.5 disabled:opacity-50"
                >
                  {isAnalyzingGaps ? <Loader className="h-4 w-4 animate-spin" /> : <BarChart3 className="h-4 w-4" />}
                  <span className="text-[10px] font-medium">Gaps</span>
                </button>
              </div>
            </div>
          )}

          {/* View Mode */}
          <div className="p-4 border-b border-slate-100">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">View Mode</h3>
            <div className="flex flex-col gap-1">
              <button 
                onClick={() => handleSetViewMode('document')}
                className={`px-3 py-2 rounded-lg text-xs font-medium text-left transition-all flex items-center gap-2 ${viewMode === 'document' ? 'bg-blue-50 text-blue-700' : 'text-slate-500 hover:bg-slate-50'}`}
              >
                <FileText className="h-3.5 w-3.5" /> Document
              </button>
              <button 
                onClick={() => handleSetViewMode('compare')}
                className={`px-3 py-2 rounded-lg text-xs font-medium text-left transition-all flex items-center gap-2 ${viewMode === 'compare' ? 'bg-blue-50 text-blue-700' : 'text-slate-500 hover:bg-slate-50'}`}
              >
                <GitCompare className="h-3.5 w-3.5" /> Compare Versions
              </button>
              <button 
                onClick={() => handleSetViewMode('comments')}
                className={`px-3 py-2 rounded-lg text-xs font-medium text-left transition-all flex items-center gap-2 ${viewMode === 'comments' ? 'bg-blue-50 text-blue-700' : 'text-slate-500 hover:bg-slate-50'}`}
              >
                <MessageCircle className="h-3.5 w-3.5" /> Comments
                {comments.filter(c => !c.resolved).length > 0 && (
                  <span className="ml-auto w-5 h-5 rounded-full bg-amber-500 text-white text-[10px] flex items-center justify-center">
                    {comments.filter(c => !c.resolved).length}
                  </span>
                )}
              </button>
            </div>
          </div>

          {/* Table of Contents or Comments Panel */}
          <div className="flex-1 overflow-hidden flex flex-col">
            <div className="p-4 pb-2">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                {viewMode === 'comments' ? 'All Comments' : 'Contents'}
              </h3>
            </div>
            <div className="flex-1 overflow-y-auto px-4 pb-4 hide-scrollbar">
              {viewMode === 'comments' ? (
                /* Figma-style Comments Panel */
                <div className="space-y-3">
                  {comments.length === 0 ? (
                    <div className="text-center py-8">
                      <MessageCircle className="h-10 w-10 text-slate-200 mx-auto mb-3" />
                      <p className="text-sm text-slate-500 font-medium">No comments yet</p>
                      <p className="text-xs text-slate-400">Click the comment icon on any section to add feedback</p>
                    </div>
                  ) : (
                    <>
                      {/* Unresolved Comments */}
                      {comments.filter(c => !c.resolved).length > 0 && (
                        <div className="mb-4">
                          <div className="text-[10px] font-bold text-amber-600 uppercase tracking-wider mb-2 flex items-center gap-1">
                            <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                            Open ({comments.filter(c => !c.resolved).length})
                          </div>
                          {comments.filter(c => !c.resolved).map(comment => {
                            const section = brd?.sections.find(s => s.id === comment.sectionId);
                            const isEditing = editingCommentId === comment.id;
                            return (
                              <div 
                                key={comment.id} 
                                className="p-3 bg-amber-50 rounded-xl border border-amber-100 mb-2 hover:border-amber-200 transition-all"
                              >
                                <div className="flex items-center gap-2 mb-2">
                                  <div className="w-6 h-6 rounded-full bg-amber-500 text-white text-[10px] font-bold flex items-center justify-center">
                                    {comment.author.charAt(0)}
                                  </div>
                                  <span className="text-xs font-medium text-slate-700">{comment.author}</span>
                                  <span className="text-[10px] text-slate-400">{new Date(comment.timestamp).toLocaleDateString()}</span>
                                  <div className="ml-auto flex items-center gap-0.5">
                                    <button
                                      onClick={(e) => { e.stopPropagation(); startEditComment(comment); }}
                                      className="p-1 hover:bg-amber-100 rounded text-slate-400 hover:text-slate-600"
                                      title="Edit"
                                    >
                                      <Edit3 className="h-3 w-3" />
                                    </button>
                                    <button
                                      onClick={(e) => { e.stopPropagation(); handleDeleteComment(comment.id); }}
                                      className="p-1 hover:bg-red-100 rounded text-slate-400 hover:text-red-500"
                                      title="Delete"
                                    >
                                      <Trash2 className="h-3 w-3" />
                                    </button>
                                  </div>
                                </div>
                                {isEditing ? (
                                  <div className="space-y-2">
                                    <textarea
                                      value={editCommentText}
                                      onChange={(e) => setEditCommentText(e.target.value)}
                                      className="w-full p-2 text-sm border border-amber-200 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-amber-400"
                                      rows={2}
                                      autoFocus
                                    />
                                    <div className="flex gap-2">
                                      <button
                                        onClick={() => handleEditComment(comment.id)}
                                        className="px-2 py-1 text-[10px] bg-amber-500 text-white rounded font-medium hover:bg-amber-600"
                                      >
                                        Save
                                      </button>
                                      <button
                                        onClick={() => { setEditingCommentId(null); setEditCommentText(''); }}
                                        className="px-2 py-1 text-[10px] text-slate-500 hover:text-slate-700"
                                      >
                                        Cancel
                                      </button>
                                    </div>
                                  </div>
                                ) : (
                                  <>
                                    <p 
                                      className="text-sm text-slate-600 mb-2 cursor-pointer hover:text-slate-800"
                                      onClick={() => scrollToSection(comment.sectionId)}
                                    >
                                      {comment.text}
                                    </p>
                                    <div className="flex items-center justify-between">
                                      <span className="text-[10px] text-slate-400 bg-slate-100 px-2 py-0.5 rounded">{section?.title || 'Unknown Section'}</span>
                                      <button 
                                        onClick={(e) => { e.stopPropagation(); setComments(prev => prev.map(c => c.id === comment.id ? { ...c, resolved: true } : c)); }}
                                        className="text-[10px] text-emerald-600 hover:text-emerald-700 font-medium"
                                      >
                                        Resolve
                                      </button>
                                    </div>
                                  </>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                      
                      {/* Resolved Comments */}
                      {comments.filter(c => c.resolved).length > 0 && (
                        <div>
                          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1">
                            <CheckCircle2 className="h-3 w-3" />
                            Resolved ({comments.filter(c => c.resolved).length})
                          </div>
                          {comments.filter(c => c.resolved).map(comment => {
                            const section = brd?.sections.find(s => s.id === comment.sectionId);
                            return (
                              <div 
                                key={comment.id} 
                                className="p-3 bg-slate-50 rounded-xl border border-slate-100 mb-2 opacity-60 group hover:opacity-100 transition-opacity"
                              >
                                <div className="flex items-center gap-2 mb-1">
                                  <span className="text-xs font-medium text-slate-500">{comment.author}</span>
                                  <span className="text-[10px] text-slate-400">{new Date(comment.timestamp).toLocaleDateString()}</span>
                                  <button
                                    onClick={(e) => { e.stopPropagation(); handleDeleteComment(comment.id); }}
                                    className="ml-auto p-1 hover:bg-red-100 rounded text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                                    title="Delete"
                                  >
                                    <Trash2 className="h-3 w-3" />
                                  </button>
                                </div>
                                <p className="text-xs text-slate-500 line-through">{comment.text}</p>
                                <div className="flex items-center justify-between">
                                  <span className="text-[10px] text-slate-400">{section?.title}</span>
                                  <button
                                    onClick={(e) => { e.stopPropagation(); setComments(prev => prev.map(c => c.id === comment.id ? { ...c, resolved: false } : c)); }}
                                    className="text-[10px] text-blue-500 hover:text-blue-600 font-medium opacity-0 group-hover:opacity-100 transition-opacity"
                                  >
                                    Reopen
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </>
                  )}
                </div>
              ) : (
                /* Table of Contents */
                <nav className="space-y-1">
                  {brd?.sections.map((section, i) => {
                    const conf = confidenceMap[section.id] || 0;
                    const approval = approvals.find(a => a.sectionId === section.id);
                    const sectionComments = comments.filter(c => c.sectionId === section.id && !c.resolved);
                    
                    return (
                      <button
                        key={section.id}
                        onClick={() => scrollToSection(section.id)}
                        className={`w-full text-left px-3 py-2 rounded-lg text-xs transition-all group ${
                          activeSection === section.id 
                            ? 'bg-blue-50 text-blue-700 font-medium' 
                            : 'text-slate-600 hover:bg-slate-50'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <span className={`w-5 h-5 rounded-md flex items-center justify-center text-[10px] font-bold shrink-0 ${
                            activeSection === section.id ? 'bg-blue-500 text-white' : 'bg-slate-100 text-slate-500'
                          }`}>
                            {i + 1}
                          </span>
                          <span className="truncate flex-1">{section.title}</span>
                          {approval?.status === 'approved' && (
                            <CheckCircle2 className="h-3 w-3 text-emerald-500 shrink-0" />
                          )}
                        </div>
                        <div className="flex items-center gap-1.5 mt-1 pl-7">
                          <div className="w-10 h-1 rounded-full bg-slate-100 overflow-hidden">
                            <div 
                              className={`h-full bg-${getConfidenceColor(conf)}-400 rounded-full`}
                              style={{ width: `${conf}%` }}
                            />
                          </div>
                          <span className="text-[9px] text-slate-400">{conf}%</span>
                          {sectionComments.length > 0 && (
                            <span className="flex items-center gap-0.5 text-[9px] text-amber-500 ml-auto">
                              <MessageCircle className="h-2.5 w-2.5" />
                              {sectionComments.length}
                            </span>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </nav>
              )}
            </div>
          </div>

          {/* Footer Actions */}
          <div className="p-4 border-t border-slate-100 bg-slate-50/50">
            {viewMode === 'comments' ? (
              /* Simplified footer for comments mode */
              <Button
                variant="outline"
                onClick={() => handleSetViewMode('document')}
                className="w-full rounded-xl text-xs border-slate-200"
              >
                <FileText className="h-3.5 w-3.5 mr-2" />
                Back to Document
              </Button>
            ) : (
              /* Full footer for other modes */
              <>
                {/* Approve All Button */}
                {overallCompletion < 100 && (
                  <Button
                    variant="outline"
                    onClick={handleApproveAll}
                    className="w-full rounded-xl text-xs border-emerald-200 text-emerald-700 hover:bg-emerald-50 mb-2"
                  >
                    <CheckCircle2 className="h-3.5 w-3.5 mr-2" />
                    Approve All Sections
                  </Button>
                )}
                {onEdit && (
                  <Button
                    variant="outline"
                    onClick={onEdit}
                    className="w-full rounded-xl text-xs border-slate-200 mb-2"
                  >
                    <Edit3 className="h-3.5 w-3.5 mr-2" />
                    Advanced Editor
                  </Button>
                )}
                <button onClick={() => setShowKeyboardShortcuts(true)} className="w-full p-2 text-[10px] text-slate-400 hover:text-slate-600 transition-colors flex items-center justify-center gap-1">
                  <Keyboard className="h-3 w-3" /> Keyboard Shortcuts
                </button>
              </>
            )}
          </div>
        </aside>
        
        {/* Collapsed Sidebar Toggle */}
        {!showTOC && (
          <button 
            onClick={() => handleSetShowTOC(true)} 
            className="hidden lg:flex fixed right-0 top-1/2 -translate-y-1/2 z-30 bg-white border border-slate-200 border-r-0 rounded-l-xl p-2 shadow-lg text-slate-400 hover:text-slate-600 transition-colors"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* ========== MODALS ========== */}
      
      {/* Export Modal */}
      <AnimatePresence>
        {showExportModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowExportModal(false)}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl overflow-hidden"
            >
              <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                <h3 className="text-xl font-bold text-slate-900">Export Document</h3>
                <button onClick={() => setShowExportModal(false)} className="p-2 hover:bg-slate-100 rounded-xl transition-colors">
                  <X className="h-5 w-5 text-slate-400" />
                </button>
              </div>
              <div className="p-6 space-y-4">
                {exportError && (
                  <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm flex items-center gap-2">
                    <AlertCircle className="h-4 w-4" />
                    {exportError}
                  </div>
                )}
                <div className="grid grid-cols-2 gap-3">
                  {EXPORT_FORMATS.map(format => (
                    <button
                      key={format.id}
                      onClick={() => handleExport(format.id)}
                      disabled={isExporting}
                      className={`p-4 rounded-2xl border-2 text-left transition-all hover:border-blue-200 hover:bg-blue-50 disabled:opacity-50 ${
                        isExporting ? 'cursor-wait' : ''
                      }`}
                    >
                      <div className="p-2 bg-slate-100 rounded-lg w-fit mb-3 text-slate-500">
                        {format.icon}
                      </div>
                      <div className="font-bold text-slate-900 mb-1">{format.name}</div>
                      <div className="text-xs text-slate-500">{format.description}</div>
                    </button>
                  ))}
                </div>
                {isExporting && (
                  <div className="flex items-center justify-center gap-2 text-blue-600 py-4">
                    <Loader className="h-5 w-5 animate-spin" />
                    <span className="font-medium">Generating export...</span>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* History Modal */}
      <AnimatePresence>
        {showHistory && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
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
              className="relative w-full max-w-2xl bg-white rounded-3xl shadow-2xl overflow-hidden"
            >
              <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                <h3 className="text-xl font-bold text-slate-900">Version History</h3>
                <button onClick={() => setShowHistory(false)} className="p-2 hover:bg-slate-100 rounded-xl transition-colors">
                  <X className="h-5 w-5 text-slate-400" />
                </button>
              </div>
              <div className="p-6 max-h-[60vh] overflow-y-auto space-y-3">
                {/* Current Version */}
                <div className="p-5 bg-blue-50 rounded-2xl border-2 border-blue-200">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-3">
                      <span className="text-lg font-bold text-slate-900">Version {brd?.version}.0</span>
                      <span className="px-2 py-0.5 bg-blue-500 text-white text-[10px] font-bold rounded-full uppercase">Current</span>
                    </div>
                  </div>
                  <p className="text-sm text-slate-500 flex items-center gap-2">
                    <Clock className="h-3.5 w-3.5" /> {new Date(brd!.generatedAt).toLocaleString()}
                  </p>
                </div>
                
                {/* Previous Versions */}
                {project.brdHistory && project.brdHistory.length > 0 ? (
                  [...project.brdHistory].reverse().map((version, i) => (
                    <div key={i} className="p-5 bg-slate-50 rounded-2xl border border-slate-100 flex items-center justify-between group hover:border-blue-200 transition-all">
                      <div>
                        <div className="flex items-center gap-3 mb-1">
                          <span className="text-lg font-bold text-slate-900">Version {version.version}.0</span>
                        </div>
                        <p className="text-sm text-slate-500 flex items-center gap-2">
                          <Clock className="h-3.5 w-3.5" /> {new Date(version.generatedAt).toLocaleString()}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => setCompareVersion(version.version)}
                          className="rounded-xl opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <GitCompare className="h-4 w-4 mr-1" /> Compare
                        </Button>
                        <Button 
                          variant="outline" 
                          onClick={() => handleRestoreVersion(version)} 
                          className="rounded-xl opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          Restore
                        </Button>
                      </div>
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
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
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
              className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden"
            >
              <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                <h3 className="text-xl font-bold text-slate-900">Share Document</h3>
                <button onClick={() => setShowShareModal(false)} className="p-2 hover:bg-slate-100 rounded-xl transition-colors">
                  <X className="h-5 w-5 text-slate-400" />
                </button>
              </div>
              <div className="p-6 space-y-6">
                <p className="text-slate-600 font-medium">Share this BRD with your team or stakeholders.</p>
                <div className="flex gap-2">
                  <div className="flex-1 p-3 bg-slate-50 border border-slate-100 rounded-xl text-sm text-slate-500 font-medium truncate">
                    {window.location.href}
                  </div>
                  <Button onClick={handleShare} className="rounded-xl px-4">
                    {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <button className="p-4 bg-slate-50 hover:bg-slate-100 rounded-xl border border-slate-100 transition-all flex flex-col items-center gap-2">
                    <div className="p-2 bg-blue-50 text-blue-600 rounded-lg"><MessageSquare className="h-5 w-5" /></div>
                    <span className="text-xs font-bold text-slate-700">Slack</span>
                  </button>
                  <button className="p-4 bg-slate-50 hover:bg-slate-100 rounded-xl border border-slate-100 transition-all flex flex-col items-center gap-2">
                    <div className="p-2 bg-purple-50 text-purple-600 rounded-lg"><Users className="h-5 w-5" /></div>
                    <span className="text-xs font-bold text-slate-700">Teams</span>
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Gap Analysis Modal */}
      <AnimatePresence>
        {showGapAnalysis && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowGapAnalysis(false)}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="relative w-full max-w-2xl bg-white rounded-3xl shadow-2xl overflow-hidden"
            >
              <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-amber-50 text-amber-600 rounded-xl">
                    <BarChart3 className="h-5 w-5" />
                  </div>
                  <h3 className="text-xl font-bold text-slate-900">Gap Analysis</h3>
                </div>
                <button onClick={() => setShowGapAnalysis(false)} className="p-2 hover:bg-slate-100 rounded-xl transition-colors">
                  <X className="h-5 w-5 text-slate-400" />
                </button>
              </div>
              <div className="p-6 max-h-[60vh] overflow-y-auto">
                {gapAnalysis.length > 0 ? (
                  <div className="space-y-4">
                    <p className="text-sm text-slate-500 mb-4">AI has identified the following areas that may need attention:</p>
                    {gapAnalysis.map((gap, i) => (
                      <div key={i} className={`p-5 rounded-2xl border ${
                        gap.severity === 'critical' ? 'bg-red-50 border-red-200' :
                        gap.severity === 'major' ? 'bg-amber-50 border-amber-200' :
                        'bg-blue-50 border-blue-200'
                      }`}>
                        <div className="flex items-center justify-between mb-3">
                          <h4 className="font-bold text-slate-900">{gap.area}</h4>
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                            gap.severity === 'critical' ? 'bg-red-500 text-white' :
                            gap.severity === 'major' ? 'bg-amber-500 text-white' :
                            'bg-blue-500 text-white'
                          }`}>
                            {gap.severity}
                          </span>
                        </div>
                        <p className="text-sm text-slate-600 mb-3">{gap.description}</p>
                        <div className="p-3 bg-white/50 rounded-xl">
                          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Recommendation</p>
                          <p className="text-sm text-slate-700">{gap.recommendation}</p>
                        </div>
                        {gap.affectedSections.length > 0 && (
                          <div className="mt-3 flex flex-wrap gap-2">
                            {gap.affectedSections.map((section, j) => (
                              <span key={j} className="px-2 py-1 bg-white/50 rounded-lg text-xs text-slate-500">
                                {section}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <CheckCircle2 className="h-12 w-12 text-emerald-200 mx-auto mb-4" />
                    <p className="text-lg font-bold text-slate-900 mb-2">Looking Good!</p>
                    <p className="text-slate-400">No significant gaps detected in your BRD.</p>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Keyboard Shortcuts Modal */}
      <AnimatePresence>
        {showKeyboardShortcuts && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowKeyboardShortcuts(false)}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden"
            >
              <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-slate-100 text-slate-600 rounded-xl">
                    <Keyboard className="h-5 w-5" />
                  </div>
                  <h3 className="text-xl font-bold text-slate-900">Keyboard Shortcuts</h3>
                </div>
                <button onClick={() => setShowKeyboardShortcuts(false)} className="p-2 hover:bg-slate-100 rounded-xl transition-colors">
                  <X className="h-5 w-5 text-slate-400" />
                </button>
              </div>
              <div className="p-6 space-y-4">
                {[
                  { keys: ['Ctrl', 'E'], action: 'Open export dialog' },
                  { keys: ['Ctrl', 'G'], action: 'Generate/Regenerate BRD' },
                  { keys: ['Ctrl', 'S'], action: 'Save (auto-saved)' },
                  { keys: ['Ctrl', '/'], action: 'Show shortcuts' },
                  { keys: ['Esc'], action: 'Close modals' },
                ].map((shortcut, i) => (
                  <div key={i} className="flex items-center justify-between py-2">
                    <span className="text-sm text-slate-600">{shortcut.action}</span>
                    <div className="flex items-center gap-1">
                      {shortcut.keys.map((key, j) => (
                        <React.Fragment key={j}>
                          <kbd className="px-2 py-1 bg-slate-100 rounded text-xs font-mono text-slate-700 border border-slate-200">
                            {key}
                          </kbd>
                          {j < shortcut.keys.length - 1 && <span className="text-slate-400 text-xs">+</span>}
                        </React.Fragment>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default BRDGenerationEnterprise;
