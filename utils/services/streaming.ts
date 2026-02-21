// ============================================================================
// STREAMING AI SERVICE - Real-time streaming responses
// ============================================================================

import { GoogleGenAI, Type } from "@google/genai";
import { safeJsonParse } from './ai';

const ai = new GoogleGenAI({ apiKey: import.meta.env.VITE_GEMINI_API_KEY });
const modelId = "gemini-3-pro-preview";

// Streaming callback types
export type StreamCallback = (chunk: string, done: boolean) => void;
export type ProgressCallback = (progress: number, message: string) => void;

// ============================================================================
// STREAMING CONFLICT DETECTION
// ============================================================================

export interface StreamingConflict {
  type: 'contradiction' | 'ambiguity' | 'overlap' | 'dependency';
  severity: 'critical' | 'major' | 'minor';
  insight1Index: number;
  insight2Index: number;
  description: string;
  suggestedResolution: string;
}

export const streamConflictDetection = async (
  insights: { id: string; category: string; source: string; summary: string; detail: string }[],
  onConflict: (conflict: StreamingConflict, index: number) => void,
  onProgress: ProgressCallback,
  onComplete: () => void
): Promise<void> => {
  if (insights.length < 2) {
    onComplete();
    return;
  }

  onProgress(10, 'Preparing analysis...');

  // Batch insights for analysis (process in chunks for real-time feel)
  const batchSize = 10;
  const batches: (typeof insights)[] = [];
  for (let i = 0; i < insights.length; i += batchSize) {
    batches.push(insights.slice(i, i + batchSize));
  }

  let conflictIndex = 0;
  let totalProcessed = 0;

  for (let batchIdx = 0; batchIdx < batches.length; batchIdx++) {
    const batch = batches[batchIdx];
    const currentInsights = insights.slice(0, (batchIdx + 1) * batchSize);
    
    onProgress(
      20 + Math.round((batchIdx / batches.length) * 60),
      `Analyzing batch ${batchIdx + 1}/${batches.length}...`
    );

    const compactInsights = currentInsights.map((i, idx) => 
      `[${idx + 1}] ${i.category}|${i.source}|${i.summary.slice(0, 60)}`
    ).join('\n');

    const prompt = `Find conflicts in batch ${batchIdx + 1}:

${compactInsights}

Return ONLY new conflicts found in this batch. Array format: [{type,severity,insight1Index,insight2Index,description(brief),suggestedResolution}]. Return [] if none.`;

    try {
      const response = await ai.models.generateContent({
        model: modelId,
        contents: prompt,
        config: {
          temperature: 0.2,
          maxOutputTokens: 2048,
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
                suggestedResolution: { type: Type.STRING }
              },
              required: ['type', 'severity', 'insight1Index', 'insight2Index', 'description', 'suggestedResolution']
            }
          }
        }
      });

      const text = response.text;
      if (text) {
        const batchConflicts = safeJsonParse<StreamingConflict[]>(text, []);
        for (const conflict of batchConflicts) {
          onConflict(conflict, conflictIndex++);
        }
      }
    } catch (error) {
      console.error('Batch conflict detection error:', error);
    }

    totalProcessed += batch.length;
  }

  onProgress(100, 'Analysis complete');
  onComplete();
};

// ============================================================================
// STREAMING SENTIMENT ANALYSIS
// ============================================================================

export interface StreamingStakeholder {
  stakeholder: string;
  role?: string;
  sentiment: 'positive' | 'neutral' | 'negative' | 'mixed';
  score: number;
  concerns: string[];
  supports: string[];
  quotes: { text: string; source: string }[];
}

