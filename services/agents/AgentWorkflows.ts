/**
 * AgentWorkflows - Enterprise Autonomous Workflow Library
 * 
 * Pre-built workflows for common BRD agent tasks:
 * - Gap Analysis & Missing Information Detection
 * - Stakeholder Clarification Scheduling
 * - Conflict Resolution
 * - Requirements Validation
 * - Progress Monitoring
 * - Automated Reporting
 */

import { GoogleGenAI, Type } from '@google/genai';
import { 
  AgentCore, 
  AgentGoal, 
  AgentAction, 
  AgentActionResult,
  ActionExecutor,
  AgentCapability,
  AgentPriority,
  getAgentCore
} from './AgentCore';
import { ProjectState, Insight, Source, Task, BRDSection, updateProjectContext, addTask, updateTask } from '../../utils/db';

// ============================================================================
// WORKFLOW RESULT TYPES
// ============================================================================

export interface GapAnalysisResult {
  gaps: IdentifiedGap[];
  completenessScore: number;
  criticalMissing: string[];
  recommendations: GapRecommendation[];
  affectedSections: string[];
}

export interface IdentifiedGap {
  id: string;
  type: 'missing-requirement' | 'incomplete-detail' | 'missing-source' | 'unvalidated-assumption' | 'unclear-scope' | 'missing-stakeholder';
  severity: 'critical' | 'high' | 'medium' | 'low';
  title: string;
  description: string;
  affectedAreas: string[];
  suggestedActions: string[];
  confidence: number;
  sourceEvidence?: string;
}

export interface GapRecommendation {
  gapId: string;
  action: 'schedule-meeting' | 'request-document' | 'create-task' | 'send-query' | 'research';
  priority: AgentPriority;
  description: string;
  estimatedEffort: 'low' | 'medium' | 'high';
  stakeholders?: string[];
  deadline?: string;
}

export interface StakeholderClarification {
  id: string;
  stakeholderName: string;
  stakeholderRole?: string;
  stakeholderEmail?: string;
  questions: ClarificationQuestion[];
  priority: AgentPriority;
  status: 'pending' | 'scheduled' | 'completed' | 'skipped';
  scheduledDate?: string;
  meetingLink?: string;
  context: string;
  relatedInsights: string[];
  relatedGaps: string[];
}

export interface ClarificationQuestion {
  id: string;
  question: string;
  context: string;
  expectedAnswerType: 'yes-no' | 'choice' | 'open-ended' | 'numeric' | 'date';
  options?: string[];
  importance: 'critical' | 'important' | 'nice-to-have';
  answer?: string;
  answeredAt?: string;
}

export interface ValidationResult {
  isValid: boolean;
  score: number;
  issues: ValidationIssue[];
  passedChecks: string[];
  failedChecks: string[];
  suggestions: string[];
}

export interface ValidationIssue {
  type: 'ambiguity' | 'incompleteness' | 'inconsistency' | 'testability' | 'measurability' | 'feasibility';
  severity: 'error' | 'warning' | 'info';
  location: string;
  description: string;
  suggestion: string;
}

export interface ProgressReport {
  generatedAt: string;
  period: { start: string; end: string };
  summary: string;
  metrics: ProgressMetrics;
  highlights: string[];
  concerns: string[];
  nextSteps: string[];
  stakeholderUpdates: Record<string, string>;
}

export interface ProgressMetrics {
  insightsProcessed: { total: number; approved: number; rejected: number; pending: number };
  gapsIdentified: number;
  gapsResolved: number;
  clarificationsScheduled: number;
  clarificationsCompleted: number;
  brdCompleteness: number;
  confidenceScore: number;
  velocityTrend: 'improving' | 'stable' | 'declining';
}

// ============================================================================
// WORKFLOW EXECUTOR
// ============================================================================

export class BRDActionExecutor implements ActionExecutor {
  private ai: GoogleGenAI;
  private project: ProjectState;
  private onProjectUpdate: (project: ProjectState) => void;
  private modelId = 'gemini-2.5-flash';

  constructor(
    apiKey: string,
    project: ProjectState,
    onProjectUpdate: (project: ProjectState) => void
  ) {
    this.ai = new GoogleGenAI({ apiKey });
    this.project = project;
    this.onProjectUpdate = onProjectUpdate;
  }

  updateProject(project: ProjectState): void {
    this.project = project;
  }

