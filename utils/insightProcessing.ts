/**
 * Insight Processing Utilities
 * Enterprise-grade semantic similarity, deduplication, and confidence scoring
 */

import { Insight, SourceReference, MoSCoWPriority, Source } from './db';
import { 
  TrustScoreResult, 
  getTrustScoreEngine,
  calculateInsightTrust,
  getTrustScoreColor,
  TrustScore
} from './TrustScoreEngine';

// ============================================================================
// SEMANTIC SIMILARITY
// ============================================================================

/**
 * Generate a semantic hash for an insight using key terms
 * This is a lightweight alternative to embedding vectors
 */
export const generateSemanticHash = (text: string): string => {
  const normalized = text
    .toLowerCase()
    .replace(/[^\w\s]/g, '')
    .split(/\s+/)
    .filter(word => word.length > 3) // Skip short words
    .sort()
    .join('|');
  
  // Simple hash function
  let hash = 0;
  for (let i = 0; i < normalized.length; i++) {
    const char = normalized.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return hash.toString(36);
};

/**
 * Extract key terms from text for similarity comparison
 */
export const extractKeyTerms = (text: string): Set<string> => {
  const stopWords = new Set([
    'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
    'of', 'with', 'by', 'from', 'as', 'is', 'was', 'are', 'were', 'been',
    'be', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
    'should', 'may', 'might', 'must', 'shall', 'can', 'need', 'this', 'that',
    'these', 'those', 'it', 'its', 'they', 'their', 'we', 'our', 'you', 'your'
  ]);
  
  return new Set(
    text
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 2 && !stopWords.has(word))
  );
};

/**
 * Calculate Jaccard similarity between two sets of terms
 */
export const jaccardSimilarity = (set1: Set<string>, set2: Set<string>): number => {
  const intersection = new Set([...set1].filter(x => set2.has(x)));
  const union = new Set([...set1, ...set2]);
  return union.size === 0 ? 0 : intersection.size / union.size;
};

/**
 * Calculate similarity score between two insights (0-100)
 */
export const calculateInsightSimilarity = (insight1: Insight, insight2: Insight): number => {
  // Same category is a prerequisite for similarity
  if (insight1.category !== insight2.category) {
    return 0;
  }
  
  const terms1 = extractKeyTerms(insight1.summary + ' ' + insight1.detail);
  const terms2 = extractKeyTerms(insight2.summary + ' ' + insight2.detail);
  
  const similarity = jaccardSimilarity(terms1, terms2);
  return Math.round(similarity * 100);
};

/**
 * Find potential duplicate insights
 * Returns groups of similar insights (similarity > threshold)
 */
export const findDuplicateInsights = (
  insights: Insight[],
  threshold: number = 60 // 60% similarity threshold
): { primary: Insight; duplicates: Insight[] }[] => {
  const groups: { primary: Insight; duplicates: Insight[] }[] = [];
  const processed = new Set<string>();
  
  for (let i = 0; i < insights.length; i++) {
    if (processed.has(insights[i].id)) continue;
    
    const duplicates: Insight[] = [];
    
    for (let j = i + 1; j < insights.length; j++) {
      if (processed.has(insights[j].id)) continue;
      
      const similarity = calculateInsightSimilarity(insights[i], insights[j]);
      if (similarity >= threshold) {
        duplicates.push(insights[j]);
        processed.add(insights[j].id);
      }
    }
    
    if (duplicates.length > 0) {
      groups.push({ primary: insights[i], duplicates });
      processed.add(insights[i].id);
    }
  }
  
  return groups;
};

// ============================================================================
// CONFIDENCE SCORING (Enhanced with TrustScoreEngine v2.0)
// ============================================================================

/**
 * Calculate dynamic confidence score based on evidence
 * @deprecated Use calculateComprehensiveTrustScore for full analysis
 */
