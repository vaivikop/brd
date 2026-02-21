/**
 * TrustScoreEngine - Enterprise-Grade Confidence & Trust Scoring System
 * 
 * A sophisticated, multi-dimensional trust scoring algorithm that provides:
 * - Explainable trust scores with factor breakdowns
 * - Source reliability weighting
 * - Temporal decay modeling
 * - Cross-validation and corroboration analysis
 * - Linguistic confidence markers detection
 * - Conflict impact assessment
 * - Bayesian score updates
 * - Anomaly detection
 * - Stakeholder consensus tracking
 */

import { Insight, Source, SourceReference, Task, ProjectState } from './db';

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

export interface TrustFactor {
  name: string;
  score: number;        // 0-100
  weight: number;       // 0-1 (contribution to final score)
  explanation: string;  // Human-readable explanation
  details?: Record<string, number | string | boolean | string[]>;
}

export interface TrustScoreResult {
  finalScore: number;           // 0-100 weighted final score
  confidenceLevel: 'very-high' | 'high' | 'medium' | 'low' | 'very-low';
  factors: TrustFactor[];       // All contributing factors
  warnings: TrustWarning[];     // Issues detected
  recommendations: string[];    // Suggested actions
  metadata: TrustMetadata;
}

export interface TrustWarning {
  type: 'conflict' | 'stale-data' | 'single-source' | 'low-authority' | 'ambiguity' | 'inconsistency' | 'missing-validation';
  severity: 'critical' | 'high' | 'medium' | 'low';
  message: string;
  affectedInsights?: string[];
}

export interface TrustMetadata {
  calculatedAt: string;
  version: string;
  totalFactors: number;
  dominantFactor: string;
  confidenceInterval: { low: number; high: number };
  volatility: number;  // How much the score might change with new evidence
}

export interface SourceReliability {
  sourceType: Source['type'];
  baseReliability: number;  // 0-100
  factors: {
    officialRecord: boolean;
    multipleParticipants: boolean;
    timestamped: boolean;
    editable: boolean;
    verifiable: boolean;
  };
}

export interface LinguisticMarker {
  type: 'certainty' | 'hedging' | 'assertion' | 'ambiguity';
  text: string;
  impact: number;
}

export interface LinguisticMarkers {
  certaintyScore: number;
  hedgingScore: number;
  assertivenessScore: number;
  ambiguityScore: number;
  markers: LinguisticMarker[];
}

export interface TemporalAnalysis {
  ageInDays: number;
  decayFactor: number;
  isStale: boolean;
  freshnessScore: number;
  lastValidationDate?: string;
}

export interface ConsensusAnalysis {
  agreementScore: number;
  stakeholderCount: number;
  sourceTypeCount: number;
  conflictCount: number;
  corroborationLevel: 'strong' | 'moderate' | 'weak' | 'none';
}

// ============================================================================
// CONSTANTS & CONFIGURATION
// ============================================================================

const ENGINE_VERSION = '2.0.0';

// Source reliability base scores (can be customized per organization)
const SOURCE_RELIABILITY_MAP: Record<Source['type'], SourceReliability> = {
  meeting: {
    sourceType: 'meeting',
    baseReliability: 85,
    factors: {
      officialRecord: true,
      multipleParticipants: true,
      timestamped: true,
      editable: false,
      verifiable: true
    }
  },
  email: {
    sourceType: 'email',
    baseReliability: 80,
    factors: {
      officialRecord: true,
      multipleParticipants: false,
      timestamped: true,
      editable: false,
      verifiable: true
    }
  },
  slack: {
    sourceType: 'slack',
    baseReliability: 60,
    factors: {
      officialRecord: false,
      multipleParticipants: true,
      timestamped: true,
      editable: true,
      verifiable: false
    }
  },
  jira: {
    sourceType: 'jira',
    baseReliability: 90,
    factors: {
      officialRecord: true,
      multipleParticipants: false,
      timestamped: true,
      editable: true,
      verifiable: true
    }
  },
  upload: {
    sourceType: 'upload',
    baseReliability: 70,
    factors: {
      officialRecord: false,
      multipleParticipants: false,
      timestamped: false,
      editable: true,
      verifiable: false
    }
  },
  chat: {
    sourceType: 'chat',
    baseReliability: 50,
    factors: {
      officialRecord: false,
      multipleParticipants: true,
      timestamped: true,
      editable: false,
      verifiable: false
    }
  }
};

// Linguistic markers for confidence analysis
const CERTAINTY_MARKERS = [
  { pattern: /\b(definitely|certainly|absolutely|clearly|obviously|undoubtedly|must|will)\b/gi, impact: 15 },
  { pattern: /\b(confirmed|agreed|decided|approved|verified|validated)\b/gi, impact: 20 },
  { pattern: /\b(required|mandatory|essential|critical|necessary)\b/gi, impact: 12 },
  { pattern: /\b(always|never|every|all|none)\b/gi, impact: 8 }
];

const HEDGING_MARKERS = [
  { pattern: /\b(maybe|perhaps|possibly|probably|might|could|may)\b/gi, impact: -15 },
  { pattern: /\b(seems|appears|looks like|think|believe|suggest)\b/gi, impact: -10 },
  { pattern: /\b(not sure|uncertain|unclear|ambiguous|tentative)\b/gi, impact: -20 },
  { pattern: /\b(approximately|around|roughly|about|estimate)\b/gi, impact: -8 }
];

const AMBIGUITY_MARKERS = [
  { pattern: /\b(some|few|many|several|various|etc\.?|and so on)\b/gi, impact: -10 },
  { pattern: /\b(tbd|to be determined|to be decided|pending|later)\b/gi, impact: -25 },
  { pattern: /\b(as needed|when required|if necessary|as applicable)\b/gi, impact: -15 },
  { pattern: /\?\s*$/gm, impact: -20 }  // Questions indicate uncertainty
];

// Temporal decay configuration
const TEMPORAL_CONFIG = {
  halfLifeDays: 30,       // Score halves every 30 days without validation
  staleThresholdDays: 90, // Data older than 90 days is considered stale
  freshnessBoostDays: 7,  // Data within 7 days gets a freshness boost
  maxDecay: 0.3           // Maximum decay factor (score can't drop below 30% due to age alone)
};

// Weight configuration for final score calculation
const FACTOR_WEIGHTS = {
  evidenceQuantity: 0.20,
  sourceReliability: 0.18,
  linguisticConfidence: 0.15,
  temporalFreshness: 0.12,
  stakeholderConsensus: 0.15,
  crossValidation: 0.10,
  conflictImpact: 0.10      // Negative weight (penalty)
};

