/**
 * InsightsReview - Enterprise Grade
 * 
 * Features:
 * - Virtualized list for 500+ insights
 * - Dynamic AI confidence scoring
 * - Semantic duplicate detection
 * - Inline editing with AI refinement
 * - MoSCoW prioritization
 * - Source preview modal
 * - Collaboration (comments, assignments)
 * - Conflict detection
 * - Keyboard shortcuts
 */

import React, { useState, useEffect, useMemo, useCallback, useRef, CSSProperties, ReactElement } from 'react';
import { List, ListImperativeAPI } from 'react-window';
import { 
  Lightbulb, CheckCircle2, Flag, X, ChevronRight, Search,
  AlertTriangle, FileText, Users, Clock, ArrowRight, Sparkles,
  AlertCircle, ThumbsUp, ThumbsDown, Eye, Zap, Target, HelpCircle,
  CheckCheck, RotateCcw, Keyboard, Edit3, MessageSquare, UserPlus,
  GitMerge, Copy, ChevronDown, Save, Wand2, ExternalLink, Link2,
  Star, StarOff, GripVertical, MoreHorizontal, Send
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import Button from './Button';
import Tooltip from './Tooltip';
import { 
  ProjectState, Insight, MoSCoWPriority, InsightComment, SourceReference,
  updateInsightStatus, bulkUpdateInsightStatus, updateInsight, 
  bulkUpdateInsights, addInsightComment, mergeInsights, 
  reorderInsightPriorities, getProjectStats 
} from '../utils/db';
import { SourceIcon, getSourceTypeColor } from '../utils/sourceIcons';
import { refineInsight } from '../services/ai';
import {
  enhanceInsights, findDuplicateInsights, calculateInsightSimilarity,
  sortByPriority, suggestPriority
} from '../utils/insightProcessing';

interface InsightsReviewProps {
  project: ProjectState;
  onUpdate: (project: ProjectState) => void;
  onContinue: () => void;
  onNavigateToBRD?: () => void;
}

type CategoryTab = 'all' | 'requirement' | 'decision' | 'stakeholder' | 'timeline' | 'question';
type ViewMode = 'list' | 'kanban' | 'priority';

// Props passed to virtualized row component via rowProps
interface InsightRowData {
  filteredInsights: Insight[];
  expandedInsightId: string | null;
  updatingInsightId: string | null;
  duplicateGroups: Array<{ primary: Insight; duplicates: Insight[] }>;
  categoryConfig: Record<string, { icon: React.ElementType; label: string; color: string }>;
  handleStatusChange: (id: string, status: 'approved' | 'flagged' | 'rejected' | 'pending') => void;
  handlePriorityChange: (id: string, priority: MoSCoWPriority) => void;
  handleAddComment: (id: string, text: string) => void;
  handleMergeDuplicates: (primaryId: string, duplicateIds: string[]) => void;
  setExpandedInsightId: (id: string | null) => void;
  setSourcePreviewInsight: (insight: Insight | null) => void;
  setEditingInsight: (insight: Insight | null) => void;
}

// MoSCoW Badge Component
const MoSCoWBadge: React.FC<{ priority: MoSCoWPriority; size?: 'sm' | 'md' }> = ({ priority, size = 'sm' }) => {
  const config: Record<MoSCoWPriority, { label: string; bg: string; ring: string }> = {
    must: { label: 'Must', bg: 'bg-rose-500 text-white', ring: 'ring-rose-200' },
    should: { label: 'Should', bg: 'bg-amber-500 text-white', ring: 'ring-amber-200' },
    could: { label: 'Could', bg: 'bg-sky-500 text-white', ring: 'ring-sky-200' },
    wont: { label: "Won't", bg: 'bg-slate-400 text-white', ring: 'ring-slate-200' },
    unset: { label: 'Unset', bg: 'bg-slate-100 text-slate-500 border border-slate-200', ring: 'ring-slate-100' }
  };
  
  const { label, bg, ring } = config[priority];
  const sizeClass = size === 'sm' ? 'px-2 py-0.5 text-[10px]' : 'px-2.5 py-1 text-xs';
  
  return (
    <span className={`${bg} ${sizeClass} font-semibold uppercase rounded-full shadow-sm ring-1 ${ring} tracking-wide`}>
      {label}
    </span>
  );
};

// Confidence Score Bar
const ConfidenceBar: React.FC<{ score: number; size?: 'sm' | 'md' }> = ({ score, size = 'sm' }) => {
  const barColor = score >= 70 ? 'bg-emerald-500' : score >= 40 ? 'bg-amber-500' : 'bg-rose-500';
  const textColor = score >= 70 ? 'text-emerald-600' : score >= 40 ? 'text-amber-600' : 'text-rose-600';
  const width = size === 'sm' ? 'w-20' : 'w-28';
  const height = size === 'sm' ? 'h-1.5' : 'h-2';
  
  return (
    <div className="flex items-center gap-2">
      <div className={`${width} ${height} bg-slate-200 rounded-full overflow-hidden`}>
        <div 
          className={`${height} ${barColor} rounded-full transition-all duration-700 ease-out`}
          style={{ width: `${score}%` }}
        />
      </div>
      <span className={`text-[11px] font-semibold ${textColor} tabular-nums`}>{score}%</span>
    </div>
  );
};

// Source Preview Modal
const SourcePreviewModal: React.FC<{
  insight: Insight;
  sources: SourceReference[];
  onClose: () => void;
}> = ({ insight, sources, onClose }) => {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.95, y: 20 }}
        onClick={e => e.stopPropagation()}
        className="bg-white rounded-xl shadow-2xl max-w-3xl w-full max-h-[80vh] overflow-hidden border border-slate-200"
      >
        <div className="p-6 border-b border-slate-100">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="text-lg font-semibold text-slate-900">{insight.summary}</h3>
              <p className="text-sm text-slate-500 mt-1">
                {sources.length + 1} source{sources.length > 0 ? 's' : ''} support this insight
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
            >
              <X className="h-5 w-5 text-slate-400" />
            </button>
          </div>
        </div>
        
        <div className="p-6 max-h-[60vh] overflow-y-auto space-y-4">
          {/* Primary Source */}
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-3">
              <SourceIcon type={insight.sourceType} className="h-4 w-4 text-slate-600" />
              <span className="text-sm font-medium text-slate-900">{insight.source}</span>
              <span className="text-xs text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded font-medium">Primary</span>
            </div>
            <p className="text-sm text-slate-700 leading-relaxed bg-white p-3 rounded-lg border border-slate-100">
              {insight.detail}
            </p>
          </div>
          
          {/* Supporting Sources */}
          {sources.map((source, idx) => (
            <div key={idx} className="bg-white border border-slate-200 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-3">
                <SourceIcon type={source.sourceType} className="h-4 w-4 text-slate-500" />
                <span className="text-sm font-medium text-slate-700">{source.sourceName}</span>
                <span className="text-xs text-slate-400">{new Date(source.timestamp).toLocaleDateString()}</span>
              </div>
              <p className="text-sm text-slate-600 leading-relaxed bg-slate-50 p-3 rounded-lg">
                {source.snippet}
              </p>
            </div>
          ))}
        </div>
      </motion.div>
    </motion.div>
  );
};