  async execute(action: AgentAction): Promise<AgentActionResult> {
    const startTime = Date.now();
    let apiCallsMade = 0;
    let tokensUsed = 0;

    try {
      let data: unknown;

      switch (action.name) {
        case 'analyze-requirements-gaps':
          data = await this.analyzeRequirementsGaps(action.parameters);
          apiCallsMade = 1;
          break;

        case 'identify-missing-stakeholders':
          data = await this.identifyMissingStakeholders(action.parameters);
          apiCallsMade = 1;
          break;

        case 'generate-clarification-questions':
          data = await this.generateClarificationQuestions(action.parameters);
          apiCallsMade = 1;
          break;

        case 'schedule-stakeholder-meeting':
          data = await this.scheduleStakeholderMeeting(action.parameters);
          break;

        case 'create-follow-up-task':
          data = await this.createFollowUpTask(action.parameters);
          break;

        case 'draft-clarification-email':
          data = await this.draftClarificationEmail(action.parameters);
          apiCallsMade = 1;
          break;

        case 'validate-requirement':
          data = await this.validateRequirement(action.parameters);
          apiCallsMade = 1;
          break;

        case 'cross-reference-sources':
          data = await this.crossReferenceSources(action.parameters);
          apiCallsMade = 1;
          break;

        case 'analyze-insight-completeness':
          data = await this.analyzeInsightCompleteness(action.parameters);
          apiCallsMade = 1;
          break;

        case 'generate-progress-report':
          data = await this.generateProgressReport(action.parameters);
          apiCallsMade = 1;
          break;

        case 'escalate-blocker':
          data = await this.escalateBlocker(action.parameters);
          break;

        case 'read-project-data':
          data = this.readProjectData(action.parameters);
          break;

        default:
          throw new Error(`Unknown action: ${action.name}`);
      }

      return {
        success: true,
        data,
        metrics: {
          executionTimeMs: Date.now() - startTime,
          apiCallsMade,
          tokensUsed,
        },
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
        metrics: {
          executionTimeMs: Date.now() - startTime,
          apiCallsMade,
          tokensUsed,
        },
      };
    }
  }

  // ============================================================================
  // ACTION IMPLEMENTATIONS
  // ============================================================================

  private readProjectData(params: Record<string, unknown>): Record<string, unknown> {
    const dataType = params.type as string;
    
    switch (dataType) {
      case 'insights':
        return { insights: this.project.insights || [] };
      case 'sources':
        return { sources: this.project.sources || [] };
      case 'tasks':
        return { tasks: this.project.tasks || [] };
      case 'brd':
        return { brd: this.project.brd };
      case 'summary':
        return {
          name: this.project.name,
          goals: this.project.goals,
          insightCount: this.project.insights?.length || 0,
          sourceCount: this.project.sources?.length || 0,
          taskCount: this.project.tasks?.length || 0,
          brdSectionCount: this.project.brd?.sections?.length || 0,
        };
      default:
        return { project: this.project };
    }
  }

