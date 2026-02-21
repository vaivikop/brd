import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  FileText,
  Users,
  Video,
  Mail,
  MessageSquare,
  CheckCircle2,
  HelpCircle,
  FolderOpen,
  Search,
  Filter,
  ZoomIn,
  ZoomOut,
  Maximize2,
  X,
  ChevronRight,
  AlertTriangle,
  Clock,
  ExternalLink,
  Target,
  Layers,
  Eye,
  EyeOff,
  RotateCcw,
  Info
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { ProjectState, Insight, BRDSection, Source } from '../utils/db';
import Button from './Button';
import Tooltip from './Tooltip';

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

type NodeType = 'requirement' | 'stakeholder' | 'meeting' | 'email' | 'document' | 'decision' | 'question' | 'source';
type ConnectionStrength = 'strong' | 'medium' | 'weak';
type ConfidenceLevel = 'high' | 'medium' | 'low';

interface GraphNode {
  id: string;
  type: NodeType;
  title: string;
  subtitle?: string;
  confidence: ConfidenceLevel;
  x: number;
  y: number;
  sourceId?: string;
  metadata?: {
    source?: string;
    sourceType?: string;
    detail?: string;
    linkedSections?: string[];
    category?: string;
    status?: string;
  };
}

interface GraphConnection {
  id: string;
  from: string;
  to: string;
  strength: ConnectionStrength;
  type: 'derives' | 'informs' | 'requires' | 'conflicts' | 'supports';
  confidence: ConfidenceLevel;
  label?: string;
}

interface GraphViewProps {
  project: ProjectState;
  onUpdate?: (project: ProjectState) => void;
}

// ============================================================================
// CONSTANTS & CONFIGURATION
// ============================================================================

const NODE_COLORS: Record<NodeType, { bg: string; border: string; icon: string; glow: string }> = {
  requirement: { bg: 'bg-blue-50', border: 'border-blue-300', icon: 'text-blue-600', glow: 'shadow-blue-200/50' },
  stakeholder: { bg: 'bg-violet-50', border: 'border-violet-300', icon: 'text-violet-600', glow: 'shadow-violet-200/50' },
  meeting: { bg: 'bg-emerald-50', border: 'border-emerald-300', icon: 'text-emerald-600', glow: 'shadow-emerald-200/50' },
  email: { bg: 'bg-amber-50', border: 'border-amber-300', icon: 'text-amber-600', glow: 'shadow-amber-200/50' },
  document: { bg: 'bg-slate-50', border: 'border-slate-300', icon: 'text-slate-600', glow: 'shadow-slate-200/50' },
  decision: { bg: 'bg-green-50', border: 'border-green-300', icon: 'text-green-600', glow: 'shadow-green-200/50' },
  question: { bg: 'bg-orange-50', border: 'border-orange-300', icon: 'text-orange-600', glow: 'shadow-orange-200/50' },
  source: { bg: 'bg-cyan-50', border: 'border-cyan-300', icon: 'text-cyan-600', glow: 'shadow-cyan-200/50' },
};

const NODE_ICONS: Record<NodeType, React.ComponentType<{ className?: string }>> = {
  requirement: FileText,
  stakeholder: Users,
  meeting: Video,
  email: Mail,
  document: FolderOpen,
  decision: CheckCircle2,
  question: HelpCircle,
  source: MessageSquare,
};

const CONFIDENCE_INDICATORS: Record<ConfidenceLevel, { color: string; pulse: boolean }> = {
  high: { color: 'bg-emerald-400', pulse: false },
  medium: { color: 'bg-amber-400', pulse: false },
  low: { color: 'bg-red-400', pulse: true },
};

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

// Category hub positions - use full canvas space
const CATEGORY_HUBS = {
  requirements: { x: 300, y: 280, label: 'Requirements', type: 'requirement' as NodeType },
  stakeholders: { x: 900, y: 280, label: 'Stakeholders', type: 'stakeholder' as NodeType },
  decisions: { x: 300, y: 700, label: 'Decisions', type: 'decision' as NodeType },
  questions: { x: 900, y: 700, label: 'Open Questions', type: 'question' as NodeType },
};

// Maximum items to show per category - show more data
const MAX_ITEMS_PER_CATEGORY = 8;