export const streamSentimentAnalysis = async (
  insights: { source: string; category: string; summary: string; detail: string }[],
  sources: { name: string; content?: string; type: string }[],
  onStakeholder: (stakeholder: StreamingStakeholder) => void,
  onProgress: ProgressCallback,
  onComplete: (summary: { overall: string; score: number }) => void
): Promise<void> => {
  onProgress(10, 'Identifying stakeholders...');

  // First pass: identify all stakeholders
  const stakeholderPrompt = `Identify unique stakeholders from these insights:

${insights.slice(0, 20).map(i => `${i.source}: ${i.summary}`).join('\n')}

Return JSON array of stakeholder names and roles: [{name, role}]`;

  try {
    const stakeholderResponse = await ai.models.generateContent({
      model: modelId,
      contents: stakeholderPrompt,
      config: {
        temperature: 0.2,
        maxOutputTokens: 1024,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              name: { type: Type.STRING },
              role: { type: Type.STRING }
            },
            required: ['name']
          }
        }
      }
    });

    const stakeholders = safeJsonParse<{ name: string; role?: string }[]>(stakeholderResponse.text || '[]', []);
    
    onProgress(30, `Found ${stakeholders.length} stakeholders, analyzing sentiment...`);

    // Analyze each stakeholder with quotes/evidence
    let overallScore = 0;
    for (let i = 0; i < stakeholders.length; i++) {
      const s = stakeholders[i];
      onProgress(
        30 + Math.round((i / stakeholders.length) * 60),
        `Analyzing ${s.name}...`
      );

      // Find relevant content for this stakeholder
      const relevantContent = sources
        .filter(src => src.content?.toLowerCase().includes(s.name.toLowerCase()))
        .map(src => ({ name: src.name, snippet: extractRelevantSnippet(src.content || '', s.name) }))
        .slice(0, 3);

      const sentimentPrompt = `Analyze sentiment for stakeholder "${s.name}" (${s.role || 'Unknown role'}):

Relevant content:
${relevantContent.map(r => `[${r.name}]: ${r.snippet}`).join('\n')}

Related insights:
${insights.filter(ins => ins.source.toLowerCase().includes(s.name.toLowerCase()) || ins.detail.toLowerCase().includes(s.name.toLowerCase())).slice(0, 5).map(ins => `- ${ins.summary}: ${ins.detail.slice(0, 100)}`).join('\n')}

Return JSON: {sentiment, score(-100 to 100), concerns[], supports[], quotes[{text,source}]}`;

      try {
        const sentimentResponse = await ai.models.generateContent({
          model: modelId,
          contents: sentimentPrompt,
          config: {
            temperature: 0.3,
            maxOutputTokens: 1024,
            responseMimeType: "application/json",
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                sentiment: { type: Type.STRING, enum: ['positive', 'neutral', 'negative', 'mixed'] },
                score: { type: Type.INTEGER },
                concerns: { type: Type.ARRAY, items: { type: Type.STRING } },
                supports: { type: Type.ARRAY, items: { type: Type.STRING } },
                quotes: { 
                  type: Type.ARRAY, 
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      text: { type: Type.STRING },
                      source: { type: Type.STRING }
                    },
                    required: ['text', 'source']
                  }
                }
              },
              required: ['sentiment', 'score', 'concerns', 'supports']
            }
          }
        });

        const result = safeJsonParse<any>(sentimentResponse.text || '{}', {});
        overallScore += result.score || 0;
        
        onStakeholder({
          stakeholder: s.name,
          role: s.role,
          sentiment: result.sentiment || 'neutral',
          score: result.score || 0,
          concerns: result.concerns || [],
          supports: result.supports || [],
          quotes: result.quotes || []
        });
      } catch (error) {
        console.error(`Sentiment analysis error for ${s.name}:`, error);
      }
    }

    const avgScore = stakeholders.length > 0 ? Math.round(overallScore / stakeholders.length) : 0;
    const overall = avgScore > 30 ? 'positive' : avgScore < -30 ? 'negative' : avgScore !== 0 ? 'mixed' : 'neutral';
    
    onProgress(100, 'Analysis complete');
    onComplete({ overall, score: avgScore });
  } catch (error) {
    console.error('Stakeholder identification error:', error);
    onComplete({ overall: 'neutral', score: 0 });
  }
};

// Helper to extract relevant snippet around a keyword
function extractRelevantSnippet(content: string, keyword: string, contextSize: number = 200): string {
  const lowerContent = content.toLowerCase();
  const lowerKeyword = keyword.toLowerCase();
  const idx = lowerContent.indexOf(lowerKeyword);
  
  if (idx === -1) return content.slice(0, contextSize * 2);
  
  const start = Math.max(0, idx - contextSize);
  const end = Math.min(content.length, idx + keyword.length + contextSize);
  
  return (start > 0 ? '...' : '') + content.slice(start, end) + (end < content.length ? '...' : '');
}

// ============================================================================
// STREAMING STATUS REPORT
// ============================================================================

export interface StreamingReportSection {
  section: string;
  content: any;
}

