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

const generateNodesFromProject = (project: ProjectState): GraphNode[] => {
  const nodes: GraphNode[] = [];
  const centerX = 600;
  const centerY = 400;
  
  // Generate requirement nodes from BRD sections
  if (project.brd?.sections) {
    project.brd.sections.forEach((section, index) => {
      const angle = (index / Math.max(project.brd!.sections.length, 1)) * 2 * Math.PI - Math.PI / 2;
      const radius = 180;
      nodes.push({
        id: `req_${section.id}`,
        type: 'requirement',
        title: section.title,
        subtitle: `${Math.round(section.confidence * 100)}% confident`,
        confidence: section.confidence >= 0.8 ? 'high' : section.confidence >= 0.5 ? 'medium' : 'low',
        x: centerX + Math.cos(angle) * radius,
        y: centerY + Math.sin(angle) * radius,
        metadata: {
          detail: section.content.slice(0, 200) + '...',
          linkedSections: section.sources,
        }
      });
    });
  }

  // Generate insight-based nodes
  if (project.insights) {
    project.insights.forEach((insight, index) => {
      const baseAngle = (index / Math.max(project.insights.length, 1)) * 2 * Math.PI;
      const radius = 350;
      
      let nodeType: NodeType = 'document';
      switch (insight.category) {
        case 'requirement': nodeType = 'requirement'; break;
        case 'decision': nodeType = 'decision'; break;
        case 'stakeholder': nodeType = 'stakeholder'; break;
        case 'question': nodeType = 'question'; break;
        case 'timeline': nodeType = 'document'; break;
      }

      // Skip requirements that might duplicate BRD sections
      if (insight.category === 'requirement' && project.brd?.sections) return;

      nodes.push({
        id: `insight_${insight.id}`,
        type: nodeType,
        title: insight.summary.length > 40 ? insight.summary.slice(0, 40) + '...' : insight.summary,
        subtitle: insight.source,
        confidence: insight.confidence,
        x: centerX + Math.cos(baseAngle) * radius,
        y: centerY + Math.sin(baseAngle) * radius,
        sourceId: insight.id,
        metadata: {
          source: insight.source,
          sourceType: insight.sourceType,
          detail: insight.detail,
          category: insight.category,
          status: insight.status,
        }
      });
    });
  }

  // Generate source nodes
  if (project.sources) {
    project.sources.forEach((source, index) => {
      const angle = (index / Math.max(project.sources.length, 1)) * 2 * Math.PI + Math.PI / 4;
      const radius = 480;
      
      let nodeType: NodeType = 'source';
      switch (source.type) {
        case 'meeting': nodeType = 'meeting'; break;
        case 'email': nodeType = 'email'; break;
        case 'slack': nodeType = 'source'; break;
        case 'jira': nodeType = 'document'; break;
        case 'upload': nodeType = 'document'; break;
      }

      nodes.push({
        id: `source_${source.id}`,
        type: nodeType,
        title: source.name,
        subtitle: source.type.charAt(0).toUpperCase() + source.type.slice(1),
        confidence: source.status === 'active' ? 'high' : 'medium',
        x: centerX + Math.cos(angle) * radius,
        y: centerY + Math.sin(angle) * radius,
        sourceId: source.id,
        metadata: {
          sourceType: source.type,
          status: source.status,
        }
      });
    });
  }

  // Add central hub node
  nodes.push({
    id: 'central_hub',
    type: 'requirement',
    title: project.name || 'Project Hub',
    subtitle: `${project.completeness || 0}% Complete`,
    confidence: project.overallConfidence >= 80 ? 'high' : project.overallConfidence >= 50 ? 'medium' : 'low',
    x: centerX,
    y: centerY,
    metadata: {
      detail: project.description,
    }
  });

  return nodes;
};