const generateNodesFromProject = (project: ProjectState): GraphNode[] => {
  const nodes: GraphNode[] = [];
  
  // Count items per category
  const requirementSections = project.brd?.sections || [];
  const stakeholderInsights = project.insights?.filter(i => i.category === 'stakeholder') || [];
  const decisionInsights = project.insights?.filter(i => i.category === 'decision') || [];
  const questionInsights = project.insights?.filter(i => i.category === 'question') || [];
  
  // Add hub nodes - center of each cluster
  if (requirementSections.length > 0) {
    nodes.push({
      id: 'hub_requirements',
      type: 'requirement',
      title: 'Requirements',
      subtitle: `${requirementSections.length} total`,
      confidence: 'high',
      x: CATEGORY_HUBS.requirements.x,
      y: CATEGORY_HUBS.requirements.y,
      metadata: { category: 'hub' }
    });
  }
  
  if (stakeholderInsights.length > 0) {
    nodes.push({
      id: 'hub_stakeholders',
      type: 'stakeholder',
      title: 'Stakeholders',
      subtitle: `${stakeholderInsights.length} identified`,
      confidence: 'high',
      x: CATEGORY_HUBS.stakeholders.x,
      y: CATEGORY_HUBS.stakeholders.y,
      metadata: { category: 'hub' }
    });
  }
  
  if (decisionInsights.length > 0) {
    nodes.push({
      id: 'hub_decisions',
      type: 'decision',
      title: 'Decisions',
      subtitle: `${decisionInsights.length} made`,
      confidence: 'high',
      x: CATEGORY_HUBS.decisions.x,
      y: CATEGORY_HUBS.decisions.y,
      metadata: { category: 'hub' }
    });
  }
  
  if (questionInsights.length > 0) {
    nodes.push({
      id: 'hub_questions',
      type: 'question',
      title: 'Open Questions',
      subtitle: `${questionInsights.length} pending`,
      confidence: 'low',
      x: CATEGORY_HUBS.questions.x,
      y: CATEGORY_HUBS.questions.y,
      metadata: { category: 'hub' }
    });
  }
  
  // Add only top items from each category (sorted by confidence)
  // Requirements - take top 4 by confidence
  const topRequirements = [...requirementSections]
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, MAX_ITEMS_PER_CATEGORY);
  
  topRequirements.forEach((section, index) => {
    const hub = CATEGORY_HUBS.requirements;
    const angle = ((index / Math.max(topRequirements.length, 1)) * 2 * Math.PI) - Math.PI / 2;
    const radius = 160 + (index % 2) * 40; // Stagger for more spread
    nodes.push({
      id: `req_${section.id}`,
      type: 'requirement',
      title: section.title.length > 25 ? section.title.slice(0, 25) + '...' : section.title,
      subtitle: `${Math.round(section.confidence * 100)}%`,
      confidence: section.confidence >= 0.8 ? 'high' : section.confidence >= 0.5 ? 'medium' : 'low',
      x: hub.x + Math.cos(angle) * radius,
      y: hub.y + Math.sin(angle) * radius,
      metadata: { detail: section.content.slice(0, 150) + '...' }
    });
  });
  
  // Stakeholders - take top 4 by confidence  
  const topStakeholders = [...stakeholderInsights]
    .sort((a, b) => (b.confidence === 'high' ? 3 : b.confidence === 'medium' ? 2 : 1) - 
                    (a.confidence === 'high' ? 3 : a.confidence === 'medium' ? 2 : 1))
    .slice(0, MAX_ITEMS_PER_CATEGORY);
  
  topStakeholders.forEach((insight, index) => {
    const hub = CATEGORY_HUBS.stakeholders;
    const angle = ((index / Math.max(topStakeholders.length, 1)) * 2 * Math.PI) - Math.PI / 2;
    const radius = 160 + (index % 2) * 40;
    nodes.push({
      id: `insight_${insight.id}`,
      type: 'stakeholder',
      title: insight.summary.length > 25 ? insight.summary.slice(0, 25) + '...' : insight.summary,
      subtitle: insight.source?.slice(0, 15) || '',
      confidence: insight.confidence,
      x: hub.x + Math.cos(angle) * radius,
      y: hub.y + Math.sin(angle) * radius,
      sourceId: insight.id,
      metadata: { detail: insight.detail, category: 'stakeholder' }
    });
  });
  
  // Decisions - take top 4
  const topDecisions = [...decisionInsights]
    .sort((a, b) => (b.confidence === 'high' ? 3 : b.confidence === 'medium' ? 2 : 1) - 
                    (a.confidence === 'high' ? 3 : a.confidence === 'medium' ? 2 : 1))
    .slice(0, MAX_ITEMS_PER_CATEGORY);
  
  topDecisions.forEach((insight, index) => {
    const hub = CATEGORY_HUBS.decisions;
    const angle = ((index / Math.max(topDecisions.length, 1)) * 2 * Math.PI) - Math.PI / 2;
    const radius = 160 + (index % 2) * 40;
    nodes.push({
      id: `insight_${insight.id}`,
      type: 'decision',
      title: insight.summary.length > 25 ? insight.summary.slice(0, 25) + '...' : insight.summary,
      subtitle: insight.source?.slice(0, 15) || '',
      confidence: insight.confidence,
      x: hub.x + Math.cos(angle) * radius,
      y: hub.y + Math.sin(angle) * radius,
      sourceId: insight.id,
      metadata: { detail: insight.detail, category: 'decision' }
    });
  });
  
  // Questions - take top 4
  const topQuestions = [...questionInsights].slice(0, MAX_ITEMS_PER_CATEGORY);
  
  topQuestions.forEach((insight, index) => {
    const hub = CATEGORY_HUBS.questions;
    const angle = ((index / Math.max(topQuestions.length, 1)) * 2 * Math.PI) - Math.PI / 2;
    const radius = 160 + (index % 2) * 40;
    nodes.push({
      id: `insight_${insight.id}`,
      type: 'question',
      title: insight.summary.length > 25 ? insight.summary.slice(0, 25) + '...' : insight.summary,
      subtitle: insight.source?.slice(0, 15) || '',
      confidence: insight.confidence,
      x: hub.x + Math.cos(angle) * radius,
      y: hub.y + Math.sin(angle) * radius,
      sourceId: insight.id,
      metadata: { detail: insight.detail, category: 'question' }
    });
  });

  return nodes;
};