// Edit Insight Modal
const EditInsightModal: React.FC<{
  insight: Insight;
  onSave: (summary: string, detail: string) => void;
  onClose: () => void;
  onAIRefine?: (insight: Insight) => Promise<{ summary: string; detail: string }>;
}> = ({ insight, onSave, onClose, onAIRefine }) => {
  const [summary, setSummary] = useState(insight.summary);
  const [detail, setDetail] = useState(insight.detail);
  const [isRefining, setIsRefining] = useState(false);
  
  const handleAIRefine = async () => {
    if (!onAIRefine) return;
    setIsRefining(true);
    try {
      const refined = await onAIRefine(insight);
      setSummary(refined.summary);
      setDetail(refined.detail);
    } catch (err) {
      console.error('AI refinement failed:', err);
    } finally {
      setIsRefining(false);
    }
  };
  
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.95, y: 20 }}
        onClick={e => e.stopPropagation()}
        className="bg-white rounded-xl shadow-2xl max-w-2xl w-full border border-slate-200"
      >
        <div className="p-6 border-b border-slate-100">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-slate-900">Edit Insight</h3>
            <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg transition-colors">
              <X className="h-5 w-5 text-slate-400" />
            </button>
          </div>
        </div>
        
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Summary</label>
            <input
              type="text"
              value={summary}
              onChange={e => setSummary(e.target.value)}
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent focus:bg-white transition-all"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Detail</label>
            <textarea
              value={detail}
              onChange={e => setDetail(e.target.value)}
              rows={4}
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent focus:bg-white resize-none transition-all"
            />
          </div>
          
          {insight.originalSummary && insight.isEdited && (
            <div className="bg-amber-50 border border-amber-100 rounded-lg p-4">
              <p className="text-xs font-medium text-amber-700 mb-1">Original (AI-generated):</p>
              <p className="text-sm text-amber-900">{insight.originalSummary}</p>
            </div>
          )}
        </div>
        
        <div className="p-6 border-t border-slate-100 flex items-center justify-between bg-slate-50/50">
          <button
            onClick={handleAIRefine}
            disabled={isRefining || !onAIRefine}
            className="flex items-center gap-2 px-4 py-2.5 text-slate-700 bg-white border border-slate-200 hover:border-slate-300 rounded-lg transition-all disabled:opacity-50"
          >
            {isRefining ? (
              <div className="h-4 w-4 border-2 border-slate-400 border-t-transparent rounded-full animate-spin" />
            ) : (
              <Wand2 className="h-4 w-4" />
            )}
            Refine with AI
          </button>
          
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2.5 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={() => onSave(summary, detail)}
              className="px-5 py-2.5 bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-colors flex items-center gap-2"
            >
              <Save className="h-4 w-4" />
              Save Changes
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
};

