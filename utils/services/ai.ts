import { GoogleGenAI, Type } from "@google/genai";
import { Task, Insight, BRDSection } from "../db";

const ai = new GoogleGenAI({ apiKey: import.meta.env.VITE_GEMINI_API_KEY });

// Use the cheapest, fastest model with optimized settings
const modelId = "gemini-2.5-flash";

// ============================================================================
// AI SPEED OPTIMIZATIONS
// ============================================================================

// Model configuration for faster responses
const FAST_CONFIG = {
  temperature: 0.3, // Lower temperature = faster, more deterministic
  topP: 0.8,
  topK: 40,
  maxOutputTokens: 4096, // Limit output size for speed
};

const QUICK_CONFIG = {
  ...FAST_CONFIG,
  maxOutputTokens: 1024, // Even smaller for quick operations
};

// ============================================================================
// CACHING LAYER - Minimize API costs & speed up responses
// ============================================================================

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  key: string;
}

const cache = new Map<string, CacheEntry<any>>();
const CACHE_TTL = 15 * 60 * 1000; // 15 minutes cache lifetime (increased)

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
  // Limit cache size to 100 entries (increased capacity)
  if (cache.size >= 100) {
    // Remove oldest 10% when full
    const keysToRemove = Array.from(cache.keys()).slice(0, 10);
    keysToRemove.forEach(k => cache.delete(k));
  }
  
  cache.set(key, { data, timestamp: Date.now(), key });
  console.log('[AI Cache] SET:', key.slice(0, 50) + '...');
};

// Pre-warm cache with common operations
const pendingRequests = new Map<string, Promise<any>>();