  private async analyzeRequirementsGaps(params: Record<string, unknown>): Promise<IdentifiedGap[]> {
    const insights = this.project.insights || [];
    const sources = this.project.sources || [];
    const brd = this.project.brd;

    const prompt = `
You are an expert Business Analyst performing gap analysis on a BRD project.

PROJECT: ${this.project.name}
GOALS: ${this.project.goals || 'Not specified'}

CURRENT INSIGHTS (${insights.length}):
${insights.slice(0, 50).map(i => `- [${i.category}] ${i.summary} (${i.status}, confidence: ${i.confidence}%)`).join('\n')}

SOURCES (${sources.length}):
${sources.map(s => `- ${s.name} (${s.type})`).join('\n')}

BRD SECTIONS (${brd?.sections?.length || 0}):
${brd?.sections?.map(s => `- ${s.title}`).join('\n') || 'No BRD generated yet'}

TASK: Identify ALL gaps and missing information. Look for:
1. Missing functional requirements
2. Missing non-functional requirements (security, performance, scalability)
3. Incomplete user stories or acceptance criteria
4. Missing stakeholder input
5. Unvalidated assumptions
6. Missing edge cases or error handling
7. Integration requirements
8. Data requirements
9. Compliance/regulatory requirements
10. Missing dependencies

For each gap, provide actionable suggestions.
    `.trim();

    const response = await this.ai.models.generateContent({
      model: this.modelId,
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              type: { type: Type.STRING, enum: ['missing-requirement', 'incomplete-detail', 'missing-source', 'unvalidated-assumption', 'unclear-scope', 'missing-stakeholder'] },
              severity: { type: Type.STRING, enum: ['critical', 'high', 'medium', 'low'] },
              title: { type: Type.STRING },
              description: { type: Type.STRING },
              affectedAreas: { type: Type.ARRAY, items: { type: Type.STRING } },
              suggestedActions: { type: Type.ARRAY, items: { type: Type.STRING } },
              confidence: { type: Type.INTEGER },
            },
            required: ['type', 'severity', 'title', 'description', 'confidence'],
          },
        },
      },
    });

    const gaps = JSON.parse(response.text || '[]');
    return gaps.map((g: any, i: number) => ({
      id: `gap_${Date.now()}_${i}`,
      ...g,
      affectedAreas: g.affectedAreas || [],
      suggestedActions: g.suggestedActions || [],
    }));
  }

  private async identifyMissingStakeholders(params: Record<string, unknown>): Promise<string[]> {
    const insights = this.project.insights || [];
    
    // Extract mentioned stakeholders from insights
    const mentionedStakeholders = new Set<string>();
    insights.forEach(i => {
      if (i.category === 'stakeholder') {
        mentionedStakeholders.add(i.summary);
      }
    });

    const prompt = `
Analyze this BRD project and identify potentially missing stakeholders.

PROJECT: ${this.project.name}
GOALS: ${this.project.goals || 'Not specified'}

CURRENTLY IDENTIFIED STAKEHOLDERS:
${Array.from(mentionedStakeholders).join('\n') || 'None identified yet'}

INSIGHTS SUMMARY:
${insights.slice(0, 30).map(i => `- ${i.summary}`).join('\n')}

Based on the project goals and requirements, identify stakeholders who should be consulted but haven't been mentioned yet.
Consider: end users, technical teams, compliance officers, executives, external partners, support teams, etc.

Return a JSON array of stakeholder roles/titles that are likely missing.
    `.trim();

    const response = await this.ai.models.generateContent({
      model: this.modelId,
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
        },
      },
    });

    return JSON.parse(response.text || '[]');
  }

  private async generateClarificationQuestions(params: Record<string, unknown>): Promise<ClarificationQuestion[]> {
    const gapIds = params.gapIds as string[] || [];
    const stakeholder = params.stakeholder as string || 'General';
    const context = params.context as string || '';

    const prompt = `
Generate specific clarification questions for stakeholder "${stakeholder}".

PROJECT: ${this.project.name}
GOALS: ${this.project.goals || 'Not specified'}
CONTEXT: ${context}

CURRENT GAPS/AMBIGUITIES TO ADDRESS:
${gapIds.length > 0 ? gapIds.join('\n') : 'General project clarification needed'}

RECENT OPEN QUESTIONS FROM INSIGHTS:
${this.project.insights?.filter(i => i.category === 'question').slice(0, 10).map(i => `- ${i.summary}`).join('\n') || 'None'}

Generate 3-7 targeted questions that would help clarify requirements.
Each question should:
1. Be specific and actionable
2. Include context so the stakeholder understands why we're asking
3. Specify what type of answer is expected

Prioritize questions that would unblock the most work.
    `.trim();

    const response = await this.ai.models.generateContent({
      model: this.modelId,
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              question: { type: Type.STRING },
              context: { type: Type.STRING },
              expectedAnswerType: { type: Type.STRING, enum: ['yes-no', 'choice', 'open-ended', 'numeric', 'date'] },
              options: { type: Type.ARRAY, items: { type: Type.STRING } },
              importance: { type: Type.STRING, enum: ['critical', 'important', 'nice-to-have'] },
            },
            required: ['question', 'context', 'expectedAnswerType', 'importance'],
          },
        },
      },
    });

    const questions = JSON.parse(response.text || '[]');
    return questions.map((q: any, i: number) => ({
      id: `question_${Date.now()}_${i}`,
      ...q,
      options: q.options || undefined,
    }));
  }

  private async scheduleStakeholderMeeting(params: Record<string, unknown>): Promise<StakeholderClarification> {
    const stakeholder = params.stakeholder as string;
    const questions = params.questions as ClarificationQuestion[] || [];
    const urgency = params.urgency as AgentPriority || 'medium';
    const relatedGaps = params.relatedGaps as string[] || [];
    const relatedInsights = params.relatedInsights as string[] || [];

    // Create a clarification record
    const clarification: StakeholderClarification = {
      id: `clarification_${Date.now()}`,
      stakeholderName: stakeholder,
      questions,
      priority: urgency,
      status: 'pending',
      context: `Clarification needed for: ${this.project.name}`,
      relatedInsights,
      relatedGaps,
    };

    // Create a task for the clarification
    const taskUrgency: Task['urgency'] = urgency === 'critical' ? 'high' : urgency;
    const task: Omit<Task, 'id'> = {
      title: `Schedule clarification with ${stakeholder}`,
      type: 'approval',
      urgency: taskUrgency,
      confidence: 85,
      source: 'AI Agent',
      status: 'pending',
      createdAt: new Date().toISOString(),
      description: `Questions to discuss:\n${questions.map((q, i) => `${i + 1}. ${q.question}`).join('\n')}`,
    };

    try {
      const updatedProject = await addTask(task);
      this.project = updatedProject;
      this.onProjectUpdate(updatedProject);
    } catch (error) {
      console.error('Failed to create task:', error);
    }

    return clarification;
  }

  private async createFollowUpTask(params: Record<string, unknown>): Promise<Task> {
    const title = params.title as string;
    const description = params.description as string;
    const type = (params.type as Task['type']) || 'missing';
    const urgency = (params.urgency as Task['urgency']) || 'medium';

    const task: Omit<Task, 'id'> = {
      title,
      type,
      urgency,
      confidence: 90,
      source: 'AI Agent',
      status: 'pending',
      createdAt: new Date().toISOString(),
      description,
    };

    const updatedProject = await addTask(task);
    this.project = updatedProject;
    this.onProjectUpdate(updatedProject);

    return { ...task, id: `task_${Date.now()}` };
  }

  private async draftClarificationEmail(params: Record<string, unknown>): Promise<{ subject: string; body: string }> {
    const stakeholder = params.stakeholder as string;
    const questions = params.questions as ClarificationQuestion[] || [];
    const tone = params.tone as 'formal' | 'casual' || 'formal';

    const prompt = `
Draft a ${tone} email to stakeholder "${stakeholder}" requesting clarification on project requirements.

PROJECT: ${this.project.name}
PURPOSE: Gather missing information to complete the BRD

QUESTIONS TO INCLUDE:
${questions.map((q, i) => `${i + 1}. ${q.question}\n   Context: ${q.context}\n   Importance: ${q.importance}`).join('\n\n')}

Write a professional email with:
1. Clear subject line
2. Brief introduction explaining why we need this information
3. Numbered questions with context
4. Clear call to action with timeline
5. Professional closing

Return JSON with "subject" and "body" fields.
    `.trim();

    const response = await this.ai.models.generateContent({
      model: this.modelId,
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            subject: { type: Type.STRING },
            body: { type: Type.STRING },
          },
          required: ['subject', 'body'],
        },
      },
    });

    return JSON.parse(response.text || '{"subject":"","body":""}');
  }

  private async validateRequirement(params: Record<string, unknown>): Promise<ValidationResult> {
    const insightId = params.insightId as string;
    const insight = this.project.insights?.find(i => i.id === insightId);

    if (!insight) {
      return {
        isValid: false,
        score: 0,
        issues: [{ type: 'incompleteness', severity: 'error', location: 'insight', description: 'Insight not found', suggestion: 'Verify insight exists' }],
        passedChecks: [],
        failedChecks: ['Insight exists'],
        suggestions: [],
      };
    }

    const prompt = `
Validate this requirement/insight against quality standards.

INSIGHT:
- Category: ${insight.category}
- Summary: ${insight.summary}
- Detail: ${insight.detail}
- Source: ${insight.source}
- Confidence: ${insight.confidence}%

VALIDATION CRITERIA:
1. CLEAR: Is it unambiguous and easy to understand?
2. COMPLETE: Does it have enough detail to implement?
3. CONSISTENT: Does it conflict with other known requirements?
4. TESTABLE: Can we verify when this is satisfied?
5. MEASURABLE: Are there quantifiable acceptance criteria?
6. FEASIBLE: Is it technically achievable?
7. TRACEABLE: Can we trace it back to a source?

Score each criterion and provide overall validation result.
    `.trim();

    const response = await this.ai.models.generateContent({
      model: this.modelId,
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            isValid: { type: Type.BOOLEAN },
            score: { type: Type.INTEGER },
            issues: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  type: { type: Type.STRING, enum: ['ambiguity', 'incompleteness', 'inconsistency', 'testability', 'measurability', 'feasibility'] },
                  severity: { type: Type.STRING, enum: ['error', 'warning', 'info'] },
                  description: { type: Type.STRING },
                  suggestion: { type: Type.STRING },
                },
              },
            },
            passedChecks: { type: Type.ARRAY, items: { type: Type.STRING } },
            failedChecks: { type: Type.ARRAY, items: { type: Type.STRING } },
            suggestions: { type: Type.ARRAY, items: { type: Type.STRING } },
          },
          required: ['isValid', 'score', 'issues', 'passedChecks', 'failedChecks'],
        },
      },
    });

    const result = JSON.parse(response.text || '{}');
    return {
      ...result,
      issues: (result.issues || []).map((issue: any) => ({
        ...issue,
        location: `insight:${insightId}`,
      })),
    };
  }

  private async crossReferenceSources(params: Record<string, unknown>): Promise<{ correlations: any[]; conflicts: any[] }> {
    const sources = this.project.sources || [];
    const insights = this.project.insights || [];

    const prompt = `
Cross-reference sources and insights to find correlations and conflicts.

SOURCES (${sources.length}):
${sources.slice(0, 20).map(s => `- ${s.name} (${s.type}): ${s.content?.slice(0, 200) || 'No content preview'}`).join('\n')}

INSIGHTS (${insights.length}):
${insights.slice(0, 30).map(i => `- [${i.id}] ${i.summary} (source: ${i.source})`).join('\n')}

Find:
1. CORRELATIONS: Insights that are confirmed by multiple sources
2. CONFLICTS: Insights that contradict each other or their sources

Return structured analysis.
    `.trim();

    const response = await this.ai.models.generateContent({
      model: this.modelId,
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            correlations: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  insightIds: { type: Type.ARRAY, items: { type: Type.STRING } },
                  sourceIds: { type: Type.ARRAY, items: { type: Type.STRING } },
                  description: { type: Type.STRING },
                  strengthScore: { type: Type.INTEGER },
                },
              },
            },
            conflicts: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  insightIds: { type: Type.ARRAY, items: { type: Type.STRING } },
                  description: { type: Type.STRING },
                  severity: { type: Type.STRING, enum: ['critical', 'major', 'minor'] },
                  resolution: { type: Type.STRING },
                },
              },
            },
          },
          required: ['correlations', 'conflicts'],
        },
      },
    });

    return JSON.parse(response.text || '{"correlations":[],"conflicts":[]}');
  }

  private async analyzeInsightCompleteness(params: Record<string, unknown>): Promise<{ score: number; missingElements: string[]; suggestions: string[] }> {
    const insightId = params.insightId as string;
    const insight = this.project.insights?.find(i => i.id === insightId);

    if (!insight) {
      return { score: 0, missingElements: ['Insight not found'], suggestions: [] };
    }

    const prompt = `
Analyze the completeness of this insight.

INSIGHT:
- Category: ${insight.category}
- Summary: ${insight.summary}
- Detail: ${insight.detail}
- Source: ${insight.source}
- Confidence: ${insight.confidence}%

For a requirement to be complete, it should have:
- Clear description of WHAT is needed
- WHO needs it (user/stakeholder)
- WHY it's needed (business value)
- Success criteria (HOW we know it's done)
- Constraints or boundaries
- Dependencies

Evaluate completeness and identify what's missing.
    `.trim();

    const response = await this.ai.models.generateContent({
      model: this.modelId,
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            score: { type: Type.INTEGER },
            missingElements: { type: Type.ARRAY, items: { type: Type.STRING } },
            suggestions: { type: Type.ARRAY, items: { type: Type.STRING } },
          },
          required: ['score', 'missingElements', 'suggestions'],
        },
      },
    });

    return JSON.parse(response.text || '{"score":0,"missingElements":[],"suggestions":[]}');
  }

  private async generateProgressReport(params: Record<string, unknown>): Promise<ProgressReport> {
    const periodStart = params.periodStart as string || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const periodEnd = params.periodEnd as string || new Date().toISOString();

    const insights = this.project.insights || [];
    const tasks = this.project.tasks || [];
    const brd = this.project.brd;

    const approvedInsights = insights.filter(i => i.status === 'approved');
    const rejectedInsights = insights.filter(i => i.status === 'rejected');
    const pendingInsights = insights.filter(i => i.status === 'pending');

    const prompt = `
Generate a progress report for this BRD project.

PROJECT: ${this.project.name}
REPORTING PERIOD: ${periodStart} to ${periodEnd}

METRICS:
- Total Insights: ${insights.length}
- Approved: ${approvedInsights.length}
- Rejected: ${rejectedInsights.length}
- Pending: ${pendingInsights.length}
- Tasks: ${tasks.length}
- BRD Sections: ${brd?.sections?.length || 0}
- BRD Version: ${brd?.version || 'Not generated'}

RECENT ACTIVITY:
${this.project.recentActivity?.slice(-10).map(a => `- ${a.action} (${a.user})`).join('\n') || 'No recent activity'}

OPEN TASKS:
${tasks.slice(0, 5).map(t => `- ${t.title} (${t.urgency} priority)`).join('\n') || 'No tasks'}

Generate a comprehensive progress report with:
1. Executive summary
2. Key highlights and achievements
3. Concerns and blockers
4. Recommended next steps
5. Stakeholder-specific updates
    `.trim();

    const response = await this.ai.models.generateContent({
      model: this.modelId,
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            summary: { type: Type.STRING },
            highlights: { type: Type.ARRAY, items: { type: Type.STRING } },
            concerns: { type: Type.ARRAY, items: { type: Type.STRING } },
            nextSteps: { type: Type.ARRAY, items: { type: Type.STRING } },
            stakeholderUpdates: { type: Type.OBJECT },
            velocityTrend: { type: Type.STRING, enum: ['improving', 'stable', 'declining'] },
            brdCompleteness: { type: Type.INTEGER },
            confidenceScore: { type: Type.INTEGER },
          },
          required: ['summary', 'highlights', 'concerns', 'nextSteps'],
        },
      },
    });

    const reportData = JSON.parse(response.text || '{}');

    return {
      generatedAt: new Date().toISOString(),
      period: { start: periodStart, end: periodEnd },
      summary: reportData.summary || '',
      metrics: {
        insightsProcessed: {
          total: insights.length,
          approved: approvedInsights.length,
          rejected: rejectedInsights.length,
          pending: pendingInsights.length,
        },
        gapsIdentified: 0,
        gapsResolved: 0,
        clarificationsScheduled: 0,
        clarificationsCompleted: 0,
        brdCompleteness: reportData.brdCompleteness || 0,
        confidenceScore: reportData.confidenceScore || 0,
        velocityTrend: reportData.velocityTrend || 'stable',
      },
      highlights: reportData.highlights || [],
      concerns: reportData.concerns || [],
      nextSteps: reportData.nextSteps || [],
      stakeholderUpdates: reportData.stakeholderUpdates || {},
    };
  }

  private async escalateBlocker(params: Record<string, unknown>): Promise<{ escalated: boolean; ticket: string }> {
    const issue = params.issue as string;
    const severity = params.severity as string || 'high';
    const stakeholders = params.stakeholders as string[] || [];

    // Create high-priority task
    const task: Omit<Task, 'id'> = {
      title: `ESCALATION: ${issue}`,
      type: 'conflict',
      urgency: 'high',
      confidence: 95,
      source: 'AI Agent Escalation',
      status: 'pending',
      createdAt: new Date().toISOString(),
      description: `Severity: ${severity}\nStakeholders to notify: ${stakeholders.join(', ')}\n\nIssue: ${issue}`,
    };

    const updatedProject = await addTask(task);
    this.project = updatedProject;
    this.onProjectUpdate(updatedProject);

    return {
      escalated: true,
      ticket: `ESC-${Date.now()}`,
    };
  }
}

