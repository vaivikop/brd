/**
 * TrustScoreDisplay Component
 * 
 * Comprehensive visualization for the TrustScoreEngine v2.0 results.
 * Shows score breakdown, factor analysis, warnings, and recommendations.
 */

import React, { useState, useMemo } from 'react';
import { 
  Shield, 
  ShieldCheck, 
  ShieldAlert, 
  ShieldX,
  AlertTriangle,
  AlertCircle,
  CheckCircle,
  Info,
  ChevronDown,
  ChevronUp,
  TrendingUp,
  TrendingDown,
  Minus,
  Lightbulb,
  BarChart3,
  Clock,
  Users,
  FileText,
  GitBranch,
  MessageSquare,
  Zap
} from 'lucide-react';
import { 
  TrustScoreResult, 
  TrustFactor, 
  TrustWarning,
  getTrustScoreColor 
} from '../utils/TrustScoreEngine';

interface TrustScoreDisplayProps {
  result: TrustScoreResult;
  variant?: 'compact' | 'detailed' | 'full';
  showFactors?: boolean;
  showWarnings?: boolean;
  showRecommendations?: boolean;
  animated?: boolean;
  className?: string;
}

// Factor icons mapping
const FACTOR_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  'Evidence Quantity': FileText,
  'Source Reliability': Shield,
  'Linguistic Confidence': MessageSquare,
  'Temporal Freshness': Clock,
  'Stakeholder Consensus': Users,
  'Cross-Validation': GitBranch,
  'Conflict Impact': AlertTriangle,
  'Insight Coverage': BarChart3,
  'Source Diversity': Zap,
  'BRD Completeness': FileText,
  'Task Resolution': CheckCircle,
  'Aggregate Insight Confidence': Shield,
  'Stakeholder Engagement': Users
};