export const calculateConfidenceScore = (insight: Insight): number => {
  // Use the quick calculation from TrustScoreEngine for backward compatibility
  return getTrustScoreEngine().calculateQuickTrustScore(insight);
};

/**
 * Calculate comprehensive trust score with full factor analysis
 * This is the recommended method for production use
 */
export const calculateComprehensiveTrustScore = (
  insight: Insight,
  allInsights: Insight[] = [],
  sources: Source[] = []
): TrustScoreResult => {
  const result = calculateInsightTrust(insight, sources);
  // Convert to TrustScoreResult format
  return {
    overall: result.score,
    grade: result.grade,
    level: result.score >= 90 ? 'excellent' : result.score >= 75 ? 'good' : result.score >= 60 ? 'fair' : result.score >= 40 ? 'poor' : 'critical',
    dimensions: [],
    alerts: result.issues.map((issue, i) => ({ id: `issue-${i}`, level: 'warning' as const, message: issue })),
    summary: `Trust score: ${result.score}%`,
    calculatedAt: new Date().toISOString()
  };
};

/**
 * Batch calculate trust scores for all insights in a project
 */
export const calculateAllTrustScores = (
  insights: Insight[],
  sources: Source[] = []
): Map<string, TrustScoreResult> => {
  const results = new Map<string, TrustScoreResult>();
  for (const insight of insights) {
    results.set(insight.id, calculateComprehensiveTrustScore(insight, insights, sources));
  }
  return results;
};

/**
 * Convert numeric score to confidence level
 */
export const scoreToConfidenceLevel = (score: number): 'high' | 'medium' | 'low' => {
  if (score >= 70) return 'high';
  if (score >= 40) return 'medium';
  return 'low';
};

/**
 * Detect conflicts between insights
 */
export const detectConflicts = (insights: Insight[]): Map<string, string[]> => {
  const conflicts = new Map<string, string[]>();
  
  // Conflict keywords that indicate opposite stances
  const conflictPairs = [
    ['must', 'must not'],
    ['should', 'should not'],
    ['will', 'will not'],
    ['require', 'optional'],
    ['mandatory', 'optional'],
    ['include', 'exclude'],
    ['add', 'remove'],
    ['increase', 'decrease'],
    ['before', 'after'],
    ['high priority', 'low priority']
  ];
  
  for (let i = 0; i < insights.length; i++) {
    for (let j = i + 1; j < insights.length; j++) {
      // Only check same category
      if (insights[i].category !== insights[j].category) continue;
      
      // Check for similar topics but conflicting keywords
      const similarity = calculateInsightSimilarity(insights[i], insights[j]);
      if (similarity < 30 || similarity > 90) continue; // Too different or too similar
      
      const text1 = (insights[i].summary + ' ' + insights[i].detail).toLowerCase();
      const text2 = (insights[j].summary + ' ' + insights[j].detail).toLowerCase();
      
      for (const [term1, term2] of conflictPairs) {
        if ((text1.includes(term1) && text2.includes(term2)) ||
            (text1.includes(term2) && text2.includes(term1))) {
          // Found potential conflict
          const existing1 = conflicts.get(insights[i].id) || [];
          existing1.push(insights[j].id);
          conflicts.set(insights[i].id, existing1);
          
          const existing2 = conflicts.get(insights[j].id) || [];
          existing2.push(insights[i].id);
          conflicts.set(insights[j].id, existing2);
          break;
        }
      }
    }
  }
  
  return conflicts;
};

// ============================================================================
// PRIORITIZATION
// ============================================================================

/**
 * Auto-assign MoSCoW priority based on content analysis
 */
