import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { 
  FileText, 
  Activity, 
  AlertTriangle, 
  CheckCircle, 
  ArrowRight, 
  Database, 
  MessageSquare, 
  Mail, 
  File,
  Clock,
  ShieldCheck,
  TrendingUp,
  Zap,
  PlusCircle,
  Sparkles,
  Search,
  Video,
  X,
  Edit3,
  Send,
  Loader2,
  RefreshCw,
  Target,
  ChevronRight,
  Bot,
  Copy,
  ThumbsUp,
  ThumbsDown,
  RotateCcw,
  Lightbulb,
  HelpCircle,
  Maximize2,
  Minimize2,
  Settings,
  Mic,
  MicOff,
  Volume2,
  BookOpen,
  Bookmark,
  History,
  Trash2
} from 'lucide-react';
import Button from './Button';
import Tooltip from './Tooltip';
import Mascot from './Mascot';
import { 
  ProjectState, 
  Task, 
  updateProjectContext,
  addTask,
  updateTask,
  deleteTask,
  updateInsightStatus,
  bulkUpdateInsights,
  updateBRD,
  addActivityLog,
  getProjectData
} from '../utils/db';
import { useToast } from '../context/ToastContext';
import { calculateAllMetrics } from '../utils/metrics';
import { 
  searchProject,
  SearchResult 
} from '../services/ai';
import {
  clarityChatService,
  ChatMessage,
  ChatResponse,
  AIAction,
  ProjectContext,
} from '../services/ChatService';

interface DashboardHomeProps {
  project: ProjectState;
  onNavigateToSources: () => void;
  onNavigateToGenerate?: () => void;
  onNavigateToInsights?: () => void;
  onNavigateToGraph?: () => void;
  onUpdateProject?: (project: ProjectState) => void;
}

