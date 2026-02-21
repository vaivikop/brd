import React, { useState, useEffect, useMemo, useCallback, memo } from 'react';
import { 
  Lightbulb, 
  CheckCircle2, 
  Flag, 
  X, 
  ChevronRight, 
  Search,
  AlertTriangle,
  FileText,
  Users,
  Clock,
  ArrowRight,
  Sparkles,
  AlertCircle,
  ThumbsUp,
  ThumbsDown,
  Eye,
  Zap,
  Target,
  HelpCircle,
  CheckCheck,
  RotateCcw,
  Keyboard
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import Button from './Button';
import { ProjectState, Insight, updateInsightStatus, bulkUpdateInsightStatus, getProjectStats } from '../utils/db';
import { SourceIcon, getSourceTypeColor } from '../utils/sourceIcons';

interface InsightsReviewProps {
  project: ProjectState;
  onUpdate: (project: ProjectState) => void;
  onContinue: () => void;
  onNavigateToBRD?: () => void;
}

type CategoryTab = 'all' | 'requirement' | 'decision' | 'stakeholder' | 'timeline' | 'question';

const InsightsReview: React.FC<InsightsReviewProps> = ({ project, onUpdate, onContinue, onNavigateToBRD }) => {
  const [activeTab, setActiveTab] = useState<CategoryTab>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [focusedInsightId, setFocusedInsightId] = useState<string | null>(null);
  const [updatingInsightId, setUpdatingInsightId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showOnlyPending, setShowOnlyPending] = useState(false);
  const [justActioned, setJustActioned] = useState<{id: string, action: 'approved' | 'rejected' | 'flagged'} | null>(null);

  const [localInsights, setLocalInsights] = useState<Insight[]>([]);

  useEffect(() => {
    if (project.insights && project.insights.length > 0) {
      setLocalInsights(project.insights);
    } else {
      setLocalInsights([]);
    }
  }, [project.insights]);

  const projectStats = useMemo(() => getProjectStats(project), [project]);

  // Category configuration with icons and colors
  const categoryConfig = {
    requirement: { icon: Target, label: 'Requirements', color: 'blue', description: 'What the system must do' },
    decision: { icon: CheckCircle2, label: 'Decisions', color: 'emerald', description: 'Choices that were made' },
    stakeholder: { icon: Users, label: 'Stakeholders', color: 'purple', description: 'People & their needs' },
    timeline: { icon: Clock, label: 'Timelines', color: 'indigo', description: 'Dates & milestones' },
    question: { icon: HelpCircle, label: 'Open Questions', color: 'amber', description: 'Needs clarification' },
  };

  const getCategoryColor = (category: string) => {
    const colors: Record<string, string> = {
      requirement: 'bg-blue-50 text-blue-600 border-blue-200',
      decision: 'bg-emerald-50 text-emerald-600 border-emerald-200',
      stakeholder: 'bg-purple-50 text-purple-600 border-purple-200',
      timeline: 'bg-indigo-50 text-indigo-600 border-indigo-200',
      question: 'bg-amber-50 text-amber-600 border-amber-200',
    };
    return colors[category] || 'bg-slate-50 text-slate-600 border-slate-200';
  };

  const filteredInsights = useMemo(() => {
    return localInsights.filter(insight => {
      const matchesTab = activeTab === 'all' || insight.category === activeTab;
      const matchesPending = !showOnlyPending || insight.status === 'pending';
      const matchesSearch = !searchQuery || 
        insight.summary.toLowerCase().includes(searchQuery.toLowerCase()) || 
        insight.detail.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesTab && matchesPending && matchesSearch;
    });
  }, [localInsights, activeTab, showOnlyPending, searchQuery]);

  // Group insights by status for smarter display
  const groupedInsights = useMemo(() => {
    const pending = filteredInsights.filter(i => i.status === 'pending');
    const approved = filteredInsights.filter(i => i.status === 'approved');
    const flagged = filteredInsights.filter(i => i.status === 'flagged');
    const rejected = filteredInsights.filter(i => i.status === 'rejected');
    return { pending, approved, flagged, rejected };
  }, [filteredInsights]);

  const handleStatusChange = useCallback(async (id: string, status: Insight['status']) => {
    setUpdatingInsightId(id);
    setError(null);
    
    // Optimistic update - instant UI feedback
    setLocalInsights(prev => prev.map(ins => ins.id === id ? { ...ins, status } : ins));
    
    // Show action feedback
    setJustActioned({ id, action: status as 'approved' | 'rejected' | 'flagged' });
    setTimeout(() => setJustActioned(null), 1000);
    
    try {
      const updated = await updateInsightStatus(id, status);
      onUpdate(updated);
    } catch (err) {
      console.error("Failed to update status in DB", err);
      setError("Couldn't save. Please try again.");
      // Rollback on error
      setLocalInsights(prev => prev.map(ins => {
        const original = project.insights.find(i => i.id === id);
        return ins.id === id && original ? { ...ins, status: original.status } : ins;
      }));
    } finally {
      setUpdatingInsightId(null);
    }
  }, [project.insights, onUpdate]);

  const handleBulkApprove = useCallback(async () => {
    const pendingInsights = localInsights.filter(i => i.status === 'pending');
    if (pendingInsights.length === 0) return;
    
    setUpdatingInsightId('bulk');
    setError(null);
    
    try {
      // Single DB transaction for all updates - much faster!
      const updates = pendingInsights.map(i => ({ insightId: i.id, status: 'approved' as const }));
      const updatedProject = await bulkUpdateInsightStatus(updates);
      
      // Update local state
      const updatedInsights = localInsights.map(i => 
        i.status === 'pending' ? { ...i, status: 'approved' as const } : i
      );
      setLocalInsights(updatedInsights);
      
      // Propagate to parent
      onUpdate(updatedProject);
    } catch (err) {
      console.error("Failed to bulk approve", err);
      setError("Couldn't approve all. Please try again.");
    } finally {
      setUpdatingInsightId(null);
    }
  }, [localInsights, onUpdate]);

  // Optimized stats - single pass through insights
  const stats = useMemo(() => {
    let approved = 0, pending = 0, flagged = 0, rejected = 0, inBRD = 0;
    for (const i of localInsights) {
      if (i.status === 'approved') approved++;
      else if (i.status === 'pending') pending++;
      else if (i.status === 'flagged') flagged++;
      else if (i.status === 'rejected') rejected++;
      if (i.includedInBRD) inBRD++;
    }
    return { total: localInsights.length, approved, pending, flagged, rejected, inBRD };
  }, [localInsights]);

  const hasBRD = projectStats.hasBRD;
  const progressPercent = stats.total > 0 ? Math.round(((stats.approved + stats.rejected) / stats.total) * 100) : 0;

  // Count per category
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = { all: localInsights.length };
    localInsights.forEach(i => {
      counts[i.category] = (counts[i.category] || 0) + 1;
    });
    return counts;
  }, [localInsights]);

  // Keyboard navigation for fast review
  const [selectedIndex, setSelectedIndex] = useState(0);
  
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Only handle keys when not typing in search
      if (document.activeElement?.tagName === 'INPUT') return;
      
      const pendingInsights = filteredInsights.filter(i => i.status === 'pending');
      const currentInsight = pendingInsights[selectedIndex];
      
      switch (e.key) {
        case 'j': // Next
        case 'ArrowDown':
          e.preventDefault();
          setSelectedIndex(prev => Math.min(prev + 1, pendingInsights.length - 1));
          break;
        case 'k': // Previous  
        case 'ArrowUp':
          e.preventDefault();
          setSelectedIndex(prev => Math.max(prev - 1, 0));
          break;
        case 'a': // Approve
          if (currentInsight) handleStatusChange(currentInsight.id, 'approved');
          break;
        case 'f': // Flag
          if (currentInsight) handleStatusChange(currentInsight.id, 'flagged');
          break;
        case 'r': // Reject
          if (currentInsight) handleStatusChange(currentInsight.id, 'rejected');
          break;
        case 'A': // Approve All (Shift+A)
          if (e.shiftKey && stats.pending > 0) handleBulkApprove();
          break;
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [filteredInsights, selectedIndex, handleStatusChange, handleBulkApprove, stats.pending]);

  // Empty state
  if (localInsights.length === 0) {
    return (
      <div className="max-w-4xl mx-auto pb-20 animate-in fade-in duration-500">
        <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
          <div className="w-24 h-24 bg-gradient-to-br from-blue-100 to-purple-100 rounded-3xl flex items-center justify-center mb-8">
            <Lightbulb className="h-12 w-12 text-blue-500" />
          </div>
          <h2 className="text-3xl font-bold text-slate-900 mb-4">No Insights Yet</h2>
          <p className="text-lg text-slate-500 max-w-md mb-8 leading-relaxed">
            Connect your data sources first. I'll analyze meetings, emails, and documents to extract key requirements automatically.
          </p>
          <div className="flex items-center gap-3 text-sm text-slate-400">
            <span className="flex items-center gap-2 px-3 py-1.5 bg-slate-50 rounded-full">
              <FileText className="h-4 w-4" /> Documents
            </span>
            <span className="flex items-center gap-2 px-3 py-1.5 bg-slate-50 rounded-full">
              <Users className="h-4 w-4" /> Meetings
            </span>
            <span className="flex items-center gap-2 px-3 py-1.5 bg-slate-50 rounded-full">
              <Sparkles className="h-4 w-4" /> Emails
            </span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto pb-20 animate-in fade-in duration-500">
      {/* Error Toast */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-6 left-1/2 -translate-x-1/2 z-50 bg-red-500 text-white px-5 py-3 rounded-2xl flex items-center gap-3 shadow-xl"
          >
            <AlertCircle className="h-5 w-5" />
            <span className="text-sm font-medium">{error}</span>
            <button onClick={() => setError(null)} className="p-1 hover:bg-red-400 rounded-lg ml-2">
              <X className="h-4 w-4" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Action Feedback Toast */}
      <AnimatePresence>
        {justActioned && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className={`fixed bottom-8 left-1/2 -translate-x-1/2 z-50 px-6 py-3 rounded-2xl flex items-center gap-3 shadow-xl ${
              justActioned.action === 'approved' ? 'bg-emerald-500 text-white' :
              justActioned.action === 'flagged' ? 'bg-amber-500 text-white' :
              'bg-slate-700 text-white'
            }`}
          >
            {justActioned.action === 'approved' && <ThumbsUp className="h-5 w-5" />}
            {justActioned.action === 'flagged' && <Flag className="h-5 w-5" />}
            {justActioned.action === 'rejected' && <ThumbsDown className="h-5 w-5" />}
            <span className="font-medium capitalize">{justActioned.action}!</span>
          </motion.div>
        )}
      </AnimatePresence>
      {/* Header - Simple & Clean */}
      <header className="mb-8">
        <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6 mb-8">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-gradient-to-r from-blue-50 to-purple-50 text-blue-700 text-xs font-bold mb-4">
              <Sparkles className="h-3.5 w-3.5" /> Review & Validate
            </div>
            <h1 className="text-3xl lg:text-4xl font-bold text-slate-900 mb-2">
              {stats.pending > 0 ? `${stats.pending} insights need your review` : 'All insights reviewed!'}
            </h1>
            <p className="text-slate-500 text-lg">
              {stats.pending > 0 
                ? "Approve what's accurate, flag what needs discussion."
                : `${stats.approved} approved and ready for your BRD.`
              }
            </p>
          </div>

          {/* Progress Ring */}
          <div className="flex items-center gap-6">
            <div className="relative w-20 h-20">
              <svg className="w-20 h-20 transform -rotate-90">
                <circle
                  className="text-slate-100"
                  strokeWidth="6"
                  stroke="currentColor"
                  fill="transparent"
                  r="34"
                  cx="40"
                  cy="40"
                />
                <circle
                  className="text-emerald-500 transition-all duration-1000 ease-out"
                  strokeWidth="6"
                  strokeDasharray={34 * 2 * Math.PI}
                  strokeDashoffset={34 * 2 * Math.PI * (1 - progressPercent / 100)}
                  strokeLinecap="round"
                  stroke="currentColor"
                  fill="transparent"
                  r="34"
                  cx="40"
                  cy="40"
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-xl font-bold text-slate-900">{progressPercent}%</span>
              </div>
            </div>
            <div className="text-sm">
              <div className="flex items-center gap-2 text-emerald-600 font-semibold mb-1">
                <CheckCircle2 className="h-4 w-4" /> {stats.approved} approved
              </div>
              {stats.flagged > 0 && (
                <div className="flex items-center gap-2 text-amber-600 font-medium mb-1">
                  <Flag className="h-4 w-4" /> {stats.flagged} flagged
                </div>
              )}
              <div className="flex items-center gap-2 text-slate-400">
                <Eye className="h-4 w-4" /> {stats.pending} pending
              </div>
            </div>
          </div>
        </div>

        {/* Category Tabs - Clean Pills */}
        <div className="flex flex-wrap items-center gap-2 mb-6">
          <button
            onClick={() => setActiveTab('all')}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
              activeTab === 'all'
                ? 'bg-slate-900 text-white shadow-lg'
                : 'bg-white text-slate-600 border border-slate-200 hover:border-slate-300'
            }`}
          >
            All <span className="ml-1 opacity-60">{categoryCounts.all || 0}</span>
          </button>
          {Object.entries(categoryConfig).map(([key, config]) => {
            const Icon = config.icon;
            const count = categoryCounts[key] || 0;
            if (count === 0) return null;
            return (
              <button
                key={key}
                onClick={() => setActiveTab(key as CategoryTab)}
                className={`px-4 py-2 rounded-xl text-sm font-medium transition-all flex items-center gap-2 ${
                  activeTab === key
                    ? `${getCategoryColor(key)} border shadow-sm`
                    : 'bg-white text-slate-600 border border-slate-200 hover:border-slate-300'
                }`}
              >
                <Icon className="h-4 w-4" />
                {config.label}
                <span className="opacity-60">{count}</span>
              </button>
            );
          })}
        </div>

        {/* Quick Actions Bar */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Search */}
          <div className="relative flex-1 min-w-[200px] max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input 
              type="text"
              placeholder="Search insights..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
            />
          </div>

          {/* Toggle Pending Only */}
          <button
            onClick={() => setShowOnlyPending(!showOnlyPending)}
            className={`px-4 py-2.5 rounded-xl text-sm font-medium transition-all flex items-center gap-2 ${
              showOnlyPending 
                ? 'bg-blue-500 text-white shadow-lg shadow-blue-200' 
                : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
            }`}
          >
            <Eye className="h-4 w-4" />
            {showOnlyPending ? 'Showing Pending' : 'Show Pending Only'}
          </button>

          {/* Bulk Approve */}
          {stats.pending > 0 && (
            <button
              onClick={handleBulkApprove}
              disabled={updatingInsightId === 'bulk'}
              className="px-5 py-2.5 bg-emerald-500 text-white rounded-xl text-sm font-semibold shadow-lg shadow-emerald-200 hover:bg-emerald-600 transition-all flex items-center gap-2 disabled:opacity-50"
            >
              {updatingInsightId === 'bulk' ? (
                <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <CheckCheck className="h-4 w-4" />
              )}
              Approve All {stats.pending}
            </button>
          )}

          {/* Keyboard Shortcuts Hint */}
          <div className="hidden lg:flex items-center gap-2 text-xs text-slate-400 ml-auto">
            <Keyboard className="h-3.5 w-3.5" />
            <span className="px-1.5 py-0.5 bg-slate-100 rounded font-mono">A</span> approve
            <span className="px-1.5 py-0.5 bg-slate-100 rounded font-mono">F</span> flag
            <span className="px-1.5 py-0.5 bg-slate-100 rounded font-mono">R</span> reject
            <span className="px-1.5 py-0.5 bg-slate-100 rounded font-mono">↑↓</span> navigate
          </div>
        </div>
      </header>

      {/* Insights Grid - Clean Cards */}
      <div className="space-y-3 mb-12">
        <AnimatePresence mode="popLayout">
          {filteredInsights.map((insight) => {
            const config = categoryConfig[insight.category as keyof typeof categoryConfig] || categoryConfig.question;
            const CategoryIcon = config.icon;
            const isExpanded = focusedInsightId === insight.id;
            
            return (
              <motion.div 
                key={insight.id}
                layout
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className={`group bg-white rounded-2xl border transition-all duration-200 overflow-hidden ${
                  updatingInsightId === insight.id ? 'ring-2 ring-blue-400 border-blue-200' :
                  insight.status === 'approved' ? 'border-emerald-200 bg-emerald-50/30' : 
                  insight.status === 'flagged' ? 'border-amber-200 bg-amber-50/30' :
                  insight.status === 'rejected' ? 'border-slate-200 opacity-50' :
                  'border-slate-200 hover:border-slate-300 hover:shadow-md'
                }`}
              >
                <div className="p-5">
                  <div className="flex items-start gap-4">
                    {/* Category Icon */}
                    <div className={`p-2.5 rounded-xl ${getCategoryColor(insight.category)}`}>
                      <CategoryIcon className="h-5 w-5" />
                    </div>
                    
                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-4 mb-2">
                        <div className="flex-1">
                          <h3 className="text-base font-semibold text-slate-900 leading-snug mb-1">
                            {insight.summary}
                          </h3>
                          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                            <span className="flex items-center gap-1">
                              <SourceIcon type={insight.sourceType} className="h-3.5 w-3.5" />
                              {insight.source}
                            </span>
                            <span className="text-slate-300">•</span>
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase ${
                              insight.confidence === 'high' ? 'bg-emerald-100 text-emerald-700' :
                              insight.confidence === 'medium' ? 'bg-amber-100 text-amber-700' :
                              'bg-red-100 text-red-700'
                            }`}>
                              {insight.confidence}
                            </span>
                            {insight.includedInBRD && (
                              <>
                                <span className="text-slate-300">•</span>
                                <span className="flex items-center gap-1 text-blue-600 font-medium">
                                  <FileText className="h-3 w-3" /> In BRD
                                </span>
                              </>
                            )}
                          </div>
                        </div>

                        {/* Action Buttons - Clean & Simple */}
                        <div className="flex items-center gap-1.5">
                          {updatingInsightId === insight.id ? (
                            <div className="p-2 rounded-lg bg-slate-100">
                              <div className="h-5 w-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                            </div>
                          ) : (
                            <>
                              <button 
                                onClick={() => handleStatusChange(insight.id, 'approved')}
                                className={`p-2 rounded-lg transition-all ${
                                  insight.status === 'approved' 
                                    ? 'bg-emerald-500 text-white shadow-md' 
                                    : 'bg-slate-100 text-slate-400 hover:bg-emerald-100 hover:text-emerald-600'
                                }`}
                                title="Approve"
                              >
                                <ThumbsUp className="h-4 w-4" />
                              </button>
                              <button 
                                onClick={() => handleStatusChange(insight.id, 'flagged')}
                                className={`p-2 rounded-lg transition-all ${
                                  insight.status === 'flagged' 
                                    ? 'bg-amber-500 text-white shadow-md' 
                                    : 'bg-slate-100 text-slate-400 hover:bg-amber-100 hover:text-amber-600'
                                }`}
                                title="Flag for discussion"
                              >
                                <Flag className="h-4 w-4" />
                              </button>
                              <button 
                                onClick={() => handleStatusChange(insight.id, 'rejected')}
                                className={`p-2 rounded-lg transition-all ${
                                  insight.status === 'rejected' 
                                    ? 'bg-slate-700 text-white shadow-md' 
                                    : 'bg-slate-100 text-slate-400 hover:bg-red-100 hover:text-red-600'
                                }`}
                                title="Not relevant"
                              >
                                <X className="h-4 w-4" />
                              </button>
                              <button 
                                onClick={() => setFocusedInsightId(isExpanded ? null : insight.id)}
                                className="p-2 rounded-lg bg-slate-100 text-slate-400 hover:bg-slate-200 hover:text-slate-600 transition-all ml-1"
                                title="See details"
                              >
                                <ChevronRight className={`h-4 w-4 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                              </button>
                            </>
                          )}
                        </div>
                      </div>

                      {/* Expanded Details */}
                      <AnimatePresence>
                        {isExpanded && (
                          <motion.div 
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className="overflow-hidden"
                          >
                            <div className="mt-4 pt-4 border-t border-slate-100">
                              <p className="text-slate-600 text-sm leading-relaxed bg-slate-50 p-4 rounded-xl">
                                {insight.detail}
                              </p>
                              {insight.confidence === 'low' && (
                                <div className="mt-3 flex items-start gap-2 p-3 bg-red-50 rounded-xl text-red-700 text-sm">
                                  <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                                  <span>Low confidence - may have conflicting information in other sources. Review carefully.</span>
                                </div>
                              )}
                              {insight.brdSections && insight.brdSections.length > 0 && (
                                <div className="mt-3 flex items-center gap-2 text-sm text-blue-600">
                                  <FileText className="h-4 w-4" />
                                  <span>Used in: {insight.brdSections.join(', ')}</span>
                                </div>
                              )}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  </div>
                </div>

                {/* Quick Status Indicator */}
                {insight.status !== 'pending' && (
                  <div className={`px-5 py-2 text-xs font-medium flex items-center gap-2 ${
                    insight.status === 'approved' ? 'bg-emerald-100 text-emerald-700' :
                    insight.status === 'flagged' ? 'bg-amber-100 text-amber-700' :
                    'bg-slate-100 text-slate-500'
                  }`}>
                    {insight.status === 'approved' && <><CheckCircle2 className="h-3.5 w-3.5" /> Approved - will be included in BRD</>}
                    {insight.status === 'flagged' && <><Flag className="h-3.5 w-3.5" /> Flagged - needs team discussion</>}
                    {insight.status === 'rejected' && <><X className="h-3.5 w-3.5" /> Not relevant - excluded from BRD</>}
                    <button 
                      onClick={() => handleStatusChange(insight.id, 'pending')}
                      className="ml-auto flex items-center gap-1 hover:underline"
                    >
                      <RotateCcw className="h-3 w-3" /> Undo
                    </button>
                  </div>
                )}
              </motion.div>
            );
          })}
        </AnimatePresence>
        
        {/* Empty state for filtered results */}
        {filteredInsights.length === 0 && (
          <div className="py-16 text-center bg-white rounded-2xl border border-dashed border-slate-200">
            <Search className="h-10 w-10 text-slate-300 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-slate-900 mb-1">No matching insights</h3>
            <p className="text-slate-500 text-sm">Try adjusting your search or filters.</p>
            <button 
              onClick={() => { setSearchQuery(''); setActiveTab('all'); setShowOnlyPending(false); }}
              className="mt-4 text-blue-600 text-sm font-medium hover:underline"
            >
              Clear all filters
            </button>
          </div>
        )}
      </div>

      {/* Footer - Clean CTA */}
      <div className="bg-gradient-to-r from-slate-50 to-blue-50 rounded-2xl p-8 text-center">
        {stats.pending > 0 ? (
          <>
            <div className="flex items-center justify-center gap-2 text-slate-600 mb-4">
              <Zap className="h-5 w-5 text-blue-500" />
              <span className="font-medium">
                {stats.pending} insight{stats.pending !== 1 ? 's' : ''} left to review
              </span>
            </div>
            <p className="text-slate-500 text-sm mb-6 max-w-md mx-auto">
              Approved insights become requirements in your BRD. Take your time to review each one.
            </p>
          </>
        ) : (
          <>
            <div className="w-16 h-16 bg-emerald-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 className="h-8 w-8 text-emerald-600" />
            </div>
            <h3 className="text-xl font-bold text-slate-900 mb-2">All insights reviewed!</h3>
            <p className="text-slate-500 text-sm mb-6 max-w-md mx-auto">
              {stats.approved} approved insights ready to generate your BRD.
            </p>
          </>
        )}

        <div className="flex flex-wrap items-center justify-center gap-3">
          {hasBRD && onNavigateToBRD && (
            <Button 
              variant="outline"
              size="lg" 
              onClick={onNavigateToBRD}
              className="px-6 py-3 rounded-xl"
            >
              View Current BRD
            </Button>
          )}
          
          <Button 
            size="lg" 
            onClick={onContinue}
            disabled={stats.approved === 0}
            className={`px-8 py-3 rounded-xl font-semibold shadow-lg transition-all ${
              stats.approved > 0 
                ? 'shadow-blue-200 hover:shadow-xl hover:shadow-blue-200' 
                : 'opacity-50 cursor-not-allowed'
            }`}
          >
            {hasBRD ? 'Update BRD' : 'Generate BRD'}
            <ArrowRight className="ml-2 h-5 w-5" />
          </Button>
        </div>

        {stats.approved === 0 && (
          <p className="text-amber-600 text-sm mt-4 flex items-center justify-center gap-2">
            <AlertTriangle className="h-4 w-4" />
            Approve at least one insight to generate your BRD
          </p>
        )}
      </div>
    </div>
  );
};

export default InsightsReview;