// Deduplicate concurrent identical requests
const deduplicateRequest = async <T>(key: string, requestFn: () => Promise<T>): Promise<T> => {
  // Check if same request is already in flight
  const pending = pendingRequests.get(key);
  if (pending) {
    console.log('[AI] Deduplicating request:', key.slice(0, 50));
    return pending as Promise<T>;
  }
  
  // Start new request and track it
  const promise = requestFn().finally(() => {
    pendingRequests.delete(key);
  });
  pendingRequests.set(key, promise);
  return promise;
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
// BATCH PROCESSING - Process multiple items efficiently
// ============================================================================

interface BatchItem<T, R> {
  input: T;
  resolve: (result: R) => void;
  reject: (error: Error) => void;
}

const batchQueues = new Map<string, BatchItem<any, any>[]>();
const batchTimers = new Map<string, NodeJS.Timeout>();
const BATCH_DELAY = 50; // ms to wait for batching
const MAX_BATCH_SIZE = 10;

// Generic batch processor for AI requests
export const batchProcess = <T, R>(
  queueKey: string,
  input: T,
  processBatch: (items: T[]) => Promise<R[]>
): Promise<R> => {
  return new Promise((resolve, reject) => {
    let queue = batchQueues.get(queueKey);
    if (!queue) {
      queue = [];
      batchQueues.set(queueKey, queue);
    }

    queue.push({ input, resolve, reject });

    // Clear existing timer
    const existingTimer = batchTimers.get(queueKey);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    // Process immediately if max batch size reached
    if (queue.length >= MAX_BATCH_SIZE) {
      processBatchQueue(queueKey, processBatch);
    } else {
      // Otherwise, wait for more items
      const timer = setTimeout(() => {
        processBatchQueue(queueKey, processBatch);
      }, BATCH_DELAY);
      batchTimers.set(queueKey, timer as unknown as NodeJS.Timeout);
    }
  });
};

const processBatchQueue = async <T, R>(
  queueKey: string,
  processBatch: (items: T[]) => Promise<R[]>
): Promise<void> => {
  const queue = batchQueues.get(queueKey);
  if (!queue || queue.length === 0) return;

  // Take all items from queue
  const items = [...queue];
  batchQueues.set(queueKey, []);
  batchTimers.delete(queueKey);

  try {
    const inputs = items.map(item => item.input);
    const results = await processBatch(inputs);
    
    // Distribute results
    items.forEach((item, idx) => {
      if (results[idx]) {
        item.resolve(results[idx]);
      } else {
        item.reject(new Error('No result for batch item'));
      }
    });
  } catch (error) {
    items.forEach(item => item.reject(error as Error));
  }
};

// Pre-compute analysis for faster subsequent requests
export const precomputeProjectAnalysis = async (
  projectName: string,
  insights: Insight[],
  sources: { name: string; content?: string }[]
): Promise<void> => {
  console.log('[AI] Pre-computing analysis for project:', projectName);
  
  // Fire and forget - pre-warm cache for common operations
  const precomputePromises = [];

  // Only precompute if not already cached
  if (insights.length > 0) {
    const conflictKey = getCacheKey('conflicts', insights.slice(0, 5).map(i => i.id).join(','));
    if (!getFromCache(conflictKey)) {
      // This will cache the result for future use
      precomputePromises.push(
        detectConflicts(insights).catch(e => console.log('[AI] Precompute conflict detection failed:', e))
      );
    }
  }

  await Promise.allSettled(precomputePromises);
  console.log('[AI] Pre-computation complete for:', projectName);
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
  
  // Categorize insights by type and priority
  const mustHave = approvedInsights.filter(i => i.priority === 'must');
  const shouldHave = approvedInsights.filter(i => i.priority === 'should');
  const couldHave = approvedInsights.filter(i => i.priority === 'could');
  const requirements = approvedInsights.filter(i => i.category === 'requirement');
  const decisions = approvedInsights.filter(i => i.category === 'decision');
  const stakeholders = approvedInsights.filter(i => i.category === 'stakeholder');
  const timelines = approvedInsights.filter(i => i.category === 'timeline');
  const questions = approvedInsights.filter(i => i.category === 'question');
  const conflictInsights = approvedInsights.filter(i => i.hasConflicts);
  
  // Calculate average confidence
  const avgConfidence = approvedInsights.length > 0 
    ? Math.round(approvedInsights.reduce((sum, i) => sum + (i.confidenceScore || 50), 0) / approvedInsights.length)
    : 50;
  
  // Extract unique stakeholder mentions
  const allStakeholders = [...new Set(approvedInsights.flatMap(i => i.stakeholderMentions || []))];
  
  // Extract unique sources
  const allSources = [...new Set(approvedInsights.map(i => i.source))];
  
  // Format insight for prompt with all metadata
  const formatInsight = (i: Insight) => {
    const priority = i.priority && i.priority !== 'unset' ? `[${i.priority.toUpperCase()}]` : '';
    const confidence = i.confidenceScore ? `(${i.confidenceScore}% confident)` : '';
    const conflict = i.hasConflicts ? '⚠️ HAS CONFLICTS' : '';
    const stakeholderRefs = i.stakeholderMentions?.length ? `| Stakeholders: ${i.stakeholderMentions.join(', ')}` : '';
    return `- ${priority} [${i.category.toUpperCase()}] ${i.summary}: ${i.detail} (Source: ${i.source}) ${confidence} ${conflict} ${stakeholderRefs}`;
  };
  
  // Cache based on project and approved insight summaries
  const insightSummaries = approvedInsights.map(i => i.summary).sort().join(',');
  const cacheKey = getCacheKey('generateBRD', project.name, project.goals, insightSummaries.slice(0, 300));
  const cached = getFromCache<Omit<BRDSection, 'id'>[]>(cacheKey);
  if (cached) return cached;
  
  const prompt = `
You are a Senior Business Analyst with 15+ years of experience creating enterprise-grade Business Requirements Documents. Generate a comprehensive, professional BRD based on the following project context and AI-analyzed insights.

═══════════════════════════════════════════════════════════════════════════════
PROJECT OVERVIEW
═══════════════════════════════════════════════════════════════════════════════
Project Name: ${project.name}
Description: ${project.description || "Enterprise software project"}
Strategic Goals: ${project.goals || "Deliver value to stakeholders through digital transformation"}

═══════════════════════════════════════════════════════════════════════════════
INSIGHT ANALYSIS SUMMARY
═══════════════════════════════════════════════════════════════════════════════
Total Approved Insights: ${approvedInsights.length}
Average AI Confidence: ${avgConfidence}%
Data Sources Analyzed: ${allSources.length} (${allSources.slice(0, 5).join(', ')}${allSources.length > 5 ? '...' : ''})
Identified Stakeholders: ${allStakeholders.length > 0 ? allStakeholders.join(', ') : 'To be identified'}
Insights with Conflicts: ${conflictInsights.length} (require resolution)
Open Questions: ${questions.length}

Priority Distribution:
- Must Have (Critical): ${mustHave.length} insights
- Should Have (Important): ${shouldHave.length} insights  
- Could Have (Nice-to-have): ${couldHave.length} insights

Category Breakdown:
- Requirements: ${requirements.length}
- Decisions: ${decisions.length}
- Stakeholder Info: ${stakeholders.length}
- Timeline/Milestones: ${timelines.length}
- Open Questions: ${questions.length}

═══════════════════════════════════════════════════════════════════════════════
APPROVED INSIGHTS (PRIORITIZED)
═══════════════════════════════════════════════════════════════════════════════

${mustHave.length > 0 ? `🔴 MUST HAVE (Critical Requirements):\n${mustHave.map(formatInsight).join('\n')}\n` : ''}
${shouldHave.length > 0 ? `🟡 SHOULD HAVE (Important):\n${shouldHave.map(formatInsight).join('\n')}\n` : ''}
${couldHave.length > 0 ? `🟢 COULD HAVE (Nice-to-have):\n${couldHave.map(formatInsight).join('\n')}\n` : ''}
${approvedInsights.filter(i => !i.priority || i.priority === 'unset').length > 0 ? `⚪ UNPRIORITIZED:\n${approvedInsights.filter(i => !i.priority || i.priority === 'unset').map(formatInsight).join('\n')}\n` : ''}

${conflictInsights.length > 0 ? `⚠️ CONFLICTING INSIGHTS (Need Resolution):\n${conflictInsights.map(formatInsight).join('\n')}\n` : ''}

${approvedInsights.length === 0 ? '⚠️ No approved insights yet. Generate intelligent placeholder content based on project context and industry best practices.\n' : ''}

═══════════════════════════════════════════════════════════════════════════════
BRD GENERATION REQUIREMENTS
═══════════════════════════════════════════════════════════════════════════════

Generate EXACTLY 9 sections following IEEE 830 and BABOK standards:

1. "Executive Summary"
   - Project vision and strategic alignment
   - Business problem and proposed solution
   - Key benefits and expected ROI
   - Scope summary (in-scope/out-of-scope)
   - Critical success factors
   - Target delivery timeline

2. "Business Objectives"
   - SMART objectives (Specific, Measurable, Achievable, Relevant, Time-bound)
   - Key Results (OKRs) if applicable
   - Business value quantification where possible
   - Alignment to organizational strategy
   - Success criteria per objective

3. "Stakeholder Analysis"
   - Stakeholder register with roles: ${allStakeholders.length > 0 ? allStakeholders.join(', ') : 'Identify from context'}
   - RACI matrix for key activities
   - Interest/Influence grid classification
   - Communication requirements per stakeholder type
   - Known concerns and mitigation strategies
   - Approval authority matrix

4. "Functional Requirements"
   - Organized by feature area with requirement IDs (FR-001, FR-002...)
   - MoSCoW prioritization based on insights (Must: ${mustHave.filter(i => i.category === 'requirement').length}, Should: ${shouldHave.filter(i => i.category === 'requirement').length}, Could: ${couldHave.filter(i => i.category === 'requirement').length})
   - User stories: "As a [role], I want [feature] so that [benefit]"
   - Acceptance criteria (Given/When/Then format)
   - Dependencies between requirements
   - Testability considerations

5. "Non-Functional Requirements"
   Structure with these mandatory subsections:
   
   ### Performance Requirements
   - Response time SLAs (P95, P99 percentiles)
   - Throughput capacity (transactions/sec, concurrent users)
   - Resource utilization thresholds
   
   ### Security Requirements
   - Authentication (OAuth2.0, SSO, MFA requirements)
   - Authorization model (RBAC, ABAC)
   - Data encryption (AES-256 at rest, TLS 1.3 in transit)
   - Compliance frameworks (GDPR, SOC2, HIPAA, PCI-DSS as applicable)
   - Security audit and logging requirements
   - Vulnerability management
   
   ### Scalability Requirements
   - Horizontal/vertical scaling strategy
   - Auto-scaling triggers and thresholds
   - Data partitioning/sharding needs
   - Geographic distribution requirements
   
   ### Reliability & Availability
   - SLA targets (99.9%, 99.95%, 99.99%)
   - RTO (Recovery Time Objective)
   - RPO (Recovery Point Objective)
   - Disaster recovery strategy
   - Business continuity requirements
   
   ### Usability Requirements
   - WCAG 2.1 AA accessibility compliance
   - Supported platforms/browsers
   - Internationalization (i18n) requirements
   - UX performance benchmarks
   
   ### Maintainability Requirements
   - Code quality standards and tooling
   - Documentation requirements
   - API versioning strategy
   - Technical debt management approach

6. "Assumptions & Constraints"
   - Technical assumptions with validation approach
   - Business assumptions with risk if incorrect
   - Resource constraints (budget, personnel, timeline)
   - Technical constraints (legacy systems, technology stack)
   - Regulatory/compliance constraints
   - Explicitly out-of-scope items

7. "Dependencies & Integrations"
   - Internal system dependencies (with API/data contracts)
   - External third-party integrations
   - Data flow diagrams (describe in text)
   - Integration SLAs and fallback strategies
   - Team dependencies and coordination points

8. "Success Metrics & KPIs"
   - Quantitative metrics with specific targets
   - Baseline measurements where applicable
   - Measurement methodology and frequency
   - Dashboard/reporting requirements
   - Business outcome metrics vs. technical metrics

9. "Timeline & Milestones"
   - Phase breakdown with deliverables
   - Key milestones and decision gates
   - Critical path identification
   - Risk buffer allocation (recommend 15-20%)
   - Go/No-Go criteria per phase
   ${timelines.length > 0 ? `\n   Reference timeline insights: ${timelines.map(t => t.summary).join('; ')}` : ''}

═══════════════════════════════════════════════════════════════════════════════
OUTPUT FORMAT
═══════════════════════════════════════════════════════════════════════════════

For EACH section provide:
- title: Exact section title from above
- content: Professional Markdown with:
  • Clear hierarchy (## for subsections, ### for sub-subsections)
  • Bullet points for lists
  • Tables where appropriate (stakeholder matrix, requirement tables)
  • Specific, actionable language (avoid vague statements)
  • Reference specific insights where relevant
  • Flag areas with low confidence or conflicts needing resolution
- sources: Array of source names that informed this section
- confidence: Score 0-100 based on:
  • Insight coverage and quality
  • Presence of conflicts (reduce confidence)
  • Specificity of available information

Return JSON array of exactly 9 section objects. Be comprehensive yet concise - a production-ready BRD.
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
You are a Senior Business Analyst with expertise in requirements engineering. Refine the following Business Requirements Document (BRD) based on the user's instruction.

═══════════════════════════════════════════════════════════════════════════════
CURRENT BRD CONTENT
═══════════════════════════════════════════════════════════════════════════════
${currentBRD.sections.map(s => `### ${s.title} (Confidence: ${s.confidence || 'N/A'}%)\n${s.content}\nSources: ${s.sources?.join(', ') || 'None'}`).join('\n\n---\n\n')}

═══════════════════════════════════════════════════════════════════════════════
USER REFINEMENT REQUEST
═══════════════════════════════════════════════════════════════════════════════
"${instruction}"

═══════════════════════════════════════════════════════════════════════════════
REFINEMENT GUIDELINES
═══════════════════════════════════════════════════════════════════════════════
1. Understand the user's intent:
   - Are they asking to ADD new content?
   - Are they asking to MODIFY existing content?
   - Are they asking to REMOVE something?
   - Are they asking for MORE DETAIL in a section?
   - Are they changing TONE or FORMALITY?

2. Apply changes intelligently:
   - Maintain IEEE 830/BABOK compliance
   - Keep consistent formatting and style
   - Preserve section structure unless explicitly asked to change
   - Update confidence scores if you're making assumptions
   - Add [REFINED] markers to significantly changed sections

3. Quality standards:
   - Use specific, measurable language
   - Include rationale for major changes
   - Flag any areas that may need stakeholder review
   - Maintain traceability to original sources where applicable

Return the COMPLETE updated BRD with all 9 sections (even if only some were modified).

For each section:
- title: The section title (keep original titles)
- content: Updated Markdown content
- sources: Preserved or updated source array
- confidence: Adjusted confidence (0-100) - may decrease if adding speculative content
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
  
  // Format insights with priority and confidence
  const formatInsight = (i: Insight) => {
    const priority = i.priority && i.priority !== 'unset' ? `[${i.priority.toUpperCase()}]` : '';
    const confidence = i.confidenceScore ? `(${i.confidenceScore}%)` : '';
    return `- ${priority} ${i.summary}: ${i.detail} (Source: ${i.source}) ${confidence}`;
  };
  
  const prompt = `
You are a Senior Business Analyst reviewing a targeted edit request for a Business Requirements Document.

═══════════════════════════════════════════════════════════════════════════════
CURRENT BRD STRUCTURE
═══════════════════════════════════════════════════════════════════════════════
${currentBRD.sections.map(s => `### ${s.title}\n${s.content.slice(0, 500)}${s.content.length > 500 ? '...' : ''}`).join('\n\n')}

═══════════════════════════════════════════════════════════════════════════════
USER EDIT REQUEST
═══════════════════════════════════════════════════════════════════════════════
"${instruction}"

═══════════════════════════════════════════════════════════════════════════════
AVAILABLE INSIGHTS FOR REFERENCE
═══════════════════════════════════════════════════════════════════════════════
${approvedInsights.length > 0 ? approvedInsights.map(formatInsight).join('\n') : 'No approved insights available.'}

═══════════════════════════════════════════════════════════════════════════════
ANALYSIS TASK
═══════════════════════════════════════════════════════════════════════════════
1. Analyze the edit request to understand:
   - Scope of changes (which sections affected)
   - Type of change (add/modify/remove/clarify)
   - Relationship to existing insights

2. For ONLY the affected sections, provide:
   - Updated content meeting IEEE 830/BABOK standards
   - Clear reasoning for each change
   - References to insights used (if any)

3. Impact assessment:
   - Consider downstream effects on other sections
   - Maintain cross-section consistency
   - Flag if changes require stakeholder review

Return JSON with:
- affectedSectionTitles: Array of section titles that need updating
- updatedSections: Array of {title, content (full Markdown), reasoning (1-2 sentences), referencedInsights (insight summaries used)}
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

  // Use deduplication to prevent concurrent identical requests
  return deduplicateRequest(cacheKey, async () => {
    // OPTIMIZED: Compact prompt format for faster processing
    const compactInsights = approvedInsights.map((i, idx) => 
      `[${idx + 1}] ${i.category}|${i.source}|${i.summary.slice(0, 80)}|${i.detail.slice(0, 120)}`
    ).join('\n');

    const prompt = `Detect conflicts in these requirements (format: [idx] category|source|summary|detail):

${compactInsights}

Return conflicts array with: type(contradiction/ambiguity/overlap/dependency), severity(critical/major/minor), insight1Index, insight2Index, description(brief), suggestedResolution, affectedBRDSections[]. Return [] if none.`;

    try {
      trackAPICall();
      const response = await ai.models.generateContent({
        model: modelId,
        contents: prompt,
        config: {
          ...FAST_CONFIG,
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
  });
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
  // Evidence quotes for drill-down
  evidenceQuotes?: { text: string; source: string; sentiment: 'positive' | 'negative' | 'neutral' }[];
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
  // IMPROVED: Better cache key using content hash
  const contentHash = insights.map(i => `${i.id}:${i.summary.slice(0,20)}`).join(',').slice(0, 200);
  const sourceHash = sources.map(s => s.name).join(',').slice(0, 100);
  const cacheKey = getCacheKey('sentiment', contentHash, sourceHash, insights.length, Date.now().toString().slice(0, -5));
  const cached = getFromCache<SentimentReport>(cacheKey);
  if (cached) return cached;

  // Use deduplication
  return deduplicateRequest(cacheKey, async () => {
    // IMPROVED: Process ALL insights, not just first 30
    const compactInsights = insights.map(i => 
      `${i.source}|${i.category}|${i.summary}`
    ).join('\n');

    // IMPROVED: Process more source content (up to 8000 chars total instead of 2000)
    const sourceSnippets = sources.map(s => 
      s.content?.slice(0, 2000) || ''
    ).filter(Boolean).join('\n---\n');

    const prompt = `Analyze stakeholder sentiment from these project insights and sources. Extract evidence quotes that support your analysis.

INSIGHTS (source|category|summary):
${compactInsights}

SOURCES:
${sourceSnippets.slice(0, 8000)}

Return JSON: overallProjectSentiment, averageSentimentScore(-100 to +100), stakeholders[](stakeholder, role, overallSentiment, sentimentScore, concerns[], supportedItems[], engagementLevel, recentTrend, evidenceQuotes[](text, source, sentiment)), topConcerns[](concern, frequency, stakeholders[]), positiveHighlights[], riskAreas[].

For evidenceQuotes, include actual quotes or paraphrased evidence from the sources that support your sentiment analysis for each stakeholder.`;

    try {
      trackAPICall();
      const response = await ai.models.generateContent({
        model: modelId,
        contents: prompt,
        config: {
          ...FAST_CONFIG,
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
                    recentTrend: { type: Type.STRING, enum: ['improving', 'stable', 'declining'] },
                    evidenceQuotes: {
                      type: Type.ARRAY,
                      items: {
                        type: Type.OBJECT,
                        properties: {
                          text: { type: Type.STRING },
                          source: { type: Type.STRING },
                          sentiment: { type: Type.STRING, enum: ['positive', 'negative', 'neutral'] }
                        },
                        required: ['text', 'source', 'sentiment']
                      }
                    }
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
  });
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
  // Improved cache key with more specificity
  const conflictCount = conflicts?.length || 0;
  const cacheKey = getCacheKey('statusReport', project.name, insights.length, brdSections?.length || 0, conflictCount);
  const cached = getFromCache<StatusReport>(cacheKey);
  if (cached) return cached;

  // Use deduplication
  return deduplicateRequest(cacheKey, async () => {
    const approvedInsights = insights.filter(i => i.status === 'approved');
    const pendingInsights = insights.filter(i => i.status === 'pending');
    const flaggedInsights = insights.filter(i => i.status === 'flagged');
    const avgConfidence = brdSections ? Math.round(brdSections.reduce((a, b) => a + b.confidence, 0) / brdSections.length) : 0;

    // OPTIMIZED: Compact prompt
    const prompt = `Generate status report for executive stakeholders.

PROJECT: ${project.name} | Status: ${project.status}
Goals: ${(project.goals || 'TBD').slice(0, 100)} | Timeline: ${project.timeline || 'TBD'}
Insights: ${approvedInsights.length} approved, ${pendingInsights.length} pending, ${flaggedInsights.length} flagged
BRD: ${brdSections ? `${brdSections.length} sections, ${avgConfidence}% confidence` : 'Not generated'}
Conflicts: ${conflictCount}${conflicts?.slice(0, 3).map(c => ` [${c.severity}]`).join('') || ''}

Return JSON: executiveSummary, progressMetrics[](label,current,target,status), keyAccomplishments[], activeRisks[](risk,severity,mitigation), upcomingMilestones[](milestone,dueDate,status), stakeholderUpdates[], actionItems[](item,owner,dueDate,priority), recommendations[], nextSteps[].`;

    try {
      trackAPICall();
      const response = await ai.models.generateContent({
        model: modelId,
        contents: prompt,
        config: {
          ...FAST_CONFIG,
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
  });
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

// AI-enhanced traceability with dependencies and test criteria
export const enhanceTraceabilityMatrix = async (
  insights: Insight[]
): Promise<{ 
  dependencies: Record<string, string[]>; 
  testCriteria: Record<string, string>;
  stakeholders: Record<string, { name: string; role: string; confidence: number }[]>;
}> => {
  const requirements = insights.filter(i => i.category === 'requirement' && (i.status === 'approved' || i.status === 'pending'));
  if (requirements.length === 0) return { dependencies: {}, testCriteria: {}, stakeholders: {} };

  const cacheKey = getCacheKey('enhanceMatrixV2', requirements.map(r => r.id).sort().join(','));
  const cached = getFromCache<{ 
    dependencies: Record<string, string[]>; 
    testCriteria: Record<string, string>;
    stakeholders: Record<string, { name: string; role: string; confidence: number }[]>;
  }>(cacheKey);
  if (cached) return cached;

  return deduplicateRequest(cacheKey, async () => {
    const compactReqs = requirements.map((r, idx) => 
      `[${idx + 1}] ${r.summary.slice(0, 80)}|${r.detail?.slice(0, 100) || ''}`
    ).join('\n');

    const prompt = `Analyze these requirements for dependencies, test criteria, and stakeholders.

Requirements (format: [idx] summary|detail):
${compactReqs}

For EACH requirement, analyze:
1. Dependencies: Which OTHER requirements (by index) must this depend on? (empty if none)
2. Test Criteria: A specific, measurable acceptance test (Given/When/Then format, 1-2 sentences)
3. Stakeholders: Who is affected? Extract names/roles from the requirement text with confidence scores.

Return JSON: { requirements: [{ index, dependencies[], testCriteria, stakeholders[{name, role, confidence}] }] }`;

    try {
      trackAPICall();
      const response = await ai.models.generateContent({
        model: modelId,
        contents: prompt,
        config: {
          ...QUICK_CONFIG,
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              requirements: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    index: { type: Type.INTEGER },
                    dependencies: { type: Type.ARRAY, items: { type: Type.INTEGER } },
                    testCriteria: { type: Type.STRING },
                    stakeholders: {
                      type: Type.ARRAY,
                      items: {
                        type: Type.OBJECT,
                        properties: {
                          name: { type: Type.STRING },
                          role: { type: Type.STRING },
                          confidence: { type: Type.INTEGER }
                        },
                        required: ['name', 'role', 'confidence']
                      }
                    }
                  },
                  required: ['index', 'dependencies', 'testCriteria', 'stakeholders']
                }
              }
            },
            required: ['requirements']
          }
        }
      });

      const text = response.text;
      if (!text) throw new Error("No response");
      
      const result = JSON.parse(text);
      const deps: Record<string, string[]> = {};
      const tests: Record<string, string> = {};
      const stakeholders: Record<string, { name: string; role: string; confidence: number }[]> = {};
      
      result.requirements.forEach((r: any) => {
        const reqId = requirements[r.index - 1]?.id;
        if (reqId) {
          deps[reqId] = r.dependencies.map((d: number) => requirements[d - 1]?.id).filter(Boolean);
          tests[reqId] = r.testCriteria;
          stakeholders[reqId] = r.stakeholders || [];
        }
      });

      const finalResult = { dependencies: deps, testCriteria: tests, stakeholders };
      setCache(cacheKey, finalResult);
      return finalResult;
    } catch (error) {
      console.error("Matrix Enhancement Failed:", error);
      return { dependencies: {}, testCriteria: {}, stakeholders: {} };
    }
  });
};

// Generate dependency graph data
export const generateDependencyGraph = async (
  insights: Insight[],
  enhancedData: { dependencies: Record<string, string[]> }
): Promise<{
  nodes: { id: string; label: string; category: string; level: number }[];
  edges: { source: string; target: string; type: string }[];
}> => {
  const requirements = insights.filter(i => i.category === 'requirement' && (i.status === 'approved' || i.status === 'pending'));
  
  // Build nodes
  const nodes = requirements.map((r, idx) => ({
    id: r.id,
    label: `REQ-${String(idx + 1).padStart(3, '0')}`,
    category: r.category,
    level: 0 // Will be calculated
  }));
  
  // Build edges from dependencies
  const edges: { source: string; target: string; type: string }[] = [];
  Object.entries(enhancedData.dependencies).forEach(([reqId, deps]) => {
    deps.forEach(depId => {
      edges.push({ source: depId, target: reqId, type: 'depends_on' });
    });
  });
  
  // Calculate levels (topological sort)
  const inDegree: Record<string, number> = {};
  nodes.forEach(n => inDegree[n.id] = 0);
  edges.forEach(e => {
    if (inDegree[e.target] !== undefined) {
      inDegree[e.target]++;
    }
  });
  
  // BFS to assign levels
  const queue = nodes.filter(n => inDegree[n.id] === 0).map(n => n.id);
  const levels: Record<string, number> = {};
  queue.forEach(id => levels[id] = 0);
  
  while (queue.length > 0) {
    const current = queue.shift()!;
    const currentLevel = levels[current] || 0;
    
    edges.filter(e => e.source === current).forEach(e => {
      const nextLevel = currentLevel + 1;
      if (levels[e.target] === undefined || levels[e.target] < nextLevel) {
        levels[e.target] = nextLevel;
      }
      inDegree[e.target]--;
      if (inDegree[e.target] === 0) {
        queue.push(e.target);
      }
    });
  }
  
  // Apply levels to nodes
  nodes.forEach(n => {
    n.level = levels[n.id] || 0;
  });
  
  return { nodes, edges };
};

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

// ============================================================================
// ENTERPRISE BRD GENERATION - Advanced Templates & Customization
// ============================================================================

export type BRDTemplate = 'enterprise' | 'agile' | 'waterfall' | 'lean';
export type BRDAudience = 'executive' | 'technical' | 'stakeholder' | 'compliance';
export type BRDTone = 'formal' | 'concise' | 'detailed' | 'technical';

interface BRDGenerationOptions {
  template: BRDTemplate;
  audience: BRDAudience;
  tone: BRDTone;
}

interface GenerationProgress {
  current: number;
  total: number;
  section: string;
}

const TEMPLATE_SECTIONS: Record<BRDTemplate, string[]> = {
  enterprise: [
    'Executive Summary',
    'Business Objectives', 
    'Stakeholder Analysis',
    'Functional Requirements',
    'Non-Functional Requirements',
    'Assumptions & Constraints',
    'Dependencies & Integrations',
    'Success Metrics & KPIs',
    'Timeline & Milestones'
  ],
  agile: [
    'Product Vision',
    'User Personas',
    'Epic Overview',
    'User Stories & Acceptance Criteria',
    'Technical Considerations',
    'Definition of Done',
    'Sprint Planning Considerations',
    'Success Metrics'
  ],
  waterfall: [
    'Project Overview',
    'Business Requirements',
    'Functional Specifications',
    'Technical Specifications',
    'System Design Overview',
    'Testing Strategy',
    'Implementation Plan',
    'Training & Documentation',
    'Maintenance Plan'
  ],
  lean: [
    'Problem Statement',
    'Solution Hypothesis',
    'MVP Scope',
    'Key Features',
    'Success Criteria',
    'Risks & Assumptions',
    'Next Steps'
  ]
};

const AUDIENCE_GUIDANCE: Record<BRDAudience, string> = {
  executive: `
    - Focus on business value, ROI, and strategic alignment
    - Use high-level summaries with key metrics
    - Minimize technical jargon
    - Emphasize risk mitigation and decision points
    - Include cost-benefit analysis where applicable`,
  technical: `
    - Include detailed technical specifications
    - Use precise technical terminology
    - Provide architecture considerations
    - Include integration details and API specifications
    - Reference industry standards and best practices`,
  stakeholder: `
    - Balance business and technical information
    - Focus on features and benefits
    - Clear acceptance criteria
    - Include user journey considerations
    - Highlight dependencies and timelines`,
  compliance: `
    - Emphasize regulatory requirements
    - Include audit trail considerations
    - Detail security and privacy requirements
    - Reference compliance frameworks (GDPR, SOC2, HIPAA, etc.)
    - Include risk assessment and mitigation`
};

const TONE_GUIDANCE: Record<BRDTone, string> = {
  formal: 'Use professional business language, third person, passive voice where appropriate. Maintain a corporate tone.',
  concise: 'Be brief and to the point. Use bullet points extensively. Avoid redundancy. Each sentence should add value.',
  detailed: 'Provide comprehensive explanations. Include examples and rationale. Cover edge cases and considerations.',
  technical: 'Use precise technical terminology. Include specifications, measurements, and technical requirements.'
};

export const generateBRDAdvanced = async (
  project: { name: string; description?: string; goals?: string },
  insights: Insight[],
  options: BRDGenerationOptions,
  onProgress?: (progress: GenerationProgress) => void
): Promise<Omit<BRDSection, 'id'>[]> => {
  const { template, audience, tone } = options;
  const sections = TEMPLATE_SECTIONS[template];
  const approvedInsights = insights.filter(i => i.status === 'approved');
  
  // Categorize insights
  const requirements = approvedInsights.filter(i => i.category === 'requirement');
  const decisions = approvedInsights.filter(i => i.category === 'decision');
  const stakeholders = approvedInsights.filter(i => i.category === 'stakeholder');
  const timelines = approvedInsights.filter(i => i.category === 'timeline');
  const questions = approvedInsights.filter(i => i.category === 'question');
  
  // Extract unique sources
  const allSources = [...new Set(approvedInsights.map(i => i.source))];
  
  // Calculate average confidence
  const avgConfidence = approvedInsights.length > 0 
    ? Math.round(approvedInsights.reduce((sum, i) => sum + (i.confidenceScore || 50), 0) / approvedInsights.length)
    : 50;

  const prompt = `
You are a world-class Business Analyst creating an enterprise-grade BRD. Generate a ${template.toUpperCase()} template BRD optimized for a ${audience.toUpperCase()} audience.

═══════════════════════════════════════════════════════════════════════════════
PROJECT CONTEXT
═══════════════════════════════════════════════════════════════════════════════
Project Name: ${project.name}
Description: ${project.description || "Enterprise software project"}
Goals: ${project.goals || "Digital transformation and process optimization"}

═══════════════════════════════════════════════════════════════════════════════
INSIGHTS SUMMARY
═══════════════════════════════════════════════════════════════════════════════
Total Approved: ${approvedInsights.length}
Average Confidence: ${avgConfidence}%
Sources: ${allSources.slice(0, 10).join(', ')}

By Category:
- Requirements: ${requirements.length}
- Decisions: ${decisions.length}
- Stakeholders: ${stakeholders.length}
- Timelines: ${timelines.length}
- Questions: ${questions.length}

Key Insights:
${approvedInsights.slice(0, 20).map(i => `- [${i.category.toUpperCase()}] ${i.summary} (${i.confidence} confidence, Source: ${i.source})`).join('\n')}

═══════════════════════════════════════════════════════════════════════════════
TEMPLATE: ${template.toUpperCase()}
═══════════════════════════════════════════════════════════════════════════════
Generate exactly these ${sections.length} sections:
${sections.map((s, i) => `${i + 1}. "${s}"`).join('\n')}

═══════════════════════════════════════════════════════════════════════════════
AUDIENCE OPTIMIZATION: ${audience.toUpperCase()}
═══════════════════════════════════════════════════════════════════════════════
${AUDIENCE_GUIDANCE[audience]}

═══════════════════════════════════════════════════════════════════════════════
TONE: ${tone.toUpperCase()}
═══════════════════════════════════════════════════════════════════════════════
${TONE_GUIDANCE[tone]}

═══════════════════════════════════════════════════════════════════════════════
OUTPUT REQUIREMENTS
═══════════════════════════════════════════════════════════════════════════════
For EACH section provide:
- title: Exact section title
- content: Rich Markdown content with proper headings, bullet points, and tables where appropriate
- sources: Array of source names that informed this section
- confidence: 0-100 score based on insight coverage

Additional Requirements:
- Cross-reference insights throughout
- Mark areas with low confidence or gaps
- Use ${tone} tone consistently
- Optimize for ${audience} audience
- Follow ${template} methodology best practices

Return JSON array of ${sections.length} section objects.
`;

  try {
    onProgress?.({ current: 1, total: sections.length, section: 'Initializing AI generation...' });
    
    trackAPICall();
    const response = await ai.models.generateContent({
      model: modelId,
      contents: prompt,
      config: {
        ...FAST_CONFIG,
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
    
    // Simulate progress through sections
    for (let i = 0; i < result.length; i++) {
      onProgress?.({ current: i + 1, total: result.length, section: `Generated: ${result[i].title}` });
      await new Promise(resolve => setTimeout(resolve, 100)); // Small delay for visual effect
    }
    
    return result;
  } catch (error) {
    console.error("Advanced BRD Generation Failed:", error);
    throw error;
  }
};

export const refineBRDSection = async (
  section: BRDSection,
  instruction: string,
  insights: Insight[],
  options: { audience: BRDAudience; tone: BRDTone }
): Promise<{ content: string; confidence: number }> => {
  const approvedInsights = insights.filter(i => i.status === 'approved');
  
  const prompt = `
You are a Senior Business Analyst refining a specific BRD section.

═══════════════════════════════════════════════════════════════════════════════
CURRENT SECTION
═══════════════════════════════════════════════════════════════════════════════
Title: ${section.title}
Current Content:
${section.content}

Current Confidence: ${section.confidence}%
Current Sources: ${section.sources.join(', ')}

═══════════════════════════════════════════════════════════════════════════════
AVAILABLE INSIGHTS
═══════════════════════════════════════════════════════════════════════════════
${approvedInsights.slice(0, 15).map(i => `- [${i.category}] ${i.summary}: ${i.detail}`).join('\n')}

═══════════════════════════════════════════════════════════════════════════════
REFINEMENT INSTRUCTION
═══════════════════════════════════════════════════════════════════════════════
"${instruction}"

═══════════════════════════════════════════════════════════════════════════════
REQUIREMENTS
═══════════════════════════════════════════════════════════════════════════════
- Audience: ${options.audience}
- Tone: ${options.tone}
- Maintain the same section title
- Apply the refinement instruction
- Reference relevant insights
- Output only the refined content, formatted in Markdown

Return JSON with 'content' (string) and 'confidence' (integer 0-100).
`;

  try {
    trackAPICall();
    const response = await ai.models.generateContent({
      model: modelId,
      contents: prompt,
      config: {
        ...FAST_CONFIG, // Use FAST_CONFIG with higher token limit to avoid truncation
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            content: { type: Type.STRING },
            confidence: { type: Type.INTEGER }
          },
          required: ['content', 'confidence']
        }
      }
    });

    const text = response.text;
    if (!text) throw new Error("No response from AI");
    
    // Robust JSON parsing with fallback
    try {
      return JSON.parse(text);
    } catch (parseError) {
      console.warn("JSON parse failed, attempting to repair:", parseError);
      
      // Try to extract JSON from response if it has extra text
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
          return JSON.parse(jsonMatch[0]);
        } catch {
          // Ignore secondary parse error
        }
      }
      
      // Fallback: return original content with maintenance confidence
      console.warn("Using fallback response for section refinement");
      return {
        content: section.content,
        confidence: Math.max(section.confidence - 5, 30)
      };
    }
  } catch (error) {
    console.error("Section Refinement Failed:", error);
    throw error;
  }
};

export interface GapAnalysisItem {
  area: string;
  severity: 'critical' | 'major' | 'minor';
  description: string;
  recommendation: string;
  affectedSections: string[];
}

export const analyzeGaps = async (
  sections: BRDSection[],
  insights: Insight[],
  template: BRDTemplate
): Promise<GapAnalysisItem[]> => {
  const approvedInsights = insights.filter(i => i.status === 'approved');
  const expectedSections = TEMPLATE_SECTIONS[template];
  
  const prompt = `
You are a BRD Quality Auditor performing gap analysis on a Business Requirements Document.

═══════════════════════════════════════════════════════════════════════════════
BRD CONTENT SUMMARY
═══════════════════════════════════════════════════════════════════════════════
Template: ${template}
Sections Present: ${sections.length}
Expected Sections: ${expectedSections.length}

Sections Overview:
${sections.map(s => `- ${s.title} (${s.confidence}% confidence, ${s.sources.length} sources)`).join('\n')}

Low Confidence Sections (< 60%):
${sections.filter(s => s.confidence < 60).map(s => `- ${s.title}: ${s.confidence}%`).join('\n') || 'None'}

═══════════════════════════════════════════════════════════════════════════════
INSIGHT COVERAGE
═══════════════════════════════════════════════════════════════════════════════
Total Approved Insights: ${approvedInsights.length}

By Category:
- Requirements: ${approvedInsights.filter(i => i.category === 'requirement').length}
- Decisions: ${approvedInsights.filter(i => i.category === 'decision').length}
- Stakeholders: ${approvedInsights.filter(i => i.category === 'stakeholder').length}
- Timelines: ${approvedInsights.filter(i => i.category === 'timeline').length}
- Questions/Open Items: ${approvedInsights.filter(i => i.category === 'question').length}

Conflicting Insights: ${approvedInsights.filter(i => i.hasConflicts).length}

═══════════════════════════════════════════════════════════════════════════════
BRD BEST PRACTICES CHECKLIST
═══════════════════════════════════════════════════════════════════════════════
Check for these common gaps:
1. Missing or vague success criteria
2. Undefined stakeholder roles
3. No acceptance criteria for requirements
4. Missing security/compliance requirements
5. Unclear timelines or milestones
6. No risk/assumption documentation
7. Missing dependencies
8. Lack of testability criteria
9. No prioritization (MoSCoW)
10. Unresolved conflicts or open questions

═══════════════════════════════════════════════════════════════════════════════
ANALYSIS REQUIRED
═══════════════════════════════════════════════════════════════════════════════
Identify 3-7 gaps in this BRD with:
- area: The gap area name
- severity: 'critical' (blocks project), 'major' (significant risk), 'minor' (improvement opportunity)
- description: What is missing or problematic
- recommendation: Specific action to address the gap
- affectedSections: Array of section titles affected

Return JSON array of gap objects. If no significant gaps, return empty array.
`;

  try {
    trackAPICall();
    const response = await ai.models.generateContent({
      model: modelId,
      contents: prompt,
      config: {
        ...QUICK_CONFIG,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              area: { type: Type.STRING },
              severity: { type: Type.STRING, enum: ['critical', 'major', 'minor'] },
              description: { type: Type.STRING },
              recommendation: { type: Type.STRING },
              affectedSections: { type: Type.ARRAY, items: { type: Type.STRING } }
            },
            required: ['area', 'severity', 'description', 'recommendation', 'affectedSections']
          }
        }
      }
    });

    const text = response.text;
    if (!text) throw new Error("No response from AI");
    
    return JSON.parse(text);
  } catch (error) {
    console.error("Gap Analysis Failed:", error);
    return [];
  }
};
