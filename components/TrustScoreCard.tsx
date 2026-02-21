/**
 * TrustScoreCard - Modern Trust Score Visualization
 * 
 * A beautiful, compact card for displaying project trust scores.
 */

import React, { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Shield,
  ShieldCheck,
  ShieldAlert,
  ShieldX,
  ChevronDown,
  ChevronUp,
  FileSearch,
  UserCheck,
  GitCompare,
  CheckSquare,
  Clock,
  AlertTriangle,
  AlertCircle,
  Info,
  Lightbulb,
  TrendingUp,
  Sparkles,
} from 'lucide-react';
import {
  TrustScore,
  TrustDimension,
  TrustAlert,
  TrustGrade,
  getTrustColors,
  calculateTrustScore,
} from '../utils/TrustScoreEngine';
import { ProjectState } from '../utils/db';

// ============================================================================
// TYPES
// ============================================================================

interface TrustScoreCardProps {
  project: ProjectState;
  variant?: 'compact' | 'expanded' | 'minimal';
  showDimensions?: boolean;
  showAlerts?: boolean;
  showTips?: boolean;
  className?: string;
}

// ============================================================================
// ICON MAPPING
// ============================================================================

const DIMENSION_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  evidence: FileSearch,
  validation: UserCheck,
  consistency: GitCompare,
  completeness: CheckSquare,
  freshness: Clock,
};

// ============================================================================
// GRADE BADGE
// ============================================================================

const GradeBadge: React.FC<{ grade: TrustGrade; size?: 'sm' | 'md' | 'lg' }> = ({ 
  grade, 
  size = 'md' 
}) => {
  const colors: Record<TrustGrade, string> = {
    A: 'bg-emerald-500 text-white',
    B: 'bg-green-500 text-white',
    C: 'bg-yellow-500 text-white',
    D: 'bg-orange-500 text-white',
    F: 'bg-red-500 text-white',
  };
  
  const sizes = {
    sm: 'w-6 h-6 text-xs',
    md: 'w-8 h-8 text-sm',
    lg: 'w-10 h-10 text-base',
  };
  
  return (
    <div 
      className={`${sizes[size]} ${colors[grade]} rounded-lg font-bold flex items-center justify-center shadow-sm`}
    >
      {grade}
    </div>
  );
};

// ============================================================================
// CIRCULAR PROGRESS
// ============================================================================

