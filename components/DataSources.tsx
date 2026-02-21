import React, { useState, useRef, useMemo, useEffect } from 'react';
import { 
  Database, 
  UploadCloud, 
  MessageSquare, 
  Video, 
  FileText, 
  Check, 
  Loader, 
  ArrowRight, 
  ShieldCheck, 
  Info, 
  Mail,
  AlertCircle,
  ExternalLink,
  Sparkles,
  Zap,
  Clock,
  Filter,
  SlidersHorizontal,
  Eye,
  EyeOff,
  Search,
  X,
  Lightbulb
} from 'lucide-react';
import Button from './Button';
import Tooltip from './Tooltip';
import { addSourceToProject, ProjectState, Source, reanalyzeAllSources, InsightExtractionProgress } from '../utils/db';
import { useToast } from '../context/ToastContext';
import { 
  DatasetLoader, 
  getAllDatasets, 
  EnronEmail, 
  AMIMeeting, 
  MeetingTranscript,
  ParsedSource
} from '../utils/services/datasets';

interface DataSourcesProps {
  project: ProjectState;
  onUpdate: (project: ProjectState) => void;
  onContinue?: () => void;
}

type TabType = 'overview' | 'enron' | 'ami' | 'transcripts' | 'slack';

const DataSources: React.FC<DataSourcesProps> = ({ project, onUpdate, onContinue }) => {
  const [isLoadingDataset, setIsLoadingDataset] = useState<string | null>(null);
  const [loadedDatasets, setLoadedDatasets] = useState<{
    enron?: EnronEmail[];
    ami?: AMIMeeting[];
    transcripts?: MeetingTranscript[];
    slack?: ParsedSource[];
  }>({});
  const [datasetStats, setDatasetStats] = useState<{
    emailsLoaded: number;
    meetingsLoaded: number;
    transcriptsLoaded: number;
    slackLoaded: number;
  }>({ emailsLoaded: 0, meetingsLoaded: 0, transcriptsLoaded: 0, slackLoaded: 0 });
  
  // Threshold control - default 50%
  const [relevanceThreshold, setRelevanceThreshold] = useState(0.5);
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [searchQuery, setSearchQuery] = useState('');
  const [showOnlyUsed, setShowOnlyUsed] = useState(false);
  
  const { showToast } = useToast();
  const datasetFileInputRef = useRef<HTMLInputElement>(null);
  const [activeDatasetUpload, setActiveDatasetUpload] = useState<string | null>(null);

  // Automatic insight extraction state
  const [isExtractingInsights, setIsExtractingInsights] = useState(false);
  const [extractionProgress, setExtractionProgress] = useState<InsightExtractionProgress | null>(null);

  // Computed values - use project.sources for persisted counts, loadedDatasets for live filtering
  const sourceStats = useMemo(() => {
    const sources = project.sources || [];
    const emailsUsed = sources.filter(s => s.fileType?.includes('enron')).length;
    const meetings = sources.filter(s => s.fileType?.includes('ami') || s.fileType?.includes('meeting')).length;
    const transcripts = sources.filter(s => s.fileType?.includes('transcript')).length;
    const slack = sources.filter(s => s.fileType?.includes('slack') || s.fileType?.includes('chat')).length;
    return { emailsUsed, meetings, transcripts, slack };
  }, [project.sources]);

  // Email stats from loaded dataset (for threshold preview)
  const emailStats = useMemo(() => {
    if (!loadedDatasets.enron) {
      return { 
        total: sourceStats.emailsUsed, 
        relevant: sourceStats.emailsUsed, 
        noise: 0, 
        lowRelevance: 0,
        used: sourceStats.emailsUsed 
      };
    }
    const actualNoise = loadedDatasets.enron.filter(e => e.isNoise);
    const relevant = loadedDatasets.enron.filter(e => !e.isNoise && e.relevanceScore >= relevanceThreshold);
    const lowRelevance = loadedDatasets.enron.filter(e => !e.isNoise && e.relevanceScore < relevanceThreshold);
    return { 
      total: loadedDatasets.enron.length, 
      relevant: relevant.length, 
      noise: actualNoise.length, 
      lowRelevance: lowRelevance.length,
      used: sourceStats.emailsUsed 
    };
  }, [loadedDatasets.enron, relevanceThreshold, sourceStats.emailsUsed]);

  // Reload full datasets from JSON files when sources exist but loadedDatasets is empty
  // This ensures we have all emails (including noise/low-relevance) after page refresh
  useEffect(() => {
    const sources = project.sources || [];
    
    const loadDatasetsFromFiles = async () => {
      // Reload Enron emails if sources exist but state is empty
      const hasEnronSources = sources.some(s => s.fileType === 'email/enron' || s.id.startsWith('enron_'));
      if (hasEnronSources && !loadedDatasets.enron) {
        try {
          const emails = await DatasetLoader.loadEnronEmails({ 
            limit: 500,
            filterByKeywords: ['requirements', 'decisions', 'project']
          });
          setLoadedDatasets(prev => ({ ...prev, enron: emails }));
          setDatasetStats(prev => ({ ...prev, emailsLoaded: emails.length }));
        } catch (err) {
          console.error('Failed to reload Enron emails:', err);
        }
      }

      // Reload AMI meetings if sources exist but state is empty
      const hasAmiSources = sources.some(s => s.fileType === 'meeting/ami' || s.id.startsWith('ami_'));
      if (hasAmiSources && !loadedDatasets.ami) {
        try {
          const meetings = await DatasetLoader.loadAMIMeetings({ limit: 100 });
          setLoadedDatasets(prev => ({ ...prev, ami: meetings }));
          setDatasetStats(prev => ({ ...prev, meetingsLoaded: meetings.length }));
        } catch (err) {
          console.error('Failed to reload AMI meetings:', err);
        }
      }

      // Reload transcripts if sources exist but state is empty
      const hasTranscriptSources = sources.some(s => s.fileType === 'meeting/transcript' || s.id.startsWith('transcript_'));
      if (hasTranscriptSources && !loadedDatasets.transcripts) {
        try {
          const transcripts = await DatasetLoader.loadMeetingTranscripts({ limit: 50 });
          setLoadedDatasets(prev => ({ ...prev, transcripts: transcripts }));
          setDatasetStats(prev => ({ ...prev, transcriptsLoaded: transcripts.length }));
        } catch (err) {
          console.error('Failed to reload transcripts:', err);
        }
      }

      // Note: Slack messages are synthetic and reconstructed from sources
      const slackSources = sources.filter(s => s.fileType === 'chat/synthetic' || s.id.startsWith('slack_'));
      if (slackSources.length > 0 && !loadedDatasets.slack) {
        const slackMessages: ParsedSource[] = slackSources.map((source) => ({
          id: source.id,
          type: 'chat' as const,
          dataset: 'slack',
          title: source.name || 'Slack Message',
          content: source.content || '',
          metadata: { channel: source.name || 'general' },
          relevanceScore: 0.6,
          timestamp: source.timestamp || new Date().toISOString()
        }));
        setLoadedDatasets(prev => ({ ...prev, slack: slackMessages }));
        setDatasetStats(prev => ({ ...prev, slackLoaded: slackMessages.length }));
      }
    };

    loadDatasetsFromFiles();
  }, []); // Only run once on mount

  // Check which datasets are already loaded by examining sources
  const getLoadedDatasetIds = () => {
    const loaded: string[] = [];
    const sources = project.sources || [];
    
    if (sources.some(s => s.fileType === 'email/enron' || s.id.startsWith('enron_'))) {
      loaded.push('enron');
    }
    if (sources.some(s => s.fileType === 'meeting/ami' || s.id.startsWith('ami_'))) {
      loaded.push('ami');
    }
    if (sources.some(s => s.fileType === 'meeting/transcript' || s.id.startsWith('transcript_'))) {
      loaded.push('meetingTranscripts');
    }
    if (sources.some(s => s.fileType === 'chat/synthetic' || s.id.startsWith('slack_'))) {
      loaded.push('synthetic_slack');
    }
    
    return loaded;
  };

  const alreadyLoadedDatasets = getLoadedDatasetIds();

  // ============================================================================
  // DATASET LOADING HANDLERS
  // ============================================================================

  const handleLoadSampleDataset = async (datasetId: string) => {
    if (alreadyLoadedDatasets.includes(datasetId)) {
      showToast({
        type: 'info',
        title: 'Already Loaded',
        message: 'This dataset has already been loaded into your project.'
      });
      return;
    }
    
    setIsLoadingDataset(datasetId);
    
    try {
      let sourcesToAdd: Source[] = [];
      
      if (datasetId === 'enron') {
        const emails = await DatasetLoader.loadEnronEmails({ 
          limit: 500,
          filterByKeywords: ['requirements', 'decisions', 'project']
        });
        
        setLoadedDatasets(prev => ({ ...prev, enron: emails }));
        setDatasetStats(prev => ({ ...prev, emailsLoaded: emails.length }));

        // Add emails above threshold as sources (exclude spam/auto emails)
        const spamCount = emails.filter(e => e.isNoise).length;
        const relevantEmails = emails.filter(e => !e.isNoise && e.relevanceScore >= relevanceThreshold);
        const lowRelevanceCount = emails.filter(e => !e.isNoise && e.relevanceScore < relevanceThreshold).length;
        
        sourcesToAdd = relevantEmails.map((email, idx) => ({
          id: `enron_${Date.now()}_${idx}`,
          type: 'email' as const,
          name: email.subject.slice(0, 50) + (email.subject.length > 50 ? '...' : ''),
          status: 'active' as const,
          timestamp: email.date || new Date().toISOString(),
          content: `From: ${email.from}\nTo: ${email.to.join(', ')}\nDate: ${email.date}\nSubject: ${email.subject}\n\n${email.body}`,
          fileType: 'email/enron'
        }));

        showToast({
          type: 'success',
          title: 'Enron Dataset Loaded',
          message: `${emails.length} emails → ${relevantEmails.length} used, ${lowRelevanceCount} low relevance, ${spamCount} spam/auto filtered`
        });

      } else if (datasetId === 'ami') {
        const meetings = await DatasetLoader.loadAMIMeetings({ limit: 100 });
        
        setLoadedDatasets(prev => ({ ...prev, ami: meetings }));
        setDatasetStats(prev => ({ ...prev, meetingsLoaded: meetings.length }));

        sourcesToAdd = meetings.map((meeting, idx) => {
          const transcriptText = Array.isArray(meeting.transcript) 
            ? meeting.transcript.map(t => `[${t.role || t.speaker || 'Speaker'}]: ${t.text}`).join('\n')
            : String(meeting.transcript || '');
          
          return {
            id: `ami_${Date.now()}_${idx}`,
            type: 'meeting' as const,
            name: `${meeting.scenario} - ${meeting.meetingId}`,
            status: 'active' as const,
            timestamp: new Date().toISOString(),
            content: transcriptText,
            fileType: 'meeting/ami'
          };
        });

        showToast({
          type: 'success',
          title: 'AMI Corpus Loaded',
          message: `${meetings.length} meeting transcripts loaded and added as sources`
        });

      } else if (datasetId === 'meetingTranscripts') {
        const transcripts = await DatasetLoader.loadMeetingTranscripts({ limit: 20 });
        
        setLoadedDatasets(prev => ({ ...prev, transcripts }));
        setDatasetStats(prev => ({ ...prev, transcriptsLoaded: transcripts.length }));

        sourcesToAdd = transcripts.map((transcript, idx) => ({
          id: `transcript_${Date.now()}_${idx}`,
          type: 'meeting' as const,
          name: transcript.title,
          status: 'active' as const,
          timestamp: transcript.date,
          content: transcript.transcript,
          fileType: 'meeting/transcript'
        }));

        showToast({
          type: 'success',
          title: 'Transcripts Loaded',
          message: `${transcripts.length} meeting transcripts added as sources`
        });
      }

      // Add sources to project
      for (const source of sourcesToAdd) {
        const updatedProject = await addSourceToProject(source);
        onUpdate(updatedProject);
      }

    } catch (error: any) {
      console.error('Failed to load dataset:', error);
      showToast({
        type: 'error',
        title: 'Dataset Load Failed',
        message: error.message || 'Could not load dataset'
      });
    } finally {
      setIsLoadingDataset(null);
    }
  };

  const handleDatasetFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !activeDatasetUpload) return;

    setIsLoadingDataset(activeDatasetUpload);

    try {
      if (activeDatasetUpload === 'enron') {
        const emails = await DatasetLoader.loadEnronEmails({ fromFile: file, limit: 1000 });
        setLoadedDatasets(prev => ({ ...prev, enron: emails }));
        setDatasetStats(prev => ({ ...prev, emailsLoaded: emails.length }));
        
        const relevantEmails = emails.filter(e => e.relevanceScore >= relevanceThreshold);
        for (const email of relevantEmails) {
          const source: Source = {
            id: `enron_file_${Date.now()}_${email.id}`,
            type: 'email',
            name: email.subject.slice(0, 40) + (email.subject.length > 40 ? '...' : ''),
            status: 'active',
            timestamp: email.date,
            content: email.body,
            fileType: 'email/enron'
          };
          const updatedProject = await addSourceToProject(source);
          onUpdate(updatedProject);
        }

        showToast({
          type: 'success',
          title: 'Enron Dataset Uploaded',
          message: `${emails.length} emails parsed, ${relevantEmails.length} above threshold added`
        });

      } else if (activeDatasetUpload === 'ami' || activeDatasetUpload === 'meetingTranscripts') {
        const meetings = await DatasetLoader.loadAMIMeetings({ fromFile: file });
        setLoadedDatasets(prev => ({ ...prev, ami: meetings }));
        
        for (const meeting of meetings) {
          const source: Source = {
            id: `ami_file_${Date.now()}_${meeting.id}`,
            type: 'meeting',
            name: meeting.scenario,
            status: 'active',
            timestamp: new Date().toISOString(),
            content: meeting.transcript.map(t => `[${t.role}]: ${t.text}`).join('\n'),
            fileType: 'meeting/ami'
          };
          const updatedProject = await addSourceToProject(source);
          onUpdate(updatedProject);
        }

        showToast({
          type: 'success',
          title: 'Meeting Dataset Uploaded',
          message: `${meetings.length} meetings parsed and added`
        });
      }
    } catch (error: any) {
      showToast({
        type: 'error',
        title: 'Dataset Parse Failed',
        message: error.message || 'Could not parse dataset file'
      });
    } finally {
      setIsLoadingDataset(null);
      setActiveDatasetUpload(null);
      if (datasetFileInputRef.current) {
        datasetFileInputRef.current.value = '';
      }
    }
  };

  const handleGenerateSyntheticSlack = async () => {
    if (!loadedDatasets.enron || loadedDatasets.enron.length === 0) {
      showToast({
        type: 'error',
        title: 'No Emails Loaded',
        message: 'Load Enron emails first to generate synthetic Slack messages'
      });
      return;
    }

    setIsLoadingDataset('synthetic_slack');
    
    try {
      const slackMessages = await DatasetLoader.generateSyntheticSlackFromEnron(
        loadedDatasets.enron,
        { channelName: '#project-requirements', limit: 50 }
      );

      setLoadedDatasets(prev => ({ ...prev, slack: slackMessages }));
      setDatasetStats(prev => ({ ...prev, slackLoaded: slackMessages.length }));

      for (const msg of slackMessages) {
        const source: Source = {
          id: `slack_synthetic_${Date.now()}_${msg.id}`,
          type: 'slack',
          name: msg.title,
          status: 'active',
          timestamp: msg.timestamp,
          content: msg.content,
          fileType: 'chat/synthetic'
        };
        const updatedProject = await addSourceToProject(source);
        onUpdate(updatedProject);
      }

      showToast({
        type: 'success',
        title: 'Synthetic Slack Generated',
        message: `${slackMessages.length} Slack-style messages created and added as sources`
      });
    } catch (error: any) {
      showToast({
        type: 'error',
        title: 'Generation Failed',
        message: error.message
      });
    } finally {
      setIsLoadingDataset(null);
    }
  };

  // Handle automatic insight extraction from all sources
  const handleExtractAllInsights = async () => {
    if (project.sources.length === 0) {
      showToast({
        type: 'error',
        title: 'No Sources',
        message: 'Load some data sources first before extracting insights'
      });
      return;
    }

    setIsExtractingInsights(true);
    setExtractionProgress({
      currentSource: 0,
      totalSources: project.sources.length,
      sourceName: '',
      insightsExtracted: 0,
      status: 'running'
    });

    try {
      const result = await reanalyzeAllSources((progress) => {
        setExtractionProgress(progress);
      });

      onUpdate(result.project);

      showToast({
        type: 'success',
        title: 'Insights Extracted',
        message: `Generated ${result.insightsGenerated} new insights from ${result.sourcesProcessed} sources`
      });
    } catch (error: any) {
      showToast({
        type: 'error',
        title: 'Extraction Failed',
        message: error.message || 'Failed to extract insights'
      });
    } finally {
      setIsExtractingInsights(false);
      setExtractionProgress(null);
    }
  };

  // Re-apply threshold when user changes it
  const handleApplyThreshold = async () => {
    if (!loadedDatasets.enron) return;
    
    // Remove old enron sources
    const nonEnronSources = project.sources.filter(s => !s.fileType?.includes('enron'));
    
    // Add emails above new threshold (exclude spam/auto)
    const relevantEmails = loadedDatasets.enron.filter(e => !e.isNoise && e.relevanceScore >= relevanceThreshold);
    const spamFiltered = loadedDatasets.enron.filter(e => e.isNoise).length;
    
    // Clear and re-add
    let updatedProject = { ...project, sources: nonEnronSources };
    
    for (const email of relevantEmails) {
      const source: Source = {
        id: `enron_${Date.now()}_${email.id}`,
        type: 'email',
        name: email.subject.slice(0, 50) + (email.subject.length > 50 ? '...' : ''),
        status: 'active',
        timestamp: email.date || new Date().toISOString(),
        content: `From: ${email.from}\nTo: ${email.to.join(', ')}\nDate: ${email.date}\nSubject: ${email.subject}\n\n${email.body}`,
        fileType: 'email/enron'
      };
      updatedProject = { ...updatedProject, sources: [...updatedProject.sources, source] };
    }
    
    onUpdate(updatedProject);
    
    showToast({
      type: 'success',
      title: 'Threshold Applied',
      message: `${relevantEmails.length} emails now above ${Math.round(relevanceThreshold * 100)}% threshold (${spamFiltered} spam excluded)`
    });
  };

  const connectedCount = project.sources.length;
  const realDatasets = getAllDatasets();

  // Filter data based on search
  const filterBySearch = <T extends { subject?: string; body?: string; scenario?: string; title?: string; content?: string }>(items: T[]) => {
    if (!searchQuery) return items;
    const q = searchQuery.toLowerCase();
    return items.filter(item => 
      (item.subject?.toLowerCase().includes(q)) ||
      (item.body?.toLowerCase().includes(q)) ||
      (item.scenario?.toLowerCase().includes(q)) ||
      (item.title?.toLowerCase().includes(q)) ||
      (item.content?.toLowerCase().includes(q))
    );
  };

  const tabs: { id: TabType; label: string; icon: React.ReactNode; count?: number }[] = [
    { id: 'overview', label: 'Overview', icon: <Database className="h-4 w-4" /> },
    { id: 'enron', label: 'Enron Emails', icon: <Mail className="h-4 w-4" />, count: loadedDatasets.enron?.length || sourceStats.emailsUsed },
    { id: 'ami', label: 'AMI Meetings', icon: <Video className="h-4 w-4" />, count: loadedDatasets.ami?.length || sourceStats.meetings },
    { id: 'transcripts', label: 'Transcripts', icon: <FileText className="h-4 w-4" />, count: loadedDatasets.transcripts?.length || sourceStats.transcripts },
    { id: 'slack', label: 'Slack', icon: <MessageSquare className="h-4 w-4" />, count: loadedDatasets.slack?.length || sourceStats.slack },
  ];

  return (
    <div className="max-w-7xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500 pb-20">
      {/* Hidden file input */}
      <input
        ref={datasetFileInputRef}
        type="file"
        className="hidden"
        accept=".csv,.json,.txt"
        onChange={handleDatasetFileUpload}
      />

      {/* Header */}
      <div className="mb-8">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 text-blue-700 text-xs font-bold uppercase tracking-wider mb-3 border border-blue-100">
          <Database className="h-3 w-3" /> Step 2: Data Sources
        </div>
        <h1 className="text-3xl font-bold text-slate-900 mb-2 tracking-tight">Load & Manage Data Sources</h1>
        <p className="text-slate-600">
          Load research-grade datasets, set relevance thresholds, and see exactly what data is being used for BRD generation.
        </p>
      </div>

      {/* Stats Bar */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-4 mb-8">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <div className="text-2xl font-bold text-blue-600">{connectedCount}</div>
          <div className="text-xs text-slate-500 font-medium">Total Sources</div>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <div className="text-2xl font-bold text-emerald-600">{sourceStats.emailsUsed}</div>
          <div className="text-xs text-slate-500 font-medium">Emails Used</div>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <div className="text-2xl font-bold text-red-400">{emailStats.noise}</div>
          <div className="text-xs text-slate-500 font-medium">Spam/Auto</div>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <div className="text-2xl font-bold text-slate-400">{emailStats.lowRelevance}</div>
          <div className="text-xs text-slate-500 font-medium">Low Relevance</div>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <div className="text-2xl font-bold text-teal-600">{sourceStats.meetings}</div>
          <div className="text-xs text-slate-500 font-medium">Meetings</div>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <div className="text-2xl font-bold text-purple-600">{sourceStats.slack}</div>
          <div className="text-xs text-slate-500 font-medium">Slack Messages</div>
        </div>
      </div>

      {/* Threshold Control */}
      <div className="bg-gradient-to-r from-blue-50 to-purple-50 p-6 rounded-2xl border border-blue-100 mb-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white rounded-xl border border-blue-200">
              <SlidersHorizontal className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900">Relevance Threshold</h3>
              <p className="text-sm text-slate-600">Emails above this threshold are used as sources</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-3 bg-white px-4 py-2 rounded-xl border border-slate-200">
              <input
                type="range"
                min="0"
                max="100"
                value={relevanceThreshold * 100}
                onChange={(e) => setRelevanceThreshold(Number(e.target.value) / 100)}
                className="w-32 accent-blue-600"
              />
              <span className="text-lg font-bold text-blue-600 min-w-[3rem]">
                {Math.round(relevanceThreshold * 100)}%
              </span>
            </div>
            <Button
              variant="primary"
              size="sm"
              onClick={handleApplyThreshold}
              disabled={!loadedDatasets.enron}
              className="rounded-xl"
            >
              Apply Threshold
            </Button>
          </div>
        </div>
        {loadedDatasets.enron && (
          <div className="mt-4 flex items-center gap-4 text-sm flex-wrap">
            <span className="text-slate-600">
              With {Math.round(relevanceThreshold * 100)}% threshold:
            </span>
            <span className="px-2 py-1 bg-emerald-100 text-emerald-700 rounded-lg font-medium">
              {emailStats.relevant} emails will be used
            </span>
            <span className="px-2 py-1 bg-slate-100 text-slate-500 rounded-lg font-medium">
              {emailStats.lowRelevance} low relevance
            </span>
            <span className="px-2 py-1 bg-red-100 text-red-500 rounded-lg font-medium">
              {emailStats.noise} spam/auto filtered
            </span>
          </div>
        )}
      </div>

      {/* Dataset Loaders */}
      <div className="grid md:grid-cols-4 gap-4 mb-8">
        {realDatasets.map((dataset) => {
          const isLoaded = alreadyLoadedDatasets.includes(dataset.id);
          const isLoading = isLoadingDataset === dataset.id;
          
          return (
            <div 
              key={dataset.id}
              className={`bg-white p-4 rounded-xl border-2 transition-all ${
                isLoaded ? 'border-emerald-200 bg-emerald-50/30' : 'border-slate-100 hover:border-blue-200'
              }`}
            >
              <div className="flex items-center gap-3 mb-3">
                <div className={`p-2 rounded-lg ${
                  dataset.id === 'enron' ? 'bg-blue-100 text-blue-600' :
                  dataset.id === 'ami' ? 'bg-emerald-100 text-emerald-600' :
                  'bg-orange-100 text-orange-600'
                }`}>
                  {dataset.id === 'enron' ? <Mail className="h-5 w-5" /> :
                   dataset.id === 'ami' ? <Video className="h-5 w-5" /> :
                   <FileText className="h-5 w-5" />}
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="font-semibold text-slate-900 text-sm truncate">{dataset.name}</h4>
                  <p className="text-xs text-slate-500">{dataset.recordCount}</p>
                </div>
                {isLoaded && <Check className="h-5 w-5 text-emerald-600" />}
              </div>
              <Button
                variant={isLoaded ? "outline" : "primary"}
                size="sm"
                className={`w-full rounded-lg text-xs ${isLoaded ? 'border-emerald-200 text-emerald-600' : ''}`}
                onClick={() => !isLoaded && handleLoadSampleDataset(dataset.id)}
                disabled={isLoading || !!isLoadingDataset || isLoaded}
              >
                {isLoading ? <Loader className="h-3 w-3 animate-spin mr-1" /> : null}
                {isLoaded ? 'Loaded' : isLoading ? 'Loading...' : 'Load Dataset'}
              </Button>
            </div>
          );
        })}
        
        {/* Generate Slack Card */}
        <div className={`bg-white p-4 rounded-xl border-2 transition-all ${
          alreadyLoadedDatasets.includes('synthetic_slack') ? 'border-purple-200 bg-purple-50/30' : 'border-slate-100 hover:border-purple-200'
        }`}>
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 rounded-lg bg-purple-100 text-purple-600">
              <MessageSquare className="h-5 w-5" />
            </div>
            <div className="flex-1 min-w-0">
              <h4 className="font-semibold text-slate-900 text-sm">Synthetic Slack</h4>
              <p className="text-xs text-slate-500">From Enron emails</p>
            </div>
            {alreadyLoadedDatasets.includes('synthetic_slack') && <Check className="h-5 w-5 text-purple-600" />}
          </div>
          <Button
            variant={alreadyLoadedDatasets.includes('synthetic_slack') ? "outline" : "primary"}
            size="sm"
            className={`w-full rounded-lg text-xs ${alreadyLoadedDatasets.includes('synthetic_slack') ? 'border-purple-200 text-purple-600' : ''}`}
            onClick={handleGenerateSyntheticSlack}
            disabled={!loadedDatasets.enron || isLoadingDataset === 'synthetic_slack' || alreadyLoadedDatasets.includes('synthetic_slack')}
          >
            {isLoadingDataset === 'synthetic_slack' ? <Loader className="h-3 w-3 animate-spin mr-1" /> : null}
            {alreadyLoadedDatasets.includes('synthetic_slack') ? 'Generated' : 'Generate'}
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {/* Tab Headers */}
        <div className="flex border-b border-slate-200 bg-slate-50 overflow-x-auto">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-5 py-3 text-sm font-medium transition-all border-b-2 -mb-px whitespace-nowrap ${
                activeTab === tab.id 
                  ? 'border-blue-600 text-blue-600 bg-white' 
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              {tab.icon}
              {tab.label}
              {tab.count !== undefined && tab.count > 0 && (
                <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                  activeTab === tab.id ? 'bg-blue-100 text-blue-700' : 'bg-slate-200 text-slate-600'
                }`}>
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div className="p-6">
          {/* Search & Filter Bar */}
          {activeTab !== 'overview' && (
            <div className="flex items-center gap-4 mb-6">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search data..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                />
                {searchQuery && (
                  <button 
                    onClick={() => setSearchQuery('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
              <button
                onClick={() => setShowOnlyUsed(!showOnlyUsed)}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl border text-sm font-medium transition-all ${
                  showOnlyUsed 
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-700' 
                    : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
                }`}
              >
                {showOnlyUsed ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                {showOnlyUsed ? 'Showing Used Only' : 'Show All'}
              </button>
            </div>
          )}

          {/* Overview Tab */}
          {activeTab === 'overview' && (
            <div className="space-y-6">
              <div className="grid md:grid-cols-2 gap-6">
                {/* Data Pipeline Visual */}
                <div className="bg-slate-50 rounded-xl p-6">
                  <h3 className="font-bold text-slate-900 mb-4">Data Pipeline</h3>
                  <div className="space-y-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold text-sm">1</div>
                      <div className="flex-1">
                        <div className="text-sm font-medium text-slate-700">Load Datasets</div>
                        <div className="text-xs text-slate-500">{realDatasets.filter(d => alreadyLoadedDatasets.includes(d.id)).length}/{realDatasets.length} loaded</div>
                      </div>
                      {alreadyLoadedDatasets.length > 0 && <Check className="h-5 w-5 text-emerald-600" />}
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-purple-100 text-purple-600 flex items-center justify-center font-bold text-sm">2</div>
                      <div className="flex-1">
                        <div className="text-sm font-medium text-slate-700">Filter by Relevance</div>
                        <div className="text-xs text-slate-500">Threshold: {Math.round(relevanceThreshold * 100)}%</div>
                      </div>
                      <Filter className="h-5 w-5 text-purple-600" />
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center font-bold text-sm">3</div>
                      <div className="flex-1">
                        <div className="text-sm font-medium text-slate-700">Use as Sources</div>
                        <div className="text-xs text-slate-500">{connectedCount} sources active</div>
                      </div>
                      {connectedCount > 0 && <Check className="h-5 w-5 text-emerald-600" />}
                    </div>
                  </div>
                </div>

                {/* Source Breakdown */}
                <div className="bg-slate-50 rounded-xl p-6">
                  <h3 className="font-bold text-slate-900 mb-4">Source Breakdown</h3>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Mail className="h-4 w-4 text-blue-600" />
                        <span className="text-sm text-slate-700">Enron Emails</span>
                      </div>
                      <span className="font-bold text-slate-900">{project.sources.filter(s => s.fileType?.includes('enron')).length}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Video className="h-4 w-4 text-emerald-600" />
                        <span className="text-sm text-slate-700">AMI Meetings</span>
                      </div>
                      <span className="font-bold text-slate-900">{project.sources.filter(s => s.fileType?.includes('ami')).length}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4 text-orange-600" />
                        <span className="text-sm text-slate-700">Transcripts</span>
                      </div>
                      <span className="font-bold text-slate-900">{project.sources.filter(s => s.fileType?.includes('transcript')).length}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <MessageSquare className="h-4 w-4 text-purple-600" />
                        <span className="text-sm text-slate-700">Slack Messages</span>
                      </div>
                      <span className="font-bold text-slate-900">{project.sources.filter(s => s.fileType?.includes('slack') || s.fileType?.includes('chat')).length}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Privacy & Transparency */}
              <div className="grid sm:grid-cols-3 gap-4">
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                  <div className="flex items-center gap-2 mb-2 text-blue-600">
                    <ShieldCheck className="h-4 w-4" />
                    <h4 className="font-semibold text-slate-900 text-sm">Privacy First</h4>
                  </div>
                  <p className="text-xs text-slate-500">Data encrypted at rest and in transit.</p>
                </div>
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                  <div className="flex items-center gap-2 mb-2 text-emerald-600">
                    <Check className="h-4 w-4" />
                    <h4 className="font-semibold text-slate-900 text-sm">Traceability</h4>
                  </div>
                  <p className="text-xs text-slate-500">Every requirement links back to source.</p>
                </div>
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                  <div className="flex items-center gap-2 mb-2 text-orange-600">
                    <Info className="h-4 w-4" />
                    <h4 className="font-semibold text-slate-900 text-sm">AI Verification</h4>
                  </div>
                  <p className="text-xs text-slate-500">Ambiguous items flagged for review.</p>
                </div>
              </div>

              {/* Automatic Insight Extraction */}
              <div className="bg-gradient-to-r from-amber-50 to-orange-50 p-6 rounded-2xl border border-amber-200">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-white rounded-xl border border-amber-200">
                      <Lightbulb className="h-5 w-5 text-amber-600" />
                    </div>
                    <div>
                      <h3 className="font-bold text-slate-900">Automatic Insight Generator</h3>
                      <p className="text-sm text-slate-600">
                        Extract insights from all loaded sources using AI analysis
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={handleExtractAllInsights}
                    disabled={isExtractingInsights || connectedCount === 0}
                    className="rounded-xl bg-amber-600 hover:bg-amber-700"
                  >
                    {isExtractingInsights ? (
                      <>
                        <Loader className="h-4 w-4 animate-spin mr-2" />
                        Extracting...
                      </>
                    ) : (
                      <>
                        <Sparkles className="h-4 w-4 mr-2" />
                        Extract All Insights
                      </>
                    )}
                  </Button>
                </div>
                
                {/* Progress Bar */}
                {isExtractingInsights && extractionProgress && (
                  <div className="mt-4 space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-slate-600">
                        Processing: {extractionProgress.sourceName || 'Starting...'}
                      </span>
                      <span className="text-amber-700 font-medium">
                        {extractionProgress.currentSource}/{extractionProgress.totalSources} sources
                      </span>
                    </div>
                    <div className="w-full h-2 bg-amber-200 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-amber-600 rounded-full transition-all duration-300 ease-out"
                        style={{ 
                          width: `${Math.round((extractionProgress.currentSource / extractionProgress.totalSources) * 100)}%` 
                        }}
                      />
                    </div>
                    <div className="text-xs text-emerald-600 font-medium">
                      {extractionProgress.insightsExtracted} insights extracted so far
                    </div>
                  </div>
                )}

                {/* Current Insights Count */}
                {!isExtractingInsights && (
                  <div className="mt-4 flex items-center gap-4 text-sm">
                    <span className="text-slate-600">
                      Current insights: 
                    </span>
                    <span className="px-2 py-1 bg-white text-amber-700 rounded-lg font-medium border border-amber-200">
                      {project.insights?.length || 0} insights extracted
                    </span>
                    {connectedCount === 0 && (
                      <span className="text-slate-500 text-xs">
                        (Load sources above to enable extraction)
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Enron Emails Tab */}
          {activeTab === 'enron' && (
            <div>
              {!loadedDatasets.enron ? (
                <div className="text-center py-12">
                  <Mail className="h-12 w-12 text-slate-300 mx-auto mb-4" />
                  <p className="text-slate-500">Load the Enron dataset to see emails here</p>
                </div>
              ) : (
                <div className="space-y-2 max-h-[600px] overflow-y-auto">
                  {filterBySearch(loadedDatasets.enron)
                    .filter(email => !showOnlyUsed || email.relevanceScore >= relevanceThreshold)
                    .map((email, idx) => {
                      const isUsed = email.relevanceScore >= relevanceThreshold && !email.isNoise;
                      const classification = email.classification || (email.isNoise ? 'noise' : email.relevanceScore >= 0.7 ? 'high-relevance' : email.relevanceScore >= 0.5 ? 'relevant' : 'low-relevance');
                      return (
                        <div 
                          key={email.id || idx}
                          className={`p-4 rounded-xl border transition-all ${
                            email.isNoise ? 'bg-red-50/50 border-red-200 opacity-50' :
                            isUsed 
                              ? 'bg-emerald-50 border-emerald-200' 
                              : 'bg-slate-50 border-slate-100 opacity-60'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-3 mb-2">
                            <div className="flex items-center gap-2 flex-1 min-w-0">
                              {email.isNoise ? (
                                <Tooltip content={email.noiseReason || 'Auto-generated or spam email'}>
                                  <span className="shrink-0 px-2 py-0.5 bg-red-400 text-white text-[10px] font-bold rounded uppercase flex items-center gap-1 cursor-help">
                                    <AlertCircle className="h-3 w-3" /> Spam/Auto
                                  </span>
                                </Tooltip>
                              ) : isUsed ? (
                                <span className="shrink-0 px-2 py-0.5 bg-emerald-500 text-white text-[10px] font-bold rounded uppercase flex items-center gap-1">
                                  <Check className="h-3 w-3" /> Used
                                </span>
                              ) : (
                                <span className="shrink-0 px-2 py-0.5 bg-slate-300 text-slate-600 text-[10px] font-bold rounded uppercase">
                                  Low Relevance
                                </span>
                              )}
                              <span className={`font-medium truncate ${email.isNoise ? 'text-red-400' : isUsed ? 'text-slate-800' : 'text-slate-500'}`}>
                                {email.subject || '(No Subject)'}
                              </span>
                            </div>
                            <span className={`shrink-0 px-2 py-0.5 rounded text-xs font-bold ${
                              email.relevanceScore >= 0.7 ? 'bg-emerald-100 text-emerald-700' :
                              email.relevanceScore >= 0.5 ? 'bg-yellow-100 text-yellow-700' :
                              email.relevanceScore >= 0.3 ? 'bg-orange-100 text-orange-700' :
                              'bg-slate-200 text-slate-500'
                            }`}>
                              {Math.round(email.relevanceScore * 100)}%
                            </span>
                          </div>
                          <div className={`text-xs mb-2 ${isUsed ? 'text-slate-600' : 'text-slate-400'}`}>
                            <span className="font-medium">From:</span> {email.from} → <span className="font-medium">To:</span> {email.to?.slice(0, 2).join(', ')}{email.to?.length > 2 ? ` +${email.to.length - 2}` : ''}
                          </div>
                          {isUsed && (
                            <>
                              <p className="text-xs text-slate-600 line-clamp-2 mb-2">
                                {email.body?.slice(0, 200)}...
                              </p>
                              <div className="flex gap-1">
                                {email.hasProjectKeywords && <span className="px-1.5 py-0.5 bg-blue-100 text-blue-700 text-[10px] rounded">Project</span>}
                                {email.hasDecisionKeywords && <span className="px-1.5 py-0.5 bg-purple-100 text-purple-700 text-[10px] rounded">Decision</span>}
                                {email.hasDeadlineKeywords && <span className="px-1.5 py-0.5 bg-orange-100 text-orange-700 text-[10px] rounded">Deadline</span>}
                              </div>
                            </>
                          )}
                        </div>
                      );
                    })}
                </div>
              )}
            </div>
          )}

          {/* AMI Meetings Tab */}
          {activeTab === 'ami' && (
            <div>
              {!loadedDatasets.ami ? (
                <div className="text-center py-12">
                  <Video className="h-12 w-12 text-slate-300 mx-auto mb-4" />
                  <p className="text-slate-500">Load the AMI corpus to see meetings here</p>
                </div>
              ) : (
                <div className="space-y-3 max-h-[600px] overflow-y-auto">
                  {loadedDatasets.ami.map((meeting, idx) => (
                    <div 
                      key={meeting.id || idx}
                      className="p-4 rounded-xl border bg-emerald-50 border-emerald-200"
                    >
                      <div className="flex items-start justify-between gap-3 mb-2">
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-0.5 bg-emerald-500 text-white text-[10px] font-bold rounded uppercase flex items-center gap-1">
                            <Check className="h-3 w-3" /> Used
                          </span>
                          <span className="font-medium text-slate-800">
                            {meeting.meetingId} - {meeting.scenario}
                          </span>
                        </div>
                        {meeting.summary && (
                          <span className="px-2 py-0.5 bg-teal-100 text-teal-700 text-[10px] font-bold rounded">Has Summary</span>
                        )}
                      </div>
                      {meeting.summary && (
                        <p className="text-xs text-slate-600 mb-2 line-clamp-2">
                          <span className="font-medium">Summary:</span> {typeof meeting.summary === 'string' ? meeting.summary : meeting.summary.abstractive}
                        </p>
                      )}
                      <div className="text-xs text-slate-500">
                        <span className="font-medium">Turns:</span> {Array.isArray(meeting.transcript) ? meeting.transcript.length : 0} dialogue turns
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Transcripts Tab */}
          {activeTab === 'transcripts' && (
            <div>
              {!loadedDatasets.transcripts ? (
                <div className="text-center py-12">
                  <FileText className="h-12 w-12 text-slate-300 mx-auto mb-4" />
                  <p className="text-slate-500">Load the transcripts dataset to see data here</p>
                </div>
              ) : (
                <div className="space-y-3 max-h-[600px] overflow-y-auto">
                  {loadedDatasets.transcripts.map((transcript, idx) => (
                    <div 
                      key={transcript.id || idx}
                      className="p-4 rounded-xl border bg-orange-50 border-orange-200"
                    >
                      <div className="flex items-start justify-between gap-3 mb-2">
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-0.5 bg-orange-500 text-white text-[10px] font-bold rounded uppercase flex items-center gap-1">
                            <Check className="h-3 w-3" /> Used
                          </span>
                          <span className="font-medium text-slate-800">{transcript.title}</span>
                        </div>
                        <span className="text-xs text-slate-500">{new Date(transcript.date).toLocaleDateString()}</span>
                      </div>
                      <p className="text-xs text-slate-600 line-clamp-2">
                        {transcript.transcript?.slice(0, 200)}...
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Slack Tab */}
          {activeTab === 'slack' && (
            <div>
              {!loadedDatasets.slack ? (
                <div className="text-center py-12">
                  <MessageSquare className="h-12 w-12 text-slate-300 mx-auto mb-4" />
                  <p className="text-slate-500">Generate synthetic Slack messages to see data here</p>
                </div>
              ) : (
                <div className="space-y-3 max-h-[600px] overflow-y-auto">
                  {loadedDatasets.slack.map((msg, idx) => (
                    <div 
                      key={msg.id || idx}
                      className="p-4 rounded-xl border bg-purple-50 border-purple-200"
                    >
                      <div className="flex items-start justify-between gap-3 mb-2">
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-0.5 bg-purple-500 text-white text-[10px] font-bold rounded uppercase flex items-center gap-1">
                            <Check className="h-3 w-3" /> Used
                          </span>
                          <span className="font-medium text-slate-800">{msg.title}</span>
                        </div>
                        <span className={`px-2 py-0.5 rounded text-xs font-bold ${
                          msg.relevanceScore >= 0.5 ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-500'
                        }`}>
                          {Math.round(msg.relevanceScore * 100)}%
                        </span>
                      </div>
                      <p className="text-xs text-slate-600 line-clamp-2">
                        {msg.content?.slice(0, 200)}...
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Footer CTA */}
      <div className="mt-8 flex flex-col items-center gap-4">
        {project.sources.length === 0 && (
          <div className="flex items-center gap-2 text-orange-600 bg-orange-50 px-4 py-2 rounded-xl border border-orange-100 text-sm font-medium">
            <AlertCircle className="h-4 w-4" /> Load at least one dataset to continue
          </div>
        )}
        
        <Button 
          onClick={onContinue} 
          size="lg" 
          disabled={project.sources.length === 0}
          className={`shadow-2xl h-14 px-10 text-lg font-bold rounded-2xl transition-all ${project.sources.length > 0 ? 'shadow-blue-500/30' : 'opacity-50 grayscale cursor-not-allowed'}`}
        >
          Continue to Project Context <ArrowRight className="ml-3 h-5 w-5" />
        </Button>
        
        <p className="text-slate-400 text-xs text-center max-w-md">
          By continuing, you agree to allow ClarityAI to process the selected data sources for requirement generation.
        </p>
      </div>
    </div>
  );
};

export default DataSources;
