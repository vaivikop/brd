import React, { useState, useEffect, useMemo } from 'react';
import { 
  AlertTriangle, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  ChevronDown, 
  ChevronUp,
  Zap,
  Link2,
  ArrowRight,
  RefreshCw,
  Loader,
  Filter,
  Search,
  AlertCircle,
  ShieldAlert,
  ShieldCheck,
  FileText,
  ExternalLink,
  Lightbulb,
  Wand2,
  Trash2,
  Merge,
  Edit3,
  Check
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import Button from './Button';
import Tooltip from './Tooltip';
import { ProjectState, Insight, updateProjectContext } from '../utils/db';
import { detectConflicts, RequirementConflict, generateConflictResolution, ConflictResolutionAction } from '../utils/services/ai';

interface ConflictDetectionProps {
  project: ProjectState;
  onUpdate: (project: ProjectState) => void;
  onNavigateToInsights?: () => void;
  onNavigateToBRD?: () => void;
}

const SEVERITY_CONFIG = {
  critical: { bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-700', icon: XCircle, badge: 'bg-red-100 text-red-800' },
  major: { bg: 'bg-orange-50', border: 'border-orange-200', text: 'text-orange-700', icon: AlertTriangle, badge: 'bg-orange-100 text-orange-800' },
  minor: { bg: 'bg-yellow-50', border: 'border-yellow-200', text: 'text-yellow-700', icon: AlertCircle, badge: 'bg-yellow-100 text-yellow-800' }
};

const TYPE_CONFIG = {
  contradiction: { label: 'Contradiction', color: 'text-red-600', bg: 'bg-red-50' },
  ambiguity: { label: 'Ambiguity', color: 'text-purple-600', bg: 'bg-purple-50' },
  overlap: { label: 'Overlap', color: 'text-blue-600', bg: 'bg-blue-50' },
  dependency: { label: 'Dependency', color: 'text-amber-600', bg: 'bg-amber-50' }
};

const ConflictDetection: React.FC<ConflictDetectionProps> = ({ 
  project, 
  onUpdate, 
  onNavigateToInsights,
  onNavigateToBRD 
}) => {
  const [conflicts, setConflicts] = useState<RequirementConflict[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedConflict, setExpandedConflict] = useState<string | null>(null);
  const [filterSeverity, setFilterSeverity] = useState<string>('all');
  const [filterType, setFilterType] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [lastAnalyzed, setLastAnalyzed] = useState<Date | null>(null);
  const [solvingConflictId, setSolvingConflictId] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<ConflictResolutionAction | null>(null);
  const [showActionPreview, setShowActionPreview] = useState<string | null>(null);

  // Load conflicts from project state or run analysis
  useEffect(() => {
    if (project.insights && project.insights.length >= 2) {
      // Check if we have cached conflicts
      const cachedConflicts = (project as any).conflicts;
      if (cachedConflicts && Array.isArray(cachedConflicts)) {
        setConflicts(cachedConflicts);
        setLastAnalyzed(new Date((project as any).conflictsAnalyzedAt || Date.now()));
      }
    }
  }, [project]);

  const handleAnalyze = async () => {
    if (!project.insights || project.insights.length < 2) {
      setError('Need at least 2 insights to detect conflicts');
      return;
    }

    setIsAnalyzing(true);
    setError(null);

    try {
      const detected = await detectConflicts(project.insights);
      setConflicts(detected);
      setLastAnalyzed(new Date());
      
      // Save conflicts to project state
      const updated = await updateProjectContext({
        ...project,
        conflicts: detected,
        conflictsAnalyzedAt: new Date().toISOString()
      } as any);
      onUpdate(updated);
    } catch (err) {
      console.error('Conflict detection failed:', err);
      setError('Failed to analyze conflicts. Please try again.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleResolveConflict = async (conflictId: string, resolution: 'resolved' | 'deferred') => {
    const updatedConflicts = conflicts.map(c => 
      c.id === conflictId ? { ...c, status: resolution } : c
    );
    setConflicts(updatedConflicts);
    
    // Save to project state
    const updated = await updateProjectContext({
      ...project,
      conflicts: updatedConflicts
    } as any);
    onUpdate(updated);
  };

  // Generate AI resolution action for preview
  const handlePreviewSolution = async (conflict: RequirementConflict) => {
    if (solvingConflictId) return;
    
    const insight1 = project.insights.find(i => i.id === conflict.insight1.id);
    const insight2 = project.insights.find(i => i.id === conflict.insight2.id);
    
    if (!insight1 || !insight2) {
      setError('Could not find the conflicting insights. They may have been modified.');
      return;
    }

    setSolvingConflictId(conflict.id);
    setError(null);

    try {
      const action = await generateConflictResolution(conflict, insight1, insight2);
      setPendingAction(action);
      setShowActionPreview(conflict.id);
    } catch (err) {
      console.error('Failed to generate resolution:', err);
      setError('Failed to generate resolution action. Please try again.');
    } finally {
      setSolvingConflictId(null);
    }
  };

  // Apply the pending resolution action
  const handleApplySolution = async (conflict: RequirementConflict, action: ConflictResolutionAction) => {
    setSolvingConflictId(conflict.id);
    setError(null);

    try {
      let updatedInsights = [...project.insights];

      switch (action.actionType) {
        case 'delete_insight':
          // Remove the target insight
          updatedInsights = updatedInsights.filter(i => i.id !== action.targetInsightId);
          break;

        case 'merge_insights':
          // Update the kept insight with merged content
          if (action.mergedInsight) {
            updatedInsights = updatedInsights.map(i => {
              if (i.id === action.mergedInsight?.id) {
                return { ...i, ...action.mergedInsight };
              }
              return i;
            });
            // Delete the other insight
            updatedInsights = updatedInsights.filter(i => i.id !== action.targetInsightId);
          }
          break;

        case 'edit_insight':
          // Update the target insight with edited content
          if (action.editedContent) {
            updatedInsights = updatedInsights.map(i => {
              if (i.id === action.targetInsightId) {
                return { 
                  ...i, 
                  summary: action.editedContent!.summary,
                  detail: action.editedContent!.detail
                };
              }
              return i;
            });
          }
          break;

        case 'keep_both':
          // No changes to insights, just mark as resolved
          break;
      }

      // Mark conflict as resolved
      const updatedConflicts = conflicts.map(c => 
        c.id === conflict.id ? { ...c, status: 'resolved' as const } : c
      );
      setConflicts(updatedConflicts);

      // Save to project state
      const updated = await updateProjectContext({
        ...project,
        insights: updatedInsights,
        conflicts: updatedConflicts
      } as any);
      onUpdate(updated);

      // Reset state
      setPendingAction(null);
      setShowActionPreview(null);
    } catch (err) {
      console.error('Failed to apply resolution:', err);
      setError('Failed to apply resolution. Please try again.');
    } finally {
      setSolvingConflictId(null);
    }
  };

  // Cancel pending action
  const handleCancelAction = () => {
    setPendingAction(null);
    setShowActionPreview(null);
  };

  // Get icon for action type
  const getActionIcon = (actionType: string) => {
    switch (actionType) {
      case 'delete_insight': return <Trash2 className="h-4 w-4" />;
      case 'merge_insights': return <Merge className="h-4 w-4" />;
      case 'edit_insight': return <Edit3 className="h-4 w-4" />;
      case 'keep_both': return <Check className="h-4 w-4" />;
      default: return <Wand2 className="h-4 w-4" />;
    }
  };

  // Get human-readable action label
  const getActionLabel = (actionType: string) => {
    switch (actionType) {
      case 'delete_insight': return 'Delete Redundant Insight';
      case 'merge_insights': return 'Merge Insights';
      case 'edit_insight': return 'Edit & Clarify';
      case 'keep_both': return 'Keep Both (Add Note)';
      default: return 'Apply Solution';
    }
  };

  const filteredConflicts = useMemo(() => {
    return conflicts.filter(c => {
      const matchesSeverity = filterSeverity === 'all' || c.severity === filterSeverity;
      const matchesType = filterType === 'all' || c.type === filterType;
      const matchesStatus = filterStatus === 'all' || c.status === filterStatus;
      const matchesSearch = !searchQuery || 
        c.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.insight1.summary.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.insight2.summary.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesSeverity && matchesType && matchesStatus && matchesSearch;
    });
  }, [conflicts, filterSeverity, filterType, filterStatus, searchQuery]);

  const stats = useMemo(() => ({
    total: conflicts.length,
    critical: conflicts.filter(c => c.severity === 'critical').length,
    major: conflicts.filter(c => c.severity === 'major').length,
    minor: conflicts.filter(c => c.severity === 'minor').length,
    unresolved: conflicts.filter(c => c.status === 'unresolved').length,
    resolved: conflicts.filter(c => c.status === 'resolved').length
  }), [conflicts]);

  // Empty state - no insights yet
  if (!project.insights || project.insights.length < 2) {
    return (
      <div className="max-w-4xl mx-auto py-20 text-center animate-in fade-in duration-500">
        <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-6">
          <ShieldAlert className="h-10 w-10 text-slate-400" />
        </div>
        <h2 className="text-2xl font-bold text-slate-900 mb-4">Conflict Detection</h2>
        <p className="text-slate-600 mb-8 max-w-md mx-auto">
          Add at least 2 insights to enable AI-powered conflict detection across your requirements.
        </p>
        {onNavigateToInsights && (
          <Button onClick={onNavigateToInsights}>
            Go to Insights <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto pb-20 animate-in fade-in duration-500">
      {/* Header */}
      <header className="mb-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-orange-50 text-orange-700 text-xs font-bold uppercase tracking-wider mb-3 border border-orange-100">
              <ShieldAlert className="h-3 w-3" /> Conflict Detection Engine
            </div>
            <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Requirement Conflicts</h1>
            <p className="text-slate-600 mt-2">
              AI-powered detection of contradictions, ambiguities, and overlapping requirements across sources.
            </p>
          </div>
          <div className="flex items-center gap-3">
            {lastAnalyzed && (
              <span className="text-xs text-slate-500">
                Last analyzed: {lastAnalyzed.toLocaleTimeString()}
              </span>
            )}
            <Button 
              onClick={handleAnalyze}
              disabled={isAnalyzing}
              className="shadow-lg shadow-orange-500/20"
            >
              {isAnalyzing ? (
                <>
                  <Loader className="h-4 w-4 mr-2 animate-spin" /> Analyzing...
                </>
              ) : (
                <>
                  <RefreshCw className="h-4 w-4 mr-2" /> {conflicts.length > 0 ? 'Re-Analyze' : 'Detect Conflicts'}
                </>
              )}
            </Button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-6 gap-4 mb-6">
          <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
            <div className="text-2xl font-bold text-slate-900">{stats.total}</div>
            <div className="text-xs text-slate-500 font-medium uppercase tracking-wider">Total</div>
          </div>
          <div className="bg-red-50 p-4 rounded-2xl border border-red-100">
            <div className="text-2xl font-bold text-red-700">{stats.critical}</div>
            <div className="text-xs text-red-600 font-medium uppercase tracking-wider">Critical</div>
          </div>
          <div className="bg-orange-50 p-4 rounded-2xl border border-orange-100">
            <div className="text-2xl font-bold text-orange-700">{stats.major}</div>
            <div className="text-xs text-orange-600 font-medium uppercase tracking-wider">Major</div>
          </div>
          <div className="bg-yellow-50 p-4 rounded-2xl border border-yellow-100">
            <div className="text-2xl font-bold text-yellow-700">{stats.minor}</div>
            <div className="text-xs text-yellow-600 font-medium uppercase tracking-wider">Minor</div>
          </div>
          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
            <div className="text-2xl font-bold text-slate-700">{stats.unresolved}</div>
            <div className="text-xs text-slate-500 font-medium uppercase tracking-wider">Unresolved</div>
          </div>
          <div className="bg-emerald-50 p-4 rounded-2xl border border-emerald-100">
            <div className="text-2xl font-bold text-emerald-700">{stats.resolved}</div>
            <div className="text-xs text-emerald-600 font-medium uppercase tracking-wider">Resolved</div>
          </div>
        </div>

        {/* Filters */}
        <div className="space-y-3 lg:space-y-0 lg:flex lg:flex-wrap items-center gap-3 bg-white p-3 lg:p-4 rounded-xl lg:rounded-2xl border border-slate-100 shadow-sm">
          <div className="relative flex-1 min-w-0">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search conflicts..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-slate-50 rounded-xl text-sm focus:ring-2 focus:ring-orange-500 outline-none"
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={filterSeverity}
              onChange={(e) => setFilterSeverity(e.target.value)}
              className="flex-1 sm:flex-none px-3 py-2 bg-slate-50 rounded-xl text-sm font-medium focus:ring-2 focus:ring-orange-500 outline-none"
            >
              <option value="all">All Severities</option>
              <option value="critical">Critical</option>
              <option value="major">Major</option>
              <option value="minor">Minor</option>
            </select>
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="flex-1 sm:flex-none px-3 py-2 bg-slate-50 rounded-xl text-sm font-medium focus:ring-2 focus:ring-orange-500 outline-none"
            >
              <option value="all">All Types</option>
              <option value="contradiction">Contradictions</option>
              <option value="ambiguity">Ambiguities</option>
              <option value="overlap">Overlaps</option>
              <option value="dependency">Dependencies</option>
            </select>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="flex-1 sm:flex-none px-3 py-2 bg-slate-50 rounded-xl text-sm font-medium focus:ring-2 focus:ring-orange-500 outline-none"
            >
              <option value="all">All Status</option>
              <option value="unresolved">Unresolved</option>
              <option value="resolved">Resolved</option>
              <option value="deferred">Deferred</option>
            </select>
          </div>
        </div>
      </header>

      {/* Error State */}
      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-2xl flex items-center gap-3">
          <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0" />
          <span className="text-red-700 font-medium">{error}</span>
        </div>
      )}

      {/* Loading State */}
      {isAnalyzing && conflicts.length === 0 && (
        <div className="text-center py-20">
          <div className="w-16 h-16 bg-orange-50 rounded-full flex items-center justify-center mx-auto mb-6">
            <Loader className="h-8 w-8 text-orange-600 animate-spin" />
          </div>
          <h3 className="text-xl font-bold text-slate-900 mb-2">Analyzing Requirements...</h3>
          <p className="text-slate-500">AI is comparing {project.insights.length} insights for conflicts</p>
        </div>
      )}

      {/* No Conflicts Found */}
      {!isAnalyzing && conflicts.length === 0 && lastAnalyzed && (
        <div className="text-center py-20 bg-emerald-50 rounded-3xl border border-emerald-100">
          <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <ShieldCheck className="h-10 w-10 text-emerald-600" />
          </div>
          <h3 className="text-2xl font-bold text-emerald-900 mb-2">No Conflicts Detected!</h3>
          <p className="text-emerald-700 max-w-md mx-auto mb-6">
            Your requirements are consistent and well-aligned. The BRD can be generated with high confidence.
          </p>
          {onNavigateToBRD && (
            <Button onClick={onNavigateToBRD} className="bg-emerald-600 hover:bg-emerald-700">
              Generate BRD <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          )}
        </div>
      )}

      {/* Conflict List */}
      {filteredConflicts.length > 0 && (
        <div className="space-y-4">
          {filteredConflicts.map((conflict, idx) => {
            const severityConfig = SEVERITY_CONFIG[conflict.severity];
            const typeConfig = TYPE_CONFIG[conflict.type];
            const SeverityIcon = severityConfig.icon;
            const isExpanded = expandedConflict === conflict.id;

            return (
              <motion.div
                key={conflict.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.05 }}
                className={`bg-white rounded-2xl border ${severityConfig.border} shadow-sm overflow-hidden ${
                  conflict.status === 'resolved' ? 'opacity-60' : ''
                }`}
              >
                {/* Conflict Header */}
                <div 
                  className={`p-6 cursor-pointer hover:bg-slate-50 transition-colors ${severityConfig.bg}`}
                  onClick={() => setExpandedConflict(isExpanded ? null : conflict.id)}
                >
                  <div className="flex items-start gap-4">
                    <div className={`p-2 rounded-xl ${severityConfig.bg}`}>
                      <SeverityIcon className={`h-5 w-5 ${severityConfig.text}`} />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${severityConfig.badge}`}>
                          {conflict.severity.toUpperCase()}
                        </span>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${typeConfig.bg} ${typeConfig.color}`}>
                          {typeConfig.label}
                        </span>
                        {conflict.status !== 'unresolved' && (
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                            conflict.status === 'resolved' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'
                          }`}>
                            {conflict.status.charAt(0).toUpperCase() + conflict.status.slice(1)}
                          </span>
                        )}
                      </div>
                      <p className={`font-medium ${severityConfig.text}`}>{conflict.description}</p>
                      <div className="flex items-center gap-4 mt-3 text-xs text-slate-500">
                        <span className="flex items-center gap-1">
                          <Link2 className="h-3 w-3" /> {conflict.affectedBRDSections.join(', ')}
                        </span>
                      </div>
                    </div>
                    <button className="p-2 hover:bg-white rounded-lg transition-colors">
                      {isExpanded ? <ChevronUp className="h-5 w-5 text-slate-400" /> : <ChevronDown className="h-5 w-5 text-slate-400" />}
                    </button>
                  </div>
                </div>

                {/* Expanded Details */}
                <AnimatePresence>
                  {isExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="border-t border-slate-100"
                    >
                      <div className="p-6 space-y-6">
                        {/* Conflicting Sources */}
                        <div className="grid md:grid-cols-2 gap-4">
                          <div className="p-4 bg-slate-50 rounded-xl">
                            <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Source A</div>
                            <h4 className="font-medium text-slate-900 mb-1">{conflict.insight1.summary}</h4>
                            <p className="text-sm text-slate-500 flex items-center gap-1">
                              <FileText className="h-3 w-3" /> {conflict.insight1.source}
                            </p>
                          </div>
                          <div className="p-4 bg-slate-50 rounded-xl">
                            <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Source B</div>
                            <h4 className="font-medium text-slate-900 mb-1">{conflict.insight2.summary}</h4>
                            <p className="text-sm text-slate-500 flex items-center gap-1">
                              <FileText className="h-3 w-3" /> {conflict.insight2.source}
                            </p>
                          </div>
                        </div>

                        {/* Suggested Resolution */}
                        <div className="p-4 bg-blue-50 rounded-xl border border-blue-100">
                          <div className="flex items-start gap-3">
                            <Lightbulb className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
                            <div>
                              <h4 className="font-bold text-blue-900 mb-1">Suggested Resolution</h4>
                              <p className="text-blue-800 text-sm">{conflict.suggestedResolution}</p>
                            </div>
                          </div>
                        </div>

                        {/* Action Preview Panel */}
                        {showActionPreview === conflict.id && pendingAction && (
                          <motion.div 
                            initial={{ opacity: 0, y: -10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="p-4 bg-gradient-to-r from-violet-50 to-purple-50 rounded-xl border border-violet-200"
                          >
                            <div className="flex items-center gap-2 mb-3">
                              <div className="p-1.5 bg-violet-100 rounded-lg">
                                {getActionIcon(pendingAction.actionType)}
                              </div>
                              <h4 className="font-bold text-violet-900">AI Resolution Action</h4>
                              <span className={`ml-auto px-2 py-0.5 rounded-full text-xs font-medium ${
                                pendingAction.confidence === 'high' ? 'bg-emerald-100 text-emerald-700' :
                                pendingAction.confidence === 'medium' ? 'bg-amber-100 text-amber-700' :
                                'bg-slate-100 text-slate-600'
                              }`}>
                                {pendingAction.confidence.toUpperCase()} CONFIDENCE
                              </span>
                            </div>
                            
                            <div className="space-y-3">
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-medium text-violet-600 uppercase">Action:</span>
                                <span className="text-sm font-semibold text-violet-900">{getActionLabel(pendingAction.actionType)}</span>
                              </div>
                              
                              <p className="text-sm text-violet-800 bg-white/50 p-3 rounded-lg">
                                {pendingAction.explanation}
                              </p>

                              {pendingAction.actionType === 'delete_insight' && pendingAction.targetInsightId && (
                                <div className="bg-red-50 p-3 rounded-lg border border-red-100">
                                  <div className="flex items-center gap-2 text-red-700 text-sm">
                                    <Trash2 className="h-4 w-4" />
                                    <span className="font-medium">Will delete:</span>
                                    <span>
                                      {conflict.insight1.id === pendingAction.targetInsightId 
                                        ? conflict.insight1.summary 
                                        : conflict.insight2.summary}
                                    </span>
                                  </div>
                                </div>
                              )}

                              {pendingAction.actionType === 'merge_insights' && pendingAction.mergedInsight && (
                                <div className="bg-indigo-50 p-3 rounded-lg border border-indigo-100">
                                  <div className="text-indigo-700 text-sm">
                                    <div className="flex items-center gap-2 mb-2">
                                      <Merge className="h-4 w-4" />
                                      <span className="font-medium">Merged Result:</span>
                                    </div>
                                    <p className="font-semibold">{pendingAction.mergedInsight.summary}</p>
                                    <p className="text-xs mt-1 opacity-75">Source: {pendingAction.mergedInsight.source}</p>
                                  </div>
                                </div>
                              )}

                              {pendingAction.actionType === 'edit_insight' && pendingAction.editedContent && (
                                <div className="bg-amber-50 p-3 rounded-lg border border-amber-100">
                                  <div className="text-amber-700 text-sm">
                                    <div className="flex items-center gap-2 mb-2">
                                      <Edit3 className="h-4 w-4" />
                                      <span className="font-medium">Updated Content:</span>
                                    </div>
                                    <p className="font-semibold">{pendingAction.editedContent.summary}</p>
                                  </div>
                                </div>
                              )}

                              <div className="flex items-center gap-3 pt-2">
                                <Button 
                                  onClick={() => handleApplySolution(conflict, pendingAction)}
                                  disabled={solvingConflictId === conflict.id}
                                  className="bg-violet-600 hover:bg-violet-700"
                                >
                                  {solvingConflictId === conflict.id ? (
                                    <>
                                      <Loader className="h-4 w-4 mr-2 animate-spin" /> Applying...
                                    </>
                                  ) : (
                                    <>
                                      <Check className="h-4 w-4 mr-2" /> Apply Solution
                                    </>
                                  )}
                                </Button>
                                <Button 
                                  variant="outline"
                                  onClick={handleCancelAction}
                                  disabled={solvingConflictId === conflict.id}
                                >
                                  Cancel
                                </Button>
                              </div>
                            </div>
                          </motion.div>
                        )}

                        {/* Actions */}
                        {conflict.status === 'unresolved' && (
                          <div className="flex flex-wrap items-center gap-3 pt-2">
                            {/* Auto-Solve Button */}
                            {showActionPreview !== conflict.id && (
                              <Button 
                                onClick={() => handlePreviewSolution(conflict)}
                                disabled={solvingConflictId !== null}
                                className="bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 shadow-lg shadow-violet-500/20"
                              >
                                {solvingConflictId === conflict.id ? (
                                  <>
                                    <Loader className="h-4 w-4 mr-2 animate-spin" /> Analyzing...
                                  </>
                                ) : (
                                  <>
                                    <Wand2 className="h-4 w-4 mr-2" /> Auto-Solve
                                  </>
                                )}
                              </Button>
                            )}
                            <Button 
                              onClick={() => handleResolveConflict(conflict.id, 'resolved')}
                              className="bg-emerald-600 hover:bg-emerald-700"
                            >
                              <CheckCircle2 className="h-4 w-4 mr-2" /> Mark Resolved
                            </Button>
                            <Button 
                              variant="outline"
                              onClick={() => handleResolveConflict(conflict.id, 'deferred')}
                            >
                              <Clock className="h-4 w-4 mr-2" /> Defer
                            </Button>
                            {onNavigateToInsights && (
                              <Button 
                                variant="ghost"
                                onClick={onNavigateToInsights}
                              >
                                <ExternalLink className="h-4 w-4 mr-2" /> View in Insights
                              </Button>
                            )}
                          </div>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* No Results After Filter */}
      {filteredConflicts.length === 0 && conflicts.length > 0 && (
        <div className="text-center py-12 bg-slate-50 rounded-2xl">
          <Filter className="h-10 w-10 text-slate-300 mx-auto mb-4" />
          <h3 className="text-lg font-bold text-slate-700 mb-2">No matches found</h3>
          <p className="text-slate-500">Try adjusting your filters or search query</p>
        </div>
      )}
    </div>
  );
};

export default ConflictDetection;