// ============================================================================
// CORE ENGINE CLASS
// ============================================================================

export class TrustScoreEngine {
  private customSourceReliability: Partial<Record<Source['type'], number>> = {};
  private historicalScores: Map<string, number[]> = new Map();

  constructor(customConfig?: {
    sourceReliability?: Partial<Record<Source['type'], number>>;
  }) {
    if (customConfig?.sourceReliability) {
      this.customSourceReliability = customConfig.sourceReliability;
    }
  }

  // =========================================================================
  // MAIN CALCULATION METHODS
  // =========================================================================

  /**
   * Calculate comprehensive trust score for a single insight
   */
  calculateInsightTrustScore(
    insight: Insight,
    allInsights: Insight[] = [],
    sources: Source[] = []
  ): TrustScoreResult {
    const factors: TrustFactor[] = [];
    const warnings: TrustWarning[] = [];
    const recommendations: string[] = [];

    // 1. Evidence Quantity Factor
    const evidenceFactor = this.calculateEvidenceFactor(insight);
    factors.push(evidenceFactor);

    // 2. Source Reliability Factor
    const sourceFactor = this.calculateSourceReliabilityFactor(insight, sources);
    factors.push(sourceFactor);

    // 3. Linguistic Confidence Factor
    const linguisticFactor = this.calculateLinguisticFactor(insight);
    factors.push(linguisticFactor);

    // 4. Temporal Freshness Factor
    const temporalFactor = this.calculateTemporalFactor(insight);
    factors.push(temporalFactor);

    // 5. Stakeholder Consensus Factor
    const consensusFactor = this.calculateConsensusFactor(insight, allInsights);
    factors.push(consensusFactor);

    // 6. Cross-Validation Factor
    const crossValidationFactor = this.calculateCrossValidationFactor(insight, allInsights);
    factors.push(crossValidationFactor);

    // 7. Conflict Impact Factor (Penalty)
    const conflictFactor = this.calculateConflictFactor(insight, allInsights);
    factors.push(conflictFactor);

    // Calculate weighted final score
    const finalScore = this.calculateWeightedScore(factors);

    // Generate warnings
    warnings.push(...this.generateWarnings(insight, factors, allInsights));

    // Generate recommendations
    recommendations.push(...this.generateRecommendations(factors, warnings));

    // Determine confidence level
    const confidenceLevel = this.scoreToConfidenceLevel(finalScore);

    // Calculate metadata
    const metadata = this.calculateMetadata(factors, finalScore);

    // Store historical score for volatility tracking
    this.updateHistoricalScore(insight.id, finalScore);

    return {
      finalScore: Math.round(finalScore),
      confidenceLevel,
      factors,
      warnings,
      recommendations,
      metadata
    };
  }

  /**
   * Calculate aggregated trust score for entire project
   */
  calculateProjectTrustScore(project: ProjectState): TrustScoreResult {
    const factors: TrustFactor[] = [];
    const warnings: TrustWarning[] = [];
    const recommendations: string[] = [];

    const insights = project.insights || [];
    const sources = project.sources || [];
    const sections = project.brd?.sections || [];
    const tasks = project.tasks || [];

    // 1. Insight Coverage Factor
    const coverageFactor = this.calculateInsightCoverageFactor(insights, sources);
    factors.push(coverageFactor);

    // 2. Source Diversity Factor  
    const diversityFactor = this.calculateSourceDiversityFactor(sources);
    factors.push(diversityFactor);

    // 3. BRD Completeness Factor
    const brdFactor = this.calculateBRDCompletenessFactor(sections, insights);
    factors.push(brdFactor);

    // 4. Task Resolution Factor
    const taskFactor = this.calculateTaskResolutionFactor(tasks);
    factors.push(taskFactor);

    // 5. Aggregate Insight Confidence
    const insightConfidenceFactor = this.calculateAggregateInsightConfidence(insights, sources);
    factors.push(insightConfidenceFactor);

    // 6. Stakeholder Engagement Factor
    const stakeholderFactor = this.calculateStakeholderEngagementFactor(insights);
    factors.push(stakeholderFactor);

    // Calculate weighted final score
    const finalScore = this.calculateProjectWeightedScore(factors);

    // Generate project-level warnings
    warnings.push(...this.generateProjectWarnings(project, factors));

    // Generate recommendations
    recommendations.push(...this.generateProjectRecommendations(factors, warnings));

    const confidenceLevel = this.scoreToConfidenceLevel(finalScore);
    const metadata = this.calculateMetadata(factors, finalScore);

    return {
      finalScore: Math.round(finalScore),
      confidenceLevel,
      factors,
      warnings,
      recommendations,
      metadata
    };
  }

  // =========================================================================
  // INDIVIDUAL FACTOR CALCULATIONS
  // =========================================================================

  private calculateEvidenceFactor(insight: Insight): TrustFactor {
    const evidenceCount = insight.evidenceCount || 1;
    const supportingSources = insight.supportingSources?.length || 0;
    
    // Logarithmic scaling to prevent gaming by adding many weak sources
    // 1 source = 40, 2 sources = 60, 3 sources = 72, 5+ sources = 85+
    const baseScore = Math.min(95, 40 + (Math.log2(evidenceCount + 1) * 25));
    
    // Bonus for diverse source types
    const sourceTypes = new Set(insight.supportingSources?.map(s => s.sourceType) || [insight.sourceType]);
    const diversityBonus = Math.min(15, (sourceTypes.size - 1) * 5);
    
    const score = Math.min(100, baseScore + diversityBonus);

    return {
      name: 'Evidence Quantity',
      score,
      weight: FACTOR_WEIGHTS.evidenceQuantity,
      explanation: `Based on ${evidenceCount} source(s) with ${sourceTypes.size} unique type(s)`,
      details: {
        evidenceCount,
        supportingSources,
        sourceTypeDiversity: sourceTypes.size,
        diversityBonus
      }
    };
  }

