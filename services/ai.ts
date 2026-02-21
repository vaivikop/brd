import { GoogleGenAI, Type } from "@google/genai";
import { Task, Insight, BRDSection, ProjectState } from "../utils/db";
import type { TrustScoreResult } from "../utils/TrustScoreEngine";
import { 
  calculateProjectTrust, 
  getTrustScoreColor,
  formatTrustScore
} from "../utils/TrustScoreEngine";

const ai = new GoogleGenAI({ apiKey: import.meta.env.VITE_GEMINI_API_KEY });

// Use the cheapest, fastest model
const modelId = "gemini-2.5-flash";

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
    // Do not return fake fallback data - throw error for proper handling
    throw new Error(`Failed to generate project analysis: ${error instanceof Error ? error.message : 'Unknown error'}. Please check your API key and try again.`);
  }
};

export const generateBRD = async (
  project: { name: string; description?: string; goals?: string },
  insights: Insight[]
): Promise<Omit<BRDSection, 'id'>[]> => {
  const approvedInsights = insights.filter(i => i.status === 'approved');
  
  // REQUIRE approved insights - no placeholder generation
  if (approvedInsights.length === 0) {
    throw new Error('Cannot generate BRD without approved insights. Please add data sources, extract insights, and approve them before generating the BRD.');
  }
  
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
    
    Approved Insights (${approvedInsights.length} total):
    ${approvedInsights.map(i => `- [${i.category.toUpperCase()}] ${i.summary}: ${i.detail} (Source: ${i.source})`).join('\n')}
    
    IMPORTANT: Generate content ONLY based on the provided approved insights. Do not invent or assume information not present in the insights.
    You MUST generate EXACTLY 8 sections in the following order. Do not combine or skip any sections:
    
    1. "Executive Summary" - High-level overview of the project, its purpose, and key outcomes
    2. "Business Objectives" - Specific, measurable goals the project aims to achieve
    3. "Stakeholder Analysis" - Key stakeholders, their roles, interests, and influence
    4. "Functional Requirements" - What the system must DO (features, capabilities, behaviors)
    5. "Non-Functional Requirements" - Quality attributes (performance, security, scalability, usability)
    6. "Assumptions & Constraints" - Underlying assumptions and project limitations/boundaries
    7. "Success Metrics" - KPIs and measurable criteria to evaluate project success
    8. "Timeline & Milestones" - Key phases, deliverables, and target dates
    
    For EACH of the 8 sections, provide:
    - title: The exact section title as listed above
    - content: Detailed content in Markdown format with bullet points, sub-headings where appropriate
    - sources: An array of source names that contributed to this section (from the insights)
    - confidence: A confidence score (0-100) based on how well the insights support this section
    
    Return JSON as an array of exactly 8 section objects.
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

export const analyzeSource = async (
  sourceName: string,
  sourceType: string,
  projectContext?: { name: string; goals?: string },
  sourceContent?: string
): Promise<{ tasks: Omit<Task, 'id'>[]; insights: Omit<Insight, 'id' | 'timestamp'>[]; confidenceBoost: number }> => {
  // REQUIRE actual content - no simulation mode
  if (!sourceContent || sourceContent.trim().length < 50) {
    throw new Error(`Cannot analyze source "${sourceName}" - no content provided. Please provide actual document content for real analysis.`);
  }

  // Check cache - use content hash for cache key
  const contentHash = sourceContent.slice(0, 200);
  const cacheKey = getCacheKey('analyzeSource', sourceName, sourceType, projectContext?.name, contentHash);
  const cached = getFromCache<{ tasks: Omit<Task, 'id'>[]; insights: Omit<Insight, 'id' | 'timestamp'>[]; confidenceBoost: number }>(cacheKey);
  if (cached) return cached;

  const contentSection = `\n--- DOCUMENT CONTENT (first 10000 chars) ---\n${sourceContent.slice(0, 10000)}\n--- END CONTENT ---`;
    
  const prompt = `
    You are an expert Business Analyst AI. A new data source has been added to the project.
    Project Name: ${projectContext?.name || "Unknown"}
    Project Goals: ${projectContext?.goals || "Unknown"}
    Source Name: ${sourceName}
    Source Type: ${sourceType}
    ${contentSection}

    Analyze the provided document content and extract ONLY information that is explicitly stated or can be directly inferred from the content:
    1. Generate 2-3 tasks/insights that are extracted from this document. Only include items you can trace back to specific content.
    2. Generate 2-3 specific "Insights" (Requirements, Decisions, Stakeholders, Timelines, or Questions) that are supported by the document.
       - Category: 'requirement', 'decision', 'stakeholder', 'timeline', 'question'
       - Confidence: 'high' only if explicitly stated, 'medium' if inferred, 'low' if uncertain
    3. Estimate confidence boost (1-15%) based on how much valuable information the document contains.

    IMPORTANT: Do not invent or assume information. Only extract what is actually present in the content.

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
    // Do not return fake/placeholder data - propagate the error for proper handling
    throw new Error(`Failed to analyze source "${sourceName}": ${error instanceof Error ? error.message : 'Unknown error'}. Please ensure the source contains valid content and try again.`);
  }
};

// ============================================================================
// TRUST SCORE - AI-powered project quality evaluation
// ============================================================================

export interface TrustScoreAnalysis {
  score: number;
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
  breakdown: {
    dataQuality: number;
    requirementClarity: number;
    stakeholderAlignment: number;
    riskCoverage: number;
    completeness: number;
  };
  strengths: string[];
  improvements: string[];
  summary: string;
}

/**
 * Quick synchronous trust score calculation using TrustScoreEngine
 * No API calls - instant results for real-time UI updates
 */
export const getQuickTrustScore = (project: ProjectState): TrustScoreAnalysis => {
  const trustResult = calculateProjectTrust(project);
  
  // Map TrustScoreEngine dimensions to breakdown
  const findDimension = (name: string) => 
    trustResult.dimensions.find(d => d.name.toLowerCase().includes(name.toLowerCase()))?.score || 60;
  
  const score = trustResult.overall;
  // More achievable grade thresholds
  const grade = score >= 85 ? 'A' : score >= 72 ? 'B' : score >= 58 ? 'C' : score >= 45 ? 'D' : 'F';
  
  // Always find strengths first - look for dimensions >= 55 (reasonable threshold)
  const strongDimensions = trustResult.dimensions.filter(d => d.score >= 55)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map(d => {
      if (d.score >= 80) return `Excellent ${d.name.toLowerCase()}`;
      if (d.score >= 70) return `Strong ${d.name.toLowerCase()}`;
      return `Good ${d.name.toLowerCase()}`;
    });
  
  // Default strengths if dimensions are still building
  const strengths = strongDimensions.length > 0 ? strongDimensions : [
    project.sources.length > 0 ? 'Data sources connected' : 'Project initialized',
    project.insights.length > 0 ? 'Insights extracted' : 'Ready for analysis',
    'System configured and operational'
  ];
  
  // Only show improvements for dimensions below 55
  const weakDimensions = trustResult.dimensions.filter(d => d.score < 55);
  const improvements = weakDimensions.length > 0 
    ? trustResult.alerts.map(a => a.action).filter(Boolean).slice(0, 2) as string[]
    : [];
  
  // Positive-first summary
  const generateSummary = () => {
    const hasData = project.sources.length > 0 || project.insights.length > 0;
    const highCount = trustResult.dimensions.filter(d => d.score >= 70).length;
    const dominantDim = trustResult.dimensions.reduce((a, b) => a.score > b.score ? a : b, trustResult.dimensions[0]);
    
    if (score >= 80) {
      return `Excellent project health. ${dominantDim?.name || 'Quality'} leads at ${Math.round(dominantDim?.score || score)}%.`;
    }
    if (score >= 65) {
      return `Good project progress. ${highCount > 0 ? `${highCount} factor(s) performing well.` : 'On track for completion.'}`;
    }
    if (hasData) {
      return `Project developing well. ${strongDimensions.length > 0 ? `${strongDimensions[0]} is a highlight.` : 'Continue adding data for best results.'}`;
    }
    return 'Project ready to begin. Add sources to start analysis.';
  };
  
  return {
    score,
    grade,
    breakdown: {
      dataQuality: findDimension('Evidence'),
      requirementClarity: findDimension('Consistency'),
      stakeholderAlignment: findDimension('Validation'),
      riskCoverage: findDimension('Freshness'),
      completeness: findDimension('Completeness')
    },
    strengths,
    improvements,
    summary: generateSummary()
  };
};

/**
 * Re-export TrustScoreEngine utilities for components
 */
export type { TrustScoreResult };
export { 
  getTrustScoreColor, 
  formatTrustScore,
  calculateProjectTrust as calculateInstantTrustScore
};

export const calculateTrustScore = async (
  project: {
    name: string;
    goals?: string;
    sources: { name: string; type: string }[];
    insights: { category: string; summary: string; confidence: string; status: string }[];
    tasks: { title: string; type: string; urgency: string }[];
    brd?: { sections: { title: string; content: string; confidence: number }[] };
  }
): Promise<TrustScoreAnalysis> => {
  // Create a summary for cache lookup
  const projectSummary = `${project.name}-${project.sources.length}-${project.insights.length}-${project.tasks.length}-${project.brd?.sections?.length || 0}`;
  const cacheKey = getCacheKey('trustScore', projectSummary);
  const cached = getFromCache<TrustScoreAnalysis>(cacheKey);
  if (cached) return cached;

  const prompt = `
    You are an expert Business Analyst AI. Evaluate the quality and trustworthiness of this Business Requirements Document (BRD) project.
    
    Project: ${project.name}
    Goals: ${project.goals || "Not specified"}
    
    Data Sources (${project.sources.length} total):
    ${project.sources.slice(0, 10).map(s => `- ${s.name} (${s.type})`).join('\n')}
    ${project.sources.length > 10 ? `... and ${project.sources.length - 10} more` : ''}
    
    Insights Extracted (${project.insights.length} total):
    ${project.insights.slice(0, 15).map(i => `- [${i.category.toUpperCase()}] ${i.summary} (${i.confidence} confidence, ${i.status})`).join('\n')}
    ${project.insights.length > 15 ? `... and ${project.insights.length - 15} more` : ''}
    
    Open Tasks/Issues (${project.tasks.length} total):
    ${project.tasks.slice(0, 10).map(t => `- [${t.type.toUpperCase()}] ${t.title} (${t.urgency} urgency)`).join('\n')}
    ${project.tasks.length > 10 ? `... and ${project.tasks.length - 10} more` : ''}
    
    BRD Sections: ${project.brd?.sections?.length || 0} generated
    ${project.brd?.sections ? project.brd.sections.map(s => `- ${s.title}: ${s.confidence}% confidence`).join('\n') : 'No BRD generated yet'}
    
    Analyze and provide:
    1. An overall trust score (0-100)
    2. A letter grade (A/B/C/D/F)
    3. Breakdown scores (0-100 each):
       - dataQuality: How diverse and reliable are the data sources?
       - requirementClarity: Are requirements clear and unambiguous?
       - stakeholderAlignment: Is there evidence of stakeholder input?
       - riskCoverage: Are risks, constraints, and assumptions addressed?
       - completeness: How complete is the overall BRD?
    4. Top 2-3 strengths of the project
    5. Top 2-3 areas for improvement
    6. A brief 1-2 sentence summary of the project's readiness
    
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
            score: { type: Type.INTEGER },
            grade: { type: Type.STRING, enum: ['A', 'B', 'C', 'D', 'F'] },
            breakdown: {
              type: Type.OBJECT,
              properties: {
                dataQuality: { type: Type.INTEGER },
                requirementClarity: { type: Type.INTEGER },
                stakeholderAlignment: { type: Type.INTEGER },
                riskCoverage: { type: Type.INTEGER },
                completeness: { type: Type.INTEGER }
              },
              required: ['dataQuality', 'requirementClarity', 'stakeholderAlignment', 'riskCoverage', 'completeness']
            },
            strengths: { type: Type.ARRAY, items: { type: Type.STRING } },
            improvements: { type: Type.ARRAY, items: { type: Type.STRING } },
            summary: { type: Type.STRING }
          },
          required: ['score', 'grade', 'breakdown', 'strengths', 'improvements', 'summary']
        }
      }
    });

    const text = response.text;
    if (!text) throw new Error("No response from AI");
    
    const result = JSON.parse(text) as TrustScoreAnalysis;
    setCache(cacheKey, result);
    return result;
  } catch (error) {
    console.error("Trust Score calculation failed:", error);
    // Return fallback score based on simple metrics
    const sourcesScore = Math.min(project.sources.length * 15, 70);
    const insightsScore = project.insights.length > 0 ? 20 : 0;
    const brdScore = project.brd?.sections?.length ? 10 : 0;
    const score = Math.min(sourcesScore + insightsScore + brdScore, 100);
    
    return {
      score,
      grade: score >= 90 ? 'A' : score >= 80 ? 'B' : score >= 70 ? 'C' : score >= 60 ? 'D' : 'F',
      breakdown: {
        dataQuality: Math.min(project.sources.length * 20, 100),
        requirementClarity: project.insights.filter(i => i.confidence === 'high').length * 15,
        stakeholderAlignment: project.insights.filter(i => i.category === 'stakeholder').length * 20,
        riskCoverage: project.tasks.length > 0 ? 40 : 20,
        completeness: project.brd?.sections?.length ? 60 : 20
      },
      strengths: ['Project initialized'],
      improvements: ['Add more data sources', 'Generate BRD sections'],
      summary: 'Project is in early stages. Add more sources and generate insights to improve trust score.'
    };
  }
};

