/**
 * AgentCore - Enterprise-Grade Autonomous AI Agent Engine
 * 
 * A sophisticated multi-agent system that provides:
 * - Autonomous task planning and execution
 * - Goal-driven reasoning with chain-of-thought
 * - Self-reflection and course correction
 * - Human-in-the-loop approval workflows
 * - Comprehensive audit trails
 * - Rollback capabilities
 * - Rate limiting and resource management
 */

import { GoogleGenAI, Type } from '@google/genai';

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

export type AgentStatus = 
  | 'idle' 
  | 'planning' 
  | 'executing' 
  | 'awaiting-approval' 
  | 'paused' 
  | 'completed' 
  | 'failed' 
  | 'cancelled';

export type AgentPriority = 'critical' | 'high' | 'medium' | 'low';

export type AgentCapability = 
  | 'analyze-gaps'           // Find missing information
  | 'detect-conflicts'       // Identify contradictions
  | 'extract-insights'       // Pull insights from sources
  | 'schedule-clarification' // Schedule stakeholder meetings
  | 'draft-communication'    // Write emails/messages
  | 'research-context'       // Gather additional context
  | 'validate-requirements'  // Check requirement completeness
  | 'suggest-improvements'   // Recommend enhancements
  | 'monitor-changes'        // Watch for updates
  | 'generate-reports';      // Create status reports

export interface AgentGoal {
  id: string;
  type: AgentCapability;
  description: string;
  priority: AgentPriority;
  context: Record<string, unknown>;
  constraints?: AgentConstraints;
  deadline?: string;
  createdAt: string;
  createdBy: 'user' | 'system' | 'agent';
}

export interface AgentConstraints {
  maxApiCalls?: number;
  maxTimeMs?: number;
  requiresApproval?: boolean;
  allowedActions?: AgentActionType[];
  blockedActions?: AgentActionType[];
  stakeholderScope?: string[];
  budgetLimit?: number;
}

export type AgentActionType = 
  | 'read'              // Read data (no side effects)
  | 'analyze'           // Process/analyze data
  | 'create'            // Create new entities
  | 'update'            // Modify existing entities
  | 'delete'            // Remove entities
  | 'notify'            // Send notifications
  | 'schedule'          // Schedule events
  | 'export'            // Export data
  | 'escalate';         // Escalate to human

export interface AgentAction {
  id: string;
  goalId: string;
  type: AgentActionType;
  name: string;
  description: string;
  parameters: Record<string, unknown>;
  status: 'pending' | 'approved' | 'executing' | 'completed' | 'failed' | 'skipped' | 'rolled-back';
  result?: AgentActionResult;
  requiresApproval: boolean;
  approvedBy?: string;
  approvedAt?: string;
  executedAt?: string;
  rollbackData?: Record<string, unknown>;
  retryCount: number;
  estimatedImpact: 'none' | 'low' | 'medium' | 'high' | 'critical';
}

export interface AgentActionResult {
  success: boolean;
  data?: unknown;
  error?: string;
  metrics?: {
    executionTimeMs: number;
    apiCallsMade: number;
    tokensUsed: number;
  };
}

export interface AgentPlan {
  id: string;
  goalId: string;
  reasoning: string;           // Chain-of-thought explanation
  actions: AgentAction[];
  estimatedDuration: number;   // ms
  estimatedApiCalls: number;
  confidenceScore: number;     // 0-100
  alternatives?: AgentPlan[];  // Alternative approaches
  risks: AgentRisk[];
  createdAt: string;
  status: 'draft' | 'approved' | 'executing' | 'completed' | 'failed' | 'cancelled';
}

export interface AgentRisk {
  type: 'data-loss' | 'incorrect-action' | 'stakeholder-impact' | 'compliance' | 'performance';
  description: string;
  likelihood: 'low' | 'medium' | 'high';
  impact: 'low' | 'medium' | 'high';
  mitigation?: string;
}

export interface AgentSession {
  id: string;
  startedAt: string;
  endedAt?: string;
  status: AgentStatus;
  goals: AgentGoal[];
  plans: AgentPlan[];
  executionLog: AgentLogEntry[];
  metrics: AgentSessionMetrics;
  checkpoints: AgentCheckpoint[];
}