export const suggestPriority = (insight: Insight): MoSCoWPriority => {
  const text = (insight.summary + ' ' + insight.detail).toLowerCase();
  
  // Must indicators
  const mustKeywords = ['must', 'required', 'mandatory', 'critical', 'essential', 'necessary', 'vital'];
  if (mustKeywords.some(k => text.includes(k))) {
    return 'must';
  }
  
  // Should indicators
  const shouldKeywords = ['should', 'important', 'recommended', 'preferred', 'better', 'needed'];
  if (shouldKeywords.some(k => text.includes(k))) {
    return 'should';
  }
  
  // Could indicators
  const couldKeywords = ['could', 'nice to have', 'optional', 'consider', 'possibly', 'ideally'];
  if (couldKeywords.some(k => text.includes(k))) {
    return 'could';
  }
  
  // Won't indicators
  const wontKeywords = ['out of scope', 'not included', 'future', 'phase 2', 'later', 'deferred'];
  if (wontKeywords.some(k => text.includes(k))) {
    return 'wont';
  }
  
  // High confidence + multiple sources → Should
  if ((insight.confidenceScore || 0) >= 70 && (insight.evidenceCount || 1) >= 2) {
    return 'should';
  }
  
  return 'unset';
};

/**
 * Sort insights by priority
 */
export const sortByPriority = (insights: Insight[]): Insight[] => {
  const priorityOrder: Record<MoSCoWPriority, number> = {
    must: 0,
    should: 1,
    could: 2,
    wont: 3,
    unset: 4
  };
  
  return [...insights].sort((a, b) => {
    // First by priority
    const priorityDiff = priorityOrder[a.priority || 'unset'] - priorityOrder[b.priority || 'unset'];
    if (priorityDiff !== 0) return priorityDiff;
    
    // Then by manual order (drag-and-drop)
    const orderDiff = (a.priorityOrder || 999) - (b.priorityOrder || 999);
    if (orderDiff !== 0) return orderDiff;
    
    // Then by confidence
    return (b.confidenceScore || 0) - (a.confidenceScore || 0);
  });
};

// ============================================================================
// INSIGHT ENHANCEMENT
// ============================================================================

/**
 * Process and enhance all insights with computed fields
 */
export const enhanceInsights = (insights: Insight[]): Insight[] => {
  // Find duplicates
  const duplicateGroups = findDuplicateInsights(insights);
  const duplicateMap = new Map<string, { primaryId: string; similarity: number }>();
  
  for (const group of duplicateGroups) {
    for (const dup of group.duplicates) {
      duplicateMap.set(dup.id, { 
        primaryId: group.primary.id, 
        similarity: calculateInsightSimilarity(group.primary, dup) 
      });
    }
  }
  
  // Detect conflicts
  const conflictMap = detectConflicts(insights);
  
  // Enhance each insight
  return insights.map(insight => {
    const confidenceScore = calculateConfidenceScore(insight);
    const conflicts = conflictMap.get(insight.id) || [];
    const duplicateInfo = duplicateMap.get(insight.id);
    
    return {
      ...insight,
      confidenceScore,
      confidence: scoreToConfidenceLevel(confidenceScore),
      conflictingInsightIds: conflicts,
      hasConflicts: conflicts.length > 0,
      semanticHash: generateSemanticHash(insight.summary + insight.detail),
      priority: insight.priority || suggestPriority(insight),
      // Mark as potential duplicate if found
      ...(duplicateInfo && !insight.isMerged ? {
        isMerged: false // Could show "similar to X" badge
      } : {})
    };
  });
};

/**
 * Get insights grouped by source for source preview
 */
export const groupInsightsBySource = (insights: Insight[]): Map<string, Insight[]> => {
  const groups = new Map<string, Insight[]>();
  
  for (const insight of insights) {
    const sourceKey = insight.source;
    const existing = groups.get(sourceKey) || [];
    existing.push(insight);
    groups.set(sourceKey, existing);
  }
  
  return groups;
};

/**
 * Create a SourceReference from an insight for merging
 */
export const insightToSourceReference = (insight: Insight): SourceReference => ({
  sourceId: insight.id,
  sourceName: insight.source,
  sourceType: insight.sourceType,
  snippet: insight.detail.slice(0, 500),
  timestamp: insight.timestamp
});