// ============================================================================
// CLARITY ASSISTANT - Conversational AI for project questions
// ============================================================================

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

export interface ChatResponse {
  message: string;
  suggestedActions?: { label: string; action: string }[];
  relatedInsights?: string[];
  confidence: number;
}

export const chatWithClarity = async (
  userMessage: string,
  projectContext: {
    name: string;
    goals?: string;
    sources: { name: string; type: string }[];
    insights: { category: string; summary: string; detail: string; status: string }[];
    tasks: { title: string; type: string; urgency: string }[];
    brd?: { sections: { title: string; content: string }[] };
  },
  chatHistory: ChatMessage[] = []
): Promise<ChatResponse> => {
  // Build conversation history for context
  const historyText = chatHistory.slice(-4).map(m => 
    `${m.role === 'user' ? 'User' : 'Clarity'}: ${m.content}`
  ).join('\n');

  const prompt = `
    You are Clarity, a helpful AI assistant for a Business Requirements Document (BRD) project called "${projectContext.name}".
    
    Your personality:
    - Friendly but professional
    - Knowledgeable about business analysis
    - Always helpful and solution-oriented
    - Keep responses concise (2-4 sentences max)
    
    Project Context:
    - Name: ${projectContext.name}
    - Goals: ${projectContext.goals || "Not specified"}
    - Data Sources: ${projectContext.sources.length} connected (${projectContext.sources.map(s => s.type).join(', ')})
    - Insights: ${projectContext.insights.length} extracted (${projectContext.insights.filter(i => i.status === 'approved').length} approved)
    - Open Tasks: ${projectContext.tasks.length} pending
    - BRD Status: ${projectContext.brd?.sections?.length ? `${projectContext.brd.sections.length} sections generated` : 'Not generated yet'}
    
    Key Insights:
    ${projectContext.insights.slice(0, 5).map(i => `- [${i.category}] ${i.summary}`).join('\n')}
    
    Open Tasks:
    ${projectContext.tasks.slice(0, 3).map(t => `- [${t.type}] ${t.title}`).join('\n')}
    
    ${projectContext.brd ? `BRD Sections: ${projectContext.brd.sections.map(s => s.title).join(', ')}` : ''}
    
    ${historyText ? `Recent Conversation:\n${historyText}\n` : ''}
    
    User Question: "${userMessage}"
    
    Provide:
    1. A helpful response to the user's question
    2. Up to 2 suggested follow-up actions (optional)
    3. Related insights from the project (optional, max 2)
    4. Confidence score (0-100) for your response accuracy
    
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
            message: { type: Type.STRING },
            suggestedActions: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  label: { type: Type.STRING },
                  action: { type: Type.STRING }
                },
                required: ['label', 'action']
              }
            },
            relatedInsights: { type: Type.ARRAY, items: { type: Type.STRING } },
            confidence: { type: Type.INTEGER }
          },
          required: ['message', 'confidence']
        }
      }
    });

    const text = response.text;
    if (!text) throw new Error("No response from AI");
    
    return JSON.parse(text) as ChatResponse;
  } catch (error) {
    console.error("Chat with Clarity failed:", error);
    return {
      message: "I'm having trouble connecting right now. Please try again in a moment, or check if your API key is configured correctly.",
      confidence: 0
    };
  }
};

// ============================================================================
// SEARCH - AI-powered semantic search across project
// ============================================================================

export interface SearchResult {
  type: 'insight' | 'task' | 'brd_section' | 'source';
  title: string;
  content: string;
  relevance: number;
  id?: string;
}

export const searchProject = async (
  query: string,
  projectContext: {
    insights: { id: string; category: string; summary: string; detail: string }[];
    tasks: { id: string; title: string; source: string }[];
    brd?: { sections: { id: string; title: string; content: string }[] };
    sources: { id: string; name: string; type: string }[];
  }
): Promise<SearchResult[]> => {
  // Simple local search first (fast, no API)
  const queryLower = query.toLowerCase();
  const results: SearchResult[] = [];

  // Search insights
  projectContext.insights.forEach(insight => {
    const matchScore = 
      (insight.summary.toLowerCase().includes(queryLower) ? 50 : 0) +
      (insight.detail.toLowerCase().includes(queryLower) ? 30 : 0) +
      (insight.category.toLowerCase().includes(queryLower) ? 20 : 0);
    
    if (matchScore > 0) {
      results.push({
        type: 'insight',
        title: insight.summary,
        content: insight.detail,
        relevance: Math.min(matchScore, 100),
        id: insight.id
      });
    }
  });

  // Search tasks
  projectContext.tasks.forEach(task => {
    const matchScore = 
      (task.title.toLowerCase().includes(queryLower) ? 70 : 0) +
      (task.source.toLowerCase().includes(queryLower) ? 30 : 0);
    
    if (matchScore > 0) {
      results.push({
        type: 'task',
        title: task.title,
        content: `Source: ${task.source}`,
        relevance: Math.min(matchScore, 100),
        id: task.id
      });
    }
  });

  // Search BRD sections
  projectContext.brd?.sections.forEach(section => {
    const matchScore = 
      (section.title.toLowerCase().includes(queryLower) ? 40 : 0) +
      (section.content.toLowerCase().includes(queryLower) ? 60 : 0);
    
    if (matchScore > 0) {
      results.push({
        type: 'brd_section',
        title: section.title,
        content: section.content.slice(0, 150) + '...',
        relevance: Math.min(matchScore, 100),
        id: section.id
      });
    }
  });

  // Search sources
  projectContext.sources.forEach(source => {
    const matchScore = 
      (source.name.toLowerCase().includes(queryLower) ? 80 : 0) +
      (source.type.toLowerCase().includes(queryLower) ? 20 : 0);
    
    if (matchScore > 0) {
      results.push({
        type: 'source',
        title: source.name,
        content: `Type: ${source.type}`,
        relevance: Math.min(matchScore, 100),
        id: source.id
      });
    }
  });

  // Sort by relevance
  return results.sort((a, b) => b.relevance - a.relevance).slice(0, 10);
};

// ============================================================================
// AI ACTION SYSTEM - Execute real actions from chat
// ============================================================================

export type AIActionType = 
  | 'none'
  | 'add_task'
  | 'complete_task'
  | 'delete_task'
  | 'update_task'
  | 'add_insight'
  | 'approve_insight'
  | 'update_brd_section'
  | 'add_brd_section'
  | 'update_project_goals'
  | 'navigate'
  | 'approve_all_insights';

export interface AIAction {
  type: AIActionType;
  data: Record<string, any>;
  description: string;
}

export interface ChatResponseWithActions extends ChatResponse {
  actions?: AIAction[];
  requiresConfirmation?: boolean;
}

export const chatWithClarityActions = async (
  userMessage: string,
  projectContext: {
    name: string;
    goals?: string;
    sources: { id: string; name: string; type: string }[];
    insights: { id: string; category: string; summary: string; detail: string; status: string }[];
    tasks: { id: string; title: string; type: string; urgency: string; status?: string }[];
    brd?: { sections: { id: string; title: string; content: string }[] };
  },
  chatHistory: ChatMessage[] = []
): Promise<ChatResponseWithActions> => {
  // Build conversation history for context
  const historyText = chatHistory.slice(-4).map(m => 
    `${m.role === 'user' ? 'User' : 'Clarity'}: ${m.content}`
  ).join('\n');

  const prompt = `
    You are Clarity, a friendly and helpful AI assistant for a Business Requirements Document (BRD) project.
    You speak naturally like a helpful colleague, not like a robot. Be warm, conversational, and human.
    You can ACTUALLY PERFORM ACTIONS when the user asks you to do something.
    
    YOUR PERSONALITY:
    - Friendly, warm, and supportive - like a helpful team member
    - Use natural language, not technical jargon or IDs
    - NEVER show internal IDs like [t12345] or [section_123] to users - use human-readable names
    - Keep responses concise but warm (2-4 sentences)
    - Use casual language like "Done!", "Got it!", "Sure thing!"
    - When listing items, use their actual names/titles, not IDs
    
    CAPABILITIES - You CAN execute these actions:
    1. ADD TASK: Create new tasks/action items
    2. COMPLETE TASK: Mark tasks as done  
    3. DELETE TASK: Remove tasks
    4. ADD INSIGHT: Create new insights
    5. APPROVE INSIGHT: Approve insights for BRD
    6. APPROVE ALL INSIGHTS: Approve all pending insights
    7. UPDATE BRD SECTION: Edit existing BRD sections
    8. ADD BRD SECTION: Add new sections to BRD
    9. UPDATE PROJECT GOALS: Add to or modify project goals (IMPORTANT: When user says "include" or "add to goals", APPEND to existing goals, don't replace them!)
    10. NAVIGATE: Direct user to specific pages
    
    CRITICAL RULES:
    - For UPDATE PROJECT GOALS: If user says "include X" or "add X to goals", you must COMBINE the existing goals with the new content. The data.goals field should contain BOTH the old goals AND the new addition.
    - Current goals are: "${projectContext.goals || "Not specified"}"
    - So if user says "add mobile support", goals should become: "${projectContext.goals || ""} Additionally, the project will include mobile platform support."
    
    Project Context:
    - Name: ${projectContext.name}
    - Goals: ${projectContext.goals || "Not specified"}
    - Sources (${projectContext.sources.length}): ${projectContext.sources.map(s => s.name).join(', ') || 'None yet'}
    - Insights (${projectContext.insights.length}): 
      ${projectContext.insights.slice(0, 8).map(i => `• ${i.category}: ${i.summary} (${i.status})`).join('\n      ') || 'None yet'}
    - Tasks (${projectContext.tasks.length}):
      ${projectContext.tasks.slice(0, 8).map(t => `• "${t.title}" - ${t.type}, ${t.urgency} priority, ${t.status || 'pending'}`).join('\n      ') || 'None yet'}
    ${projectContext.brd ? `- BRD Sections (${projectContext.brd.sections.length}):\n      ${projectContext.brd.sections.map(s => `• ${s.title}: ${s.content.slice(0, 300)}${s.content.length > 300 ? '...' : ''}`).join('\n      ')}` : '- BRD: Not generated yet'}
    
    (Internal reference - DO NOT show these IDs to user, only use them in action data):
    Tasks: ${projectContext.tasks.slice(0, 8).map(t => `${t.title}=${t.id}`).join(', ')}
    Insights: ${projectContext.insights.slice(0, 8).map(i => `${i.summary.slice(0,30)}=${i.id}`).join(', ')}
    
    ${historyText ? `Recent Conversation:\n${historyText}\n` : ''}
    
    User Message: "${userMessage}"
    
    RESPONSE INSTRUCTIONS:
    1. If user asks to DO something (add, delete, update, complete, approve, change, etc.), include the action in "actions" array
    2. If just asking a question, set actions to empty array  
    3. Use IDs in action data but NEVER mention IDs in your message to the user
    4. For UPDATE_PROJECT_GOALS action, the data.goals field MUST contain the FULL combined goals (existing + new)
    5. Write your message in a friendly, human way - like you're talking to a colleague
    6. For dangerous actions (delete, bulk updates), set requiresConfirmation to true
    7. ALWAYS include the "data" field in actions with the required properties
    
    ACTION DATA FORMATS (CRITICAL - include these exact field names):
    - update_project_goals: { "goals": "Full goals text including existing + new" }
      EXAMPLE: If current goals are "Build a CRM system" and user wants to add mobile support:
      { "type": "update_project_goals", "data": { "goals": "Build a CRM system. Additionally, the project will include mobile platform support." }, "description": "Add mobile support to goals" }
    - add_task: { "title": "Task name", "type": "action|clarification|missing|conflict", "urgency": "high|medium|low" }
    - complete_task: { "taskId": "t...", "title": "Task name for matching" }
    - update_brd_section: { "sectionId": "s...", "updates": { "content": "new content" } }
    - navigate: { "destination": "sources|insights|generate|graph" }
      VALID DESTINATIONS ONLY: "sources" (data sources page), "insights" (insights review), "generate" or "brd" (BRD generation page), "graph" (knowledge graph view)
      IMPORTANT: When user asks about a BRD section (like "Executive Summary", "Scope", etc.), SHARE the content directly from the BRD sections above in your message. You have access to the section content - use it!
    
    Examples of good responses:
    - "Done! I've added 'mobile platform support' to your project goals. 📱"
    - "Got it! I've marked that task as complete. One less thing to worry about!"
    - "Here's what I found: You have 3 tasks that need attention - the API documentation review, stakeholder sign-off, and timeline clarification."
    
    Examples of BAD responses (DON'T do this):
    - "Task [t17715902722620] has been updated" (showing IDs)
    - "The following tasks require attention: [t123], [t456]" (technical/robotic)
    
    Return JSON with:
    - message: Your friendly response (NO IDs, use actual names)
    - actions: Array of actions to execute (can be empty, include IDs here only)
    - requiresConfirmation: boolean (true for destructive actions)
    - confidence: 0-100
    
    EXAMPLE OUTPUT for "add mobile support to my goals":
    {
      "message": "Done! I've added 'mobile support' to your project goals. 📱",
      "actions": [
        {
          "type": "update_project_goals",
          "data": { "goals": "${(projectContext.goals || '').replace(/"/g, '\\"')} Additionally, the project will include mobile platform support." },
          "description": "Add mobile support to goals"
        }
      ],
      "requiresConfirmation": false,
      "confidence": 95
    }
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
            message: { type: Type.STRING },
            actions: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  type: { 
                    type: Type.STRING, 
                    enum: ['none', 'add_task', 'complete_task', 'delete_task', 'update_task', 
                           'add_insight', 'approve_insight', 'approve_all_insights',
                           'update_brd_section', 'add_brd_section', 'update_project_goals', 'navigate'] 
                  },
                  data: { 
                    type: Type.OBJECT,
                    description: "Action-specific data. For update_project_goals, must include 'goals' field with the FULL text."
                  },
                  description: { type: Type.STRING }
                },
                required: ['type', 'description', 'data']
              }
            },
            requiresConfirmation: { type: Type.BOOLEAN },
            confidence: { type: Type.INTEGER }
          },
          required: ['message', 'confidence']
        }
      }
    });

    const text = response.text;
    if (!text) throw new Error("No response from AI");
    
    console.log('AI raw response:', text);
    const parsed = JSON.parse(text) as ChatResponseWithActions;
    console.log('AI parsed response:', JSON.stringify(parsed, null, 2));
    
    // Filter out 'none' actions
    if (parsed.actions) {
      parsed.actions = parsed.actions.filter(a => a.type !== 'none');
    }
    
    return parsed;
  } catch (error) {
    console.error("Chat with Clarity Actions failed:", error);
    return {
      message: "I'm having trouble connecting right now. Please try again in a moment.",
      confidence: 0,
      actions: []
    };
  }
};

