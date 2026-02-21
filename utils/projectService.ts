/**
 * Project Service with Automatic Trust Score Recalculation
 * 
 * This module wraps the db functions and automatically recalculates
 * trust scores whenever project data changes, ensuring real-time updates.
 */

import {
  ProjectState,
  Insight,
  Source,
  Task,
  getProjectData,
  updateInsightStatus as dbUpdateInsightStatus,
  bulkUpdateInsightStatus as dbBulkUpdateInsightStatus,
  updateInsight as dbUpdateInsight,
  bulkUpdateInsights as dbBulkUpdateInsights,
  addInsightComment as dbAddInsightComment,
  updateProjectContext as dbUpdateProjectContext,
  addSourceToProject as dbAddSource,
  mergeInsights as dbMergeInsights,
  reorderInsightPriorities as dbReorderInsightPriorities,
  InsightComment,
} from './db';

import {
  recalculateTrustScores,
  emitTrustScoreChange,
  TrustScoreEvent,
  TrustScoreEventType,
  TrustScore,
  calculateTrustScore,
  calculateInsightTrust,
  subscribeTrustScore,
  getTrustColors,
} from './TrustScoreEngine';

// ============================================================================
// HELPER: Apply Trust Score Recalculation
// ============================================================================

/**
 * Recalculate trust scores and save to DB
 */
const applyTrustScoreRecalculation = async (
  project: ProjectState,
  eventType: TrustScoreEventType,
  insightId?: string,
  sourceId?: string
): Promise<ProjectState> => {
  // Recalculate all trust scores
  const updatedProject = recalculateTrustScores(project);
  
  // Emit change event for subscribers
  const event: TrustScoreEvent = {
    type: eventType,
    timestamp: new Date().toISOString(),
    insightId,
    sourceId
  };
  
  emitTrustScoreChange(event, updatedProject);
  
  return updatedProject;
};

// ============================================================================
// ENHANCED DB FUNCTIONS WITH TRUST SCORE RECALCULATION
// ============================================================================

/**
 * Update insight status with automatic trust score recalculation
 */
export const updateInsightStatus = async (
  insightId: string,
  status: Insight['status']
): Promise<ProjectState> => {
  const result = await dbUpdateInsightStatus(insightId, status);
  return applyTrustScoreRecalculation(result, 'insight-updated', insightId);
};

/**
 * Bulk update insight statuses with automatic trust score recalculation
 */
export const bulkUpdateInsightStatus = async (
  updates: { insightId: string; status: Insight['status'] }[]
): Promise<ProjectState> => {
  const result = await dbBulkUpdateInsightStatus(updates);
  return applyTrustScoreRecalculation(result, 'insight-updated');
};

/**
 * Update a single insight with automatic trust score recalculation
 */
export const updateInsight = async (
  insightId: string,
  updates: Partial<Insight>
): Promise<ProjectState> => {
  const result = await dbUpdateInsight(insightId, updates);
  return applyTrustScoreRecalculation(result, 'insight-updated', insightId);
};

/**
 * Bulk update insights with automatic trust score recalculation
 */
export const bulkUpdateInsights = async (
  updates: { insightId: string; updates: Partial<Insight> }[]
): Promise<ProjectState> => {
  const result = await dbBulkUpdateInsights(updates);
  return applyTrustScoreRecalculation(result, 'insight-updated');
};

/**
 * Add comment to insight with automatic trust score recalculation
 */
export const addInsightComment = async (
  insightId: string,
  comment: InsightComment
): Promise<ProjectState> => {
  const result = await dbAddInsightComment(insightId, comment);
  return applyTrustScoreRecalculation(result, 'insight-updated', insightId);
};

/**
 * Update project context with automatic trust score recalculation
 */
export const updateProjectContext = async (
  updates: Partial<ProjectState>
): Promise<ProjectState> => {
  const result = await dbUpdateProjectContext(updates);
  return applyTrustScoreRecalculation(result, 'recalculated');
};

/**
 * Add source with automatic trust score recalculation
 */
export const addSource = async (source: Source): Promise<ProjectState> => {
  const result = await dbAddSource(source);
  return applyTrustScoreRecalculation(result, 'source-added', undefined, source.id);
};

/**
 * Merge insights with automatic trust score recalculation
 */
export const mergeInsights = async (
  primaryId: string,
  duplicateIds: string[]
): Promise<ProjectState> => {
  const result = await dbMergeInsights(primaryId, duplicateIds);
  return applyTrustScoreRecalculation(result, 'insight-updated', primaryId);
};

/**
 * Reorder insight priorities with automatic trust score recalculation
 */
export const reorderInsightPriorities = async (
  insightIds: string[]
): Promise<ProjectState> => {
  const result = await dbReorderInsightPriorities(insightIds);
  return applyTrustScoreRecalculation(result, 'insight-updated');
};

// ============================================================================
// TRUST SCORE SPECIFIC FUNCTIONS
// ============================================================================

/**
 * Get current trust scores for project
 */
export const getProjectTrustScores = async (): Promise<{
  projectScore: TrustScore | null;
  insightScores: Map<string, number>;
} | null> => {
  const project = await getProjectData();
  if (!project) return null;
  
  const projectScore = calculateTrustScore(project);
  const insightScores = new Map<string, number>();
  
  for (const insight of project.insights || []) {
    const result = calculateInsightTrust(insight, project.sources || []);
    insightScores.set(insight.id, result.score);
  }
  
  return { projectScore, insightScores };
};

/**
 * Force recalculate and get updated project
 */
export const recalculateAndGetProject = async (): Promise<ProjectState | null> => {
  const project = await getProjectData();
  if (!project) return null;
  
  return recalculateTrustScores(project);
};

/**
 * Get trust score for a specific insight
 */
export const getInsightTrustScore = async (
  insightId: string
): Promise<number | null> => {
  const project = await getProjectData();
  if (!project) return null;
  
  const insight = project.insights.find(i => i.id === insightId);
  if (!insight) return null;
  
  const result = calculateInsightTrust(insight, project.sources || []);
  return result.score;
};

// Re-export types and functions that don't need wrapping
export { getProjectData } from './db';

export type {
  ProjectState,
  Insight,
  Source,
  Task,
  InsightComment
} from './db';

export type {
  TrustScore,
  TrustScoreEvent,
  TrustScoreEventType,
  TrustDimension,
  TrustAlert,
} from './TrustScoreEngine';

export {
  getTrustColors,
  subscribeTrustScore as subscribeTrustScoreChanges
} from './TrustScoreEngine';
