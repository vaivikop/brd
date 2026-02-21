import React, { useState, useEffect, useMemo, useCallback } from 'react';
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
  X,
  Quote,
  Clock,
  LineChart,
  Calendar,
  FileText,
  Download,
  Filter,
  Zap,
  Target,
  ArrowUpRight,
  ArrowDownRight,
  BarChart2,
  PieChart,
  Info
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import Button from './Button';
import Tooltip from './Tooltip';
import { ProjectState, updateProjectContext } from '../utils/db';
import { analyzeStakeholderSentiment, SentimentReport, StakeholderSentiment } from '../utils/services/ai';

// Historical sentiment tracking
interface SentimentHistory {
  timestamp: string;
  averageScore: number;
  stakeholderScores: Record<string, number>;
  overallSentiment: string;
}

// Content hash for better cache invalidation
const generateContentHash = (insights: any[]): string => {
  const content = insights.map(i => `${i.id}${i.summary}`).join('');
  let hash = 0;
  for (let i = 0; i < content.length; i++) {
    const char = content.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(36);
};

// localStorage keys
const HISTORY_STORAGE_KEY = 'clarity_sentiment_history';
const MAX_HISTORY_ENTRIES = 50;

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

// ============================================================================
// ENTERPRISE TRENDS DASHBOARD COMPONENT
// ============================================================================

type TrendChartType = 'line' | 'area' | 'comparison';
type TimeRangeFilter = 'all' | 'week' | 'month' | 'quarter';

interface TrendMetrics {
  currentScore: number;
  previousScore: number;
  changePercent: number;
  trend: 'improving' | 'declining' | 'stable';
  movingAverage: number;
  volatility: number;
  highestScore: number;
  lowestScore: number;
  averageScore: number;
  dataPoints: number;
  momentum: number; // Rate of change
  prediction: number; // Simple linear projection
}

interface StakeholderTrend {
  name: string;
  scores: number[];
  currentScore: number;
  trend: 'improving' | 'declining' | 'stable';
  changePercent: number;
  sparklinePoints: string;
}

interface EnterpriseTrendsDashboardProps {
  history: SentimentHistory[];
  onClose: () => void;
  currentReport: SentimentReport | null;
}

const EnterpriseTrendsDashboard: React.FC<EnterpriseTrendsDashboardProps> = ({
  history,
  onClose,
  currentReport
}) => {
  const [chartType, setChartType] = useState<TrendChartType>('area');
  const [timeRange, setTimeRange] = useState<TimeRangeFilter>('all');
  const [selectedStakeholder, setSelectedStakeholder] = useState<string | null>(null);
  const [showPrediction, setShowPrediction] = useState(true);
  const [hoveredPoint, setHoveredPoint] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'stakeholders' | 'insights'>('overview');

  // Filter history by time range
  const filteredHistory = useMemo(() => {
    if (timeRange === 'all') return history;
    
    const now = new Date();
    const cutoff = new Date();
    
    switch (timeRange) {
      case 'week':
        cutoff.setDate(now.getDate() - 7);
        break;
      case 'month':
        cutoff.setMonth(now.getMonth() - 1);
        break;
      case 'quarter':
        cutoff.setMonth(now.getMonth() - 3);
        break;
    }
    
    return history.filter(h => new Date(h.timestamp) >= cutoff);
  }, [history, timeRange]);

  // Calculate comprehensive trend metrics
  const metrics: TrendMetrics = useMemo(() => {
    if (filteredHistory.length === 0) {
      return {
        currentScore: 0,
        previousScore: 0,
        changePercent: 0,
        trend: 'stable' as const,
        movingAverage: 0,
        volatility: 0,
        highestScore: 0,
        lowestScore: 0,
        averageScore: 0,
        dataPoints: 0,
        momentum: 0,
        prediction: 0
      };
    }

    const scores = filteredHistory.map(h => h.averageScore);
    const currentScore = scores[scores.length - 1];
    const previousScore = scores.length > 1 ? scores[scores.length - 2] : currentScore;
    
    // Calculate change
    const changePercent = previousScore !== 0 
      ? Math.round(((currentScore - previousScore) / Math.abs(previousScore)) * 100)
      : 0;
    
    // Determine trend
    let trend: 'improving' | 'declining' | 'stable' = 'stable';
    if (scores.length >= 3) {
      const recentSlope = (scores[scores.length - 1] - scores[scores.length - 3]) / 2;
      if (recentSlope > 3) trend = 'improving';
      else if (recentSlope < -3) trend = 'declining';
    }

    // Moving average (last 5 points)
    const maWindow = Math.min(5, scores.length);
    const movingAverage = Math.round(
      scores.slice(-maWindow).reduce((a, b) => a + b, 0) / maWindow
    );

    // Volatility (standard deviation)
    const mean = scores.reduce((a, b) => a + b, 0) / scores.length;
    const variance = scores.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / scores.length;
    const volatility = Math.round(Math.sqrt(variance));

    // Momentum (average of recent changes)
    const recentChanges = scores.slice(-5).map((s, i, arr) => i > 0 ? s - arr[i - 1] : 0).slice(1);
    const momentum = recentChanges.length > 0 
      ? Math.round(recentChanges.reduce((a, b) => a + b, 0) / recentChanges.length)
      : 0;

    // Simple linear regression prediction
    const n = scores.length;
    const sumX = (n * (n - 1)) / 2;
    const sumY = scores.reduce((a, b) => a + b, 0);
    const sumXY = scores.reduce((sum, y, x) => sum + x * y, 0);
    const sumX2 = (n * (n - 1) * (2 * n - 1)) / 6;
    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    const prediction = Math.round(Math.max(-100, Math.min(100, currentScore + slope * 3))); // 3-point projection

    return {
      currentScore,
      previousScore,
      changePercent,
      trend,
      movingAverage,
      volatility,
      highestScore: Math.max(...scores),
      lowestScore: Math.min(...scores),
      averageScore: Math.round(mean),
      dataPoints: scores.length,
      momentum,
      prediction
    };
  }, [filteredHistory]);

  // Calculate per-stakeholder trends
  const stakeholderTrends: StakeholderTrend[] = useMemo(() => {
    if (filteredHistory.length === 0) return [];

    // Get all unique stakeholders
    const allStakeholders = new Set<string>();
    filteredHistory.forEach(h => {
      Object.keys(h.stakeholderScores || {}).forEach(s => allStakeholders.add(s));
    });

    return Array.from(allStakeholders).map(name => {
      const scores = filteredHistory.map(h => h.stakeholderScores?.[name] ?? null).filter((s): s is number => s !== null);
      
      if (scores.length === 0) {
        return { name, scores: [], currentScore: 0, trend: 'stable' as const, changePercent: 0, sparklinePoints: '' };
      }

      const currentScore = scores[scores.length - 1];
      const previousScore = scores.length > 1 ? scores[scores.length - 2] : currentScore;
      const changePercent = previousScore !== 0 
        ? Math.round(((currentScore - previousScore) / Math.abs(previousScore)) * 100)
        : 0;

      let trend: 'improving' | 'declining' | 'stable' = 'stable';
      if (scores.length >= 2) {
        const diff = currentScore - previousScore;
        if (diff > 5) trend = 'improving';
        else if (diff < -5) trend = 'declining';
      }

      // Generate sparkline SVG points
      const width = 60;
      const height = 20;
      const points = scores.map((s, i) => {
        const x = (i / Math.max(scores.length - 1, 1)) * width;
        const y = height - ((s + 100) / 200) * height;
        return `${x},${y}`;
      }).join(' ');

      return { name, scores, currentScore, trend, changePercent, sparklinePoints: points };
    }).sort((a, b) => Math.abs(b.changePercent) - Math.abs(a.changePercent));
  }, [filteredHistory]);

  // Export data to CSV
  const handleExportCSV = () => {
    const headers = ['Timestamp', 'Overall Sentiment', 'Average Score', ...Array.from(new Set(filteredHistory.flatMap(h => Object.keys(h.stakeholderScores || {}))))];
    const rows = filteredHistory.map(h => [
      new Date(h.timestamp).toISOString(),
      h.overallSentiment,
      h.averageScore.toString(),
      ...headers.slice(3).map(stakeholder => (h.stakeholderScores?.[stakeholder] ?? '').toString())
    ]);
    
    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sentiment-trends-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Chart dimensions
  const chartWidth = 800;
  const chartHeight = 280;
  const padding = { top: 30, right: 30, bottom: 50, left: 60 };
  const plotWidth = chartWidth - padding.left - padding.right;
  const plotHeight = chartHeight - padding.top - padding.bottom;

  // Generate chart path
  const generatePath = useCallback((data: number[], fill = false) => {
    if (data.length < 2) return '';
    
    const points = data.map((score, i) => {
      const x = padding.left + (i / (data.length - 1)) * plotWidth;
      const y = padding.top + plotHeight - ((score + 100) / 200) * plotHeight;
      return { x, y };
    });

    let path = `M ${points[0].x} ${points[0].y}`;
    
    // Smooth curve using quadratic bezier
    for (let i = 1; i < points.length; i++) {
      const prev = points[i - 1];
      const curr = points[i];
      const cpX = (prev.x + curr.x) / 2;
      path += ` Q ${prev.x + (curr.x - prev.x) / 4} ${prev.y} ${cpX} ${(prev.y + curr.y) / 2}`;
      path += ` Q ${cpX + (curr.x - cpX) / 2} ${curr.y} ${curr.x} ${curr.y}`;
    }

    if (fill) {
      path += ` L ${padding.left + plotWidth} ${padding.top + plotHeight}`;
      path += ` L ${padding.left} ${padding.top + plotHeight} Z`;
    }

    return path;
  }, [plotWidth, plotHeight, padding]);

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-2 sm:p-4">
      <motion.div 
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white rounded-xl shadow-2xl w-full max-w-5xl h-[95vh] sm:h-[90vh] flex flex-col"
      >
        {/* Header - Compact */}
        <div className="px-4 py-3 border-b bg-slate-800 rounded-t-xl flex-shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-1.5 bg-purple-600 rounded-lg">
                <BarChart3 className="h-4 w-4 text-white" />
              </div>
              <div>
                <h3 className="font-bold text-white text-base">Sentiment Trends</h3>
                <p className="text-slate-400 text-xs">
                  {metrics.dataPoints} points • {filteredHistory.length > 0 ? new Date(filteredHistory[filteredHistory.length - 1].timestamp).toLocaleDateString() : 'N/A'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {/* Tabs inline */}
              <div className="hidden sm:flex gap-1 bg-slate-700 rounded-lg p-0.5">
                {(['overview', 'stakeholders', 'insights'] as const).map(tab => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`px-3 py-1 rounded text-xs font-medium transition-all ${
                      activeTab === tab
                        ? 'bg-white text-slate-800'
                        : 'text-slate-300 hover:text-white'
                    }`}
                  >
                    {tab === 'overview' ? 'Overview' : tab === 'stakeholders' ? 'Stakeholders' : 'Insights'}
                  </button>
                ))}
              </div>
              <button
                onClick={handleExportCSV}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors text-xs font-medium"
              >
                <Download className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Export</span>
              </button>
              <button
                onClick={onClose}
                className="p-1.5 hover:bg-slate-700 rounded-lg transition-colors"
              >
                <X className="h-4 w-4 text-slate-400" />
              </button>
            </div>
          </div>
          {/* Mobile tabs */}
          <div className="flex sm:hidden gap-1 mt-2">
            {(['overview', 'stakeholders', 'insights'] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`flex-1 px-2 py-1.5 rounded text-xs font-medium transition-all ${
                  activeTab === tab
                    ? 'bg-purple-600 text-white'
                    : 'bg-slate-700 text-slate-300'
                }`}
              >
                {tab === 'overview' ? 'Overview' : tab === 'stakeholders' ? 'Stakeholders' : 'Insights'}
              </button>
            ))}
          </div>
        </div>

        {/* Content - Flex grow to fill space */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-4">
          {/* Controls Bar - Compact */}
          <div className="flex flex-wrap items-center gap-2 sm:gap-3 mb-3">
            <div className="flex items-center gap-1">
              {(['all', 'week', 'month', 'quarter'] as TimeRangeFilter[]).map(range => (
                <button
                  key={range}
                  onClick={() => setTimeRange(range)}
                  className={`px-2 py-1 rounded text-xs font-medium transition-all ${
                    timeRange === range
                      ? 'bg-purple-600 text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {range === 'all' ? 'All' : range.charAt(0).toUpperCase() + range.slice(1)}
                </button>
              ))}
            </div>
            <div className="h-4 w-px bg-slate-200 hidden sm:block" />
            <div className="flex items-center gap-1">
              {(['line', 'area'] as TrendChartType[]).map(type => (
                <button
                  key={type}
                  onClick={() => setChartType(type)}
                  className={`p-1.5 rounded text-xs font-medium transition-all ${
                    chartType === type
                      ? 'bg-slate-800 text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {type === 'line' ? <LineChart className="h-3.5 w-3.5" /> : <BarChart2 className="h-3.5 w-3.5" />}
                </button>
              ))}
            </div>
            <label className="flex items-center gap-1.5 cursor-pointer ml-auto">
              <input
                type="checkbox"
                checked={showPrediction}
                onChange={e => setShowPrediction(e.target.checked)}
                className="h-3 w-3 rounded border-slate-300 text-purple-600"
              />
              <span className="text-xs text-slate-500">Predict</span>
            </label>
          </div>

          {activeTab === 'overview' && (
            <div className="flex flex-col h-full">
              {/* Key Metrics - Compact inline row */}
              <div className="flex flex-wrap gap-2 sm:gap-3 mb-3">
                <div className="bg-slate-50 rounded-lg px-3 py-2 border border-slate-200 flex items-center gap-2">
                  <span className="text-xs text-slate-500">Score</span>
                  <span className={`text-lg font-bold ${metrics.currentScore >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                    {metrics.currentScore > 0 ? '+' : ''}{metrics.currentScore}
                  </span>
                </div>
                <div className="bg-slate-50 rounded-lg px-3 py-2 border border-slate-200 flex items-center gap-2">
                  <span className="text-xs text-slate-500">Change</span>
                  <span className={`text-lg font-bold flex items-center ${
                    metrics.changePercent > 0 ? 'text-emerald-600' : metrics.changePercent < 0 ? 'text-red-600' : 'text-slate-600'
                  }`}>
                    {metrics.changePercent > 0 ? <ArrowUpRight className="h-4 w-4" /> : metrics.changePercent < 0 ? <ArrowDownRight className="h-4 w-4" /> : null}
                    {metrics.changePercent > 0 ? '+' : ''}{metrics.changePercent}%
                  </span>
                </div>
                <div className="bg-slate-50 rounded-lg px-3 py-2 border border-slate-200 flex items-center gap-2">
                  <span className="text-xs text-slate-500">Trend</span>
                  <span className={`text-sm font-bold flex items-center gap-1 ${
                    metrics.trend === 'improving' ? 'text-emerald-600' : metrics.trend === 'declining' ? 'text-red-600' : 'text-slate-600'
                  }`}>
                    {metrics.trend === 'improving' && <TrendingUp className="h-4 w-4" />}
                    {metrics.trend === 'declining' && <TrendingDown className="h-4 w-4" />}
                    {metrics.trend === 'stable' && <Minus className="h-4 w-4" />}
                    <span className="hidden sm:inline">{metrics.trend.charAt(0).toUpperCase() + metrics.trend.slice(1)}</span>
                  </span>
                </div>
                <div className="bg-purple-50 rounded-lg px-3 py-2 border border-purple-200 flex items-center gap-2">
                  <span className="text-xs text-purple-600">MA(5)</span>
                  <span className="text-lg font-bold text-purple-700">{metrics.movingAverage > 0 ? '+' : ''}{metrics.movingAverage}</span>
                </div>
                <div className="bg-amber-50 rounded-lg px-3 py-2 border border-amber-200 flex items-center gap-2">
                  <span className="text-xs text-amber-600">Vol</span>
                  <span className="text-lg font-bold text-amber-700">±{metrics.volatility}</span>
                </div>
                {showPrediction && (
                  <div className="bg-blue-50 rounded-lg px-3 py-2 border border-blue-200 flex items-center gap-2">
                    <Zap className="h-3 w-3 text-blue-600" />
                    <span className="text-lg font-bold text-blue-700">{metrics.prediction > 0 ? '+' : ''}{metrics.prediction}</span>
                  </div>
                )}
              </div>

              {/* Main Chart - Flexible height */}
              <div className="bg-slate-50 rounded-xl p-3 sm:p-4 border border-slate-200 flex-1 min-h-[160px] max-h-[240px] mb-3">
                <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} className="w-full h-full" preserveAspectRatio="xMidYMid meet">

                  {/* Grid */}
                  {[0, 25, 50, 75, 100].map(pct => {
                    const y = padding.top + (pct / 100) * plotHeight;
                    const score = 100 - (pct * 2);
                    return (
                      <g key={pct}>
                        <line x1={padding.left} y1={y} x2={padding.left + plotWidth} y2={y} stroke="#e2e8f0" strokeDasharray="4" />
                        <text x={padding.left - 10} y={y + 4} textAnchor="end" fill="#64748b" fontSize="11" fontWeight="500">
                          {score > 0 ? '+' : ''}{score}
                        </text>
                      </g>
                    );
                  })}

                  {/* Zero line */}
                  <line 
                    x1={padding.left} 
                    y1={padding.top + plotHeight / 2} 
                    x2={padding.left + plotWidth} 
                    y2={padding.top + plotHeight / 2} 
                    stroke="#94a3b8" 
                    strokeWidth="2"
                  />

                  {/* Area fill */}
                  {chartType === 'area' && filteredHistory.length > 1 && (
                    <path
                      d={generatePath(filteredHistory.map(h => h.averageScore), true)}
                      fill="#8b5cf6"
                      fillOpacity="0.15"
                    />
                  )}

                  {/* Main line */}
                  {filteredHistory.length > 1 && (
                    <path
                      d={generatePath(filteredHistory.map(h => h.averageScore))}
                      fill="none"
                      stroke="#8b5cf6"
                      strokeWidth="3"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  )}

                  {/* Prediction projection */}
                  {showPrediction && filteredHistory.length > 1 && (
                    <>
                      <line
                        x1={padding.left + plotWidth}
                        y1={padding.top + plotHeight - ((metrics.currentScore + 100) / 200) * plotHeight}
                        x2={padding.left + plotWidth + 40}
                        y2={padding.top + plotHeight - ((metrics.prediction + 100) / 200) * plotHeight}
                        stroke="#3b82f6"
                        strokeWidth="2"
                        strokeDasharray="6"
                      />
                      <circle
                        cx={padding.left + plotWidth + 40}
                        cy={padding.top + plotHeight - ((metrics.prediction + 100) / 200) * plotHeight}
                        r="6"
                        fill="#3b82f6"
                        stroke="#fff"
                        strokeWidth="2"
                      />
                    </>
                  )}

                  {/* Data points */}
                  {filteredHistory.map((entry, idx) => {
                    const x = padding.left + (idx / Math.max(filteredHistory.length - 1, 1)) * plotWidth;
                    const y = padding.top + plotHeight - ((entry.averageScore + 100) / 200) * plotHeight;
                    const isHovered = hoveredPoint === idx;
                    
                    return (
                      <g 
                        key={idx}
                        onMouseEnter={() => setHoveredPoint(idx)}
                        onMouseLeave={() => setHoveredPoint(null)}
                        style={{ cursor: 'pointer' }}
                      >
                        <circle
                          cx={x}
                          cy={y}
                          r={isHovered ? 10 : 6}
                          fill={entry.averageScore >= 0 ? '#10b981' : '#ef4444'}
                          stroke="#fff"
                          strokeWidth="2"
                          className="transition-all duration-200"
                        />
                        {isHovered && (
                          <>
                            <rect
                              x={x - 50}
                              y={y - 50}
                              width="100"
                              height="40"
                              rx="6"
                              fill="#1e293b"
                            />
                            <text x={x} y={y - 35} textAnchor="middle" fill="#fff" fontSize="11" fontWeight="600">
                              {new Date(entry.timestamp).toLocaleDateString()}
                            </text>
                            <text x={x} y={y - 20} textAnchor="middle" fill={entry.averageScore >= 0 ? '#4ade80' : '#f87171'} fontSize="13" fontWeight="700">
                              Score: {entry.averageScore > 0 ? '+' : ''}{entry.averageScore}
                            </text>
                          </>
                        )}
                      </g>
                    );
                  })}

                  {/* X-axis labels */}
                  {filteredHistory.filter((_, i, arr) => i === 0 || i === arr.length - 1 || i === Math.floor(arr.length / 2)).map((entry, i, arr) => {
                    const originalIdx = i === 0 ? 0 : i === arr.length - 1 ? filteredHistory.length - 1 : Math.floor(filteredHistory.length / 2);
                    const x = padding.left + (originalIdx / Math.max(filteredHistory.length - 1, 1)) * plotWidth;
                    return (
                      <text key={i} x={x} y={chartHeight - 10} textAnchor="middle" fill="#64748b" fontSize="10">
                        {new Date(entry.timestamp).toLocaleDateString()}
                      </text>
                    );
                  })}
                </svg>
              </div>

              {/* Stats Summary - Compact */}
              <div className="grid grid-cols-3 gap-2 sm:gap-3">
                <div className="bg-white rounded-lg p-2 sm:p-3 border border-slate-200">
                  <h4 className="font-medium text-slate-700 text-xs mb-2 flex items-center gap-1">
                    <Target className="h-3 w-3 text-purple-600" /> Range
                  </h4>
                  <div className="space-y-1 text-xs">
                    <div className="flex justify-between"><span className="text-slate-500">High</span><span className="font-bold text-emerald-600">+{metrics.highestScore}</span></div>
                    <div className="flex justify-between"><span className="text-slate-500">Low</span><span className="font-bold text-red-600">{metrics.lowestScore}</span></div>
                    <div className="flex justify-between"><span className="text-slate-500">Avg</span><span className="font-bold text-slate-700">{metrics.averageScore > 0 ? '+' : ''}{metrics.averageScore}</span></div>
                  </div>
                </div>
                <div className="bg-white rounded-lg p-2 sm:p-3 border border-slate-200">
                  <h4 className="font-medium text-slate-700 text-xs mb-2 flex items-center gap-1">
                    <Activity className="h-3 w-3 text-purple-600" /> Momentum
                  </h4>
                  <div className="space-y-1 text-xs">
                    <div className="flex justify-between"><span className="text-slate-500">Δ/run</span><span className={`font-bold ${metrics.momentum >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>{metrics.momentum >= 0 ? '+' : ''}{metrics.momentum}</span></div>
                    <div className="flex justify-between"><span className="text-slate-500">Points</span><span className="font-bold text-slate-700">{metrics.dataPoints}</span></div>
                    <div className="flex justify-between"><span className="text-slate-500">Stable</span><span className={`font-bold ${metrics.volatility < 15 ? 'text-emerald-600' : metrics.volatility < 30 ? 'text-amber-600' : 'text-red-600'}`}>{metrics.volatility < 15 ? '✓' : metrics.volatility < 30 ? '~' : '✗'}</span></div>
                  </div>
                </div>
                <div className="bg-white rounded-lg p-2 sm:p-3 border border-slate-200">
                  <h4 className="font-medium text-slate-700 text-xs mb-2 flex items-center gap-1">
                    <Zap className="h-3 w-3 text-purple-600" /> Forecast
                  </h4>
                  <div className="space-y-1 text-xs">
                    <div className="flex justify-between"><span className="text-slate-500">Next</span><span className="font-bold text-blue-600">{metrics.prediction > 0 ? '+' : ''}{metrics.prediction}</span></div>
                    <div className="flex justify-between"><span className="text-slate-500">Dir</span><span className={`font-bold ${metrics.prediction > metrics.currentScore ? 'text-emerald-600' : metrics.prediction < metrics.currentScore ? 'text-red-600' : 'text-slate-600'}`}>{metrics.prediction > metrics.currentScore ? '↑' : metrics.prediction < metrics.currentScore ? '↓' : '→'}</span></div>
                    <div className="flex justify-between"><span className="text-slate-500">Conf</span><span className="font-bold text-slate-700">{metrics.dataPoints >= 10 ? 'Hi' : metrics.dataPoints >= 5 ? 'Med' : 'Lo'}</span></div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'stakeholders' && (
            <div className="h-full flex flex-col">
              <div className="flex items-center justify-between mb-2">
                <h4 className="font-semibold text-sm text-slate-700">Stakeholder Trends</h4>
                <span className="text-xs text-slate-500">{stakeholderTrends.length} tracked</span>
              </div>

              {stakeholderTrends.length > 0 ? (
                <div className="flex-1 overflow-y-auto space-y-2">
                  {stakeholderTrends.map(stakeholder => (
                    <div 
                      key={stakeholder.name}
                      className={`bg-white rounded-lg p-3 border transition-all cursor-pointer ${
                        selectedStakeholder === stakeholder.name 
                          ? 'border-purple-400 ring-1 ring-purple-100' 
                          : 'border-slate-200 hover:border-slate-300'
                      }`}
                      onClick={() => setSelectedStakeholder(selectedStakeholder === stakeholder.name ? null : stakeholder.name)}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold text-white ${
                            stakeholder.currentScore >= 20 ? 'bg-emerald-500' :
                            stakeholder.currentScore >= -20 ? 'bg-slate-400' :
                            'bg-red-500'
                          }`}>
                            {stakeholder.name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div className="font-medium text-slate-800 text-sm">{stakeholder.name}</div>
                            <div className="text-xs text-slate-400">{stakeholder.scores.length} pts</div>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          {stakeholder.sparklinePoints && (
                            <svg width="50" height="16" className="hidden sm:block">
                              <polyline points={stakeholder.sparklinePoints} fill="none" stroke={stakeholder.trend === 'improving' ? '#10b981' : stakeholder.trend === 'declining' ? '#ef4444' : '#94a3b8'} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                          )}
                          <div className="text-right">
                            <div className={`text-sm font-bold ${stakeholder.currentScore >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                              {stakeholder.currentScore > 0 ? '+' : ''}{stakeholder.currentScore}
                            </div>
                            <div className={`text-xs flex items-center gap-0.5 ${stakeholder.trend === 'improving' ? 'text-emerald-600' : stakeholder.trend === 'declining' ? 'text-red-600' : 'text-slate-400'}`}>
                              {stakeholder.trend === 'improving' ? <TrendingUp className="h-3 w-3" /> : stakeholder.trend === 'declining' ? <TrendingDown className="h-3 w-3" /> : <Minus className="h-3 w-3" />}
                              {stakeholder.changePercent > 0 ? '+' : ''}{stakeholder.changePercent}%
                            </div>
                          </div>
                        </div>
                      </div>
                      <AnimatePresence>
                        {selectedStakeholder === stakeholder.name && (
                          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="mt-2 pt-2 border-t border-slate-100 overflow-hidden">
                            <div className="grid grid-cols-3 gap-2 text-xs">
                              <div><span className="text-slate-400">High</span> <span className="font-bold text-emerald-600">+{Math.max(...stakeholder.scores)}</span></div>
                              <div><span className="text-slate-400">Low</span> <span className="font-bold text-red-600">{Math.min(...stakeholder.scores)}</span></div>
                              <div><span className="text-slate-400">Avg</span> <span className="font-bold text-slate-700">{Math.round(stakeholder.scores.reduce((a, b) => a + b, 0) / stakeholder.scores.length)}</span></div>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center text-slate-400">
                  <Users className="h-10 w-10 text-slate-300 mb-2" />
                  <p className="text-sm">No stakeholder data yet</p>
                </div>
              )}
            </div>
          )}

          {activeTab === 'insights' && (
            <div className="h-full flex flex-col gap-3">
              {/* AI Insights - Compact */}
              <div className="bg-purple-50 rounded-lg p-3 border border-purple-100 flex-1 overflow-y-auto">
                <h4 className="font-semibold text-sm text-purple-900 mb-2 flex items-center gap-1.5">
                  <Zap className="h-4 w-4" /> AI Insights
                </h4>
                <div className="space-y-2">
                  <div className="flex items-start gap-2">
                    <div className={`p-1.5 rounded ${metrics.trend === 'improving' ? 'bg-emerald-100' : metrics.trend === 'declining' ? 'bg-red-100' : 'bg-slate-100'}`}>
                      {metrics.trend === 'improving' ? <TrendingUp className="h-3 w-3 text-emerald-600" /> : metrics.trend === 'declining' ? <TrendingDown className="h-3 w-3 text-red-600" /> : <Minus className="h-3 w-3 text-slate-600" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-slate-800 text-xs">Trend</div>
                      <p className="text-xs text-slate-600">
                        {metrics.trend === 'improving' ? `Positive trend (+${metrics.changePercent}%), MA: ${metrics.movingAverage > 0 ? '+' : ''}${metrics.movingAverage}` : metrics.trend === 'declining' ? `Declining (${metrics.changePercent}%). Address stakeholder concerns.` : `Stable, volatility ±${metrics.volatility}`}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <div className={`p-1.5 rounded ${metrics.volatility < 15 ? 'bg-emerald-100' : metrics.volatility < 30 ? 'bg-amber-100' : 'bg-red-100'}`}>
                      <Activity className={`h-3 w-3 ${metrics.volatility < 15 ? 'text-emerald-600' : metrics.volatility < 30 ? 'text-amber-600' : 'text-red-600'}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-slate-800 text-xs">Stability</div>
                      <p className="text-xs text-slate-600">
                        {metrics.volatility < 15 ? 'High stability - consistent sentiment' : metrics.volatility < 30 ? 'Moderate volatility - monitor closely' : 'High volatility - conflicting stakeholder interests'}
                      </p>
                    </div>
                  </div>
                  {showPrediction && (
                    <div className="flex items-start gap-2">
                      <div className="p-1.5 rounded bg-blue-100"><Zap className="h-3 w-3 text-blue-600" /></div>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-slate-800 text-xs">Forecast</div>
                        <p className="text-xs text-slate-600">Projected: <span className="font-semibold">{metrics.prediction > 0 ? '+' : ''}{metrics.prediction}</span> • {metrics.dataPoints >= 10 ? 'High' : metrics.dataPoints >= 5 ? 'Medium' : 'Low'} confidence</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
              {/* Recommendations - Compact */}
              <div className="bg-white rounded-lg p-3 border border-slate-200">
                <h4 className="font-semibold text-xs text-slate-700 mb-2 flex items-center gap-1"><CheckCircle2 className="h-3 w-3 text-emerald-600" /> Actions</h4>
                <div className="space-y-1.5">
                  {metrics.trend === 'declining' && <div className="flex items-center gap-2 p-2 bg-red-50 rounded text-xs text-red-700 border border-red-100"><AlertCircle className="h-3 w-3 flex-shrink-0" />Schedule stakeholder review meetings</div>}
                  {metrics.volatility >= 30 && <div className="flex items-center gap-2 p-2 bg-amber-50 rounded text-xs text-amber-700 border border-amber-100"><AlertTriangle className="h-3 w-3 flex-shrink-0" />Increase communication frequency</div>}
                  {stakeholderTrends.some(s => s.trend === 'declining') && <div className="flex items-center gap-2 p-2 bg-orange-50 rounded text-xs text-orange-700 border border-orange-100"><Users className="h-3 w-3 flex-shrink-0" />{stakeholderTrends.filter(s => s.trend === 'declining').length} stakeholder(s) declining</div>}
                  {metrics.trend === 'improving' && metrics.volatility < 20 && <div className="flex items-center gap-2 p-2 bg-emerald-50 rounded text-xs text-emerald-700 border border-emerald-100"><CheckCircle2 className="h-3 w-3 flex-shrink-0" />Healthy - maintain approach</div>}
                  <div className="flex items-center gap-2 p-2 bg-blue-50 rounded text-xs text-blue-700 border border-blue-100"><RefreshCw className="h-3 w-3 flex-shrink-0" />Continue regular analysis</div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer - Minimal */}
        <div className="px-4 py-2 border-t border-slate-100 bg-slate-50 flex items-center justify-between flex-shrink-0 rounded-b-xl">
          <span className="text-xs text-slate-400">
            {filteredHistory.length > 0 ? `${new Date(filteredHistory[0].timestamp).toLocaleDateString()} — ${new Date(filteredHistory[filteredHistory.length - 1].timestamp).toLocaleDateString()}` : 'No data'}
          </span>
          <button onClick={onClose} className="text-xs text-slate-500 hover:text-slate-700 font-medium">Close</button>
        </div>
      </motion.div>
    </div>
  );
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================

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
  const [analysisProgress, setAnalysisProgress] = useState(0);
  
  // New state for historical tracking and evidence
  const [sentimentHistory, setSentimentHistory] = useState<SentimentHistory[]>([]);
  const [showHistoryChart, setShowHistoryChart] = useState(false);
  const [evidenceModal, setEvidenceModal] = useState<{ stakeholder: StakeholderSentiment } | null>(null);
  const [contentHash, setContentHash] = useState<string>('');

  // Load sentiment history from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem(`${HISTORY_STORAGE_KEY}_${project.id}`);
      if (stored) {
        setSentimentHistory(JSON.parse(stored));
      }
    } catch (e) {
      console.error('Failed to load sentiment history:', e);
    }
  }, [project.id]);

  // Generate content hash when insights change
  useEffect(() => {
    if (project.insights) {
      setContentHash(generateContentHash(project.insights));
    }
  }, [project.insights]);

  // Save sentiment history to localStorage
  const saveHistory = useCallback((newReport: SentimentReport) => {
    const newEntry: SentimentHistory = {
      timestamp: new Date().toISOString(),
      averageScore: newReport.averageSentimentScore,
      stakeholderScores: Object.fromEntries(
        newReport.stakeholders.map(s => [s.stakeholder, s.sentimentScore])
      ),
      overallSentiment: newReport.overallProjectSentiment
    };

    setSentimentHistory(prev => {
      const updated = [...prev, newEntry].slice(-MAX_HISTORY_ENTRIES);
      try {
        localStorage.setItem(`${HISTORY_STORAGE_KEY}_${project.id}`, JSON.stringify(updated));
      } catch (e) {
        console.error('Failed to save sentiment history:', e);
      }
      return updated;
    });
  }, [project.id]);

  // Open evidence modal for a stakeholder
  const openEvidenceModal = (stakeholder: StakeholderSentiment) => {
    setEvidenceModal({ stakeholder });
  };

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

  // Load cached report on mount - with content hash validation
  useEffect(() => {
    const cachedReport = (project as any).sentimentReport;
    const cachedHash = (project as any).sentimentContentHash;
    if (cachedReport) {
      // Only use cache if content hash matches
      if (cachedHash === contentHash || !contentHash) {
        setReport(cachedReport);
        setLastAnalyzed(new Date((project as any).sentimentAnalyzedAt || Date.now()));
      }
    }
  }, [project, contentHash]);

  const handleAnalyze = async () => {
    if (!project.insights || project.insights.length === 0) {
      setError('Need insights to analyze stakeholder sentiment');
      return;
    }

    setIsAnalyzing(true);
    setError(null);
    setAnalysisProgress(0);

    // Simulate progress for better UX
    const progressInterval = setInterval(() => {
      setAnalysisProgress(prev => Math.min(prev + 8, 90));
    }, 400);

    try {
      const result = await analyzeStakeholderSentiment(project.insights, project.sources || []);
      setAnalysisProgress(100);
      clearInterval(progressInterval);
      setReport(result);
      setLastAnalyzed(new Date());

      // Save to history for trend tracking
      saveHistory(result);

      // Cache the report with content hash for proper invalidation
      const currentHash = generateContentHash(project.insights);
      const updated = await updateProjectContext({
        ...project,
        sentimentReport: result,
        sentimentAnalyzedAt: new Date().toISOString(),
        sentimentContentHash: currentHash
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
            {/* View Trends button hidden for now
            {sentimentHistory.length > 1 && (
              <Button 
                variant="outline"
                onClick={() => setShowHistoryChart(true)}
              >
                <LineChart className="h-4 w-4 mr-2" /> View Trends
              </Button>
            )}
            */}
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

      {/* Loading State with Progress */}
      {isAnalyzing && !report && (
        <div className="text-center py-20">
          <div className="w-16 h-16 bg-purple-50 rounded-full flex items-center justify-center mx-auto mb-6">
            <Loader className="h-8 w-8 text-purple-600 animate-spin" />
          </div>
          <h3 className="text-xl font-bold text-slate-900 mb-2">Analyzing Stakeholder Sentiment...</h3>
          <p className="text-slate-500 mb-4">AI is examining {project.insights.length} insights for sentiment patterns</p>
          {/* Progress Bar */}
          <div className="max-w-xs mx-auto">
            <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
              <motion.div 
                className="h-full bg-purple-500 rounded-full"
                initial={{ width: 0 }}
                animate={{ width: `${analysisProgress}%` }}
                transition={{ duration: 0.3 }}
              />
            </div>
            <p className="text-xs text-slate-400 mt-2">{analysisProgress}% complete</p>
          </div>
        </div>
      )}

      {/* Report Content */}
      {report && (
        <div className="space-y-8">
          {/* Overall Sentiment Gauge */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-slate-50 rounded-3xl p-8 border border-slate-200"
          >
            <h2 className="text-xl font-bold text-slate-900 mb-6 text-center">Overall Project Sentiment</h2>
            
            {/* Sentiment Gauge */}
            <div className="relative max-w-md mx-auto mb-6">
              <div className="h-4 bg-slate-200 rounded-full overflow-hidden flex">
                <div className="flex-1 bg-red-400" />
                <div className="flex-1 bg-amber-400" />
                <div className="flex-1 bg-emerald-400" />
              </div>
              <div 
                className="absolute top-0 w-4 h-4 bg-white border-2 border-slate-800 rounded-full shadow-lg transform -translate-x-1/2 transition-all duration-500"
                style={{ left: `${gaugePosition}%` }}
              />
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

                    {/* View Evidence Button */}
                    <button
                      onClick={() => openEvidenceModal(stakeholder)}
                      className="mt-3 w-full px-3 py-2 bg-white/80 hover:bg-white text-slate-700 text-xs font-medium rounded-lg border border-slate-200 transition-colors flex items-center justify-center gap-2"
                    >
                      <Quote className="h-3 w-3" /> View Evidence & Quotes
                    </button>
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

      {/* Enterprise Trends Dashboard Modal */}
      {showHistoryChart && sentimentHistory.length > 0 && (
        <EnterpriseTrendsDashboard
          history={sentimentHistory}
          onClose={() => setShowHistoryChart(false)}
          currentReport={report}
        />
      )}

      {/* Evidence Modal - Drill down into stakeholder quotes */}
      {evidenceModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full max-h-[80vh] overflow-hidden"
          >
            <div className="px-6 py-4 border-b bg-purple-50 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-lg text-slate-900 flex items-center gap-2">
                  <Quote className="h-5 w-5 text-purple-600" />
                  Evidence & Quotes
                </h3>
                <p className="text-sm text-slate-600">
                  Stakeholder: <span className="font-medium">{evidenceModal.stakeholder.stakeholder}</span>
                  {evidenceModal.stakeholder.role && ` - ${evidenceModal.stakeholder.role}`}
                </p>
              </div>
              <button
                onClick={() => setEvidenceModal(null)}
                className="p-2 hover:bg-white rounded-lg transition-colors"
              >
                <X className="h-5 w-5 text-slate-600" />
              </button>
            </div>
            <div className="p-6 overflow-y-auto max-h-[60vh]">
              {/* Sentiment Summary */}
              <div className="flex items-center gap-4 p-4 bg-slate-50 rounded-xl mb-6">
                <div className={`p-3 rounded-xl ${SENTIMENT_CONFIG[evidenceModal.stakeholder.overallSentiment].bg}`}>
                  {React.createElement(SENTIMENT_CONFIG[evidenceModal.stakeholder.overallSentiment].icon, { 
                    className: `h-6 w-6 ${SENTIMENT_CONFIG[evidenceModal.stakeholder.overallSentiment].text}` 
                  })}
                </div>
                <div>
                  <div className="font-bold text-slate-900">
                    Sentiment Score: {evidenceModal.stakeholder.sentimentScore > 0 ? '+' : ''}{evidenceModal.stakeholder.sentimentScore}
                  </div>
                  <div className="text-sm text-slate-600 capitalize">
                    {evidenceModal.stakeholder.overallSentiment} sentiment • {evidenceModal.stakeholder.engagementLevel} engagement
                  </div>
                </div>
              </div>

              {/* Evidence Quotes */}
              {evidenceModal.stakeholder.evidenceQuotes && evidenceModal.stakeholder.evidenceQuotes.length > 0 ? (
                <div className="space-y-4">
                  <h4 className="font-bold text-slate-700 flex items-center gap-2">
                    <FileText className="h-4 w-4" /> Supporting Evidence
                  </h4>
                  {evidenceModal.stakeholder.evidenceQuotes.map((quote, idx) => (
                    <div 
                      key={idx} 
                      className={`p-4 rounded-xl border-l-4 ${
                        quote.sentiment === 'positive' ? 'bg-emerald-50 border-emerald-500' :
                        quote.sentiment === 'negative' ? 'bg-red-50 border-red-500' :
                        'bg-slate-50 border-slate-400'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <Quote className={`h-4 w-4 mt-1 flex-shrink-0 ${
                          quote.sentiment === 'positive' ? 'text-emerald-500' :
                          quote.sentiment === 'negative' ? 'text-red-500' :
                          'text-slate-400'
                        }`} />
                        <div className="flex-1">
                          <p className="text-sm text-slate-800 italic">&ldquo;{quote.text}&rdquo;</p>
                          <p className="text-xs text-slate-500 mt-2 flex items-center gap-1">
                            <FileText className="h-3 w-3" /> {quote.source}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-slate-500">
                  <Quote className="h-12 w-12 text-slate-300 mx-auto mb-3" />
                  <p>No specific evidence quotes were extracted for this analysis.</p>
                  <p className="text-sm mt-2">Run a new analysis to gather evidence from your sources.</p>
                </div>
              )}

              {/* Concerns and Supports Summary */}
              <div className="grid md:grid-cols-2 gap-4 mt-6">
                {evidenceModal.stakeholder.concerns.length > 0 && (
                  <div className="bg-red-50 rounded-xl p-4 border border-red-100">
                    <h5 className="font-medium text-red-900 mb-2">Concerns ({evidenceModal.stakeholder.concerns.length})</h5>
                    <ul className="space-y-1">
                      {evidenceModal.stakeholder.concerns.map((c, i) => (
                        <li key={i} className="text-sm text-red-700 flex items-start gap-2">
                          <span className="text-red-400 mt-1">•</span> {c}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {evidenceModal.stakeholder.supportedItems.length > 0 && (
                  <div className="bg-emerald-50 rounded-xl p-4 border border-emerald-100">
                    <h5 className="font-medium text-emerald-900 mb-2">Supports ({evidenceModal.stakeholder.supportedItems.length})</h5>
                    <ul className="space-y-1">
                      {evidenceModal.stakeholder.supportedItems.map((s, i) => (
                        <li key={i} className="text-sm text-emerald-700 flex items-start gap-2">
                          <span className="text-emerald-400 mt-1">•</span> {s}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
            <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex justify-end">
              <Button variant="outline" onClick={() => setEvidenceModal(null)}>
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
