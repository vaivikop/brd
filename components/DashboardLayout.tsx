import React, { useState, useEffect, useCallback } from 'react';
import Sidebar from './Sidebar';
import DashboardHome from './DashboardHome';
import ProjectSetup from './ProjectSetup';
import DataSources from './DataSources';
import ProjectContext from './ProjectContext';
import InsightsReview from './InsightsReviewEnterprise';
import BRDGenerationEnterprise from './BRDGenerationEnterprise';
import BRDEdit from './BRDEdit';
import GraphView from './GraphView';
import ConflictDetection from './ConflictDetection';
import TraceabilityMatrix from './TraceabilityMatrix';
import SentimentDashboard from './SentimentDashboard';
import StatusReportView from './StatusReportView';
import AgentPanel from './AgentPanel';
import { getProjectData, ProjectState } from '../utils/db';
import { Loader, RefreshCw, AlertCircle, Menu } from 'lucide-react';
import ErrorBoundary from './ErrorBoundary';

const ACTIVE_TAB_KEY = 'clarityai_active_tab';

const DashboardLayout: React.FC = () => {
  const [activeTab, setActiveTabState] = useState(() => {
    const saved = localStorage.getItem(ACTIVE_TAB_KEY);
    return saved || 'dashboard';
  });
  const [project, setProject] = useState<ProjectState | null>(null);
  const [loading, setLoading] = useState(true);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    const saved = localStorage.getItem('clarityai_sidebar_collapsed');
    return saved === 'true';
  });

  // Wrapper to persist activeTab to localStorage
  const setActiveTab = (tab: string) => {
    setActiveTabState(tab);
    localStorage.setItem(ACTIVE_TAB_KEY, tab);
  };
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const [loadError, setLoadError] = useState<string | null>(null);
  const [agentPanelExpanded, setAgentPanelExpanded] = useState(() => {
    const saved = localStorage.getItem('clarityai_agent_panel_expanded');
    return saved === 'true';
  });

  // Toggle agent panel with persistence
  const handleToggleAgentPanel = () => {
    const newState = !agentPanelExpanded;
    setAgentPanelExpanded(newState);
    localStorage.setItem('clarityai_agent_panel_expanded', String(newState));
  };

  // Persist sidebar collapsed state
  const handleToggleSidebar = () => {
    const newState = !sidebarCollapsed;
    setSidebarCollapsed(newState);
    localStorage.setItem('clarityai_sidebar_collapsed', String(newState));
  };

  const fetchProject = useCallback(async (showRefreshIndicator = false) => {
    if (showRefreshIndicator) {
      setIsRefreshing(true);
    }
    setLoadError(null);
    
    try {
        const data = await getProjectData();
        setProject(data);
        setLastRefresh(new Date());
    } catch (e) {
        console.error("Failed to fetch project", e);
        setLoadError("Failed to load project data. Please refresh the page.");
    } finally {
        setLoading(false);
        setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchProject();
  }, [fetchProject]);

  // Poll for updates every 30 seconds when on certain tabs (useful for background AI analysis)
  useEffect(() => {
    const shouldPoll = ['dashboard', 'insights', 'sources'].includes(activeTab);
    if (!shouldPoll) return;

    const interval = setInterval(() => {
      fetchProject(false); // Silent refresh
    }, 30000);

    return () => clearInterval(interval);
  }, [activeTab, fetchProject]);

  // Handle manual refresh
  const handleRefresh = () => {
    fetchProject(true);
  };

  if (loading) {
      return (
          <div className="h-screen w-full flex items-center justify-center bg-slate-50">
              <div className="text-center">
                <Loader className="h-10 w-10 text-blue-600 animate-spin mx-auto mb-4" />
                <p className="text-slate-500 font-medium">Loading project...</p>
              </div>
          </div>
      );
  }

  // Error state
  if (loadError) {
      return (
          <div className="h-screen w-full flex items-center justify-center bg-slate-50">
              <div className="text-center max-w-md mx-auto p-8">
                <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-6">
                  <AlertCircle className="h-8 w-8 text-red-500" />
                </div>
                <h2 className="text-xl font-bold text-slate-900 mb-2">Failed to Load Project</h2>
                <p className="text-slate-500 mb-6">{loadError}</p>
                <button 
                  onClick={() => fetchProject(true)}
                  className="px-6 py-3 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 transition-colors flex items-center gap-2 mx-auto"
                >
                  <RefreshCw className="h-4 w-4" /> Try Again
                </button>
              </div>
          </div>
      );
  }

  // If no project exists, show Setup Wizard
  if (!project) {
      return <ProjectSetup onComplete={() => fetchProject(false)} />;
  }

  return (
    <div className="min-h-screen bg-slate-50 flex">
      <Sidebar 
        activeTab={activeTab} 
        setActiveTab={setActiveTab} 
        collapsed={sidebarCollapsed}
        onToggleCollapse={handleToggleSidebar}
        mobileOpen={mobileMenuOpen}
        onCloseMobile={() => setMobileMenuOpen(false)}
      />
      
      <main className={`flex-1 ${sidebarCollapsed ? 'lg:ml-16' : 'lg:ml-64'} transition-all duration-300`}>
        {/* Mobile Header */}
        <div className="lg:hidden fixed top-0 left-0 right-0 h-16 bg-white border-b border-slate-200 flex items-center justify-between px-4 z-30">
          <button
            onClick={() => setMobileMenuOpen(true)}
            className="p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <Menu className="h-6 w-6" />
          </button>
          <span className="font-bold text-lg text-slate-900">ClarityAI</span>
          <div className="w-10" /> {/* Spacer for centering */}
        </div>
        
        <div className="p-4 sm:p-6 lg:p-8 pt-20 lg:pt-8">
        {/* Refresh indicator */}
        {isRefreshing && (
          <div className="fixed top-4 right-4 z-50 bg-white px-4 py-2 rounded-xl shadow-lg border border-slate-100 flex items-center gap-2">
            <RefreshCw className="h-4 w-4 text-blue-500 animate-spin" />
            <span className="text-sm text-slate-600 font-medium">Refreshing...</span>
          </div>
        )}

        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
          
          {activeTab === 'dashboard' && (
            <ErrorBoundary>
                <DashboardHome 
                    project={project} 
                    onNavigateToSources={() => setActiveTab('sources')} 
                    onNavigateToGenerate={() => setActiveTab('generate')}
                    onNavigateToInsights={() => setActiveTab('insights')}
                    onNavigateToGraph={() => setActiveTab('graph')}
                    onUpdateProject={setProject}
                />
            </ErrorBoundary>
          )}
          
          {activeTab === 'sources' && (
              <DataSources 
                project={project} 
                onUpdate={setProject}
                onContinue={() => setActiveTab('context')}
              />
          )}

          {activeTab === 'context' && (
              <ProjectContext 
                project={project} 
                onUpdate={setProject}
                onContinue={() => setActiveTab('insights')}
              />
          )}

          {activeTab === 'insights' && (
              <InsightsReview 
                project={project} 
                onUpdate={setProject}
                onContinue={() => setActiveTab('generate')}
                onNavigateToBRD={() => setActiveTab('generate')}
              />
          )}

          {activeTab === 'generate' && (
              <ErrorBoundary>
                <BRDGenerationEnterprise 
                  project={project} 
                  onUpdate={setProject}
                  onContinue={() => setActiveTab('dashboard')}
                  onEdit={() => setActiveTab('edit-brd')}
                  onNavigateToGraph={() => setActiveTab('graph')}
                  onNavigateToInsights={() => setActiveTab('insights')}
                />
              </ErrorBoundary>
          )}

          {activeTab === 'edit-brd' && (
              <BRDEdit 
                project={project} 
                onUpdate={setProject}
                onBack={() => setActiveTab('generate')}
              />
          )}

          {activeTab === 'graph' && (
              <ErrorBoundary>
                <GraphView 
                  project={project} 
                  onUpdate={setProject}
                />
              </ErrorBoundary>
          )}

          {activeTab === 'conflicts' && (
              <ErrorBoundary>
                <ConflictDetection 
                  project={project} 
                  onUpdate={setProject}
                  onNavigateToInsights={() => setActiveTab('insights')}
                  onNavigateToBRD={() => setActiveTab('generate')}
                />
              </ErrorBoundary>
          )}

          {activeTab === 'traceability' && (
              <ErrorBoundary>
                <TraceabilityMatrix 
                  project={project}
                  onNavigateToInsights={() => setActiveTab('insights')}
                  onNavigateToBRD={() => setActiveTab('generate')}
                />
              </ErrorBoundary>
          )}

          {activeTab === 'sentiment' && (
              <ErrorBoundary>
                <SentimentDashboard 
                  project={project} 
                  onUpdate={setProject}
                  onNavigateToInsights={() => setActiveTab('insights')}
                />
              </ErrorBoundary>
          )}

          {activeTab === 'status-report' && (
              <ErrorBoundary>
                <StatusReportView 
                  project={project} 
                  onUpdate={setProject}
                  onNavigateToInsights={() => setActiveTab('insights')}
                  onNavigateToBRD={() => setActiveTab('generate')}
                />
              </ErrorBoundary>
          )}

          {activeTab !== 'dashboard' && activeTab !== 'sources' && activeTab !== 'context' && activeTab !== 'insights' && activeTab !== 'generate' && activeTab !== 'edit-brd' && activeTab !== 'graph' && activeTab !== 'conflicts' && activeTab !== 'traceability' && activeTab !== 'sentiment' && activeTab !== 'status-report' && (
             <div className="flex items-center justify-center h-[60vh] lg:h-[80vh] border-2 border-dashed border-slate-200 rounded-xl">
                <div className="text-center px-4">
                    <h2 className="text-lg lg:text-xl font-bold text-slate-400 mb-2">Work in Progress</h2>
                    <p className="text-slate-500 text-sm lg:text-base">The <span className="font-mono text-blue-500">{activeTab}</span> module is coming soon.</p>
                </div>
             </div>
          )}
        </div>
        </div>
      </main>

      {/* AI Agent Panel - Floating */}
      {project && (
        <AgentPanel 
          project={project} 
          onProjectUpdate={setProject}
          isExpanded={agentPanelExpanded}
          onToggleExpand={handleToggleAgentPanel}
          onNavigateToStatusReport={() => setActiveTab('status-report')}
        />
      )}
    </div>
  );
};

export default DashboardLayout;