const generateConnectionsFromNodes = (nodes: GraphNode[], project: ProjectState): GraphConnection[] => {
  const connections: GraphConnection[] = [];
  const centralNode = nodes.find(n => n.id === 'central_hub');
  if (!centralNode) return connections;

  // Create lookup maps for efficient matching
  const sourcesByName = new Map<string, GraphNode>();
  const sourceNodes = nodes.filter(n => n.id.startsWith('source_'));
  sourceNodes.forEach(src => {
    sourcesByName.set(src.title.toLowerCase(), src);
  });

  // Connect BRD requirement sections to central hub
  const requirementNodes = nodes.filter(n => n.id.startsWith('req_'));
  requirementNodes.forEach((req) => {
    connections.push({
      id: `conn_hub_${req.id}`,
      from: centralNode.id,
      to: req.id,
      strength: req.confidence === 'high' ? 'strong' : req.confidence === 'medium' ? 'medium' : 'weak',
      type: 'derives',
      confidence: req.confidence,
    });
  });

  // Connect insights to their actual sources (by source name match)
  const insightNodes = nodes.filter(n => n.id.startsWith('insight_'));
  
  insightNodes.forEach(insight => {
    const sourceName = insight.metadata?.source?.toLowerCase();
    
    // Find matching source by exact name
    if (sourceName) {
      const matchingSource = sourcesByName.get(sourceName) || 
        Array.from(sourcesByName.entries()).find(([name]) => 
          name.includes(sourceName) || sourceName.includes(name)
        )?.[1];
      
      if (matchingSource) {
        connections.push({
          id: `conn_${matchingSource.id}_${insight.id}`,
          from: matchingSource.id,
          to: insight.id,
          strength: 'strong',
          type: 'derives',
          confidence: insight.confidence,
        });
      }
    }

    // Connect decision insights to the central hub (decisions affect the whole project)
    if (insight.type === 'decision') {
      connections.push({
        id: `conn_${insight.id}_hub`,
        from: insight.id,
        to: centralNode.id,
        strength: insight.confidence === 'high' ? 'strong' : 'medium',
        type: 'informs',
        confidence: insight.confidence,
      });
    }

    // Connect stakeholder insights to requirements they might influence
    if (insight.type === 'stakeholder' && requirementNodes.length > 0) {
      // Connect to requirement sections that reference this stakeholder
      requirementNodes.forEach((req, i) => {
        // Connect to first few requirements as stakeholders typically influence all
        if (i < 2) {
          connections.push({
            id: `conn_${insight.id}_${req.id}`,
            from: insight.id,
            to: req.id,
            strength: 'weak',
            type: 'supports',
            confidence: 'medium',
          });
        }
      });
    }
  });

  // Connect questions to central hub (representing gaps that need resolution)
  const questionNodes = nodes.filter(n => n.type === 'question');
  questionNodes.forEach(q => {
    connections.push({
      id: `conn_question_${q.id}`,
      from: q.id,
      to: centralNode.id,
      strength: 'weak',
      type: 'requires',
      confidence: 'low',
    });
  });

  // Connect requirements to related insights (content-based matching with BRD section sources)
  requirementNodes.forEach(req => {
    const linkedSources = req.metadata?.linkedSections || [];
    insightNodes.forEach(insight => {
      const insightSource = insight.metadata?.source;
      if (insightSource && linkedSources.includes(insightSource)) {
        connections.push({
          id: `conn_${insight.id}_${req.id}_traced`,
          from: insight.id,
          to: req.id,
          strength: 'medium',
          type: 'supports',
          confidence: insight.confidence,
        });
      }
    });
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
}

const NodeComponent: React.FC<NodeComponentProps> = ({
  node,
  isSelected,
  isHighlighted,
  isDimmed,
  zoom,
  onClick,
  onHover,
}) => {
  const colors = NODE_COLORS[node.type];
  const Icon = NODE_ICONS[node.type];
  const confidenceIndicator = CONFIDENCE_INDICATORS[node.confidence];
  const isMainNode = node.id === 'central_hub' || node.type === 'requirement';
  const size = isMainNode ? 'w-44 h-20' : 'w-36 h-16';

  return (
    <motion.div
      className={`absolute cursor-pointer select-none`}
      style={{
        left: node.x,
        top: node.y,
        transform: 'translate(-50%, -50%)',
        zIndex: isSelected ? 100 : isHighlighted ? 50 : 10,
      }}
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ 
        opacity: isDimmed ? 0.3 : 1, 
        scale: isSelected ? 1.08 : isHighlighted ? 1.04 : 1,
      }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
      onClick={onClick}
      onMouseEnter={() => onHover(true)}
      onMouseLeave={() => onHover(false)}
    >
      <div
        className={`
          ${size} ${colors.bg} ${colors.border} border-2 rounded-xl
          flex items-center gap-3 px-3 py-2
          shadow-sm hover:shadow-lg transition-all duration-200
          ${isSelected ? `ring-2 ring-blue-500 ring-offset-2 shadow-lg ${colors.glow}` : ''}
          ${isHighlighted && !isSelected ? `shadow-md ${colors.glow}` : ''}
          ${node.id === 'central_hub' ? 'border-blue-400 bg-gradient-to-br from-blue-50 to-indigo-50' : ''}
        `}
      >
        {/* Icon Container */}
        <div className={`
          flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center
          ${colors.bg} border ${colors.border}
        `}>
          <Icon className={`w-4 h-4 ${colors.icon}`} />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-slate-800 truncate leading-tight">
            {node.title}
          </p>
          {node.subtitle && (
            <p className="text-[10px] text-slate-500 truncate mt-0.5">
              {node.subtitle}
            </p>
          )}
        </div>

        {/* Confidence Indicator */}
        <div className="flex-shrink-0 flex flex-col items-center gap-1">
          <div 
            className={`
              w-2.5 h-2.5 rounded-full ${confidenceIndicator.color}
              ${confidenceIndicator.pulse ? 'animate-pulse' : ''}
            `} 
          />
          <span className="text-[8px] text-slate-400 uppercase tracking-wide">
            {node.confidence}
          </span>
        </div>
      </div>
    </motion.div>
  );
};

interface ConnectionLineProps {
  connection: GraphConnection;
  fromNode: GraphNode;
  toNode: GraphNode;
  isHighlighted: boolean;
  isDimmed: boolean;
  zoom: number;
}

const ConnectionLine: React.FC<ConnectionLineProps> = ({
  connection,
  fromNode,
  toNode,
  isHighlighted,
  isDimmed,
  zoom,
}) => {
  const pathId = `path-${connection.id}`;
  const gradientId = `gradient-${connection.id}`;
  
  const strengthStyles = {
    strong: { strokeWidth: 2.5, opacity: 0.7 },
    medium: { strokeWidth: 2, opacity: 0.5 },
    weak: { strokeWidth: 1.5, opacity: 0.35 },
  };

  const confidenceStyles = {
    high: { stroke: '#3b82f6', glowColor: '#93c5fd', dashArray: 'none' },
    medium: { stroke: '#f59e0b', glowColor: '#fcd34d', dashArray: '12,6' },
    low: { stroke: '#ef4444', glowColor: '#fca5a5', dashArray: '6,6' },
  };

  const style = strengthStyles[connection.strength];
  const confStyle = confidenceStyles[connection.confidence];

  // Use base coordinates without zoom - zoom is applied via transform
  const x1 = fromNode.x;
  const y1 = fromNode.y;
  const x2 = toNode.x;
  const y2 = toNode.y;

  // Calculate control point for curved lines
  const midX = (x1 + x2) / 2;
  const midY = (y1 + y2) / 2;
  const dx = x2 - x1;
  const dy = y2 - y1;
  const dist = Math.sqrt(dx * dx + dy * dy);
  const curvature = Math.min(dist * 0.12, 35);
  const perpX = dist > 0 ? -dy / dist * curvature : 0;
  const perpY = dist > 0 ? dx / dist * curvature : 0;
  const ctrlX = midX + perpX;
  const ctrlY = midY + perpY;
  
  const pathD = `M ${x1} ${y1} Q ${ctrlX} ${ctrlY} ${x2} ${y2}`;
  
  const baseOpacity = isDimmed ? style.opacity * 0.25 : isHighlighted ? style.opacity + 0.25 : style.opacity;
  const strokeW = isHighlighted ? style.strokeWidth + 1 : style.strokeWidth;

  return (
    <g>
      {/* Gradient definition */}
      <defs>
        <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor={confStyle.stroke} stopOpacity={0.3} />
          <stop offset="50%" stopColor={confStyle.stroke} stopOpacity={1} />
          <stop offset="100%" stopColor={confStyle.stroke} stopOpacity={0.3} />
        </linearGradient>
      </defs>
      
      {/* Glow effect layer */}
      {isHighlighted && (
        <motion.path
          d={pathD}
          fill="none"
          stroke={confStyle.glowColor}
          strokeWidth={strokeW + 4}
          strokeLinecap="round"
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.4 }}
          transition={{ duration: 0.3 }}
          style={{ filter: 'blur(4px)' }}
        />
      )}
      
      {/* Main path */}
      <motion.path
        id={pathId}
        d={pathD}
        fill="none"
        stroke={confStyle.stroke}
        strokeWidth={strokeW}
        strokeDasharray={confStyle.dashArray}
        strokeLinecap="round"
        initial={{ pathLength: 0, opacity: 0 }}
        animate={{ pathLength: 1, opacity: baseOpacity }}
        transition={{ duration: 0.8, ease: 'easeOut' }}
      />
      
      {/* Animated flowing particle */}
      {!isDimmed && (
        <motion.circle
          r={isHighlighted ? 4 : 3}
          fill={confStyle.stroke}
          initial={{ opacity: 0 }}
          animate={{ opacity: [0, 1, 1, 0] }}
          transition={{ duration: 2.5, repeat: Infinity, ease: 'linear', delay: Math.random() * 2 }}
        >
          <animateMotion
            dur={`${2 + Math.random()}s`}
            repeatCount="indefinite"
            path={pathD}
          />
        </motion.circle>
      )}
      
      {/* Second particle for highlighted connections */}
      {isHighlighted && !isDimmed && (
        <motion.circle
          r={3}
          fill={confStyle.glowColor}
          initial={{ opacity: 0 }}
          animate={{ opacity: [0, 0.8, 0.8, 0] }}
          transition={{ duration: 2, repeat: Infinity, ease: 'linear', delay: 1 }}
        >
          <animateMotion
            dur="2.5s"
            repeatCount="indefinite"
            path={pathD}
          />
        </motion.circle>
      )}
    </g>
  );
};

