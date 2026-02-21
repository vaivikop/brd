import React, { useState, useEffect, useCallback } from 'react';
import { 
  FileText, 
  Download, 
  RefreshCw, 
  Loader, 
  CheckCircle2,
  AlertTriangle,
  Clock,
  Target,
  Users,
  TrendingUp,
  ArrowRight,
  Calendar,
  Printer,
  Share2,
  Copy,
  Check,
  Zap,
  Shield,
  AlertCircle,
  ChevronRight,
  History,
  Timer,
  CheckSquare,
  Square,
  Trash2,
  Save,
  GitCompare,
  X
} from 'lucide-react';
import { motion } from 'motion/react';
import Button from './Button';
import Tooltip from './Tooltip';
import { ProjectState, updateProjectContext } from '../utils/db';
import { generateStatusReport, StatusReport, RequirementConflict } from '../utils/services/ai';
import Markdown from 'react-markdown';

// Persistent action items storage
interface PersistentActionItem {
  id: string;
  item: string;
  owner: string;
  dueDate: string;
  priority: 'high' | 'medium' | 'low';
  completed: boolean;
  completedAt?: string;
  createdAt: string;
}

// Report history entry
interface ReportHistoryEntry {
  id: string;
  generatedAt: string;
  title: string;
  executiveSummary: string;
  averageProgress: number;
  totalRisks: number;
  totalActionItems: number;
}

const ACTION_ITEMS_KEY = 'clarity_action_items';
const REPORT_HISTORY_KEY = 'clarity_report_history';
const SCHEDULED_GENERATION_KEY = 'clarity_scheduled_gen';

interface StatusReportViewProps {
  project: ProjectState;
  onUpdate: (project: ProjectState) => void;
  onNavigateToInsights?: () => void;
  onNavigateToBRD?: () => void;
}