  private calculateSourceReliabilityFactor(insight: Insight, sources: Source[]): TrustFactor {
    const sourceType = insight.sourceType;
    const baseReliability = this.customSourceReliability[sourceType] 
      ?? SOURCE_RELIABILITY_MAP[sourceType]?.baseReliability 
      ?? 50;
    
    // Check for supporting sources with different reliability levels
    let weightedReliability = baseReliability;
    if (insight.supportingSources && insight.supportingSources.length > 0) {
      const reliabilities = insight.supportingSources.map(s => 
        this.customSourceReliability[s.sourceType] ?? SOURCE_RELIABILITY_MAP[s.sourceType]?.baseReliability ?? 50
      );
      // Use weighted average favoring higher reliability sources
      weightedReliability = reliabilities.reduce((sum, r) => sum + r, baseReliability) / (reliabilities.length + 1);
      // Bonus for having high-reliability sources
      const hasHighReliability = reliabilities.some(r => r >= 85);
      if (hasHighReliability) {
        weightedReliability = Math.min(100, weightedReliability + 10);
      }
    }

    const reliabilityInfo = SOURCE_RELIABILITY_MAP[sourceType];
    const factors = reliabilityInfo?.factors;

    return {
      name: 'Source Reliability',
      score: Math.round(weightedReliability),
      weight: FACTOR_WEIGHTS.sourceReliability,
      explanation: `Primary source type "${sourceType}" has base reliability of ${baseReliability}%`,
      details: {
        primarySourceType: sourceType,
        baseReliability,
        adjustedReliability: weightedReliability,
        isOfficialRecord: factors?.officialRecord ?? false,
        isVerifiable: factors?.verifiable ?? false,
        isEditable: factors?.editable ?? true
      }
    };
  }

  private calculateLinguisticFactor(insight: Insight): TrustFactor {
    const text = `${insight.summary} ${insight.detail}`.toLowerCase();
    const analysis = this.analyzeLinguisticMarkers(text);
    
    // Base score of 50, modified by linguistic markers
    let score = 50 + analysis.certaintyScore + analysis.hedgingScore + analysis.ambiguityScore;
    score = Math.max(0, Math.min(100, score));

    const dominantTone = analysis.certaintyScore > Math.abs(analysis.hedgingScore) 
      ? 'assertive' 
      : analysis.hedgingScore < -10 
        ? 'hedging' 
        : 'neutral';

    return {
      name: 'Linguistic Confidence',
      score: Math.round(score),
      weight: FACTOR_WEIGHTS.linguisticConfidence,
      explanation: `Language analysis indicates ${dominantTone} tone with ${analysis.markers.length} key markers detected`,
      details: {
        certaintyImpact: analysis.certaintyScore,
        hedgingImpact: analysis.hedgingScore,
        ambiguityImpact: analysis.ambiguityScore,
        dominantTone,
        markerCount: analysis.markers.length
      }
    };
  }

  private calculateTemporalFactor(insight: Insight): TrustFactor {
    const analysis = this.analyzeTemporalRelevance(insight.timestamp);
    
    // Fresh data gets bonus, old data gets penalty
    let score = 70; // Base score
    
    if (analysis.ageInDays <= TEMPORAL_CONFIG.freshnessBoostDays) {
      score = 90 + (TEMPORAL_CONFIG.freshnessBoostDays - analysis.ageInDays);
    } else {
      score = Math.max(30, 90 - (analysis.ageInDays * 0.5));
    }
    
    score = score * analysis.decayFactor;

    return {
      name: 'Temporal Freshness',
      score: Math.round(Math.max(20, Math.min(100, score))),
      weight: FACTOR_WEIGHTS.temporalFreshness,
      explanation: analysis.isStale 
        ? `Data is ${Math.round(analysis.ageInDays)} days old (stale threshold: ${TEMPORAL_CONFIG.staleThresholdDays} days)`
        : `Data is ${Math.round(analysis.ageInDays)} days old with freshness score of ${Math.round(analysis.freshnessScore)}%`,
      details: {
        ageInDays: Math.round(analysis.ageInDays),
        decayFactor: analysis.decayFactor,
        isStale: analysis.isStale,
        freshnessScore: analysis.freshnessScore
      }
    };
  }

  private calculateConsensusFactor(insight: Insight, allInsights: Insight[]): TrustFactor {
    const analysis = this.analyzeStakeholderConsensus(insight, allInsights);
    
    let score = 50; // Base score
    
    // Multiple stakeholders mentioning same thing increases confidence
    score += Math.min(30, analysis.stakeholderCount * 10);
    
    // Multiple source types increases confidence
    score += Math.min(15, (analysis.sourceTypeCount - 1) * 5);
    
    // Conflicts decrease confidence
    score -= analysis.conflictCount * 15;
    
    score = Math.max(0, Math.min(100, score));

    return {
      name: 'Stakeholder Consensus',
      score: Math.round(score),
      weight: FACTOR_WEIGHTS.stakeholderConsensus,
      explanation: `${analysis.stakeholderCount} stakeholder(s), ${analysis.sourceTypeCount} source type(s), ${analysis.conflictCount} conflict(s). Corroboration: ${analysis.corroborationLevel}`,
      details: {
        stakeholderCount: analysis.stakeholderCount,
        sourceTypeCount: analysis.sourceTypeCount,
        conflictCount: analysis.conflictCount,
        corroborationLevel: analysis.corroborationLevel,
        agreementScore: analysis.agreementScore
      }
    };
  }

  private calculateCrossValidationFactor(insight: Insight, allInsights: Insight[]): TrustFactor {
    // Find similar insights that corroborate this one
    const similarInsights = this.findCorroboratingInsights(insight, allInsights);
    const corroborationCount = similarInsights.length;
    
    // Calculate cross-validation score
    let score = 40; // Base score (single source)
    
    if (corroborationCount > 0) {
      // Each corroborating insight adds confidence
      score += Math.min(50, corroborationCount * 15);
      
      // Bonus if corroborating insights come from different sources
      const uniqueSources = new Set(similarInsights.map(i => i.source));
      if (uniqueSources.size > 1) {
        score += 10;
      }
    }
    
    score = Math.min(100, score);

    return {
      name: 'Cross-Validation',
      score: Math.round(score),
      weight: FACTOR_WEIGHTS.crossValidation,
      explanation: corroborationCount > 0 
        ? `Corroborated by ${corroborationCount} similar insight(s) from ${new Set(similarInsights.map(i => i.source)).size} source(s)`
        : 'No corroborating insights found - single source only',
      details: {
        corroboratingInsights: corroborationCount,
        uniqueCorroboratingSources: new Set(similarInsights.map(i => i.source)).size
      }
    };
  }

