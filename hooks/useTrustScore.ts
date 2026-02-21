/**
 * useTrustScore Hook
 * 
 * React hook for real-time trust score updates.
 * Automatically subscribes to trust score changes and provides current scores.
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { ProjectState, Insight } from '../utils/db';
import {
  TrustScoreResult,
  TrustScoreEvent,
  getTrustScoreManager,
  subscribeTrustScoreChanges,
  recalculateTrustScores,
  calculateTrustScore,
  calculateProjectTrust,
  getTrustScoreColor,
  formatTrustScore,
  TrustFactor,
  TrustWarning
} from '../utils/TrustScoreEngine';

export interface UseTrustScoreReturn {
  // Project-level scores
  projectScore: TrustScoreResult | null;
  projectConfidence: number;
  projectConfidenceLevel: TrustScoreResult['confidenceLevel'] | null;
  projectWarnings: TrustWarning[];
  projectRecommendations: string[];
  
  // Insight-level scores
  insightScores: Map<string, TrustScoreResult>;
  getInsightScore: (insightId: string) => TrustScoreResult | undefined;
  getInsightConfidence: (insightId: string) => number;
  
  // Actions
  recalculate: () => ProjectState | null;
  
  // Loading state
  isCalculating: boolean;
  lastCalculated: string | null;
  
  // Event history
  recentEvents: TrustScoreEvent[];
}

export interface UseTrustScoreOptions {
  autoSubscribe?: boolean;  // Auto-subscribe to changes (default: true)
  maxEventHistory?: number; // Max events to keep in history (default: 10)
}

/**
 * Hook for managing trust scores with real-time updates
 */
export const useTrustScore = (
  project: ProjectState | null,
  options: UseTrustScoreOptions = {}
): UseTrustScoreReturn => {
  const { autoSubscribe = true, maxEventHistory = 10 } = options;
  
  const [projectScore, setProjectScore] = useState<TrustScoreResult | null>(null);
  const [insightScores, setInsightScores] = useState<Map<string, TrustScoreResult>>(new Map());
  const [isCalculating, setIsCalculating] = useState(false);
  const [lastCalculated, setLastCalculated] = useState<string | null>(null);
  const [recentEvents, setRecentEvents] = useState<TrustScoreEvent[]>([]);

  // Calculate trust scores when project changes
  useEffect(() => {
    if (!project) {
      setProjectScore(null);
      setInsightScores(new Map());
      return;
    }

    setIsCalculating(true);
    
    try {
      const manager = getTrustScoreManager();
      const { projectScore: newProjectScore, insightScores: newInsightScores } = manager.recalculateAll(project);
      
      setProjectScore(newProjectScore);
      setInsightScores(newInsightScores);
      setLastCalculated(new Date().toISOString());
    } catch (error) {
      console.error('Error calculating trust scores:', error);
    } finally {
      setIsCalculating(false);
    }
  }, [project?.id, project?.lastUpdated, project?.insights?.length, project?.sources?.length]);

  // Subscribe to trust score changes
  useEffect(() => {
    if (!autoSubscribe || !project) return;

    const unsubscribe = subscribeTrustScoreChanges((event, newProjectScore, newInsightScores) => {
      setProjectScore(newProjectScore);
      setInsightScores(newInsightScores);
      setLastCalculated(new Date().toISOString());
      
      // Add to event history
      setRecentEvents(prev => {
        const updated = [event, ...prev];
        return updated.slice(0, maxEventHistory);
      });
    });

    return unsubscribe;
  }, [autoSubscribe, project?.id, maxEventHistory]);

  // Recalculate manually
  const recalculate = useCallback((): ProjectState | null => {
    if (!project) return null;
    
    setIsCalculating(true);
    try {
      const updated = recalculateTrustScores(project);
      
      const manager = getTrustScoreManager();
      const { projectScore: newProjectScore, insightScores: newInsightScores } = manager.recalculateAll(updated);
      
      setProjectScore(newProjectScore);
      setInsightScores(newInsightScores);
      setLastCalculated(new Date().toISOString());
      
      return updated;
    } finally {
      setIsCalculating(false);
    }
  }, [project]);

  // Get score for specific insight
  const getInsightScore = useCallback((insightId: string): TrustScoreResult | undefined => {
    return insightScores.get(insightId);
  }, [insightScores]);

  // Get confidence number for specific insight
  const getInsightConfidence = useCallback((insightId: string): number => {
    const score = insightScores.get(insightId);
    return score?.finalScore ?? 50;
  }, [insightScores]);

  // Derived values
  const projectConfidence = projectScore?.finalScore ?? 0;
  const projectConfidenceLevel = projectScore?.confidenceLevel ?? null;
  const projectWarnings = projectScore?.warnings ?? [];
  const projectRecommendations = projectScore?.recommendations ?? [];

  return {
    projectScore,
    projectConfidence,
    projectConfidenceLevel,
    projectWarnings,
    projectRecommendations,
    insightScores,
    getInsightScore,
    getInsightConfidence,
    recalculate,
    isCalculating,
    lastCalculated,
    recentEvents
  };
};

