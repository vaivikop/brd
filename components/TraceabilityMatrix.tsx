import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { 
  Table2, 
  Download, 
  Search, 
  Filter, 
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  Clock,
  AlertTriangle,
  FileText,
  Link2,
  Users,
  ArrowRight,
  ExternalLink,
  Copy,
  Check,
  Layers,
  Target,
  SortAsc,
  SortDesc,
  Wand2,
  Loader,
  RefreshCw,
  GitBranch,
  FileSpreadsheet,
  Network,
  X
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import Button from './Button';
import Tooltip from './Tooltip';
import { ProjectState, Insight, BRDSection } from '../utils/db';
import { generateTraceabilityMatrix, TraceabilityEntry, enhanceTraceabilityMatrix, generateDependencyGraph } from '../utils/services/ai';
import { SourceBadge } from '../utils/sourceIcons';

interface TraceabilityMatrixProps {
  project: ProjectState;
  onNavigateToInsights?: () => void;
  onNavigateToBRD?: () => void;
}

type SortField = 'requirementId' | 'category' | 'priority' | 'status' | 'confidence';
type SortDirection = 'asc' | 'desc';

const PRIORITY_CONFIG = {
  critical: { bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200' },
  high: { bg: 'bg-orange-50', text: 'text-orange-700', border: 'border-orange-200' },
  medium: { bg: 'bg-yellow-50', text: 'text-yellow-700', border: 'border-yellow-200' },
  low: { bg: 'bg-slate-50', text: 'text-slate-600', border: 'border-slate-200' }
};

const STATUS_CONFIG = {
  implemented: { bg: 'bg-emerald-50', text: 'text-emerald-700', icon: CheckCircle2 },
  'in-progress': { bg: 'bg-blue-50', text: 'text-blue-700', icon: Clock },
  pending: { bg: 'bg-yellow-50', text: 'text-yellow-700', icon: Clock },
  deferred: { bg: 'bg-slate-50', text: 'text-slate-600', icon: AlertTriangle }
};

const TraceabilityMatrix: React.FC<TraceabilityMatrixProps> = ({ 
  project, 
  onNavigateToInsights,
  onNavigateToBRD 
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [filterPriority, setFilterPriority] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [sortField, setSortField] = useState<SortField>('requirementId');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [copied, setCopied] = useState(false);
  const [viewMode, setViewMode] = useState<'table' | 'cards' | 'graph'>('table');
  const [isEnhancing, setIsEnhancing] = useState(false);
  const [enhancedData, setEnhancedData] = useState<{ 
    dependencies: Record<string, string[]>; 
    testCriteria: Record<string, string>;
    stakeholders: Record<string, { name: string; role: string; confidence: number }[]>;
  }>({ dependencies: {}, testCriteria: {}, stakeholders: {} });
  
  // === NEW: Graph visualization state ===
  const [graphData, setGraphData] = useState<{
    nodes: { id: string; label: string; category: string; level: number }[];
    edges: { source: string; target: string; type: string }[];
  } | null>(null);
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  
  // === NEW: Export format selection ===
  const [showExportMenu, setShowExportMenu] = useState(false);

  // AI Enhancement handler
  const handleEnhanceWithAI = async () => {
    if (!project.insights || project.insights.length === 0) return;
    
    setIsEnhancing(true);
    try {
      const enhanced = await enhanceTraceabilityMatrix(project.insights);
      setEnhancedData(enhanced);
      
      // Also generate graph data
      const graph = await generateDependencyGraph(project.insights, enhanced);
      setGraphData(graph);
    } catch (error) {
      console.error('Enhancement failed:', error);
    } finally {
      setIsEnhancing(false);
    }
  };

  // Generate matrix from project data
  const matrix = useMemo(() => {
    const requirements = project.insights?.filter(i => 
      i.status === 'approved' && i.category === 'requirement'
    ) || [];

    return requirements.map((req, idx): TraceabilityEntry => {
      // Find which BRD sections reference this requirement
      const matchedSections = project.brd?.sections?.filter(s => 
        s.sources.some(src => src.toLowerCase().includes(req.source.toLowerCase())) ||
        s.content.toLowerCase().includes(req.summary.toLowerCase().slice(0, 30))
      ).map(s => s.title) || [];

      // Use AI-enhanced stakeholders if available, otherwise use keyword detection
      const aiStakeholders = enhancedData.stakeholders[req.id] || [];
      let stakeholders: string[];
      
      if (aiStakeholders.length > 0) {
        stakeholders = aiStakeholders.map(s => `${s.name} (${s.role})`);
      } else {
        // Fallback to improved keyword detection
        const stakeholderKeywords = [
          'team', 'manager', 'user', 'admin', 'customer', 'client', 
          'developer', 'analyst', 'owner', 'lead', 'director', 'engineer',
          'stakeholder', 'executive', 'sponsor', 'PM', 'QA', 'architect'
        ];
        const mentionedStakeholders = stakeholderKeywords.filter(k => 
          req.detail.toLowerCase().includes(k) || req.summary.toLowerCase().includes(k)
        );
        stakeholders = mentionedStakeholders.length > 0 ? mentionedStakeholders : ['Project Team'];
      }

      // Use AI-enhanced data if available
      const aiDeps = enhancedData.dependencies[req.id] || [];
      const aiTestCriteria = enhancedData.testCriteria[req.id];
      
      // Map dependency IDs to REQ-XXX format
      const depLabels = aiDeps.map(depId => {
        const depIdx = requirements.findIndex(r => r.id === depId);
        return depIdx >= 0 ? `REQ-${String(depIdx + 1).padStart(3, '0')}` : null;
      }).filter(Boolean) as string[];

      return {
        requirementId: `REQ-${String(idx + 1).padStart(3, '0')}`,
        requirementSummary: req.summary,
        category: req.category,
        source: req.source,
        sourceType: req.sourceType,
        brdSections: matchedSections.length > 0 ? matchedSections : ['Functional Requirements'],
        stakeholders,
        status: req.includedInBRD ? 'implemented' : 'pending',
        priority: req.confidence === 'high' ? 'high' : req.confidence === 'medium' ? 'medium' : 'low',
        confidence: req.confidence,
        dependencies: depLabels,
        testCriteria: aiTestCriteria || `Given the system is operational, when ${req.summary.slice(0, 50).toLowerCase()}, then the expected behavior should be verified.`
      };
    });
  }, [project, enhancedData]);

  // Filter and sort matrix
  const filteredMatrix = useMemo(() => {
    let result = matrix.filter(entry => {
      const matchesSearch = !searchQuery || 
        entry.requirementSummary.toLowerCase().includes(searchQuery.toLowerCase()) ||
        entry.requirementId.toLowerCase().includes(searchQuery.toLowerCase()) ||
        entry.source.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCategory = filterCategory === 'all' || entry.category === filterCategory;
      const matchesPriority = filterPriority === 'all' || entry.priority === filterPriority;
      const matchesStatus = filterStatus === 'all' || entry.status === filterStatus;
      return matchesSearch && matchesCategory && matchesPriority && matchesStatus;
    });

    // Sort
    result.sort((a, b) => {
      let comparison = 0;
      switch (sortField) {
        case 'requirementId':
          comparison = a.requirementId.localeCompare(b.requirementId);
          break;
        case 'category':
          comparison = a.category.localeCompare(b.category);
          break;
        case 'priority':
          const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
          comparison = priorityOrder[a.priority] - priorityOrder[b.priority];
          break;
        case 'status':
          comparison = a.status.localeCompare(b.status);
          break;
        case 'confidence':
          const confOrder = { high: 0, medium: 1, low: 2 };
          comparison = confOrder[a.confidence as keyof typeof confOrder] - confOrder[b.confidence as keyof typeof confOrder];
          break;
      }
      return sortDirection === 'asc' ? comparison : -comparison;
    });

    return result;
  }, [matrix, searchQuery, filterCategory, filterPriority, filterStatus, sortField, sortDirection]);

  // Helper function for XML escaping
  const escapeXml = (str: string): string => {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  };

  // === Excel/XLSX Export ===
  const handleExportExcel = useCallback(async () => {
    // Create workbook data structure
    const headers = ['Requirement ID', 'Summary', 'Category', 'Source', 'Source Type', 'BRD Sections', 'Stakeholders', 'Status', 'Priority', 'Confidence', 'Dependencies', 'Test Criteria'];
    
    const data = filteredMatrix.map(entry => [
      entry.requirementId,
      entry.requirementSummary,
      entry.category,
      entry.source,
      entry.sourceType,
      entry.brdSections.join('; '),
      entry.stakeholders.join('; '),
      entry.status,
      entry.priority,
      entry.confidence,
      entry.dependencies.join('; '),
      entry.testCriteria || ''
    ]);
    
    // Create XML-based Excel file (works without external libraries)
    const xmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
  <Worksheet ss:Name="Traceability Matrix">
    <Table>
      <Row>
        ${headers.map(h => `<Cell><Data ss:Type="String">${escapeXml(h)}</Data></Cell>`).join('')}
      </Row>
      ${data.map(row => `
      <Row>
        ${row.map(cell => `<Cell><Data ss:Type="String">${escapeXml(String(cell || ''))}</Data></Cell>`).join('')}
      </Row>`).join('')}
    </Table>
  </Worksheet>
</Workbook>`;
    
    const blob = new Blob([xmlContent], { type: 'application/vnd.ms-excel' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${project.name}_RTM_${new Date().toISOString().split('T')[0]}.xls`;
    a.click();
    URL.revokeObjectURL(url);
    setShowExportMenu(false);
  }, [filteredMatrix, project.name]);

  // Stats
  const stats = useMemo(() => ({
    total: matrix.length,
    implemented: matrix.filter(m => m.status === 'implemented').length,
    pending: matrix.filter(m => m.status === 'pending').length,
    highPriority: matrix.filter(m => m.priority === 'high' || m.priority === 'critical').length,
    coverage: matrix.length > 0 
      ? Math.round((matrix.filter(m => m.status === 'implemented').length / matrix.length) * 100) 
      : 0
  }), [matrix]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const toggleRowExpansion = (id: string) => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedRows(newExpanded);
  };

  const handleExportCSV = () => {
    const headers = ['Requirement ID', 'Summary', 'Category', 'Source', 'Source Type', 'BRD Sections', 'Stakeholders', 'Status', 'Priority', 'Confidence', 'Test Criteria'];
    const rows = filteredMatrix.map(entry => [
      entry.requirementId,
      `"${entry.requirementSummary.replace(/"/g, '""')}"`,
      entry.category,
      entry.source,
      entry.sourceType,
      `"${entry.brdSections.join(', ')}"`,
      `"${entry.stakeholders.join(', ')}"`,
      entry.status,
      entry.priority,
      entry.confidence,
      `"${entry.testCriteria?.replace(/"/g, '""') || ''}"`
    ]);

    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${project.name}_RTM_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleCopyToClipboard = async () => {
    const text = filteredMatrix.map(entry => 
      `${entry.requirementId}: ${entry.requirementSummary} [${entry.priority.toUpperCase()}] - ${entry.status}`
    ).join('\n');
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Empty state
  if (matrix.length === 0) {
    return (
      <div className="max-w-4xl mx-auto py-20 text-center animate-in fade-in duration-500">
        <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-6">
          <Table2 className="h-10 w-10 text-slate-400" />
        </div>
        <h2 className="text-2xl font-bold text-slate-900 mb-4">Requirements Traceability Matrix</h2>
        <p className="text-slate-600 mb-8 max-w-md mx-auto">
          Approve requirements in the Insights Review to build your traceability matrix.
        </p>
        {onNavigateToInsights && (
          <Button onClick={onNavigateToInsights}>
            Go to Insights <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="max-w-[1600px] mx-auto pb-20 animate-in fade-in duration-500">
      {/* Header */}
      <header className="mb-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-50 text-purple-700 text-xs font-bold uppercase tracking-wider mb-3 border border-purple-100">
              <Table2 className="h-3 w-3" /> Requirements Traceability Matrix
            </div>
            <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Traceability Matrix</h1>
            <p className="text-slate-600 mt-2">
              Complete mapping of requirements to sources, BRD sections, stakeholders, and test criteria.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Tooltip content="AI generates dependencies, test criteria, and stakeholders">
              <Button 
                variant="outline"
                onClick={handleEnhanceWithAI}
                disabled={isEnhancing}
                className="hidden md:flex"
              >
                {isEnhancing ? (
                  <Loader className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Wand2 className="h-4 w-4 mr-2" />
                )}
                {isEnhancing ? 'Enhancing...' : 'Enhance with AI'}
              </Button>
            </Tooltip>
            <Button 
              variant="outline"
              onClick={handleCopyToClipboard}
              className="hidden md:flex"
            >
              {copied ? <Check className="h-4 w-4 mr-2 text-emerald-600" /> : <Copy className="h-4 w-4 mr-2" />}
              {copied ? 'Copied!' : 'Copy'}
            </Button>
            
            {/* Export Menu */}
            <div className="relative">
              <Button 
                onClick={() => setShowExportMenu(!showExportMenu)} 
                className="shadow-lg shadow-purple-500/20"
              >
                <Download className="h-4 w-4 mr-2" /> Export
              </Button>
              {showExportMenu && (
                <div className="absolute right-0 mt-2 w-48 bg-white rounded-xl shadow-lg border border-slate-100 py-2 z-50">
                  <button
                    onClick={handleExportCSV}
                    className="w-full px-4 py-2 text-left text-sm hover:bg-slate-50 flex items-center gap-2"
                  >
                    <FileText className="h-4 w-4 text-slate-500" />
                    Export as CSV
                  </button>
                  <button
                    onClick={handleExportExcel}
                    className="w-full px-4 py-2 text-left text-sm hover:bg-slate-50 flex items-center gap-2"
                  >
                    <FileSpreadsheet className="h-4 w-4 text-green-600" />
                    Export as Excel
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
          <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
            <div className="text-2xl font-bold text-slate-900">{stats.total}</div>
            <div className="text-xs text-slate-500 font-medium uppercase tracking-wider">Total Requirements</div>
          </div>
          <div className="bg-emerald-50 p-4 rounded-2xl border border-emerald-100">
            <div className="text-2xl font-bold text-emerald-700">{stats.implemented}</div>
            <div className="text-xs text-emerald-600 font-medium uppercase tracking-wider">In BRD</div>
          </div>
          <div className="bg-yellow-50 p-4 rounded-2xl border border-yellow-100">
            <div className="text-2xl font-bold text-yellow-700">{stats.pending}</div>
            <div className="text-xs text-yellow-600 font-medium uppercase tracking-wider">Pending</div>
          </div>
          <div className="bg-orange-50 p-4 rounded-2xl border border-orange-100">
            <div className="text-2xl font-bold text-orange-700">{stats.highPriority}</div>
            <div className="text-xs text-orange-600 font-medium uppercase tracking-wider">High Priority</div>
          </div>
          <div className="bg-blue-50 p-4 rounded-2xl border border-blue-100">
            <div className="text-2xl font-bold text-blue-700">{stats.coverage}%</div>
            <div className="text-xs text-blue-600 font-medium uppercase tracking-wider">Coverage</div>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3 bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search requirements..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-slate-50 rounded-xl text-sm focus:ring-2 focus:ring-purple-500 outline-none"
            />
          </div>
          <select
            value={filterPriority}
            onChange={(e) => setFilterPriority(e.target.value)}
            className="px-3 py-2 bg-slate-50 rounded-xl text-sm font-medium focus:ring-2 focus:ring-purple-500 outline-none"
          >
            <option value="all">All Priorities</option>
            <option value="critical">Critical</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-3 py-2 bg-slate-50 rounded-xl text-sm font-medium focus:ring-2 focus:ring-purple-500 outline-none"
          >
            <option value="all">All Statuses</option>
            <option value="implemented">In BRD</option>
            <option value="pending">Pending</option>
            <option value="deferred">Deferred</option>
          </select>
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg">
            <button
              onClick={() => setViewMode('table')}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                viewMode === 'table' ? 'bg-white shadow-sm text-purple-700' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Table
            </button>
            <button
              onClick={() => setViewMode('cards')}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                viewMode === 'cards' ? 'bg-white shadow-sm text-purple-700' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Cards
            </button>
            <button
              onClick={() => setViewMode('graph')}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors flex items-center gap-1 ${
                viewMode === 'graph' ? 'bg-white shadow-sm text-purple-700' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Network className="h-3 w-3" /> Graph
            </button>
          </div>
        </div>
      </header>

      {/* Table View */}
      {viewMode === 'table' && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100">
                  <th 
                    className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider cursor-pointer hover:bg-slate-100 transition-colors"
                    onClick={() => handleSort('requirementId')}
                  >
                    <div className="flex items-center gap-2">
                      Req ID
                      {sortField === 'requirementId' && (
                        sortDirection === 'asc' ? <SortAsc className="h-3 w-3" /> : <SortDesc className="h-3 w-3" />
                      )}
                    </div>
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Summary</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Source</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">BRD Sections</th>
                  <th 
                    className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider cursor-pointer hover:bg-slate-100 transition-colors"
                    onClick={() => handleSort('priority')}
                  >
                    <div className="flex items-center gap-2">
                      Priority
                      {sortField === 'priority' && (
                        sortDirection === 'asc' ? <SortAsc className="h-3 w-3" /> : <SortDesc className="h-3 w-3" />
                      )}
                    </div>
                  </th>
                  <th 
                    className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider cursor-pointer hover:bg-slate-100 transition-colors"
                    onClick={() => handleSort('status')}
                  >
                    <div className="flex items-center gap-2">
                      Status
                      {sortField === 'status' && (
                        sortDirection === 'asc' ? <SortAsc className="h-3 w-3" /> : <SortDesc className="h-3 w-3" />
                      )}
                    </div>
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Stakeholders</th>
                  <th className="px-6 py-4"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filteredMatrix.map((entry, idx) => {
                  const priorityConfig = PRIORITY_CONFIG[entry.priority];
                  const statusConfig = STATUS_CONFIG[entry.status];
                  const StatusIcon = statusConfig.icon;
                  const isExpanded = expandedRows.has(entry.requirementId);

                  return (
                    <React.Fragment key={entry.requirementId}>
                      <tr 
                        className={`hover:bg-slate-50/50 transition-colors cursor-pointer ${isExpanded ? 'bg-purple-50/30' : ''}`}
                        onClick={() => toggleRowExpansion(entry.requirementId)}
                      >
                        <td className="px-6 py-4">
                          <span className="font-mono text-sm font-bold text-purple-600">{entry.requirementId}</span>
                        </td>
                        <td className="px-6 py-4 max-w-xs">
                          <p className="text-sm text-slate-900 font-medium truncate">{entry.requirementSummary}</p>
                        </td>
                        <td className="px-6 py-4">
                          <SourceBadge sourceName={entry.source} />
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex flex-wrap gap-1">
                            {entry.brdSections.slice(0, 2).map((section, i) => (
                              <span key={i} className="px-2 py-0.5 bg-blue-50 text-blue-700 text-xs rounded-md font-medium">
                                {section.length > 20 ? section.slice(0, 20) + '...' : section}
                              </span>
                            ))}
                            {entry.brdSections.length > 2 && (
                              <span className="px-2 py-0.5 bg-slate-100 text-slate-600 text-xs rounded-md font-medium">
                                +{entry.brdSections.length - 2}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${priorityConfig.bg} ${priorityConfig.text}`}>
                            {entry.priority.toUpperCase()}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${statusConfig.bg} ${statusConfig.text}`}>
                            <StatusIcon className="h-3 w-3" />
                            {entry.status === 'implemented' ? 'In BRD' : entry.status}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-1">
                            <Users className="h-3 w-3 text-slate-400" />
                            <span className="text-xs text-slate-600">{entry.stakeholders.length}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <button className="p-1 hover:bg-slate-100 rounded transition-colors">
                            {isExpanded ? <ChevronUp className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
                          </button>
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr className="bg-purple-50/50">
                          <td colSpan={8} className="px-6 py-4">
                            <div className="grid md:grid-cols-3 gap-4">
                              <div>
                                <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Full Summary</h4>
                                <p className="text-sm text-slate-700">{entry.requirementSummary}</p>
                              </div>
                              <div>
                                <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Stakeholders</h4>
                                <div className="flex flex-wrap gap-1">
                                  {entry.stakeholders.map((s, i) => (
                                    <span key={i} className="px-2 py-0.5 bg-violet-100 text-violet-700 text-xs rounded-md font-medium capitalize">
                                      {s}
                                    </span>
                                  ))}
                                </div>
                              </div>
                              <div>
                                <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Test Criteria</h4>
                                <p className="text-sm text-slate-600 italic">{entry.testCriteria}</p>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Cards View */}
      {viewMode === 'cards' && (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredMatrix.map((entry, idx) => {
            const priorityConfig = PRIORITY_CONFIG[entry.priority];
            const statusConfig = STATUS_CONFIG[entry.status];
            const StatusIcon = statusConfig.icon;

            return (
              <motion.div
                key={entry.requirementId}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.03 }}
                className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 hover:shadow-lg transition-all"
              >
                <div className="flex items-start justify-between mb-3">
                  <span className="font-mono text-sm font-bold text-purple-600">{entry.requirementId}</span>
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${priorityConfig.bg} ${priorityConfig.text}`}>
                      {entry.priority.toUpperCase()}
                    </span>
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium ${statusConfig.bg} ${statusConfig.text}`}>
                      <StatusIcon className="h-2.5 w-2.5" />
                      {entry.status === 'implemented' ? 'In BRD' : entry.status}
                    </span>
                  </div>
                </div>
                
                <h3 className="font-medium text-slate-900 text-sm mb-3 line-clamp-2">{entry.requirementSummary}</h3>
                
                <div className="space-y-2 text-xs">
                  <div className="flex items-center gap-2 text-slate-500">
                    <FileText className="h-3 w-3" />
                    <span>{entry.source}</span>
                  </div>
                  <div className="flex items-center gap-2 text-slate-500">
                    <Link2 className="h-3 w-3" />
                    <span>{entry.brdSections.join(', ').slice(0, 40)}...</span>
                  </div>
                  <div className="flex items-center gap-2 text-slate-500">
                    <Users className="h-3 w-3" />
                    <span>{entry.stakeholders.slice(0, 2).join(', ')}{entry.stakeholders.length > 2 ? '...' : ''}</span>
                  </div>
                  {entry.dependencies.length > 0 && (
                    <div className="flex items-center gap-2 text-purple-600">
                      <GitBranch className="h-3 w-3" />
                      <span>Depends on: {entry.dependencies.join(', ')}</span>
                    </div>
                  )}
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Dependency Graph View */}
      {viewMode === 'graph' && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          {!graphData && Object.keys(enhancedData.dependencies).length === 0 ? (
            <div className="text-center py-20">
              <Network className="h-16 w-16 text-slate-300 mx-auto mb-4" />
              <h3 className="text-lg font-bold text-slate-700 mb-2">Dependency Graph</h3>
              <p className="text-slate-500 mb-6 max-w-md mx-auto">
                Run AI Enhancement to detect dependencies between requirements and visualize them.
              </p>
              <Button onClick={handleEnhanceWithAI} disabled={isEnhancing}>
                {isEnhancing ? <Loader className="h-4 w-4 mr-2 animate-spin" /> : <Wand2 className="h-4 w-4 mr-2" />}
                Enhance with AI
              </Button>
            </div>
          ) : (
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="font-bold text-slate-900 flex items-center gap-2">
                  <Network className="h-5 w-5 text-purple-600" />
                  Dependency Graph
                </h3>
                <div className="flex items-center gap-4 text-sm text-slate-500">
                  <span className="flex items-center gap-1">
                    <div className="w-3 h-3 rounded-full bg-purple-500" /> Requirement
                  </span>
                  <span className="flex items-center gap-1">
                    <ArrowRight className="h-3 w-3" /> Depends on
                  </span>
                </div>
              </div>
              
              {/* Simple SVG-based dependency graph */}
              <div className="relative bg-gradient-to-br from-slate-50 to-purple-50/30 rounded-xl p-8 min-h-[400px] overflow-auto">
                {/* Group nodes by level */}
                {graphData && (() => {
                  const levels: Record<number, typeof graphData.nodes> = {};
                  graphData.nodes.forEach(n => {
                    if (!levels[n.level]) levels[n.level] = [];
                    levels[n.level].push(n);
                  });
                  
                  const maxLevel = Math.max(...Object.keys(levels).map(Number));
                  const levelWidth = 200;
                  const nodeHeight = 60;
                  
                  return (
                    <svg 
                      width={Math.max((maxLevel + 1) * levelWidth + 100, 800)} 
                      height={Math.max(...Object.values(levels).map(l => l.length)) * nodeHeight + 100}
                      className="mx-auto"
                    >
                      {/* Draw edges */}
                      {graphData.edges.map((edge, idx) => {
                        const sourceNode = graphData.nodes.find(n => n.id === edge.source);
                        const targetNode = graphData.nodes.find(n => n.id === edge.target);
                        if (!sourceNode || !targetNode) return null;
                        
                        const sourceLevel = levels[sourceNode.level];
                        const targetLevel = levels[targetNode.level];
                        const sourceIdx = sourceLevel?.indexOf(sourceNode) || 0;
                        const targetIdx = targetLevel?.indexOf(targetNode) || 0;
                        
                        const x1 = sourceNode.level * levelWidth + 140;
                        const y1 = sourceIdx * nodeHeight + 50;
                        const x2 = targetNode.level * levelWidth + 60;
                        const y2 = targetIdx * nodeHeight + 50;
                        
                        return (
                          <g key={idx}>
                            <defs>
                              <marker id={`arrowhead-${idx}`} markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
                                <polygon points="0 0, 10 3.5, 0 7" fill="#8b5cf6" />
                              </marker>
                            </defs>
                            <path
                              d={`M${x1},${y1} C${x1 + 50},${y1} ${x2 - 50},${y2} ${x2},${y2}`}
                              fill="none"
                              stroke="#8b5cf6"
                              strokeWidth={2}
                              strokeOpacity={0.6}
                              markerEnd={`url(#arrowhead-${idx})`}
                            />
                          </g>
                        );
                      })}
                      
                      {/* Draw nodes */}
                      {Object.entries(levels).map(([level, nodes]) => 
                        nodes.map((node, idx) => {
                          const x = Number(level) * levelWidth + 60;
                          const y = idx * nodeHeight + 30;
                          const entry = filteredMatrix.find(m => m.requirementId === node.label);
                          const isSelected = selectedNode === node.id;
                          
                          return (
                            <g 
                              key={node.id}
                              onClick={() => setSelectedNode(isSelected ? null : node.id)}
                              className="cursor-pointer"
                            >
                              <rect
                                x={x}
                                y={y}
                                width={80}
                                height={40}
                                rx={8}
                                fill={isSelected ? '#8b5cf6' : '#fff'}
                                stroke={isSelected ? '#7c3aed' : '#e2e8f0'}
                                strokeWidth={isSelected ? 2 : 1}
                              />
                              <text
                                x={x + 40}
                                y={y + 25}
                                textAnchor="middle"
                                fontSize={12}
                                fontWeight={600}
                                fill={isSelected ? '#fff' : '#7c3aed'}
                              >
                                {node.label}
                              </text>
                            </g>
                          );
                        })
                      )}
                    </svg>
                  );
                })()}
                
                {/* Fallback when no graph data but have dependencies */}
                {!graphData && Object.keys(enhancedData.dependencies).length > 0 && (
                  <div className="space-y-4">
                    {filteredMatrix.filter(m => m.dependencies.length > 0).map((entry, idx) => (
                      <div key={entry.requirementId} className="flex items-center gap-4 p-4 bg-white rounded-xl border border-slate-100">
                        <div className="px-3 py-2 bg-purple-100 rounded-lg font-mono text-sm font-bold text-purple-700">
                          {entry.requirementId}
                        </div>
                        <ArrowRight className="h-4 w-4 text-slate-400" />
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-slate-600">depends on:</span>
                          {entry.dependencies.map(dep => (
                            <span key={dep} className="px-2 py-1 bg-slate-100 rounded font-mono text-xs font-medium text-slate-700">
                              {dep}
                            </span>
                          ))}
                        </div>
                      </div>
                    ))}
                    {filteredMatrix.filter(m => m.dependencies.length > 0).length === 0 && (
                      <div className="text-center py-12 text-slate-500">
                        No dependencies detected between requirements.
                      </div>
                    )}
                  </div>
                )}
              </div>
              
              {/* Selected node details */}
              {selectedNode && graphData && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mt-4 p-4 bg-purple-50 rounded-xl border border-purple-100"
                >
                  {(() => {
                    const node = graphData.nodes.find(n => n.id === selectedNode);
                    const entry = filteredMatrix.find(m => project.insights?.find(i => i.id === selectedNode)?.summary === m.requirementSummary);
                    if (!node) return null;
                    
                    return (
                      <div className="flex items-start justify-between">
                        <div>
                          <h4 className="font-bold text-purple-900 mb-1">{node.label}</h4>
                          <p className="text-sm text-purple-700">{entry?.requirementSummary || 'No details available'}</p>
                          {entry && (
                            <div className="mt-2 flex items-center gap-2">
                              {entry.dependencies.length > 0 && (
                                <span className="text-xs text-purple-600">
                                  Dependencies: {entry.dependencies.join(', ')}
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                        <button onClick={() => setSelectedNode(null)} className="p-1 hover:bg-purple-100 rounded">
                          <X className="h-4 w-4 text-purple-600" />
                        </button>
                      </div>
                    );
                  })()}
                </motion.div>
              )}
            </div>
          )}
        </div>
      )}

      {/* No Results */}
      {filteredMatrix.length === 0 && matrix.length > 0 && (
        <div className="text-center py-12 bg-slate-50 rounded-2xl">
          <Filter className="h-10 w-10 text-slate-300 mx-auto mb-4" />
          <h3 className="text-lg font-bold text-slate-700 mb-2">No matches found</h3>
          <p className="text-slate-500">Try adjusting your filters or search query</p>
        </div>
      )}
    </div>
  );
};

export default TraceabilityMatrix;
