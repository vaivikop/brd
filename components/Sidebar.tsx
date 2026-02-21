import React from 'react';
import { 
  LayoutDashboard, 
  Database, 
  Target, 
  Lightbulb, 
  FileText, 
  Network, 
  LogOut,
  ChevronLeft,
  ChevronRight,
  ShieldAlert,
  Heart,
  ClipboardList,
  X
} from 'lucide-react';
import { useNavigation } from '../context/NavigationContext';
import { getProjectData, ProjectState } from '../utils/db';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
  mobileOpen?: boolean;
  onCloseMobile?: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ activeTab, setActiveTab, collapsed = false, onToggleCollapse, mobileOpen = false, onCloseMobile }) => {
  const { navigateTo } = useNavigation();
  const [project, setProject] = React.useState<ProjectState | null>(null);
  const [hasStatusReport, setHasStatusReport] = React.useState(false);
  const projectFetched = React.useRef(false);

  React.useEffect(() => {
    if (!projectFetched.current) {
      getProjectData().then(setProject);
      projectFetched.current = true;
    }
  }, []);

  // Refresh project data when activeTab changes to ensure status indicators are current
  React.useEffect(() => {
    if (projectFetched.current) {
      getProjectData().then(setProject);
    }
  }, [activeTab]);

  // Check for status report in localStorage
  React.useEffect(() => {
    const checkStatusReport = () => {
      if (project?.id) {
        const reportHistory = localStorage.getItem(`clarity_report_history_${project.id}`);
        if (reportHistory) {
          try {
            const parsed = JSON.parse(reportHistory);
            setHasStatusReport(Array.isArray(parsed) && parsed.length > 0);
          } catch {
            setHasStatusReport(false);
          }
        } else {
          setHasStatusReport(false);
        }
      }
    };
    
    checkStatusReport();
    
    // Listen for real-time updates when status report is generated
    const handleStatusReportGenerated = () => checkStatusReport();
    window.addEventListener('statusReportGenerated', handleStatusReportGenerated);
    
    return () => {
      window.removeEventListener('statusReportGenerated', handleStatusReportGenerated);
    };
  }, [project?.id, activeTab]);

  // Calculate status for each page: 'green' (ready), 'yellow' (needs attention), 'red' (not ready/blocked)
  const getPageStatus = (pageId: string): 'green' | 'yellow' | 'red' => {
    if (!project) return 'red';
    
    const hasSources = project.sources && project.sources.length > 0;
    const hasContext = !!project.description;
    const hasInsights = project.insights && project.insights.length > 0;
    const hasApprovedInsights = project.insights?.some(i => i.status === 'approved');
    const hasPendingInsights = project.insights?.some(i => i.status === 'pending');
    const hasBRD = !!project.brd;
    const hasConflicts = project.insights?.some(i => i.hasConflicts || (i.conflictingInsightIds && i.conflictingInsightIds.length > 0));
    
    switch (pageId) {
      case 'dashboard':
        // Dashboard is always accessible, green if we have any data
        if (hasBRD || hasApprovedInsights) return 'green';
        if (hasSources || hasContext) return 'yellow';
        return 'red';
        
      case 'sources':
        // Green if has sources, yellow if empty (needs sources)
        return hasSources ? 'green' : 'yellow';
        
      case 'context':
        // Green if context filled, yellow if needs context
        return hasContext ? 'green' : 'yellow';
        
      case 'insights':
        // Green if has approved, yellow if has pending to review, red if no insights
        if (hasApprovedInsights) return 'green';
        if (hasPendingInsights) return 'yellow';
        return 'red';
        
      case 'generate':
        // Green if BRD exists, yellow if can generate (has approved), red if blocked
        if (hasBRD) return 'green';
        if (hasApprovedInsights) return 'yellow';
        return 'red';
        
      case 'conflicts':
        // Green if no conflicts, yellow if has conflicts to resolve, red if no insights
        if (!hasInsights) return 'red';
        if (hasConflicts) return 'yellow';
        return 'green';
        
      case 'traceability':
        // Green if has approved insights, yellow if has insights, red if none
        if (hasApprovedInsights) return 'green';
        if (hasInsights) return 'yellow';
        return 'red';
        
      case 'sentiment':
        // Green if has insights to analyze, red if no insights
        if (hasInsights) return 'green';
        return 'red';
        
      case 'status-report':
        // Green if report has been generated, yellow if has data to generate, red if no data
        if (hasStatusReport) return 'green';
        if (hasBRD || hasApprovedInsights) return 'yellow';
        return 'red';
        
      case 'graph':
        // Green if has insights to visualize, red if no data
        if (hasInsights) return 'green';
        return 'red';
        
      default:
        return 'red';
    }
  };

  const mainMenuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'sources', label: 'Data Sources', icon: Database },
    { id: 'context', label: 'Project Context', icon: Target },
    { id: 'insights', label: 'Insights Review', icon: Lightbulb },
    { id: 'generate', label: 'BRD Generation', icon: FileText },
  ];

  const analysisMenuItems = [
    // { id: 'conflicts', label: 'Conflict Detection', icon: ShieldAlert },
    { id: 'sentiment', label: 'Stakeholder Sentiment', icon: Heart },
    { id: 'status-report', label: 'Status Reports', icon: ClipboardList },
    { id: 'graph', label: 'Graph View', icon: Network },
  ];

  const renderMenuItem = (item: any) => {
    const isActive = activeTab === item.id;
    const status = getPageStatus(item.id);
    
    const statusColors = {
      green: 'bg-emerald-500',
      yellow: 'bg-amber-500 animate-pulse',
      red: 'bg-red-500/70'
    };
    
    return (
      <button
        key={item.id}
        onClick={() => handleTabChange(item.id)}
        className={`w-full flex items-center ${collapsed ? 'justify-center' : 'justify-between'} px-3 py-2.5 rounded-lg transition-all duration-200 group ${
          isActive 
            ? 'bg-blue-600 text-white shadow-md shadow-blue-900/20' 
            : 'text-slate-400 hover:bg-slate-800 hover:text-white'
        }`}
        title={collapsed ? item.label : undefined}
      >
        <div className={`flex items-center ${collapsed ? '' : 'gap-3'}`}>
          <div className="relative">
            <item.icon className={`h-5 w-5 flex-shrink-0 ${isActive ? 'text-white' : 'text-slate-500 group-hover:text-white'}`} />
            {/* Status dot on icon when collapsed */}
            {collapsed && (
              <div className={`absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full ${statusColors[status]} ring-2 ring-slate-900`}></div>
            )}
          </div>
          {!collapsed && <span className="font-medium text-sm">{item.label}</span>}
        </div>
        
        {/* Status Indicator - shown when not collapsed */}
        {!collapsed && (
          <div className={`w-2 h-2 rounded-full ${statusColors[status]}`} title={
            status === 'green' ? 'Ready' : 
            status === 'yellow' ? 'Needs attention' : 
            'Not ready'
          }></div>
        )}
      </button>
    );
  };

  // Handle tab change and close mobile menu
  const handleTabChange = (tabId: string) => {
    setActiveTab(tabId);
    onCloseMobile?.();
  };

  return (
    <>
      {/* Mobile Overlay */}
      {mobileOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 lg:hidden" 
          onClick={onCloseMobile}
        />
      )}
      
      <aside className={`
        ${collapsed ? 'w-16' : 'w-64'} 
        bg-slate-900 h-screen flex flex-col fixed left-0 top-0 z-50 shadow-xl border-r border-slate-800 transition-all duration-300
        ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}
        lg:translate-x-0
      `}>
        {/* Brand */}
        <div className={`h-16 flex items-center ${collapsed ? 'justify-center' : 'px-6 justify-between'} border-b border-slate-800`}>
          <div className="flex items-center">
            <div className="bg-blue-600 p-1.5 rounded-lg flex-shrink-0">
              <FileText className="h-5 w-5 text-white" />
            </div>
            {!collapsed && <span className="font-bold text-lg text-white tracking-tight ml-3">ClarityAI</span>}
          </div>
          {/* Mobile close button */}
          {!collapsed && (
            <button
              onClick={onCloseMobile}
              className="lg:hidden p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          )}
        </div>

      {/* Navigation */}
      <div className="flex-1 overflow-y-auto py-4 px-3 space-y-1 scrollbar-hide" style={{ overscrollBehavior: 'contain', scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
        <style>{`
          .scrollbar-hide::-webkit-scrollbar {
            display: none;
          }
        `}</style>
        {/* Main Navigation */}
        {!collapsed && (
          <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider px-3 mb-2">
            Main
          </div>
        )}
        {mainMenuItems.map(renderMenuItem)}

        {/* Analytics Section */}
        {!collapsed && (
          <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider px-3 mt-6 mb-2">
            Analytics & Reports
          </div>
        )}
        {collapsed && <div className="h-4" />}
        {analysisMenuItems.map(renderMenuItem)}
      </div>

      {/* Footer Actions */}
      <div className="p-4 border-t border-slate-800 space-y-2">
        {onToggleCollapse && (
          <button
            onClick={onToggleCollapse}
            className={`w-full flex items-center ${collapsed ? 'justify-center' : 'gap-3'} px-3 py-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors text-sm`}
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {collapsed ? <ChevronRight className="h-4 w-4 flex-shrink-0" /> : <ChevronLeft className="h-4 w-4 flex-shrink-0" />}
            {!collapsed && <span>Collapse</span>}
          </button>
        )}
        <button 
            onClick={() => {
              navigateTo('landing');
              onCloseMobile?.();
            }}
            className={`w-full flex items-center ${collapsed ? 'justify-center' : 'gap-3'} px-3 py-2 rounded-lg text-slate-400 hover:text-red-400 hover:bg-slate-800 transition-colors text-sm`}
            title={collapsed ? 'Sign Out' : undefined}
        >
           <LogOut className="h-4 w-4 flex-shrink-0" />
           {!collapsed && <span>Sign Out</span>}
        </button>
      </div>
    </aside>
    </>
  );
};

export default Sidebar;