export interface AgentLogEntry {
  id: string;
  timestamp: string;
  level: 'debug' | 'info' | 'warning' | 'error';
  category: 'planning' | 'execution' | 'approval' | 'reflection' | 'rollback';
  message: string;
  data?: Record<string, unknown>;
  actionId?: string;
  goalId?: string;
}

export interface AgentSessionMetrics {
  totalApiCalls: number;
  totalTokensUsed: number;
  totalActionsExecuted: number;
  totalActionsApproved: number;
  totalActionsFailed: number;
  totalRollbacks: number;
  averageConfidence: number;
  executionTimeMs: number;
}

export interface AgentCheckpoint {
  id: string;
  timestamp: string;
  planId: string;
  actionIndex: number;
  state: Record<string, unknown>;
  description: string;
}

export interface AgentConfig {
  modelId: string;
  maxConcurrentGoals: number;
  defaultApprovalRequired: boolean;
  autoRetryFailures: boolean;
  maxRetries: number;
  checkpointInterval: number;       // Actions between checkpoints
  reflectionInterval: number;       // Actions between self-reflection
  rateLimitPerMinute: number;
  circuitBreakerThreshold: number;  // Failures before circuit breaks
}

// ============================================================================
// DEFAULT CONFIGURATION
// ============================================================================

export const DEFAULT_AGENT_CONFIG: AgentConfig = {
  modelId: 'gemini-2.5-flash',
  maxConcurrentGoals: 3,
  defaultApprovalRequired: true,
  autoRetryFailures: true,
  maxRetries: 3,
  checkpointInterval: 5,
  reflectionInterval: 3,
  rateLimitPerMinute: 30,
  circuitBreakerThreshold: 5,
};

// ============================================================================
// AGENT CORE CLASS
// ============================================================================

export class AgentCore {
  private ai: GoogleGenAI;
  private config: AgentConfig;
  private currentSession: AgentSession | null = null;
  private actionQueue: AgentAction[] = [];
  private approvalCallbacks: Map<string, (approved: boolean, notes?: string) => void> = new Map();
  private eventListeners: Map<string, Set<(event: AgentEvent) => void>> = new Map();
  private rateLimitTracker: { count: number; resetAt: number } = { count: 0, resetAt: Date.now() + 60000 };
  private circuitBreakerState: { failures: number; openUntil: number | null } = { failures: 0, openUntil: null };

  constructor(apiKey: string, config: Partial<AgentConfig> = {}) {
    this.ai = new GoogleGenAI({ apiKey });
    this.config = { ...DEFAULT_AGENT_CONFIG, ...config };
  }

  // ============================================================================
  // SESSION MANAGEMENT
  // ============================================================================

  startSession(): AgentSession {
    if (this.currentSession?.status === 'executing') {
      throw new Error('Cannot start new session while another is executing');
    }

    this.currentSession = {
      id: `session_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      startedAt: new Date().toISOString(),
      status: 'idle',
      goals: [],
      plans: [],
      executionLog: [],
      metrics: {
        totalApiCalls: 0,
        totalTokensUsed: 0,
        totalActionsExecuted: 0,
        totalActionsApproved: 0,
        totalActionsFailed: 0,
        totalRollbacks: 0,
        averageConfidence: 0,
        executionTimeMs: 0,
      },
      checkpoints: [],
    };

    this.log('info', 'planning', 'Agent session started', { sessionId: this.currentSession.id });
    this.emit('session-started', { session: this.currentSession });

    return this.currentSession;
  }

  endSession(): AgentSession | null {
    if (!this.currentSession) return null;

    this.currentSession.endedAt = new Date().toISOString();
    this.currentSession.status = 'completed';

    this.log('info', 'planning', 'Agent session ended', { 
      sessionId: this.currentSession.id,
      metrics: this.currentSession.metrics 
    });
    this.emit('session-ended', { session: this.currentSession });

    const session = this.currentSession;
    this.currentSession = null;
    return session;
  }

  getSession(): AgentSession | null {
    return this.currentSession;
  }

  // ============================================================================
  // GOAL MANAGEMENT
  // ============================================================================

  async addGoal(
    type: AgentCapability,
    description: string,
    context: Record<string, unknown>,
    options: {
      priority?: AgentPriority;
      constraints?: AgentConstraints;
      deadline?: string;
    } = {}
  ): Promise<AgentGoal> {
    if (!this.currentSession) {
      this.startSession();
    }

    const goal: AgentGoal = {
      id: `goal_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      type,
      description,
      priority: options.priority || 'medium',
      context,
      constraints: options.constraints,
      deadline: options.deadline,
      createdAt: new Date().toISOString(),
      createdBy: 'user',
    };

    this.currentSession!.goals.push(goal);
    this.log('info', 'planning', `Goal added: ${description}`, { goalId: goal.id, type });
    this.emit('goal-added', { goal });

    return goal;
  }