const DashboardHome: React.FC<DashboardHomeProps> = ({ project, onNavigateToSources, onNavigateToGenerate, onNavigateToInsights, onNavigateToGraph, onUpdateProject }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showSearchResults, setShowSearchResults] = useState(false);
  
  // Edit Goals Modal
  const [showEditGoals, setShowEditGoals] = useState(false);
  const [editedGoals, setEditedGoals] = useState(project.goals || '');
  const [isSavingGoals, setIsSavingGoals] = useState(false);
  
  // Edit User Name
  const [showEditUserName, setShowEditUserName] = useState(false);
  const [editedUserName, setEditedUserName] = useState(project.userName || '');
  const [isSavingUserName, setIsSavingUserName] = useState(false);
  
  // ============================================================================
  // CLARITY AI CHATBOT - Enterprise Grade
  // ============================================================================
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [isChatLoading, setIsChatLoading] = useState(false);
  const [chatExpanded, setChatExpanded] = useState(true);
  const [showChatHistory, setShowChatHistory] = useState(false);
  const [chatSessionId] = useState(() => `session_${Date.now()}`);
  const [savedChats, setSavedChats] = useState<{id: string; title: string; messages: ChatMessage[]; timestamp: string}[]>([]);
  const [suggestedQuestions, setSuggestedQuestions] = useState<string[]>([]);
  const CHAT_STORAGE_KEY = 'clarity_chat_history';
  const CHAT_SESSION_KEY = 'clarity_current_chat';
  const [feedbackGiven, setFeedbackGiven] = useState<Set<number>>(new Set());
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [isListening, setIsListening] = useState(false);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const chatInputRef = useRef<HTMLTextAreaElement>(null);
  
  const { showToast } = useToast();
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Load chat history from localStorage on mount
  useEffect(() => {
    try {
      const storedChats = localStorage.getItem(CHAT_STORAGE_KEY);
      if (storedChats) {
        setSavedChats(JSON.parse(storedChats));
      }
      const currentChat = localStorage.getItem(CHAT_SESSION_KEY);
      if (currentChat) {
        setChatMessages(JSON.parse(currentChat));
      }
    } catch (err) {
      console.error('Failed to load chat history:', err);
    }
  }, []);

  // Save chat history to localStorage when savedChats changes
  useEffect(() => {
    try {
      localStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(savedChats));
    } catch (err) {
      console.error('Failed to save chat history:', err);
    }
  }, [savedChats]);

  // Save current session to localStorage when chatMessages changes
  useEffect(() => {
    try {
      if (chatMessages.length > 0) {
        localStorage.setItem(CHAT_SESSION_KEY, JSON.stringify(chatMessages));
      }
    } catch (err) {
      console.error('Failed to save current chat:', err);
    }
  }, [chatMessages]);

  // Calculate real metrics from actual project data (no AI required)
  const metrics = useMemo(() => calculateAllMetrics(project), [project]);

  // Simple Markdown renderer for chat messages
  const renderMarkdown = useCallback((text: string): React.ReactNode => {
    const elements: React.ReactNode[] = [];
    const lines = text.split('\n');
    
    lines.forEach((line, lineIndex) => {
      if (lineIndex > 0) {
        elements.push(<br key={`br-${lineIndex}`} />);
      }
      
      // Process inline formatting
      let remaining = line;
      const lineElements: React.ReactNode[] = [];
      let keyIndex = 0;
      
      while (remaining.length > 0) {
        // Check for bold **text**
        const boldMatch = remaining.match(/\*\*(.+?)\*\*/);
        // Check for bold with __text__
        const boldMatch2 = remaining.match(/__(.+?)__/);
        // Check for italic *text* (not preceded by *)
        const italicMatch = remaining.match(/(?<!\*)\*([^*]+?)\*(?!\*)/);
        // Check for italic with _text_
        const italicMatch2 = remaining.match(/(?<!_)_([^_]+?)_(?!_)/);
        // Check for inline code `text`
        const codeMatch = remaining.match(/`([^`]+?)`/);
        // Check for bullet points
        const bulletMatch = line.match(/^(\s*)[•\-\*]\s+(.*)$/);
        
        // Find earliest match
        const matches = [
          { match: boldMatch, type: 'bold', pattern: /\*\*(.+?)\*\*/ },
          { match: boldMatch2, type: 'bold2', pattern: /__(.+?)__/ },
          { match: italicMatch, type: 'italic', pattern: /(?<!\*)\*([^*]+?)\*(?!\*)/ },
          { match: italicMatch2, type: 'italic2', pattern: /(?<!_)_([^_]+?)_(?!_)/ },
          { match: codeMatch, type: 'code', pattern: /`([^`]+?)`/ },
        ].filter(m => m.match !== null);
        
        if (matches.length === 0) {
          // Handle bullet points at line start
          if (bulletMatch && lineElements.length === 0) {
            lineElements.push(
              <span key={`bullet-${lineIndex}`} className="inline-flex items-start gap-2">
                <span className="text-blue-500 mt-0.5">•</span>
                <span>{bulletMatch[2]}</span>
              </span>
            );
            remaining = '';
          } else {
            lineElements.push(remaining);
            remaining = '';
          }
        } else {
          // Sort by index to find earliest
          matches.sort((a, b) => (a.match?.index || 0) - (b.match?.index || 0));
          const earliest = matches[0];
          const match = earliest.match!;
          const index = match.index || 0;
          
          // Add text before match
          if (index > 0) {
            lineElements.push(remaining.slice(0, index));
          }
          
          // Add formatted text
          const content = match[1];
          switch (earliest.type) {
            case 'bold':
            case 'bold2':
              lineElements.push(<strong key={`strong-${lineIndex}-${keyIndex++}`} className="font-bold">{content}</strong>);
              break;
            case 'italic':
            case 'italic2':
              lineElements.push(<em key={`em-${lineIndex}-${keyIndex++}`} className="italic">{content}</em>);
              break;
            case 'code':
              lineElements.push(
                <code key={`code-${lineIndex}-${keyIndex++}`} className="px-1.5 py-0.5 bg-slate-200 text-slate-700 rounded text-xs font-mono">
                  {content}
                </code>
              );
              break;
          }
          
          remaining = remaining.slice(index + match[0].length);
        }
      }
      
      elements.push(<span key={`line-${lineIndex}`}>{lineElements}</span>);
    });
    
    return <>{elements}</>;
  }, []);

  // Search functionality
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      setShowSearchResults(false);
      return;
    }

    const debounce = setTimeout(async () => {
      setIsSearching(true);
      const results = await searchProject(searchQuery, {
        insights: project.insights.map(i => ({ 
          id: i.id, 
          category: i.category, 
          summary: i.summary, 
          detail: i.detail 
        })),
        tasks: project.tasks.map(t => ({ 
          id: t.id, 
          title: t.title, 
          source: t.source 
        })),
        brd: project.brd ? {
          sections: project.brd.sections.map(s => ({
            id: s.id,
            title: s.title,
            content: s.content
          }))
        } : undefined,
        sources: project.sources.map(s => ({
          id: s.id,
          name: s.name,
          type: s.type
        }))
      });
      setSearchResults(results);
      setShowSearchResults(true);
      setIsSearching(false);
    }, 300);

    return () => clearTimeout(debounce);
  }, [searchQuery, project]);

  // Auto-scroll chat
  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [chatMessages]);

  // Handle save goals
  const handleSaveGoals = async () => {
    setIsSavingGoals(true);
    try {
      const updated = await updateProjectContext({ goals: editedGoals });
      onUpdateProject?.(updated);
      setShowEditGoals(false);
      showToast({
        type: 'success',
        title: 'Goals Updated',
        message: 'Project goals saved successfully',
        duration: 3000,
      });
    } catch (err) {
      showToast({
        type: 'error',
        title: 'Failed to Save',
        message: 'Could not update project goals',
        duration: 4000,
      });
    } finally {
      setIsSavingGoals(false);
    }
  };

  // Handle save user name
  const handleSaveUserName = async () => {
    setIsSavingUserName(true);
    try {
      const updated = await updateProjectContext({ userName: editedUserName.trim() });
      onUpdateProject?.(updated);
      setShowEditUserName(false);
      showToast({
        type: 'success',
        title: 'Name Updated',
        message: 'Your name has been saved',
        duration: 3000,
      });
    } catch (err) {
      showToast({
        type: 'error',
        title: 'Failed to Save',
        message: 'Could not update your name',
        duration: 4000,
      });
    } finally {
      setIsSavingUserName(false);
    }
  };

  // Handle search result click
  const handleSearchResultClick = (result: SearchResult) => {
    setShowSearchResults(false);
    setSearchQuery('');
    
    switch(result.type) {
      case 'insight':
        onNavigateToInsights?.();
        break;
      case 'task':
        // Navigate to task
        showToast({ type: 'info', title: 'Task Selected', message: result.title });
        break;
      case 'brd_section':
        onNavigateToGenerate?.();
        break;
      case 'source':
        onNavigateToSources();
        break;
    }
  };

  // Navigate to the appropriate page to resolve the task based on its type
  const handleGoToResolve = (task: Task) => {
    // Show a toast with guidance
    const destinations: Record<Task['type'], { navigate: (() => void) | undefined; label: string; hint: string }> = {
      ambiguity: {
        navigate: onNavigateToInsights,
        label: 'Insights Review',
        hint: 'Clarify the ambiguous requirement in the insights panel'
      },
      approval: {
        navigate: onNavigateToGenerate,
        label: 'BRD Generation',
        hint: 'Review and approve the pending BRD section'
      },
      conflict: {
        navigate: onNavigateToInsights,
        label: 'Insights Review',
        hint: 'Resolve conflicting information between sources'
      },
      missing: {
        navigate: onNavigateToSources,
        label: 'Data Sources',
        hint: 'Add more sources to fill in missing information'
      }
    };

    const destination = destinations[task.type];
    
    showToast({
      type: 'info',
      title: `Go to ${destination.label}`,
      message: destination.hint,
      duration: 4000,
    });

    // Navigate after a brief delay so user sees the guidance
    setTimeout(() => {
      destination.navigate?.();
    }, 300);
  };

  // ============================================================================
  // CLARITY AI CHATBOT HANDLERS - Enterprise Grade
  // ============================================================================

  // Quick action prompts for the chatbot
  const quickPrompts = useMemo(() => [
    { icon: Lightbulb, label: 'Summarize insights', prompt: 'Give me a summary of all the key insights from my project sources' },
    { icon: AlertTriangle, label: 'Find conflicts', prompt: 'Are there any conflicting requirements or decisions in my project?' },
    { icon: Target, label: 'Key requirements', prompt: 'What are the main requirements identified so far?' },
    { icon: HelpCircle, label: 'What\'s missing', prompt: 'What information is missing that I need to complete the BRD?' },
    { icon: CheckCircle, label: 'Action items', prompt: 'What are the most urgent action items I should focus on?' },
    { icon: BookOpen, label: 'BRD status', prompt: 'What is the current status of my BRD and what sections need work?' },
  ], []);

  // ============================================================================
  // ACTION EXECUTOR - Execute actions from AI (Enterprise Grade)
  // ============================================================================
  const executeAIActions = useCallback(async (actions: AIAction[], userMessage?: string): Promise<{ success: boolean; results: string[] }> => {
    const results: string[] = [];
    let updatedProject = project;
    let hasErrors = false;
    
    // Validate actions before execution
    const validActions = actions.filter(action => {
      if (!action.type || action.type === 'none') return false;
      if (!action.data && ['add_task', 'update_project_goals'].includes(action.type)) {
        console.warn(`Action ${action.type} missing required data`);
        return false;
      }
      return true;
    });

    console.log(`Executing ${validActions.length} valid actions out of ${actions.length} total`);
    
    for (const action of validActions) {
      const actionStartTime = Date.now();
      try {
        switch (action.type) {
          case 'add_task': {
            const taskData = action.data as { title: string; type?: string; urgency?: string; description?: string };
            if (!taskData.title || taskData.title.length < 2) {
              results.push(`Skipped adding task: Invalid title`);
              break;
            }
            updatedProject = await addTask({
              title: taskData.title,
              type: (taskData.type as Task['type']) || 'missing',
              urgency: (taskData.urgency as Task['urgency']) || 'medium',
              source: 'Clarity AI',
              confidence: action.confidence || 80,
              description: taskData.description,
              status: 'pending'
            });
            results.push(`Added task: "${taskData.title}"`);
            await addActivityLog(`Created task: ${taskData.title}`, 'Clarity AI');
            break;
          }
          
          case 'complete_task': {
            const { taskId, title } = action.data as { taskId?: string; title?: string };
            const targetTask = taskId 
              ? project.tasks.find(t => t.id === taskId)
              : project.tasks.find(t => t.title.toLowerCase().includes((title || '').toLowerCase()));
            if (targetTask) {
              if (targetTask.status === 'completed') {
                results.push(`Task "${targetTask.title}" is already completed`);
              } else {
                updatedProject = await updateTask(targetTask.id, { 
                  status: 'completed', 
                  completedAt: new Date().toISOString() 
                });
                results.push(`Completed task: "${targetTask.title}"`);
                await addActivityLog(`Completed task: ${targetTask.title}`, 'Clarity AI');
              }
            } else {
              results.push(`Could not find task to complete`);
            }
            break;
          }
          
          case 'delete_task': {
            const { taskId, title } = action.data as { taskId?: string; title?: string };
            const targetTask = taskId 
              ? project.tasks.find(t => t.id === taskId)
              : project.tasks.find(t => t.title.toLowerCase().includes((title || '').toLowerCase()));
            if (targetTask) {
              updatedProject = await deleteTask(targetTask.id);
              results.push(`Deleted task: "${targetTask.title}"`);
              await addActivityLog(`Deleted task: ${targetTask.title}`, 'Clarity AI');
            } else {
              results.push(`Could not find task to delete`);
            }
            break;
          }
          
          case 'update_task': {
            const { taskId, title, updates } = action.data as { taskId?: string; title?: string; updates: Partial<Task> };
            const targetTask = taskId 
              ? project.tasks.find(t => t.id === taskId)
              : project.tasks.find(t => t.title.toLowerCase().includes((title || '').toLowerCase()));
            if (targetTask && updates) {
              updatedProject = await updateTask(targetTask.id, updates);
              results.push(`Updated task: "${targetTask.title}"`);
            }
            break;
          }
          
          case 'approve_insight': {
            const { insightId, summary } = action.data as { insightId?: string; summary?: string };
            const targetInsight = insightId 
              ? project.insights.find(i => i.id === insightId)
              : project.insights.find(i => i.summary.toLowerCase().includes((summary || '').toLowerCase()));
            if (targetInsight) {
              if (targetInsight.status === 'approved') {
                results.push(`Insight is already approved`);
              } else {
                updatedProject = await updateInsightStatus(targetInsight.id, 'approved');
                results.push(`Approved insight: "${targetInsight.summary.slice(0, 50)}..."`);
                await addActivityLog(`Approved insight: ${targetInsight.summary.slice(0, 30)}...`, 'Clarity AI');
              }
            }
            break;
          }
          
          case 'reject_insight': {
            const { insightId, summary } = action.data as { insightId?: string; summary?: string };
            const targetInsight = insightId 
              ? project.insights.find(i => i.id === insightId)
              : project.insights.find(i => i.summary.toLowerCase().includes((summary || '').toLowerCase()));
            if (targetInsight) {
              updatedProject = await updateInsightStatus(targetInsight.id, 'rejected');
              results.push(`Rejected insight: "${targetInsight.summary.slice(0, 50)}..."`);
              await addActivityLog(`Rejected insight: ${targetInsight.summary.slice(0, 30)}...`, 'Clarity AI');
            }
            break;
          }
          
          case 'approve_all_insights': {
            const pendingInsights = project.insights.filter(i => i.status !== 'approved' && i.status !== 'rejected');
            if (pendingInsights.length > 0) {
              updatedProject = await bulkUpdateInsights(
                pendingInsights.map(i => ({ insightId: i.id, updates: { status: 'approved' as const } }))
              );
              results.push(`Approved ${pendingInsights.length} insights`);
              await addActivityLog(`Bulk approved ${pendingInsights.length} insights`, 'Clarity AI');
            } else {
              results.push(`No pending insights to approve`);
            }
            break;
          }
          
          case 'update_brd_section': {
            const { sectionId, title, content, sectionTitle } = action.data as { 
              sectionId?: string; 
              title?: string; 
              sectionTitle?: string;
              content?: string 
            };
            if (project.brd && content) {
              const searchTitle = sectionTitle || title || '';
              const targetSection = sectionId 
                ? project.brd.sections.find(s => s.id === sectionId)
                : project.brd.sections.find(s => s.title.toLowerCase().includes(searchTitle.toLowerCase()));
              if (targetSection) {
                const updatedSections = project.brd.sections.map(s => 
                  s.id === targetSection.id ? { ...s, content, lastEdited: new Date().toISOString() } : s
                );
                updatedProject = await updateBRD({ ...project.brd, sections: updatedSections });
                results.push(`Updated BRD section: "${targetSection.title}"`);
                await addActivityLog(`Updated BRD section: ${targetSection.title}`, 'Clarity AI');
              } else {
                results.push(`Could not find BRD section to update`);
              }
            }
            break;
          }
          
          case 'add_brd_section': {
            const { title, content } = action.data as { title: string; content: string };
            if (project.brd && title && content) {
              // Check if section already exists
              const exists = project.brd.sections.some(s => 
                s.title.toLowerCase() === title.toLowerCase()
              );
              if (exists) {
                results.push(`Section "${title}" already exists`);
              } else {
                const newSection = {
                  id: `section_${Date.now()}`,
                  title,
                  content,
                  status: 'draft' as const,
                  confidence: action.confidence || 75,
                  lastEdited: new Date().toISOString(),
                  sources: []
                };
                updatedProject = await updateBRD({ 
                  ...project.brd, 
                  sections: [...project.brd.sections, newSection] 
                });
                results.push(`Added BRD section: "${title}"`);
                await addActivityLog(`Added BRD section: ${title}`, 'Clarity AI');
              }
            }
            break;
          }
          
          case 'update_project_goals': {
            console.log('update_project_goals action received:', JSON.stringify(action, null, 2));
            const actionData = action.data as { 
              goals?: string; 
              append?: boolean; 
              goal?: string; 
              text?: string; 
              content?: string 
            } | undefined;
            
            // Try multiple possible field names the AI might use
            let newGoals = actionData?.goals || actionData?.goal || actionData?.text || actionData?.content;
            const shouldAppend = actionData?.append !== false;
            
            if (!newGoals) {
              console.log('No goals in action data, trying to extract from description:', action.description);
              
              // Try multiple patterns to extract goal content from description
              const patterns = [
                /add\s+(.+?)\s+to\s+(?:the\s+)?(?:project\s+)?goals?/i,
                /(?:add|include|set)\s+(?:project\s+)?goals?\s+(?:to\s+)?(?:include\s+)?(.+)/i,
                /update\s+(?:project\s+)?goals?\s+(?:to\s+include\s+|with\s+)?(.+)/i,
                /(?:project\s+)?goals?:\s*(.+)/i,
                /^(.+)$/i // Fallback: use entire description
              ];
              
              for (const pattern of patterns) {
                const match = action.description?.match(pattern);
                if (match && match[1] && match[1].trim().length > 2) {
                  newGoals = match[1].trim();
                  newGoals = newGoals.replace(/\s+to\s+goals?$/i, '').trim();
                  console.log('Extracted goal from description:', newGoals);
                  break;
                }
              }
            }
            
            if (!newGoals || newGoals.length < 3) {
              // Last resort: extract from the user's original message
              if (userMessage) {
                const userPatterns = [
                  /(?:add|include|update).*?(?:goal|goals).*?(?:to\s+include\s+|with\s+|:\s*)?(.+?)(?:\.|$)/i,
                  /(?:goal|goals).*?(?:should|to).*?(?:include|add|have)\s+(.+?)(?:\.|$)/i,
                  /(?:include|add)\s+(.+?)\s+(?:to|in).*?(?:goal|goals)/i,
                ];
                
                for (const pattern of userPatterns) {
                  const match = userMessage.match(pattern);
                  if (match) {
                    newGoals = match[1] || match[0];
                    newGoals = newGoals.trim();
                    console.log('Extracted goal from user message:', newGoals);
                    break;
                  }
                }
              }
            }
            
            if (!newGoals || newGoals.length < 3) {
              results.push('Failed to update goals: Could not determine what to add');
              break;
            }
            
            // Determine final goals
            const existingGoals = project.goals || '';
            let finalGoals: string;
            
            if (shouldAppend && existingGoals) {
              // Check if the new content already includes existing goals (AI might have combined them)
              if (newGoals.includes(existingGoals.slice(0, 50))) {
                finalGoals = newGoals;
              } else {
                finalGoals = existingGoals.trim() + '\n\nAdditionally: ' + newGoals.trim();
              }
            } else {
              finalGoals = newGoals.trim();
            }
            
            console.log('Updating project goals:', { existingGoals: existingGoals.slice(0, 100), newGoals: newGoals.slice(0, 100) });
            updatedProject = await updateProjectContext({ goals: finalGoals });
            results.push('Updated project goals');
            await addActivityLog('Updated project goals', 'Clarity AI');
            break;
          }
          
          case 'navigate': {
            const { destination } = action.data as { destination: string };
            const normalizedDest = destination?.toLowerCase?.().trim() || '';
            let navigated = true;
            let targetName = destination;
            
            switch (normalizedDest) {
              case 'sources': 
              case 'data':
              case 'data sources':
                onNavigateToSources(); 
                targetName = 'Data Sources';
                break;
              case 'insights': 
              case 'review':
                onNavigateToInsights?.(); 
                targetName = 'Insights Review';
                break;
              case 'generate': 
              case 'brd':
              case 'document':
                onNavigateToGenerate?.(); 
                targetName = 'BRD Generation';
                break;
              case 'graph':
              case 'knowledge graph':
              case 'visualization':
                onNavigateToGraph?.(); 
                targetName = 'Knowledge Graph';
                break;
              default:
                navigated = false;
                console.warn('Unknown navigation destination:', destination);
            }
            
            if (navigated) {
              results.push(`Navigating to ${targetName}`);
            }
            break;
          }
          
          case 'search': {
            // Search is handled by the AI response, no action needed
            break;
          }
          
          default:
            console.warn(`Unknown action type: ${action.type}`);
        }
        
        const actionTime = Date.now() - actionStartTime;
        console.log(`Action ${action.type} completed in ${actionTime}ms`);
        
      } catch (err) {
        hasErrors = true;
        console.error(`Failed to execute action ${action.type}:`, err);
        results.push(`Failed: ${action.description || action.type}`);
      }
    }
    
    // Refresh project data if actions were executed
    if (results.length > 0 && onUpdateProject) {
      // Force a fresh read from database to ensure UI gets latest data
      const freshProject = await getProjectData();
      console.log('Calling onUpdateProject with fresh data:', freshProject);
      console.log('Fresh project goals:', freshProject?.goals);
      if (freshProject) {
        onUpdateProject(freshProject);
      }
    }
    
    return { success: true, results };
  }, [project, onUpdateProject, onNavigateToSources, onNavigateToInsights, onNavigateToGenerate, onNavigateToGraph]);

  // Enhanced chat send handler with action execution
  const handleSendChat = useCallback(async (messageOverride?: string) => {
    const messageToSend = messageOverride || chatInput.trim();
    if (!messageToSend || isChatLoading) return;

    const userMessage: ChatMessage = {
      role: 'user',
      content: messageToSend,
      timestamp: new Date().toISOString()
    };
    
    setChatMessages(prev => [...prev, userMessage]);
    setChatInput('');
    setIsChatLoading(true);

    try {
      // Build comprehensive project context for enterprise chat service
      // Combine goals from both the string field and goalTags array for full context
      const combinedGoals = [
        project.goals,
        ...(project.goalTags || [])
      ].filter(Boolean).join('\n• ');
      
      const projectContext: ProjectContext = {
        name: project.name,
        goals: combinedGoals || undefined,
        sources: project.sources.map(s => ({ 
          id: s.id, 
          name: s.name, 
          type: s.type,
          content: s.content 
        })),
        insights: project.insights.map(i => ({ 
          id: i.id,
          category: i.category, 
          summary: i.summary, 
          detail: i.detail,
          status: i.status,
          source: i.source
        })),
        tasks: project.tasks.map(t => ({ 
          id: t.id,
          title: t.title, 
          type: t.type, 
          urgency: t.urgency,
          status: t.status,
          description: t.description
        })),
        brd: project.brd ? {
          sections: project.brd.sections.map(s => ({
            id: s.id,
            title: s.title,
            content: s.content,
            status: s.status,
            confidence: s.confidence
          })),
          status: project.brd.status,
          lastGenerated: project.brd.lastGenerated
        } : undefined
      };

      // Use enterprise chat service
      const response = await clarityChatService.generateResponse(
        userMessage.content,
        projectContext,
        chatMessages
      );

      console.log('Enterprise chat response:', {
        intent: response.intent,
        confidence: response.confidence,
        actionsCount: response.actions.length,
        processingTime: response.processingMetadata.totalTime
      });
      
      // Execute any actions from AI response
      let actionResults: string[] = [];
      if (response.actions && response.actions.length > 0) {
        const { results } = await executeAIActions(response.actions, messageToSend);
        actionResults = results;
      }

      // Build response message with action confirmations
      let finalMessage = response.message;
      
      // Add processing metadata for transparency (optional, can be toggled)
      if (response.processingMetadata.cached) {
        finalMessage += '\n\n_📦 Retrieved from cache_';
      }
      
      if (actionResults.length > 0) {
        finalMessage += '\n\n✅ **Actions completed:**\n' + actionResults.map(r => `• ${r}`).join('\n');
        
        showToast({
          type: 'success',
          title: 'Actions Executed',
          message: `${actionResults.length} action(s) completed`,
          duration: 3000
        });
      }

      const assistantMessage: ChatMessage = {
        role: 'assistant',
        content: finalMessage,
        timestamp: new Date().toISOString(),
        metadata: {
          intent: response.intent,
          entities: response.entities,
          confidence: response.confidence,
          processingTime: response.processingMetadata.totalTime,
          actionsTaken: actionResults
        }
      };
      setChatMessages(prev => [...prev, assistantMessage]);
      
      // Store suggestions for quick actions
      if (response.suggestions && response.suggestions.length > 0) {
        setSuggestedQuestions(response.suggestions);
      }
    } catch (err) {
      console.error('Chat error:', err);
      setChatMessages(prev => [...prev, {
        role: 'assistant',
        content: "I apologize, but I encountered an issue processing your request. Please try again or rephrase your question.",
        timestamp: new Date().toISOString()
      }]);
      showToast({
        type: 'error',
        title: 'Chat Error',
        message: 'Failed to get response from AI',
        duration: 3000
      });
    } finally {
      setIsChatLoading(false);
    }
  }, [chatInput, isChatLoading, chatMessages, project, showToast, executeAIActions]);

  // Copy message to clipboard
  const handleCopyMessage = useCallback(async (content: string, index: number) => {
    try {
      await navigator.clipboard.writeText(content);
      setCopiedIndex(index);
      setTimeout(() => setCopiedIndex(null), 2000);
      showToast({
        type: 'success',
        title: 'Copied',
        message: 'Message copied to clipboard',
        duration: 2000
      });
    } catch (err) {
      showToast({
        type: 'error',
        title: 'Copy Failed',
        message: 'Could not copy to clipboard',
        duration: 2000
      });
    }
  }, [showToast]);

  // Handle feedback
  const handleFeedback = useCallback((index: number, isPositive: boolean) => {
    setFeedbackGiven(prev => new Set([...prev, index]));
    showToast({
      type: 'success',
      title: 'Feedback Received',
      message: isPositive ? 'Thanks for the positive feedback!' : 'We\'ll work on improving',
      duration: 2000
    });
  }, [showToast]);

  // Save current chat session
  const handleSaveChat = useCallback(() => {
    if (chatMessages.length === 0) return;
    
    const title = chatMessages[0]?.content.slice(0, 50) + (chatMessages[0]?.content.length > 50 ? '...' : '') || 'Untitled Chat';
    const newSavedChat = {
      id: `chat_${Date.now()}`,
      title,
      messages: [...chatMessages],
      timestamp: new Date().toISOString()
    };
    setSavedChats(prev => [newSavedChat, ...prev.slice(0, 9)]); // Keep last 10
    showToast({
      type: 'success',
      title: 'Chat Saved',
      message: 'Conversation saved to history',
      duration: 2000
    });
  }, [chatMessages, showToast]);

  // Load a saved chat
  const handleLoadChat = useCallback((savedChat: typeof savedChats[0]) => {
    setChatMessages(savedChat.messages);
    setShowChatHistory(false);
    showToast({
      type: 'info',
      title: 'Chat Loaded',
      message: `Loaded: ${savedChat.title}`,
      duration: 2000
    });
  }, [showToast]);

  // Clear current chat
  const handleClearChat = useCallback(() => {
    if (chatMessages.length > 0) {
      handleSaveChat();
    }
    setChatMessages([]);
    setFeedbackGiven(new Set());
    localStorage.removeItem(CHAT_SESSION_KEY);
    chatInputRef.current?.focus();
  }, [chatMessages.length, handleSaveChat]);

  // Delete a saved chat
  const handleDeleteChat = useCallback((chatId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSavedChats(prev => prev.filter(c => c.id !== chatId));
    showToast({
      type: 'info',
      title: 'Chat Deleted',
      message: 'Conversation removed from history',
      duration: 2000
    });
  }, [showToast]);

  // Regenerate last response
  const handleRegenerateResponse = useCallback(async () => {
    if (chatMessages.length < 2) return;
    
    // Find last user message
    const lastUserMessageIndex = [...chatMessages].reverse().findIndex(m => m.role === 'user');
    if (lastUserMessageIndex === -1) return;
    
    const actualIndex = chatMessages.length - 1 - lastUserMessageIndex;
    const lastUserMessage = chatMessages[actualIndex];
    
    // Remove messages after last user message
    setChatMessages(prev => prev.slice(0, actualIndex + 1));
    
    // Resend using action-enabled chat
    setIsChatLoading(true);
    try {
      const response = await chatWithClarityActions(
        lastUserMessage.content,
        {
          name: project.name,
          goals: project.goals,
          sources: project.sources.map(s => ({ id: s.id, name: s.name, type: s.type })),
          insights: project.insights.map(i => ({ 
            id: i.id,
            category: i.category, 
            summary: i.summary, 
            detail: i.detail,
            status: i.status 
          })),
          tasks: project.tasks.map(t => ({ 
            id: t.id,
            title: t.title, 
            type: t.type, 
            urgency: t.urgency,
            status: t.status
          })),
          brd: project.brd ? {
            sections: project.brd.sections.map(s => ({
              id: s.id,
              title: s.title,
              content: s.content
            }))
          } : undefined
        },
        chatMessages.slice(0, actualIndex)
      );

      // Execute any actions from regenerated response
      let actionResults: string[] = [];
      if (response.actions && response.actions.length > 0) {
        const { results } = await executeAIActions(response.actions);
        actionResults = results;
      }

      let finalMessage = response.message;
      if (actionResults.length > 0) {
        finalMessage += '\n\n✅ **Actions completed:**\n' + actionResults.map(r => `• ${r}`).join('\n');
      }

      const assistantMessage: ChatMessage = {
        role: 'assistant',
        content: finalMessage,
        timestamp: new Date().toISOString()
      };
      setChatMessages(prev => [...prev, assistantMessage]);
    } catch (err) {
      setChatMessages(prev => [...prev, {
        role: 'assistant',
        content: "I apologize, but I couldn't regenerate the response. Please try again.",
        timestamp: new Date().toISOString()
      }]);
    } finally {
      setIsChatLoading(false);
    }
  }, [chatMessages, project, executeAIActions]);

  // Auto-resize textarea
  const handleTextareaChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setChatInput(e.target.value);
    // Auto-resize
    e.target.style.height = 'auto';
    e.target.style.height = Math.min(e.target.scrollHeight, 150) + 'px';
  }, []);
  
  // Empty State: No Sources
  if (!project.sources || project.sources.length === 0) {
      return (
          <div className="h-full flex flex-col items-center justify-center p-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="max-w-lg text-center">
                  <Mascot size="lg" expression="thinking" className="mx-auto mb-8" />
                  <h2 className="text-3xl font-bold text-slate-900 mb-4 tracking-tight">Let's get some context</h2>
                  <p className="text-lg text-slate-600 mb-8 leading-relaxed">
                      To generate insights and build your BRD, I need to connect to your meetings, documents, or communication channels.
                  </p>
                  <Button size="lg" onClick={onNavigateToSources} className="shadow-2xl shadow-blue-500/30 h-16 px-8 text-lg font-bold rounded-2xl">
                      <PlusCircle className="mr-2 h-6 w-6" /> Connect Data Sources
                  </Button>
              </div>
          </div>
      );
  }

  return (
    <div className="max-w-7xl mx-auto pb-20">
      {/* Welcome Banner / Name Prompt */}
      {!project.userName && (
        <div className="mb-6 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-2xl border border-blue-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-xl">
              <Sparkles className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900">Welcome to ClarityAI!</h3>
              <p className="text-sm text-slate-600">Add your name for a personalized experience</p>
            </div>
          </div>
          <button
            onClick={() => {
              setEditedUserName('');
              setShowEditUserName(true);
            }}
            className="px-4 py-2 bg-blue-600 text-white text-sm font-bold rounded-xl hover:bg-blue-700 transition-colors shadow-lg shadow-blue-500/20"
          >
            Add Your Name
          </button>
        </div>
      )}

      {/* Header */}
      <header className="mb-6 lg:mb-10 flex flex-col gap-4 lg:gap-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            {project.userName && (
              <div className="flex items-center gap-2 mb-2">
                <span className="text-sm text-slate-500">Welcome back,</span>
                <button 
                  onClick={() => {
                    setEditedUserName(project.userName || '');
                    setShowEditUserName(true);
                  }}
                  className="text-sm font-bold text-blue-600 hover:text-blue-700 transition-colors"
                >
                  {project.userName}
                </button>
              </div>
            )}
            <div className="flex flex-wrap items-center gap-2 sm:gap-4 mb-2">
              <h1 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-slate-900 tracking-tight">{project.name}</h1>
              <span className="px-2 sm:px-3 py-1 rounded-full bg-blue-50 text-blue-700 text-[10px] sm:text-xs font-bold uppercase tracking-widest border border-blue-100">
                {project.status}
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-2 sm:gap-4 text-xs sm:text-sm text-slate-500 font-medium">
               <span className="flex items-center gap-1.5"><Clock className="h-3.5 sm:h-4 w-3.5 sm:w-4" /> Updated {new Date(project.lastUpdated).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
               {project.timeline && <span className="flex items-center gap-1.5"><Activity className="h-3.5 sm:h-4 w-3.5 sm:w-4" /> Target: {project.timeline}</span>}
            </div>
          </div>
          <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
              <Button variant="outline" size="sm" className="bg-white rounded-xl h-9 sm:h-10 px-3 sm:px-4 text-xs sm:text-sm font-bold border-slate-200" onClick={onNavigateToInsights}>
                 <Sparkles className="h-3.5 sm:h-4 w-3.5 sm:w-4 mr-1.5 sm:mr-2 text-blue-600" /> <span className="hidden sm:inline">AI&nbsp;</span>Insights
              </Button>
              <Button size="sm" className="rounded-xl h-9 sm:h-10 px-3 sm:px-4 text-xs sm:text-sm font-bold shadow-lg shadow-blue-500/20" onClick={onNavigateToGenerate}>
                 <FileText className="h-3.5 sm:h-4 w-3.5 sm:w-4 mr-1.5 sm:mr-2" /> <span className="hidden sm:inline">Export </span>BRD
              </Button>
          </div>
        </div>
        {/* Mobile/Desktop Search */}
        <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input 
                ref={searchInputRef}
                type="text" 
                placeholder="Search requirements..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onFocus={() => searchQuery && setShowSearchResults(true)}
                className="w-full lg:w-64 pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all"
            />
            {isSearching && (
              <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 animate-spin" />
            )}
            
            {/* Search Results Dropdown */}
            {showSearchResults && searchResults.length > 0 && (
              <div className="absolute top-full left-0 right-0 lg:right-auto lg:w-64 mt-2 bg-white border border-slate-200 rounded-xl shadow-xl z-50 max-h-80 overflow-y-auto">
                <div className="p-2 border-b border-slate-100">
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">{searchResults.length} Results</span>
                </div>
                {searchResults.map((result, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleSearchResultClick(result)}
                    className="w-full p-3 flex items-start gap-3 hover:bg-slate-50 transition-colors text-left border-b border-slate-50 last:border-0"
                  >
                    <div className={`mt-0.5 p-1.5 rounded-lg ${
                      result.type === 'insight' ? 'bg-blue-50 text-blue-600' :
                      result.type === 'task' ? 'bg-orange-50 text-orange-600' :
                      result.type === 'brd_section' ? 'bg-emerald-50 text-emerald-600' :
                      'bg-purple-50 text-purple-600'
                    }`}>
                      {result.type === 'insight' && <Sparkles className="h-3.5 w-3.5" />}
                      {result.type === 'task' && <AlertTriangle className="h-3.5 w-3.5" />}
                      {result.type === 'brd_section' && <FileText className="h-3.5 w-3.5" />}
                      {result.type === 'source' && <Database className="h-3.5 w-3.5" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-slate-900 text-sm truncate">{result.title}</div>
                      <div className="text-xs text-slate-500 truncate">{result.content}</div>
                    </div>
                    <div className="flex-shrink-0 text-xs text-slate-400">{result.relevance}%</div>
                  </button>
                ))}
              </div>
            )}
            
            {showSearchResults && searchQuery && searchResults.length === 0 && !isSearching && (
              <div className="absolute top-full left-0 right-0 lg:right-auto lg:w-64 mt-2 bg-white border border-slate-200 rounded-xl shadow-xl z-50 p-4 text-center">
                <span className="text-sm text-slate-500">No results found for "{searchQuery}"</span>
              </div>
            )}
        </div>
      </header>

      {/* Summary Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6 mb-6 lg:mb-10">
        
        {/* Card 1: Overview */}
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 flex flex-col h-full hover:shadow-xl transition-all duration-300 group">
           <div className="flex items-start justify-between mb-6">
              <div className="p-3 bg-blue-50 text-blue-600 rounded-2xl group-hover:scale-110 transition-transform duration-300">
                <TrendingUp className="h-6 w-6" />
              </div>
              <Tooltip content="Edit Project Goals">
                <button 
                  className="text-slate-300 hover:text-blue-600 transition-colors"
                  onClick={() => {
                    setEditedGoals(project.goals || '');
                    setShowEditGoals(true);
                  }}
                >
                  <Edit3 className="h-5 w-5" />
                </button>
              </Tooltip>
           </div>
           <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Project Goal</h3>
           <p className="text-slate-900 font-bold text-lg leading-tight flex-grow">
             {project.goals || "No specific goal defined yet."}
           </p>
        </div>

        {/* Card 2: BRD Health - Using calculated metrics */}
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 flex flex-col h-full hover:shadow-xl transition-all duration-300 group">
           <div className="flex items-start justify-between mb-6">
              <div className={`p-3 rounded-2xl group-hover:scale-110 transition-transform duration-300 ${
                metrics.healthStatus === 'excellent' ? 'bg-emerald-50 text-emerald-600' :
                metrics.healthStatus === 'good' ? 'bg-blue-50 text-blue-600' :
                metrics.healthStatus === 'needs-attention' ? 'bg-amber-50 text-amber-600' :
                'bg-red-50 text-red-600'
              }`}>
                <ShieldCheck className="h-6 w-6" />
              </div>
              <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full border ${
                metrics.healthStatus === 'excellent' ? 'text-emerald-600 bg-emerald-50 border-emerald-100' :
                metrics.healthStatus === 'good' ? 'text-blue-600 bg-blue-50 border-blue-100' :
                metrics.healthStatus === 'needs-attention' ? 'text-amber-600 bg-amber-50 border-amber-100' :
                'text-red-600 bg-red-50 border-red-100'
              }`}>{metrics.completeness}% Ready</span>
           </div>
           <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-4">BRD Health</h3>
           <div className="space-y-4">
              <div>
                <div className="flex justify-between text-xs font-bold mb-1.5">
                   <span className="text-slate-500">Completeness</span>
                   <span className="text-slate-900">{metrics.completeness}%</span>
                </div>
                <div className="h-2 w-full bg-slate-50 rounded-full overflow-hidden">
                   <div className="h-full bg-emerald-500 rounded-full transition-all duration-1000" style={{ width: `${metrics.completeness}%` }}></div>
                </div>
              </div>
              <div>
                <div className="flex justify-between text-xs font-bold mb-1.5">
                   <span className="text-slate-500">Stakeholder Coverage</span>
                   <span className="text-slate-900">{metrics.stakeholderCoverage}%</span>
                </div>
                <div className="h-2 w-full bg-slate-50 rounded-full overflow-hidden">
                   <div className="h-full bg-blue-500 rounded-full transition-all duration-1000" style={{ width: `${metrics.stakeholderCoverage}%` }}></div>
                </div>
              </div>
           </div>
        </div>

        {/* Card 3: Data Sources */}
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 flex flex-col h-full hover:shadow-xl transition-all duration-300 group">
           <div className="flex items-start justify-between mb-6">
              <div className="p-3 bg-indigo-50 text-indigo-600 rounded-2xl group-hover:scale-110 transition-transform duration-300">
                <Database className="h-6 w-6" />
              </div>
              <Button variant="ghost" size="sm" className="h-8 px-3 text-[10px] font-bold uppercase tracking-widest bg-slate-50 hover:bg-indigo-50 hover:text-indigo-600 rounded-lg" onClick={onNavigateToSources}>Add Source</Button>
           </div>
           <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-4">Active Sources ({project.sources.length})</h3>
           <div className="flex gap-3 flex-wrap">
             {project.sources.slice(0, 4).map((src) => (
                <Tooltip key={src.id} content={`${src.name} (${src.status})`}>
                    <div className="relative p-2.5 bg-slate-50 rounded-xl border border-slate-100 text-slate-400 hover:text-indigo-600 hover:border-indigo-100 transition-all cursor-pointer">
                        <div className="absolute top-0 right-0 w-2.5 h-2.5 bg-emerald-500 border-2 border-white rounded-full"></div>
                        {src.type === 'meeting' && <Video className="h-5 w-5" />}
                        {src.type === 'jira' && <Database className="h-5 w-5" />}
                        {src.type === 'slack' && <MessageSquare className="h-5 w-5" />}
                        {src.type === 'email' && <Mail className="h-5 w-5" />}
                        {src.type === 'upload' && <File className="h-5 w-5" />}
                    </div>
                </Tooltip>
             ))}
             {project.sources.length > 4 && (
                 <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-100 text-slate-500 text-[10px] font-bold flex items-center justify-center w-10 h-10">
                     +{project.sources.length - 4}
                 </div>
             )}
           </div>
        </div>

        {/* Card 4: Alerts */}
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 flex flex-col h-full hover:shadow-xl transition-all duration-300 group">
           <div className="flex items-start justify-between mb-6">
              <div className="p-3 bg-orange-50 text-orange-600 rounded-2xl group-hover:scale-110 transition-transform duration-300">
                <AlertTriangle className="h-6 w-6" />
              </div>
              <span className="text-[10px] font-bold text-orange-600 bg-orange-50 px-2.5 py-1 rounded-full border border-orange-100">{project.tasks.filter(t => t.urgency === 'high').length} Critical</span>
           </div>
           <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">Attention Needed</h3>
           <ul className="space-y-3 mt-1">
             {project.tasks.slice(0, 3).map(task => (
                 <li key={task.id} className="text-sm text-slate-700 flex items-center gap-3 truncate font-medium">
                    <span className={`w-2 h-2 rounded-full flex-shrink-0 ${task.urgency === 'high' ? 'bg-red-500 animate-pulse' : 'bg-orange-400'}`}></span> 
                    <span className="truncate">{task.title}</span>
                 </li>
             ))}
             {project.tasks.length === 0 && (
                 <li className="text-sm text-slate-400 italic font-medium">No active alerts.</li>
             )}
           </ul>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6 lg:gap-10">
        
        {/* Main Content: Clarity AI Assistant */}
        <div className="lg:col-span-2">
            {/* Chatbot Header */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="relative">
                  <Mascot size="sm" expression={isChatLoading ? 'thinking' : 'happy'} />
                  <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-emerald-500 rounded-full border-2 border-white animate-pulse"></div>
                </div>
                <div>
                  <h2 className="text-xl lg:text-2xl font-bold text-slate-900">Clarity AI</h2>
                  <p className="text-xs text-slate-500">Your intelligent requirements assistant</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {chatMessages.length > 0 && (
                  <>
                    <Tooltip content="Save conversation">
                      <button
                        onClick={handleSaveChat}
                        className="p-2 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-blue-600 transition-colors"
                      >
                        <Bookmark className="h-4 w-4" />
                      </button>
                    </Tooltip>
                    <Tooltip content="New conversation">
                      <button
                        onClick={handleClearChat}
                        className="p-2 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
                      >
                        <RotateCcw className="h-4 w-4" />
                      </button>
                    </Tooltip>
                  </>
                )}
                <Tooltip content="Chat history">
                  <button
                    onClick={() => setShowChatHistory(!showChatHistory)}
                    className={`p-2 rounded-lg border transition-colors ${showChatHistory ? 'bg-blue-50 border-blue-200 text-blue-600' : 'hover:bg-slate-100 border-transparent text-slate-400 hover:text-slate-600'}`}
                  >
                    <History className="h-4 w-4" />
                  </button>
                </Tooltip>
                <Tooltip content={chatExpanded ? 'Minimize' : 'Expand'}>
                  <button
                    onClick={() => setChatExpanded(!chatExpanded)}
                    className="p-2 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
                  >
                    {chatExpanded ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
                  </button>
                </Tooltip>
              </div>
            </div>

            {/* Chat History Sidebar */}
            {showChatHistory && (
              <div className="bg-white rounded-xl border border-slate-200 p-4 mb-4 animate-in slide-in-from-top-2 duration-200">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-bold text-slate-700">Chat History</span>
                  <button onClick={() => setShowChatHistory(false)} className="text-slate-400 hover:text-slate-600">
                    <X className="h-4 w-4" />
                  </button>
                </div>
                {savedChats.length === 0 ? (
                  <div className="py-6 text-center">
                    <History className="h-8 w-8 text-slate-300 mx-auto mb-2" />
                    <p className="text-sm text-slate-400">No saved conversations yet</p>
                    <p className="text-xs text-slate-400 mt-1">Your chats will appear here</p>
                  </div>
                ) : (
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {savedChats.map((chat) => (
                      <div
                        key={chat.id}
                        className="w-full text-left p-3 rounded-lg bg-slate-50 hover:bg-slate-100 transition-colors group flex items-start justify-between cursor-pointer"
                        onClick={() => handleLoadChat(chat)}
                      >
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-sm text-slate-800 truncate">{chat.title}</div>
                          <div className="text-xs text-slate-500 mt-1 flex items-center gap-2">
                            <Clock className="h-3 w-3" />
                            {new Date(chat.timestamp).toLocaleDateString()}
                            <span className="text-slate-300">•</span>
                            {chat.messages.length} messages
                          </div>
                        </div>
                        <button
                          onClick={(e) => handleDeleteChat(chat.id, e)}
                          className="p-1.5 rounded-lg opacity-0 group-hover:opacity-100 hover:bg-red-100 text-slate-400 hover:text-red-500 transition-all"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Main Chat Container */}
            <div className={`bg-white rounded-2xl lg:rounded-[2rem] shadow-sm border border-slate-100 overflow-hidden flex flex-col transition-all duration-300 ${chatExpanded ? 'h-[700px]' : 'h-[500px] lg:h-[550px]'}`}>
              {/* Messages Area */}
              <div 
                ref={chatContainerRef}
                className="flex-1 overflow-y-auto p-4 lg:p-6 space-y-4"
              >
                {chatMessages.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center px-4">
                    <div className="relative mb-6">
                      <Mascot size="lg" expression="excited" />
                    </div>
                    <h3 className="text-xl font-bold text-slate-900 mb-2">How can I help you today?</h3>
                    <p className="text-slate-500 text-sm mb-8 max-w-md">
                      Ask me anything about your project requirements, insights, or BRD. I have full context of your {project.sources.length} sources and {project.insights.length} insights.
                    </p>
                    
                    {/* Quick Actions Grid */}
                    <div className="w-full max-w-lg grid grid-cols-2 gap-2">
                      {quickPrompts.map((item, idx) => (
                        <button
                          key={idx}
                          onClick={() => handleSendChat(item.prompt)}
                          disabled={isChatLoading}
                          className="p-3 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-100 hover:border-slate-200 transition-all text-left group"
                        >
                          <div className="flex items-center gap-2 mb-1">
                            <item.icon className="h-4 w-4 text-blue-600" />
                            <span className="text-sm font-semibold text-slate-800 group-hover:text-blue-600 transition-colors">{item.label}</span>
                          </div>
                          <p className="text-xs text-slate-500 line-clamp-2">{item.prompt}</p>
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  <>
                    {chatMessages.map((msg, idx) => (
                      <div 
                        key={idx} 
                        className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-in slide-in-from-bottom-2 duration-200`}
                      >
                        {msg.role === 'assistant' && (
                          <div className="w-10 h-10 flex-shrink-0">
                            <Mascot size="sm" expression="happy" />
                          </div>
                        )}
                        <div className={`max-w-[85%] ${msg.role === 'user' ? 'order-first' : ''}`}>
                          <div className={`px-4 py-3 rounded-2xl ${
                            msg.role === 'user' 
                              ? 'bg-blue-600 text-white ml-auto rounded-br-md' 
                              : 'bg-slate-100 text-slate-800 rounded-bl-md'
                          }`}>
                            <div className="text-sm leading-relaxed">
                              {msg.role === 'assistant' ? renderMarkdown(msg.content) : msg.content}
                            </div>
                          </div>
                          
                          {/* Message Actions */}
                          {msg.role === 'assistant' && (
                            <div className="flex items-center gap-1 mt-1.5 ml-1">
                              <button
                                onClick={() => handleCopyMessage(msg.content, idx)}
                                className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
                                title="Copy"
                              >
                                {copiedIndex === idx ? <CheckCircle className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
                              </button>
                              {!feedbackGiven.has(idx) && (
                                <>
                                  <button
                                    onClick={() => handleFeedback(idx, true)}
                                    className="p-1.5 rounded-lg hover:bg-emerald-50 text-slate-400 hover:text-emerald-600 transition-colors"
                                    title="Helpful"
                                  >
                                    <ThumbsUp className="h-3.5 w-3.5" />
                                  </button>
                                  <button
                                    onClick={() => handleFeedback(idx, false)}
                                    className="p-1.5 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-600 transition-colors"
                                    title="Not helpful"
                                  >
                                    <ThumbsDown className="h-3.5 w-3.5" />
                                  </button>
                                </>
                              )}
                              {idx === chatMessages.length - 1 && (
                                <button
                                  onClick={handleRegenerateResponse}
                                  disabled={isChatLoading}
                                  className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors disabled:opacity-50"
                                  title="Regenerate"
                                >
                                  <RefreshCw className="h-3.5 w-3.5" />
                                </button>
                              )}
                              <span className="text-[10px] text-slate-400 ml-2">
                                {new Date(msg.timestamp).toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'})}
                              </span>
                            </div>
                          )}
                          {msg.role === 'user' && (
                            <div className="text-right mr-1 mt-1">
                              <span className="text-[10px] text-slate-400">
                                {new Date(msg.timestamp).toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'})}
                              </span>
                            </div>
                          )}
                        </div>
                        {msg.role === 'user' && (
                          <div className="w-8 h-8 rounded-xl bg-slate-200 flex items-center justify-center flex-shrink-0">
                            <span className="text-sm font-bold text-slate-600">
                              {project.userName 
                                ? project.userName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
                                : 'U'}
                            </span>
                          </div>
                        )}
                      </div>
                    ))}
                    
                    {/* Loading Indicator */}
                    {isChatLoading && (
                      <div className="flex gap-3 animate-in slide-in-from-bottom-2 duration-200">
                        <div className="w-10 h-10 flex-shrink-0">
                          <Mascot size="sm" expression="thinking" />
                        </div>
                        <div className="bg-slate-100 px-4 py-3 rounded-2xl rounded-bl-md">
                          <div className="flex gap-1.5">
                            <span className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
                            <span className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
                            <span className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
                          </div>
                        </div>
                      </div>
                    )}
                    
                    {/* Suggested Follow-up Questions */}
                    {!isChatLoading && suggestedQuestions.length > 0 && chatMessages.length > 0 && (
                      <div className="mt-4 animate-in fade-in duration-300">
                        <p className="text-xs text-slate-400 mb-2 ml-1">Suggested follow-ups:</p>
                        <div className="flex flex-wrap gap-2">
                          {suggestedQuestions.map((suggestion, idx) => (
                            <button
                              key={idx}
                              onClick={() => {
                                handleSendChat(suggestion);
                                setSuggestedQuestions([]);
                              }}
                              className="px-3 py-1.5 text-xs bg-slate-50 hover:bg-blue-50 text-slate-600 hover:text-blue-600 rounded-full border border-slate-200 hover:border-blue-200 transition-all"
                            >
                              {suggestion}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* Input Area */}
              <div className="border-t border-slate-100 p-4 bg-white">
                <div className="flex gap-3">
                  <div className="flex-1 relative">
                    <textarea
                      ref={chatInputRef}
                      value={chatInput}
                      onChange={handleTextareaChange}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          handleSendChat();
                        }
                      }}
                      placeholder="Ask about requirements, insights, conflicts, or anything about your project..."
                      className="w-full px-4 py-3 pr-12 bg-slate-50 border border-slate-200 rounded-xl text-sm resize-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all min-h-[48px] max-h-[150px]"
                      rows={1}
                      disabled={isChatLoading}
                    />
                    <div className="absolute right-3 bottom-3 flex items-center gap-1">
                      <span className="text-[10px] text-slate-400 mr-1">{chatInput.length}/2000</span>
                    </div>
                  </div>
                  <button
                    onClick={() => handleSendChat()}
                    disabled={!chatInput.trim() || isChatLoading}
                    className="p-3 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-200 disabled:cursor-not-allowed rounded-xl text-white transition-colors shadow-lg shadow-blue-500/25 disabled:shadow-none"
                  >
                    {isChatLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
                  </button>
                </div>
                <div className="flex items-center justify-between mt-3 text-xs text-slate-400">
                  <span className="flex items-center gap-1">
                    <Sparkles className="h-3 w-3" /> Powered by Gemini • Full project context active
                  </span>
                  <span>Press Enter to send, Shift+Enter for new line</span>
                </div>
              </div>
            </div>

            {/* Quick Stats Below Chat */}
            <div className="grid grid-cols-3 gap-3 mt-4">
              <div className="bg-white p-4 rounded-xl border border-slate-100 text-center">
                <Database className="h-5 w-5 text-blue-600 mx-auto mb-2" />
                <div className="text-2xl font-bold text-slate-900">{project.sources.length}</div>
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Sources</div>
              </div>
              <div className="bg-white p-4 rounded-xl border border-slate-100 text-center">
                <Sparkles className="h-5 w-5 text-purple-600 mx-auto mb-2" />
                <div className="text-2xl font-bold text-slate-900">{project.insights.length}</div>
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Insights</div>
              </div>
              <div className="bg-white p-4 rounded-xl border border-slate-100 text-center">
                <Zap className="h-5 w-5 text-amber-600 mx-auto mb-2" />
                <div className="text-2xl font-bold text-slate-900">{project.tasks.length}</div>
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Tasks</div>
              </div>
            </div>
        </div>

        {/* Right Content: AI Assistant */}
        <div className="space-y-8">
            {/* AI Assistant Quick Card */}
            <div className="bg-slate-900 rounded-[2rem] text-white shadow-xl shadow-slate-900/20 relative overflow-hidden group p-6">
                <div className="absolute top-[-20%] right-[-10%] w-32 h-32 bg-blue-600 rounded-full blur-3xl opacity-20 group-hover:opacity-40 transition-opacity"></div>
                
                <div className="flex items-center gap-4 relative z-10">
                    <Mascot size="sm" expression="happy" />
                    <div>
                        <h4 className="font-bold text-lg leading-tight">Clarity AI</h4>
                        <p className="text-xs text-slate-400 font-medium">Your intelligent requirements assistant</p>
                    </div>
                </div>
                <div className="mt-4 relative z-10">
                    <p className="text-sm text-slate-300 mb-4">
                      Use the main chat panel to ask questions about your {project.sources.length} sources and {project.insights.length} insights.
                    </p>
                    <div className="flex items-center gap-2 text-xs text-slate-400">
                      <Bot className="h-4 w-4" />
                      <span>Powered by Gemini • Full context</span>
                    </div>
                </div>
            </div>

            {/* Recent Activity Card */}
            <div className="bg-white p-6 lg:p-8 rounded-2xl lg:rounded-[2rem] shadow-sm border border-slate-100">
              <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4">Recent Intelligence</h4>
              <ul className="space-y-4">
                  {project.recentActivity.slice(0, 5).map((activity) => (
                      <li key={activity.id} className="flex gap-3 items-start text-sm">
                          <div className="mt-1.5 w-2 h-2 rounded-full bg-blue-500 flex-shrink-0 shadow-sm shadow-blue-200"></div>
                          <div className="text-left">
                              <div className="font-bold text-slate-900 leading-tight">
                                  <span className="text-blue-600">{activity.user}</span> {activity.action}
                              </div>
                              <div className="text-[10px] font-bold text-slate-400 mt-1 uppercase tracking-wider">{activity.time}</div>
                          </div>
                      </li>
                  ))}
              </ul>
            </div>
        </div>

      </div>
      
      {/* Edit Goals Modal */}
      {showEditGoals && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full mx-4 animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between p-6 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-50 rounded-xl">
                  <Target className="h-5 w-5 text-blue-600" />
                </div>
                <h3 className="text-xl font-bold text-slate-900">Edit Project Goals</h3>
              </div>
              <button 
                onClick={() => setShowEditGoals(false)}
                className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <X className="h-5 w-5 text-slate-400" />
              </button>
            </div>
            
            <div className="p-6">
              <label className="block text-sm font-bold text-slate-700 mb-2">
                What are the main goals for "{project.name}"?
              </label>
              <textarea
                value={editedGoals}
                onChange={(e) => setEditedGoals(e.target.value)}
                placeholder="Describe the key objectives, deliverables, and success criteria for this project..."
                className="w-full h-40 p-4 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none resize-none"
              />
              <p className="mt-2 text-xs text-slate-500">
                Clear goals help AI better extract and prioritize requirements from your sources.
              </p>
            </div>
            
            <div className="flex items-center justify-end gap-3 p-6 border-t border-slate-100 bg-slate-50 rounded-b-2xl">
              <Button 
                variant="outline" 
                onClick={() => setShowEditGoals(false)}
                disabled={isSavingGoals}
              >
                Cancel
              </Button>
              <Button 
                onClick={handleSaveGoals}
                disabled={isSavingGoals}
                className="min-w-[100px]"
              >
                {isSavingGoals ? (
                  <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Saving...</>
                ) : (
                  <>Save Goals</>
                )}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Edit User Name Modal */}
      {showEditUserName && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full mx-4 animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between p-6 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-50 rounded-xl">
                  <Sparkles className="h-5 w-5 text-blue-600" />
                </div>
                <h3 className="text-xl font-bold text-slate-900">Your Name</h3>
              </div>
              <button 
                onClick={() => setShowEditUserName(false)}
                className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <X className="h-5 w-5 text-slate-400" />
              </button>
            </div>
            
            <div className="p-6">
              <label className="block text-sm font-bold text-slate-700 mb-2">
                What should we call you?
              </label>
              <input
                type="text"
                value={editedUserName}
                onChange={(e) => setEditedUserName(e.target.value)}
                placeholder="Enter your name..."
                className="w-full p-4 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && editedUserName.trim()) {
                    handleSaveUserName();
                  }
                }}
              />
              <p className="mt-2 text-xs text-slate-500">
                Your name will be used to personalize the experience and in BRD documents.
              </p>
            </div>
            
            <div className="flex items-center justify-end gap-3 p-6 border-t border-slate-100 bg-slate-50 rounded-b-2xl">
              <Button 
                variant="outline" 
                onClick={() => setShowEditUserName(false)}
                disabled={isSavingUserName}
              >
                Cancel
              </Button>
              <Button 
                onClick={handleSaveUserName}
                disabled={isSavingUserName || !editedUserName.trim()}
                className="min-w-[100px]"
              >
                {isSavingUserName ? (
                  <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Saving...</>
                ) : (
                  <>Save</>
                )}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Click outside to close search results */}
      {showSearchResults && (
        <div 
          className="fixed inset-0 z-40" 
          onClick={() => setShowSearchResults(false)} 
        />
      )}
    </div>
  );
};

export default DashboardHome;