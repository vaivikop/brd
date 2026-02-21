import { GoogleGenAI, Type } from "@google/genai";
import { Task, Insight, BRDSection } from "../db";

const ai = new GoogleGenAI({ apiKey: import.meta.env.VITE_GEMINI_API_KEY });

// Use the cheapest, fastest model
const modelId = "gemini-2.0-flash";

// ============================================================================
// CACHING LAYER - Minimize API costs
// ============================================================================

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  key: string;
}

const cache = new Map<string, CacheEntry<any>>();
const CACHE_TTL = 10 * 60 * 1000; // 10 minutes cache lifetime

const getCacheKey = (...args: any[]): string => {
  return JSON.stringify(args).slice(0, 500); // Limit key size
};

const getFromCache = <T>(key: string): T | null => {
  const entry = cache.get(key);
  if (!entry) return null;
  
  // Check if expired
  if (Date.now() - entry.timestamp > CACHE_TTL) {
    cache.delete(key);
    return null;
  }
  
  console.log('[AI Cache] HIT:', key.slice(0, 50) + '...');
  return entry.data as T;
};

const setCache = <T>(key: string, data: T): void => {
  // Limit cache size to 50 entries
  if (cache.size >= 50) {
    const oldestKey = cache.keys().next().value;
    if (oldestKey) cache.delete(oldestKey);
  }
  
  cache.set(key, { data, timestamp: Date.now(), key });
  console.log('[AI Cache] SET:', key.slice(0, 50) + '...');
};

// Clear cache for a project when data changes significantly
export const invalidateProjectCache = (projectName: string): void => {
  for (const [key] of cache) {
    if (key.includes(projectName)) {
      cache.delete(key);
    }
  }
  console.log('[AI Cache] Invalidated cache for project:', projectName);
};

// ============================================================================
// API CALL TRACKING - Monitor usage
// ============================================================================

let apiCallCount = 0;
let apiCallsThisSession = 0;

export const getAPIUsageStats = () => ({
  totalCalls: apiCallCount,
  sessionCalls: apiCallsThisSession,
  cacheSize: cache.size,
  cacheHitRate: '~' + Math.round((1 - apiCallsThisSession / Math.max(apiCallCount, 1)) * 100) + '%'
});

const trackAPICall = () => {
  apiCallCount++;
  apiCallsThisSession++;
  console.log(`[AI] API Call #${apiCallsThisSession} this session`);
};

// ============================================================================
// AI FUNCTIONS
// ============================================================================

export interface AIProjectAnalysis {
  completeness: number;
  stakeholderCoverage: number;
  overallConfidence: number;
  tasks: Omit<Task, 'id' | 'source'>[];
  summary: string;
}

export const generateInitialProjectAnalysis = async (
  name: string,
  goals: string,
  timeline: string
): Promise<AIProjectAnalysis> => {
  // Check cache first
  const cacheKey = getCacheKey('projectAnalysis', name, goals, timeline);
  const cached = getFromCache<AIProjectAnalysis>(cacheKey);
  if (cached) return cached;

  const prompt = `
    You are an expert Business Analyst AI. A user is starting a new project.
    Project Name: ${name}
    Goals: ${goals || "Not specified"}
    Timeline: ${timeline}

    Analyze this project context and generate:
    1. An estimated completeness score (0-100) based on how vague the goals are.
    2. An estimated stakeholder coverage score (0-100).
    3. An overall confidence score (0-100).
    4. A list of 3-5 initial "Action Items" or "Tasks" that a BA would need to do immediately.
       - Types: 'ambiguity', 'approval', 'conflict', 'missing'
       - Urgency: 'high', 'medium', 'low'
       - Confidence: 0-100
    5. A brief 1-sentence summary of the project state.

    Return JSON.
  `;

  try {
    trackAPICall();
    const response = await ai.models.generateContent({
      model: modelId,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            completeness: { type: Type.INTEGER },
            stakeholderCoverage: { type: Type.INTEGER },
            overallConfidence: { type: Type.INTEGER },
            summary: { type: Type.STRING },
            tasks: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  title: { type: Type.STRING },
                  type: { type: Type.STRING, enum: ['ambiguity', 'approval', 'conflict', 'missing'] },
                  urgency: { type: Type.STRING, enum: ['high', 'medium', 'low'] },
                  confidence: { type: Type.INTEGER }
                },
                required: ['title', 'type', 'urgency', 'confidence']
              }
            }
          },
          required: ['completeness', 'stakeholderCoverage', 'overallConfidence', 'tasks', 'summary']
        }
      }
    });

    const text = response.text;
    if (!text) throw new Error("No response from AI");
    
    const result = JSON.parse(text) as AIProjectAnalysis;
    setCache(cacheKey, result);
    return result;
  } catch (error) {
    console.error("AI Analysis Failed:", error);
    // Fallback data
    return {
      completeness: 10,
      stakeholderCoverage: 5,
      overallConfidence: 20,
      summary: "Project initialized. Awaiting data sources.",
      tasks: [
        { title: "Connect first data source", type: "missing", urgency: "high", confidence: 100 },
        { title: "Define stakeholder list", type: "missing", urgency: "medium", confidence: 100 }
      ]
    };
  }
};