// Warning severity colors
const WARNING_COLORS: Record<TrustWarning['severity'], { bg: string; text: string; border: string }> = {
  critical: { bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200' },
  high: { bg: 'bg-orange-50', text: 'text-orange-700', border: 'border-orange-200' },
  medium: { bg: 'bg-yellow-50', text: 'text-yellow-700', border: 'border-yellow-200' },
  low: { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200' }
};

// Confidence level icons
const getConfidenceLevelIcon = (level: TrustScoreResult['confidenceLevel']) => {
  switch (level) {
    case 'very-high':
      return <ShieldCheck className="h-5 w-5 text-emerald-600" />;
    case 'high':
      return <ShieldCheck className="h-5 w-5 text-green-600" />;
    case 'medium':
      return <Shield className="h-5 w-5 text-yellow-600" />;
    case 'low':
      return <ShieldAlert className="h-5 w-5 text-orange-600" />;
    case 'very-low':
      return <ShieldX className="h-5 w-5 text-red-600" />;
  }
};

// Score ring component
const ScoreRing: React.FC<{ score: number; size?: 'sm' | 'md' | 'lg'; animated?: boolean }> = ({ 
  score, 
  size = 'md',
  animated = true 
}) => {
  const colors = getTrustScoreColor(score);
  const circumference = 2 * Math.PI * 45;
  const strokeDashoffset = circumference - (score / 100) * circumference;
  
  const sizes = {
    sm: { container: 'w-16 h-16', text: 'text-lg', stroke: 6 },
    md: { container: 'w-24 h-24', text: 'text-2xl', stroke: 8 },
    lg: { container: 'w-32 h-32', text: 'text-3xl', stroke: 10 }
  };
  
  const s = sizes[size];

  return (
    <div className={`relative ${s.container}`}>
      <svg className="w-full h-full transform -rotate-90">
        {/* Background circle */}
        <circle
          cx="50%"
          cy="50%"
          r="45%"
          fill="none"
          stroke="currentColor"
          strokeWidth={s.stroke}
          className="text-slate-200"
        />
        {/* Progress circle */}
        <circle
          cx="50%"
          cy="50%"
          r="45%"
          fill="none"
          stroke="url(#scoreGradient)"
          strokeWidth={s.stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={animated ? strokeDashoffset : circumference}
          className={animated ? 'transition-all duration-1000 ease-out' : ''}
          style={{ 
            strokeDashoffset: animated ? undefined : strokeDashoffset 
          }}
        />
        <defs>
          <linearGradient id="scoreGradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" className={`stop-color-${colors.gradient.split(' ')[0].replace('from-', '')}`} />
            <stop offset="100%" className={`stop-color-${colors.gradient.split(' ')[1].replace('to-', '')}`} />
          </linearGradient>
        </defs>
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className={`${s.text} font-bold ${colors.text}`}>{score}</span>
      </div>
    </div>
  );
};

// Factor bar component
const FactorBar: React.FC<{ factor: TrustFactor; animated?: boolean }> = ({ factor, animated }) => {
  const Icon = FACTOR_ICONS[factor.name] || Shield;
  const colors = getTrustScoreColor(factor.score);
  
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon className={`h-4 w-4 ${colors.text}`} />
          <span className="text-sm font-medium text-slate-700">{factor.name}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-sm font-semibold ${colors.text}`}>{factor.score}%</span>
          <span className="text-xs text-slate-400">({Math.round(factor.weight * 100)}% weight)</span>
        </div>
      </div>
      <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
        <div 
          className={`h-full rounded-full bg-gradient-to-r ${colors.gradient} ${animated ? 'transition-all duration-700 ease-out' : ''}`}
          style={{ width: `${factor.score}%` }}
        />
      </div>
      <p className="text-xs text-slate-500">{factor.explanation}</p>
    </div>
  );
};

// Warning card component
const WarningCard: React.FC<{ warning: TrustWarning }> = ({ warning }) => {
  const colors = WARNING_COLORS[warning.severity];
  const Icon = warning.severity === 'critical' ? AlertCircle : AlertTriangle;
  
  return (
    <div className={`p-3 rounded-lg border ${colors.bg} ${colors.border}`}>
      <div className="flex items-start gap-2">
        <Icon className={`h-4 w-4 ${colors.text} flex-shrink-0 mt-0.5`} />
        <div>
          <div className="flex items-center gap-2">
            <span className={`text-xs font-semibold uppercase ${colors.text}`}>
              {warning.severity}
            </span>
            <span className={`text-xs ${colors.text} opacity-75`}>
              {warning.type.replace('-', ' ')}
            </span>
          </div>
          <p className={`text-sm ${colors.text} mt-1`}>{warning.message}</p>
        </div>
      </div>
    </div>
  );
};

// Recommendation card component
const RecommendationCard: React.FC<{ recommendation: string; index: number }> = ({ recommendation, index }) => (
  <div className="flex items-start gap-3 p-3 bg-blue-50 rounded-lg border border-blue-100">
    <div className="flex-shrink-0 w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center">
      <span className="text-xs font-bold text-blue-600">{index + 1}</span>
    </div>
    <div className="flex items-center gap-2">
      <Lightbulb className="h-4 w-4 text-blue-500 flex-shrink-0" />
      <p className="text-sm text-blue-700">{recommendation}</p>
    </div>
  </div>
);

// Main component
export const TrustScoreDisplay: React.FC<TrustScoreDisplayProps> = ({
  result,
  variant = 'detailed',
  showFactors = true,
  showWarnings = true,
  showRecommendations = true,
  animated = true,
  className = ''
}) => {
  const [expandedSection, setExpandedSection] = useState<'factors' | 'warnings' | 'recommendations' | null>(
    variant === 'full' ? 'factors' : null
  );

  const colors = useMemo(() => getTrustScoreColor(result.finalScore), [result.finalScore]);

  // Compact variant
  if (variant === 'compact') {
    return (
      <div className={`flex items-center gap-3 ${className}`}>
        {getConfidenceLevelIcon(result.confidenceLevel)}
        <div>
          <div className="flex items-center gap-2">
            <span className={`text-lg font-bold ${colors.text}`}>{result.finalScore}%</span>
            <span className="text-xs text-slate-500 capitalize">
              {result.confidenceLevel.replace('-', ' ')}
            </span>
          </div>
          {result.warnings.length > 0 && (
            <span className="text-xs text-orange-600">
              {result.warnings.length} warning{result.warnings.length !== 1 ? 's' : ''}
            </span>
          )}
        </div>
      </div>
    );
  }

  // Detailed/Full variant
  return (
    <div className={`bg-white rounded-xl border border-slate-200 shadow-sm ${className}`}>
      {/* Header */}
      <div className={`p-6 ${colors.bg} rounded-t-xl border-b ${colors.border}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <ScoreRing score={result.finalScore} size={variant === 'full' ? 'lg' : 'md'} animated={animated} />
            <div>
              <div className="flex items-center gap-2">
                {getConfidenceLevelIcon(result.confidenceLevel)}
                <h3 className="text-lg font-bold text-slate-900">Trust Score</h3>
              </div>
              <p className={`text-sm font-medium ${colors.text} capitalize mt-1`}>
                {result.confidenceLevel.replace('-', ' ')} Confidence
              </p>
              <p className="text-xs text-slate-500 mt-1">
                Based on {result.factors.length} factors • Dominant: {result.metadata.dominantFactor}
              </p>
            </div>
          </div>
          
          {/* Confidence interval */}
          <div className="text-right">
            <p className="text-xs text-slate-500">Confidence Interval</p>
            <p className="text-sm font-medium text-slate-700">
              {result.metadata.confidenceInterval.low}% - {result.metadata.confidenceInterval.high}%
            </p>
            <p className="text-xs text-slate-400 mt-1">
              Volatility: {Math.round(result.metadata.volatility * 100)}%
            </p>
          </div>
        </div>
      </div>

      {/* Factors Section */}
      {showFactors && (
        <div className="border-b border-slate-100">
          <button
            onClick={() => setExpandedSection(expandedSection === 'factors' ? null : 'factors')}
            className="w-full flex items-center justify-between p-4 hover:bg-slate-50 transition-colors"
          >
            <div className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-slate-500" />
              <span className="font-medium text-slate-700">Factor Breakdown</span>
              <span className="text-xs text-slate-400">({result.factors.length} factors)</span>
            </div>
            {expandedSection === 'factors' 
              ? <ChevronUp className="h-4 w-4 text-slate-400" />
              : <ChevronDown className="h-4 w-4 text-slate-400" />
            }
          </button>
          
          {(expandedSection === 'factors' || variant === 'full') && (
            <div className="px-4 pb-4 space-y-4">
              {result.factors.map((factor, index) => (
                <FactorBar key={index} factor={factor} animated={animated} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Warnings Section */}
      {showWarnings && result.warnings.length > 0 && (
        <div className="border-b border-slate-100">
          <button
            onClick={() => setExpandedSection(expandedSection === 'warnings' ? null : 'warnings')}
            className="w-full flex items-center justify-between p-4 hover:bg-slate-50 transition-colors"
          >
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-orange-500" />
              <span className="font-medium text-slate-700">Warnings</span>
              <span className="px-2 py-0.5 bg-orange-100 text-orange-700 text-xs font-medium rounded-full">
                {result.warnings.length}
              </span>
            </div>
            {expandedSection === 'warnings' 
              ? <ChevronUp className="h-4 w-4 text-slate-400" />
              : <ChevronDown className="h-4 w-4 text-slate-400" />
            }
          </button>
          
          {(expandedSection === 'warnings' || variant === 'full') && (
            <div className="px-4 pb-4 space-y-2">
              {result.warnings.map((warning, index) => (
                <WarningCard key={index} warning={warning} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Recommendations Section */}
      {showRecommendations && result.recommendations.length > 0 && (
        <div>
          <button
            onClick={() => setExpandedSection(expandedSection === 'recommendations' ? null : 'recommendations')}
            className="w-full flex items-center justify-between p-4 hover:bg-slate-50 transition-colors"
          >
            <div className="flex items-center gap-2">
              <Lightbulb className="h-4 w-4 text-blue-500" />
              <span className="font-medium text-slate-700">Recommendations</span>
              <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs font-medium rounded-full">
                {result.recommendations.length}
              </span>
            </div>
            {expandedSection === 'recommendations' 
              ? <ChevronUp className="h-4 w-4 text-slate-400" />
              : <ChevronDown className="h-4 w-4 text-slate-400" />
            }
          </button>
          
          {(expandedSection === 'recommendations' || variant === 'full') && (
            <div className="px-4 pb-4 space-y-2">
              {result.recommendations.map((rec, index) => (
                <RecommendationCard key={index} recommendation={rec} index={index} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Footer */}
      <div className="px-4 py-3 bg-slate-50 rounded-b-xl border-t border-slate-100">
        <div className="flex items-center justify-between text-xs text-slate-500">
          <span>TrustScoreEngine v{result.metadata.version}</span>
          <span>Calculated: {new Date(result.metadata.calculatedAt).toLocaleString()}</span>
        </div>
      </div>
    </div>
  );
};

// Quick inline score badge
export const TrustScoreBadge: React.FC<{ 
  score: number; 
  showLabel?: boolean;
  size?: 'sm' | 'md';
}> = ({ score, showLabel = false, size = 'md' }) => {
  const colors = getTrustScoreColor(score);
  const sizeClasses = size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-3 py-1 text-sm';
  
  return (
    <span className={`inline-flex items-center gap-1.5 ${colors.bg} ${colors.text} border ${colors.border} rounded-full ${sizeClasses} font-medium`}>
      <Shield className={size === 'sm' ? 'h-3 w-3' : 'h-4 w-4'} />
      {score}%
      {showLabel && (
        <span className="opacity-75">trust</span>
      )}
    </span>
  );
};

// Score comparison component
export const TrustScoreComparison: React.FC<{
  current: number;
  previous: number;
}> = ({ current, previous }) => {
  const diff = current - previous;
  const colors = getTrustScoreColor(current);
  
  if (Math.abs(diff) < 2) {
    return (
      <div className="flex items-center gap-1 text-slate-400">
        <Minus className="h-4 w-4" />
        <span className="text-sm">No change</span>
      </div>
    );
  }
  
  const isUp = diff > 0;
  return (
    <div className={`flex items-center gap-1 ${isUp ? 'text-emerald-600' : 'text-red-500'}`}>
      {isUp ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
      <span className="text-sm font-medium">{isUp ? '+' : ''}{diff}%</span>
    </div>
  );
};

export default TrustScoreDisplay;