// ============================================================================
// REFINE INSIGHT WITH AI
// ============================================================================

export interface RefinedInsight {
  summary: string;
  detail: string;
}

export const refineInsight = async (
  insight: Insight,
  projectContext?: { name?: string; goals?: string }
): Promise<RefinedInsight> => {
  const cacheKey = getCacheKey('refineInsight', insight.summary, insight.detail);
  const cached = getFromCache<RefinedInsight>(cacheKey);
  if (cached) return cached;
  
  trackAPICall();
  
  try {
    const prompt = `You are an expert Business Analyst AI. Your task is to refine and improve the following insight to make it clearer, more specific, and more actionable for a Business Requirements Document.

Current Insight:
- Summary: ${insight.summary}
- Detail: ${insight.detail}
- Category: ${insight.category}
- Source: ${insight.source}
${projectContext?.name ? `- Project: ${projectContext.name}` : ''}
${projectContext?.goals ? `- Project Goals: ${projectContext.goals}` : ''}

Refine this insight by:
1. Making the summary more concise and action-oriented (max 100 chars)
2. Expanding the detail with specific, measurable criteria where applicable
3. Ensuring professional business language
4. Preserving the original meaning and intent
5. Adding quantifiable metrics or acceptance criteria if possible

Return a JSON object with the refined summary and detail.`;

    const response = await ai.models.generateContent({
      model: modelId,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            summary: { 
              type: Type.STRING, 
              description: "Refined summary - concise and action-oriented (max 100 chars)" 
            },
            detail: { 
              type: Type.STRING, 
              description: "Refined detail - specific, measurable, and professional" 
            }
          },
          required: ['summary', 'detail']
        }
      }
    });

    const text = response.text;
    if (!text) throw new Error("No response from AI");
    
    const refined = JSON.parse(text) as RefinedInsight;
    setCache(cacheKey, refined);
    return refined;
  } catch (error) {
    console.error("Refine insight failed:", error);
    // Return original if refinement fails
    return {
      summary: insight.summary,
      detail: insight.detail
    };
  }
};
