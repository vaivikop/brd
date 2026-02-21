import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Bot,
  Play,
  Pause,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Clock,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Zap,
  Search,
  FileText,
  Users,
  Target,
  BarChart3,
  Lightbulb,
  Settings,
  Activity,
  History,
  Brain,
  Sparkles,
  Shield,
  X,
  Check,
  Loader2,
  ChevronRight,
  ArrowRight,
  Eye,
  MessageSquare,
  Trash2,
  StopCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import Button from './Button';
import Tooltip from './Tooltip';
import { ProjectState } from '../utils/db';
import {
  getAgentOrchestrator,
  AgentOrchestrator,
  AgentTask,
  ProactiveRecommendation,
  OrchestratorEvent,
  runGapAnalysisWorkflow,
  runValidationWorkflow,
  runProgressReportWorkflow,
  GapAnalysisResult,
  ValidationResult,
  ProgressReport,
  getAgentMemory,
} from '../services/agents';
import { getHealthMonitor, HealthStatus, initializeHealthMonitoring } from '../services/EnterpriseUtils';
import { generateStatusReport, RequirementConflict } from '../utils/services/ai';
import { useToast } from '../context/ToastContext';

// ============================================================================
// TYPES
// ============================================================================

interface AgentPanelProps {
  project: ProjectState;
  onProjectUpdate: (project: ProjectState) => void;
  isExpanded?: boolean;
  onToggleExpand?: () => void;
  onNavigateToStatusReport?: () => void;
}

type TabType = 'overview' | 'tasks' | 'recommendations' | 'history' | 'settings';

// ============================================================================
// COMPONENT
// ============================================================================