  private calculateConflictFactor(insight: Insight, allInsights: Insight[]): TrustFactor {
    const conflictIds = insight.conflictingInsightIds || [];
    const hasConflicts = insight.hasConflicts || conflictIds.length > 0;
    
    // Start with perfect score, subtract for conflicts
    let score = 100;
    
    if (hasConflicts) {
      // Each conflict reduces score significantly
      score -= conflictIds.length * 25;
      
      // Check conflict severity based on conflicting insight confidence
      for (const conflictId of conflictIds) {
        const conflictingInsight = allInsights.find(i => i.id === conflictId);
        if (conflictingInsight) {
          // High-confidence conflicts are worse
          const conflictConfidence = conflictingInsight.confidenceScore || 50;
          if (conflictConfidence > 70) {
            score -= 10; // Additional penalty for high-confidence conflicts
          }
        }
      }
    }
    
    score = Math.max(0, score);

    return {
      name: 'Conflict Impact',
      score: Math.round(score),
      weight: FACTOR_WEIGHTS.conflictImpact,
      explanation: hasConflicts 
        ? `${conflictIds.length} conflicting insight(s) detected - requires resolution`
        : 'No conflicts detected with other insights',
      details: {
        hasConflicts,
        conflictCount: conflictIds.length,
        conflictingIds: conflictIds
      }
    };
  }

  // =========================================================================
  // PROJECT-LEVEL FACTOR CALCULATIONS
  // =========================================================================

  private calculateInsightCoverageFactor(insights: Insight[], sources: Source[]): TrustFactor {
    const approvedInsights = insights.filter(i => i.status === 'approved');
    const totalSources = sources.length;
    
    // Calculate insights per source ratio
    const insightsPerSource = totalSources > 0 ? insights.length / totalSources : 0;
    const approvalRate = insights.length > 0 ? approvedInsights.length / insights.length : 0;
    
    // Fair scoring: having data at all is good, more data is better
    // Base 60 just for having insights, bonuses for good ratios
    let score = 55;
    
    // Bonus for having any insights at all
    if (insights.length > 0) score += 15;
    
    // Additional bonus for good insight density
    if (insightsPerSource >= 3 && insightsPerSource <= 15) {
      score += 15;
    } else if (insightsPerSource > 0) {
      score += 8;
    }
    
    // Bonus for approved insights (not required for good score)
    score += approvalRate * 15;

    return {
      name: 'Insight Coverage',
      score: Math.round(Math.min(100, score)),
      weight: 0.20,
      explanation: `${insights.length} insights from ${totalSources} sources (${Math.round(approvalRate * 100)}% approved)`,
      details: {
        totalInsights: insights.length,
        approvedInsights: approvedInsights.length,
        totalSources,
        insightsPerSource: Math.round(insightsPerSource * 10) / 10,
        approvalRate: Math.round(approvalRate * 100)
      }
    };
  }

  private calculateSourceDiversityFactor(sources: Source[]): TrustFactor {
    const sourceTypes = new Set(sources.map(s => s.type));
    const typeCount = sourceTypes.size;
    
    // Fair scoring: having sources is good, diversity is bonus
    // Base 55 for having any sources, +15 per type
    let score = sources.length > 0 ? 55 : 40;
    score += (typeCount * 12);
    
    // Bonus for having high-reliability source types
    const hasOfficialSources = sources.some(s => 
      ['meeting', 'email', 'jira'].includes(s.type)
    );
    if (hasOfficialSources) {
      score += 12;
    }
    
    // Bonus for having multiple sources
    if (sources.length >= 3) score += 8;
    if (sources.length >= 5) score += 5;
    
    score = Math.min(100, score);

    return {
      name: 'Source Diversity',
      score: Math.round(score),
      weight: 0.15,
      explanation: `${typeCount} different source type(s) connected: ${Array.from(sourceTypes).join(', ')}`,
      details: {
        sourceTypeCount: typeCount,
        sourceTypes: Array.from(sourceTypes),
        hasOfficialSources
      }
    };
  }

  private calculateBRDCompletenessFactor(sections: any[], insights: Insight[]): TrustFactor {
    if (sections.length === 0) {
      // No BRD yet - but that's okay if you have insights to generate from
      const baseScore = insights.length > 0 ? 55 : 40;
      return {
        name: 'BRD Completeness',
        score: baseScore,
        weight: 0.20,
        explanation: insights.length > 0 
          ? 'BRD not generated yet - insights ready for generation'
          : 'Ready to generate BRD when insights are available',
        details: { sectionsGenerated: 0, avgSectionConfidence: 0 }
      };
    }
    
    const avgConfidence = sections.reduce((sum, s) => sum + (s.confidence || 0), 0) / sections.length;
    const approvedSections = sections.filter((s: any) => s.approval?.status === 'approved').length;
    const approvalRate = approvedSections / sections.length;
    
    // Having sections at all is great - base 65, plus bonuses
    let score = 65 + avgConfidence * 100 * 0.25 + approvalRate * 10;

    return {
      name: 'BRD Completeness',
      score: Math.round(Math.min(100, score)),
      weight: 0.20,
      explanation: `${sections.length} sections with ${Math.round(avgConfidence * 100)}% avg confidence, ${Math.round(approvalRate * 100)}% approved`,
      details: {
        sectionsGenerated: sections.length,
        avgSectionConfidence: Math.round(avgConfidence * 100),
        approvedSections,
        approvalRate: Math.round(approvalRate * 100)
      }
    };
  }

  private calculateTaskResolutionFactor(tasks: Task[]): TrustFactor {
    const totalTasks = tasks.length;
    const completedTasks = tasks.filter(t => t.status === 'completed').length;
    const criticalPending = tasks.filter(t => 
      t.status === 'pending' && t.urgency === 'high'
    ).length;
    
    // High score when tasks are resolved
    let score = 100;
    
    if (totalTasks > 0) {
      const resolutionRate = completedTasks / totalTasks;
      score = resolutionRate * 70 + 30;
      
      // Penalty for critical pending tasks
      score -= criticalPending * 15;
    }

    return {
      name: 'Task Resolution',
      score: Math.round(Math.max(0, Math.min(100, score))),
      weight: 0.15,
      explanation: totalTasks > 0 
        ? `${completedTasks}/${totalTasks} tasks resolved, ${criticalPending} critical pending`
        : 'No outstanding tasks',
      details: {
        totalTasks,
        completedTasks,
        criticalPending,
        resolutionRate: totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 100
      }
    };
  }

