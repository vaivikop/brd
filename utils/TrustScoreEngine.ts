/**
 * TrustScoreEngine v3.0 - Clean, Actionable Trust Scoring
 * 
 * A streamlined trust scoring system that provides:
 * - Clear, understandable scores (0-100)
 * - Five key trust dimensions
 * - Visual feedback with colors/grades
 * - Actionable recommendations
 * - Event-based reactivity
 */

import { ProjectState, Insight, Source, BRDSection, Task } from './db';

// ============================================================================
// TYPES
// ============================================================================

export type TrustGrade = 'A' | 'B' | 'C' | 'D' | 'F';
export type TrustLevel = 'excellent' | 'good' | 'fair' | 'poor' | 'critical';

export interface TrustDimension {
  id: string;
  name: string;
  score: number;
  weight: number;
  icon: string;
  description: string;
  tips: string[];
}

export interface TrustAlert {
  id: string;
  level: 'critical' | 'warning' | 'info';
  message: string;
  action?: string;
}

export interface TrustScore {
  overall: number;
  grade: TrustGrade;
  level: TrustLevel;
  dimensions: TrustDimension[];
  alerts: TrustAlert[];
  summary: string;
  calculatedAt: string;
}

export interface TrustColors {
  bg: string;
  text: string;
  border: string;
  gradient: string;
  ring: string;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const DIMENSION_WEIGHTS = {
  evidence: 0.25,      // Quality and quantity of evidence
  validation: 0.20,    // Stakeholder validation status
  consistency: 0.20,   // Cross-source agreement
  completeness: 0.20,  // Coverage of requirements
  freshness: 0.15,     // How recent the data is
};

// Helper to convert string confidence to numeric score
const confidenceToNumber = (confidence: 'high' | 'medium' | 'low' | undefined): number => {
  switch (confidence) {
    case 'high': return 85;
    case 'medium': return 60;
    case 'low': return 35;
    default: return 50;
  }
};

// ============================================================================
// SCORE UTILITIES
// ============================================================================

export const getGradeFromScore = (score: number): TrustGrade => {
  if (score >= 90) return 'A';
  if (score >= 75) return 'B';
  if (score >= 60) return 'C';
  if (score >= 40) return 'D';
  return 'F';
};

export const getLevelFromScore = (score: number): TrustLevel => {
  if (score >= 90) return 'excellent';
  if (score >= 75) return 'good';
  if (score >= 60) return 'fair';
  if (score >= 40) return 'poor';
  return 'critical';
};

export const getTrustColors = (score: number): TrustColors => {
  if (score >= 90) {
    return {
      bg: 'bg-emerald-50',
      text: 'text-emerald-700',
      border: 'border-emerald-200',
      gradient: 'from-emerald-500 to-green-500',
      ring: 'ring-emerald-500',
    };
  }
  if (score >= 75) {
    return {
      bg: 'bg-green-50',
      text: 'text-green-700',
      border: 'border-green-200',
      gradient: 'from-green-500 to-lime-500',
      ring: 'ring-green-500',
    };
  }
  if (score >= 60) {
    return {
      bg: 'bg-yellow-50',
      text: 'text-yellow-700',
      border: 'border-yellow-200',
      gradient: 'from-yellow-500 to-amber-500',
      ring: 'ring-yellow-500',
    };
  }
  if (score >= 40) {
    return {
      bg: 'bg-orange-50',
      text: 'text-orange-700',
      border: 'border-orange-200',
      gradient: 'from-orange-500 to-red-400',
      ring: 'ring-orange-500',
    };
  }
  return {
    bg: 'bg-red-50',
    text: 'text-red-700',
    border: 'border-red-200',
    gradient: 'from-red-500 to-rose-600',
    ring: 'ring-red-500',
  };
};

export const getTrustScoreColor = getTrustColors; // Alias for backwards compatibility

// ============================================================================
// DIMENSION CALCULATORS
// ============================================================================

/**
 * Evidence Score: Quality and quantity of source evidence
 */
const calculateEvidenceScore = (project: ProjectState): TrustDimension => {
  const sources = project.sources || [];
  const insights = project.insights || [];
  
  let score = 0;
  const tips: string[] = [];
  
  // Source count (0-30 points)
  const sourcePoints = Math.min(sources.length * 6, 30);
  score += sourcePoints;
  if (sources.length < 3) {
    tips.push('Add more data sources for stronger evidence');
  }
  
  // Source type diversity (0-20 points)
  const sourceTypes = new Set(sources.map(s => s.type));
  const diversityPoints = Math.min(sourceTypes.size * 5, 20);
  score += diversityPoints;
  if (sourceTypes.size < 3) {
    tips.push('Diversify source types (meetings, emails, documents)');
  }
  
  // Insight extraction rate (0-30 points)
  const insightsPerSource = sources.length > 0 ? insights.length / sources.length : 0;
  const extractionPoints = Math.min(insightsPerSource * 10, 30);
  score += extractionPoints;
  if (insightsPerSource < 2) {
    tips.push('Extract more insights from your sources');
  }
  
  // Source references (0-20 points)
  const insightsWithRefs = insights.filter(i => i.supportingSources && i.supportingSources.length > 0);
  const refRatio = insights.length > 0 ? insightsWithRefs.length / insights.length : 0;
  score += Math.round(refRatio * 20);
  if (refRatio < 0.7) {
    tips.push('Ensure insights have source references for traceability');
  }
  
  return {
    id: 'evidence',
    name: 'Evidence Quality',
    score: Math.round(score),
    weight: DIMENSION_WEIGHTS.evidence,
    icon: 'FileSearch',
    description: 'Quality and quantity of source evidence supporting requirements',
    tips,
  };
};

/**
 * Validation Score: Stakeholder validation status
 */
const calculateValidationScore = (project: ProjectState): TrustDimension => {
  const insights = project.insights || [];
  
  let score = 0;
  const tips: string[] = [];
  
  if (insights.length === 0) {
    return {
      id: 'validation',
      name: 'Validation Status',
      score: 0,
      weight: DIMENSION_WEIGHTS.validation,
      icon: 'UserCheck',
      description: 'Stakeholder approval and validation of requirements',
      tips: ['Extract insights from sources to begin validation'],
    };
  }
  
  // Approved insights (0-50 points)
  const approved = insights.filter(i => i.status === 'approved').length;
  const approvedRatio = approved / insights.length;
  score += Math.round(approvedRatio * 50);
  
  // Non-rejected insights (0-20 points)
  const rejected = insights.filter(i => i.status === 'rejected').length;
  const nonRejectedRatio = 1 - (rejected / insights.length);
  score += Math.round(nonRejectedRatio * 20);
  
  // High priority insights validated (0-30 points)
  const highPriority = insights.filter(i => i.priority === 'must' || i.priority === 'should');
  const validatedHighPriority = highPriority.filter(i => i.status === 'approved').length;
  const highPriorityRatio = highPriority.length > 0 ? validatedHighPriority / highPriority.length : 1;
  score += Math.round(highPriorityRatio * 30);
  
  // Generate tips
  const pendingCount = insights.filter(i => i.status === 'pending').length;
  if (pendingCount > 0) {
    tips.push(`${pendingCount} insight(s) pending validation`);
  }
  if (rejected > 0) {
    tips.push(`${rejected} insight(s) rejected - review and revise`);
  }
  if (approvedRatio < 0.5) {
    tips.push('Get stakeholder approval on more insights');
  }
  
  return {
    id: 'validation',
    name: 'Validation Status',
    score: Math.round(score),
    weight: DIMENSION_WEIGHTS.validation,
    icon: 'UserCheck',
    description: 'Stakeholder approval and validation of requirements',
    tips,
  };
};

/**
 * Consistency Score: Cross-source agreement
 */
const calculateConsistencyScore = (project: ProjectState): TrustDimension => {
  const insights = project.insights || [];
  
  let score = 100; // Start at 100 and deduct
  const tips: string[] = [];
  
  // Insights with conflicts penalty (-20 per conflicting insight, max -60)
  const conflictingInsights = insights.filter(i => i.hasConflicts).length;
  score -= Math.min(conflictingInsights * 20, 60);
  if (conflictingInsights > 0) {
    tips.push(`Resolve ${conflictingInsights} requirement conflict(s)`);
  }
  
  // Low confidence insights penalty
  const lowConfidence = insights.filter(i => i.confidence === 'low').length;
  const lowConfRatio = insights.length > 0 ? lowConfidence / insights.length : 0;
  score -= Math.round(lowConfRatio * 20);
  if (lowConfidence > 0) {
    tips.push(`${lowConfidence} insight(s) have low confidence - verify sources`);
  }
  
  // Bonus for multiple source references (max +20)
  const multiSourceInsights = insights.filter(i => i.supportingSources && i.supportingSources.length > 1);
  const multiSourceRatio = insights.length > 0 ? multiSourceInsights.length / insights.length : 0;
  score += Math.round(multiSourceRatio * 20);
  if (multiSourceRatio < 0.3 && insights.length > 0) {
    tips.push('Cross-reference insights with multiple sources');
  }
  
  return {
    id: 'consistency',
    name: 'Consistency',
    score: Math.max(0, Math.min(100, score)),
    weight: DIMENSION_WEIGHTS.consistency,
    icon: 'GitCompare',
    description: 'Agreement and consistency across different sources',
    tips,
  };
};

/**
 * Completeness Score: Coverage of requirements
 */
const calculateCompletenessScore = (project: ProjectState): TrustDimension => {
  const insights = project.insights || [];
  const sections = project.brd?.sections || [];
  const tasks = project.tasks || [];
  
  let score = 0;
  const tips: string[] = [];
  
  // Insight category coverage (0-30 points)
  const categories = new Set(insights.map(i => i.category));
  const expectedCategories = ['functional', 'non-functional', 'stakeholder', 'decision', 'constraint'];
  const categoryScore = Math.round((categories.size / expectedCategories.length) * 30);
  score += categoryScore;
  
  const missingCategories = expectedCategories.filter(c => !categories.has(c as any));
  if (missingCategories.length > 0) {
    tips.push(`Missing categories: ${missingCategories.slice(0, 2).join(', ')}`);
  }
  
  // BRD section coverage (0-40 points)
  const filledSections = sections.filter(s => s.content && s.content.length > 100);
  const sectionRatio = sections.length > 0 ? filledSections.length / sections.length : 0;
  score += Math.round(sectionRatio * 40);
  if (sectionRatio < 0.7 && sections.length > 0) {
    tips.push('Complete more BRD sections with detailed content');
  }
  
  // Task resolution (0-30 points)
  const pendingTasks = tasks.length;
  const taskScore = Math.max(30 - (pendingTasks * 5), 0);
  score += taskScore;
  if (pendingTasks > 0) {
    tips.push(`${pendingTasks} clarification task(s) pending`);
  }
  
  return {
    id: 'completeness',
    name: 'Completeness',
    score: Math.min(100, score),
    weight: DIMENSION_WEIGHTS.completeness,
    icon: 'CheckSquare',
    description: 'Coverage of all requirement categories and BRD sections',
    tips,
  };
};

/**
 * Freshness Score: How recent the data is
 */
const calculateFreshnessScore = (project: ProjectState): TrustDimension => {
  const now = new Date();
  const insights = project.insights || [];
  
  let score = 100;
  const tips: string[] = [];
  
  // Project last update (0-40 points)
  if (project.lastUpdated) {
    const lastUpdate = new Date(project.lastUpdated);
    const daysSinceUpdate = Math.floor((now.getTime() - lastUpdate.getTime()) / (1000 * 60 * 60 * 24));
    
    if (daysSinceUpdate <= 1) score = 100;
    else if (daysSinceUpdate <= 7) score = 90;
    else if (daysSinceUpdate <= 14) score = 75;
    else if (daysSinceUpdate <= 30) score = 60;
    else score = Math.max(30, 60 - (daysSinceUpdate - 30));
    
    if (daysSinceUpdate > 7) {
      tips.push(`Last updated ${daysSinceUpdate} days ago - consider refreshing data`);
    }
  }
  
  // Check for old insights without recent validation
  const oldInsights = insights.filter(i => {
    if (!i.timestamp) return false;
    const created = new Date(i.timestamp);
    const daysSince = Math.floor((now.getTime() - created.getTime()) / (1000 * 60 * 60 * 24));
    return daysSince > 30 && i.status === 'pending';
  });
  
  if (oldInsights.length > 0) {
    score -= 10;
    tips.push(`${oldInsights.length} old insight(s) need validation`);
  }
  
  return {
    id: 'freshness',
    name: 'Data Freshness',
    score: Math.max(0, Math.min(100, score)),
    weight: DIMENSION_WEIGHTS.freshness,
    icon: 'Clock',
    description: 'How recent and up-to-date the information is',
    tips,
  };
};

// ============================================================================
// MAIN CALCULATION
// ============================================================================

/**
 * Calculate the complete trust score for a project
 */
export const calculateTrustScore = (project: ProjectState): TrustScore => {
  const dimensions: TrustDimension[] = [
    calculateEvidenceScore(project),
    calculateValidationScore(project),
    calculateConsistencyScore(project),
    calculateCompletenessScore(project),
    calculateFreshnessScore(project),
  ];
  
  // Calculate weighted overall score
  const overall = Math.round(
    dimensions.reduce((sum, dim) => sum + (dim.score * dim.weight), 0)
  );
  
  // Generate alerts based on dimensions
  const alerts: TrustAlert[] = [];
  
  dimensions.forEach(dim => {
    if (dim.score < 40) {
      alerts.push({
        id: `${dim.id}-critical`,
        level: 'critical',
        message: `${dim.name} is critically low (${dim.score}%)`,
        action: dim.tips[0],
      });
    } else if (dim.score < 60) {
      alerts.push({
        id: `${dim.id}-warning`,
        level: 'warning',
        message: `${dim.name} needs attention (${dim.score}%)`,
        action: dim.tips[0],
      });
    }
  });
  
  // Generate summary
  const grade = getGradeFromScore(overall);
  const level = getLevelFromScore(overall);
  const lowestDim = dimensions.reduce((a, b) => (a.score < b.score ? a : b));
  
  const summaryMap: Record<TrustLevel, string> = {
    excellent: 'Requirements are well-documented with strong evidence and validation.',
    good: 'Good progress. A few areas could use more validation.',
    fair: `Overall acceptable, but ${lowestDim.name.toLowerCase()} needs improvement.`,
    poor: `Significant gaps identified. Focus on improving ${lowestDim.name.toLowerCase()}.`,
    critical: 'Critical attention needed. Multiple trust factors require immediate action.',
  };
  
  return {
    overall,
    grade,
    level,
    dimensions,
    alerts,
    summary: summaryMap[level],
    calculatedAt: new Date().toISOString(),
  };
};

/**
 * Calculate trust score for a single insight
 */
export const calculateInsightTrust = (
  insight: Insight,
  sources: Source[]
): { score: number; grade: TrustGrade; issues: string[] } => {
  let score = 50; // Base score
  const issues: string[] = [];
  
  // Source references (+20 max)
  const refs = insight.supportingSources?.length || 0;
  score += Math.min(refs * 10, 20);
  if (refs === 0) issues.push('No source references');
  
  // Approval status (+30 max)
  if (insight.status === 'approved') score += 30;
  else if (insight.status === 'rejected') {
    score -= 30;
    issues.push('Rejected by stakeholder');
  }
  
  // Insight confidence (+20 max)
  const confidenceNum = insight.confidenceScore ?? confidenceToNumber(insight.confidence);
  score += Math.round((confidenceNum / 100) * 20);
  if (confidenceNum < 60) issues.push('Low confidence score');
  
  // Priority bonus (+10 max)
  if (insight.priority === 'must') score += 10;
  else if (insight.priority === 'should') score += 5;
  
  // Multiple sources bonus (+10)
  if (refs > 1) score += 10;
  
  return {
    score: Math.max(0, Math.min(100, score)),
    grade: getGradeFromScore(Math.max(0, Math.min(100, score))),
    issues,
  };
};

// ============================================================================
// EVENT SYSTEM
// ============================================================================

export type TrustScoreEventType = 
  | 'insight-added'
  | 'insight-updated'
  | 'insight-removed'
  | 'source-added'
  | 'source-removed'
  | 'validation-changed'
  | 'conflict-resolved'
  | 'recalculated';

export interface TrustScoreEvent {
  type: TrustScoreEventType;
  timestamp: string;
  insightId?: string;
  sourceId?: string;
}

type TrustScoreListener = (score: TrustScore, event: TrustScoreEvent) => void;

let listeners: TrustScoreListener[] = [];
let cachedScore: TrustScore | null = null;

export const subscribeTrustScore = (listener: TrustScoreListener): (() => void) => {
  listeners.push(listener);
  return () => {
    listeners = listeners.filter(l => l !== listener);
  };
};

export const emitTrustScoreChange = (event: TrustScoreEvent, project: ProjectState): void => {
  cachedScore = calculateTrustScore(project);
  listeners.forEach(listener => listener(cachedScore!, event));
};

export const recalculateTrustScores = (project: ProjectState): ProjectState => {
  cachedScore = calculateTrustScore(project);
  
  // Update insight confidence scores (using confidenceScore, not confidence which is string)
  const updatedInsights = project.insights.map(insight => ({
    ...insight,
    confidenceScore: calculateInsightTrust(insight, project.sources).score,
  }));
  
  return {
    ...project,
    insights: updatedInsights,
    lastUpdated: new Date().toISOString(),
  };
};

export const getCachedTrustScore = (): TrustScore | null => cachedScore;

// ============================================================================
// LEGACY COMPATIBILITY EXPORTS
// ============================================================================

// These are kept for backwards compatibility with existing code
export type TrustScoreResult = TrustScore;
export type TrustFactor = TrustDimension;
export type TrustWarning = TrustAlert;

/**
 * Quick trust score calculation for a single insight without requiring sources
 * Returns a number between 0-100
 */
const calculateQuickTrustScore = (insight: Insight): number => {
  let score = 50; // Base score
  
  // Source references (+20 max)
  const refs = insight.supportingSources?.length || 0;
  score += Math.min(refs * 10, 20);
  
  // Approval status (+30 max)
  if (insight.status === 'approved') score += 30;
  else if (insight.status === 'rejected') score -= 30;
  
  // Insight confidence (+20 max)
  const confidenceNum = insight.confidenceScore ?? confidenceToNumber(insight.confidence);
  score += Math.round((confidenceNum / 100) * 20);
  
  // Priority bonus (+10 max)
  if (insight.priority === 'must') score += 10;
  else if (insight.priority === 'should') score += 5;
  
  // Multiple sources bonus (+10)
  if (refs > 1) score += 10;
  
  return Math.max(0, Math.min(100, score));
};

export const calculateProjectTrust = calculateTrustScore;
export const getTrustScoreEngine = () => ({
  calculateInsightTrustScore: calculateInsightTrust,
  calculateProjectTrustScore: calculateTrustScore,
  calculateQuickTrustScore: calculateQuickTrustScore,
});
export const getTrustScoreManager = () => ({
  recalculateAll: (project: ProjectState) => ({
    projectScore: calculateTrustScore(project),
    insightScores: new Map(
      project.insights.map(i => [i.id, calculateInsightTrust(i, project.sources)])
    ),
  }),
});

/**
 * Format trust score for display
 */
export const formatTrustScore = (score: number): string => {
  return `${Math.round(score)}%`;
};