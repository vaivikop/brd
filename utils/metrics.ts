/**
 * Real metrics calculation from actual project data.
 * No AI calls - purely data-driven calculations for cost efficiency.
 */

import { ProjectState, Insight, Source, BRDSection, Task } from './db';

export interface CalculatedMetrics {
  completeness: number;
  stakeholderCoverage: number;
  overallConfidence: number;
  healthStatus: 'excellent' | 'good' | 'needs-attention' | 'critical';
  breakdown: {
    sourcesScore: number;
    insightsScore: number;
    brdScore: number;
    tasksResolved: number;
  };
}

/**
 * Calculate BRD completeness based on real data:
 * - Sources connected (25%)
 * - Insights extracted and approved (25%)
 * - BRD sections generated (30%)
 * - Task resolution rate (20%)
 */
export const calculateCompleteness = (project: ProjectState): number => {
  let score = 0;

  // Sources (25 points max)
  // 1 source = 5%, 2 = 10%, 3 = 15%, 4 = 20%, 5+ = 25%
  const sourcesScore = Math.min(project.sources.length * 5, 25);
  score += sourcesScore;

  // Insights (25 points max)
  // Based on approved vs total insights
  const insights = project.insights || [];
  const approvedInsights = insights.filter(i => i.status === 'approved').length;
  const totalInsights = insights.length;
  if (totalInsights > 0) {
    const insightRatio = approvedInsights / totalInsights;
    score += Math.round(insightRatio * 15) + Math.min(totalInsights * 2, 10);
  }

  // BRD Sections (30 points max)
  // Each section with content adds points
  const sections = project.brd?.sections || [];
  if (sections.length > 0) {
    const avgSectionConfidence = sections.reduce((sum, s) => sum + s.confidence, 0) / sections.length;
    score += Math.round(avgSectionConfidence * 30);
  }

  // Tasks (20 points max)
  // Fewer pending tasks = better score
  const pendingTasks = project.tasks.length;
  const taskScore = Math.max(20 - (pendingTasks * 3), 0);
  score += taskScore;

  return Math.min(Math.round(score), 100);
};

/**
 * Calculate stakeholder coverage based on:
 * - Stakeholder insights found
 * - Different source types (more diversity = better coverage)
 * - Decision insights (indicate stakeholder involvement)
 */
export const calculateStakeholderCoverage = (project: ProjectState): number => {
  const insights = project.insights || [];
  const sources = project.sources || [];

  // Stakeholder insights (40%)
  const stakeholderInsights = insights.filter(i => i.category === 'stakeholder');
  const stakeholderScore = Math.min(stakeholderInsights.length * 10, 40);

  // Source diversity (30%)
  const sourceTypes = new Set(sources.map(s => s.type));
  const diversityScore = Math.min(sourceTypes.size * 10, 30);

  // Decision insights indicate stakeholder involvement (30%)
  const decisionInsights = insights.filter(i => i.category === 'decision');
  const decisionScore = Math.min(decisionInsights.length * 7, 30);

  return Math.min(stakeholderScore + diversityScore + decisionScore, 100);
};

/**
 * Calculate overall confidence based on:
 * - Insight confidence levels
 * - BRD section confidence
 * - Unresolved questions/conflicts
 */
export const calculateOverallConfidence = (project: ProjectState): number => {
  const insights = project.insights || [];
  const sections = project.brd?.sections || [];
  const tasks = project.tasks || [];

  if (insights.length === 0 && sections.length === 0) {
    return 15; // Minimal confidence with no data
  }

  let totalWeight = 0;
  let weightedSum = 0;

  // Insight confidence (weight: 40%)
  if (insights.length > 0) {
    const insightConfidenceMap = { high: 100, medium: 65, low: 30 };
    const avgInsightConfidence = insights.reduce((sum, i) => 
      sum + insightConfidenceMap[i.confidence], 0) / insights.length;
    weightedSum += avgInsightConfidence * 0.4;
    totalWeight += 0.4;
  }

  // BRD section confidence (weight: 40%)
  if (sections.length > 0) {
    const avgSectionConfidence = sections.reduce((sum, s) => sum + s.confidence * 100, 0) / sections.length;
    weightedSum += avgSectionConfidence * 0.4;
    totalWeight += 0.4;
  }

  // Penalty for unresolved issues (weight: 20%)
  const conflictTasks = tasks.filter(t => t.type === 'conflict' || t.type === 'ambiguity');
  const taskPenalty = Math.max(100 - (conflictTasks.length * 15), 20);
  weightedSum += taskPenalty * 0.2;
  totalWeight += 0.2;

  return totalWeight > 0 ? Math.round(weightedSum / totalWeight) : 25;
};

/**
 * Get health status based on combined metrics
 */
export const getHealthStatus = (completeness: number, confidence: number): CalculatedMetrics['healthStatus'] => {
  const combined = (completeness + confidence) / 2;
  if (combined >= 80) return 'excellent';
  if (combined >= 60) return 'good';
  if (combined >= 40) return 'needs-attention';
  return 'critical';
};

/**
 * Calculate all metrics at once
 */
export const calculateAllMetrics = (project: ProjectState): CalculatedMetrics => {
  const completeness = calculateCompleteness(project);
  const stakeholderCoverage = calculateStakeholderCoverage(project);
  const overallConfidence = calculateOverallConfidence(project);

  return {
    completeness,
    stakeholderCoverage,
    overallConfidence,
    healthStatus: getHealthStatus(completeness, overallConfidence),
    breakdown: {
      sourcesScore: Math.min(project.sources.length * 5, 25),
      insightsScore: Math.min((project.insights?.length || 0) * 3, 25),
      brdScore: project.brd?.sections?.length ? 30 : 0,
      tasksResolved: Math.max(0, 20 - (project.tasks.length * 3)),
    }
  };
};

/**
 * Format a metric for display with trend indicator
 */
export const formatMetricChange = (current: number, previous: number): { 
  value: string; 
  trend: 'up' | 'down' | 'stable';
  color: string;
} => {
  const diff = current - previous;
  if (Math.abs(diff) < 2) {
    return { value: '—', trend: 'stable', color: 'text-slate-400' };
  }
  if (diff > 0) {
    return { value: `+${diff}%`, trend: 'up', color: 'text-emerald-600' };
  }
  return { value: `${diff}%`, trend: 'down', color: 'text-red-500' };
};