/**
 * Hook for a single insight's trust score
 */
export const useInsightTrustScore = (
  insight: Insight | null,
  allInsights: Insight[] = [],
  sources: any[] = []
): {
  score: TrustScoreResult | null;
  confidence: number;
  confidenceLevel: TrustScoreResult['confidenceLevel'] | null;
  factors: TrustFactor[];
  warnings: TrustWarning[];
  recommendations: string[];
  colors: ReturnType<typeof getTrustScoreColor>;
  formattedScore: string;
} => {
  const [score, setScore] = useState<TrustScoreResult | null>(null);

  useEffect(() => {
    if (!insight) {
      setScore(null);
      return;
    }

    try {
      const result = calculateTrustScore(insight, allInsights, sources);
      setScore(result);
    } catch (error) {
      console.error('Error calculating insight trust score:', error);
      setScore(null);
    }
  }, [insight?.id, insight?.status, insight?.evidenceCount, insight?.hasConflicts, allInsights.length, sources.length]);

  const colors = useMemo(() => getTrustScoreColor(score?.finalScore ?? 50), [score?.finalScore]);

  return {
    score,
    confidence: score?.finalScore ?? 50,
    confidenceLevel: score?.confidenceLevel ?? null,
    factors: score?.factors ?? [],
    warnings: score?.warnings ?? [],
    recommendations: score?.recommendations ?? [],
    colors,
    formattedScore: score ? formatTrustScore(score) : '50% (Medium)'
  };
};

/**
 * Hook for project-level trust score only
 */
export const useProjectTrustScore = (
  project: ProjectState | null
): {
  score: TrustScoreResult | null;
  confidence: number;
  confidenceLevel: TrustScoreResult['confidenceLevel'] | null;
  factors: TrustFactor[];
  warnings: TrustWarning[];
  recommendations: string[];
  colors: ReturnType<typeof getTrustScoreColor>;
  formattedScore: string;
  healthStatus: 'excellent' | 'good' | 'needs-attention' | 'critical';
} => {
  const [score, setScore] = useState<TrustScoreResult | null>(null);

  useEffect(() => {
    if (!project) {
      setScore(null);
      return;
    }

    try {
      const result = calculateProjectTrust(project);
      setScore(result);
    } catch (error) {
      console.error('Error calculating project trust score:', error);
      setScore(null);
    }
  }, [project?.id, project?.lastUpdated, project?.insights?.length, project?.sources?.length, project?.tasks?.length]);

  const colors = useMemo(() => getTrustScoreColor(score?.finalScore ?? 50), [score?.finalScore]);
  
  const healthStatus = useMemo(() => {
    const s = score?.finalScore ?? 0;
    if (s >= 80) return 'excellent';
    if (s >= 60) return 'good';
    if (s >= 40) return 'needs-attention';
    return 'critical';
  }, [score?.finalScore]);

  return {
    score,
    confidence: score?.finalScore ?? 0,
    confidenceLevel: score?.confidenceLevel ?? null,
    factors: score?.factors ?? [],
    warnings: score?.warnings ?? [],
    recommendations: score?.recommendations ?? [],
    colors,
    formattedScore: score ? formatTrustScore(score) : '0% (Very Low)',
    healthStatus
  };
};

export default useTrustScore;