const generateConnectionsFromNodes = (nodes: GraphNode[], project: ProjectState): GraphConnection[] => {
  const connections: GraphConnection[] = [];
  
  // Find hub nodes
  const hubReq = nodes.find(n => n.id === 'hub_requirements');
  const hubStake = nodes.find(n => n.id === 'hub_stakeholders');
  const hubDec = nodes.find(n => n.id === 'hub_decisions');
  const hubQuest = nodes.find(n => n.id === 'hub_questions');
  
  // Hub-to-hub connections (the main relationship lines)
  if (hubReq && hubDec) {
    connections.push({
      id: 'hub_dec_req',
      from: hubDec.id,
      to: hubReq.id,
      strength: 'strong',
      type: 'informs',
      confidence: 'high',
    });
  }
  if (hubReq && hubStake) {
    connections.push({
      id: 'hub_stake_req',
      from: hubStake.id,
      to: hubReq.id,
      strength: 'medium',
      type: 'supports',
      confidence: 'high',
    });
  }
  if (hubQuest && hubReq) {
    connections.push({
      id: 'hub_quest_req',
      from: hubQuest.id,
      to: hubReq.id,
      strength: 'weak',
      type: 'requires',
      confidence: 'low',
    });
  }
  if (hubDec && hubStake) {
    connections.push({
      id: 'hub_stake_dec',
      from: hubStake.id,
      to: hubDec.id,
      strength: 'medium',
      type: 'informs',
      confidence: 'high',
    });
  }
  
  // Connect child nodes to their hubs only
  const reqNodes = nodes.filter(n => n.id.startsWith('req_'));
  reqNodes.forEach(req => {
    if (hubReq) {
      connections.push({
        id: `conn_${hubReq.id}_${req.id}`,
        from: hubReq.id,
        to: req.id,
        strength: req.confidence === 'high' ? 'strong' : 'medium',
        type: 'derives',
        confidence: req.confidence,
      });
    }
  });
  
  const insightNodes = nodes.filter(n => n.id.startsWith('insight_'));
  insightNodes.forEach(insight => {
    const cat = insight.metadata?.category;
    let hub: GraphNode | undefined;
    
    if (insight.type === 'stakeholder') hub = hubStake;
    else if (insight.type === 'decision') hub = hubDec;
    else if (insight.type === 'question') hub = hubQuest;
    
    if (hub) {
      connections.push({
        id: `conn_${hub.id}_${insight.id}`,
        from: hub.id,
        to: insight.id,
        strength: insight.confidence === 'high' ? 'strong' : 'medium',
        type: 'derives',
        confidence: insight.confidence,
      });
    }
  });

  return connections;
};

// ============================================================================
// SUB-COMPONENTS
// ============================================================================

interface NodeComponentProps {
  node: GraphNode;
  isSelected: boolean;
  isHighlighted: boolean;
  isDimmed: boolean;
  zoom: number;
  onClick: () => void;
  onHover: (hovering: boolean) => void;
  onDrag: (nodeId: string, x: number, y: number) => void;
}

// Draggable node component
const NodeComponent: React.FC<NodeComponentProps> = React.memo(({
  node,
  isSelected,
  isHighlighted,
  isDimmed,
  onClick,
  onHover,
  onDrag,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const colors = NODE_COLORS[node.type];
  const Icon = NODE_ICONS[node.type];
  const confidenceIndicator = CONFIDENCE_INDICATORS[node.confidence];
  const isHubNode = node.id.startsWith('hub_');
  const isRequirementNode = node.id.startsWith('req_');
  const size = isHubNode ? 'w-40 h-16' : isRequirementNode ? 'w-36 h-14' : 'w-32 h-12';

  const handleMouseDown = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsDragging(true);
    const rect = (e.target as HTMLElement).closest('.graph-node-inner')?.getBoundingClientRect();
    if (rect) {
      setDragOffset({ x: e.clientX - rect.left - rect.width / 2, y: e.clientY - rect.top - rect.height / 2 });
    }
  };

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (isDragging) {
      e.preventDefault();
      const container = document.querySelector('.graph-canvas');
      if (container) {
        const rect = container.getBoundingClientRect();
        const zoom = parseFloat(container.getAttribute('data-zoom') || '1');
        const panX = parseFloat(container.getAttribute('data-pan-x') || '0');
        const panY = parseFloat(container.getAttribute('data-pan-y') || '0');
        const newX = (e.clientX - rect.left - panX) / zoom;
        const newY = (e.clientY - rect.top - panY) / zoom;
        onDrag(node.id, newX, newY);
      }
    }
  }, [isDragging, node.id, onDrag]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      return () => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging, handleMouseMove, handleMouseUp]);

  return (
    <div
      className={`absolute select-none transition-all duration-100 graph-node-inner ${isDragging ? 'cursor-grabbing z-[200]' : 'cursor-grab'}`}
      style={{
        left: node.x,
        top: node.y,
        transform: `translate(-50%, -50%) scale(${isSelected ? 1.05 : isHighlighted ? 1.02 : 1})`,
        zIndex: isDragging ? 200 : isSelected ? 100 : isHighlighted ? 50 : isHubNode ? 30 : 10,
        opacity: isDimmed ? 0.35 : 1,
      }}
      onClick={(e) => { if (!isDragging) onClick(); }}
      onMouseDown={handleMouseDown}
      onMouseEnter={() => !isDragging && onHover(true)}
      onMouseLeave={() => !isDragging && onHover(false)}
    >
      <div
        className={`
          ${size} ${colors.bg} ${colors.border} border-2 rounded-xl
          flex items-center gap-2 px-2.5 py-1.5
          shadow-sm hover:shadow-lg transition-shadow duration-150
          ${isSelected ? `ring-2 ring-blue-500 ring-offset-2 shadow-lg ${colors.glow}` : ''}
          ${isHighlighted && !isSelected ? `shadow-md ${colors.glow}` : ''}
          ${isHubNode ? 'border-2 bg-gradient-to-br from-white to-slate-50 shadow-md' : ''}
        `}
      >
        {/* Icon Container */}
        <div className={`
          flex-shrink-0 ${isHubNode ? 'w-8 h-8' : 'w-6 h-6'} rounded-lg flex items-center justify-center
          ${colors.bg} border ${colors.border}
          ${isHubNode ? 'shadow-sm' : ''}
        `}>
          <Icon className={`${isHubNode ? 'w-4 h-4' : 'w-3 h-3'} ${colors.icon}`} />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <p className={`${isHubNode ? 'text-xs font-bold' : 'text-[10px] font-semibold'} text-slate-800 truncate leading-tight`}>
            {node.title}
          </p>
          {node.subtitle && (
            <p className="text-[9px] text-slate-500 truncate mt-0.5">
              {node.subtitle}
            </p>
          )}
        </div>

        {/* Confidence Indicator - only show for non-hub nodes */}
        {!isHubNode && (
          <div className="flex-shrink-0 flex flex-col items-center">
            <div 
              className={`
                w-2 h-2 rounded-full ${confidenceIndicator.color}
                ${confidenceIndicator.pulse ? 'animate-pulse' : ''}
              `} 
            />
          </div>
        )}
      </div>
    </div>
  );
});