// ============================================================================
// PRE-BUILT WORKFLOW FUNCTIONS
// ============================================================================

export interface WorkflowOptions {
  project: ProjectState;
  onProjectUpdate: (project: ProjectState) => void;
  onProgress?: (progress: WorkflowProgress) => void;
  onApprovalRequired?: (action: AgentAction) => Promise<boolean>;
  autoApprove?: boolean;
  abortSignal?: AbortSignal;  // Signal to cancel the workflow
}

export interface WorkflowProgress {
  workflowId: string;
  workflowName: string;
  currentStep: number;
  totalSteps: number;
  currentAction: string;
  status: 'running' | 'awaiting-approval' | 'completed' | 'failed';
  results: Record<string, unknown>;
}

/**
 * Run comprehensive gap analysis workflow
 */
export async function runGapAnalysisWorkflow(
  options: WorkflowOptions
): Promise<GapAnalysisResult> {
  const agent = getAgentCore();
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
  const executor = new BRDActionExecutor(apiKey, options.project, options.onProjectUpdate);

  // Start session
  agent.startSession();

  // Add goal
  const goal = await agent.addGoal(
    'analyze-gaps',
    'Perform comprehensive gap analysis to identify all missing information, incomplete requirements, and areas needing clarification',
    { projectName: options.project.name, insightCount: options.project.insights?.length || 0 },
    { priority: 'high' }
  );

  // Create plan
  const plan = await agent.createPlan(goal.id);

  // Report progress
  options.onProgress?.({
    workflowId: plan.id,
    workflowName: 'Gap Analysis',
    currentStep: 0,
    totalSteps: plan.actions.length,
    currentAction: 'Starting analysis...',
    status: 'running',
    results: {},
  });

  // Execute plan
  let gaps: IdentifiedGap[] = [];
  let missingStakeholders: string[] = [];

  // Manual execution with progress updates
  for (let i = 0; i < plan.actions.length; i++) {
    // Check if workflow was cancelled
    if (options.abortSignal?.aborted) {
      agent.endSession();
      throw new Error('Workflow cancelled');
    }

    const action = plan.actions[i];

    options.onProgress?.({
      workflowId: plan.id,
      workflowName: 'Gap Analysis',
      currentStep: i + 1,
      totalSteps: plan.actions.length,
      currentAction: action.name,
      status: action.requiresApproval ? 'awaiting-approval' : 'running',
      results: { gaps, missingStakeholders },
    });

    // Handle approval
    if (action.requiresApproval && !options.autoApprove) {
      const approved = await options.onApprovalRequired?.(action);
      if (!approved) continue;
    }

    const result = await executor.execute(action);
    
    if (result.success && result.data) {
      if (action.name === 'analyze-requirements-gaps') {
        gaps = result.data as IdentifiedGap[];
      } else if (action.name === 'identify-missing-stakeholders') {
        missingStakeholders = result.data as string[];
      }
    }
  }

  agent.endSession();

  // Compile results
  const criticalGaps = gaps.filter(g => g.severity === 'critical' || g.severity === 'high');
  
  return {
    gaps,
    completenessScore: Math.max(0, 100 - (gaps.length * 5)),
    criticalMissing: criticalGaps.map(g => g.title),
    recommendations: gaps.slice(0, 5).map(g => ({
      gapId: g.id,
      action: g.type === 'missing-stakeholder' ? 'schedule-meeting' : 'create-task',
      priority: g.severity === 'critical' ? 'critical' : g.severity === 'high' ? 'high' : 'medium',
      description: g.suggestedActions[0] || `Address: ${g.title}`,
      estimatedEffort: g.severity === 'critical' ? 'high' : 'medium',
    })),
    affectedSections: [...new Set(gaps.flatMap(g => g.affectedAreas))],
  };
}

