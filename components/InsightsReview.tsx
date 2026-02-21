import React, { useState, useEffect, useMemo } from 'react';
import { 
  Lightbulb, 
  CheckCircle2, 
  Flag, 
  Trash2, 
  ChevronDown, 
  ChevronUp, 
  Filter, 
  Search,
  AlertTriangle,
  ExternalLink,
  MessageSquare,
  Mail,
  Video,
  FileText,
  Database,
  Clock,
  ArrowRight,
  Info,
  Link2,
  RefreshCw,
  Loader,
  AlertCircle,
  Upload
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import Button from './Button';
import Tooltip from './Tooltip';
import { ProjectState, Insight, updateInsightStatus, updateProjectContext, getProjectStats } from '../utils/db';
import { SourceIcon, getSourceTypeColor } from '../utils/sourceIcons';

interface InsightsReviewProps {
  project: ProjectState;
  onUpdate: (project: ProjectState) => void;
  onContinue: () => void;
  onNavigateToBRD?: () => void;
}

const InsightsReview: React.FC<InsightsReviewProps> = ({ project, onUpdate, onContinue, onNavigateToBRD }) => {
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [filterConfidence, setFilterConfidence] = useState<string>('all');
  const [filterBRDStatus, setFilterBRDStatus] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [isLoadingInsights, setIsLoadingInsights] = useState(false);
  const [updatingInsightId, setUpdatingInsightId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // No longer seeding mock insights - insights come from real source analysis
  // This ensures users only see data actually extracted from their sources

  const [localInsights, setLocalInsights] = useState<Insight[]>([]);

  // Sync local insights with project insights
  useEffect(() => {
    if (project.insights && project.insights.length > 0) {
      setLocalInsights(project.insights);
    } else {
      setLocalInsights([]);
    }
  }, [project.insights]);

  // Compute project stats using the helper
  const projectStats = useMemo(() => getProjectStats(project), [project]);

  const filteredInsights = useMemo(() => {
    return localInsights.filter(insight => {
      const matchesCategory = filterCategory === 'all' || insight.category === filterCategory;
      const matchesConfidence = filterConfidence === 'all' || insight.confidence === filterConfidence;
      const matchesBRDStatus = filterBRDStatus === 'all' || 
        (filterBRDStatus === 'in-brd' && insight.includedInBRD) ||
        (filterBRDStatus === 'not-in-brd' && !insight.includedInBRD);
      const matchesSearch = insight.summary.toLowerCase().includes(searchQuery.toLowerCase()) || 
                           insight.detail.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesCategory && matchesConfidence && matchesBRDStatus && matchesSearch;
    });
  }, [localInsights, filterCategory, filterConfidence, filterBRDStatus, searchQuery]);

  const handleStatusChange = async (id: string, status: Insight['status']) => {
    setUpdatingInsightId(id);
    setError(null);
    
    // Update local state immediately for responsiveness
    setLocalInsights(prev => prev.map(ins => ins.id === id ? { ...ins, status } : ins));
    
    try {
      const updated = await updateInsightStatus(id, status);
      onUpdate(updated);
    } catch (err) {
      console.error("Failed to update status in DB", err);
      setError("Failed to update insight status. Please try again.");
      // Revert the local change on error
      setLocalInsights(prev => prev.map(ins => {
        const original = project.insights.find(i => i.id === id);
        return ins.id === id && original ? { ...ins, status: original.status } : ins;
      }));
    } finally {
      setUpdatingInsightId(null);
    }
  };

  const handleBulkApprove = async () => {
    const pendingInsights = localInsights.filter(i => i.status === 'pending');
    if (pendingInsights.length === 0) return;
    
    setIsLoadingInsights(true);
    setError(null);
    
    try {
      // Update all pending to approved
      for (const insight of pendingInsights) {
        await updateInsightStatus(insight.id, 'approved');
      }
      // Refresh from project
      const updatedInsights = localInsights.map(i => 
        i.status === 'pending' ? { ...i, status: 'approved' as const } : i
      );
      setLocalInsights(updatedInsights);
    } catch (err) {
      console.error("Failed to bulk approve", err);
      setError("Failed to approve all insights. Please try again.");
    } finally {
      setIsLoadingInsights(false);
    }
  };

  const getCategoryIcon = (category: Insight['category']) => {
    switch (category) {
      case 'requirement': return <FileText className="h-4 w-4" />;
      case 'decision': return <CheckCircle2 className="h-4 w-4" />;
      case 'stakeholder': return <Database className="h-4 w-4" />;
      case 'timeline': return <Clock className="h-4 w-4" />;
      case 'question': return <AlertTriangle className="h-4 w-4" />;
      default: return <Lightbulb className="h-4 w-4" />;
    }
  };

  const getSourceIcon = (type: Insight['sourceType']) => {
    return <SourceIcon type={type} className="h-3.5 w-3.5" />;
  };

  const getConfidenceColor = (confidence: Insight['confidence']) => {
    switch (confidence) {
      case 'high': return 'text-emerald-600 bg-emerald-50 border-emerald-100';
      case 'medium': return 'text-orange-600 bg-orange-50 border-orange-100';
      case 'low': return 'text-red-600 bg-red-50 border-red-100';
      default: return 'text-slate-600 bg-slate-50 border-slate-100';
    }
  };

  const stats = {
    total: localInsights.length,
    approved: localInsights.filter(i => i.status === 'approved').length,
    pending: localInsights.filter(i => i.status === 'pending').length,
    flagged: localInsights.filter(i => i.status === 'flagged').length,
    inBRD: localInsights.filter(i => i.includedInBRD).length,
  };

  // Check if BRD exists and show appropriate messaging
  const hasBRD = projectStats.hasBRD;
  const brdNeedsUpdate = hasBRD && stats.approved > stats.inBRD;

  // Loading state
  if (isLoadingInsights) {
    return (
      <div className="max-w-6xl mx-auto pb-20 animate-in fade-in duration-500">
        <div className="flex flex-col items-center justify-center h-[60vh] gap-6">
          <div className="relative">
            <div className="w-16 h-16 border-4 border-blue-100 border-t-blue-600 rounded-full animate-spin"></div>
            <Lightbulb className="absolute inset-0 m-auto h-6 w-6 text-blue-600" />
          </div>
          <div className="text-center">
            <h3 className="text-xl font-bold text-slate-800 mb-2">Analyzing Your Data...</h3>
            <p className="text-slate-500">Extracting insights from connected sources</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto pb-20 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Error Toast */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-6 right-6 z-50 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl flex items-center gap-3 shadow-lg"
          >
            <AlertCircle className="h-5 w-5" />
            <span className="text-sm font-medium">{error}</span>
            <button onClick={() => setError(null)} className="p-1 hover:bg-red-100 rounded">
              <Trash2 className="h-4 w-4" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      <header className="mb-6 lg:mb-10 flex flex-col gap-4 lg:gap-6">
        <div className="max-w-2xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 text-blue-700 text-xs font-bold uppercase tracking-wider mb-3 lg:mb-4 border border-blue-100">
            <Lightbulb className="h-3.5 w-3.5" /> Step 4: Intelligence Review
          </div>
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-slate-900 mb-3 lg:mb-4 tracking-tight">Extracted Insights</h1>
          <p className="text-base lg:text-lg text-slate-600 leading-relaxed">
            I've analyzed your data sources and identified these key elements. Review and validate them to ensure your 
            <span className="text-blue-600 font-semibold"> BRD is built on verified truth</span>.
          </p>
        </div>

        <div className="flex flex-col gap-3">
          {/* Main Stats Card */}
          <div className="bg-white px-4 lg:px-6 py-3 lg:py-4 rounded-xl lg:rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4 lg:gap-6">
              <div className="text-center">
                  <div className="text-xl lg:text-2xl font-bold text-slate-900">{stats.approved}/{stats.total}</div>
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Validated</div>
              </div>
              <div className="h-6 lg:h-8 w-px bg-slate-100"></div>
              <div className="flex-1 min-w-[100px] lg:min-w-[120px]">
                  <div className="flex justify-between text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">
                      <span>Progress</span>
                      <span>{stats.total > 0 ? Math.round((stats.approved / stats.total) * 100) : 0}%</span>
                  </div>
                  <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                      <div 
                          className="h-full bg-blue-500 transition-all duration-1000 ease-out" 
                          style={{ width: `${stats.total > 0 ? (stats.approved / stats.total) * 100 : 0}%` }}
                      ></div>
                  </div>
              </div>
          </div>

          {/* BRD Status Card */}
          {hasBRD && (
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className={`px-4 py-3 rounded-xl border flex items-center gap-3 ${
                brdNeedsUpdate 
                  ? 'bg-amber-50 border-amber-200 text-amber-700' 
                  : 'bg-emerald-50 border-emerald-200 text-emerald-700'
              }`}
            >
              {brdNeedsUpdate ? (
                <>
                  <RefreshCw className="h-4 w-4" />
                  <span className="text-xs font-bold">
                    {stats.approved - stats.inBRD} new approved insights not in BRD
                  </span>
                  {onNavigateToBRD && (
                    <button 
                      onClick={onNavigateToBRD}
                      className="ml-auto text-[10px] font-bold bg-amber-200 px-2 py-1 rounded-lg hover:bg-amber-300 transition-colors"
                    >
                      Regenerate BRD
                    </button>
                  )}
                </>
              ) : (
                <>
                  <Link2 className="h-4 w-4" />
                  <span className="text-xs font-bold">{stats.inBRD} insights linked to BRD v{projectStats.brdVersion}</span>
                  {onNavigateToBRD && (
                    <button 
                      onClick={onNavigateToBRD}
                      className="ml-auto text-[10px] font-bold bg-emerald-200 px-2 py-1 rounded-lg hover:bg-emerald-300 transition-colors"
                    >
                      View BRD
                    </button>
                  )}
                </>
              )}
            </motion.div>
          )}
        </div>
      </header>

      {/* Filters & Search */}
      <div className="bg-white p-3 lg:p-4 rounded-xl lg:rounded-2xl border border-slate-200 shadow-sm mb-6 lg:mb-8 space-y-3 lg:space-y-0 lg:flex lg:flex-wrap lg:items-center lg:gap-4">
        <div className="relative flex-1 min-w-0 lg:min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input 
            type="text"
            placeholder="Search insights..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-100 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all"
          />
        </div>
        
        <div className="flex flex-wrap items-center gap-2">
          <Filter className="h-4 w-4 text-slate-400 hidden lg:block" />
          <select 
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            className="flex-1 sm:flex-none bg-slate-50 border border-slate-100 rounded-xl px-3 py-2 text-sm font-medium outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All Categories</option>
            <option value="requirement">Requirements</option>
            <option value="decision">Decisions</option>
            <option value="stakeholder">Stakeholders</option>
            <option value="timeline">Timelines</option>
            <option value="question">Open Questions</option>
          </select>
          
          <select 
            value={filterConfidence}
            onChange={(e) => setFilterConfidence(e.target.value)}
            className="flex-1 sm:flex-none bg-slate-50 border border-slate-100 rounded-xl px-3 py-2 text-sm font-medium outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All Confidence</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>

          {hasBRD && (
            <select 
              value={filterBRDStatus}
              onChange={(e) => setFilterBRDStatus(e.target.value)}
              className="flex-1 sm:flex-none bg-slate-50 border border-slate-100 rounded-xl px-3 py-2 text-sm font-medium outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All BRD Status</option>
              <option value="in-brd">In BRD</option>
              <option value="not-in-brd">Not in BRD</option>
            </select>
          )}
        </div>

        {stats.pending > 0 && (
          <Button 
            variant="outline" 
            onClick={handleBulkApprove}
            disabled={isLoadingInsights}
            className="w-full lg:w-auto lg:ml-auto rounded-xl border-emerald-200 text-emerald-600 hover:bg-emerald-50 justify-center"
          >
            {isLoadingInsights ? (
              <Loader className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <CheckCircle2 className="h-4 w-4 mr-2" />
            )}
            Approve All ({stats.pending})
          </Button>
        )}
      </div>

      {/* Insights List */}
      <div className="space-y-4 mb-12">
        <AnimatePresence mode="popLayout">
          {filteredInsights.map((insight) => (
            <motion.div 
              key={insight.id}
              layout
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className={`bg-white rounded-3xl border transition-all duration-300 ${
                updatingInsightId === insight.id ? 'ring-2 ring-blue-300 border-blue-200' :
                insight.status === 'approved' ? 'border-emerald-100 shadow-sm' : 
                insight.status === 'flagged' ? 'border-orange-100 shadow-md' :
                insight.status === 'rejected' ? 'border-slate-100 opacity-60' :
                'border-slate-100 shadow-sm hover:shadow-md'
              }`}
            >
              <div className="p-6">
                <div className="flex items-start justify-between gap-6">
                  <div className="flex items-start gap-5 flex-1">
                    <div className={`mt-1 p-3 rounded-2xl ${
                      insight.category === 'requirement' ? 'bg-blue-50 text-blue-600' :
                      insight.category === 'decision' ? 'bg-emerald-50 text-emerald-600' :
                      insight.category === 'stakeholder' ? 'bg-purple-50 text-purple-600' :
                      insight.category === 'timeline' ? 'bg-indigo-50 text-indigo-600' :
                      'bg-orange-50 text-orange-600'
                    }`}>
                      {getCategoryIcon(insight.category)}
                    </div>
                    
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-1 flex-wrap">
                        <h3 className="text-lg font-bold text-slate-900">{insight.summary}</h3>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${getConfidenceColor(insight.confidence)}`}>
                          {insight.confidence} Confidence
                        </span>
                        {insight.includedInBRD && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border bg-blue-50 text-blue-600 border-blue-100 flex items-center gap-1">
                            <Link2 className="h-3 w-3" /> In BRD
                          </span>
                        )}
                      </div>
                      
                      <div className="flex items-center gap-4 text-xs font-bold text-slate-400 uppercase tracking-widest">
                        <span className="flex items-center gap-1.5">
                          {getSourceIcon(insight.sourceType)} {insight.source}
                        </span>
                        <span className="w-1 h-1 rounded-full bg-slate-200"></span>
                        <span className="flex items-center gap-1.5">
                          <Clock className="h-3.5 w-3.5" /> {new Date(insight.timestamp).toLocaleDateString()}
                        </span>
                        {insight.brdSections && insight.brdSections.length > 0 && (
                          <>
                            <span className="w-1 h-1 rounded-full bg-slate-200"></span>
                            <span className="flex items-center gap-1.5 text-blue-500 normal-case font-medium">
                              <FileText className="h-3.5 w-3.5" /> {insight.brdSections.join(', ')}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {updatingInsightId === insight.id ? (
                      <div className="p-2.5 rounded-xl bg-blue-50">
                        <Loader className="h-5 w-5 text-blue-500 animate-spin" />
                      </div>
                    ) : (
                      <>
                        <Tooltip content="Approve">
                          <button 
                            onClick={() => handleStatusChange(insight.id, 'approved')}
                            className={`p-2.5 rounded-xl transition-all ${insight.status === 'approved' ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-200' : 'bg-slate-50 text-slate-400 hover:bg-emerald-50 hover:text-emerald-600'}`}
                          >
                            <CheckCircle2 className="h-5 w-5" />
                          </button>
                        </Tooltip>
                        <Tooltip content="Flag for Review">
                          <button 
                            onClick={() => handleStatusChange(insight.id, 'flagged')}
                            className={`p-2.5 rounded-xl transition-all ${insight.status === 'flagged' ? 'bg-orange-500 text-white shadow-lg shadow-orange-200' : 'bg-slate-50 text-slate-400 hover:bg-orange-50 hover:text-orange-600'}`}
                          >
                            <Flag className="h-5 w-5" />
                          </button>
                        </Tooltip>
                        <Tooltip content="Reject">
                          <button 
                            onClick={() => handleStatusChange(insight.id, 'rejected')}
                            className={`p-2.5 rounded-xl transition-all ${insight.status === 'rejected' ? 'bg-slate-900 text-white shadow-lg shadow-slate-400' : 'bg-slate-50 text-slate-400 hover:bg-red-50 hover:text-red-600'}`}
                          >
                            <Trash2 className="h-5 w-5" />
                          </button>
                        </Tooltip>
                      </>
                    )}
                    <button 
                      onClick={() => setExpandedId(expandedId === insight.id ? null : insight.id)}
                      className="p-2.5 bg-slate-50 text-slate-400 rounded-xl hover:bg-slate-100 transition-all ml-2"
                    >
                      {expandedId === insight.id ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
                    </button>
                  </div>
                </div>

                <AnimatePresence>
                  {expandedId === insight.id && (
                    <motion.div 
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="mt-6 pt-6 border-t border-slate-50">
                        <div className="flex gap-6">
                          <div className="flex-1">
                            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Supporting Detail</h4>
                            <p className="text-slate-600 leading-relaxed bg-slate-50 p-4 rounded-2xl border border-slate-100">
                              {insight.detail}
                            </p>
                          </div>
                          <div className="w-64">
                            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Traceability</h4>
                            <div className="space-y-3">
                              <div className={`p-3 border rounded-xl shadow-sm flex items-center gap-3 ${getSourceTypeColor(insight.sourceType)}`}>
                                <div className="p-2 bg-white/50 rounded-lg">
                                  {getSourceIcon(insight.sourceType)}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="text-xs font-bold truncate">{insight.source}</div>
                                  <div className="text-[10px] opacity-75 font-medium capitalize">{insight.sourceType} Source</div>
                                </div>
                              </div>
                              {insight.confidence === 'low' && (
                                <div className="p-3 bg-red-50 border border-red-100 rounded-xl flex items-start gap-3">
                                  <AlertTriangle className="h-4 w-4 text-red-500 mt-0.5" />
                                  <div className="text-[10px] text-red-700 font-bold leading-tight">
                                    Low confidence due to conflicting statements in other sources.
                                  </div>
                                </div>
                              )}
                              {insight.brdSections && insight.brdSections.length > 0 && (
                                <div className="p-3 bg-blue-50 border border-blue-100 rounded-xl flex items-start gap-3">
                                  <FileText className="h-4 w-4 text-blue-500 mt-0.5" />
                                  <div className="text-[10px] text-blue-700 font-bold leading-tight">
                                    Used in BRD: {insight.brdSections.join(', ')}
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
        
        {filteredInsights.length === 0 && localInsights.length > 0 && (
          <div className="py-20 text-center bg-white rounded-[2rem] border border-dashed border-slate-200">
            <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-6 text-slate-300">
              <Search className="h-8 w-8" />
            </div>
            <h3 className="text-xl font-bold text-slate-900 mb-2">No insights found</h3>
            <p className="text-slate-500">Try adjusting your filters or search query.</p>
          </div>
        )}

        {localInsights.length === 0 && (
          <div className="py-20 text-center bg-white rounded-[2rem] border border-dashed border-slate-200">
            <div className="w-20 h-20 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-6 text-blue-400">
              <Lightbulb className="h-10 w-10" />
            </div>
            <h3 className="text-2xl font-bold text-slate-900 mb-3">No Insights Yet</h3>
            <p className="text-slate-500 max-w-md mx-auto mb-6">
              Connect data sources and let me analyze them to extract requirements, decisions, and stakeholder feedback.
            </p>
            <p className="text-sm text-slate-400">
              Go to <span className="font-semibold text-blue-600">Data Sources</span> to add meetings, emails, or documents.
            </p>
          </div>
        )}
      </div>

      {/* Footer Actions */}
      <div className="flex flex-col items-center gap-6 pt-10 border-t border-slate-100">
        <div className="flex items-center gap-3 text-sm font-medium text-slate-500">
          <Info className="h-4 w-4 text-blue-500" />
          {stats.approved < stats.total && stats.pending > 0 ? (
            <span>Please review and approve the remaining <span className="font-bold text-slate-900">{stats.pending}</span> pending insights.</span>
          ) : stats.approved === stats.total && stats.total > 0 ? (
            <span className="text-emerald-600 font-bold">All insights have been reviewed and validated!</span>
          ) : stats.total === 0 ? (
            <span>No insights available yet. Connect data sources to extract insights.</span>
          ) : (
            <span>Review completed. {stats.approved} insights approved, {stats.flagged} flagged for review.</span>
          )}
        </div>
        
        <div className="flex items-center gap-4">
          {hasBRD && brdNeedsUpdate && onNavigateToBRD && (
            <Button 
              variant="outline"
              size="lg" 
              onClick={onNavigateToBRD}
              className="h-16 px-8 text-lg font-bold rounded-2xl border-amber-200 text-amber-700 hover:bg-amber-50"
            >
              <RefreshCw className="mr-3 h-5 w-5" /> Update BRD
            </Button>
          )}
          
          <Button 
            size="lg" 
            onClick={onContinue}
            disabled={stats.approved === 0}
            className={`h-16 px-10 text-xl font-bold rounded-2xl shadow-2xl transition-all transform active:scale-95 ${stats.approved > 0 ? 'shadow-blue-500/30' : 'opacity-50 grayscale cursor-not-allowed'}`}
          >
            {hasBRD ? (
              <>View BRD <ArrowRight className="ml-3 h-6 w-6" /></>
            ) : (
              <>Approve Insights & Generate BRD <ArrowRight className="ml-3 h-6 w-6" /></>
            )}
          </Button>
        </div>
        
        <p className="text-slate-400 text-xs text-center max-w-md">
          {hasBRD 
            ? "Your BRD uses the approved insights. Regenerate to include any new approvals."
            : "Generated BRDs are based exclusively on approved insights. You can always come back and refine these later."
          }
        </p>
      </div>
    </div>
  );
};

export default InsightsReview;