NodeComponent.displayName = 'NodeComponent';

interface ConnectionLineProps {
  connection: GraphConnection;
  fromNode: GraphNode;
  toNode: GraphNode;
  isHighlighted: boolean;
  isDimmed: boolean;
  zoom: number;
}

// Animated connection line with flowing particle
const ConnectionLine: React.FC<ConnectionLineProps> = React.memo(({
  connection,
  fromNode,
  toNode,
  isHighlighted,
  isDimmed,
}) => {
  const strengthStyles = {
    strong: { strokeWidth: 2.5, opacity: 0.65 },
    medium: { strokeWidth: 2, opacity: 0.5 },
    weak: { strokeWidth: 1.5, opacity: 0.35 },
  };

  const confidenceColors = {
    high: { stroke: '#3b82f6', glow: '#93c5fd' },
    medium: { stroke: '#f59e0b', glow: '#fcd34d' },
    low: { stroke: '#ef4444', glow: '#fca5a5' },
  };

  const style = strengthStyles[connection.strength];
  const colors = confidenceColors[connection.confidence];

  const x1 = fromNode.x;
  const y1 = fromNode.y;
  const x2 = toNode.x;
  const y2 = toNode.y;

  // Curved line
  const midX = (x1 + x2) / 2;
  const midY = (y1 + y2) / 2;
  const dx = x2 - x1;
  const dy = y2 - y1;
  const dist = Math.sqrt(dx * dx + dy * dy);
  const curvature = Math.min(dist * 0.12, 40);
  const perpX = dist > 0 ? -dy / dist * curvature : 0;
  const perpY = dist > 0 ? dx / dist * curvature : 0;
  const ctrlX = midX + perpX;
  const ctrlY = midY + perpY;
  
  const pathD = `M ${x1} ${y1} Q ${ctrlX} ${ctrlY} ${x2} ${y2}`;
  
  const opacity = isDimmed ? style.opacity * 0.2 : isHighlighted ? style.opacity + 0.25 : style.opacity;
  const strokeW = isHighlighted ? style.strokeWidth + 1 : style.strokeWidth;
  const dashArray = connection.confidence === 'low' ? '6,6' : connection.confidence === 'medium' ? '10,5' : 'none';

  // Generate stable animation duration based on connection id
  const animDuration = 2.5 + (connection.id.length % 10) * 0.15;

  return (
    <g>
      {/* Glow effect for highlighted */}
      {isHighlighted && (
        <path
          d={pathD}
          fill="none"
          stroke={colors.glow}
          strokeWidth={strokeW + 4}
          strokeOpacity={0.35}
          strokeLinecap="round"
          style={{ filter: 'blur(3px)' }}
        />
      )}
      
      {/* Main path */}
      <path
        d={pathD}
        fill="none"
        stroke={colors.stroke}
        strokeWidth={strokeW}
        strokeOpacity={opacity}
        strokeLinecap="round"
        strokeDasharray={dashArray}
      />
      
      {/* Animated flowing particle - only show when not dimmed */}
      {!isDimmed && (
        <circle
          r={isHighlighted ? 4 : 3}
          fill={colors.stroke}
          opacity={0.9}
        >
          <animateMotion
            dur={`${animDuration}s`}
            repeatCount="indefinite"
            path={pathD}
          />
        </circle>
      )}
    </g>
  );
});

// Assign display name for React DevTools
ConnectionLine.displayName = 'ConnectionLine';

interface DetailPanelProps {
  node: GraphNode | null;
  connections: GraphConnection[];
  allNodes: GraphNode[];
  onClose: () => void;
  onSelectNode: (node: GraphNode) => void;
  project: ProjectState;
}