/**
 * Run stakeholder clarification workflow
 */
export async function runStakeholderClarificationWorkflow(
  options: WorkflowOptions & { 
    stakeholder: string; 
    gapIds?: string[];
    questions?: string[];
  }
): Promise<StakeholderClarification> {
  const agent = getAgentCore();
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
  const executor = new BRDActionExecutor(apiKey, options.project, options.onProjectUpdate);

  agent.startSession();

  const goal = await agent.addGoal(
    'schedule-clarification',
    `Schedule and prepare clarification meeting with ${options.stakeholder}`,
    { 
      stakeholder: options.stakeholder, 
      gapIds: options.gapIds,
      existingQuestions: options.questions 
    },
    { priority: 'high' }
  );

  // Generate questions first
  const questionsResult = await executor.execute({
    id: 'generate_questions',
    goalId: goal.id,
    type: 'analyze',
    name: 'generate-clarification-questions',
    description: 'Generate targeted clarification questions',
    parameters: { 
      stakeholder: options.stakeholder, 
      gapIds: options.gapIds,
      context: options.project.goals 
    },
    status: 'pending',
    requiresApproval: false,
    retryCount: 0,
    estimatedImpact: 'none',
  });

  const questions = questionsResult.success ? questionsResult.data as ClarificationQuestion[] : [];

  // Schedule meeting
  const meetingResult = await executor.execute({
    id: 'schedule_meeting',
    goalId: goal.id,
    type: 'schedule',
    name: 'schedule-stakeholder-meeting',
    description: 'Create clarification task and schedule',
    parameters: {
      stakeholder: options.stakeholder,
      questions,
      urgency: 'high',
      relatedGaps: options.gapIds || [],
    },
    status: 'pending',
    requiresApproval: true,
    retryCount: 0,
    estimatedImpact: 'medium',
  });

  agent.endSession();

  return meetingResult.data as StakeholderClarification || {
    id: `clarification_${Date.now()}`,
    stakeholderName: options.stakeholder,
    questions,
    priority: 'high',
    status: 'pending',
    context: `Clarification for ${options.project.name}`,
    relatedInsights: [],
    relatedGaps: options.gapIds || [],
  };
}