interface DetailPanelProps {
  node: GraphNode | null;
  connections: GraphConnection[];
  allNodes: GraphNode[];
  onClose: () => void;
  project: ProjectState;
}

const DetailPanel: React.FC<DetailPanelProps> = ({ node, connections, allNodes, onClose, project }) => {
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
                    className={`flex items-center gap-3 p-3 rounded-xl ${connColors.bg} border ${connColors.border} cursor-pointer hover:shadow-sm transition-shadow`}
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
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<NodeType | 'all'>('all');
  const [filterConfidence, setFilterConfidence] = useState<ConfidenceLevel | 'all'>('all');
  const [showFilters, setShowFilters] = useState(false);
  const [showLegend, setShowLegend] = useState(true);

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
    setPan({ x: 0, y: 0 });
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
                <p className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">Node Types</p>
                {Object.entries(NODE_ICONS).map(([type, Icon]) => {
                  const colors = NODE_COLORS[type as NodeType];
                  return (
                    <div key={type} className="flex items-center gap-2">
                      <div className={`w-6 h-6 rounded-lg ${colors.bg} border ${colors.border} flex items-center justify-center`}>
                        <Icon className={`w-3 h-3 ${colors.icon}`} />
                      </div>
                      <span className="text-xs text-slate-600 capitalize">{type}</span>
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
          className="absolute inset-0 cursor-grab active:cursor-grabbing"
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
              const fromNode = nodes.find(n => n.id === connection.from);
              const toNode = nodes.find(n => n.id === connection.to);
              if (!fromNode || !toNode) return null;
              if (!filteredNodeIds.has(fromNode.id) && !filteredNodeIds.has(toNode.id)) return null;

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

              return (
                <div key={node.id} className="graph-node">
                  <NodeComponent
                    node={node}
                    isSelected={isSelected}
                    isHighlighted={isHighlighted}
                    isDimmed={isDimmed}
                    zoom={zoom}
                    onClick={() => setSelectedNode(isSelected ? null : node)}
                    onHover={(hovering) => setHoveredNode(hovering ? node : null)}
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