const DetailPanel: React.FC<DetailPanelProps> = ({ node, connections, allNodes, onClose, onSelectNode, project }) => {
  if (!node) return null;

  const colors = NODE_COLORS[node.type];
  const Icon = NODE_ICONS[node.type];
  const relatedConnections = connections.filter(c => c.from === node.id || c.to === node.id);
  
  const getConnectedNodes = () => {
    return relatedConnections.map(conn => {
      const connectedId = conn.from === node.id ? conn.to : conn.from;
      return allNodes.find(n => n.id === connectedId);
    }).filter(Boolean) as GraphNode[];
  };

  const connectedNodes = getConnectedNodes();

  // Find linked BRD sections
  const linkedSections = project.brd?.sections.filter(section => 
    node.metadata?.linkedSections?.includes(section.id) ||
    section.sources?.some(s => s.includes(node.id))
  ) || [];

  return (
    <motion.div
      className="absolute right-0 top-0 h-full w-96 bg-white border-l border-slate-200 shadow-xl z-50 overflow-hidden"
      initial={{ x: 400, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: 400, opacity: 0 }}
      transition={{ type: 'spring', damping: 25, stiffness: 200 }}
    >
      {/* Header */}
      <div className={`px-6 py-4 border-b border-slate-100 ${colors.bg}`}>
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl ${colors.bg} border-2 ${colors.border} flex items-center justify-center`}>
              <Icon className={`w-5 h-5 ${colors.icon}`} />
            </div>
            <div>
              <span className={`text-[10px] uppercase tracking-wider font-semibold ${colors.icon}`}>
                {node.type}
              </span>
              <h3 className="text-base font-bold text-slate-800 leading-tight mt-0.5">
                {node.title.length > 35 ? node.title.slice(0, 35) + '...' : node.title}
              </h3>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg hover:bg-slate-200/60 flex items-center justify-center transition-colors"
          >
            <X className="w-4 h-4 text-slate-500" />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="overflow-y-auto h-[calc(100%-80px)] p-6 space-y-6">
        {/* Confidence Score */}
        <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-slate-600 uppercase tracking-wide">
              Confidence Level
            </span>
            <span className={`text-xs font-bold uppercase px-2 py-0.5 rounded-full ${
              node.confidence === 'high' ? 'bg-emerald-100 text-emerald-700' :
              node.confidence === 'medium' ? 'bg-amber-100 text-amber-700' :
              'bg-red-100 text-red-700'
            }`}>
              {node.confidence}
            </span>
          </div>
          <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${
                node.confidence === 'high' ? 'bg-emerald-500 w-full' :
                node.confidence === 'medium' ? 'bg-amber-500 w-2/3' :
                'bg-red-500 w-1/3'
              }`}
            />
          </div>
        </div>

        {/* Origin / Source */}
        {node.metadata?.source && (
          <div>
            <h4 className="text-xs font-semibold text-slate-600 uppercase tracking-wide mb-2 flex items-center gap-2">
              <ExternalLink className="w-3 h-3" /> Origin
            </h4>
            <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
              <div className="flex items-center gap-2 text-sm text-slate-700">
                {node.metadata.sourceType === 'meeting' && <Video className="w-4 h-4 text-emerald-600" />}
                {node.metadata.sourceType === 'email' && <Mail className="w-4 h-4 text-amber-600" />}
                {node.metadata.sourceType === 'slack' && <MessageSquare className="w-4 h-4 text-purple-600" />}
                {node.metadata.sourceType === 'jira' && <Target className="w-4 h-4 text-blue-600" />}
                {node.metadata.sourceType === 'upload' && <FolderOpen className="w-4 h-4 text-slate-600" />}
                <span className="font-medium">{node.metadata.source}</span>
              </div>
              {node.metadata.status && (
                <span className={`inline-block mt-2 text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full ${
                  node.metadata.status === 'approved' ? 'bg-emerald-100 text-emerald-700' :
                  node.metadata.status === 'flagged' ? 'bg-orange-100 text-orange-700' :
                  node.metadata.status === 'rejected' ? 'bg-red-100 text-red-700' :
                  'bg-slate-200 text-slate-600'
                }`}>
                  {node.metadata.status}
                </span>
              )}
            </div>
          </div>
        )}

        {/* Detail / Description */}
        {node.metadata?.detail && (
          <div>
            <h4 className="text-xs font-semibold text-slate-600 uppercase tracking-wide mb-2 flex items-center gap-2">
              <Info className="w-3 h-3" /> Detail
            </h4>
            <p className="text-sm text-slate-600 leading-relaxed bg-slate-50 rounded-xl p-4 border border-slate-100">
              {node.metadata.detail}
            </p>
          </div>
        )}

        {/* Connections */}
        {connectedNodes.length > 0 && (
          <div>
            <h4 className="text-xs font-semibold text-slate-600 uppercase tracking-wide mb-2 flex items-center gap-2">
              <Layers className="w-3 h-3" /> Connected Nodes ({connectedNodes.length})
            </h4>
            <div className="space-y-2">
              {connectedNodes.slice(0, 5).map(connNode => {
                const ConnIcon = NODE_ICONS[connNode.type];
                const connColors = NODE_COLORS[connNode.type];
                return (
                  <div
                    key={connNode.id}
                    onClick={() => onSelectNode(connNode)}
                    className={`flex items-center gap-3 p-3 rounded-xl ${connColors.bg} border ${connColors.border} cursor-pointer hover:shadow-md hover:scale-[1.02] transition-all`}
                  >
                    <ConnIcon className={`w-4 h-4 ${connColors.icon}`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-slate-700 truncate">{connNode.title}</p>
                      <p className="text-[10px] text-slate-500 capitalize">{connNode.type}</p>
                    </div>
                    <ChevronRight className="w-3 h-3 text-slate-400" />
                  </div>
                );
              })}
              {connectedNodes.length > 5 && (
                <p className="text-xs text-slate-500 text-center py-2">
                  +{connectedNodes.length - 5} more connections
                </p>
              )}
            </div>
          </div>
        )}

        {/* Linked BRD Sections */}
        {linkedSections.length > 0 && (
          <div>
            <h4 className="text-xs font-semibold text-slate-600 uppercase tracking-wide mb-2 flex items-center gap-2">
              <FileText className="w-3 h-3" /> Linked BRD Sections
            </h4>
            <div className="space-y-2">
              {linkedSections.map(section => (
                <div
                  key={section.id}
                  className="flex items-center gap-3 p-3 rounded-xl bg-blue-50 border border-blue-200"
                >
                  <FileText className="w-4 h-4 text-blue-600" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-slate-700 truncate">{section.title}</p>
                    <p className="text-[10px] text-slate-500">{Math.round(section.confidence * 100)}% confidence</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Gap / Ambiguity Warning */}
        {node.confidence === 'low' && (
          <div className="bg-orange-50 border border-orange-200 rounded-xl p-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-orange-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-orange-800">Ambiguity Detected</p>
                <p className="text-xs text-orange-700 mt-1">
                  This node has low confidence. Consider gathering more information or clarifying with stakeholders.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================

const GraphView: React.FC<GraphViewProps> = ({ project, onUpdate }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [nodes, setNodes] = useState<GraphNode[]>([]);
  const [connections, setConnections] = useState<GraphConnection[]>([]);
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [hoveredNode, setHoveredNode] = useState<GraphNode | null>(null);
  const [zoom, setZoom] = useState(1); // Normal zoom for clean layout
  const [pan, setPan] = useState({ x: 100, y: 50 }); // Center the graph
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<NodeType | 'all'>('all');
  const [filterConfidence, setFilterConfidence] = useState<ConfidenceLevel | 'all'>('all');
  const [showFilters, setShowFilters] = useState(false);
  const [showLegend, setShowLegend] = useState(true);
  const [nodePositions, setNodePositions] = useState<Record<string, {x: number, y: number}>>({});

  // Handle node drag
  const handleNodeDrag = useCallback((nodeId: string, x: number, y: number) => {
    setNodePositions(prev => ({ ...prev, [nodeId]: { x, y } }));
  }, []);

  // Initialize graph data
  useEffect(() => {
    const generatedNodes = generateNodesFromProject(project);
    const generatedConnections = generateConnectionsFromNodes(generatedNodes, project);
    setNodes(generatedNodes);
    setConnections(generatedConnections);
  }, [project]);

  // Filtered nodes based on search and filters
  const filteredNodes = useMemo(() => {
    return nodes.filter(node => {
      const matchesSearch = searchQuery === '' || 
        node.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        node.subtitle?.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesType = filterType === 'all' || node.type === filterType;
      const matchesConfidence = filterConfidence === 'all' || node.confidence === filterConfidence;
      return matchesSearch && matchesType && matchesConfidence;
    });
  }, [nodes, searchQuery, filterType, filterConfidence]);

  const filteredNodeIds = useMemo(() => new Set(filteredNodes.map(n => n.id)), [filteredNodes]);

  // Get connected node IDs for highlighting
  const getConnectedNodeIds = useCallback((nodeId: string): Set<string> => {
    const connectedIds = new Set<string>();
    connections.forEach(conn => {
      if (conn.from === nodeId) connectedIds.add(conn.to);
      if (conn.to === nodeId) connectedIds.add(conn.from);
    });
    return connectedIds;
  }, [connections]);

  const highlightedNodeIds = useMemo(() => {
    if (!hoveredNode && !selectedNode) return new Set<string>();
    const targetNode = hoveredNode || selectedNode;
    if (!targetNode) return new Set<string>();
    const connected = getConnectedNodeIds(targetNode.id);
    connected.add(targetNode.id);
    return connected;
  }, [hoveredNode, selectedNode, getConnectedNodeIds]);

  // Pan handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('.graph-node')) return;
    setIsDragging(true);
    setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    setPan({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // Zoom handlers
  const handleZoomIn = () => setZoom(prev => Math.min(prev + 0.1, 2));
  const handleZoomOut = () => setZoom(prev => Math.max(prev - 0.1, 0.5));
  const handleResetView = () => {
    setZoom(1);
    setPan({ x: 100, y: 50 });
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.05 : 0.05;
    setZoom(prev => Math.max(0.5, Math.min(2, prev + delta)));
  };

  // Stats calculations
  const stats = useMemo(() => {
    const highConfidence = nodes.filter(n => n.confidence === 'high').length;
    const mediumConfidence = nodes.filter(n => n.confidence === 'medium').length;
    const lowConfidence = nodes.filter(n => n.confidence === 'low').length;
    const requirements = nodes.filter(n => n.type === 'requirement').length;
    const questions = nodes.filter(n => n.type === 'question').length;
    return { highConfidence, mediumConfidence, lowConfidence, requirements, questions, total: nodes.length };
  }, [nodes]);

  return (
    <div className="h-[calc(100vh-4rem)] flex flex-col bg-gradient-to-br from-slate-50 via-white to-slate-50">
      {/* Header */}
      <div className="flex-shrink-0 px-4 lg:px-6 py-4 bg-white/80 backdrop-blur-sm border-b border-slate-200">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div>
            <h1 className="text-lg lg:text-xl font-bold text-slate-800 flex items-center gap-2">
              <Layers className="w-5 h-5 text-blue-600" />
              BRD Relationship Map
            </h1>
            <p className="text-xs lg:text-sm text-slate-500 mt-0.5">
              Visualize how requirements, stakeholders, and decisions connect
            </p>
          </div>
          
          {/* Stats Pills */}
          <div className="flex flex-wrap items-center gap-2 lg:gap-3">
            <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-100 rounded-full">
              <span className="text-xs text-slate-500">Nodes</span>
              <span className="text-sm font-bold text-slate-800">{stats.total}</span>
            </div>
            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-emerald-50 rounded-full">
              <div className="w-2 h-2 rounded-full bg-emerald-500" />
              <span className="text-xs font-medium text-emerald-700">{stats.highConfidence} High</span>
            </div>
            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-amber-50 rounded-full">
              <div className="w-2 h-2 rounded-full bg-amber-500" />
              <span className="text-xs font-medium text-amber-700">{stats.mediumConfidence} Medium</span>
            </div>
            {stats.lowConfidence > 0 && (
              <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-red-50 rounded-full">
                <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                <span className="text-xs font-medium text-red-700">{stats.lowConfidence} Low</span>
              </div>
            )}
          </div>
        </div>

        {/* Search & Filters Bar */}
        <div className="flex flex-wrap items-center gap-2 lg:gap-3 mt-4">
          {/* Search */}
          <div className="relative flex-1 min-w-[150px] lg:max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search nodes..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-all"
            />
          </div>

          {/* Filter Toggle */}
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-2 px-3 lg:px-4 py-2 rounded-xl border transition-all ${
              showFilters ? 'bg-blue-50 border-blue-300 text-blue-700' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
          >
            <Filter className="w-4 h-4" />
            <span className="text-sm font-medium hidden sm:inline">Filters</span>
          </button>

          {/* Legend Toggle */}
          <button
            onClick={() => setShowLegend(!showLegend)}
            className={`flex items-center gap-2 px-3 lg:px-4 py-2 rounded-xl border transition-all ${
              showLegend ? 'bg-blue-50 border-blue-300 text-blue-700' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
          >
            {showLegend ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
            <span className="text-sm font-medium hidden sm:inline">Legend</span>
          </button>

          {/* Zoom Controls */}
          <div className="flex items-center gap-1 px-2 py-1 bg-white border border-slate-200 rounded-xl">
            <button
              onClick={handleZoomOut}
              className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors"
              title="Zoom Out"
            >
              <ZoomOut className="w-4 h-4 text-slate-600" />
            </button>
            <span className="text-xs font-medium text-slate-600 w-12 text-center">
              {Math.round(zoom * 100)}%
            </span>
            <button
              onClick={handleZoomIn}
              className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors"
              title="Zoom In"
            >
              <ZoomIn className="w-4 h-4 text-slate-600" />
            </button>
            <div className="w-px h-4 bg-slate-200 mx-1" />
            <button
              onClick={handleResetView}
              className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors"
              title="Reset View"
            >
              <RotateCcw className="w-4 h-4 text-slate-600" />
            </button>
          </div>
        </div>

        {/* Expandable Filters */}
        <AnimatePresence>
          {showFilters && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <div className="pt-4 flex flex-col lg:flex-row lg:items-center gap-4 lg:gap-6">
                {/* Node Type Filter */}
                <div>
                  <label className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold mb-1.5 block">
                    Node Type
                  </label>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {(['all', 'requirement', 'stakeholder', 'decision', 'question', 'meeting', 'email', 'document'] as const).map(type => (
                      <button
                        key={type}
                        onClick={() => setFilterType(type)}
                        className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all capitalize ${
                          filterType === type
                            ? 'bg-blue-600 text-white shadow-sm'
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                      >
                        {type}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Confidence Filter */}
                <div>
                  <label className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold mb-1.5 block">
                    Confidence
                  </label>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {(['all', 'high', 'medium', 'low'] as const).map(conf => (
                      <button
                        key={conf}
                        onClick={() => setFilterConfidence(conf)}
                        className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all capitalize ${
                          filterConfidence === conf
                            ? conf === 'high' ? 'bg-emerald-600 text-white' :
                              conf === 'medium' ? 'bg-amber-600 text-white' :
                              conf === 'low' ? 'bg-red-600 text-white' :
                              'bg-blue-600 text-white'
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                      >
                        {conf}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Graph Canvas */}
      <div className="flex-1 relative overflow-hidden">
        {/* Legend Overlay */}
        <AnimatePresence>
          {showLegend && (
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="absolute left-4 top-4 z-40 bg-white/95 backdrop-blur-sm rounded-xl border border-slate-200 shadow-lg p-4 w-56"
            >
              <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-3">Legend</h4>
              
              {/* Node Types */}
              <div className="space-y-2 mb-4">
                <p className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">Categories</p>
                {(['requirement', 'stakeholder', 'decision', 'question'] as const).map(type => {
                  const colors = NODE_COLORS[type];
                  const Icon = NODE_ICONS[type];
                  const labels: Record<string, string> = { requirement: 'Requirements', stakeholder: 'Stakeholders', decision: 'Decisions', question: 'Open Questions' };
                  return (
                    <div key={type} className="flex items-center gap-2">
                      <div className={`w-6 h-6 rounded-lg ${colors.bg} border ${colors.border} flex items-center justify-center`}>
                        <Icon className={`w-3 h-3 ${colors.icon}`} />
                      </div>
                      <span className="text-xs text-slate-600">{labels[type]}</span>
                    </div>
                  );
                })}
              </div>

              {/* Connection Styles */}
              <div className="space-y-2 mb-4">
                <p className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">Connections</p>
                <div className="flex items-center gap-2">
                  <div className="w-8 h-0.5 bg-blue-500 rounded-full" />
                  <span className="text-xs text-slate-600">High confidence</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-8 h-0.5 bg-amber-500 rounded-full" style={{ backgroundImage: 'repeating-linear-gradient(90deg, #f59e0b 0, #f59e0b 4px, transparent 4px, transparent 8px)' }} />
                  <span className="text-xs text-slate-600">Medium confidence</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-8 h-0.5 rounded-full" style={{ backgroundImage: 'repeating-linear-gradient(90deg, #ef4444 0, #ef4444 2px, transparent 2px, transparent 4px)' }} />
                  <span className="text-xs text-slate-600">Low confidence</span>
                </div>
              </div>

              {/* Confidence Indicators */}
              <div className="space-y-2">
                <p className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">Confidence</p>
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
                  <span className="text-xs text-slate-600">High confidence</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full bg-amber-400" />
                  <span className="text-xs text-slate-600">Medium confidence</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full bg-red-400 animate-pulse" />
                  <span className="text-xs text-slate-600">Low / Needs review</span>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Canvas */}
        <div
          ref={containerRef}
          className="absolute inset-0 cursor-grab active:cursor-grabbing graph-canvas"
          data-zoom={zoom}
          data-pan-x={pan.x}
          data-pan-y={pan.y}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onWheel={handleWheel}
          style={{
            backgroundImage: `
              radial-gradient(circle at 1px 1px, rgba(148, 163, 184, 0.15) 1px, transparent 0)
            `,
            backgroundSize: `${24 * zoom}px ${24 * zoom}px`,
            backgroundPosition: `${pan.x}px ${pan.y}px`,
          }}
        >
          {/* SVG Connections Layer */}
          <svg
            className="absolute pointer-events-none"
            style={{
              transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
              transformOrigin: '0 0',
              width: '2000px',
              height: '1600px',
              overflow: 'visible',
            }}
          >
            {connections.map(connection => {
              const fromNodeBase = nodes.find(n => n.id === connection.from);
              const toNodeBase = nodes.find(n => n.id === connection.to);
              if (!fromNodeBase || !toNodeBase) return null;
              if (!filteredNodeIds.has(fromNodeBase.id) && !filteredNodeIds.has(toNodeBase.id)) return null;

              // Apply custom positions if dragged
              const fromPos = nodePositions[fromNodeBase.id];
              const toPos = nodePositions[toNodeBase.id];
              const fromNode = fromPos ? { ...fromNodeBase, x: fromPos.x, y: fromPos.y } : fromNodeBase;
              const toNode = toPos ? { ...toNodeBase, x: toPos.x, y: toPos.y } : toNodeBase;

              const isHighlighted = highlightedNodeIds.has(fromNode.id) && highlightedNodeIds.has(toNode.id);
              const isDimmed = highlightedNodeIds.size > 0 && !isHighlighted;

              return (
                <ConnectionLine
                  key={connection.id}
                  connection={connection}
                  fromNode={fromNode}
                  toNode={toNode}
                  isHighlighted={isHighlighted}
                  isDimmed={isDimmed}
                  zoom={zoom}
                />
              );
            })}
          </svg>

          {/* Nodes Layer */}
          <div
            className="absolute"
            style={{
              transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
              transformOrigin: '0 0',
              width: '2000px',
              height: '1600px',
            }}
          >
            {filteredNodes.map(node => {
              const isSelected = selectedNode?.id === node.id;
              const isHighlighted = highlightedNodeIds.has(node.id);
              const isDimmed = highlightedNodeIds.size > 0 && !isHighlighted;
              const pos = nodePositions[node.id];
              const displayNode = pos ? { ...node, x: pos.x, y: pos.y } : node;

              return (
                <div key={node.id} className="graph-node">
                  <NodeComponent
                    node={displayNode}
                    isSelected={isSelected}
                    isHighlighted={isHighlighted}
                    isDimmed={isDimmed}
                    zoom={zoom}
                    onClick={() => setSelectedNode(isSelected ? null : node)}
                    onHover={(hovering) => setHoveredNode(hovering ? node : null)}
                    onDrag={handleNodeDrag}
                  />
                </div>
              );
            })}
          </div>
        </div>

        {/* Detail Panel */}
        <AnimatePresence>
          {selectedNode && (
            <DetailPanel
              node={selectedNode}
              connections={connections}
              allNodes={nodes}
              onClose={() => setSelectedNode(null)}
              onSelectNode={(targetNode) => {
                // Get target position (use custom position if dragged)
                const pos = nodePositions[targetNode.id];
                const targetX = pos ? pos.x : targetNode.x;
                const targetY = pos ? pos.y : targetNode.y;
                // Center the view on the target node
                const containerRect = containerRef.current?.getBoundingClientRect();
                if (containerRect) {
                  const centerX = containerRect.width / 2;
                  const centerY = containerRect.height / 2;
                  setPan({ x: centerX - targetX * zoom, y: centerY - targetY * zoom });
                }
                // Select the target node
                setSelectedNode(targetNode);
              }}
              project={project}
            />
          )}
        </AnimatePresence>

        {/* Empty State */}
        {nodes.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center max-w-md">
              <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Layers className="w-8 h-8 text-slate-400" />
              </div>
              <h3 className="text-lg font-semibold text-slate-700 mb-2">No Graph Data Yet</h3>
              <p className="text-sm text-slate-500">
                Add data sources and generate insights to see how your requirements connect with stakeholders, decisions, and more.
              </p>
            </div>
          </div>
        )}

        {/* Filtered Empty State */}
        {nodes.length > 0 && filteredNodes.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="text-center max-w-md bg-white/90 backdrop-blur-sm rounded-xl p-6 shadow-lg border border-slate-200">
              <Search className="w-10 h-10 text-slate-300 mx-auto mb-3" />
              <h3 className="text-base font-semibold text-slate-700 mb-1">No Matching Nodes</h3>
              <p className="text-sm text-slate-500">
                Try adjusting your search or filters to find what you're looking for.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default GraphView;