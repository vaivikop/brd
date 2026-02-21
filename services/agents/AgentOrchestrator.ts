/**
 * AgentOrchestrator - Multi-Agent Coordination System
 * 
 * Provides:
 * - Multi-agent task decomposition and coordination
 * - Specialized agent routing
 * - Parallel execution management
 * - Dependency resolution
 * - Priority-based scheduling
 * - Cross-agent communication
 * - Unified monitoring and control
 */

import { 
  AgentCore, 
  AgentGoal, 
  AgentPlan, 
  AgentAction,
  AgentCapability,
  AgentPriority,
  AgentStatus,
  AgentEvent,
  getAgentCore 
} from './AgentCore';
import { 
  BRDActionExecutor,
  GapAnalysisResult,
  StakeholderClarification,
  ValidationResult,
  ProgressReport,
  WorkflowProgress,
  runGapAnalysisWorkflow,
  runStakeholderClarificationWorkflow,
  runValidationWorkflow,
  runProgressReportWorkflow,
} from './AgentWorkflows';
import { AgentMemory, getAgentMemory } from './AgentMemory';
import { ProjectState, Insight, Task } from '../../utils/db';

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

export type SpecializedAgent = 
  | 'gap-analyzer'        // Finds missing information
  | 'validator'           // Validates requirements
  | 'scheduler'           // Schedules clarifications
  | 'reporter'            // Generates reports
  | 'researcher'          // Gathers context
  | 'conflict-resolver'   // Resolves conflicts
  | 'monitor';            // Monitors changes

export interface AgentTask {
  id: string;
  type: SpecializedAgent;
  description: string;
  priority: AgentPriority;
  status: 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';
  dependencies: string[];  // Task IDs this depends on
  result?: unknown;
  error?: string;
  startedAt?: string;
  completedAt?: string;
  progress?: WorkflowProgress;
}

export interface OrchestratorConfig {
  maxParallelTasks: number;
  autoScheduleGapAnalysis: boolean;
  autoScheduleValidation: boolean;
  gapAnalysisIntervalHours: number;
  validationIntervalHours: number;
  reportIntervalDays: number;
  enableProactiveMode: boolean;
  autoResumeOnLoad: boolean;  // Auto-resume agent if it was active before page reload
  persistActiveState: boolean; // Remember if agent was active across sessions
}

export interface OrchestratorState {
  isRunning: boolean;
  wasRunningBeforeUnload: boolean;  // Track if agent was active before page refresh
  activeTasks: AgentTask[];
  queuedTasks: AgentTask[];
  completedTasks: AgentTask[];
  lastGapAnalysis?: string;
  lastValidation?: string;
  lastReport?: string;
  proactiveRecommendations: ProactiveRecommendation[];
  lastActiveTimestamp?: string; // When the agent was last active
}

export interface ProactiveRecommendation {
  id: string;
  type: 'gap' | 'clarification' | 'validation' | 'report' | 'alert';
  title: string;
  description: string;
  priority: AgentPriority;
  suggestedAction: string;
  createdAt: string;
  dismissed: boolean;
  actionTaken: boolean;
}

export interface OrchestratorEvent {
  type: 'task-started' | 'task-completed' | 'task-failed' | 'task-cancelled' | 'recommendation' | 'alert';
  timestamp: string;
  data: unknown;
}

// ============================================================================
// DEFAULT CONFIG
// ============================================================================

const DEFAULT_ORCHESTRATOR_CONFIG: OrchestratorConfig = {
  maxParallelTasks: 2,
  autoScheduleGapAnalysis: true,
  autoScheduleValidation: true,
  gapAnalysisIntervalHours: 24,
  validationIntervalHours: 12,
  reportIntervalDays: 7,
  enableProactiveMode: true,
  autoResumeOnLoad: true,
  persistActiveState: true,
};

// ============================================================================
// STORAGE KEYS
// ============================================================================

const STORAGE_KEYS = {
  STATE: 'clarity_orchestrator_state',
  CONFIG: 'clarity_orchestrator_config',
  ACTIVE_STATE: 'clarity_orchestrator_active',
  PANEL_EXPANDED: 'clarity_agent_panel_expanded',
};

