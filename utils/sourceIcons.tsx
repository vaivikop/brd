import React from 'react';
import { Mail, Video, MessageSquare, Database, FileText, Upload, File } from 'lucide-react';

export type SourceType = 'meeting' | 'email' | 'slack' | 'jira' | 'upload';

interface SourceIconProps {
  type: SourceType | string;
  className?: string;
}

/**
 * Get the appropriate icon component for a source type
 */
export const SourceIcon: React.FC<SourceIconProps> = ({ type, className = "h-4 w-4" }) => {
  switch (type) {
    case 'meeting':
      return <Video className={className} />;
    case 'email':
      return <Mail className={className} />;
    case 'slack':
      return <MessageSquare className={className} />;
    case 'jira':
      return <Database className={className} />;
    case 'upload':
      return <Upload className={className} />;
    default:
      return <FileText className={className} />;
  }
};

/**
 * Get the source type from a source name by analyzing its content/pattern
 */
export const inferSourceType = (sourceName: string): SourceType => {
  const lowerName = sourceName.toLowerCase();
  
  if (lowerName.includes('email') || lowerName.includes('re:') || lowerName.includes('fwd:') || lowerName.includes('@')) {
    return 'email';
  }
  if (lowerName.includes('meeting') || lowerName.includes('transcript') || lowerName.includes('call') || lowerName.includes('review')) {
    return 'meeting';
  }
  if (lowerName.includes('slack') || lowerName.includes('#') || lowerName.includes('channel')) {
    return 'slack';
  }
  if (lowerName.includes('jira') || lowerName.includes('ticket') || lowerName.includes('issue')) {
    return 'jira';
  }
  
  return 'upload';
};

/**
 * Get display name for a source type
 */
export const getSourceTypeName = (type: SourceType | string): string => {
  switch (type) {
    case 'meeting':
      return 'Meeting';
    case 'email':
      return 'Email';
    case 'slack':
      return 'Slack';
    case 'jira':
      return 'Jira';
    case 'upload':
      return 'Document';
    default:
      return 'Source';
  }
};

/**
 * Get color classes for a source type badge
 */
export const getSourceTypeColor = (type: SourceType | string): string => {
  switch (type) {
    case 'meeting':
      return 'bg-purple-50 text-purple-600 border-purple-100';
    case 'email':
      return 'bg-blue-50 text-blue-600 border-blue-100';
    case 'slack':
      return 'bg-emerald-50 text-emerald-600 border-emerald-100';
    case 'jira':
      return 'bg-indigo-50 text-indigo-600 border-indigo-100';
    case 'upload':
      return 'bg-amber-50 text-amber-600 border-amber-100';
    default:
      return 'bg-slate-50 text-slate-600 border-slate-100';
  }
};

/**
 * Component to render a source badge with icon
 */
interface SourceBadgeProps {
  sourceName: string;
  sourceType?: SourceType | string;
  showTypeName?: boolean;
  className?: string;
}

export const SourceBadge: React.FC<SourceBadgeProps> = ({ 
  sourceName, 
  sourceType, 
  showTypeName = false,
  className = "" 
}) => {
  const type = sourceType || inferSourceType(sourceName);
  const colorClasses = getSourceTypeColor(type);
  
  // Clean up the source name (remove any emoji prefixes)
  const cleanName = sourceName.replace(/^[\u{1F300}-\u{1F9FF}]\s*/u, '').trim();
  
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border ${colorClasses} ${className}`}>
      <SourceIcon type={type} className="h-3.5 w-3.5" />
      {showTypeName && <span className="font-semibold">{getSourceTypeName(type)}:</span>}
      <span className="truncate max-w-[200px]">{cleanName}</span>
    </span>
  );
};