export const generateBRD = async (
  project: { name: string; description?: string; goals?: string },
  insights: Insight[]
): Promise<Omit<BRDSection, 'id'>[]> => {
  const approvedInsights = insights.filter(i => i.status === 'approved');
  
  // Cache based on project and approved insight summaries
  const insightSummaries = approvedInsights.map(i => i.summary).sort().join(',');
  const cacheKey = getCacheKey('generateBRD', project.name, project.goals, insightSummaries.slice(0, 300));
  const cached = getFromCache<Omit<BRDSection, 'id'>[]>(cacheKey);
  if (cached) return cached;
  
  const prompt = `
    You are an expert Business Analyst AI. Generate a structured Business Requirements Document (BRD) based on the following project context and approved insights.
    
    Project Name: ${project.name}
    Description: ${project.description || "Not specified"}
    Goals: ${project.goals || "Not specified"}
    
    Approved Insights:
    ${approvedInsights.length > 0 ? approvedInsights.map(i => `- [${i.category.toUpperCase()}] ${i.summary}: ${i.detail} (Source: ${i.source})`).join('\n') : '- No approved insights yet. Generate placeholder content based on project context.'}
    
    IMPORTANT: You MUST generate EXACTLY 9 sections in the following order. Do not combine or skip any sections:
    
    1. "Executive Summary" - High-level overview of the project, its purpose, and key outcomes. Include project vision, scope summary, and expected business value.
    
    2. "Business Objectives" - Specific, measurable goals using SMART criteria (Specific, Measurable, Achievable, Relevant, Time-bound). Include success criteria.
    
    3. "Stakeholder Analysis" - Key stakeholders with their:
       - Roles and responsibilities
       - Interest level (High/Medium/Low)
       - Influence level (High/Medium/Low)
       - Communication needs
       - Key concerns
    
    4. "Functional Requirements" - Detailed features and behaviors the system MUST do:
       - Use requirement IDs (FR-001, FR-002, etc.)
       - Include priority (Must Have/Should Have/Could Have/Won't Have)
       - User stories format: "As a [role], I want [feature] so that [benefit]"
       - Acceptance criteria for each major feature
    
    5. "Non-Functional Requirements" - Quality attributes with specific, measurable criteria. MUST include sub-sections for:
       
       ### Performance Requirements
       - Response time targets (e.g., "Page load < 3 seconds at 95th percentile")
       - Throughput requirements (e.g., "Support 1000 concurrent users")
       - Resource utilization limits
       
       ### Security Requirements
       - Authentication mechanisms
       - Authorization/access control
       - Data encryption standards (at rest and in transit)
       - Compliance requirements (GDPR, SOC2, etc.)
       - Audit logging requirements
       
       ### Scalability Requirements
       - Horizontal/vertical scaling needs
       - Auto-scaling triggers
       - Peak load handling
       
       ### Reliability & Availability
       - Uptime requirements (e.g., "99.9% availability")
       - Disaster recovery objectives (RTO/RPO)
       - Backup requirements
       - Failover mechanisms
       
       ### Usability Requirements
       - Accessibility standards (WCAG 2.1 AA)
       - Browser/device compatibility
       - Localization/internationalization needs
       
       ### Maintainability Requirements
       - Code quality standards
       - Documentation requirements
       - Technical debt management
    
    6. "Assumptions & Constraints"
       - Technical assumptions
       - Business assumptions
       - Resource constraints
       - Timeline constraints
       - Budget constraints
       - Out of scope items
    
    7. "Dependencies & Integrations"
       - External system dependencies
       - Third-party services
       - Data dependencies
       - Team/resource dependencies
    
    8. "Success Metrics & KPIs"
       - Quantitative metrics with targets
       - Qualitative success criteria
       - Measurement methods
       - Review frequency
    
    9. "Timeline & Milestones"
       - Project phases with dates
       - Key deliverables per phase
       - Decision points/gates
       - Risk buffer allocation
    
    For EACH of the 9 sections, provide:
    - title: The exact section title as listed above
    - content: Detailed content in Markdown format with bullet points, sub-headings where appropriate. Be specific and actionable.
    - sources: An array of source names that contributed to this section (from the insights)
    - confidence: A confidence score (0-100) based on how well the insights support this section
    
    Return JSON as an array of exactly 9 section objects.
  `;

  try {
    trackAPICall();
    const response = await ai.models.generateContent({
      model: modelId,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING },
              content: { type: Type.STRING },
              sources: { type: Type.ARRAY, items: { type: Type.STRING } },
              confidence: { type: Type.INTEGER }
            },
            required: ['title', 'content', 'sources', 'confidence']
          }
        }
      }
    });

    const text = response.text;
    if (!text) throw new Error("No response from AI");
    
    const result = JSON.parse(text);
    setCache(cacheKey, result);
    return result;
  } catch (error) {
    console.error("BRD Generation Failed:", error);
    throw error;
  }
};