/**
 * Run requirements validation workflow
 */
export async function runValidationWorkflow(
  options: WorkflowOptions & { insightIds?: string[] }
): Promise<{ results: Map<string, ValidationResult>; summary: { valid: number; invalid: number; warnings: number } }> {
  const agent = getAgentCore();
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
  const executor = new BRDActionExecutor(apiKey, options.project, options.onProjectUpdate);

  agent.startSession();

  const insightsToValidate = options.insightIds 
    ? options.project.insights?.filter(i => options.insightIds!.includes(i.id)) || []
    : options.project.insights?.filter(i => i.status === 'approved') || [];

  const results = new Map<string, ValidationResult>();
  let valid = 0, invalid = 0, warnings = 0;

  for (const insight of insightsToValidate) {
    // Check if workflow was cancelled
    if (options.abortSignal?.aborted) {
      agent.endSession();
      throw new Error('Workflow cancelled');
    }

    const result = await executor.execute({
      id: `validate_${insight.id}`,
      goalId: 'validation',
      type: 'analyze',
      name: 'validate-requirement',
      description: `Validate insight: ${insight.summary}`,
      parameters: { insightId: insight.id },
      status: 'pending',
      requiresApproval: false,
      retryCount: 0,
      estimatedImpact: 'none',
    });

    if (result.success && result.data) {
      const validation = result.data as ValidationResult;
      results.set(insight.id, validation);
      
      if (validation.isValid) valid++;
      else invalid++;
      warnings += validation.issues.filter(i => i.severity === 'warning').length;
    }

    options.onProgress?.({
      workflowId: 'validation',
      workflowName: 'Requirements Validation',
      currentStep: results.size,
      totalSteps: insightsToValidate.length,
      currentAction: `Validated: ${insight.summary.slice(0, 50)}...`,
      status: 'running',
      results: { valid, invalid, warnings },
    });
  }

  agent.endSession();

  return { results, summary: { valid, invalid, warnings } };
}