export const streamStatusReport = async (
  project: { name: string; goals?: string; timeline?: string; status: string },
  insights: { category: string; status: string; summary: string }[],
  onSection: (section: StreamingReportSection) => void,
  onProgress: ProgressCallback,
  onComplete: () => void,
  brdSections?: { title: string; confidence: number }[]
): Promise<void> => {
  const sections = [
    'executiveSummary',
    'progressMetrics',
    'keyAccomplishments',
    'activeRisks',
    'upcomingMilestones',
    'actionItems',
    'recommendations',
    'nextSteps'
  ];

  const approvedCount = insights.filter(i => i.status === 'approved').length;
  const pendingCount = insights.filter(i => i.status === 'pending').length;
  const avgConfidence = brdSections ? Math.round(brdSections.reduce((a, b) => a + b.confidence, 0) / brdSections.length) : 0;

  const context = `Project: ${project.name}
Status: ${project.status}
Goals: ${(project.goals || 'TBD').slice(0, 150)}
Timeline: ${project.timeline || 'TBD'}
Insights: ${approvedCount} approved, ${pendingCount} pending
BRD: ${brdSections ? `${brdSections.length} sections, ${avgConfidence}% confidence` : 'Not generated'}`;

  for (let i = 0; i < sections.length; i++) {
    const section = sections[i];
    onProgress(
      Math.round((i / sections.length) * 100),
      `Generating ${section.replace(/([A-Z])/g, ' $1').toLowerCase()}...`
    );

    const sectionPrompt = getSectionPrompt(section, context);
    
    try {
      const response = await ai.models.generateContent({
        model: modelId,
        contents: sectionPrompt,
        config: {
          temperature: 0.3,
          maxOutputTokens: 1024,
          responseMimeType: "application/json",
          responseSchema: getSectionSchema(section)
        }
      });

      const result = safeJsonParse<any>(response.text || '{}', {});
      onSection({ section, content: result });
    } catch (error) {
      console.error(`Error generating ${section}:`, error);
      onSection({ section, content: getDefaultSectionContent(section) });
    }
  }

  onProgress(100, 'Report complete');
  onComplete();
};

function getSectionPrompt(section: string, context: string): string {
  const prompts: Record<string, string> = {
    executiveSummary: `${context}\n\nWrite a 2-3 sentence executive summary. Return JSON: {summary: string}`,
    progressMetrics: `${context}\n\nGenerate 3 progress metrics. Return JSON: {metrics: [{label, current(0-100), target(100), status(on-track/at-risk/delayed)}]}`,
    keyAccomplishments: `${context}\n\nList 3-4 key accomplishments. Return JSON: {accomplishments: string[]}`,
    activeRisks: `${context}\n\nIdentify 2-3 risks. Return JSON: {risks: [{risk, severity(high/medium/low), mitigation}]}`,
    upcomingMilestones: `${context}\n\nList 3-4 milestones. Return JSON: {milestones: [{milestone, dueDate, status(pending/in-progress/completed)}]}`,
    actionItems: `${context}\n\nCreate 3-4 action items. Return JSON: {items: [{item, owner, dueDate, priority(high/medium/low)}]}`,
    recommendations: `${context}\n\nProvide 2-3 recommendations. Return JSON: {recommendations: string[]}`,
    nextSteps: `${context}\n\nList 3-4 next steps. Return JSON: {steps: string[]}`
  };
  return prompts[section] || context;
}

function getSectionSchema(section: string): any {
  const schemas: Record<string, any> = {
    executiveSummary: {
      type: Type.OBJECT,
      properties: { summary: { type: Type.STRING } },
      required: ['summary']
    },
    progressMetrics: {
      type: Type.OBJECT,
      properties: {
        metrics: {
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
        }
      },
      required: ['metrics']
    },
    keyAccomplishments: {
      type: Type.OBJECT,
      properties: { accomplishments: { type: Type.ARRAY, items: { type: Type.STRING } } },
      required: ['accomplishments']
    },
    activeRisks: {
      type: Type.OBJECT,
      properties: {
        risks: {
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
        }
      },
      required: ['risks']
    },
    upcomingMilestones: {
      type: Type.OBJECT,
      properties: {
        milestones: {
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
        }
      },
      required: ['milestones']
    },
    actionItems: {
      type: Type.OBJECT,
      properties: {
        items: {
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
        }
      },
      required: ['items']
    },
    recommendations: {
      type: Type.OBJECT,
      properties: { recommendations: { type: Type.ARRAY, items: { type: Type.STRING } } },
      required: ['recommendations']
    },
    nextSteps: {
      type: Type.OBJECT,
      properties: { steps: { type: Type.ARRAY, items: { type: Type.STRING } } },
      required: ['steps']
    }
  };
  return schemas[section] || { type: Type.OBJECT, properties: {} };
}