  // ============================================================================
  // PLANNING ENGINE
  // ============================================================================

  async createPlan(goalId: string): Promise<AgentPlan> {
    const goal = this.currentSession?.goals.find(g => g.id === goalId);
    if (!goal) throw new Error(`Goal not found: ${goalId}`);

    this.currentSession!.status = 'planning';
    this.log('info', 'planning', `Creating plan for goal: ${goal.description}`, { goalId });

    const prompt = this.buildPlanningPrompt(goal);
    
    try {
      await this.checkRateLimit();
      
      const response = await this.ai.models.generateContent({
        model: this.config.modelId,
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          responseSchema: this.getPlanningSchema(),
        },
      });

      this.trackApiCall();
      
      const planData = JSON.parse(response.text || '{}');
      
      const plan: AgentPlan = {
        id: `plan_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        goalId,
        reasoning: planData.reasoning || '',
        actions: this.parseActions(goalId, planData.actions || [], goal.constraints),
        estimatedDuration: planData.estimatedDurationMs || 30000,
        estimatedApiCalls: planData.estimatedApiCalls || 5,
        confidenceScore: planData.confidenceScore || 70,
        risks: planData.risks || [],
        createdAt: new Date().toISOString(),
        status: 'draft',
      };

      this.currentSession!.plans.push(plan);
      this.log('info', 'planning', `Plan created with ${plan.actions.length} actions`, { 
        planId: plan.id, 
        confidence: plan.confidenceScore 
      });
      this.emit('plan-created', { plan });

      return plan;
    } catch (error) {
      this.log('error', 'planning', `Failed to create plan: ${error}`, { goalId });
      throw error;
    }
  }

  private buildPlanningPrompt(goal: AgentGoal): string {
    return `
You are an autonomous AI planning agent for a Business Requirements Document (BRD) platform.
You need to create a detailed execution plan for the following goal.

GOAL TYPE: ${goal.type}
GOAL DESCRIPTION: ${goal.description}
PRIORITY: ${goal.priority}
CONTEXT: ${JSON.stringify(goal.context, null, 2)}
${goal.constraints ? `CONSTRAINTS: ${JSON.stringify(goal.constraints, null, 2)}` : ''}
${goal.deadline ? `DEADLINE: ${goal.deadline}` : ''}

AVAILABLE ACTIONS:
- read: Read project data (insights, sources, BRD sections, tasks)
- analyze: Process and analyze data for patterns, gaps, conflicts
- create: Create new insights, tasks, or draft content
- update: Modify existing project entities
- notify: Send notifications to stakeholders
- schedule: Schedule clarification meetings or reminders
- escalate: Escalate issues requiring human decision

REQUIREMENTS:
1. Break down the goal into atomic, reversible actions
2. Actions that modify data MUST have requiresApproval: true
3. Estimate impact level for each action
4. Provide clear reasoning for each step
5. Identify potential risks
6. Consider rollback strategies

Create a comprehensive plan with chain-of-thought reasoning.
    `.trim();
  }

  private getPlanningSchema() {
    return {
      type: Type.OBJECT,
      properties: {
        reasoning: { type: Type.STRING },
        actions: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              name: { type: Type.STRING },
              type: { type: Type.STRING, enum: ['read', 'analyze', 'create', 'update', 'delete', 'notify', 'schedule', 'escalate'] },
              description: { type: Type.STRING },
              parameters: { type: Type.OBJECT },
              requiresApproval: { type: Type.BOOLEAN },
              estimatedImpact: { type: Type.STRING, enum: ['none', 'low', 'medium', 'high', 'critical'] },
            },
            required: ['name', 'type', 'description'],
          },
        },
        estimatedDurationMs: { type: Type.INTEGER },
        estimatedApiCalls: { type: Type.INTEGER },
        confidenceScore: { type: Type.INTEGER },
        risks: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              type: { type: Type.STRING },
              description: { type: Type.STRING },
              likelihood: { type: Type.STRING, enum: ['low', 'medium', 'high'] },
              impact: { type: Type.STRING, enum: ['low', 'medium', 'high'] },
              mitigation: { type: Type.STRING },
            },
          },
        },
      },
      required: ['reasoning', 'actions', 'confidenceScore'],
    };
  }

  private parseActions(
    goalId: string, 
    rawActions: any[], 
    constraints?: AgentConstraints
  ): AgentAction[] {
    return rawActions.map((action, index) => {
      const actionType = action.type as AgentActionType;
      const requiresApproval = this.shouldRequireApproval(actionType, action.estimatedImpact, constraints);

      return {
        id: `action_${Date.now()}_${index}_${Math.random().toString(36).slice(2, 6)}`,
        goalId,
        type: actionType,
        name: action.name,
        description: action.description,
        parameters: action.parameters || {},
        status: 'pending',
        requiresApproval,
        retryCount: 0,
        estimatedImpact: action.estimatedImpact || 'low',
      };
    });
  }

  private shouldRequireApproval(
    type: AgentActionType, 
    impact: string, 
    constraints?: AgentConstraints
  ): boolean {
    // Always require approval for destructive actions
    if (type === 'delete' || type === 'notify' || type === 'schedule') {
      return true;
    }

    // High/critical impact always needs approval
    if (impact === 'high' || impact === 'critical') {
      return true;
    }

    // Check constraints
    if (constraints?.requiresApproval !== undefined) {
      return constraints.requiresApproval;
    }

    // Check allowed/blocked actions
    if (constraints?.blockedActions?.includes(type)) {
      return true; // Blocked actions need explicit approval
    }

    // Default config
    return this.config.defaultApprovalRequired && (type === 'create' || type === 'update');
  }

  // ============================================================================
  // EXECUTION ENGINE
  // ============================================================================

  async executePlan(planId: string, actionExecutor: ActionExecutor): Promise<void> {
    const plan = this.currentSession?.plans.find(p => p.id === planId);
    if (!plan) throw new Error(`Plan not found: ${planId}`);

    plan.status = 'executing';
    this.currentSession!.status = 'executing';
    const startTime = Date.now();

    this.log('info', 'execution', `Starting plan execution`, { planId, actionCount: plan.actions.length });
    this.emit('plan-started', { plan });

    let actionsExecuted = 0;
    let checkpoint: AgentCheckpoint | null = null;

    try {
      for (let i = 0; i < plan.actions.length; i++) {
        const action = plan.actions[i];

        // Check circuit breaker
        if (this.isCircuitOpen()) {
          throw new Error('Circuit breaker is open - too many failures');
        }

        // Create checkpoint if needed
        if (actionsExecuted > 0 && actionsExecuted % this.config.checkpointInterval === 0) {
          checkpoint = this.createCheckpoint(plan, i);
        }

        // Self-reflection if needed
        if (actionsExecuted > 0 && actionsExecuted % this.config.reflectionInterval === 0) {
          await this.performReflection(plan, i);
        }

        // Handle approval if required
        if (action.requiresApproval && action.status === 'pending') {
          action.status = 'pending';
          this.currentSession!.status = 'awaiting-approval';
          
          this.log('info', 'approval', `Awaiting approval for: ${action.name}`, { actionId: action.id });
          this.emit('approval-required', { action, plan });

          const approved = await this.waitForApproval(action.id);
          
          if (!approved) {
            action.status = 'skipped';
            this.log('info', 'approval', `Action skipped: ${action.name}`, { actionId: action.id });
            continue;
          }
          
          this.currentSession!.status = 'executing';
          this.currentSession!.metrics.totalActionsApproved++;
        }

        // Execute action
        try {
          await this.checkRateLimit();
          
          action.status = 'executing';
          this.log('info', 'execution', `Executing: ${action.name}`, { actionId: action.id });
          this.emit('action-started', { action });

          const result = await actionExecutor.execute(action);
          
          action.result = result;
          action.status = result.success ? 'completed' : 'failed';
          action.executedAt = new Date().toISOString();
          
          this.currentSession!.metrics.totalActionsExecuted++;

          if (result.success) {
            this.log('info', 'execution', `Action completed: ${action.name}`, { 
              actionId: action.id, 
              metrics: result.metrics 
            });
            this.emit('action-completed', { action });
            this.resetCircuitBreaker();
          } else {
            throw new Error(result.error || 'Action failed');
          }

          actionsExecuted++;
        } catch (error: any) {
          this.handleActionFailure(action, error, plan, i);
        }
      }

      plan.status = 'completed';
      this.currentSession!.status = 'completed';
      this.currentSession!.metrics.executionTimeMs += Date.now() - startTime;

      this.log('info', 'execution', `Plan completed successfully`, { 
        planId, 
        actionsExecuted,
        timeMs: Date.now() - startTime 
      });
      this.emit('plan-completed', { plan });

    } catch (error: any) {
      plan.status = 'failed';
      this.currentSession!.status = 'failed';
      
      this.log('error', 'execution', `Plan execution failed: ${error.message}`, { planId });
      this.emit('plan-failed', { plan, error: error.message });
      
      throw error;
    }
  }

  private async handleActionFailure(
    action: AgentAction, 
    error: Error, 
    plan: AgentPlan,
    actionIndex: number
  ): Promise<void> {
    action.status = 'failed';
    action.result = { success: false, error: error.message };
    this.currentSession!.metrics.totalActionsFailed++;
    this.incrementCircuitBreaker();

    this.log('error', 'execution', `Action failed: ${action.name} - ${error.message}`, { 
      actionId: action.id 
    });

    // Retry logic
    if (this.config.autoRetryFailures && action.retryCount < this.config.maxRetries) {
      action.retryCount++;
      action.status = 'pending';
      this.log('info', 'execution', `Retrying action (${action.retryCount}/${this.config.maxRetries})`, { 
        actionId: action.id 
      });
    } else {
      this.emit('action-failed', { action, error: error.message });
    }
  }

  // ============================================================================
  // APPROVAL WORKFLOW
  // ============================================================================

  async waitForApproval(actionId: string): Promise<boolean> {
    return new Promise((resolve) => {
      this.approvalCallbacks.set(actionId, (approved) => {
        resolve(approved);
      });

      // Timeout after 30 minutes
      setTimeout(() => {
        if (this.approvalCallbacks.has(actionId)) {
          this.approvalCallbacks.delete(actionId);
          resolve(false);
        }
      }, 30 * 60 * 1000);
    });
  }

  approveAction(actionId: string, approvedBy: string = 'user', notes?: string): void {
    const callback = this.approvalCallbacks.get(actionId);
    if (callback) {
      // Update action with approval info
      if (this.currentSession) {
        for (const plan of this.currentSession.plans) {
          const action = plan.actions.find(a => a.id === actionId);
          if (action) {
            action.approvedBy = approvedBy;
            action.approvedAt = new Date().toISOString();
            action.status = 'approved';
            break;
          }
        }
      }
      
      this.log('info', 'approval', `Action approved: ${actionId}`, { approvedBy, notes });
      callback(true, notes);
      this.approvalCallbacks.delete(actionId);
    }
  }

  rejectAction(actionId: string, reason?: string): void {
    const callback = this.approvalCallbacks.get(actionId);
    if (callback) {
      this.log('info', 'approval', `Action rejected: ${actionId}`, { reason });
      callback(false, reason);
      this.approvalCallbacks.delete(actionId);
    }
  }

  approveAllPendingActions(approvedBy: string = 'user'): void {
    for (const [actionId] of this.approvalCallbacks) {
      this.approveAction(actionId, approvedBy);
    }
  }

  // ============================================================================
  // SELF-REFLECTION
  // ============================================================================

  private async performReflection(plan: AgentPlan, currentIndex: number): Promise<void> {
    const completedActions = plan.actions.slice(0, currentIndex);
    const remainingActions = plan.actions.slice(currentIndex);

    const prompt = `
You are performing self-reflection on an ongoing task execution.

ORIGINAL GOAL: ${this.currentSession?.goals.find(g => g.id === plan.goalId)?.description}
CONFIDENCE: ${plan.confidenceScore}%

COMPLETED ACTIONS:
${completedActions.map(a => `- ${a.name}: ${a.status} ${a.result?.error ? `(Error: ${a.result.error})` : ''}`).join('\n')}

REMAINING ACTIONS:
${remainingActions.map(a => `- ${a.name}: ${a.description}`).join('\n')}

QUESTIONS TO CONSIDER:
1. Are we making progress toward the goal?
2. Have any failures indicated we need to change approach?
3. Should any remaining actions be modified or skipped?
4. Are there new risks we should consider?

Provide a brief reflection (2-3 sentences) and any recommended adjustments.
    `.trim();

    try {
      await this.checkRateLimit();
      
      const response = await this.ai.models.generateContent({
        model: this.config.modelId,
        contents: prompt,
      });

      this.trackApiCall();
      
      this.log('info', 'reflection', 'Self-reflection completed', { 
        reflection: response.text?.slice(0, 200) 
      });

    } catch (error) {
      this.log('warning', 'reflection', `Reflection failed: ${error}`, {});
    }
  }

  // ============================================================================
  // CHECKPOINTS & ROLLBACK
  // ============================================================================

  private createCheckpoint(plan: AgentPlan, actionIndex: number): AgentCheckpoint {
    const checkpoint: AgentCheckpoint = {
      id: `checkpoint_${Date.now()}`,
      timestamp: new Date().toISOString(),
      planId: plan.id,
      actionIndex,
      state: this.captureState(),
      description: `After action ${actionIndex}: ${plan.actions[actionIndex - 1]?.name || 'start'}`,
    };

    this.currentSession!.checkpoints.push(checkpoint);
    this.log('debug', 'execution', 'Checkpoint created', { checkpointId: checkpoint.id });
    
    return checkpoint;
  }

  private captureState(): Record<string, unknown> {
    // Override this to capture actual application state
    return {
      timestamp: new Date().toISOString(),
      metrics: { ...this.currentSession?.metrics },
    };
  }

  async rollbackToCheckpoint(
    checkpointId: string, 
    rollbackExecutor: (checkpoint: AgentCheckpoint) => Promise<void>
  ): Promise<void> {
    const checkpoint = this.currentSession?.checkpoints.find(c => c.id === checkpointId);
    if (!checkpoint) throw new Error(`Checkpoint not found: ${checkpointId}`);

    this.log('info', 'rollback', `Rolling back to checkpoint`, { checkpointId });
    this.emit('rollback-started', { checkpoint });

    try {
      await rollbackExecutor(checkpoint);
      this.currentSession!.metrics.totalRollbacks++;
      
      this.log('info', 'rollback', `Rollback completed`, { checkpointId });
      this.emit('rollback-completed', { checkpoint });
    } catch (error: any) {
      this.log('error', 'rollback', `Rollback failed: ${error.message}`, { checkpointId });
      throw error;
    }
  }

  // ============================================================================
  // RATE LIMITING & CIRCUIT BREAKER
  // ============================================================================

  private async checkRateLimit(): Promise<void> {
    const now = Date.now();
    
    // Reset counter if minute has passed
    if (now > this.rateLimitTracker.resetAt) {
      this.rateLimitTracker.count = 0;
      this.rateLimitTracker.resetAt = now + 60000;
    }

    // Check if over limit
    if (this.rateLimitTracker.count >= this.config.rateLimitPerMinute) {
      const waitTime = this.rateLimitTracker.resetAt - now;
      this.log('warning', 'execution', `Rate limit hit, waiting ${waitTime}ms`, {});
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
  }

  private trackApiCall(): void {
    this.rateLimitTracker.count++;
    if (this.currentSession) {
      this.currentSession.metrics.totalApiCalls++;
    }
  }

  private isCircuitOpen(): boolean {
    if (!this.circuitBreakerState.openUntil) return false;
    if (Date.now() > this.circuitBreakerState.openUntil) {
      this.circuitBreakerState.openUntil = null;
      this.circuitBreakerState.failures = 0;
      return false;
    }
    return true;
  }

  private incrementCircuitBreaker(): void {
    this.circuitBreakerState.failures++;
    if (this.circuitBreakerState.failures >= this.config.circuitBreakerThreshold) {
      this.circuitBreakerState.openUntil = Date.now() + 60000; // Open for 1 minute
      this.log('warning', 'execution', 'Circuit breaker opened due to failures', {});
    }
  }

  private resetCircuitBreaker(): void {
    this.circuitBreakerState.failures = 0;
  }

  // ============================================================================
  // LOGGING & EVENTS
  // ============================================================================

  private log(
    level: AgentLogEntry['level'],
    category: AgentLogEntry['category'],
    message: string,
    data: Record<string, unknown>
  ): void {
    const entry: AgentLogEntry = {
      id: `log_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      timestamp: new Date().toISOString(),
      level,
      category,
      message,
      data,
    };

    this.currentSession?.executionLog.push(entry);

    // Console output for debugging
    const prefix = `[Agent ${level.toUpperCase()}]`;
    if (level === 'error') {
      console.error(prefix, message, data);
    } else if (level === 'warning') {
      console.warn(prefix, message, data);
    } else {
      console.log(prefix, message, data);
    }
  }