export const refineBRD = async (
  currentBRD: { sections: BRDSection[] },
  instruction: string
): Promise<Omit<BRDSection, 'id'>[]> => {
  const prompt = `
    You are an expert Business Analyst AI. Refine the following Business Requirements Document (BRD) based on the user's instruction.
    
    Current BRD Sections:
    ${currentBRD.sections.map(s => `### ${s.title}\n${s.content}`).join('\n\n')}
    
    User Instruction: "${instruction}"
    
    Maintain the same structure but update the content as requested. 
    Return the FULL updated BRD as a JSON array of sections.
    
    For each section, provide:
    - title: The section title.
    - content: The detailed content in Markdown format.
    - sources: An array of source names that contributed to this section.
    - confidence: A confidence score (0-100) for this section.
  `;

  try {
    trackAPICall();
    const response = await ai.models.generateContent({
      model: modelId,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING },
              content: { type: Type.STRING },
              sources: { type: Type.ARRAY, items: { type: Type.STRING } },
              confidence: { type: Type.INTEGER }
            },
            required: ['title', 'content', 'sources', 'confidence']
          }
        }
      }
    });

    const text = response.text;
    if (!text) throw new Error("No response from AI");
    
    return JSON.parse(text);
  } catch (error) {
    console.error("BRD Refinement Failed:", error);
    throw error;
  }
};

export interface BRDEditProposal {
  affectedSectionTitles: string[];
  updatedSections: {
    title: string;
    content: string;
    reasoning: string;
    referencedInsights: string[];
  }[];
}

export const proposeBRDEdit = async (
  currentBRD: { sections: BRDSection[] },
  instruction: string,
  insights: Insight[]
): Promise<BRDEditProposal> => {
  const approvedInsights = insights.filter(i => i.status === 'approved');
  
  const prompt = `
    You are an expert Business Analyst AI. A user wants to edit a specific part of a Business Requirements Document (BRD).
    
    Current BRD Sections:
    ${currentBRD.sections.map(s => `### ${s.title}\n${s.content}`).join('\n\n')}
    
    User Instruction: "${instruction}"
    
    Available Approved Insights for Context:
    ${approvedInsights.map(i => `- ${i.summary}: ${i.detail} (Source: ${i.source})`).join('\n')}
    
    Your task:
    1. Identify which sections of the BRD are affected by this instruction.
    2. Provide the updated content for ONLY those sections.
    3. Provide a brief reasoning for the changes.
    4. List which insights were referenced for these changes.
    
    Return JSON with:
    - affectedSectionTitles: Array of strings.
    - updatedSections: Array of objects with {title, content, reasoning, referencedInsights}.
  `;

  try {
    trackAPICall();
    const response = await ai.models.generateContent({
      model: modelId,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            affectedSectionTitles: { type: Type.ARRAY, items: { type: Type.STRING } },
            updatedSections: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  title: { type: Type.STRING },
                  content: { type: Type.STRING },
                  reasoning: { type: Type.STRING },
                  referencedInsights: { type: Type.ARRAY, items: { type: Type.STRING } }
                },
                required: ['title', 'content', 'reasoning', 'referencedInsights']
              }
            }
          },
          required: ['affectedSectionTitles', 'updatedSections']
        }
      }
    });

    const text = response.text;
    if (!text) throw new Error("No response from AI");
    
    return JSON.parse(text);
  } catch (error) {
    console.error("BRD Edit Proposal Failed:", error);
    throw error;
  }
};

// ============================================================================
// CONFLICT DETECTION - Find conflicting requirements across sources
// ============================================================================

export interface RequirementConflict {
  id: string;
  type: 'contradiction' | 'ambiguity' | 'overlap' | 'dependency';
  severity: 'critical' | 'major' | 'minor';
  insight1: { id: string; summary: string; source: string };
  insight2: { id: string; summary: string; source: string };
  description: string;
  suggestedResolution: string;
  affectedBRDSections: string[];
  detectedAt: string;
  status: 'unresolved' | 'resolved' | 'deferred';
}

export const detectConflicts = async (
  insights: Insight[]
): Promise<RequirementConflict[]> => {
  const approvedInsights = insights.filter(i => i.status === 'approved' || i.status === 'pending');
  if (approvedInsights.length < 2) return [];

  const cacheKey = getCacheKey('detectConflicts', approvedInsights.map(i => i.id).sort().join(','));
  const cached = getFromCache<RequirementConflict[]>(cacheKey);
  if (cached) return cached;

  const prompt = `
    You are an expert Business Analyst AI specializing in requirements conflict detection.
    
    Analyze these requirements/insights from different sources and identify ANY conflicts, contradictions, ambiguities, or overlapping requirements:
    
    ${approvedInsights.map((i, idx) => `[${idx + 1}] ID: ${i.id}
    Category: ${i.category}
    Source: ${i.source} (${i.sourceType})
    Summary: ${i.summary}
    Detail: ${i.detail}
    Confidence: ${i.confidence}`).join('\n\n')}
    
    For EACH conflict found, provide:
    - type: 'contradiction' (directly conflicting statements), 'ambiguity' (unclear or vague), 'overlap' (redundant/duplicate), 'dependency' (implicit dependency not stated)
    - severity: 'critical' (blocks progress), 'major' (needs resolution before BRD), 'minor' (can be noted)
    - insight1Index: Index (1-based) of first conflicting insight
    - insight2Index: Index (1-based) of second conflicting insight  
    - description: Clear explanation of the conflict
    - suggestedResolution: Actionable recommendation to resolve
    - affectedBRDSections: Array of BRD section titles likely affected
    
    Return an array of conflicts. If no conflicts, return empty array [].
  `;

  try {
    trackAPICall();
    const response = await ai.models.generateContent({
      model: modelId,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              type: { type: Type.STRING, enum: ['contradiction', 'ambiguity', 'overlap', 'dependency'] },
              severity: { type: Type.STRING, enum: ['critical', 'major', 'minor'] },
              insight1Index: { type: Type.INTEGER },
              insight2Index: { type: Type.INTEGER },
              description: { type: Type.STRING },
              suggestedResolution: { type: Type.STRING },
              affectedBRDSections: { type: Type.ARRAY, items: { type: Type.STRING } }
            },
            required: ['type', 'severity', 'insight1Index', 'insight2Index', 'description', 'suggestedResolution', 'affectedBRDSections']
          }
        }
      }
    });

    const text = response.text;
    if (!text) return [];
    
    const rawConflicts = JSON.parse(text);
    const conflicts: RequirementConflict[] = rawConflicts.map((c: any, idx: number) => {
      const i1 = approvedInsights[c.insight1Index - 1];
      const i2 = approvedInsights[c.insight2Index - 1];
      return {
        id: `conflict_${Date.now()}_${idx}`,
        type: c.type,
        severity: c.severity,
        insight1: i1 ? { id: i1.id, summary: i1.summary, source: i1.source } : { id: 'unknown', summary: 'Unknown', source: 'Unknown' },
        insight2: i2 ? { id: i2.id, summary: i2.summary, source: i2.source } : { id: 'unknown', summary: 'Unknown', source: 'Unknown' },
        description: c.description,
        suggestedResolution: c.suggestedResolution,
        affectedBRDSections: c.affectedBRDSections,
        detectedAt: new Date().toISOString(),
        status: 'unresolved'
      };
    }).filter((c: RequirementConflict) => c.insight1.id !== 'unknown' && c.insight2.id !== 'unknown');

    setCache(cacheKey, conflicts);
    return conflicts;
  } catch (error) {
    console.error("Conflict Detection Failed:", error);
    return [];
  }
};

// ============================================================================
// CONFLICT AUTO-RESOLUTION
// ============================================================================

export interface ConflictResolutionAction {
  conflictId: string;
  actionType: 'delete_insight' | 'merge_insights' | 'edit_insight' | 'keep_both';
  targetInsightId?: string; // ID of insight to delete or edit
  mergedInsight?: Partial<Insight>; // New merged insight data
  editedContent?: { summary: string; detail: string }; // For edit action
  explanation: string;
  confidence: 'high' | 'medium' | 'low';
}

export const generateConflictResolution = async (
  conflict: RequirementConflict,
  insight1: Insight,
  insight2: Insight
): Promise<ConflictResolutionAction> => {
  // Truncate long content to prevent response issues
  const truncate = (str: string, maxLen: number = 200) => 
    str.length > maxLen ? str.slice(0, maxLen) + '...' : str;

  const prompt = `
You are an expert Business Analyst. Analyze this conflict and return a resolution action.

CONFLICT:
- Type: ${conflict.type}
- Severity: ${conflict.severity}
- Description: ${truncate(conflict.description, 150)}

INSIGHT 1 (ID: ${insight1.id}):
- Source: ${insight1.source} (${insight1.sourceType})
- Summary: ${truncate(insight1.summary, 100)}
- Confidence: ${insight1.confidence}

INSIGHT 2 (ID: ${insight2.id}):
- Source: ${insight2.source} (${insight2.sourceType})
- Summary: ${truncate(insight2.summary, 100)}
- Confidence: ${insight2.confidence}

Choose ONE action:
- delete_insight: Remove redundant insight
- merge_insights: Combine both into one
- edit_insight: Clarify ambiguous insight
- keep_both: Keep both (for dependencies)

Return JSON with: actionType, insightToActOn (1 or 2), explanation (brief), and if needed: mergedSummary, mergedDetail, editedSummary, editedDetail (all under 100 chars).
  `.trim();

  try {
    trackAPICall();
    const response = await ai.models.generateContent({
      model: modelId,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            actionType: { type: Type.STRING, enum: ['delete_insight', 'merge_insights', 'edit_insight', 'keep_both'] },
            insightToActOn: { type: Type.INTEGER },
            mergedSummary: { type: Type.STRING },
            mergedDetail: { type: Type.STRING },
            editedSummary: { type: Type.STRING },
            editedDetail: { type: Type.STRING },
            explanation: { type: Type.STRING }
          },
          required: ['actionType', 'explanation']
        }
      }
    });

    const text = response.text;
    if (!text) throw new Error('No response from AI');
    
    // Try to extract JSON if response is malformed
    let result;
    try {
      result = JSON.parse(text);
    } catch (parseError) {
      // Try to extract JSON from response
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        // Clean up potential issues
        const cleanedJson = jsonMatch[0]
          .replace(/[\x00-\x1F\x7F]/g, ' ') // Remove control characters
          .replace(/,\s*}/g, '}') // Remove trailing commas
          .replace(/,\s*]/g, ']');
        result = JSON.parse(cleanedJson);
      } else {
        throw parseError;
      }
    }

    const targetInsight = result.insightToActOn === 1 ? insight1 : insight2;
    const keepInsight = result.insightToActOn === 1 ? insight2 : insight1;

    const action: ConflictResolutionAction = {
      conflictId: conflict.id,
      actionType: result.actionType || 'keep_both',
      explanation: result.explanation || 'AI-suggested resolution',
      confidence: conflict.severity === 'minor' ? 'high' : conflict.severity === 'major' ? 'medium' : 'low'
    };

    if (result.actionType === 'delete_insight') {
      action.targetInsightId = targetInsight.id;
    } else if (result.actionType === 'merge_insights') {
      action.targetInsightId = targetInsight.id;
      action.mergedInsight = {
        id: keepInsight.id,
        summary: result.mergedSummary || `${keepInsight.summary} (merged)`,
        detail: result.mergedDetail || `${keepInsight.detail}\n\n[Merged from ${targetInsight.source}]: ${targetInsight.summary}`,
        source: `${keepInsight.source} + ${targetInsight.source}`,
        confidence: keepInsight.confidence === 'high' || targetInsight.confidence === 'high' ? 'high' : 'medium'
      };
    } else if (result.actionType === 'edit_insight') {
      action.targetInsightId = targetInsight.id;
      action.editedContent = {
        summary: result.editedSummary || targetInsight.summary,
        detail: result.editedDetail || targetInsight.detail
      };
    }

    return action;
  } catch (error) {
    console.error("Conflict Resolution Generation Failed:", error);
    // Fallback to a safe default action based on conflict type
    const fallbackAction: ConflictResolutionAction = {
      conflictId: conflict.id,
      actionType: conflict.type === 'overlap' ? 'delete_insight' : 'keep_both',
      explanation: `Auto-resolution: ${conflict.type === 'overlap' ? 'Remove duplicate insight' : 'Manual review recommended'}`,
      confidence: 'low'
    };
    
    if (conflict.type === 'overlap') {
      // For overlaps, delete the lower confidence one
      const lowerConfidence = insight1.confidence === 'low' ? insight1 : 
                              insight2.confidence === 'low' ? insight2 : insight2;
      fallbackAction.targetInsightId = lowerConfidence.id;
    }
    
    return fallbackAction;
  }
};

// ============================================================================
// STAKEHOLDER SENTIMENT ANALYSIS
// ============================================================================

export interface StakeholderSentiment {
  stakeholder: string;
  role?: string;
  overallSentiment: 'positive' | 'neutral' | 'negative' | 'mixed';
  sentimentScore: number; // -100 to +100
  concerns: string[];
  supportedItems: string[];
  engagementLevel: 'high' | 'medium' | 'low';
  recentTrend: 'improving' | 'stable' | 'declining';
  sourceCount: number;
  lastMentioned: string;
}

export interface SentimentReport {
  overallProjectSentiment: 'positive' | 'neutral' | 'negative' | 'mixed';
  averageSentimentScore: number;
  stakeholders: StakeholderSentiment[];
  topConcerns: { concern: string; frequency: number; stakeholders: string[] }[];
  positiveHighlights: string[];
  riskAreas: string[];
  generatedAt: string;
}

export const analyzeStakeholderSentiment = async (
  insights: Insight[],
  sources: { name: string; content?: string; type: string }[]
): Promise<SentimentReport> => {
  const cacheKey = getCacheKey('sentiment', insights.length, sources.length);
  const cached = getFromCache<SentimentReport>(cacheKey);
  if (cached) return cached;

  const stakeholderInsights = insights.filter(i => i.category === 'stakeholder' || i.source.toLowerCase().includes('stakeholder'));
  const allInsightText = insights.map(i => `[${i.source}] ${i.summary}: ${i.detail}`).join('\n');
  const sourceContent = sources.slice(0, 10).map(s => s.content?.slice(0, 1000) || '').join('\n---\n');

  const prompt = `
    You are an expert Business Analyst AI specializing in stakeholder analysis and sentiment extraction.
    
    Analyze the following project insights and source content to extract stakeholder sentiment:
    
    INSIGHTS:
    ${allInsightText.slice(0, 5000)}
    
    SOURCE EXCERPTS:
    ${sourceContent.slice(0, 5000)}
    
    Extract:
    1. overallProjectSentiment: The general mood/reception of the project
    2. averageSentimentScore: -100 (very negative) to +100 (very positive)
    3. stakeholders: Array of identified stakeholders with their sentiment, concerns, supported items
    4. topConcerns: Most frequently mentioned concerns/issues
    5. positiveHighlights: Things stakeholders are excited about
    6. riskAreas: Potential risks based on sentiment patterns
    
    Return comprehensive JSON analysis.
  `;

  try {
    trackAPICall();
    const response = await ai.models.generateContent({
      model: modelId,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            overallProjectSentiment: { type: Type.STRING, enum: ['positive', 'neutral', 'negative', 'mixed'] },
            averageSentimentScore: { type: Type.INTEGER },
            stakeholders: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  stakeholder: { type: Type.STRING },
                  role: { type: Type.STRING },
                  overallSentiment: { type: Type.STRING, enum: ['positive', 'neutral', 'negative', 'mixed'] },
                  sentimentScore: { type: Type.INTEGER },
                  concerns: { type: Type.ARRAY, items: { type: Type.STRING } },
                  supportedItems: { type: Type.ARRAY, items: { type: Type.STRING } },
                  engagementLevel: { type: Type.STRING, enum: ['high', 'medium', 'low'] },
                  recentTrend: { type: Type.STRING, enum: ['improving', 'stable', 'declining'] }
                },
                required: ['stakeholder', 'overallSentiment', 'sentimentScore', 'concerns', 'supportedItems', 'engagementLevel', 'recentTrend']
              }
            },
            topConcerns: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  concern: { type: Type.STRING },
                  frequency: { type: Type.INTEGER },
                  stakeholders: { type: Type.ARRAY, items: { type: Type.STRING } }
                },
                required: ['concern', 'frequency', 'stakeholders']
              }
            },
            positiveHighlights: { type: Type.ARRAY, items: { type: Type.STRING } },
            riskAreas: { type: Type.ARRAY, items: { type: Type.STRING } }
          },
          required: ['overallProjectSentiment', 'averageSentimentScore', 'stakeholders', 'topConcerns', 'positiveHighlights', 'riskAreas']
        }
      }
    });

    const text = response.text;
    if (!text) throw new Error("No response");
    
    const result = JSON.parse(text);
    const report: SentimentReport = {
      ...result,
      stakeholders: result.stakeholders.map((s: any) => ({
        ...s,
        sourceCount: insights.filter(i => i.source.toLowerCase().includes(s.stakeholder.toLowerCase())).length || 1,
        lastMentioned: new Date().toISOString()
      })),
      generatedAt: new Date().toISOString()
    };
    
    setCache(cacheKey, report);
    return report;
  } catch (error) {
    console.error("Sentiment Analysis Failed:", error);
    return {
      overallProjectSentiment: 'neutral',
      averageSentimentScore: 0,
      stakeholders: [],
      topConcerns: [],
      positiveHighlights: [],
      riskAreas: ['Unable to analyze sentiment - insufficient data'],
      generatedAt: new Date().toISOString()
    };
  }
};

// ============================================================================
// AUTOMATED STATUS REPORT GENERATION
// ============================================================================

export interface StatusReport {
  id: string;
  title: string;
  generatedAt: string;
  period: string;
  executiveSummary: string;
  progressMetrics: {
    label: string;
    current: number;
    target: number;
    status: 'on-track' | 'at-risk' | 'delayed';
  }[];
  keyAccomplishments: string[];
  activeRisks: { risk: string; severity: 'high' | 'medium' | 'low'; mitigation: string }[];
  upcomingMilestones: { milestone: string; dueDate: string; status: 'pending' | 'in-progress' | 'completed' }[];
  stakeholderUpdates: string[];
  actionItems: { item: string; owner: string; dueDate: string; priority: 'high' | 'medium' | 'low' }[];
  recommendations: string[];
  nextSteps: string[];
}

export const generateStatusReport = async (
  project: { name: string; goals?: string; timeline?: string; status: string },
  insights: Insight[],
  brdSections?: { title: string; content: string; confidence: number }[],
  conflicts?: RequirementConflict[]
): Promise<StatusReport> => {
  const cacheKey = getCacheKey('statusReport', project.name, insights.length, brdSections?.length || 0);
  const cached = getFromCache<StatusReport>(cacheKey);
  if (cached) return cached;

  const approvedInsights = insights.filter(i => i.status === 'approved');
  const pendingInsights = insights.filter(i => i.status === 'pending');
  const flaggedInsights = insights.filter(i => i.status === 'flagged');

  const prompt = `
    You are an expert Project Manager AI generating a professional status report.
    
    PROJECT: ${project.name}
    GOALS: ${project.goals || 'Not specified'}
    TIMELINE: ${project.timeline || 'Not specified'}
    STATUS: ${project.status}
    
    INSIGHTS SUMMARY:
    - Total: ${insights.length}
    - Approved: ${approvedInsights.length}
    - Pending Review: ${pendingInsights.length}
    - Flagged Issues: ${flaggedInsights.length}
    
    BRD STATUS:
    ${brdSections ? `Generated with ${brdSections.length} sections. Average confidence: ${Math.round(brdSections.reduce((a, b) => a + b.confidence, 0) / brdSections.length)}%` : 'Not yet generated'}
    
    CONFLICTS: ${conflicts?.length || 0} detected
    ${conflicts?.slice(0, 5).map(c => `- ${c.severity.toUpperCase()}: ${c.description}`).join('\n') || 'None'}
    
    Generate a comprehensive, professional status report suitable for executive stakeholders.
  `;

  try {
    trackAPICall();
    const response = await ai.models.generateContent({
      model: modelId,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            executiveSummary: { type: Type.STRING },
            progressMetrics: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  label: { type: Type.STRING },
                  current: { type: Type.INTEGER },
                  target: { type: Type.INTEGER },
                  status: { type: Type.STRING, enum: ['on-track', 'at-risk', 'delayed'] }
                },
                required: ['label', 'current', 'target', 'status']
              }
            },
            keyAccomplishments: { type: Type.ARRAY, items: { type: Type.STRING } },
            activeRisks: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  risk: { type: Type.STRING },
                  severity: { type: Type.STRING, enum: ['high', 'medium', 'low'] },
                  mitigation: { type: Type.STRING }
                },
                required: ['risk', 'severity', 'mitigation']
              }
            },
            upcomingMilestones: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  milestone: { type: Type.STRING },
                  dueDate: { type: Type.STRING },
                  status: { type: Type.STRING, enum: ['pending', 'in-progress', 'completed'] }
                },
                required: ['milestone', 'dueDate', 'status']
              }
            },
            stakeholderUpdates: { type: Type.ARRAY, items: { type: Type.STRING } },
            actionItems: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  item: { type: Type.STRING },
                  owner: { type: Type.STRING },
                  dueDate: { type: Type.STRING },
                  priority: { type: Type.STRING, enum: ['high', 'medium', 'low'] }
                },
                required: ['item', 'owner', 'dueDate', 'priority']
              }
            },
            recommendations: { type: Type.ARRAY, items: { type: Type.STRING } },
            nextSteps: { type: Type.ARRAY, items: { type: Type.STRING } }
          },
          required: ['executiveSummary', 'progressMetrics', 'keyAccomplishments', 'activeRisks', 'upcomingMilestones', 'actionItems', 'recommendations', 'nextSteps']
        }
      }
    });

    const text = response.text;
    if (!text) throw new Error("No response");
    
    const result = JSON.parse(text);
    const report: StatusReport = {
      id: `report_${Date.now()}`,
      title: `${project.name} - Status Report`,
      generatedAt: new Date().toISOString(),
      period: `Week of ${new Date().toLocaleDateString()}`,
      ...result
    };
    
    setCache(cacheKey, report);
    return report;
  } catch (error) {
    console.error("Status Report Generation Failed:", error);
    throw error;
  }
};

// ============================================================================
// TRACEABILITY MATRIX GENERATION
// ============================================================================

export interface TraceabilityEntry {
  requirementId: string;
  requirementSummary: string;
  category: string;
  source: string;
  sourceType: string;
  brdSections: string[];
  stakeholders: string[];
  status: 'implemented' | 'in-progress' | 'pending' | 'deferred';
  priority: 'critical' | 'high' | 'medium' | 'low';
  confidence: string;
  dependencies: string[];
  testCriteria?: string;
}

export const generateTraceabilityMatrix = async (
  insights: Insight[],
  brdSections?: { title: string; content: string; sources: string[] }[]
): Promise<TraceabilityEntry[]> => {
  const requirements = insights.filter(i => i.category === 'requirement' && i.status === 'approved');
  
  // Build matrix from actual data
  const matrix: TraceabilityEntry[] = requirements.map((req, idx) => {
    // Find which BRD sections reference this requirement
    const matchedSections = brdSections?.filter(s => 
      s.sources.some(src => src.toLowerCase().includes(req.source.toLowerCase())) ||
      s.content.toLowerCase().includes(req.summary.toLowerCase().slice(0, 30))
    ).map(s => s.title) || [];

    // Extract stakeholders mentioned in the requirement
    const stakeholderKeywords = ['team', 'manager', 'user', 'admin', 'customer', 'client', 'developer', 'analyst'];
    const mentionedStakeholders = stakeholderKeywords.filter(k => 
      req.detail.toLowerCase().includes(k) || req.summary.toLowerCase().includes(k)
    );

    return {
      requirementId: `REQ-${String(idx + 1).padStart(3, '0')}`,
      requirementSummary: req.summary,
      category: req.category,
      source: req.source,
      sourceType: req.sourceType,
      brdSections: matchedSections.length > 0 ? matchedSections : ['Functional Requirements'],
      stakeholders: mentionedStakeholders.length > 0 ? mentionedStakeholders : ['Project Team'],
      status: req.includedInBRD ? 'implemented' : 'pending',
      priority: req.confidence === 'high' ? 'high' : req.confidence === 'medium' ? 'medium' : 'low',
      confidence: req.confidence,
      dependencies: [],
      testCriteria: `Verify: ${req.summary.slice(0, 50)}...`
    };
  });

  return matrix;
};

export const analyzeSource = async (
  sourceName: string,
  sourceType: string,
  projectContext?: { name: string; goals?: string },
  sourceContent?: string
): Promise<{ tasks: Omit<Task, 'id'>[]; insights: Omit<Insight, 'id' | 'timestamp'>[]; confidenceBoost: number }> => {
  // Check cache - use content hash for cache key if content exists
  const contentHash = sourceContent ? sourceContent.slice(0, 200) : '';
  const cacheKey = getCacheKey('analyzeSource', sourceName, sourceType, projectContext?.name, contentHash);
  const cached = getFromCache<{ tasks: Omit<Task, 'id'>[]; insights: Omit<Insight, 'id' | 'timestamp'>[]; confidenceBoost: number }>(cacheKey);
  if (cached) return cached;

  const contentSection = sourceContent 
    ? `\n--- DOCUMENT CONTENT (first 10000 chars) ---\n${sourceContent.slice(0, 10000)}\n--- END CONTENT ---`
    : '';
    
  const prompt = `
    You are an expert Business Analyst AI. A new data source has been added to the project.
    Project Name: ${projectContext?.name || "Unknown"}
    Project Goals: ${projectContext?.goals || "Unknown"}
    Source Name: ${sourceName}
    Source Type: ${sourceType}
    ${contentSection}

    ${sourceContent ? 'Analyze the provided document content and extract:' : 'Simulate the analysis of this source and:'}
    1. Generate 2-3 realistic tasks/insights that ${sourceContent ? 'are extracted from' : 'might come from'} this ${sourceContent ? 'document' : 'type of source'}.
    2. Generate 2-3 specific "Insights" (Requirements, Decisions, Stakeholders, Timelines, or Questions).
       - Category: 'requirement', 'decision', 'stakeholder', 'timeline', 'question'
       - Confidence: 'high', 'medium', 'low'
    3. Estimate confidence boost (1-15%).

    Return JSON.
  `;

  try {
    trackAPICall();
    const response = await ai.models.generateContent({
      model: modelId,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            confidenceBoost: { type: Type.INTEGER },
            tasks: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  title: { type: Type.STRING },
                  type: { type: Type.STRING, enum: ['ambiguity', 'approval', 'conflict', 'missing'] },
                  urgency: { type: Type.STRING, enum: ['high', 'medium', 'low'] },
                  confidence: { type: Type.INTEGER }
                },
                required: ['title', 'type', 'urgency', 'confidence']
              }
            },
            insights: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  category: { type: Type.STRING, enum: ['requirement', 'decision', 'stakeholder', 'timeline', 'question'] },
                  summary: { type: Type.STRING },
                  detail: { type: Type.STRING },
                  confidence: { type: Type.STRING, enum: ['high', 'medium', 'low'] }
                },
                required: ['category', 'summary', 'detail', 'confidence']
              }
            }
          },
          required: ['confidenceBoost', 'tasks', 'insights']
        }
      }
    });

    const text = response.text;
    if (!text) throw new Error("No response from AI");
    
    const result = JSON.parse(text);
    const tasks = result.tasks.map((t: any) => ({ ...t, source: sourceName }));
    const insights = result.insights.map((i: any) => ({ 
      ...i, 
      source: sourceName, 
      sourceType: sourceType as any,
      status: 'pending'
    }));
    
    const finalResult = {
      tasks,
      insights,
      confidenceBoost: result.confidenceBoost
    };
    
    setCache(cacheKey, finalResult);
    return finalResult;

  } catch (error) {
    console.error("AI Source Analysis Failed:", error);
    return {
      tasks: [
        { title: `Review ${sourceName}`, type: 'ambiguity', urgency: 'medium', source: sourceName, confidence: 50 }
      ],
      insights: [
        { 
          category: 'question', 
          summary: `Verify content of ${sourceName}`, 
          detail: 'AI analysis failed or source is empty. Manual review required.', 
          confidence: 'low',
          source: sourceName,
          sourceType: sourceType as any,
          status: 'pending'
        }
      ],
      confidenceBoost: 5
    };
  }
};