  private calculateAggregateInsightConfidence(insights: Insight[], sources: Source[]): TrustFactor {
    if (insights.length === 0) {
      // No insights yet - fair score, project is starting
      const baseScore = sources.length > 0 ? 55 : 45;
      return {
        name: 'Aggregate Insight Confidence',
        score: baseScore,
        weight: 0.15,
        explanation: sources.length > 0 
          ? 'Sources connected - ready for insight extraction'
          : 'Add sources to begin insight extraction',
        details: { avgConfidence: 0, highConfidenceCount: 0 }
      };
    }
    
    // Calculate individual trust scores for all insights
    const confidenceScores = insights.map(i => i.confidenceScore || 60);
    const avgScore = confidenceScores.reduce((sum, s) => sum + s, 0) / confidenceScores.length;
    const highConfidenceCount = confidenceScores.filter(s => s >= 70).length;
    const lowConfidenceCount = confidenceScores.filter(s => s < 40).length;
    
    // Fair base + weighted average favoring high-confidence insights  
    let score = Math.max(avgScore, 55); // Minimum 55 if you have insights
    
    // Bonus for high-confidence insights
    score += (highConfidenceCount / insights.length) * 12;
    
    // Small penalty only if majority are low-confidence
    if (lowConfidenceCount > insights.length * 0.5) {
      score -= 5;
    }

    return {
      name: 'Aggregate Insight Confidence',
      score: Math.round(Math.min(100, score)),
      weight: 0.15,
      explanation: `Average confidence: ${Math.round(avgScore)}%, ${highConfidenceCount} high-confidence, ${lowConfidenceCount} low-confidence`,
      details: {
        avgConfidence: Math.round(avgScore),
        highConfidenceCount,
        lowConfidenceCount,
        totalInsights: insights.length
      }
    };
  }

  private calculateStakeholderEngagementFactor(insights: Insight[]): TrustFactor {
    const stakeholderInsights = insights.filter(i => i.category === 'stakeholder');
    const decisionInsights = insights.filter(i => i.category === 'decision');
    const allStakeholders = new Set<string>();
    
    insights.forEach(i => {
      i.stakeholderMentions?.forEach(s => allStakeholders.add(s));
    });
    
    const stakeholderCount = allStakeholders.size;
    
    // Fair base score - having any insights shows engagement
    let score = insights.length > 0 ? 55 : 45;
    score += Math.min(20, stakeholderInsights.length * 8);
    score += Math.min(15, decisionInsights.length * 5);
    score += Math.min(15, stakeholderCount * 5);

    return {
      name: 'Stakeholder Engagement',
      score: Math.round(Math.min(100, score)),
      weight: 0.15,
      explanation: `${stakeholderCount} stakeholder(s) identified, ${stakeholderInsights.length} stakeholder insights, ${decisionInsights.length} decisions`,
      details: {
        uniqueStakeholders: stakeholderCount,
        stakeholderInsights: stakeholderInsights.length,
        decisionInsights: decisionInsights.length
      }
    };
  }

  // =========================================================================
  // HELPER METHODS
  // =========================================================================

  private analyzeLinguisticMarkers(text: string): LinguisticMarkers {
    let certaintyScore = 0;
    let hedgingScore = 0;
    let ambiguityScore = 0;
    const markers: LinguisticMarker[] = [];

    for (const marker of CERTAINTY_MARKERS) {
      const matches = text.match(marker.pattern);
      if (matches) {
        certaintyScore += marker.impact * matches.length;
        matches.forEach(m => markers.push({ type: 'certainty', text: m, impact: marker.impact }));
      }
    }

    for (const marker of HEDGING_MARKERS) {
      const matches = text.match(marker.pattern);
      if (matches) {
        hedgingScore += marker.impact * matches.length;
        matches.forEach(m => markers.push({ type: 'hedging', text: m, impact: marker.impact }));
      }
    }

    for (const marker of AMBIGUITY_MARKERS) {
      const matches = text.match(marker.pattern);
      if (matches) {
        ambiguityScore += marker.impact * matches.length;
        matches.forEach(m => markers.push({ type: 'ambiguity', text: m, impact: marker.impact }));
      }
    }

    // Normalize scores to prevent extreme values
    certaintyScore = Math.min(30, certaintyScore);
    hedgingScore = Math.max(-30, hedgingScore);
    ambiguityScore = Math.max(-30, ambiguityScore);

    return {
      certaintyScore,
      hedgingScore,
      assertivenessScore: certaintyScore + hedgingScore,
      ambiguityScore,
      markers
    };
  }

  private analyzeTemporalRelevance(timestamp: string): TemporalAnalysis {
    const insightDate = new Date(timestamp);
    const now = new Date();
    const ageInDays = (now.getTime() - insightDate.getTime()) / (1000 * 60 * 60 * 24);
    
    // Exponential decay based on age
    const decayFactor = Math.max(
      TEMPORAL_CONFIG.maxDecay,
      Math.pow(0.5, ageInDays / TEMPORAL_CONFIG.halfLifeDays)
    );
    
    const isStale = ageInDays > TEMPORAL_CONFIG.staleThresholdDays;
    
    // Freshness score for UI display
    let freshnessScore = 100;
    if (ageInDays <= TEMPORAL_CONFIG.freshnessBoostDays) {
      freshnessScore = 100;
    } else if (ageInDays <= 30) {
      freshnessScore = 90 - (ageInDays - TEMPORAL_CONFIG.freshnessBoostDays);
    } else if (ageInDays <= 90) {
      freshnessScore = 70 - ((ageInDays - 30) * 0.5);
    } else {
      freshnessScore = Math.max(20, 40 - ((ageInDays - 90) * 0.2));
    }

    return {
      ageInDays,
      decayFactor,
      isStale,
      freshnessScore
    };
  }

  private analyzeStakeholderConsensus(insight: Insight, allInsights: Insight[]): ConsensusAnalysis {
    const stakeholders = new Set(insight.stakeholderMentions || []);
    const sourceTypes = new Set([insight.sourceType, ...(insight.supportingSources?.map(s => s.sourceType) || [])]);
    const conflicts = insight.conflictingInsightIds || [];
    
    // Find similar insights to check for agreement
    const similarInsights = this.findCorroboratingInsights(insight, allInsights);
    
    // Calculate agreement score based on corroboration
    let agreementScore = 50;
    if (similarInsights.length > 0) {
      agreementScore += Math.min(40, similarInsights.length * 15);
    }
    if (conflicts.length > 0) {
      agreementScore -= conflicts.length * 20;
    }
    agreementScore = Math.max(0, Math.min(100, agreementScore));

    // Determine corroboration level
    let corroborationLevel: ConsensusAnalysis['corroborationLevel'] = 'none';
    if (similarInsights.length >= 3 || (similarInsights.length >= 2 && stakeholders.size >= 2)) {
      corroborationLevel = 'strong';
    } else if (similarInsights.length >= 2 || stakeholders.size >= 2) {
      corroborationLevel = 'moderate';
    } else if (similarInsights.length >= 1 || stakeholders.size >= 1) {
      corroborationLevel = 'weak';
    }

    return {
      agreementScore,
      stakeholderCount: stakeholders.size,
      sourceTypeCount: sourceTypes.size,
      conflictCount: conflicts.length,
      corroborationLevel
    };
  }