  // ============================================================================
  // EVENT SYSTEM
  // ============================================================================

  on(event: string, callback: (event: AgentEvent) => void): () => void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, new Set());
    }
    this.eventListeners.get(event)!.add(callback);

    // Return unsubscribe function
    return () => {
      this.eventListeners.get(event)?.delete(callback);
    };
  }

  private emit(event: string, data: Record<string, unknown>): void {
    const agentEvent: AgentEvent = {
      type: event,
      timestamp: new Date().toISOString(),
      sessionId: this.currentSession?.id,
      data,
    };

    this.eventListeners.get(event)?.forEach(callback => {
      try {
        callback(agentEvent);
      } catch (error) {
        console.error('Event listener error:', error);
      }
    });

    // Also emit to 'all' listeners
    this.eventListeners.get('*')?.forEach(callback => {
      try {
        callback(agentEvent);
      } catch (error) {
        console.error('Event listener error:', error);
      }
    });
  }

  // ============================================================================
  // PAUSE / RESUME / CANCEL
  // ============================================================================

  pause(): void {
    if (this.currentSession?.status === 'executing') {
      this.currentSession.status = 'paused';
      this.log('info', 'execution', 'Agent paused', {});
      this.emit('paused', {});
    }
  }

  resume(): void {
    if (this.currentSession?.status === 'paused') {
      this.currentSession.status = 'executing';
      this.log('info', 'execution', 'Agent resumed', {});
      this.emit('resumed', {});
    }
  }

  cancel(): void {
    if (this.currentSession) {
      this.currentSession.status = 'cancelled';
      
      // Reject all pending approvals
      for (const [actionId] of this.approvalCallbacks) {
        this.rejectAction(actionId, 'Session cancelled');
      }
      
      this.log('info', 'execution', 'Agent cancelled', {});
      this.emit('cancelled', {});
    }
  }
}

// ============================================================================
// ACTION EXECUTOR INTERFACE
// ============================================================================

export interface ActionExecutor {
  execute(action: AgentAction): Promise<AgentActionResult>;
  rollback?(action: AgentAction): Promise<void>;
}

// ============================================================================
// EVENTS
// ============================================================================

export interface AgentEvent {
  type: string;
  timestamp: string;
  sessionId?: string;
  data: Record<string, unknown>;
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

let agentCoreInstance: AgentCore | null = null;

export const getAgentCore = (apiKey?: string): AgentCore => {
  if (!agentCoreInstance) {
    const key = apiKey || import.meta.env.VITE_GEMINI_API_KEY;
    if (!key) throw new Error('API key required to initialize AgentCore');
    agentCoreInstance = new AgentCore(key);
  }
  return agentCoreInstance;
};

export const resetAgentCore = (): void => {
  agentCoreInstance = null;
};
