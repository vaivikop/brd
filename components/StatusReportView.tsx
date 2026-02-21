import React, { useState, useEffect } from 'react';
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
  ChevronRight
} from 'lucide-react';
import { motion } from 'motion/react';
import Button from './Button';
import Tooltip from './Tooltip';
import { ProjectState } from '../utils/db';
import { generateStatusReport, StatusReport, RequirementConflict } from '../utils/services/ai';
import Markdown from 'react-markdown';

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

      setReport(statusReport);

      // Cache in project state
      const updated = { ...project, statusReport } as ProjectState;
      onUpdate(updated);
    } catch (err) {
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

  // Loading state
  if (isGenerating) {
    return (
      <div className="max-w-4xl mx-auto py-20 text-center animate-in fade-in duration-500">
        <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-6">
          <Loader className="h-8 w-8 text-blue-600 animate-spin" />
        </div>
        <h3 className="text-xl font-bold text-slate-900 mb-2">Generating Status Report...</h3>
        <p className="text-slate-500">Analyzing project data and synthesizing insights</p>
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
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-100">
                    <th className="text-left py-3 px-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Item</th>
                    <th className="text-left py-3 px-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Owner</th>
                    <th className="text-left py-3 px-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Due Date</th>
                    <th className="text-left py-3 px-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Priority</th>
                  </tr>
                </thead>
                <tbody>
                  {report.actionItems.map((item, idx) => {
                    const priorityConfig = PRIORITY_COLORS[item.priority];
                    return (
                      <tr key={idx} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                        <td className="py-4 px-4 font-medium text-slate-900">{item.item}</td>
                        <td className="py-4 px-4 text-slate-600">{item.owner}</td>
                        <td className="py-4 px-4 text-slate-600">{item.dueDate}</td>
                        <td className="py-4 px-4">
                          <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${priorityConfig.bg} ${priorityConfig.text}`}>
                            {item.priority.toUpperCase()}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
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
    </div>
  );
};

export default StatusReportView;
