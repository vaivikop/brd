/**
 * Agent System - Public API
 * 
 * Re-exports all agent components for easy consumption
 */

// Core Agent Engine
export {
  AgentCore,
  getAgentCore,
  resetAgentCore,
  type AgentStatus,
  type AgentPriority,
  type AgentCapability,
  type AgentGoal,
  type AgentConstraints,
  type AgentAction,
  type AgentActionType,
  type AgentActionResult,
  type AgentPlan,
  type AgentRisk,
  type AgentSession,
  type AgentLogEntry,
  type AgentSessionMetrics,
  type AgentCheckpoint,
  type AgentConfig,
  type AgentEvent,
  type ActionExecutor,
  DEFAULT_AGENT_CONFIG,
} from './AgentCore';

// Workflows
export {
  BRDActionExecutor,
  runGapAnalysisWorkflow,
  runStakeholderClarificationWorkflow,
  runValidationWorkflow,
  runProgressReportWorkflow,
  type GapAnalysisResult,
  type IdentifiedGap,
  type GapRecommendation,
  type StakeholderClarification,
  type ClarificationQuestion,
  type ValidationResult,
  type ValidationIssue,
  type ProgressReport,
  type ProgressMetrics,
  type WorkflowOptions,
  type WorkflowProgress,
} from './AgentWorkflows';

// Memory System
export {
  AgentMemory,
  getAgentMemory,
  resetAgentMemory,
  type MemoryEntry,
  type MemoryType,
  type MemoryMetadata,
  type WorkingMemory,
  type ContextFrame,
  type LearningFeedback,
  type PatternMatch,
  type MemorySearchResult,
} from './AgentMemory';

// Orchestrator
export {
  AgentOrchestrator,
  getAgentOrchestrator,
  resetAgentOrchestrator,
  type SpecializedAgent,
  type AgentTask,
  type OrchestratorConfig,
  type OrchestratorState,
  type ProactiveRecommendation,
  type OrchestratorEvent,
} from './AgentOrchestrator';