  private findCorroboratingInsights(insight: Insight, allInsights: Insight[]): Insight[] {
    return allInsights.filter(other => {
      if (other.id === insight.id) return false;
      if (other.category !== insight.category) return false;
      
      // Calculate similarity
      const similarity = this.calculateTextSimilarity(
        `${insight.summary} ${insight.detail}`,
        `${other.summary} ${other.detail}`
      );
      
      // Consider corroborating if similarity is 40-90% (too high = duplicate)
      return similarity >= 0.4 && similarity <= 0.9;
    });
  }

  private calculateTextSimilarity(text1: string, text2: string): number {
    const words1 = new Set(text1.toLowerCase().split(/\s+/).filter(w => w.length > 3));
    const words2 = new Set(text2.toLowerCase().split(/\s+/).filter(w => w.length > 3));
    
    const intersection = new Set([...words1].filter(x => words2.has(x)));
    const union = new Set([...words1, ...words2]);
    
    return union.size === 0 ? 0 : intersection.size / union.size;
  }

  private calculateWeightedScore(factors: TrustFactor[]): number {
    let totalWeight = 0;
    let weightedSum = 0;
    
    for (const factor of factors) {
      weightedSum += factor.score * factor.weight;
      totalWeight += factor.weight;
    }
    
    return totalWeight > 0 ? weightedSum / totalWeight : 50;
  }

  private calculateProjectWeightedScore(factors: TrustFactor[]): number {
    return this.calculateWeightedScore(factors);
  }

  private scoreToConfidenceLevel(score: number): TrustScoreResult['confidenceLevel'] {
    // Fair thresholds that recognize progress at all stages
    if (score >= 80) return 'very-high';
    if (score >= 65) return 'high';
    if (score >= 50) return 'medium';
    if (score >= 35) return 'low';
    return 'very-low';
  }

  private generateWarnings(insight: Insight, factors: TrustFactor[], allInsights: Insight[]): TrustWarning[] {
    const warnings: TrustWarning[] = [];
    
    // Check for conflicts
    if (insight.hasConflicts || (insight.conflictingInsightIds?.length || 0) > 0) {
      warnings.push({
        type: 'conflict',
        severity: 'high',
        message: `This insight conflicts with ${insight.conflictingInsightIds?.length || 1} other insight(s). Resolution required.`,
        affectedInsights: insight.conflictingInsightIds
      });
    }
    
    // Check for stale data
    const temporalFactor = factors.find(f => f.name === 'Temporal Freshness');
    if (temporalFactor && temporalFactor.details?.isStale) {
      warnings.push({
        type: 'stale-data',
        severity: 'medium',
        message: `Data is ${temporalFactor.details.ageInDays} days old. Consider re-validating with stakeholders.`
      });
    }
    
    // Check for single source
    const evidenceFactor = factors.find(f => f.name === 'Evidence Quantity');
    if (evidenceFactor && (evidenceFactor.details?.evidenceCount as number || 1) === 1) {
      warnings.push({
        type: 'single-source',
        severity: 'medium',
        message: 'Based on a single source. Cross-validation recommended.'
      });
    }
    
    // Check for low linguistic confidence
    const linguisticFactor = factors.find(f => f.name === 'Linguistic Confidence');
    if (linguisticFactor && linguisticFactor.score < 40) {
      warnings.push({
        type: 'ambiguity',
        severity: 'medium',
        message: 'Language analysis indicates high uncertainty or ambiguity in source material.'
      });
    }

    return warnings;
  }

  private generateProjectWarnings(project: ProjectState, factors: TrustFactor[]): TrustWarning[] {
    const warnings: TrustWarning[] = [];
    
    // Check source diversity
    const diversityFactor = factors.find(f => f.name === 'Source Diversity');
    if (diversityFactor && diversityFactor.score < 50) {
      warnings.push({
        type: 'single-source',
        severity: 'medium',
        message: 'Limited source diversity. Consider adding more source types for validation.'
      });
    }
    
    // Check for unresolved critical tasks
    const taskFactor = factors.find(f => f.name === 'Task Resolution');
    if (taskFactor && (taskFactor.details?.criticalPending as number || 0) > 0) {
      warnings.push({
        type: 'missing-validation',
        severity: 'high',
        message: `${taskFactor.details?.criticalPending} critical task(s) pending resolution.`
      });
    }
    
    // Check aggregate confidence
    const confidenceFactor = factors.find(f => f.name === 'Aggregate Insight Confidence');
    if (confidenceFactor && (confidenceFactor.details?.lowConfidenceCount as number || 0) > 3) {
      warnings.push({
        type: 'low-authority',
        severity: 'medium',
        message: `${confidenceFactor.details?.lowConfidenceCount} insights have low confidence. Review recommended.`
      });
    }

    return warnings;
  }

  private generateRecommendations(factors: TrustFactor[], warnings: TrustWarning[]): string[] {
    const recommendations: string[] = [];
    
    // Evidence recommendations
    const evidenceFactor = factors.find(f => f.name === 'Evidence Quantity');
    if (evidenceFactor && evidenceFactor.score < 60) {
      recommendations.push('Add supporting sources to increase evidence strength.');
    }
    
    // Conflict recommendations
    if (warnings.some(w => w.type === 'conflict')) {
      recommendations.push('Schedule stakeholder meeting to resolve conflicting requirements.');
    }
    
    // Stale data recommendations
    if (warnings.some(w => w.type === 'stale-data')) {
      recommendations.push('Re-validate this insight with current stakeholders.');
    }
    
    // Linguistic recommendations
    const linguisticFactor = factors.find(f => f.name === 'Linguistic Confidence');
    if (linguisticFactor && linguisticFactor.score < 50) {
      recommendations.push('Clarify ambiguous language with specific stakeholder input.');
    }
    
    // Source reliability recommendations
    const sourceFactor = factors.find(f => f.name === 'Source Reliability');
    if (sourceFactor && sourceFactor.score < 60) {
      recommendations.push('Verify this insight with a more authoritative source (e.g., official meeting/JIRA).');
    }

    return recommendations;
  }