function getDefaultSectionContent(section: string): any {
  const defaults: Record<string, any> = {
    executiveSummary: { summary: 'Report generation in progress.' },
    progressMetrics: { metrics: [] },
    keyAccomplishments: { accomplishments: [] },
    activeRisks: { risks: [] },
    upcomingMilestones: { milestones: [] },
    actionItems: { items: [] },
    recommendations: { recommendations: [] },
    nextSteps: { steps: [] }
  };
  return defaults[section] || {};
}

// ============================================================================
// PRE-COMPUTATION SERVICE
// ============================================================================

export interface PrecomputedAnalysis {
  conflictCount: number;
  hasHighSeverityConflicts: boolean;
  stakeholderCount: number;
  overallSentiment: string;
  requirementCount: number;
  approvedCount: number;
  pendingCount: number;
  avgConfidence: number;
  lastUpdated: string;
}

export const precomputeAnalysis = async (
  insights: { id: string; category: string; status: string; confidence: string; summary: string; detail: string; source: string }[]
): Promise<PrecomputedAnalysis> => {
  const requirements = insights.filter(i => i.category === 'requirement');
  const approved = insights.filter(i => i.status === 'approved');
  const pending = insights.filter(i => i.status === 'pending');
  
  // Quick stakeholder extraction (no AI needed)
  const stakeholderKeywords = ['team', 'manager', 'user', 'admin', 'customer', 'client', 'developer', 'analyst', 'owner', 'lead', 'director', 'engineer'];
  const stakeholders = new Set<string>();
  insights.forEach(i => {
    const text = (i.summary + ' ' + i.detail + ' ' + i.source).toLowerCase();
    stakeholderKeywords.forEach(k => {
      if (text.includes(k)) stakeholders.add(k);
    });
  });

  // Quick sentiment estimation (no AI needed)
  const positiveWords = ['approved', 'success', 'complete', 'good', 'excellent', 'agreed', 'support'];
  const negativeWords = ['blocked', 'risk', 'issue', 'concern', 'delay', 'problem', 'failed'];
  let sentimentScore = 0;
  insights.forEach(i => {
    const text = (i.summary + ' ' + i.detail).toLowerCase();
    positiveWords.forEach(w => { if (text.includes(w)) sentimentScore++; });
    negativeWords.forEach(w => { if (text.includes(w)) sentimentScore--; });
  });
  
  const overallSentiment = sentimentScore > 2 ? 'positive' : sentimentScore < -2 ? 'negative' : 'neutral';

  // Quick conflict estimation (overlap detection)
  let potentialConflicts = 0;
  for (let i = 0; i < requirements.length; i++) {
    for (let j = i + 1; j < requirements.length; j++) {
      const sim = calculateSimilarity(requirements[i].summary, requirements[j].summary);
      if (sim > 0.6) potentialConflicts++;
    }
  }

  // Confidence calculation
  const confidenceMap = { high: 90, medium: 60, low: 30 };
  const avgConfidence = insights.length > 0
    ? Math.round(insights.reduce((sum, i) => sum + (confidenceMap[i.confidence as keyof typeof confidenceMap] || 50), 0) / insights.length)
    : 0;

  return {
    conflictCount: potentialConflicts,
    hasHighSeverityConflicts: potentialConflicts > 3,
    stakeholderCount: stakeholders.size,
    overallSentiment,
    requirementCount: requirements.length,
    approvedCount: approved.length,
    pendingCount: pending.length,
    avgConfidence,
    lastUpdated: new Date().toISOString()
  };
};

// Simple similarity calculation for quick conflict detection
function calculateSimilarity(str1: string, str2: string): number {
  const words1 = new Set(str1.toLowerCase().split(/\s+/));
  const words2 = new Set(str2.toLowerCase().split(/\s+/));
  const intersection = new Set([...words1].filter(x => words2.has(x)));
  const union = new Set([...words1, ...words2]);
  return intersection.size / union.size;
}
