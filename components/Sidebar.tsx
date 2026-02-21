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
  Table2,
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

  const mainMenuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'sources', label: 'Data Sources', icon: Database, status: project?.sources.length ? 'complete' : undefined },
    { id: 'context', label: 'Project Context', icon: Target, status: project?.description ? 'complete' : undefined },
    { id: 'insights', label: 'Insights Review', icon: Lightbulb, status: project?.insights.some(i => i.status === 'approved') ? 'complete' : 'alert' },
    { id: 'generate', label: 'BRD Generation', icon: FileText, status: project?.brd ? 'complete' : undefined },
  ];

  const analysisMenuItems = [
    { id: 'conflicts', label: 'Conflict Detection', icon: ShieldAlert, badge: (project as any)?.conflicts?.filter((c: any) => c.status === 'unresolved')?.length },
    { id: 'traceability', label: 'Traceability Matrix', icon: Table2 },
    { id: 'sentiment', label: 'Stakeholder Sentiment', icon: Heart },
    { id: 'status-report', label: 'Status Reports', icon: ClipboardList },
    { id: 'graph', label: 'Graph View', icon: Network },
  ];

  const renderMenuItem = (item: any) => {
    const isActive = activeTab === item.id;
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
          <item.icon className={`h-5 w-5 flex-shrink-0 ${isActive ? 'text-white' : 'text-slate-500 group-hover:text-white'}`} />
          {!collapsed && <span className="font-medium text-sm">{item.label}</span>}
        </div>
        
        {/* Status Indicators */}
        {!collapsed && item.status === 'complete' && (
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-500"></div>
        )}
        {!collapsed && item.status === 'alert' && (
          <div className="w-1.5 h-1.5 rounded-full bg-orange-500 animate-pulse"></div>
        )}
        {!collapsed && item.badge > 0 && (
          <span className="px-1.5 py-0.5 text-[10px] font-bold bg-red-500 text-white rounded-full min-w-[18px] text-center">
            {item.badge}
          </span>
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