// ============================================================================
// AGENT ORCHESTRATOR CLASS
// ============================================================================

export class AgentOrchestrator {
  private config: OrchestratorConfig;
  private state: OrchestratorState;
  private project: ProjectState | null = null;
  private onProjectUpdate: ((project: ProjectState) => void) | null = null;
  private memory: AgentMemory;
  private eventListeners: Map<string, Set<(event: OrchestratorEvent) => void>> = new Map();
  private schedulerInterval: NodeJS.Timeout | null = null;
  private initialized: boolean = false;
  private cancelledTaskIds: Set<string> = new Set();  // Track tasks marked for cancellation
  private taskAbortControllers: Map<string, AbortController> = new Map();  // Abort controllers for active tasks

  constructor(config: Partial<OrchestratorConfig> = {}) {
    this.config = { ...DEFAULT_ORCHESTRATOR_CONFIG, ...config };
    this.memory = getAgentMemory();
    this.state = this.loadState();
    this.initialized = true;
  }

  // ============================================================================
  // INITIALIZATION
  // ============================================================================

  private loadState(): OrchestratorState {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.STATE);
      const activeState = localStorage.getItem(STORAGE_KEYS.ACTIVE_STATE);
      const wasActive = activeState === 'true';
      
      if (saved) {
        const state = JSON.parse(saved);
        // Reset active tasks on reload (they need to be re-run)
        // But remember if agent was running for potential auto-resume
        return {
          ...state,
          isRunning: false, // Will be set by auto-resume if enabled
          wasRunningBeforeUnload: wasActive,
          activeTasks: [],
        };
      }
    } catch (error) {
      console.error('[AgentOrchestrator] Failed to load state:', error);
    }

    return {
      isRunning: false,
      wasRunningBeforeUnload: false,
      activeTasks: [],
      queuedTasks: [],
      completedTasks: [],
      proactiveRecommendations: [],
    };
  }

  private saveState(): void {
    try {
      // Don't save activeTasks (transient)
      const stateToSave = {
        ...this.state,
        activeTasks: [],
        // Limit completed tasks history
        completedTasks: this.state.completedTasks.slice(-100),
        // Limit recommendations
        proactiveRecommendations: this.state.proactiveRecommendations.slice(-50),
        lastActiveTimestamp: this.state.isRunning ? new Date().toISOString() : this.state.lastActiveTimestamp,
      };
      localStorage.setItem(STORAGE_KEYS.STATE, JSON.stringify(stateToSave));
      
      // Persist active state separately for quick access
      if (this.config.persistActiveState) {
        localStorage.setItem(STORAGE_KEYS.ACTIVE_STATE, String(this.state.isRunning));
      }
    } catch (error) {
      console.error('[AgentOrchestrator] Failed to save state:', error);
    }
  }

  // ============================================================================
  // PROJECT BINDING
  // ============================================================================

  setProject(project: ProjectState, onProjectUpdate: (project: ProjectState) => void): void {
    this.project = project;
    this.onProjectUpdate = onProjectUpdate;
    
    console.log('[AgentOrchestrator] Project bound:', project.name);
    
    // Check for proactive recommendations
    if (this.config.enableProactiveMode) {
      this.analyzeForRecommendations();
    }
    
    // Auto-resume if agent was active before page reload
    if (this.config.autoResumeOnLoad && this.state.wasRunningBeforeUnload) {
      console.log('[AgentOrchestrator] Auto-resuming agent (was active before reload)');
      // Use setTimeout to avoid running during React render
      setTimeout(() => this.start(), 100);
    }
    
    // Setup beforeunload handler to save state
    this.setupBeforeUnloadHandler();
  }
  
  private setupBeforeUnloadHandler(): void {
    window.addEventListener('beforeunload', () => {
      // Save current running state before page unload
      if (this.config.persistActiveState) {
        localStorage.setItem(STORAGE_KEYS.ACTIVE_STATE, String(this.state.isRunning));
      }
      this.saveState();
    });
  }
  
  // ============================================================================
  // PANEL STATE PERSISTENCE
  // ============================================================================
  
  static isPanelExpanded(): boolean {
    try {
      return localStorage.getItem(STORAGE_KEYS.PANEL_EXPANDED) === 'true';
    } catch {
      return false;
    }
  }
  
  static setPanelExpanded(expanded: boolean): void {
    try {
      localStorage.setItem(STORAGE_KEYS.PANEL_EXPANDED, String(expanded));
    } catch (error) {
      console.error('[AgentOrchestrator] Failed to save panel state:', error);
    }
  }
  
  shouldAutoResume(): boolean {
    return this.config.autoResumeOnLoad && this.state.wasRunningBeforeUnload;
  }
  
  wasActiveBeforeReload(): boolean {
    return this.state.wasRunningBeforeUnload;
  }

  updateProject(project: ProjectState): void {
    this.project = project;
    
    // Re-analyze on significant changes
    if (this.config.enableProactiveMode) {
      this.analyzeForRecommendations();
    }
  }

  // ============================================================================
  // TASK SCHEDULING
  // ============================================================================

  scheduleTask(
    type: SpecializedAgent,
    description: string,
    options: {
      priority?: AgentPriority;
      dependencies?: string[];
    } = {}
  ): AgentTask {
    const task: AgentTask = {
      id: `task_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      type,
      description,
      priority: options.priority || 'medium',
      status: 'queued',
      dependencies: options.dependencies || [],
    };

    this.state.queuedTasks.push(task);
    this.sortQueue();
    this.saveState();

    console.log(`[AgentOrchestrator] Task scheduled: ${task.id} (${type})`);
    
    // Auto-start if not running
    if (this.state.isRunning) {
      this.processQueue();
    }

    return task;
  }

  private sortQueue(): void {
    const priorityOrder: Record<AgentPriority, number> = {
      critical: 0,
      high: 1,
      medium: 2,
      low: 3,
    };

    this.state.queuedTasks.sort((a, b) => {
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    });
  }

  // ============================================================================
  // TASK EXECUTION
  // ============================================================================

  async start(): Promise<void> {
    if (this.state.isRunning) {
      console.log('[AgentOrchestrator] Already running');
      return;
    }

    this.state.isRunning = true;
    console.log('[AgentOrchestrator] Started');

    // Start background scheduler
    this.startScheduler();

    // Process queue
    await this.processQueue();
  }

  stop(): void {
    this.state.isRunning = false;
    
    if (this.schedulerInterval) {
      clearInterval(this.schedulerInterval);
      this.schedulerInterval = null;
    }

    // Abort all active tasks
    for (const task of this.state.activeTasks) {
      this.cancelActiveTask(task.id);
    }

    console.log('[AgentOrchestrator] Stopped');
    this.saveState();
  }

  private async processQueue(): Promise<void> {
    if (!this.state.isRunning) return;
    if (!this.project || !this.onProjectUpdate) {
      console.log('[AgentOrchestrator] No project bound, skipping queue processing');
      return;
    }

    // Check how many tasks we can run
    const availableSlots = this.config.maxParallelTasks - this.state.activeTasks.length;
    if (availableSlots <= 0) return;

    // Find tasks ready to run (dependencies met)
    const readyTasks = this.state.queuedTasks.filter(task => 
      this.areDependenciesMet(task)
    ).slice(0, availableSlots);

    // Start ready tasks
    for (const task of readyTasks) {
      // Move from queue to active
      this.state.queuedTasks = this.state.queuedTasks.filter(t => t.id !== task.id);
      this.state.activeTasks.push(task);
      
      // Execute async
      this.executeTask(task);
    }
  }

  private areDependenciesMet(task: AgentTask): boolean {
    return task.dependencies.every(depId => {
      const dep = this.state.completedTasks.find(t => t.id === depId);
      return dep && dep.status === 'completed';
    });
  }

  private async executeTask(task: AgentTask): Promise<void> {
    task.status = 'running';
    task.startedAt = new Date().toISOString();

    this.emit('task-started', { task });
    console.log(`[AgentOrchestrator] Executing task: ${task.id} (${task.type})`);

    // Check if already cancelled before starting
    if (this.cancelledTaskIds.has(task.id)) {
      task.status = 'cancelled';
      task.completedAt = new Date().toISOString();
      this.cancelledTaskIds.delete(task.id);
      this.emit('task-cancelled', { task });
      console.log(`[AgentOrchestrator] Task was cancelled before execution: ${task.id}`);
      
      // Move to completed and continue
      this.state.activeTasks = this.state.activeTasks.filter(t => t.id !== task.id);
      this.state.completedTasks.push(task);
      this.saveState();
      await this.processQueue();
      return;
    }

    // Create an AbortController for this task
    const abortController = new AbortController();
    this.taskAbortControllers.set(task.id, abortController);

    try {
      const result = await this.runSpecializedAgent(task, abortController.signal);

      // Check if cancelled during execution
      if (this.cancelledTaskIds.has(task.id)) {
        task.status = 'cancelled';
        task.completedAt = new Date().toISOString();
        this.cancelledTaskIds.delete(task.id);
        this.emit('task-cancelled', { task });
        console.log(`[AgentOrchestrator] Task cancelled during execution: ${task.id}`);
      } else {
        task.status = 'completed';
        task.result = result;
        task.completedAt = new Date().toISOString();

        this.emit('task-completed', { task });
        console.log(`[AgentOrchestrator] Task completed: ${task.id}`);

        // Remember the successful execution
        this.memory.remember({
          type: 'outcome',
          content: `Task "${task.description}" completed successfully`,
          metadata: {
            tags: ['task-success', task.type],
            confidence: 90,
          },
          importance: 0.6,
        });
      }

    } catch (error: any) {
      // Check if this was a cancellation
      if (error.message === 'Workflow cancelled' || abortController.signal.aborted) {
        // Only update if not already handled by cancelActiveTask
        if (this.state.activeTasks.some(t => t.id === task.id)) {
          task.status = 'cancelled';
          task.completedAt = new Date().toISOString();
          this.cancelledTaskIds.delete(task.id);
          this.emit('task-cancelled', { task });
          console.log(`[AgentOrchestrator] Task cancelled: ${task.id}`);
        }
      } else {
        task.status = 'failed';
        task.error = error.message;
        task.completedAt = new Date().toISOString();
        this.emit('task-failed', { task, error: error.message });
        console.error(`[AgentOrchestrator] Task failed: ${task.id}`, error);
      }
    } finally {
      // Clean up the abort controller
      this.taskAbortControllers.delete(task.id);
    }

    // Move to completed (only if not already handled by cancelActiveTask)
    if (this.state.activeTasks.some(t => t.id === task.id)) {
      this.state.activeTasks = this.state.activeTasks.filter(t => t.id !== task.id);
      this.state.completedTasks.push(task);
    }

    this.saveState();

    // Process more tasks
    await this.processQueue();
  }

  private async runSpecializedAgent(task: AgentTask, abortSignal?: AbortSignal): Promise<unknown> {
    if (!this.project || !this.onProjectUpdate) {
      throw new Error('No project bound');
    }

    const onProgress = (progress: WorkflowProgress) => {
      task.progress = progress;
    };

    const onApprovalRequired = async (action: AgentAction): Promise<boolean> => {
      // For now, auto-approve read/analyze actions
      if (action.type === 'read' || action.type === 'analyze') {
        return true;
      }
      // Emit event for UI to handle
      this.emit('approval-required', { task, action });
      // Default to true for background tasks (can be changed)
      return true;
    };

    const workflowOptions = {
      project: this.project,
      onProjectUpdate: this.onProjectUpdate,
      onProgress,
      onApprovalRequired,
      abortSignal,
    };

    switch (task.type) {
      case 'gap-analyzer':
        const gapResult = await runGapAnalysisWorkflow(workflowOptions);
        this.state.lastGapAnalysis = new Date().toISOString();
        
        // Create recommendations from gaps
        this.createGapRecommendations(gapResult);
        
        return gapResult;

      case 'validator':
        const validationResult = await runValidationWorkflow({
          ...workflowOptions,
        });
        this.state.lastValidation = new Date().toISOString();
        return validationResult;

      case 'scheduler':
        // Get first pending stakeholder from recommendations
        const stakeholderRec = this.state.proactiveRecommendations.find(
          r => r.type === 'clarification' && !r.actionTaken
        );
        
        if (stakeholderRec) {
          const clarification = await runStakeholderClarificationWorkflow({
            ...workflowOptions,
            stakeholder: stakeholderRec.title,
          });
          stakeholderRec.actionTaken = true;
          return clarification;
        }
        return null;

      case 'reporter':
        const report = await runProgressReportWorkflow({
          ...workflowOptions,
          periodDays: 7,
        });
        this.state.lastReport = new Date().toISOString();
        return report;

      case 'researcher':
        // Run cross-reference analysis
        const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
        const executor = new BRDActionExecutor(apiKey, this.project, this.onProjectUpdate);
        return executor.execute({
          id: 'research',
          goalId: 'research',
          type: 'analyze',
          name: 'cross-reference-sources',
          description: 'Research and cross-reference sources',
          parameters: {},
          status: 'pending',
          requiresApproval: false,
          retryCount: 0,
          estimatedImpact: 'none',
        });

      case 'conflict-resolver':
        // Detect and suggest conflict resolutions
        // This would integrate with ConflictDetection component
        return { message: 'Conflict resolution workflow to be implemented' };

      case 'monitor':
        // Monitor for changes and alert
        return this.monitorChanges();

      default:
        throw new Error(`Unknown agent type: ${task.type}`);
    }
  }

  // ============================================================================
  // PROACTIVE RECOMMENDATIONS
  // ============================================================================

  private async analyzeForRecommendations(): Promise<void> {
    if (!this.project) return;

    const now = new Date();
    const recommendations: ProactiveRecommendation[] = [];

    // Check if gap analysis is overdue
    if (this.state.lastGapAnalysis) {
      const lastGap = new Date(this.state.lastGapAnalysis);
      const hoursSince = (now.getTime() - lastGap.getTime()) / (1000 * 60 * 60);
      
      if (hoursSince > this.config.gapAnalysisIntervalHours) {
        recommendations.push({
          id: `rec_gap_${Date.now()}`,
          type: 'gap',
          title: 'Gap Analysis Overdue',
          description: `Last gap analysis was ${Math.round(hoursSince)} hours ago. New sources or insights may have introduced gaps.`,
          priority: 'medium',
          suggestedAction: 'run-gap-analysis',
          createdAt: now.toISOString(),
          dismissed: false,
          actionTaken: false,
        });
      }
    } else if (this.project.insights && this.project.insights.length > 0) {
      // Never ran gap analysis but have insights
      recommendations.push({
        id: `rec_gap_first_${Date.now()}`,
        type: 'gap',
        title: 'Run Initial Gap Analysis',
        description: `You have ${this.project.insights.length} insights but haven't run gap analysis yet.`,
        priority: 'high',
        suggestedAction: 'run-gap-analysis',
        createdAt: now.toISOString(),
        dismissed: false,
        actionTaken: false,
      });
    }

    // Check for pending insights
    const pendingInsights = this.project.insights?.filter(i => i.status === 'pending') || [];
    if (pendingInsights.length > 10) {
      recommendations.push({
        id: `rec_pending_${Date.now()}`,
        type: 'alert',
        title: 'Many Pending Insights',
        description: `${pendingInsights.length} insights are awaiting review. Consider reviewing them to improve BRD accuracy.`,
        priority: 'high',
        suggestedAction: 'review-insights',
        createdAt: now.toISOString(),
        dismissed: false,
        actionTaken: false,
      });
    }

    // Check for recent report
    if (!this.state.lastReport) {
      recommendations.push({
        id: `rec_report_${Date.now()}`,
        type: 'report',
        title: 'Generate Progress Report',
        description: 'No progress report has been generated yet. Generate one to track project status.',
        priority: 'low',
        suggestedAction: 'generate-report',
        createdAt: now.toISOString(),
        dismissed: false,
        actionTaken: false,
      });
    }

    // Check for validation
    const approvedInsights = this.project.insights?.filter(i => i.status === 'approved') || [];
    if (approvedInsights.length > 0 && !this.state.lastValidation) {
      recommendations.push({
        id: `rec_validate_${Date.now()}`,
        type: 'validation',
        title: 'Validate Requirements',
        description: `${approvedInsights.length} approved insights haven't been validated for quality yet.`,
        priority: 'medium',
        suggestedAction: 'run-validation',
        createdAt: now.toISOString(),
        dismissed: false,
        actionTaken: false,
      });
    }

    // Add new recommendations (avoid duplicates)
    recommendations.forEach(rec => {
      const exists = this.state.proactiveRecommendations.some(
        r => r.type === rec.type && r.suggestedAction === rec.suggestedAction && !r.dismissed
      );
      if (!exists) {
        this.state.proactiveRecommendations.push(rec);
        this.emit('recommendation', { recommendation: rec });
      }
    });

    this.saveState();
  }

  private createGapRecommendations(result: GapAnalysisResult): void {
    // Create recommendations from critical gaps
    result.gaps
      .filter(g => g.severity === 'critical' || g.severity === 'high')
      .slice(0, 5)
      .forEach(gap => {
        const rec: ProactiveRecommendation = {
          id: `rec_${gap.id}`,
          type: gap.type === 'missing-stakeholder' ? 'clarification' : 'gap',
          title: gap.title,
          description: gap.description,
          priority: gap.severity === 'critical' ? 'critical' : 'high',
          suggestedAction: gap.suggestedActions[0] || 'address-gap',
          createdAt: new Date().toISOString(),
          dismissed: false,
          actionTaken: false,
        };

        // Avoid duplicates
        const exists = this.state.proactiveRecommendations.some(
          r => r.title === rec.title
        );
        if (!exists) {
          this.state.proactiveRecommendations.push(rec);
          this.emit('recommendation', { recommendation: rec });
        }
      });

    this.saveState();
  }

  dismissRecommendation(id: string): void {
    const rec = this.state.proactiveRecommendations.find(r => r.id === id);
    if (rec) {
      rec.dismissed = true;
      this.saveState();
    }
  }

  actOnRecommendation(id: string): void {
    const rec = this.state.proactiveRecommendations.find(r => r.id === id);
    if (rec) {
      rec.actionTaken = true;
      
      // Schedule appropriate task
      switch (rec.suggestedAction) {
        case 'run-gap-analysis':
          this.scheduleTask('gap-analyzer', 'Run gap analysis', { priority: rec.priority });
          break;
        case 'run-validation':
          this.scheduleTask('validator', 'Validate requirements', { priority: rec.priority });
          break;
        case 'generate-report':
          this.scheduleTask('reporter', 'Generate progress report', { priority: rec.priority });
          break;
        case 'address-gap':
          // Create a task for manual follow-up
          break;
      }

      this.saveState();
    }
  }

  // ============================================================================
  // BACKGROUND SCHEDULER
  // ============================================================================

  private startScheduler(): void {
    if (this.schedulerInterval) return;

    // Check every 5 minutes
    this.schedulerInterval = setInterval(() => {
      this.runScheduledChecks();
    }, 5 * 60 * 1000);

    // Run immediately
    this.runScheduledChecks();
  }

  private async runScheduledChecks(): Promise<void> {
    if (!this.state.isRunning || !this.project) return;

    const now = new Date();

    // Auto-schedule gap analysis
    if (this.config.autoScheduleGapAnalysis) {
      const shouldRunGap = !this.state.lastGapAnalysis || 
        (now.getTime() - new Date(this.state.lastGapAnalysis).getTime()) > 
        (this.config.gapAnalysisIntervalHours * 60 * 60 * 1000);

      if (shouldRunGap && !this.hasTaskOfType('gap-analyzer')) {
        this.scheduleTask('gap-analyzer', 'Scheduled gap analysis', { priority: 'low' });
      }
    }

    // Auto-schedule validation
    if (this.config.autoScheduleValidation) {
      const shouldRunValidation = !this.state.lastValidation ||
        (now.getTime() - new Date(this.state.lastValidation).getTime()) >
        (this.config.validationIntervalHours * 60 * 60 * 1000);

      if (shouldRunValidation && !this.hasTaskOfType('validator')) {
        this.scheduleTask('validator', 'Scheduled validation', { priority: 'low' });
      }
    }

    // Analyze for new recommendations
    if (this.config.enableProactiveMode) {
      await this.analyzeForRecommendations();
    }
  }

  private hasTaskOfType(type: SpecializedAgent): boolean {
    return this.state.activeTasks.some(t => t.type === type) ||
           this.state.queuedTasks.some(t => t.type === type);
  }

  // ============================================================================
  // MONITORING
  // ============================================================================

  private async monitorChanges(): Promise<{ alerts: string[] }> {
    const alerts: string[] = [];

    if (!this.project) return { alerts };

    // Check for stale data
    const insights = this.project.insights || [];
    const oldPendingInsights = insights.filter(i => {
      if (i.status !== 'pending') return false;
      // Check if older than 3 days (would need createdAt field)
      return false; // Simplified for now
    });

    if (oldPendingInsights.length > 5) {
      alerts.push(`${oldPendingInsights.length} insights have been pending for over 3 days`);
    }

    // Check for low confidence BRD sections
    const lowConfidenceSections = this.project.brd?.sections?.filter(
      s => (s.confidence || 0) < 60
    ) || [];

    if (lowConfidenceSections.length > 0) {
      alerts.push(`${lowConfidenceSections.length} BRD sections have low confidence scores`);
    }

    // Emit alerts
    alerts.forEach(alert => {
      this.emit('alert', { message: alert });
    });

    return { alerts };
  }

  // ============================================================================
  // QUICK ACTIONS (Convenience Methods)
  // ============================================================================

  /**
   * Run comprehensive analysis (gap + validation + report)
   */
  async runFullAnalysis(): Promise<void> {
    const reportTask = this.scheduleTask('reporter', 'Generate comprehensive report', { priority: 'high' });
    const gapTask = this.scheduleTask('gap-analyzer', 'Full gap analysis', { priority: 'high' });
    const validationTask = this.scheduleTask('validator', 'Full validation', { 
      priority: 'medium',
      dependencies: [gapTask.id],
    });

    if (!this.state.isRunning) {
      await this.start();
    }
  }

  /**
   * Schedule stakeholder clarification workflow
   */
  scheduleStakeholderClarification(stakeholder: string): AgentTask {
    return this.scheduleTask('scheduler', `Schedule clarification with ${stakeholder}`, {
      priority: 'high',
    });
  }

  /**
   * Get current orchestrator status
   */
  getStatus(): {
    isRunning: boolean;
    activeTasks: number;
    queuedTasks: number;
    completedTasks: number;
    recommendations: number;
    lastActivity?: string;
  } {
    const lastCompleted = this.state.completedTasks[this.state.completedTasks.length - 1];

    return {
      isRunning: this.state.isRunning,
      activeTasks: this.state.activeTasks.length,
      queuedTasks: this.state.queuedTasks.length,
      completedTasks: this.state.completedTasks.length,
      recommendations: this.state.proactiveRecommendations.filter(r => !r.dismissed).length,
      lastActivity: lastCompleted?.completedAt,
    };
  }

  /**
   * Get active recommendations
   */
  getRecommendations(): ProactiveRecommendation[] {
    return this.state.proactiveRecommendations.filter(r => !r.dismissed && !r.actionTaken);
  }

  /**
   * Get recent task history
   */
  getTaskHistory(limit: number = 20): AgentTask[] {
    return this.state.completedTasks.slice(-limit).reverse();
  }

  /**
   * Cancel a queued task (before it starts)
   */
  cancelQueuedTask(taskId: string): boolean {
    const taskIndex = this.state.queuedTasks.findIndex(t => t.id === taskId);
    if (taskIndex === -1) {
      console.log(`[AgentOrchestrator] Task ${taskId} not found in queue`);
      return false;
    }

    const task = this.state.queuedTasks[taskIndex];
    task.status = 'cancelled';
    task.completedAt = new Date().toISOString();
    
    // Move to completed
    this.state.queuedTasks.splice(taskIndex, 1);
    this.state.completedTasks.push(task);
    
    this.emit('task-cancelled', { task });
    this.saveState();
    
    console.log(`[AgentOrchestrator] Task cancelled: ${taskId}`);
    return true;
  }

  /**
   * Cancel an active (running) task - immediately aborts the workflow
   */
  cancelActiveTask(taskId: string): boolean {
    const task = this.state.activeTasks.find(t => t.id === taskId);
    if (!task) {
      console.log(`[AgentOrchestrator] Task ${taskId} not found in active tasks`);
      return false;
    }

    // Mark for cancellation
    this.cancelledTaskIds.add(taskId);
    console.log(`[AgentOrchestrator] Task marked for cancellation: ${taskId}`);
    
    // Abort the workflow immediately if we have an abort controller
    const abortController = this.taskAbortControllers.get(taskId);
    if (abortController) {
      abortController.abort();
      console.log(`[AgentOrchestrator] Abort signal sent for task: ${taskId}`);
    }
    
    // Immediately update UI state
    task.status = 'cancelled';
    task.completedAt = new Date().toISOString();
    
    // Remove from active tasks and move to completed
    this.state.activeTasks = this.state.activeTasks.filter(t => t.id !== taskId);
    this.state.completedTasks.push(task);
    this.saveState();
    
    this.emit('task-cancelled', { task });
    
    return true;
  }

  /**
   * Delete a task from history
   */
  deleteFromHistory(taskId: string): boolean {
    const taskIndex = this.state.completedTasks.findIndex(t => t.id === taskId);
    if (taskIndex === -1) {
      console.log(`[AgentOrchestrator] Task ${taskId} not found in history`);
      return false;
    }

    this.state.completedTasks.splice(taskIndex, 1);
    this.saveState();
    
    console.log(`[AgentOrchestrator] Task deleted from history: ${taskId}`);
    return true;
  }

  /**
   * Clear all task history
   */
  clearHistory(): void {
    this.state.completedTasks = [];
    this.saveState();
    console.log('[AgentOrchestrator] Task history cleared');
  }

  /**
   * Get all queued tasks
   */
  getQueuedTasks(): AgentTask[] {
    return [...this.state.queuedTasks];
  }

  /**
   * Get all active tasks
   */
  getActiveTasks(): AgentTask[] {
    return [...this.state.activeTasks];
  }

  // ============================================================================
  // EVENTS
  // ============================================================================

  on(event: string, callback: (event: OrchestratorEvent) => void): () => void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, new Set());
    }
    this.eventListeners.get(event)!.add(callback);

    return () => {
      this.eventListeners.get(event)?.delete(callback);
    };
  }

  private emit(type: string, data: unknown): void {
    const event: OrchestratorEvent = {
      type: type as OrchestratorEvent['type'],
      timestamp: new Date().toISOString(),
      data,
    };

    this.eventListeners.get(type)?.forEach(cb => {
      try {
        cb(event);
      } catch (error) {
        console.error('[AgentOrchestrator] Event listener error:', error);
      }
    });

    // Also emit to wildcard listeners
    this.eventListeners.get('*')?.forEach(cb => {
      try {
        cb(event);
      } catch (error) {
        console.error('[AgentOrchestrator] Event listener error:', error);
      }
    });
  }

  // ============================================================================
  // CONFIGURATION
  // ============================================================================

  updateConfig(updates: Partial<OrchestratorConfig>): void {
    this.config = { ...this.config, ...updates };
    localStorage.setItem(STORAGE_KEYS.CONFIG, JSON.stringify(this.config));
  }

  getConfig(): OrchestratorConfig {
    return { ...this.config };
  }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

let orchestratorInstance: AgentOrchestrator | null = null;

export const getAgentOrchestrator = (config?: Partial<OrchestratorConfig>): AgentOrchestrator => {
  if (!orchestratorInstance) {
    orchestratorInstance = new AgentOrchestrator(config);
  }
  return orchestratorInstance;
};

export const resetAgentOrchestrator = (): void => {
  if (orchestratorInstance) {
    orchestratorInstance.stop();
  }
  orchestratorInstance = null;
};