const STATUS_COLORS = {
  'on-track': { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', icon: CheckCircle2 },
  'at-risk': { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200', icon: AlertTriangle },
  'delayed': { bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200', icon: Clock }
};

const PRIORITY_COLORS = {
  high: { bg: 'bg-red-50', text: 'text-red-700' },
  medium: { bg: 'bg-amber-50', text: 'text-amber-700' },
  low: { bg: 'bg-blue-50', text: 'text-blue-700' }
};

const SEVERITY_COLORS = {
  high: { bg: 'bg-red-100', text: 'text-red-700' },
  medium: { bg: 'bg-amber-100', text: 'text-amber-700' },
  low: { bg: 'bg-blue-100', text: 'text-blue-700' }
};

const StatusReportView: React.FC<StatusReportViewProps> = ({ 
  project, 
  onUpdate, 
  onNavigateToInsights,
  onNavigateToBRD
}) => {
  const [report, setReport] = useState<StatusReport | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [generationProgress, setGenerationProgress] = useState(0);
  
  // New state for enhanced features
  const [persistentActionItems, setPersistentActionItems] = useState<PersistentActionItem[]>([]);
  const [reportHistory, setReportHistory] = useState<ReportHistoryEntry[]>([]);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [comparisonReport, setComparisonReport] = useState<ReportHistoryEntry | null>(null);
  const [scheduledGeneration, setScheduledGeneration] = useState<{ enabled: boolean; interval: 'daily' | 'weekly' | 'monthly' } | null>(null);
  const [showScheduleModal, setShowScheduleModal] = useState(false);

  // Load persistent action items from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem(`${ACTION_ITEMS_KEY}_${project.id}`);
      if (stored) {
        setPersistentActionItems(JSON.parse(stored));
      }
    } catch (e) {
      console.error('Failed to load action items:', e);
    }
  }, [project.id]);

  // Load report history
  useEffect(() => {
    try {
      const stored = localStorage.getItem(`${REPORT_HISTORY_KEY}_${project.id}`);
      if (stored) {
        setReportHistory(JSON.parse(stored));
      }
    } catch (e) {
      console.error('Failed to load report history:', e);
    }
  }, [project.id]);

  // Load scheduled generation settings
  useEffect(() => {
    try {
      const stored = localStorage.getItem(`${SCHEDULED_GENERATION_KEY}_${project.id}`);
      if (stored) {
        setScheduledGeneration(JSON.parse(stored));
      }
    } catch (e) {
      console.error('Failed to load scheduled settings:', e);
    }
  }, [project.id]);

  // Save action items to localStorage
  const saveActionItems = useCallback((items: PersistentActionItem[]) => {
    try {
      localStorage.setItem(`${ACTION_ITEMS_KEY}_${project.id}`, JSON.stringify(items));
      setPersistentActionItems(items);
    } catch (e) {
      console.error('Failed to save action items:', e);
    }
  }, [project.id]);

  // Save report to history
  const saveToHistory = useCallback((reportData: StatusReport) => {
    const avgProgress = reportData.progressMetrics.length > 0 
      ? Math.round(reportData.progressMetrics.reduce((a, m) => a + m.current, 0) / reportData.progressMetrics.length)
      : 0;
      
    const historyEntry: ReportHistoryEntry = {
      id: `report_${Date.now()}`,
      generatedAt: reportData.generatedAt,
      title: reportData.title,
      executiveSummary: reportData.executiveSummary,
      averageProgress: avgProgress,
      totalRisks: reportData.activeRisks.length,
      totalActionItems: reportData.actionItems.length
    };

    setReportHistory(prev => {
      const updated = [...prev, historyEntry].slice(-20); // Keep last 20
      try {
        localStorage.setItem(`${REPORT_HISTORY_KEY}_${project.id}`, JSON.stringify(updated));
        // Dispatch custom event for real-time sidebar status update
        window.dispatchEvent(new CustomEvent('statusReportGenerated', { detail: { projectId: project.id } }));
      } catch (e) {
        console.error('Failed to save history:', e);
      }
      return updated;
    });
  }, [project.id]);

  // Toggle action item completion
  const toggleActionItemCompletion = (itemId: string) => {
    const updated = persistentActionItems.map(item => {
      if (item.id === itemId) {
        return {
          ...item,
          completed: !item.completed,
          completedAt: !item.completed ? new Date().toISOString() : undefined
        };
      }
      return item;
    });
    saveActionItems(updated);
  };

  // Delete persistent action item
  const deleteActionItem = (itemId: string) => {
    const updated = persistentActionItems.filter(item => item.id !== itemId);
    saveActionItems(updated);
  };

  // Merge report action items with persistent ones
  const mergeActionItems = useCallback((reportItems: StatusReport['actionItems']) => {
    const existingIds = new Set(persistentActionItems.map(i => i.item.toLowerCase()));
    const newItems: PersistentActionItem[] = reportItems
      .filter(item => !existingIds.has(item.item.toLowerCase()))
      .map(item => ({
        id: `action_${Date.now()}_${Math.random().toString(36).slice(2)}`,
        item: item.item,
        owner: item.owner,
        dueDate: item.dueDate,
        priority: item.priority,
        completed: false,
        createdAt: new Date().toISOString()
      }));

    if (newItems.length > 0) {
      saveActionItems([...persistentActionItems, ...newItems]);
    }
  }, [persistentActionItems, saveActionItems]);

  // Save schedule settings
  const saveScheduleSettings = (settings: { enabled: boolean; interval: 'daily' | 'weekly' | 'monthly' } | null) => {
    setScheduledGeneration(settings);
    try {
      if (settings) {
        localStorage.setItem(`${SCHEDULED_GENERATION_KEY}_${project.id}`, JSON.stringify(settings));
      } else {
        localStorage.removeItem(`${SCHEDULED_GENERATION_KEY}_${project.id}`);
      }
    } catch (e) {
      console.error('Failed to save schedule settings:', e);
    }
  };

  // Load cached report
  useEffect(() => {
    const cachedReport = (project as any).statusReport;
    if (cachedReport) {
      setReport(cachedReport);
    }
  }, [project]);

  const handleGenerate = async () => {
    setIsGenerating(true);
    setError(null);
    setGenerationProgress(0);

    // Simulate progress for better UX
    const progressInterval = setInterval(() => {
      setGenerationProgress(prev => Math.min(prev + 12, 90));
    }, 350);

    try {
      const conflicts = (project as any).conflicts as RequirementConflict[] | undefined;
      
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

      setGenerationProgress(100);
      clearInterval(progressInterval);
      setReport(statusReport);

      // Save to history for comparison
      saveToHistory(statusReport);

      // Merge action items into persistent storage
      mergeActionItems(statusReport.actionItems);

      // Cache in project state
      const updated = { ...project, statusReport } as ProjectState;
      onUpdate(updated);
    } catch (err) {
      clearInterval(progressInterval);
      console.error('Status report generation failed:', err);
      setError('Failed to generate status report. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleExportPDF = () => {
    // Create printable content
    const printWindow = window.open('', '_blank');
    if (!printWindow || !report) return;

    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>${report.title}</title>
          <style>
            body { font-family: 'Inter', -apple-system, sans-serif; padding: 40px; max-width: 800px; margin: 0 auto; }
            h1 { color: #0f172a; border-bottom: 2px solid #3b82f6; padding-bottom: 10px; }
            h2 { color: #334155; margin-top: 30px; }
            h3 { color: #475569; }
            .meta { color: #64748b; font-size: 14px; margin-bottom: 20px; }
            .metric { background: #f1f5f9; padding: 15px; border-radius: 8px; margin: 10px 0; }
            .metric-label { font-weight: 600; color: #334155; }
            .metric-value { font-size: 24px; font-weight: 700; color: #0f172a; }
            .status { padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: 600; display: inline-block; }
            .on-track { background: #d1fae5; color: #065f46; }
            .at-risk { background: #fef3c7; color: #92400e; }
            .delayed { background: #fee2e2; color: #991b1b; }
            ul { padding-left: 20px; }
            li { margin: 8px 0; }
            table { width: 100%; border-collapse: collapse; margin: 15px 0; }
            th, td { padding: 10px; text-align: left; border-bottom: 1px solid #e2e8f0; }
            th { background: #f8fafc; font-weight: 600; }
            .priority-high { color: #dc2626; }
            .priority-medium { color: #d97706; }
            .priority-low { color: #2563eb; }
          </style>
        </head>
        <body>
          <h1>${report.title}</h1>
          <div class="meta">Generated: ${new Date(report.generatedAt).toLocaleString()} | Period: ${report.period}</div>
          
          <h2>Executive Summary</h2>
          <p>${report.executiveSummary}</p>
          
          <h2>Progress Metrics</h2>
          ${report.progressMetrics.map(m => `
            <div class="metric">
              <div class="metric-label">${m.label}</div>
              <div class="metric-value">${m.current}%</div>
              <span class="status ${m.status}">${m.status.replace('-', ' ').toUpperCase()}</span>
            </div>
          `).join('')}
          
          <h2>Key Accomplishments</h2>
          <ul>${report.keyAccomplishments.map(a => `<li>${a}</li>`).join('')}</ul>
          
          <h2>Active Risks</h2>
          <table>
            <tr><th>Risk</th><th>Severity</th><th>Mitigation</th></tr>
            ${report.activeRisks.map(r => `<tr><td>${r.risk}</td><td class="priority-${r.severity}">${r.severity.toUpperCase()}</td><td>${r.mitigation}</td></tr>`).join('')}
          </table>
          
          <h2>Upcoming Milestones</h2>
          <table>
            <tr><th>Milestone</th><th>Due Date</th><th>Status</th></tr>
            ${report.upcomingMilestones.map(m => `<tr><td>${m.milestone}</td><td>${m.dueDate}</td><td>${m.status}</td></tr>`).join('')}
          </table>
          
          <h2>Action Items</h2>
          <table>
            <tr><th>Item</th><th>Owner</th><th>Due</th><th>Priority</th></tr>
            ${report.actionItems.map(a => `<tr><td>${a.item}</td><td>${a.owner}</td><td>${a.dueDate}</td><td class="priority-${a.priority}">${a.priority.toUpperCase()}</td></tr>`).join('')}
          </table>
          
          <h2>Recommendations</h2>
          <ul>${report.recommendations.map(r => `<li>${r}</li>`).join('')}</ul>
          
          <h2>Next Steps</h2>
          <ul>${report.nextSteps.map(n => `<li>${n}</li>`).join('')}</ul>
        </body>
      </html>
    `;

    printWindow.document.write(htmlContent);
    printWindow.document.close();
    printWindow.print();
  };

  const handleCopy = async () => {
    if (!report) return;
    
    const text = `
${report.title}
Generated: ${new Date(report.generatedAt).toLocaleString()}

EXECUTIVE SUMMARY
${report.executiveSummary}

KEY ACCOMPLISHMENTS
${report.keyAccomplishments.map(a => `• ${a}`).join('\n')}

ACTIVE RISKS
${report.activeRisks.map(r => `• [${r.severity.toUpperCase()}] ${r.risk} - Mitigation: ${r.mitigation}`).join('\n')}

ACTION ITEMS
${report.actionItems.map(a => `• [${a.priority.toUpperCase()}] ${a.item} (Owner: ${a.owner}, Due: ${a.dueDate})`).join('\n')}

NEXT STEPS
${report.nextSteps.map(n => `• ${n}`).join('\n')}
    `.trim();

    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Empty state
  if (!report && !isGenerating) {
    return (
      <div className="max-w-4xl mx-auto py-20 text-center animate-in fade-in duration-500">
        <div className="w-20 h-20 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-6">
          <FileText className="h-10 w-10 text-blue-600" />
        </div>
        <h2 className="text-2xl font-bold text-slate-900 mb-4">Automated Status Reports</h2>
        <p className="text-slate-600 mb-8 max-w-md mx-auto">
          Generate professional, stakeholder-ready status reports with AI-powered insights and recommendations.
        </p>
        <Button onClick={handleGenerate} className="shadow-lg shadow-blue-500/20">
          <Zap className="h-4 w-4 mr-2" /> Generate Status Report
        </Button>
      </div>
    );
  }

  // Loading state with progress
  if (isGenerating) {
    return (
      <div className="max-w-4xl mx-auto py-20 text-center animate-in fade-in duration-500">
        <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-6">
          <Loader className="h-8 w-8 text-blue-600 animate-spin" />
        </div>
        <h3 className="text-xl font-bold text-slate-900 mb-2">Generating Status Report...</h3>
        <p className="text-slate-500 mb-4">Analyzing project data and synthesizing insights</p>
        {/* Progress Bar */}
        <div className="max-w-xs mx-auto">
          <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
            <motion.div 
              className="h-full bg-blue-500 rounded-full"
              initial={{ width: 0 }}
              animate={{ width: `${generationProgress}%` }}
              transition={{ duration: 0.3 }}
            />
          </div>
          <p className="text-xs text-slate-400 mt-2">{generationProgress}% complete</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="max-w-4xl mx-auto py-20 text-center animate-in fade-in duration-500">
        <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-6">
          <AlertCircle className="h-8 w-8 text-red-600" />
        </div>
        <h3 className="text-xl font-bold text-slate-900 mb-2">Generation Failed</h3>
        <p className="text-slate-500 mb-6">{error}</p>
        <Button onClick={handleGenerate}>
          <RefreshCw className="h-4 w-4 mr-2" /> Try Again
        </Button>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto pb-20 animate-in fade-in duration-500">
      {/* Header */}
      <header className="mb-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 text-blue-700 text-xs font-bold uppercase tracking-wider mb-3 border border-blue-100">
              <FileText className="h-3 w-3" /> Status Report
            </div>
            <h1 className="text-3xl font-bold text-slate-900 tracking-tight">{report?.title}</h1>
            <p className="text-slate-600 mt-2 flex items-center gap-4">
              <span className="flex items-center gap-1">
                <Calendar className="h-4 w-4" /> {report?.period}
              </span>
              <span className="flex items-center gap-1">
                <Clock className="h-4 w-4" /> Generated {new Date(report?.generatedAt || '').toLocaleString()}
              </span>
            </p>
          </div>
          <div className="flex items-center gap-3">
            {reportHistory.length > 1 && (
              <Button 
                variant="outline"
                onClick={() => setShowHistoryModal(true)}
              >
                <History className="h-4 w-4 mr-2" /> Compare
              </Button>
            )}
            <Button 
              variant="outline"
              onClick={() => setShowScheduleModal(true)}
            >
              <Timer className="h-4 w-4 mr-2" /> {scheduledGeneration?.enabled ? 'Scheduled' : 'Schedule'}
            </Button>
            <Button 
              variant="outline"
              onClick={handleCopy}
            >
              {copied ? <Check className="h-4 w-4 mr-2 text-emerald-600" /> : <Copy className="h-4 w-4 mr-2" />}
              {copied ? 'Copied!' : 'Copy'}
            </Button>
            <Button 
              variant="outline"
              onClick={handleExportPDF}
            >
              <Printer className="h-4 w-4 mr-2" /> Print
            </Button>
            <Button onClick={handleGenerate}>
              <RefreshCw className="h-4 w-4 mr-2" /> Regenerate
            </Button>
          </div>
        </div>
      </header>

      {report && (
        <div className="space-y-8">
          {/* Executive Summary */}
          <section className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-3xl border border-blue-100 p-8">
            <h2 className="text-xl font-bold text-slate-900 mb-4 flex items-center gap-2">
              <Target className="h-5 w-5 text-blue-600" /> Executive Summary
            </h2>
            <p className="text-slate-700 leading-relaxed text-lg">{report.executiveSummary}</p>
          </section>

          {/* Progress Metrics */}
          <section className="bg-white rounded-3xl border border-slate-100 shadow-sm p-8">
            <h2 className="text-xl font-bold text-slate-900 mb-6 flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-emerald-600" /> Progress Metrics
            </h2>
            <div className="grid md:grid-cols-3 gap-4">
              {report.progressMetrics.map((metric, idx) => {
                const statusConfig = STATUS_COLORS[metric.status];
                const StatusIcon = statusConfig.icon;

                return (
                  <motion.div
                    key={idx}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.1 }}
                    className={`p-6 rounded-2xl ${statusConfig.bg} border ${statusConfig.border}`}
                  >
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-sm font-bold text-slate-600 uppercase tracking-wider">{metric.label}</span>
                      <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold ${statusConfig.text} bg-white`}>
                        <StatusIcon className="h-3 w-3" />
                        {metric.status.replace('-', ' ')}
                      </span>
                    </div>
                    <div className="flex items-end gap-2">
                      <span className="text-4xl font-bold text-slate-900">{metric.current}%</span>
                      <span className="text-slate-500 text-sm mb-1">/ {metric.target}%</span>
                    </div>
                    <div className="mt-3 h-2 bg-white rounded-full overflow-hidden">
                      <div 
                        className={`h-full rounded-full transition-all duration-1000 ${
                          metric.status === 'on-track' ? 'bg-emerald-500' :
                          metric.status === 'at-risk' ? 'bg-amber-500' : 'bg-red-500'
                        }`}
                        style={{ width: `${Math.min((metric.current / metric.target) * 100, 100)}%` }}
                      />
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </section>

          <div className="grid md:grid-cols-2 gap-8">
            {/* Key Accomplishments */}
            <section className="bg-emerald-50 rounded-3xl border border-emerald-100 p-8">
              <h2 className="text-xl font-bold text-emerald-900 mb-4 flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-emerald-600" /> Key Accomplishments
              </h2>
              <ul className="space-y-3">
                {report.keyAccomplishments.map((accomplishment, idx) => (
                  <motion.li
                    key={idx}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * 0.1 }}
                    className="flex items-start gap-3 bg-white p-4 rounded-xl"
                  >
                    <CheckCircle2 className="h-5 w-5 text-emerald-600 flex-shrink-0 mt-0.5" />
                    <span className="text-slate-700">{accomplishment}</span>
                  </motion.li>
                ))}
              </ul>
            </section>

            {/* Active Risks */}
            <section className="bg-red-50 rounded-3xl border border-red-100 p-8">
              <h2 className="text-xl font-bold text-red-900 mb-4 flex items-center gap-2">
                <Shield className="h-5 w-5 text-red-600" /> Active Risks
              </h2>
              <div className="space-y-3">
                {report.activeRisks.map((risk, idx) => {
                  const severityConfig = SEVERITY_COLORS[risk.severity];
                  return (
                    <motion.div
                      key={idx}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: idx * 0.1 }}
                      className="bg-white p-4 rounded-xl"
                    >
                      <div className="flex items-start justify-between mb-2">
                        <span className="font-medium text-slate-900">{risk.risk}</span>
                        <span className={`px-2 py-0.5 rounded text-xs font-bold ${severityConfig.bg} ${severityConfig.text}`}>
                          {risk.severity.toUpperCase()}
                        </span>
                      </div>
                      <p className="text-sm text-slate-600">
                        <span className="font-medium">Mitigation:</span> {risk.mitigation}
                      </p>
                    </motion.div>
                  );
                })}
              </div>
            </section>
          </div>

          {/* Upcoming Milestones */}
          <section className="bg-white rounded-3xl border border-slate-100 shadow-sm p-8">
            <h2 className="text-xl font-bold text-slate-900 mb-6 flex items-center gap-2">
              <Calendar className="h-5 w-5 text-indigo-600" /> Upcoming Milestones
            </h2>
            <div className="space-y-3">
              {report.upcomingMilestones.map((milestone, idx) => (
                <div 
                  key={idx}
                  className="flex items-center gap-4 p-4 bg-slate-50 rounded-xl hover:bg-slate-100 transition-colors"
                >
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                    milestone.status === 'completed' ? 'bg-emerald-100 text-emerald-600' :
                    milestone.status === 'in-progress' ? 'bg-blue-100 text-blue-600' :
                    'bg-slate-100 text-slate-500'
                  }`}>
                    {milestone.status === 'completed' ? <CheckCircle2 className="h-5 w-5" /> :
                     milestone.status === 'in-progress' ? <Loader className="h-5 w-5 animate-spin" /> :
                     <Clock className="h-5 w-5" />}
                  </div>
                  <div className="flex-1">
                    <h4 className="font-medium text-slate-900">{milestone.milestone}</h4>
                    <span className="text-sm text-slate-500">{milestone.dueDate}</span>
                  </div>
                  <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                    milestone.status === 'completed' ? 'bg-emerald-100 text-emerald-700' :
                    milestone.status === 'in-progress' ? 'bg-blue-100 text-blue-700' :
                    'bg-slate-100 text-slate-600'
                  }`}>
                    {milestone.status.replace('-', ' ')}
                  </span>
                </div>
              ))}
            </div>
          </section>

          {/* Action Items */}
          <section className="bg-white rounded-3xl border border-slate-100 shadow-sm p-8">
            <h2 className="text-xl font-bold text-slate-900 mb-6 flex items-center gap-2">
              <Zap className="h-5 w-5 text-amber-600" /> Action Items
              <span className="ml-auto text-sm font-normal text-slate-500">
                {persistentActionItems.filter(i => i.completed).length}/{persistentActionItems.length} completed
              </span>
            </h2>
            
            {/* Persistent Action Items with checkboxes */}
            <div className="space-y-3">
              {persistentActionItems.length > 0 ? (
                persistentActionItems.map((item) => {
                  const priorityConfig = PRIORITY_COLORS[item.priority];
                  return (
                    <motion.div
                      key={item.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className={`flex items-start gap-4 p-4 rounded-xl border transition-all ${
                        item.completed 
                          ? 'bg-emerald-50 border-emerald-100' 
                          : 'bg-white border-slate-100 hover:border-slate-200'
                      }`}
                    >
                      <button
                        onClick={() => toggleActionItemCompletion(item.id)}
                        className="mt-1 flex-shrink-0"
                      >
                        {item.completed ? (
                          <CheckSquare className="h-5 w-5 text-emerald-600" />
                        ) : (
                          <Square className="h-5 w-5 text-slate-400 hover:text-slate-600" />
                        )}
                      </button>
                      <div className="flex-1 min-w-0">
                        <p className={`font-medium ${item.completed ? 'text-slate-500 line-through' : 'text-slate-900'}`}>
                          {item.item}
                        </p>
                        <div className="flex flex-wrap items-center gap-3 mt-2 text-sm text-slate-500">
                          <span className="flex items-center gap-1">
                            <Users className="h-3 w-3" /> {item.owner}
                          </span>
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" /> {item.dueDate}
                          </span>
                          {item.completedAt && (
                            <span className="text-emerald-600 flex items-center gap-1">
                              <Check className="h-3 w-3" /> Completed {new Date(item.completedAt).toLocaleDateString()}
                            </span>
                          )}
                        </div>
                      </div>
                      <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${priorityConfig.bg} ${priorityConfig.text}`}>
                        {item.priority.toUpperCase()}
                      </span>
                      <button
                        onClick={() => deleteActionItem(item.id)}
                        className="p-1 text-slate-400 hover:text-red-500 transition-colors"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </motion.div>
                  );
                })
              ) : (
                <div className="text-center py-8 text-slate-500">
                  <CheckSquare className="h-12 w-12 text-slate-300 mx-auto mb-3" />
                  <p>No action items yet. Generate a report to get action items.</p>
                </div>
              )}
            </div>
          </section>

          <div className="grid md:grid-cols-2 gap-8">
            {/* Recommendations */}
            <section className="bg-blue-50 rounded-3xl border border-blue-100 p-8">
              <h2 className="text-xl font-bold text-blue-900 mb-4 flex items-center gap-2">
                <Target className="h-5 w-5 text-blue-600" /> Recommendations
              </h2>
              <ul className="space-y-3">
                {report.recommendations.map((rec, idx) => (
                  <li key={idx} className="flex items-start gap-3 p-4 bg-white rounded-xl">
                    <ChevronRight className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
                    <span className="text-slate-700">{rec}</span>
                  </li>
                ))}
              </ul>
            </section>

            {/* Next Steps */}
            <section className="bg-indigo-50 rounded-3xl border border-indigo-100 p-8">
              <h2 className="text-xl font-bold text-indigo-900 mb-4 flex items-center gap-2">
                <ArrowRight className="h-5 w-5 text-indigo-600" /> Next Steps
              </h2>
              <ul className="space-y-3">
                {report.nextSteps.map((step, idx) => (
                  <li key={idx} className="flex items-start gap-3 p-4 bg-white rounded-xl">
                    <span className="w-6 h-6 bg-indigo-600 text-white rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0">
                      {idx + 1}
                    </span>
                    <span className="text-slate-700">{step}</span>
                  </li>
                ))}
              </ul>
            </section>
          </div>
        </div>
      )}

      {/* History Comparison Modal */}
      {showHistoryModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[80vh] overflow-hidden"
          >
            <div className="px-6 py-4 border-b bg-gradient-to-r from-blue-50 to-indigo-50 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-lg text-slate-900 flex items-center gap-2">
                  <GitCompare className="h-5 w-5 text-blue-600" />
                  Report History & Comparison
                </h3>
                <p className="text-sm text-slate-600">{reportHistory.length} reports generated</p>
              </div>
              <button
                onClick={() => setShowHistoryModal(false)}
                className="p-2 hover:bg-white rounded-lg transition-colors"
              >
                <X className="h-5 w-5 text-slate-600" />
              </button>
            </div>
            <div className="p-6 overflow-y-auto max-h-[60vh]">
              {/* Comparison View */}
              {comparisonReport && report && (
                <div className="mb-6 p-4 bg-blue-50 rounded-xl border border-blue-100">
                  <h4 className="font-bold text-blue-900 mb-3">Comparison: Current vs {new Date(comparisonReport.generatedAt).toLocaleDateString()}</h4>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="text-center p-3 bg-white rounded-lg">
                      <div className="text-2xl font-bold text-slate-900">
                        {(() => {
                          const currentAvg = report.progressMetrics.length > 0 
                            ? Math.round(report.progressMetrics.reduce((a, m) => a + m.current, 0) / report.progressMetrics.length)
                            : 0;
                          const diff = currentAvg - comparisonReport.averageProgress;
                          return (
                            <span className={diff >= 0 ? 'text-emerald-600' : 'text-red-600'}>
                              {diff > 0 ? '+' : ''}{diff}%
                            </span>
                          );
                        })()}
                      </div>
                      <div className="text-xs text-slate-500">Progress Change</div>
                    </div>
                    <div className="text-center p-3 bg-white rounded-lg">
                      <div className="text-2xl font-bold text-slate-900">
                        {(() => {
                          const diff = report.activeRisks.length - comparisonReport.totalRisks;
                          return (
                            <span className={diff <= 0 ? 'text-emerald-600' : 'text-red-600'}>
                              {diff > 0 ? '+' : ''}{diff}
                            </span>
                          );
                        })()}
                      </div>
                      <div className="text-xs text-slate-500">Risks Change</div>
                    </div>
                    <div className="text-center p-3 bg-white rounded-lg">
                      <div className="text-2xl font-bold text-slate-900">
                        {(() => {
                          const diff = report.actionItems.length - comparisonReport.totalActionItems;
                          return (
                            <span className={diff <= 0 ? 'text-emerald-600' : 'text-amber-600'}>
                              {diff > 0 ? '+' : ''}{diff}
                            </span>
                          );
                        })()}
                      </div>
                      <div className="text-xs text-slate-500">Action Items</div>
                    </div>
                  </div>
                  <button 
                    onClick={() => setComparisonReport(null)}
                    className="mt-3 text-xs text-blue-600 hover:text-blue-700"
                  >
                    Clear comparison
                  </button>
                </div>
              )}

              {/* History List */}
              <div className="space-y-3">
                {[...reportHistory].reverse().map((entry, idx) => (
                  <div 
                    key={entry.id} 
                    className={`flex items-center justify-between p-4 rounded-xl border transition-colors ${
                      comparisonReport?.id === entry.id 
                        ? 'bg-blue-50 border-blue-200' 
                        : 'bg-white border-slate-100 hover:border-slate-200'
                    }`}
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-slate-400" />
                        <span className="font-medium text-slate-900">
                          {new Date(entry.generatedAt).toLocaleString()}
                        </span>
                        {idx === 0 && (
                          <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-xs font-bold">
                            Latest
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-slate-500 mt-1 line-clamp-1">{entry.executiveSummary}</p>
                    </div>
                    <div className="flex items-center gap-4 ml-4">
                      <div className="text-right">
                        <div className="text-sm font-bold text-slate-900">{entry.averageProgress}%</div>
                        <div className="text-xs text-slate-500">Progress</div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-bold text-slate-900">{entry.totalRisks}</div>
                        <div className="text-xs text-slate-500">Risks</div>
                      </div>
                      {idx !== 0 && (
                        <Button 
                          variant="outline" 
                          onClick={() => setComparisonReport(entry)}
                          className="text-xs"
                        >
                          Compare
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex justify-end">
              <Button variant="outline" onClick={() => setShowHistoryModal(false)}>
                Close
              </Button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Schedule Generation Modal */}
      {showScheduleModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden"
          >
            <div className="px-6 py-4 border-b bg-gradient-to-r from-blue-50 to-indigo-50 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-lg text-slate-900 flex items-center gap-2">
                  <Timer className="h-5 w-5 text-blue-600" />
                  Schedule Generation
                </h3>
                <p className="text-sm text-slate-600">Automatic report generation</p>
              </div>
              <button
                onClick={() => setShowScheduleModal(false)}
                className="p-2 hover:bg-white rounded-lg transition-colors"
              >
                <X className="h-5 w-5 text-slate-600" />
              </button>
            </div>
            <div className="p-6">
              <p className="text-slate-600 mb-6">
                Set up automatic status report generation. Reports will be generated and saved to history.
              </p>
              
              <div className="space-y-3">
                {['daily', 'weekly', 'monthly'].map((interval) => (
                  <button
                    key={interval}
                    onClick={() => saveScheduleSettings({ enabled: true, interval: interval as any })}
                    className={`w-full p-4 rounded-xl border text-left transition-all ${
                      scheduledGeneration?.enabled && scheduledGeneration.interval === interval
                        ? 'bg-blue-50 border-blue-200'
                        : 'bg-white border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-medium text-slate-900 capitalize">{interval}</div>
                        <div className="text-sm text-slate-500">
                          {interval === 'daily' && 'Generate a report every day'}
                          {interval === 'weekly' && 'Generate a report every week'}
                          {interval === 'monthly' && 'Generate a report every month'}
                        </div>
                      </div>
                      {scheduledGeneration?.enabled && scheduledGeneration.interval === interval && (
                        <CheckCircle2 className="h-5 w-5 text-blue-600" />
                      )}
                    </div>
                  </button>
                ))}
              </div>

              {scheduledGeneration?.enabled && (
                <button
                  onClick={() => saveScheduleSettings(null)}
                  className="mt-4 w-full p-3 text-red-600 hover:bg-red-50 rounded-xl transition-colors text-sm font-medium"
                >
                  Disable scheduled generation
                </button>
              )}

              <div className="mt-6 p-4 bg-amber-50 rounded-xl border border-amber-100">
                <div className="flex items-center gap-2 text-amber-700">
                  <AlertTriangle className="h-4 w-4" />
                  <span className="text-sm font-medium">Note</span>
                </div>
                <p className="text-sm text-amber-600 mt-1">
                  Scheduled generation requires the app to be open. For true automation, consider setting up system-level scheduled tasks.
                </p>
              </div>
            </div>
            <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex justify-end">
              <Button variant="outline" onClick={() => setShowScheduleModal(false)}>
                Done
              </Button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
};

export default StatusReportView;