/**
 * Run automated progress report generation
 */
export async function runProgressReportWorkflow(
  options: WorkflowOptions & { periodDays?: number }
): Promise<ProgressReport> {
  const agent = getAgentCore();
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
  const executor = new BRDActionExecutor(apiKey, options.project, options.onProjectUpdate);

  agent.startSession();

  const periodDays = options.periodDays || 7;
  const periodStart = new Date(Date.now() - periodDays * 24 * 60 * 60 * 1000).toISOString();
  const periodEnd = new Date().toISOString();

  const result = await executor.execute({
    id: 'generate_report',
    goalId: 'reporting',
    type: 'analyze',
    name: 'generate-progress-report',
    description: 'Generate weekly progress report',
    parameters: { periodStart, periodEnd },
    status: 'pending',
    requiresApproval: false,
    retryCount: 0,
    estimatedImpact: 'none',
  });

  agent.endSession();

  return result.data as ProgressReport || {
    generatedAt: new Date().toISOString(),
    period: { start: periodStart, end: periodEnd },
    summary: 'Report generation failed',
    metrics: {
      insightsProcessed: { total: 0, approved: 0, rejected: 0, pending: 0 },
      gapsIdentified: 0,
      gapsResolved: 0,
      clarificationsScheduled: 0,
      clarificationsCompleted: 0,
      brdCompleteness: 0,
      confidenceScore: 0,
      velocityTrend: 'stable',
    },
    highlights: [],
    concerns: [],
    nextSteps: [],
    stakeholderUpdates: {},
  };
}