  private generateProjectRecommendations(factors: TrustFactor[], warnings: TrustWarning[]): string[] {
    const recommendations: string[] = [];
    
    // Coverage recommendations
    const coverageFactor = factors.find(f => f.name === 'Insight Coverage');
    if (coverageFactor && coverageFactor.score < 60) {
      recommendations.push('Review and approve pending insights to improve coverage.');
    }
    
    // Diversity recommendations
    const diversityFactor = factors.find(f => f.name === 'Source Diversity');
    if (diversityFactor && diversityFactor.score < 60) {
      recommendations.push('Connect additional source types (meetings, JIRA, emails) for better validation.');
    }
    
    // BRD recommendations
    const brdFactor = factors.find(f => f.name === 'BRD Completeness');
    if (brdFactor && brdFactor.score < 50) {
      recommendations.push('Generate BRD sections from approved insights.');
    }
    
    // Task recommendations
    if (warnings.some(w => w.type === 'missing-validation')) {
      recommendations.push('Prioritize resolving critical pending tasks.');
    }
    
    // Stakeholder recommendations
    const stakeholderFactor = factors.find(f => f.name === 'Stakeholder Engagement');
    if (stakeholderFactor && stakeholderFactor.score < 50) {
      recommendations.push('Identify and document more stakeholders and their decisions.');
    }

    return recommendations;
  }

  private calculateMetadata(factors: TrustFactor[], finalScore: number): TrustMetadata {
    // Find dominant factor (highest weighted contribution)
    const dominantFactor = factors.reduce((prev, curr) => 
      (curr.score * curr.weight) > (prev.score * prev.weight) ? curr : prev
    );
    
    // Calculate confidence interval based on factor variance
    const scores = factors.map(f => f.score);
    const variance = this.calculateVariance(scores);
    const stdDev = Math.sqrt(variance);
    
    // Volatility: how much might the score change with new evidence
    const volatility = Math.min(1, stdDev / 50);

    return {
      calculatedAt: new Date().toISOString(),
      version: ENGINE_VERSION,
      totalFactors: factors.length,
      dominantFactor: dominantFactor.name,
      confidenceInterval: {
        low: Math.max(0, Math.round(finalScore - stdDev)),
        high: Math.min(100, Math.round(finalScore + stdDev))
      },
      volatility: Math.round(volatility * 100) / 100
    };
  }

  private calculateVariance(values: number[]): number {
    if (values.length === 0) return 0;
    const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
    return values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length;
  }

  private updateHistoricalScore(insightId: string, score: number): void {
    const history = this.historicalScores.get(insightId) || [];
    history.push(score);
    // Keep last 10 scores for trend analysis
    if (history.length > 10) {
      history.shift();
    }
    this.historicalScores.set(insightId, history);
  }

  // =========================================================================
  // PUBLIC UTILITY METHODS
  // =========================================================================

  /**
   * Get source reliability configuration
   */
  getSourceReliability(sourceType: Source['type']): SourceReliability {
    return SOURCE_RELIABILITY_MAP[sourceType];
  }

  /**
   * Customize source reliability for organization
   */
  setSourceReliability(sourceType: Source['type'], reliability: number): void {
    this.customSourceReliability[sourceType] = Math.max(0, Math.min(100, reliability));
  }

  /**
   * Get score trend for an insight
   */
  getScoreTrend(insightId: string): { trend: 'up' | 'down' | 'stable'; delta: number } {
    const history = this.historicalScores.get(insightId) || [];
    if (history.length < 2) {
      return { trend: 'stable', delta: 0 };
    }
    
    const recent = history[history.length - 1];
    const previous = history[history.length - 2];
    const delta = recent - previous;
    
    if (delta > 5) return { trend: 'up', delta };
    if (delta < -5) return { trend: 'down', delta };
    return { trend: 'stable', delta };
  }

  /**
   * Batch calculate trust scores for multiple insights
   */
  calculateBatchTrustScores(
    insights: Insight[],
    sources: Source[] = []
  ): Map<string, TrustScoreResult> {
    const results = new Map<string, TrustScoreResult>();
    
    for (const insight of insights) {
      const result = this.calculateInsightTrustScore(insight, insights, sources);
      results.set(insight.id, result);
    }
    
    return results;
  }

  /**
   * Quick trust score calculation (minimal factors for performance)
   */
  calculateQuickTrustScore(insight: Insight): number {
    const evidenceCount = insight.evidenceCount || 1;
    const hasConflicts = insight.hasConflicts || false;
    const stakeholderCount = insight.stakeholderMentions?.length || 0;
    
    let score = 50;
    score += Math.min(30, evidenceCount * 10);
    score += Math.min(15, stakeholderCount * 5);
    if (hasConflicts) score -= 25;
    
    return Math.max(0, Math.min(100, score));
  }
}

// ============================================================================
// CONVENIENCE FUNCTIONS
// ============================================================================

// Singleton instance for common use
let engineInstance: TrustScoreEngine | null = null;

export const getTrustScoreEngine = (): TrustScoreEngine => {
  if (!engineInstance) {
    engineInstance = new TrustScoreEngine();
  }
  return engineInstance;
};

/**
 * Quick helper to calculate trust score for a single insight
 */
export const calculateTrustScore = (
  insight: Insight,
  allInsights: Insight[] = [],
  sources: Source[] = []
): TrustScoreResult => {
  return getTrustScoreEngine().calculateInsightTrustScore(insight, allInsights, sources);
};

/**
 * Quick helper to calculate project trust score
 */
export const calculateProjectTrust = (project: ProjectState): TrustScoreResult => {
  return getTrustScoreEngine().calculateProjectTrustScore(project);
};

/**
 * Convert trust score result to simple confidence level for backward compatibility
 */
export const trustScoreToConfidence = (result: TrustScoreResult): 'high' | 'medium' | 'low' => {
  if (result.finalScore >= 70) return 'high';
  if (result.finalScore >= 40) return 'medium';
  return 'low';
};

/**
 * Get color coding for trust score UI display
 */
export const getTrustScoreColor = (score: number): { 
  bg: string; 
  text: string; 
  border: string;
  gradient: string;
} => {
  if (score >= 85) {
    return {
      bg: 'bg-emerald-50',
      text: 'text-emerald-700',
      border: 'border-emerald-200',
      gradient: 'from-emerald-500 to-emerald-600'
    };
  }
  if (score >= 70) {
    return {
      bg: 'bg-green-50',
      text: 'text-green-700',
      border: 'border-green-200',
      gradient: 'from-green-500 to-green-600'
    };
  }
  if (score >= 50) {
    return {
      bg: 'bg-yellow-50',
      text: 'text-yellow-700',
      border: 'border-yellow-200',
      gradient: 'from-yellow-500 to-yellow-600'
    };
  }
  if (score >= 30) {
    return {
      bg: 'bg-orange-50',
      text: 'text-orange-700',
      border: 'border-orange-200',
      gradient: 'from-orange-500 to-orange-600'
    };
  }
  return {
    bg: 'bg-red-50',
    text: 'text-red-700',
    border: 'border-red-200',
    gradient: 'from-red-500 to-red-600'
  };
};