// Comment Section
const CommentsSection: React.FC<{
  comments: InsightComment[];
  onAddComment: (text: string) => void;
}> = ({ comments, onAddComment }) => {
  const [newComment, setNewComment] = useState('');
  
  const handleSubmit = () => {
    if (!newComment.trim()) return;
    onAddComment(newComment);
    setNewComment('');
  };
  
  return (
    <div className="mt-3 pt-3 border-t border-slate-100">
      {comments.length > 0 && (
        <div className="space-y-2 mb-3 max-h-28 overflow-y-auto">
          {comments.slice(0, 3).map(comment => (
            <div key={comment.id} className="flex gap-2">
              <div className="w-6 h-6 bg-slate-200 rounded-full flex items-center justify-center text-xs font-semibold text-slate-600 shrink-0">
                {comment.authorName.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-slate-800">{comment.authorName}</span>
                  <span className="text-[10px] text-slate-400">{new Date(comment.timestamp).toLocaleDateString()}</span>
                </div>
                <p className="text-xs text-slate-600 mt-0.5 line-clamp-2">{comment.text}</p>
              </div>
            </div>
          ))}
          {comments.length > 3 && (
            <button className="text-xs text-blue-600 hover:text-blue-700 font-medium">
              View {comments.length - 3} more comments
            </button>
          )}
        </div>
      )}
      
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={newComment}
          onChange={e => setNewComment(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSubmit()}
          placeholder="Add a comment..."
          className="flex-1 px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent focus:bg-white transition-all placeholder:text-slate-400"
        />
        <button
          onClick={handleSubmit}
          disabled={!newComment.trim()}
          className="p-2 bg-slate-900 text-white rounded-lg disabled:opacity-40 hover:bg-slate-800 transition-all"
        >
          <Send className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
};

const PRIORITY_CYCLE: MoSCoWPriority[] = ['unset', 'must', 'should', 'could', 'wont'];
const PRIORITY_LABELS: Record<MoSCoWPriority, string> = {
  must: 'Must Have', should: 'Should Have', could: 'Could Have', wont: "Won't Have", unset: 'Not Set'
};

// Priority cycle button — click to step through priorities
const PrioritySelector: React.FC<{
  value: MoSCoWPriority;
  onChange: (priority: MoSCoWPriority) => void;
}> = ({ value, onChange }) => {
  const cycle = () => {
    const idx = PRIORITY_CYCLE.indexOf(value);
    const next = PRIORITY_CYCLE[(idx + 1) % PRIORITY_CYCLE.length];
    onChange(next);
  };

  return (
    <Tooltip content={`Priority: ${PRIORITY_LABELS[value]} — click to change`}>
      <button
        onClick={cycle}
        className="flex items-center gap-1 px-2 py-1 rounded-lg bg-slate-50 border border-slate-200 hover:bg-white hover:border-slate-300 transition-all duration-150"
      >
        <MoSCoWBadge priority={value} />
        <ChevronDown className="h-3 w-3 text-slate-400" />
      </button>
    </Tooltip>
  );
};

// Virtualized Row Component for react-window v2
const InsightRowComponent = (props: {
  ariaAttributes: { "aria-posinset": number; "aria-setsize": number; role: "listitem" };
  index: number;
  style: CSSProperties;
} & InsightRowData): ReactElement | null => {
  const {
    index, style, filteredInsights, expandedInsightId, updatingInsightId, duplicateGroups,
    categoryConfig, handleStatusChange, handlePriorityChange, handleAddComment,
    handleMergeDuplicates, setExpandedInsightId, setSourcePreviewInsight, setEditingInsight
  } = props;
  
  const insight = filteredInsights[index];
  if (!insight) return null;
  
  const config = categoryConfig[insight.category as keyof typeof categoryConfig] || categoryConfig.question;
  const CategoryIcon = config.icon;
  const isExpanded = expandedInsightId === insight.id;
  const isUpdating = updatingInsightId === insight.id;
  const hasDuplicates = duplicateGroups.some(g => g.primary.id === insight.id);
  
  // Status-based styling
  const statusStyles = {
    approved: 'bg-emerald-50/50 border-l-emerald-500',
    flagged: 'bg-amber-50/50 border-l-amber-500',
    rejected: 'bg-slate-50 border-l-slate-400 opacity-60',
    pending: 'bg-white border-l-slate-200 hover:border-l-blue-400'
  };
  
  return (
    <div style={style} className="px-4 py-1.5">
      <div 
        className={`group h-full rounded-xl border border-slate-200 transition-all duration-200 overflow-hidden border-l-4 ${
          isUpdating ? 'ring-2 ring-blue-400 ring-offset-1' : ''
        } ${statusStyles[insight.status] || statusStyles.pending}`}
      >
        <div className="p-4 h-full flex flex-col">
          {/* Top Row: Category + Title + Actions */}
          <div className="flex items-start gap-3 mb-3">
            {/* Category Badge */}
            <div className={`shrink-0 w-9 h-9 rounded-lg bg-${config.color}-100 flex items-center justify-center`}>
              <CategoryIcon className={`h-4.5 w-4.5 text-${config.color}-600`} />
            </div>
            
            {/* Title & Summary */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-0.5">
                <span className={`text-[10px] font-bold uppercase tracking-wider text-${config.color}-600`}>
                  {config.label}
                </span>
                {insight.isEdited && (
                  <span className="text-[9px] text-amber-600 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded font-medium">
                    Edited
                  </span>
                )}
              </div>
              <h3 className="text-sm font-semibold text-slate-900 leading-snug line-clamp-2">
                {insight.summary}
              </h3>
            </div>
            
            {/* Action Buttons */}
            <div className="shrink-0 flex items-center gap-1 opacity-60 group-hover:opacity-100 transition-opacity">
              {isUpdating ? (
                <div className="p-2">
                  <div className="h-4 w-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                </div>
              ) : (
                <>
                  <Tooltip content="Approve">
                    <button 
                      onClick={() => handleStatusChange(insight.id, 'approved')}
                      className={`p-2 rounded-lg transition-all ${
                        insight.status === 'approved' 
                          ? 'bg-emerald-500 text-white' 
                          : 'text-slate-400 hover:bg-emerald-50 hover:text-emerald-600'
                      }`}
                    >
                      <ThumbsUp className="h-4 w-4" />
                    </button>
                  </Tooltip>
                  <Tooltip content="Flag">
                    <button 
                      onClick={() => handleStatusChange(insight.id, 'flagged')}
                      className={`p-2 rounded-lg transition-all ${
                        insight.status === 'flagged' 
                          ? 'bg-amber-500 text-white' 
                          : 'text-slate-400 hover:bg-amber-50 hover:text-amber-600'
                      }`}
                    >
                      <Flag className="h-4 w-4" />
                    </button>
                  </Tooltip>
                  <Tooltip content="Reject">
                    <button 
                      onClick={() => handleStatusChange(insight.id, 'rejected')}
                      className={`p-2 rounded-lg transition-all ${
                        insight.status === 'rejected' 
                          ? 'bg-slate-600 text-white' 
                          : 'text-slate-400 hover:bg-slate-100 hover:text-slate-600'
                      }`}
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </Tooltip>
                  <div className="w-px h-5 bg-slate-200 mx-1" />
                  <Tooltip content="Edit">
                    <button 
                      onClick={() => setEditingInsight(insight)}
                      className="p-2 rounded-lg text-slate-400 hover:bg-violet-50 hover:text-violet-600 transition-all"
                    >
                      <Edit3 className="h-4 w-4" />
                    </button>
                  </Tooltip>
                  <Tooltip content={isExpanded ? "Collapse" : "Expand"}>
                    <button 
                      onClick={() => setExpandedInsightId(isExpanded ? null : insight.id)}
                      className="p-2 rounded-lg text-slate-400 hover:bg-slate-100 transition-all"
                    >
                      <ChevronDown className={`h-4 w-4 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} />
                    </button>
                  </Tooltip>
                </>
              )}
            </div>
          </div>
          
          {/* Meta Row */}
          <div className="flex flex-wrap items-center gap-2">
            <PrioritySelector 
              value={insight.priority || 'unset'} 
              onChange={(p) => handlePriorityChange(insight.id, p)} 
            />
            
            <Tooltip content={`AI Confidence: ${insight.confidenceScore || 50}%`}>
              <div className="flex items-center gap-1.5 px-2 py-1 bg-slate-50 rounded-lg border border-slate-100 cursor-help">
                <ConfidenceBar score={insight.confidenceScore || 50} />
              </div>
            </Tooltip>
            
            <Tooltip content="View Source">
              <button
                onClick={() => setSourcePreviewInsight(insight)}
                className="flex items-center gap-1.5 px-2.5 py-1 bg-slate-50 rounded-lg border border-slate-100 text-slate-600 hover:bg-blue-50 hover:border-blue-200 hover:text-blue-600 transition-all text-xs"
              >
                <SourceIcon type={insight.sourceType} className="h-3.5 w-3.5" />
                <span className="font-medium truncate max-w-[120px]">{insight.source}</span>
                {(insight.evidenceCount || 1) > 1 && (
                  <span className="bg-blue-500 text-white px-1.5 py-0.5 rounded text-[10px] font-bold">
                    +{(insight.evidenceCount || 1) - 1}
                  </span>
                )}
              </button>
            </Tooltip>
            
            {insight.hasConflicts && (
              <Tooltip content="Conflicting information detected">
                <span className="flex items-center gap-1 px-2 py-1 bg-rose-50 border border-rose-200 text-rose-600 rounded-lg text-xs font-medium cursor-help">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  Conflict
                </span>
              </Tooltip>
            )}
            
            {hasDuplicates && (
              <Tooltip content="Merge similar insights">
                <button
                  onClick={() => {
                    const group = duplicateGroups.find(g => g.primary.id === insight.id);
                    if (group) handleMergeDuplicates(insight.id, group.duplicates.map(d => d.id));
                  }}
                  className="flex items-center gap-1 px-2 py-1 bg-violet-50 border border-violet-200 text-violet-600 rounded-lg text-xs font-medium hover:bg-violet-100 transition-all"
                >
                  <GitMerge className="h-3.5 w-3.5" />
                  Merge {duplicateGroups.find(g => g.primary.id === insight.id)?.duplicates.length}
                </button>
              </Tooltip>
            )}
            
            {insight.comments && insight.comments.length > 0 && (
              <Tooltip content={`${insight.comments.length} comment(s)`}>
                <span className="flex items-center gap-1 px-2 py-1 bg-slate-50 rounded-lg border border-slate-100 text-slate-500 text-xs cursor-help">
                  <MessageSquare className="h-3.5 w-3.5" />
                  {insight.comments.length}
                </span>
              </Tooltip>
            )}
          </div>
          
          {/* Expanded Content */}
          {isExpanded && (
            <div className="mt-3 pt-3 border-t border-slate-100 flex-1 overflow-hidden">
              <div className="bg-slate-50 rounded-lg p-3 text-sm text-slate-700 leading-relaxed max-h-28 overflow-y-auto">
                {insight.detail}
              </div>
              
              {insight.stakeholderMentions && insight.stakeholderMentions.length > 0 && (
                <div className="flex items-center gap-2 mt-2 p-2 bg-violet-50/50 border border-violet-100 rounded-lg">
                  <Users className="h-3.5 w-3.5 text-violet-500 shrink-0" />
                  <span className="text-xs text-violet-600 font-medium">Stakeholders:</span>
                  <div className="flex flex-wrap gap-1">
                    {insight.stakeholderMentions.slice(0, 4).map((s, i) => (
                      <span key={i} className="text-xs bg-violet-500 text-white px-1.5 py-0.5 rounded">{s}</span>
                    ))}
                    {insight.stakeholderMentions.length > 4 && (
                      <span className="text-xs text-violet-500 font-medium">+{insight.stakeholderMentions.length - 4}</span>
                    )}
                  </div>
                </div>
              )}
              
              <CommentsSection
                comments={insight.comments || []}
                onAddComment={(text) => handleAddComment(insight.id, text)}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// Main Component
const InsightsReview: React.FC<InsightsReviewProps> = ({ project, onUpdate, onContinue, onNavigateToBRD }) => {
  // State
  const [activeTab, setActiveTab] = useState<CategoryTab>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [showOnlyPending, setShowOnlyPending] = useState(false);
  const [updatingInsightId, setUpdatingInsightId] = useState<string | null>(null);
  const [expandedInsightId, setExpandedInsightId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [localInsights, setLocalInsights] = useState<Insight[]>([]);
  
  // Modals
  const [sourcePreviewInsight, setSourcePreviewInsight] = useState<Insight | null>(null);
  const [editingInsight, setEditingInsight] = useState<Insight | null>(null);
  const [selectedInsights, setSelectedInsights] = useState<Set<string>>(new Set());
  
  // Refs
  const listRef = useRef<ListImperativeAPI>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Enhance insights with computed fields on load
  useEffect(() => {
    if (project.insights && project.insights.length > 0) {
      const enhanced = enhanceInsights(project.insights);
      setLocalInsights(enhanced);
    } else {
      setLocalInsights([]);
    }
  }, [project.insights]);

  const projectStats = useMemo(() => getProjectStats(project), [project]);

  // Category config
  const categoryConfig = {
    requirement: { icon: Target, label: 'Requirements', color: 'blue' },
    decision: { icon: CheckCircle2, label: 'Decisions', color: 'emerald' },
    stakeholder: { icon: Users, label: 'Stakeholders', color: 'purple' },
    timeline: { icon: Clock, label: 'Timelines', color: 'indigo' },
    question: { icon: HelpCircle, label: 'Questions', color: 'amber' },
  };

  // Filtered and sorted insights
  const filteredInsights = useMemo(() => {
    let filtered = localInsights.filter(insight => {
      if (insight.isMerged) return false; // Hide merged insights
      const matchesTab = activeTab === 'all' || insight.category === activeTab;
      const matchesPending = !showOnlyPending || insight.status === 'pending';
      const matchesSearch = !searchQuery || 
        insight.summary.toLowerCase().includes(searchQuery.toLowerCase()) || 
        insight.detail.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesTab && matchesPending && matchesSearch;
    });
    
    // Sort by priority if in priority view
    if (viewMode === 'priority') {
      filtered = sortByPriority(filtered);
    }
    
    return filtered;
  }, [localInsights, activeTab, showOnlyPending, searchQuery, viewMode]);

  // Find duplicate groups
  const duplicateGroups = useMemo(() => {
    const pending = localInsights.filter(i => i.status === 'pending' && !i.isMerged);
    return findDuplicateInsights(pending, 55);
  }, [localInsights]);

  // Stats
  const stats = useMemo(() => {
    let approved = 0, pending = 0, flagged = 0, rejected = 0, inBRD = 0;
    let withConflicts = 0, duplicateCount = 0;
    for (const i of localInsights) {
      if (i.isMerged) continue;
      if (i.status === 'approved') approved++;
      else if (i.status === 'pending') pending++;
      else if (i.status === 'flagged') flagged++;
      else if (i.status === 'rejected') rejected++;
      if (i.includedInBRD) inBRD++;
      if (i.hasConflicts) withConflicts++;
    }
    for (const group of duplicateGroups) {
      duplicateCount += group.duplicates.length;
    }
    return { 
      total: localInsights.filter(i => !i.isMerged).length, 
      approved, pending, flagged, rejected, inBRD,
      withConflicts, duplicateCount
    };
  }, [localInsights, duplicateGroups]);

  // Handlers
  const handleStatusChange = useCallback(async (id: string, status: Insight['status']) => {
    setUpdatingInsightId(id);
    setLocalInsights(prev => prev.map(ins => ins.id === id ? { ...ins, status } : ins));
    
    try {
      const updated = await updateInsightStatus(id, status);
      onUpdate(updated);
    } catch (err) {
      console.error("Failed to update status", err);
      setError("Couldn't save. Please try again.");
      // Rollback
      setLocalInsights(prev => prev.map(ins => {
        const original = project.insights.find(i => i.id === id);
        return ins.id === id && original ? { ...ins, status: original.status } : ins;
      }));
    } finally {
      setUpdatingInsightId(null);
    }
  }, [project.insights, onUpdate]);

  const handleBulkApprove = useCallback(async () => {
    const pendingIds = localInsights.filter(i => i.status === 'pending' && !i.isMerged).map(i => i.id);
    if (pendingIds.length === 0) return;
    
    setUpdatingInsightId('bulk');
    setLocalInsights(prev => prev.map(i => 
      i.status === 'pending' ? { ...i, status: 'approved' as const } : i
    ));
    
    try {
      const updates = pendingIds.map(id => ({ insightId: id, status: 'approved' as const }));
      const updated = await bulkUpdateInsightStatus(updates);
      onUpdate(updated);
    } catch (err) {
      setError("Couldn't approve all. Please try again.");
    } finally {
      setUpdatingInsightId(null);
    }
  }, [localInsights, onUpdate]);

  const handlePriorityChange = useCallback(async (id: string, priority: MoSCoWPriority) => {
    setLocalInsights(prev => prev.map(ins => ins.id === id ? { ...ins, priority } : ins));
    
    try {
      const updated = await updateInsight(id, { priority });
      onUpdate(updated);
    } catch (err) {
      console.error("Failed to update priority", err);
    }
  }, [onUpdate]);

  const handleEditSave = useCallback(async (summary: string, detail: string) => {
    if (!editingInsight) return;
    
    const updates: Partial<Insight> = {
      summary,
      detail,
      isEdited: true,
      originalSummary: editingInsight.originalSummary || editingInsight.summary,
      originalDetail: editingInsight.originalDetail || editingInsight.detail,
      editHistory: [
        ...(editingInsight.editHistory || []),
        { summary: editingInsight.summary, detail: editingInsight.detail, timestamp: new Date().toISOString() }
      ]
    };
    
    setLocalInsights(prev => prev.map(ins => 
      ins.id === editingInsight.id ? { ...ins, ...updates } : ins
    ));
    setEditingInsight(null);
    
    try {
      const updated = await updateInsight(editingInsight.id, updates);
      onUpdate(updated);
    } catch (err) {
      setError("Couldn't save changes.");
    }
  }, [editingInsight, onUpdate]);

  const handleAddComment = useCallback(async (insightId: string, text: string) => {
    const comment: InsightComment = {
      id: `comment_${Date.now()}`,
      authorId: 'current_user',
      authorName: 'You',
      text,
      timestamp: new Date().toISOString()
    };
    
    setLocalInsights(prev => prev.map(ins => 
      ins.id === insightId 
        ? { ...ins, comments: [...(ins.comments || []), comment] }
        : ins
    ));
    
    try {
      const updated = await addInsightComment(insightId, comment);
      onUpdate(updated);
    } catch (err) {
      console.error("Failed to add comment", err);
    }
  }, [onUpdate]);

  const handleMergeDuplicates = useCallback(async (primaryId: string, duplicateIds: string[]) => {
    try {
      const updated = await mergeInsights(primaryId, duplicateIds);
      setLocalInsights(enhanceInsights(updated.insights));
      onUpdate(updated);
    } catch (err) {
      setError("Couldn't merge insights.");
    }
  }, [onUpdate]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA') return;
      
      if (e.key === 'A' && e.shiftKey && stats.pending > 0) {
        e.preventDefault();
        handleBulkApprove();
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleBulkApprove, stats.pending]);

  const progressPercent = stats.total > 0 ? Math.round(((stats.approved + stats.rejected) / stats.total) * 100) : 0;

  // rowProps for virtualized list
  const rowData: InsightRowData = useMemo(() => ({
    filteredInsights,
    expandedInsightId,
    updatingInsightId,
    duplicateGroups,
    categoryConfig,
    handleStatusChange,
    handlePriorityChange,
    handleAddComment,
    handleMergeDuplicates,
    setExpandedInsightId,
    setSourcePreviewInsight,
    setEditingInsight
  }), [filteredInsights, expandedInsightId, updatingInsightId, duplicateGroups, categoryConfig,
       handleStatusChange, handlePriorityChange, handleAddComment, handleMergeDuplicates]);

  // Empty state
  if (localInsights.length === 0) {
    return (
      <div className="min-h-screen bg-slate-50">
        <div className="max-w-2xl mx-auto py-24 px-6">
          <div className="text-center">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-blue-600 shadow-lg mb-8">
              <Lightbulb className="h-10 w-10 text-white" />
            </div>
            <h1 className="text-4xl font-bold text-slate-900 mb-4 tracking-tight">No Insights Yet</h1>
            <p className="text-lg text-slate-500 leading-relaxed max-w-md mx-auto">
              Connect your data sources first. We'll analyze meetings, emails, and documents to extract key requirements automatically.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Modals */}
      <AnimatePresence>
        {sourcePreviewInsight && (
          <SourcePreviewModal
            insight={sourcePreviewInsight}
            sources={sourcePreviewInsight.supportingSources || []}
            onClose={() => setSourcePreviewInsight(null)}
          />
        )}
        {editingInsight && (
          <EditInsightModal
            insight={editingInsight}
            onSave={handleEditSave}
            onClose={() => setEditingInsight(null)}
            onAIRefine={async (insight) => {
              const refined = await refineInsight(insight, {
                name: project.name,
                goals: project.goals
              });
              return refined;
            }}
          />
        )}
      </AnimatePresence>

      {/* Error Toast */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            className="fixed top-6 left-1/2 -translate-x-1/2 z-50 bg-white border border-red-200 text-red-700 px-5 py-3 rounded-xl flex items-center gap-3 shadow-xl shadow-red-100"
          >
            <div className="p-1.5 bg-red-100 rounded-lg">
              <AlertCircle className="h-4 w-4" />
            </div>
            <span className="text-sm font-medium">{error}</span>
            <button onClick={() => setError(null)} className="p-1.5 hover:bg-red-50 rounded-lg ml-2">
              <X className="h-4 w-4" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="max-w-[1600px] mx-auto px-6 py-8">
        {/* Top Header Bar */}
        <header className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-blue-600 rounded-xl">
                  <Sparkles className="h-5 w-5 text-white" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Insights Review</h1>
                  <p className="text-sm text-slate-500">{project.name}</p>
                </div>
              </div>
            </div>
            
            {/* Quick Stats Pills */}
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 rounded-full shadow-sm">
                <div className="w-2 h-2 rounded-full bg-amber-400"></div>
                <span className="text-sm font-semibold text-slate-700">{stats.pending}</span>
                <span className="text-sm text-slate-500">pending</span>
              </div>
              <div className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-emerald-200 rounded-full shadow-sm">
                <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
                <span className="text-sm font-semibold text-emerald-700">{stats.approved}</span>
                <span className="text-sm text-slate-500">approved</span>
              </div>
              {stats.duplicateCount > 0 && (
                <div className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-violet-200 rounded-full shadow-sm">
                  <GitMerge className="h-3.5 w-3.5 text-violet-500" />
                  <span className="text-sm font-semibold text-violet-700">{stats.duplicateCount}</span>
                  <span className="text-sm text-slate-500">duplicates</span>
                </div>
              )}
              {stats.withConflicts > 0 && (
                <div className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-rose-200 rounded-full shadow-sm">
                  <AlertTriangle className="h-3.5 w-3.5 text-rose-500" />
                  <span className="text-sm font-semibold text-rose-700">{stats.withConflicts}</span>
                  <span className="text-sm text-slate-500">conflicts</span>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Main Layout: Sidebar + Content */}
        <div className="flex gap-6">
          {/* Left Sidebar - Stats & Filters */}
          <aside className="w-64 shrink-0 space-y-4">
            {/* Progress Card */}
            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <span className="text-sm font-medium text-slate-600">Review Progress</span>
                <span className="text-2xl font-bold text-slate-900">{progressPercent}%</span>
              </div>
              <div className="h-2 bg-slate-100 rounded-full overflow-hidden mb-3">
                <motion.div 
                  className="h-full bg-blue-600 rounded-full"
                  initial={{ width: 0 }}
                  animate={{ width: `${progressPercent}%` }}
                  transition={{ duration: 0.8, ease: "easeOut" }}
                />
              </div>
              <div className="grid grid-cols-2 gap-3 text-center">
                <div className="p-2 bg-emerald-50 rounded-lg">
                  <div className="text-lg font-bold text-emerald-700">{stats.approved}</div>
                  <div className="text-[10px] text-emerald-600 uppercase tracking-wider font-medium">Approved</div>
                </div>
                <div className="p-2 bg-amber-50 rounded-lg">
                  <div className="text-lg font-bold text-amber-700">{stats.flagged}</div>
                  <div className="text-[10px] text-amber-600 uppercase tracking-wider font-medium">Flagged</div>
                </div>
              </div>
            </div>

            {/* Category Filter */}
            <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Categories</h3>
              <div className="space-y-1">
                <button
                  onClick={() => setActiveTab('all')}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                    activeTab === 'all' 
                      ? 'bg-slate-900 text-white' 
                      : 'text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <span>All Insights</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${activeTab === 'all' ? 'bg-white/20' : 'bg-slate-100'}`}>
                    {stats.total}
                  </span>
                </button>
                {(Object.keys(categoryConfig) as (keyof typeof categoryConfig)[]).map(key => {
                  const cat = categoryConfig[key];
                  const count = localInsights.filter(i => !i.isMerged && i.category === key).length;
                  return (
                    <button
                      key={key}
                      onClick={() => setActiveTab(key as CategoryTab)}
                      className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                        activeTab === key 
                          ? 'bg-slate-900 text-white' 
                          : 'text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        {React.createElement(cat.icon, { className: 'h-4 w-4' })}
                        <span>{cat.label}</span>
                      </div>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${activeTab === key ? 'bg-white/20' : 'bg-slate-100'}`}>
                        {count}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Quick Actions */}
            <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Actions</h3>
              <div className="space-y-2">
                {stats.pending > 0 && (
                  <button
                    onClick={handleBulkApprove}
                    disabled={updatingInsightId === 'bulk'}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-600 text-white rounded-xl text-sm font-semibold hover:bg-emerald-700 transition-all disabled:opacity-50"
                  >
                    {updatingInsightId === 'bulk' ? (
                      <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <CheckCheck className="h-4 w-4" />
                    )}
                    Approve All ({stats.pending})
                  </button>
                )}
                <button
                  onClick={() => setShowOnlyPending(!showOnlyPending)}
                  className={`w-full flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                    showOnlyPending 
                      ? 'bg-blue-500 text-white' 
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  <Eye className="h-4 w-4" />
                  {showOnlyPending ? 'Showing Pending' : 'Show Pending Only'}
                </button>
              </div>
            </div>

            {/* Keyboard Shortcuts */}
            <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <Keyboard className="h-3.5 w-3.5" />
                <span>Press</span>
                <kbd className="px-1.5 py-0.5 bg-white border border-slate-200 rounded text-slate-700 font-mono text-[10px]">Shift+A</kbd>
                <span>to approve all</span>
              </div>
            </div>
          </aside>

          {/* Main Content */}
          <main className="flex-1 min-w-0">
            {/* Search Bar */}
            <div className="mb-4">
              <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search insights by keyword, source, or stakeholder..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="w-full pl-12 pr-4 py-3 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent shadow-sm placeholder:text-slate-400"
                />
                {searchQuery && (
                  <button 
                    onClick={() => setSearchQuery('')}
                    className="absolute right-4 top-1/2 -translate-y-1/2 p-1 hover:bg-slate-100 rounded-lg"
                  >
                    <X className="h-4 w-4 text-slate-400" />
                  </button>
                )}
              </div>
            </div>

            {/* Insights List Container */}
            <div 
              ref={containerRef} 
              className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden"
              style={{ height: 'calc(100vh - 320px)', minHeight: '500px' }}
            >
              {filteredInsights.length > 0 ? (
                <List
                  listRef={listRef}
                  style={{ 
                    height: Math.max(500, (containerRef.current?.clientHeight || 600)),
                    width: '100%' 
                  }}
                  rowCount={filteredInsights.length}
                  rowHeight={expandedInsightId ? 380 : 140}
                  rowComponent={InsightRowComponent}
                  rowProps={rowData}
                  overscanCount={5}
                />
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-center py-12 px-6">
                  <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center mb-4">
                    <Search className="h-7 w-7 text-slate-400" />
                  </div>
                  <h3 className="text-lg font-semibold text-slate-900 mb-2">No matching insights</h3>
                  <p className="text-slate-500 text-sm mb-5 max-w-xs">
                    We couldn't find any insights matching your current filters.
                  </p>
                  <button 
                    onClick={() => { setSearchQuery(''); setActiveTab('all'); setShowOnlyPending(false); }}
                    className="px-4 py-2 bg-slate-900 text-white text-sm font-medium rounded-lg hover:bg-slate-800 transition-colors"
                  >
                    Clear all filters
                  </button>
                </div>
              )}
            </div>

            {/* Footer CTA */}
            <div className="mt-6 flex items-center justify-between bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
              <div className="flex items-center gap-4">
                {stats.pending > 0 ? (
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center">
                      <FileText className="h-6 w-6 text-blue-600" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-900">
                        {stats.pending} insight{stats.pending !== 1 ? 's' : ''} awaiting review
                      </p>
                      <p className="text-xs text-slate-500">{stats.approved} approved and ready for BRD</p>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-emerald-50 rounded-xl flex items-center justify-center">
                      <CheckCircle2 className="h-6 w-6 text-emerald-600" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-900">All insights reviewed!</p>
                      <p className="text-xs text-slate-500">{stats.approved} approved insights ready for BRD</p>
                    </div>
                  </div>
                )}
              </div>
              
              <div className="flex items-center gap-3">
                {projectStats.hasBRD && onNavigateToBRD && (
                  <Button variant="outline" onClick={onNavigateToBRD}>
                    <Eye className="h-4 w-4 mr-2" />
                    View BRD
                  </Button>
                )}
                <Button 
                  onClick={onContinue}
                  disabled={stats.approved === 0}
                  className="px-6"
                >
                  {projectStats.hasBRD ? 'Update BRD' : 'Generate BRD'}
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </div>
          </main>
        </div>
      </div>
    </div>
  );
};

export default InsightsReview;
