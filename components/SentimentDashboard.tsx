import React, { useState, useEffect, useMemo } from 'react';
import { 
  Users, 
  TrendingUp, 
  TrendingDown, 
  Minus,
  AlertTriangle,
  ThumbsUp,
  ThumbsDown,
  RefreshCw,
  Loader,
  ArrowRight,
  BarChart3,
  Activity,
  AlertCircle,
  CheckCircle2,
  XCircle,
  MessageSquare,
  ChevronDown,
  ChevronUp,
  X
} from 'lucide-react';
import { motion } from 'motion/react';
import Button from './Button';
import Tooltip from './Tooltip';
import { ProjectState, updateProjectContext } from '../utils/db';
import { analyzeStakeholderSentiment, SentimentReport, StakeholderSentiment } from '../utils/services/ai';

interface SentimentDashboardProps {
  project: ProjectState;
  onUpdate: (project: ProjectState) => void;
  onNavigateToInsights?: () => void;
}

const SENTIMENT_CONFIG = {
  positive: { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', icon: ThumbsUp },
  neutral: { bg: 'bg-slate-50', text: 'text-slate-600', border: 'border-slate-200', icon: Minus },
  negative: { bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200', icon: ThumbsDown },
  mixed: { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200', icon: AlertTriangle }
};

const SentimentDashboard: React.FC<SentimentDashboardProps> = ({ 
  project, 
  onUpdate, 
  onNavigateToInsights 
}) => {
  const [report, setReport] = useState<SentimentReport | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastAnalyzed, setLastAnalyzed] = useState<Date | null>(null);
  const [expandedStakeholders, setExpandedStakeholders] = useState<Set<string>>(new Set());
  const [detailModal, setDetailModal] = useState<{ type: 'concerns' | 'supports'; stakeholder: string; items: string[] } | null>(null);

  const toggleStakeholderExpand = (stakeholder: string) => {
    setExpandedStakeholders(prev => {
      const next = new Set(prev);
      if (next.has(stakeholder)) {
        next.delete(stakeholder);
      } else {
        next.add(stakeholder);
      }
      return next;
    });
  };

  const openDetailModal = (type: 'concerns' | 'supports', stakeholder: string, items: string[]) => {
    setDetailModal({ type, stakeholder, items });
  };

  // Load cached report on mount
  useEffect(() => {
    const cachedReport = (project as any).sentimentReport;
    if (cachedReport) {
      setReport(cachedReport);
      setLastAnalyzed(new Date((project as any).sentimentAnalyzedAt || Date.now()));
    }
  }, [project]);

  const handleAnalyze = async () => {
    if (!project.insights || project.insights.length === 0) {
      setError('Need insights to analyze stakeholder sentiment');
      return;
    }

    setIsAnalyzing(true);
    setError(null);

    try {
      const result = await analyzeStakeholderSentiment(project.insights, project.sources || []);
      setReport(result);
      setLastAnalyzed(new Date());

      // Cache the report
      const updated = await updateProjectContext({
        ...project,
        sentimentReport: result,
        sentimentAnalyzedAt: new Date().toISOString()
      } as any);
      onUpdate(updated);
    } catch (err) {
      console.error('Sentiment analysis failed:', err);
      setError('Failed to analyze sentiment. Please try again.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Calculate gauge position (0-100 from -100 to +100 score)
  const gaugePosition = useMemo(() => {
    if (!report) return 50;
    return ((report.averageSentimentScore + 100) / 200) * 100;
  }, [report]);

  // Empty state
  if (!project.insights || project.insights.length === 0) {
    return (
      <div className="max-w-4xl mx-auto py-20 text-center animate-in fade-in duration-500">
        <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-6">
          <Users className="h-10 w-10 text-slate-400" />
        </div>
        <h2 className="text-2xl font-bold text-slate-900 mb-4">Stakeholder Sentiment Analysis</h2>
        <p className="text-slate-600 mb-8 max-w-md mx-auto">
          Add insights to enable AI-powered stakeholder sentiment analysis across your project sources.
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
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-50 text-purple-700 text-xs font-bold uppercase tracking-wider mb-3 border border-purple-100">
              <Activity className="h-3 w-3" /> Sentiment Analysis
            </div>
            <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Stakeholder Sentiment</h1>
            <p className="text-slate-600 mt-2">
              AI-powered analysis of stakeholder attitudes, concerns, and engagement levels.
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
              className="shadow-lg shadow-purple-500/20"
            >
              {isAnalyzing ? (
                <>
                  <Loader className="h-4 w-4 mr-2 animate-spin" /> Analyzing...
                </>
              ) : (
                <>
                  <RefreshCw className="h-4 w-4 mr-2" /> {report ? 'Re-Analyze' : 'Analyze Sentiment'}
                </>
              )}
            </Button>
          </div>
        </div>
      </header>

      {/* Error Display */}
      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-2xl flex items-center gap-3">
          <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0" />
          <span className="text-red-700 font-medium">{error}</span>
        </div>
      )}

      {/* Loading State */}
      {isAnalyzing && !report && (
        <div className="text-center py-20">
          <div className="w-16 h-16 bg-purple-50 rounded-full flex items-center justify-center mx-auto mb-6">
            <Loader className="h-8 w-8 text-purple-600 animate-spin" />
          </div>
          <h3 className="text-xl font-bold text-slate-900 mb-2">Analyzing Stakeholder Sentiment...</h3>
          <p className="text-slate-500">AI is examining {project.insights.length} insights for sentiment patterns</p>
        </div>
      )}

      {/* Report Content */}
      {report && (
        <div className="space-y-8">
          {/* Overall Sentiment Gauge */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-gradient-to-br from-slate-50 to-slate-100 rounded-3xl p-8 border border-slate-200"
          >
            <h2 className="text-xl font-bold text-slate-900 mb-6 text-center">Overall Project Sentiment</h2>
            
            {/* Sentiment Gauge */}
            <div className="relative max-w-md mx-auto mb-6">
              <div className="h-4 bg-gradient-to-r from-red-400 via-yellow-400 to-emerald-400 rounded-full overflow-hidden">
                <div 
                  className="absolute top-0 w-4 h-4 bg-white border-2 border-slate-800 rounded-full shadow-lg transform -translate-x-1/2 transition-all duration-500"
                  style={{ left: `${gaugePosition}%` }}
                />
              </div>
              <div className="flex justify-between text-xs text-slate-500 mt-2">
                <span>Negative (-100)</span>
                <span>Neutral (0)</span>
                <span>Positive (+100)</span>
              </div>
            </div>

            <div className="text-center">
              <div className="text-4xl font-bold text-slate-900 mb-2">
                {report.averageSentimentScore > 0 ? '+' : ''}{report.averageSentimentScore}
              </div>
              <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full ${
                SENTIMENT_CONFIG[report.overallProjectSentiment].bg
              } ${SENTIMENT_CONFIG[report.overallProjectSentiment].text}`}>
                {React.createElement(SENTIMENT_CONFIG[report.overallProjectSentiment].icon, { className: 'h-4 w-4' })}
                <span className="font-medium capitalize">{report.overallProjectSentiment} Sentiment</span>
              </div>
            </div>
          </motion.div>

          {/* Stats Row */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm">
              <div className="text-2xl font-bold text-slate-900">{report.stakeholders.length}</div>
              <div className="text-xs text-slate-500 font-medium uppercase tracking-wider">Stakeholders</div>
            </div>
            <div className="bg-emerald-50 p-5 rounded-2xl border border-emerald-100">
              <div className="text-2xl font-bold text-emerald-700">
                {report.stakeholders.filter(s => s.overallSentiment === 'positive').length}
              </div>
              <div className="text-xs text-emerald-600 font-medium uppercase tracking-wider">Positive</div>
            </div>
            <div className="bg-amber-50 p-5 rounded-2xl border border-amber-100">
              <div className="text-2xl font-bold text-amber-700">{report.topConcerns.length}</div>
              <div className="text-xs text-amber-600 font-medium uppercase tracking-wider">Concerns</div>
            </div>
            <div className="bg-red-50 p-5 rounded-2xl border border-red-100">
              <div className="text-2xl font-bold text-red-700">{report.riskAreas.length}</div>
              <div className="text-xs text-red-600 font-medium uppercase tracking-wider">Risk Areas</div>
            </div>
          </div>

          {/* Stakeholder Cards */}
          <div>
            <h3 className="text-lg font-bold text-slate-900 mb-4">Stakeholder Breakdown</h3>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {report.stakeholders.map((stakeholder, idx) => {
                const config = SENTIMENT_CONFIG[stakeholder.overallSentiment];
                const Icon = config.icon;

                return (
                  <motion.div
                    key={stakeholder.stakeholder}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.05 }}
                    className={`p-5 rounded-2xl border ${config.border} ${config.bg}`}
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <h4 className="font-bold text-slate-900">{stakeholder.stakeholder}</h4>
                        {stakeholder.role && (
                          <span className="text-xs text-slate-500">{stakeholder.role}</span>
                        )}
                      </div>
                      <div className={`p-2 rounded-xl ${config.bg}`}>
                        <Icon className={`h-5 w-5 ${config.text}`} />
                      </div>
                    </div>

                    {/* Sentiment Score Bar */}
                    <div className="mb-3">
                      <div className="flex justify-between text-xs text-slate-500 mb-1">
                        <span>Sentiment Score</span>
                        <span className="font-medium">{stakeholder.sentimentScore > 0 ? '+' : ''}{stakeholder.sentimentScore}</span>
                      </div>
                      <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
                        <div 
                          className={`h-full transition-all duration-500 ${
                            stakeholder.sentimentScore >= 0 ? 'bg-emerald-500' : 'bg-red-500'
                          }`}
                          style={{ width: `${Math.abs(stakeholder.sentimentScore)}%` }}
                        />
                      </div>
                    </div>

                    {/* Engagement & Trend */}
                    <div className="flex items-center gap-2 mb-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                        stakeholder.engagementLevel === 'high' ? 'bg-emerald-100 text-emerald-700' :
                        stakeholder.engagementLevel === 'medium' ? 'bg-amber-100 text-amber-700' :
                        'bg-slate-100 text-slate-600'
                      }`}>
                        {stakeholder.engagementLevel} engagement
                      </span>
                      <span className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                        stakeholder.recentTrend === 'improving' ? 'bg-emerald-100 text-emerald-700' :
                        stakeholder.recentTrend === 'declining' ? 'bg-red-100 text-red-700' :
                        'bg-slate-100 text-slate-600'
                      }`}>
                        {stakeholder.recentTrend === 'improving' && <TrendingUp className="h-3 w-3" />}
                        {stakeholder.recentTrend === 'declining' && <TrendingDown className="h-3 w-3" />}
                        {stakeholder.recentTrend === 'stable' && <Minus className="h-3 w-3" />}
                        {stakeholder.recentTrend}
                      </span>
                    </div>

                    {/* Concerns */}
                    {stakeholder.concerns.length > 0 && (
                      <div className="mb-3">
                        <div className="flex items-center justify-between mb-2">
                          <div className="text-xs font-medium text-slate-500">Concerns ({stakeholder.concerns.length}):</div>
                          {stakeholder.concerns.length > 2 && (
                            <button
                              onClick={() => openDetailModal('concerns', stakeholder.stakeholder, stakeholder.concerns)}
                              className="text-xs text-red-600 hover:text-red-700 font-medium hover:underline"
                            >
                              View all
                            </button>
                          )}
                        </div>
                        <div className="space-y-1.5">
                          {(expandedStakeholders.has(stakeholder.stakeholder) ? stakeholder.concerns : stakeholder.concerns.slice(0, 2)).map((concern, i) => (
                            <div key={i} className="px-3 py-2 bg-red-50 text-red-700 text-sm rounded-lg border border-red-100">
                              {concern}
                            </div>
                          ))}
                          {!expandedStakeholders.has(stakeholder.stakeholder) && stakeholder.concerns.length > 2 && (
                            <button
                              onClick={() => toggleStakeholderExpand(stakeholder.stakeholder)}
                              className="text-xs text-red-600 hover:text-red-700 flex items-center gap-1 mt-1"
                            >
                              <ChevronDown className="h-3 w-3" /> +{stakeholder.concerns.length - 2} more
                            </button>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Supported Items */}
                    {stakeholder.supportedItems.length > 0 && (
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <div className="text-xs font-medium text-slate-500">Supports ({stakeholder.supportedItems.length}):</div>
                          {stakeholder.supportedItems.length > 2 && (
                            <button
                              onClick={() => openDetailModal('supports', stakeholder.stakeholder, stakeholder.supportedItems)}
                              className="text-xs text-emerald-600 hover:text-emerald-700 font-medium hover:underline"
                            >
                              View all
                            </button>
                          )}
                        </div>
                        <div className="space-y-1.5">
                          {(expandedStakeholders.has(stakeholder.stakeholder) ? stakeholder.supportedItems : stakeholder.supportedItems.slice(0, 2)).map((item, i) => (
                            <div key={i} className="px-3 py-2 bg-emerald-50 text-emerald-700 text-sm rounded-lg border border-emerald-100">
                              {item}
                            </div>
                          ))}
                          {!expandedStakeholders.has(stakeholder.stakeholder) && stakeholder.supportedItems.length > 2 && (
                            <button
                              onClick={() => toggleStakeholderExpand(stakeholder.stakeholder)}
                              className="text-xs text-emerald-600 hover:text-emerald-700 flex items-center gap-1 mt-1"
                            >
                              <ChevronDown className="h-3 w-3" /> +{stakeholder.supportedItems.length - 2} more
                            </button>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Collapse button when expanded */}
                    {expandedStakeholders.has(stakeholder.stakeholder) && (stakeholder.concerns.length > 2 || stakeholder.supportedItems.length > 2) && (
                      <button
                        onClick={() => toggleStakeholderExpand(stakeholder.stakeholder)}
                        className="text-xs text-slate-500 hover:text-slate-700 flex items-center gap-1 mt-2 w-full justify-center"
                      >
                        <ChevronUp className="h-3 w-3" /> Show less
                      </button>
                    )}
                  </motion.div>
                );
              })}
            </div>
          </div>

          {/* Concerns & Highlights Grid */}
          <div className="grid md:grid-cols-2 gap-6">
            {/* Top Concerns */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
              <h3 className="font-bold text-slate-900 mb-4 flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-amber-500" />
                Top Concerns
              </h3>
              <div className="space-y-3">
                {report.topConcerns.length > 0 ? report.topConcerns.map((concern, idx) => (
                  <div key={idx} className="p-3 bg-amber-50 rounded-xl border border-amber-100">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-medium text-amber-900">{concern.concern}</span>
                      <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">
                        {concern.frequency}x mentioned
                      </span>
                    </div>
                    <div className="text-xs text-amber-600">
                      By: {concern.stakeholders.join(', ')}
                    </div>
                  </div>
                )) : (
                  <div className="text-slate-500 text-sm text-center py-4">No major concerns identified</div>
                )}
              </div>
            </div>

            {/* Positive Highlights */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
              <h3 className="font-bold text-slate-900 mb-4 flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                Positive Highlights
              </h3>
              <div className="space-y-2">
                {report.positiveHighlights.length > 0 ? report.positiveHighlights.map((highlight, idx) => (
                  <div key={idx} className="p-3 bg-emerald-50 rounded-xl border border-emerald-100 text-emerald-800 text-sm">
                    {highlight}
                  </div>
                )) : (
                  <div className="text-slate-500 text-sm text-center py-4">No highlights yet</div>
                )}
              </div>
            </div>
          </div>

          {/* Risk Areas */}
          {report.riskAreas.length > 0 && (
            <div className="bg-red-50 rounded-2xl border border-red-200 p-6">
              <h3 className="font-bold text-red-900 mb-4 flex items-center gap-2">
                <XCircle className="h-5 w-5 text-red-600" />
                Risk Areas
              </h3>
              <div className="grid md:grid-cols-2 gap-3">
                {report.riskAreas.map((risk, idx) => (
                  <div key={idx} className="p-3 bg-white rounded-xl border border-red-100 text-red-800 text-sm">
                    {risk}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Detail Modal for viewing all concerns/supports */}
      {detailModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[80vh] overflow-hidden"
          >
            <div className={`px-6 py-4 border-b flex items-center justify-between ${
              detailModal.type === 'concerns' ? 'bg-red-50 border-red-100' : 'bg-emerald-50 border-emerald-100'
            }`}>
              <div>
                <h3 className={`font-bold text-lg ${
                  detailModal.type === 'concerns' ? 'text-red-900' : 'text-emerald-900'
                }`}>
                  {detailModal.type === 'concerns' ? 'All Concerns' : 'All Supported Items'}
                </h3>
                <p className="text-sm text-slate-600">Stakeholder: {detailModal.stakeholder}</p>
              </div>
              <button
                onClick={() => setDetailModal(null)}
                className="p-2 hover:bg-white/50 rounded-lg transition-colors"
              >
                <X className="h-5 w-5 text-slate-600" />
              </button>
            </div>
            <div className="p-6 overflow-y-auto max-h-[60vh]">
              <div className="space-y-3">
                {detailModal.items.map((item, idx) => (
                  <div 
                    key={idx} 
                    className={`p-4 rounded-xl border text-sm leading-relaxed ${
                      detailModal.type === 'concerns' 
                        ? 'bg-red-50 border-red-100 text-red-800' 
                        : 'bg-emerald-50 border-emerald-100 text-emerald-800'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <span className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                        detailModal.type === 'concerns' ? 'bg-red-200 text-red-700' : 'bg-emerald-200 text-emerald-700'
                      }`}>
                        {idx + 1}
                      </span>
                      <span className="flex-1">{item}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex justify-end">
              <Button variant="outline" onClick={() => setDetailModal(null)}>
                Close
              </Button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
};

export default SentimentDashboard;