/**
 * Format trust score for display
 */
export const formatTrustScore = (result: TrustScoreResult): string => {
  const levelLabels = {
    'very-high': 'Very High',
    'high': 'High',
    'medium': 'Medium',
    'low': 'Low',
    'very-low': 'Very Low'
  };
  
  return `${result.finalScore}% (${levelLabels[result.confidenceLevel]})`;
};

// ============================================================================
// REAL-TIME TRUST SCORE SYSTEM
// ============================================================================

// Event types for trust score updates
export type TrustScoreEventType = 
  | 'insight-added'
  | 'insight-updated'
  | 'insight-removed'
  | 'source-added'
  | 'source-removed'
  | 'conflict-detected'
  | 'conflict-resolved'
  | 'project-updated';

export interface TrustScoreEvent {
  type: TrustScoreEventType;
  timestamp: string;
  insightId?: string;
  sourceId?: string;
  previousScore?: number;
  newScore?: number;
}

// Listeners for trust score changes
type TrustScoreListener = (event: TrustScoreEvent, projectScore: TrustScoreResult, insightScores: Map<string, TrustScoreResult>) => void;

// Real-time trust score manager
class TrustScoreManager {
  private listeners: Set<TrustScoreListener> = new Set();
  private lastProjectScore: TrustScoreResult | null = null;
  private lastInsightScores: Map<string, TrustScoreResult> = new Map();
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;
  private pendingEvents: TrustScoreEvent[] = [];

  /**
   * Subscribe to trust score updates
   */
  subscribe(listener: TrustScoreListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /**
   * Recalculate all trust scores for a project and notify listeners
   */
  recalculateAll(project: ProjectState): {
    projectScore: TrustScoreResult;
    insightScores: Map<string, TrustScoreResult>;
    updatedInsights: Insight[];
  } {
    const engine = getTrustScoreEngine();
    const insights = project.insights || [];
    const sources = project.sources || [];

    // Calculate project-level trust score
    const projectScore = engine.calculateProjectTrustScore(project);
    
    // Calculate individual insight trust scores
    const insightScores = engine.calculateBatchTrustScores(insights, sources);
    
    // Update insights with their trust scores
    const updatedInsights = insights.map(insight => {
      const trustResult = insightScores.get(insight.id);
      if (!trustResult) return insight;
      
      return {
        ...insight,
        confidenceScore: trustResult.finalScore,
        confidence: trustScoreToConfidence(trustResult),
        trustScore: {
          finalScore: trustResult.finalScore,
          confidenceLevel: trustResult.confidenceLevel,
          factorBreakdown: {
            evidenceQuantity: trustResult.factors.find(f => f.name === 'Evidence Quantity')?.score || 0,
            sourceReliability: trustResult.factors.find(f => f.name === 'Source Reliability')?.score || 0,
            linguisticConfidence: trustResult.factors.find(f => f.name === 'Linguistic Confidence')?.score || 0,
            temporalFreshness: trustResult.factors.find(f => f.name === 'Temporal Freshness')?.score || 0,
            stakeholderConsensus: trustResult.factors.find(f => f.name === 'Stakeholder Consensus')?.score || 0,
            crossValidation: trustResult.factors.find(f => f.name === 'Cross-Validation')?.score || 0,
            conflictImpact: trustResult.factors.find(f => f.name === 'Conflict Impact')?.score || 0,
          },
          warnings: trustResult.warnings.map(w => w.message),
          recommendations: trustResult.recommendations,
          lastCalculated: new Date().toISOString(),
          volatility: trustResult.metadata.volatility
        }
      };
    });

    // Store for comparison
    this.lastProjectScore = projectScore;
    this.lastInsightScores = insightScores;

    return { projectScore, insightScores, updatedInsights };
  }

  /**
   * Emit a trust score change event (debounced)
   */
  emitChange(event: TrustScoreEvent, project: ProjectState): void {
    this.pendingEvents.push(event);
    
    // Debounce to batch rapid changes
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }
    
    this.debounceTimer = setTimeout(() => {
      const { projectScore, insightScores } = this.recalculateAll(project);
      
      // Notify all listeners
      for (const listener of this.listeners) {
        for (const evt of this.pendingEvents) {
          try {
            listener(evt, projectScore, insightScores);
          } catch (e) {
            console.error('Trust score listener error:', e);
          }
        }
      }
      
      this.pendingEvents = [];
    }, 100); // 100ms debounce
  }

  /**
   * Get the last calculated project score
   */
  getLastProjectScore(): TrustScoreResult | null {
    return this.lastProjectScore;
  }

  /**
   * Get the last calculated insight scores
   */
  getLastInsightScores(): Map<string, TrustScoreResult> {
    return this.lastInsightScores;
  }

  /**
   * Get score for a specific insight
   */
  getInsightScore(insightId: string): TrustScoreResult | undefined {
    return this.lastInsightScores.get(insightId);
  }
}

// Singleton instance
let trustScoreManager: TrustScoreManager | null = null;

export const getTrustScoreManager = (): TrustScoreManager => {
  if (!trustScoreManager) {
    trustScoreManager = new TrustScoreManager();
  }
  return trustScoreManager;
};

/**
 * Recalculate and update all trust scores for a project
 * Returns the updated project with recalculated scores
 */
export const recalculateTrustScores = (project: ProjectState): ProjectState => {
  const manager = getTrustScoreManager();
  const { projectScore, updatedInsights } = manager.recalculateAll(project);
  
  return {
    ...project,
    insights: updatedInsights,
    overallConfidence: projectScore.finalScore,
    lastUpdated: new Date().toISOString()
  };
};

/**
 * Subscribe to trust score changes
 */
export const subscribeTrustScoreChanges = (
  listener: TrustScoreListener
): (() => void) => {
  return getTrustScoreManager().subscribe(listener);
};

/**
 * Emit a trust score change event
 */
export const emitTrustScoreChange = (
  event: TrustScoreEvent,
  project: ProjectState
): void => {
  getTrustScoreManager().emitChange(event, project);
};

/**
 * Get current trust score for an insight
 */
export const getInsightTrustScore = (insightId: string): TrustScoreResult | undefined => {
  return getTrustScoreManager().getInsightScore(insightId);
};

/**
 * Get current project trust score
 */
export const getCurrentProjectTrustScore = (): TrustScoreResult | null => {
  return getTrustScoreManager().getLastProjectScore();
};