const AgentPanel: React.FC<AgentPanelProps> = ({
  project,
  onProjectUpdate,
  isExpanded = false,
  onToggleExpand,
  onNavigateToStatusReport,
}) => {
  const { showToast } = useToast();
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [orchestrator, setOrchestrator] = useState<AgentOrchestrator | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [activeTasks, setActiveTasks] = useState<AgentTask[]>([]);
  const [queuedTasks, setQueuedTasks] = useState<AgentTask[]>([]);
  const [recommendations, setRecommendations] = useState<ProactiveRecommendation[]>([]);
  const [taskHistory, setTaskHistory] = useState<AgentTask[]>([]);
  const [runningWorkflow, setRunningWorkflow] = useState<string | null>(null);
  const [workflowProgress, setWorkflowProgress] = useState<number>(0);
  const [lastGapAnalysis, setLastGapAnalysis] = useState<GapAnalysisResult | null>(null);
  const [showApprovalModal, setShowApprovalModal] = useState(false);
  const [pendingApproval, setPendingApproval] = useState<{ task: AgentTask; action: any } | null>(null);
  const [healthStatus, setHealthStatus] = useState<HealthStatus | null>(null);
  
  // Initialize health monitoring
  useEffect(() => {
    initializeHealthMonitoring(60000); // Check every 60 seconds
    
    // Get initial health status
    const monitor = getHealthMonitor();
    monitor.runHealthChecks().then(setHealthStatus);
    
    // Update health status periodically
    const interval = setInterval(() => {
      const status = monitor.getLastHealthStatus();
      if (status) setHealthStatus(status);
    }, 10000);
    
    return () => clearInterval(interval);
  }, []);

  // Initialize orchestrator
  useEffect(() => {
    const orch = getAgentOrchestrator();
    orch.setProject(project, onProjectUpdate);
    setOrchestrator(orch);

    // Subscribe to events
    const unsubTaskStarted = orch.on('task-started', (event) => {
      updateStatus(orch);
      showToast({ title: `Agent started: ${(event.data as any).task?.description}`, type: 'info' });
    });

    const unsubTaskCompleted = orch.on('task-completed', (event) => {
      updateStatus(orch);
      showToast({ title: `Agent completed: ${(event.data as any).task?.description}`, type: 'success' });
    });

    const unsubTaskFailed = orch.on('task-failed', (event) => {
      updateStatus(orch);
      showToast({ title: `Agent failed: ${(event.data as any).error}`, type: 'error' });
    });

    const unsubRecommendation = orch.on('recommendation', (event) => {
      const rec = (event.data as any).recommendation as ProactiveRecommendation;
      setRecommendations(prev => [...prev, rec]);
    });

    const unsubApproval = orch.on('approval-required', (event) => {
      setPendingApproval(event.data as any);
      setShowApprovalModal(true);
    });

    const unsubTaskCancelled = orch.on('task-cancelled', (event) => {
      updateStatus(orch);
      showToast({ title: `Task cancelled`, type: 'info' });
    });

    // Initial status
    updateStatus(orch);

    return () => {
      unsubTaskStarted();
      unsubTaskCompleted();
      unsubTaskFailed();
      unsubRecommendation();
      unsubApproval();
      unsubTaskCancelled();
    };
  }, []);

  // Update project in orchestrator when it changes
  useEffect(() => {
    if (orchestrator) {
      orchestrator.updateProject(project);
    }
  }, [project, orchestrator]);

  const updateStatus = useCallback((orch: AgentOrchestrator) => {
    const status = orch.getStatus();
    setIsRunning(status.isRunning);
    setRecommendations(orch.getRecommendations());
    setTaskHistory(orch.getTaskHistory(20));
    setActiveTasks(orch.getActiveTasks());
    setQueuedTasks(orch.getQueuedTasks());
  }, []);

  // ============================================================================
  // ACTIONS
  // ============================================================================

  const handleStart = async () => {
    if (orchestrator) {
      await orchestrator.start();
      updateStatus(orchestrator);
    }
  };

  const handleStop = () => {
    if (orchestrator) {
      orchestrator.stop();
      updateStatus(orchestrator);
    }
  };

  const handleRunGapAnalysis = async () => {
    setRunningWorkflow('gap-analysis');
    setWorkflowProgress(0);

    try {
      const result = await runGapAnalysisWorkflow({
        project,
        onProjectUpdate,
        onProgress: (progress) => {
          setWorkflowProgress(Math.round((progress.currentStep / progress.totalSteps) * 100));
        },
        autoApprove: true,
      });

      setLastGapAnalysis(result);
      showToast({ title: `Found ${result.gaps.length} gaps (${result.criticalMissing.length} critical)`, type: 'success' });
    } catch (error: any) {
      showToast({ title: `Gap analysis failed: ${error.message}`, type: 'error' });
    } finally {
      setRunningWorkflow(null);
      if (orchestrator) updateStatus(orchestrator);
    }
  };

  const handleRunValidation = async () => {
    setRunningWorkflow('validation');
    setWorkflowProgress(0);

    try {
      const result = await runValidationWorkflow({
        project,
        onProjectUpdate,
        onProgress: (progress) => {
          setWorkflowProgress(Math.round((progress.currentStep / progress.totalSteps) * 100));
        },
      });

      showToast({
        title: `Validation complete: ${result.summary.valid} valid, ${result.summary.invalid} invalid`,
        type: result.summary.invalid > 0 ? 'warning' : 'success'
      });
    } catch (error: any) {
      showToast({ title: `Validation failed: ${error.message}`, type: 'error' });
    } finally {
      setRunningWorkflow(null);
      if (orchestrator) updateStatus(orchestrator);
    }
  };

  const handleRunReport = async () => {
    setRunningWorkflow('report');
    setWorkflowProgress(0);

    try {
      // Generate progress using simulated steps
      setWorkflowProgress(10);
      
      const conflicts = (project as any).conflicts as RequirementConflict[] | undefined;
      
      setWorkflowProgress(30);
      
      // Generate actual status report using AI
      const statusReport = await generateStatusReport(
        {
          name: project.name,
          goals: project.goals,
          timeline: project.timeline,
          status: project.status
        },
        project.insights || [],
        project.brd?.sections,
        conflicts
      );

      setWorkflowProgress(80);

      // Store report in project state
      const updatedProject = { ...project, statusReport } as ProjectState;
      onProjectUpdate(updatedProject);
      
      // Save to history for StatusReportView
      const REPORT_HISTORY_KEY = 'clarity_report_history';
      try {
        const existingHistory = localStorage.getItem(`${REPORT_HISTORY_KEY}_${project.id}`);
        const history = existingHistory ? JSON.parse(existingHistory) : [];
        const avgProgress = statusReport.progressMetrics.length > 0 
          ? Math.round(statusReport.progressMetrics.reduce((a: number, m: any) => a + m.current, 0) / statusReport.progressMetrics.length)
          : 0;
        const historyEntry = {
          id: `report_${Date.now()}`,
          generatedAt: statusReport.generatedAt,
          title: statusReport.title,
          executiveSummary: statusReport.executiveSummary,
          averageProgress: avgProgress,
          totalRisks: statusReport.activeRisks.length,
          totalActionItems: statusReport.actionItems.length
        };
        const updatedHistory = [...history, historyEntry].slice(-20);
        localStorage.setItem(`${REPORT_HISTORY_KEY}_${project.id}`, JSON.stringify(updatedHistory));
        // Dispatch event to notify StatusReportView
        window.dispatchEvent(new CustomEvent('statusReportGenerated', { detail: { projectId: project.id } }));
      } catch (e) {
        console.error('Failed to save report to history:', e);
      }

      setWorkflowProgress(100);
      
      showToast({ title: 'Status report generated successfully', type: 'success' });
      
      // Navigate to status report page after a short delay
      setTimeout(() => {
        if (onNavigateToStatusReport) {
          onNavigateToStatusReport();
        }
      }, 500);
    } catch (error: any) {
      showToast({ title: `Report generation failed: ${error.message}`, type: 'error' });
    } finally {
      setRunningWorkflow(null);
      if (orchestrator) updateStatus(orchestrator);
    }
  };

  const handleRunFullAnalysis = async () => {
    if (orchestrator) {
      await orchestrator.runFullAnalysis();
      updateStatus(orchestrator);
      showToast({ title: 'Full analysis scheduled', type: 'info' });
    }
  };

  const handleActOnRecommendation = (rec: ProactiveRecommendation) => {
    if (orchestrator) {
      orchestrator.actOnRecommendation(rec.id);
      updateStatus(orchestrator);
      showToast({ title: `Action scheduled: ${rec.title}`, type: 'info' });
    }
  };

  const handleDismissRecommendation = (rec: ProactiveRecommendation) => {
    if (orchestrator) {
      orchestrator.dismissRecommendation(rec.id);
      updateStatus(orchestrator);
    }
  };

  // ============================================================================
  // COMPUTED VALUES
  // ============================================================================

  const stats = useMemo(() => {
    const memory = getAgentMemory();
    const memStats = memory.getStats();

    return {
      insights: project.insights?.length || 0,
      pending: project.insights?.filter(i => i.status === 'pending').length || 0,
      approved: project.insights?.filter(i => i.status === 'approved').length || 0,
      tasks: project.tasks?.length || 0,
      memories: memStats.totalMemories,
      learnings: memStats.totalLearnings,
    };
  }, [project]);

  // ============================================================================
  // RENDER HELPERS
  // ============================================================================

  const renderPriorityBadge = (priority: string) => {
    const colors: Record<string, string> = {
      critical: 'bg-red-100 text-red-700',
      high: 'bg-orange-100 text-orange-700',
      medium: 'bg-yellow-100 text-yellow-700',
      low: 'bg-slate-100 text-slate-600',
    };
    return (
      <span className={`px-2 py-0.5 rounded text-xs font-medium ${colors[priority] || colors.medium}`}>
        {priority}
      </span>
    );
  };

  const renderStatusBadge = (status: string) => {
    const config: Record<string, { bg: string; icon: React.ReactNode }> = {
      queued: { bg: 'bg-slate-100 text-slate-600', icon: <Clock className="w-3 h-3" /> },
      running: { bg: 'bg-blue-100 text-blue-700', icon: <Loader2 className="w-3 h-3 animate-spin" /> },
      completed: { bg: 'bg-emerald-100 text-emerald-700', icon: <CheckCircle2 className="w-3 h-3" /> },
      failed: { bg: 'bg-red-100 text-red-700', icon: <XCircle className="w-3 h-3" /> },
      cancelled: { bg: 'bg-slate-100 text-slate-500', icon: <X className="w-3 h-3" /> },
    };
    const { bg, icon } = config[status] || config.queued;
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${bg}`}>
        {icon}
        {status}
      </span>
    );
  };

  // ============================================================================
  // TAB CONTENT
  // ============================================================================

  const renderOverviewTab = () => (
    <div className="space-y-4">
      {/* System Health Warning */}
      {healthStatus && healthStatus.status !== 'healthy' && (
        <div className={`p-2 rounded-lg text-xs flex items-center gap-2 ${
          healthStatus.status === 'unhealthy' 
            ? 'bg-red-50 border border-red-200 text-red-700'
            : 'bg-amber-50 border border-amber-200 text-amber-700'
        }`}>
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          <span>{healthStatus.summary}</span>
        </div>
      )}
      
      {/* Auto-Resumed Notification */}
      {orchestrator?.wasActiveBeforeReload() && !isRunning && (
        <div className="p-2 rounded-lg bg-blue-50 border border-blue-200 text-blue-700 text-xs flex items-center gap-2">
          <RefreshCw className="w-4 h-4 flex-shrink-0" />
          <span>Agent was active before reload. Click Start to resume.</span>
        </div>
      )}
      
      {/* Status Bar */}
      <div className="flex items-center justify-between p-3 bg-gradient-to-r from-indigo-50 to-purple-50 rounded-lg border border-indigo-100">
        <div className="flex items-center gap-3">
          <div className={`w-2 h-2 rounded-full ${isRunning ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'}`} />
          <span className="text-sm font-medium text-slate-700">
            Agent {isRunning ? 'Active' : 'Idle'}
          </span>
          {activeTasks.length > 0 && (
            <span className="text-xs text-slate-500">
              ({activeTasks.length} running, {queuedTasks.length} queued)
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {isRunning ? (
            <Button variant="ghost" size="sm" onClick={handleStop}>
              <Pause className="w-4 h-4 mr-1" />
              Pause
            </Button>
          ) : (
            <Button variant="primary" size="sm" onClick={handleStart}>
              <Play className="w-4 h-4 mr-1" />
              Start
            </Button>
          )}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-2 gap-3">
        <button
          onClick={handleRunGapAnalysis}
          disabled={!!runningWorkflow}
          className="flex items-center gap-3 p-3 bg-white border border-slate-200 rounded-lg hover:border-blue-300 hover:bg-blue-50/50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <div className="p-2 bg-blue-100 rounded-lg">
            <Search className="w-4 h-4 text-blue-600" />
          </div>
          <div className="text-left">
            <div className="text-sm font-medium text-slate-800">Gap Analysis</div>
            <div className="text-xs text-slate-500">Find missing info</div>
          </div>
          {runningWorkflow === 'gap-analysis' && (
            <div className="ml-auto">
              <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
            </div>
          )}
        </button>

        <button
          onClick={handleRunValidation}
          disabled={!!runningWorkflow}
          className="flex items-center gap-3 p-3 bg-white border border-slate-200 rounded-lg hover:border-emerald-300 hover:bg-emerald-50/50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <div className="p-2 bg-emerald-100 rounded-lg">
            <Shield className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-left">
            <div className="text-sm font-medium text-slate-800">Validate</div>
            <div className="text-xs text-slate-500">Check requirements</div>
          </div>
          {runningWorkflow === 'validation' && (
            <div className="ml-auto">
              <Loader2 className="w-4 h-4 animate-spin text-emerald-600" />
            </div>
          )}
        </button>

        <button
          onClick={handleRunReport}
          disabled={!!runningWorkflow}
          className="flex items-center gap-3 p-3 bg-white border border-slate-200 rounded-lg hover:border-purple-300 hover:bg-purple-50/50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <div className="p-2 bg-purple-100 rounded-lg">
            <BarChart3 className="w-4 h-4 text-purple-600" />
          </div>
          <div className="text-left">
            <div className="text-sm font-medium text-slate-800">Report</div>
            <div className="text-xs text-slate-500">Generate status</div>
          </div>
          {runningWorkflow === 'report' && (
            <div className="ml-auto">
              <Loader2 className="w-4 h-4 animate-spin text-purple-600" />
            </div>
          )}
        </button>

        <button
          onClick={handleRunFullAnalysis}
          disabled={!!runningWorkflow}
          className="flex items-center gap-3 p-3 bg-white border border-slate-200 rounded-lg hover:border-amber-300 hover:bg-amber-50/50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <div className="p-2 bg-amber-100 rounded-lg">
            <Zap className="w-4 h-4 text-amber-600" />
          </div>
          <div className="text-left">
            <div className="text-sm font-medium text-slate-800">Full Analysis</div>
            <div className="text-xs text-slate-500">Run everything</div>
          </div>
        </button>
      </div>

      {/* Progress Bar */}
      {runningWorkflow && (
        <div className="p-3 bg-slate-50 rounded-lg">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-slate-700">
              Running {runningWorkflow.replace('-', ' ')}...
            </span>
            <span className="text-sm text-slate-500">{workflowProgress}%</span>
          </div>
          <div className="w-full bg-slate-200 rounded-full h-2">
            <motion.div
              className="bg-indigo-600 h-2 rounded-full"
              initial={{ width: 0 }}
              animate={{ width: `${workflowProgress}%` }}
              transition={{ duration: 0.3 }}
            />
          </div>
        </div>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-3 gap-3">
        <div className="p-3 bg-slate-50 rounded-lg text-center">
          <div className="text-2xl font-bold text-slate-800">{stats.insights}</div>
          <div className="text-xs text-slate-500">Insights</div>
        </div>
        <div className="p-3 bg-slate-50 rounded-lg text-center">
          <div className="text-2xl font-bold text-amber-600">{stats.pending}</div>
          <div className="text-xs text-slate-500">Pending</div>
        </div>
        <div className="p-3 bg-slate-50 rounded-lg text-center">
          <div className="text-2xl font-bold text-emerald-600">{stats.approved}</div>
          <div className="text-xs text-slate-500">Approved</div>
        </div>
      </div>

      {/* Active Recommendations */}
      {recommendations.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-slate-700">Recommendations</span>
            <span className="text-xs text-slate-500">{recommendations.length} items</span>
          </div>
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {recommendations.slice(0, 3).map((rec) => (
              <div
                key={rec.id}
                className="p-3 bg-white border border-slate-200 rounded-lg hover:border-indigo-200 transition-colors"
              >
                <div className="flex items-start gap-3">
                  <div className={`p-1.5 rounded ${
                    rec.type === 'gap' ? 'bg-blue-100' :
                    rec.type === 'clarification' ? 'bg-purple-100' :
                    rec.type === 'validation' ? 'bg-emerald-100' :
                    rec.type === 'alert' ? 'bg-red-100' :
                    'bg-slate-100'
                  }`}>
                    {rec.type === 'gap' && <Search className="w-3 h-3 text-blue-600" />}
                    {rec.type === 'clarification' && <Users className="w-3 h-3 text-purple-600" />}
                    {rec.type === 'validation' && <Shield className="w-3 h-3 text-emerald-600" />}
                    {rec.type === 'alert' && <AlertTriangle className="w-3 h-3 text-red-600" />}
                    {rec.type === 'report' && <FileText className="w-3 h-3 text-slate-600" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-slate-800 truncate">{rec.title}</span>
                      {renderPriorityBadge(rec.priority)}
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">{rec.description}</p>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleActOnRecommendation(rec)}
                      className="p-1 hover:bg-emerald-100 rounded transition-colors"
                      title="Take action"
                    >
                      <Check className="w-4 h-4 text-emerald-600" />
                    </button>
                    <button
                      onClick={() => handleDismissRecommendation(rec)}
                      className="p-1 hover:bg-slate-100 rounded transition-colors"
                      title="Dismiss"
                    >
                      <X className="w-4 h-4 text-slate-400" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Gap Analysis Results */}
      {lastGapAnalysis && (
        <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-blue-800">Last Gap Analysis</span>
            <span className="text-xs text-blue-600">{lastGapAnalysis.gaps.length} gaps found</span>
          </div>
          <div className="flex items-center gap-4 text-xs">
            <span className="text-blue-700">
              Completeness: <strong>{lastGapAnalysis.completenessScore}%</strong>
            </span>
            <span className="text-red-600">
              Critical: <strong>{lastGapAnalysis.criticalMissing.length}</strong>
            </span>
          </div>
          {lastGapAnalysis.criticalMissing.length > 0 && (
            <ul className="mt-2 text-xs text-blue-700 space-y-1">
              {lastGapAnalysis.criticalMissing.slice(0, 3).map((gap, i) => (
                <li key={i} className="flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3 text-red-500" />
                  {gap}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );

  const renderTasksTab = () => {
    const handleCancelQueuedTask = (taskId: string) => {
      if (orchestrator) {
        orchestrator.cancelQueuedTask(taskId);
        updateStatus(orchestrator);
        showToast({ title: 'Task cancelled', type: 'info' });
      }
    };

    const handleStopActiveTask = (taskId: string) => {
      if (orchestrator) {
        orchestrator.cancelActiveTask(taskId);
        updateStatus(orchestrator);
        showToast({ title: 'Stopping task...', type: 'info' });
      }
    };

    return (
      <div className="space-y-4">
        {/* Active Tasks */}
        {activeTasks.length > 0 && (
          <div className="space-y-2">
            <div className="text-sm font-medium text-slate-700">Active Tasks</div>
            {activeTasks.map((task) => (
              <div key={task.id} className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <Loader2 className="w-4 h-4 animate-spin text-blue-600 flex-shrink-0" />
                    <span className="text-sm font-medium text-blue-800 truncate">{task.description}</span>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {renderPriorityBadge(task.priority)}
                    <button
                      onClick={() => handleStopActiveTask(task.id)}
                      className="p-1.5 text-red-500 hover:bg-red-100 rounded transition-colors"
                      title="Stop task"
                    >
                      <StopCircle className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                {task.progress && (
                  <div className="mt-2">
                    <div className="flex justify-between text-xs text-blue-600 mb-1">
                      <span>{task.progress.currentAction}</span>
                      <span>{task.progress.currentStep}/{task.progress.totalSteps}</span>
                    </div>
                    <div className="w-full bg-blue-200 rounded-full h-1.5">
                      <div
                        className="bg-blue-600 h-1.5 rounded-full transition-all"
                        style={{ width: `${(task.progress.currentStep / task.progress.totalSteps) * 100}%` }}
                      />
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Queued Tasks */}
        {queuedTasks.length > 0 && (
          <div className="space-y-2">
            <div className="text-sm font-medium text-slate-700">Queued ({queuedTasks.length})</div>
            {queuedTasks.map((task) => (
              <div key={task.id} className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <Clock className="w-4 h-4 text-slate-400 flex-shrink-0" />
                    <span className="text-sm text-slate-700 truncate">{task.description}</span>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {renderPriorityBadge(task.priority)}
                    <button
                      onClick={() => handleCancelQueuedTask(task.id)}
                      className="p-1 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors"
                      title="Cancel task"
                    >
                      <StopCircle className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                {task.dependencies.length > 0 && (
                  <div className="mt-1 text-xs text-slate-500">
                    Waiting for: {task.dependencies.length} task(s)
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {activeTasks.length === 0 && queuedTasks.length === 0 && (
          <div className="text-center py-8 text-slate-500">
            <Bot className="w-12 h-12 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No active or queued tasks</p>
            <p className="text-xs mt-1">Use quick actions to start agent workflows</p>
          </div>
        )}
      </div>
    );
  };

  const renderRecommendationsTab = () => (
    <div className="space-y-3">
      {recommendations.length > 0 ? (
        recommendations.map((rec) => (
          <motion.div
            key={rec.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-4 bg-white border border-slate-200 rounded-lg"
          >
            <div className="flex items-start gap-3">
              <div className={`p-2 rounded-lg ${
                rec.priority === 'critical' ? 'bg-red-100' :
                rec.priority === 'high' ? 'bg-orange-100' :
                'bg-slate-100'
              }`}>
                <Lightbulb className={`w-4 h-4 ${
                  rec.priority === 'critical' ? 'text-red-600' :
                  rec.priority === 'high' ? 'text-orange-600' :
                  'text-slate-600'
                }`} />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-medium text-slate-800">{rec.title}</span>
                  {renderPriorityBadge(rec.priority)}
                </div>
                <p className="text-sm text-slate-600 mb-3">{rec.description}</p>
                <div className="flex items-center gap-2">
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => handleActOnRecommendation(rec)}
                  >
                    Take Action
                    <ArrowRight className="w-3 h-3 ml-1" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDismissRecommendation(rec)}
                  >
                    Dismiss
                  </Button>
                </div>
              </div>
            </div>
          </motion.div>
        ))
      ) : (
        <div className="text-center py-8 text-slate-500">
          <CheckCircle2 className="w-12 h-12 mx-auto mb-2 text-emerald-500 opacity-50" />
          <p className="text-sm">No recommendations right now</p>
          <p className="text-xs mt-1">The agent will suggest actions as needed</p>
        </div>
      )}
    </div>
  );

  const renderHistoryTab = () => {
    const handleDeleteHistoryItem = (taskId: string) => {
      if (orchestrator) {
        orchestrator.deleteFromHistory(taskId);
        updateStatus(orchestrator);
        showToast({ title: 'Task removed from history', type: 'info' });
      }
    };

    const handleClearHistory = () => {
      if (orchestrator && confirm('Are you sure you want to clear all task history?')) {
        orchestrator.clearHistory();
        updateStatus(orchestrator);
        showToast({ title: 'History cleared', type: 'info' });
      }
    };

    return (
      <div className="space-y-2">
        {taskHistory.length > 0 && (
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-slate-500">{taskHistory.length} task(s)</span>
            <button
              onClick={handleClearHistory}
              className="text-xs text-red-500 hover:text-red-700 hover:underline flex items-center gap-1"
            >
              <Trash2 className="w-3 h-3" />
              Clear All
            </button>
          </div>
        )}
        
        {taskHistory.length > 0 ? (
          taskHistory.map((task) => (
            <div
              key={task.id}
              className="p-3 bg-slate-50 border border-slate-200 rounded-lg group"
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-medium text-slate-700 truncate flex-1">{task.description}</span>
                <div className="flex items-center gap-2">
                  {renderStatusBadge(task.status)}
                  <button
                    onClick={() => handleDeleteHistoryItem(task.id)}
                    className="p-1 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded opacity-0 group-hover:opacity-100 transition-all"
                    title="Remove from history"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
              <div className="flex items-center gap-3 text-xs text-slate-500">
                <span className="capitalize">{task.type.replace('-', ' ')}</span>
                {task.completedAt && (
                  <span>
                    {new Date(task.completedAt).toLocaleString()}
                  </span>
                )}
              </div>
              {task.error && (
                <div className="mt-2 text-xs text-red-600 bg-red-50 p-2 rounded">
                  Error: {task.error}
                </div>
              )}
            </div>
          ))
        ) : (
          <div className="text-center py-8 text-slate-500">
            <History className="w-12 h-12 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No task history yet</p>
          </div>
        )}
      </div>
    );
  };

  const renderSettingsTab = () => {
    const config = orchestrator?.getConfig();
    
    const healthStatusColor = {
      healthy: 'bg-emerald-500',
      degraded: 'bg-amber-500',
      unhealthy: 'bg-red-500',
      unknown: 'bg-slate-400',
    };
    
    return (
      <div className="space-y-4">
        {/* System Health Status */}
        <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-slate-700">System Health</span>
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${healthStatus ? healthStatusColor[healthStatus.status] : 'bg-slate-400'}`} />
              <span className="text-xs text-slate-600 capitalize">{healthStatus?.status || 'Unknown'}</span>
            </div>
          </div>
          {healthStatus && (
            <div className="space-y-1">
              {healthStatus.checks.map(check => (
                <div key={check.name} className="flex items-center justify-between text-xs">
                  <span className="text-slate-500 capitalize">{check.name}</span>
                  <span className={`font-medium ${
                    check.status === 'pass' ? 'text-emerald-600' :
                    check.status === 'warn' ? 'text-amber-600' : 'text-red-600'
                  }`}>
                    {check.status === 'pass' ? '✓' : check.status === 'warn' ? '⚠' : '✗'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Agent Settings */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-medium text-slate-700">Auto-Resume Agent</div>
              <div className="text-xs text-slate-500">Resume on page reload</div>
            </div>
            <button
              onClick={() => orchestrator?.updateConfig({
                autoResumeOnLoad: !config?.autoResumeOnLoad
              })}
              className={`relative w-10 h-6 rounded-full transition-colors ${
                config?.autoResumeOnLoad ? 'bg-indigo-600' : 'bg-slate-300'
              }`}
            >
              <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${
                config?.autoResumeOnLoad ? 'left-5' : 'left-1'
              }`} />
            </button>
          </div>
          
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-medium text-slate-700">Auto Gap Analysis</div>
              <div className="text-xs text-slate-500">Run every {config?.gapAnalysisIntervalHours}h</div>
            </div>
            <button
              onClick={() => orchestrator?.updateConfig({
                autoScheduleGapAnalysis: !config?.autoScheduleGapAnalysis
              })}
              className={`relative w-10 h-6 rounded-full transition-colors ${
                config?.autoScheduleGapAnalysis ? 'bg-indigo-600' : 'bg-slate-300'
              }`}
            >
              <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${
                config?.autoScheduleGapAnalysis ? 'left-5' : 'left-1'
              }`} />
            </button>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-medium text-slate-700">Auto Validation</div>
              <div className="text-xs text-slate-500">Run every {config?.validationIntervalHours}h</div>
            </div>
            <button
              onClick={() => orchestrator?.updateConfig({
                autoScheduleValidation: !config?.autoScheduleValidation
              })}
              className={`relative w-10 h-6 rounded-full transition-colors ${
                config?.autoScheduleValidation ? 'bg-indigo-600' : 'bg-slate-300'
              }`}
            >
              <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${
                config?.autoScheduleValidation ? 'left-5' : 'left-1'
              }`} />
            </button>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-medium text-slate-700">Proactive Mode</div>
              <div className="text-xs text-slate-500">Suggest actions automatically</div>
            </div>
            <button
              onClick={() => orchestrator?.updateConfig({
                enableProactiveMode: !config?.enableProactiveMode
              })}
              className={`relative w-10 h-6 rounded-full transition-colors ${
                config?.enableProactiveMode ? 'bg-indigo-600' : 'bg-slate-300'
              }`}
            >
              <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${
                config?.enableProactiveMode ? 'left-5' : 'left-1'
              }`} />
            </button>
          </div>
        </div>

        <div className="pt-3 border-t border-slate-200">
          <div className="text-xs text-slate-500 space-y-1">
            <div className="flex justify-between">
              <span>Memories stored:</span>
              <span className="font-medium text-slate-700">{stats.memories}</span>
            </div>
            <div className="flex justify-between">
              <span>Learnings recorded:</span>
              <span className="font-medium text-slate-700">{stats.learnings}</span>
            </div>
            <div className="flex justify-between">
              <span>Max parallel tasks:</span>
              <span className="font-medium text-slate-700">{config?.maxParallelTasks}</span>
            </div>
            {healthStatus && (
              <div className="flex justify-between">
                <span>Uptime:</span>
                <span className="font-medium text-slate-700">
                  {Math.floor(healthStatus.uptime / 60000)}m
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  // ============================================================================
  // MAIN RENDER
  // ============================================================================

  if (!isExpanded) {
    // Collapsed mini view
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="fixed bottom-4 right-4 z-50"
      >
        <button
          onClick={onToggleExpand}
          className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-full shadow-lg hover:shadow-xl transition-all"
        >
          <Bot className="w-5 h-5" />
          <span className="font-medium">AI Agent</span>
          {recommendations.length > 0 && (
            <span className="w-5 h-5 bg-red-500 rounded-full text-xs flex items-center justify-center">
              {recommendations.length}
            </span>
          )}
          {isRunning && (
            <span className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
          )}
        </button>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="fixed bottom-4 right-4 z-50 w-96 max-h-[600px] bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white">
        <div className="flex items-center gap-2">
          <Bot className="w-5 h-5" />
          <span className="font-semibold">AI Agent</span>
          {isRunning && (
            <span className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
          )}
        </div>
        <button
          onClick={onToggleExpand}
          className="p-1 hover:bg-white/20 rounded transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200 bg-slate-50">
        {[
          { id: 'overview', label: 'Overview', icon: Activity },
          { id: 'tasks', label: 'Tasks', icon: Target },
          { id: 'recommendations', label: 'Tips', icon: Lightbulb, count: recommendations.length },
          { id: 'history', label: 'History', icon: History },
          { id: 'settings', label: 'Settings', icon: Settings },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as TabType)}
            className={`flex-1 flex items-center justify-center gap-1 px-2 py-2 text-xs font-medium transition-colors relative ${
              activeTab === tab.id
                ? 'text-indigo-600 bg-white'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <tab.icon className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{tab.label}</span>
            {tab.count !== undefined && tab.count > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white rounded-full text-[10px] flex items-center justify-center">
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {activeTab === 'overview' && renderOverviewTab()}
        {activeTab === 'tasks' && renderTasksTab()}
        {activeTab === 'recommendations' && renderRecommendationsTab()}
        {activeTab === 'history' && renderHistoryTab()}
        {activeTab === 'settings' && renderSettingsTab()}
      </div>

      {/* Approval Modal */}
      <AnimatePresence>
        {showApprovalModal && pendingApproval && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/50 flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.95 }}
              className="bg-white rounded-lg p-4 max-w-sm w-full"
            >
              <div className="flex items-center gap-2 mb-3">
                <AlertTriangle className="w-5 h-5 text-amber-500" />
                <span className="font-semibold text-slate-800">Approval Required</span>
              </div>
              <p className="text-sm text-slate-600 mb-4">
                The agent wants to: <strong>{pendingApproval.action?.description}</strong>
              </p>
              <div className="flex items-center gap-2 justify-end">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setShowApprovalModal(false);
                    setPendingApproval(null);
                  }}
                >
                  Deny
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => {
                    setShowApprovalModal(false);
                    setPendingApproval(null);
                  }}
                >
                  Approve
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default AgentPanel;