const CircularProgress: React.FC<{ 
  score: number; 
  size?: number;
  strokeWidth?: number;
  animated?: boolean;
}> = ({ 
  score, 
  size = 80,
  strokeWidth = 6,
  animated = true,
}) => {
  const colors = getTrustColors(score);
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;
  
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg 
        width={size} 
        height={size} 
        className="transform -rotate-90"
      >
        {/* Background circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          className="text-slate-100"
        />
        {/* Progress circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={animated ? 0 : offset}
          className={`${colors.text} transition-all duration-1000 ease-out`}
          style={{ 
            strokeDashoffset: offset,
            stroke: 'currentColor',
          }}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className={`text-xl font-bold ${colors.text}`}>{score}</span>
      </div>
    </div>
  );
};

// ============================================================================
// DIMENSION BAR
// ============================================================================

const DimensionBar: React.FC<{ dimension: TrustDimension }> = ({ dimension }) => {
  const colors = getTrustColors(dimension.score);
  const Icon = DIMENSION_ICONS[dimension.id] || Shield;
  
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon className={`w-4 h-4 ${colors.text}`} />
          <span className="text-sm font-medium text-slate-700">{dimension.name}</span>
        </div>
        <span className={`text-sm font-semibold ${colors.text}`}>{dimension.score}%</span>
      </div>
      <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${dimension.score}%` }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
          className={`h-full rounded-full bg-gradient-to-r ${colors.gradient}`}
        />
      </div>
    </div>
  );
};

// ============================================================================
// ALERT ITEM
// ============================================================================

const AlertItem: React.FC<{ alert: TrustAlert }> = ({ alert }) => {
  const colors = {
    critical: { bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-700', icon: AlertCircle },
    warning: { bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-700', icon: AlertTriangle },
    info: { bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-700', icon: Info },
  };
  
  const c = colors[alert.level];
  const Icon = c.icon;
  
  return (
    <div className={`flex gap-2 p-2 rounded-lg ${c.bg} border ${c.border}`}>
      <Icon className={`w-4 h-4 ${c.text} flex-shrink-0 mt-0.5`} />
      <div className="flex-1 min-w-0">
        <p className={`text-sm ${c.text}`}>{alert.message}</p>
        {alert.action && (
          <p className={`text-xs ${c.text} opacity-75 mt-0.5`}>💡 {alert.action}</p>
        )}
      </div>
    </div>
  );
};

// ============================================================================
// TIP ITEM
// ============================================================================

const TipItem: React.FC<{ tip: string }> = ({ tip }) => (
  <div className="flex gap-2 items-start text-sm text-slate-600">
    <Lightbulb className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
    <span>{tip}</span>
  </div>
);

// ============================================================================
// SHIELD ICON
// ============================================================================

const TrustShield: React.FC<{ score: number; size?: 'sm' | 'md' | 'lg' }> = ({ 
  score, 
  size = 'md' 
}) => {
  const sizes = {
    sm: 'w-5 h-5',
    md: 'w-6 h-6',
    lg: 'w-8 h-8',
  };
  
  if (score >= 90) return <ShieldCheck className={`${sizes[size]} text-emerald-600`} />;
  if (score >= 75) return <ShieldCheck className={`${sizes[size]} text-green-600`} />;
  if (score >= 60) return <Shield className={`${sizes[size]} text-yellow-600`} />;
  if (score >= 40) return <ShieldAlert className={`${sizes[size]} text-orange-600`} />;
  return <ShieldX className={`${sizes[size]} text-red-600`} />;
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export const TrustScoreCard: React.FC<TrustScoreCardProps> = ({
  project,
  variant = 'compact',
  showDimensions = true,
  showAlerts = true,
  showTips = false,
  className = '',
}) => {
  const [isExpanded, setIsExpanded] = useState(variant === 'expanded');
  
  // Calculate trust score
  const trustScore = useMemo(() => calculateTrustScore(project), [
    project.id,
    project.lastUpdated,
    project.insights?.length,
    project.sources?.length,
  ]);
  
  const colors = getTrustColors(trustScore.overall);
  
  // Minimal variant - just the score badge
  if (variant === 'minimal') {
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        <TrustShield score={trustScore.overall} size="sm" />
        <span className={`font-semibold ${colors.text}`}>{trustScore.overall}%</span>
        <GradeBadge grade={trustScore.grade} size="sm" />
      </div>
    );
  }
  
  // Collect all tips from dimensions
  const allTips = trustScore.dimensions.flatMap(d => d.tips).slice(0, 5);
  
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`bg-white rounded-xl border ${colors.border} shadow-sm overflow-hidden ${className}`}
    >
      {/* Header */}
      <div 
        className={`p-4 ${colors.bg} cursor-pointer`}
        onClick={() => variant === 'compact' && setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <CircularProgress score={trustScore.overall} size={60} strokeWidth={5} />
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-slate-800">Trust Score</h3>
                <GradeBadge grade={trustScore.grade} size="sm" />
              </div>
              <p className={`text-sm ${colors.text} capitalize`}>{trustScore.level}</p>
            </div>
          </div>
          
          {variant === 'compact' && (
            <button className="p-1 hover:bg-white/50 rounded transition-colors">
              {isExpanded ? (
                <ChevronUp className="w-5 h-5 text-slate-500" />
              ) : (
                <ChevronDown className="w-5 h-5 text-slate-500" />
              )}
            </button>
          )}
        </div>
        
        {/* Summary */}
        <p className="mt-2 text-sm text-slate-600">{trustScore.summary}</p>
      </div>
      
      {/* Expandable Content */}
      <AnimatePresence>
        {(isExpanded || variant === 'expanded') && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="p-4 space-y-4">
              {/* Dimensions */}
              {showDimensions && (
                <div className="space-y-3">
                  <h4 className="text-sm font-medium text-slate-700 flex items-center gap-2">
                    <TrendingUp className="w-4 h-4" />
                    Trust Dimensions
                  </h4>
                  <div className="space-y-3">
                    {trustScore.dimensions.map(dim => (
                      <DimensionBar key={dim.id} dimension={dim} />
                    ))}
                  </div>
                </div>
              )}
              
              {/* Alerts */}
              {showAlerts && trustScore.alerts.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-sm font-medium text-slate-700 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4" />
                    Attention Needed ({trustScore.alerts.length})
                  </h4>
                  <div className="space-y-2">
                    {trustScore.alerts.slice(0, 3).map(alert => (
                      <AlertItem key={alert.id} alert={alert} />
                    ))}
                  </div>
                </div>
              )}
              
              {/* Tips */}
              {showTips && allTips.length > 0 && (
                <div className="space-y-2 pt-2 border-t border-slate-100">
                  <h4 className="text-sm font-medium text-slate-700 flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-amber-500" />
                    Improvement Tips
                  </h4>
                  <div className="space-y-2">
                    {allTips.map((tip, i) => (
                      <TipItem key={i} tip={tip} />
                    ))}
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

// ============================================================================
// INLINE TRUST BADGE
// ============================================================================

export const TrustBadge: React.FC<{ 
  score: number; 
  showLabel?: boolean;
  size?: 'sm' | 'md';
}> = ({ 
  score, 
  showLabel = false,
  size = 'sm',
}) => {
  const colors = getTrustColors(score);
  
  return (
    <div className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full ${colors.bg} ${colors.border} border`}>
      <TrustShield score={score} size="sm" />
      <span className={`font-medium ${colors.text} ${size === 'sm' ? 'text-xs' : 'text-sm'}`}>
        {score}%
      </span>
      {showLabel && (
        <span className={`${colors.text} opacity-75 ${size === 'sm' ? 'text-xs' : 'text-sm'}`}>
          trust
        </span>
      )}
    </div>
  );
};

// ============================================================================
// EXPORTS
// ============================================================================

export default TrustScoreCard;
