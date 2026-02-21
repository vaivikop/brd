import React, { useState, useRef } from 'react';
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
  Clock
} from 'lucide-react';
import Button from './Button';
import Tooltip from './Tooltip';
import { addSourceToProject, ProjectState, Source } from '../utils/db';
import { useToast } from '../context/ToastContext';
import { 
  DatasetLoader, 
  getAllDatasets, 
  EnronEmail, 
  AMIMeeting, 
  MeetingTranscript
} from '../utils/services/datasets';

interface DataSourcesProps {
  project: ProjectState;
  onUpdate: (project: ProjectState) => void;
  onContinue?: () => void;
}

const DataSources: React.FC<DataSourcesProps> = ({ project, onUpdate, onContinue }) => {
  const [isLoadingDataset, setIsLoadingDataset] = useState<string | null>(null);
  const [loadedDatasets, setLoadedDatasets] = useState<{
    enron?: EnronEmail[];
    ami?: AMIMeeting[];
    transcripts?: MeetingTranscript[];
  }>({});
  const [datasetStats, setDatasetStats] = useState<{
    emailsLoaded: number;
    meetingsLoaded: number;
    relevantItems: number;
  }>({ emailsLoaded: 0, meetingsLoaded: 0, relevantItems: 0 });
  const { showToast } = useToast();
  const datasetFileInputRef = useRef<HTMLInputElement>(null);
  const [activeDatasetUpload, setActiveDatasetUpload] = useState<string | null>(null);

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
  // REAL DATASET LOADING HANDLERS
  // ============================================================================

  const handleLoadSampleDataset = async (datasetId: string) => {
    // Prevent loading if already loaded
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
        // Load all real Enron emails (500 from extracted dataset)
        const emails = await DatasetLoader.loadEnronEmails({ 
          limit: 500,
          filterByKeywords: ['requirements', 'decisions', 'project']
        });
        
        setLoadedDatasets(prev => ({ ...prev, enron: emails }));
        setDatasetStats(prev => ({ 
          ...prev, 
          emailsLoaded: emails.length,
          relevantItems: prev.relevantItems + emails.filter(e => e.relevanceScore > 0.3).length
        }));

        // Add top 15 relevant emails as sources for analysis
        const topEmails = emails.slice(0, 15);
        sourcesToAdd = topEmails.map((email, idx) => ({
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
          title: 'Real Enron Data Loaded',
          message: `${emails.length} real corporate emails loaded from Enron dataset, ${emails.filter(e => e.relevanceScore > 0.3).length} marked as high relevance`
        });

      } else if (datasetId === 'ami') {
        // Load all real AMI meeting transcripts (100 from downloaded dataset)
        const meetings = await DatasetLoader.loadAMIMeetings({ limit: 100 });
        
        setLoadedDatasets(prev => ({ ...prev, ami: meetings }));
        setDatasetStats(prev => ({ 
          ...prev, 
          meetingsLoaded: meetings.length,
          relevantItems: prev.relevantItems + meetings.length
        }));

        // Add top 10 meetings as sources for analysis
        sourcesToAdd = meetings.slice(0, 10).map((meeting, idx) => {
          // Handle both formats: {role, text} or {speaker, text}
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
          title: 'Real Meeting Data Loaded',
          message: `${meetings.length} real dialogue transcripts with summaries loaded`
        });

      } else if (datasetId === 'meetingTranscripts') {
        // Load simple meeting transcripts
        const transcripts = await DatasetLoader.loadMeetingTranscripts({ limit: 20 });
        
        setLoadedDatasets(prev => ({ ...prev, transcripts }));
        setDatasetStats(prev => ({ 
          ...prev, 
          meetingsLoaded: prev.meetingsLoaded + transcripts.length,
          relevantItems: prev.relevantItems + transcripts.length
        }));

        sourcesToAdd = transcripts.slice(0, 3).map((transcript, idx) => ({
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
          title: 'Meeting Transcripts Loaded',
          message: `${transcripts.length} transcripts loaded for analysis`
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
        setDatasetStats(prev => ({
          ...prev,
          emailsLoaded: emails.length,
          relevantItems: prev.relevantItems + emails.filter(e => e.relevanceScore > 0.3).length
        }));
        
        // Add top relevant emails
        const topEmails = emails.filter(e => e.relevanceScore > 0.3).slice(0, 10);
        for (const email of topEmails) {
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
          message: `${emails.length} emails parsed, ${topEmails.length} high-relevance items added`
        });

      } else if (activeDatasetUpload === 'ami' || activeDatasetUpload === 'meetingTranscripts') {
        const meetings = await DatasetLoader.loadAMIMeetings({ fromFile: file });
        setLoadedDatasets(prev => ({ ...prev, ami: meetings }));
        
        for (const meeting of meetings.slice(0, 5)) {
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
        { channelName: '#project-requirements', limit: 20 }
      );

      for (const msg of slackMessages.slice(0, 5)) {
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
        message: `${slackMessages.length} Slack-style messages created from emails`
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

  const connectedCount = project.sources.length;
  const realDatasets = getAllDatasets();
  // Count datasets that are either loaded in local state OR already persisted in project sources
  const loadedDatasetsCount = realDatasets.filter(ds => {
    const isLoadedLocal = Boolean(
      (ds.id === 'enron' && loadedDatasets.enron?.length) ||
      (ds.id === 'ami' && loadedDatasets.ami?.length) ||
      (ds.id === 'meetingTranscripts' && loadedDatasets.transcripts?.length)
    );
    const isLoadedPersisted = alreadyLoadedDatasets.includes(ds.id);
    return isLoadedLocal || isLoadedPersisted;
  }).length;

  return (
    <div className="max-w-6xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500 pb-20">
      {/* Hidden file input for dataset uploads */}
      <input
        ref={datasetFileInputRef}
        type="file"
        className="hidden"
        accept=".csv,.json,.txt"
        onChange={handleDatasetFileUpload}
      />

      {/* Header Section */}
      <div className="mb-8 lg:mb-12 text-center md:text-left flex flex-col gap-4 lg:gap-6">
        <div className="max-w-2xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 text-blue-700 text-xs font-bold uppercase tracking-wider mb-3 lg:mb-4 border border-blue-100">
            <Database className="h-3 w-3" /> Step 2: Knowledge Ingestion
          </div>
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-slate-900 mb-3 lg:mb-4 tracking-tight">Load Research-Grade Datasets</h1>
          <p className="text-base lg:text-lg text-slate-600 leading-relaxed">
            Use authentic business communication data from academic research to build your 
            <span className="text-blue-600 font-semibold"> Living BRD</span> with real-world emails, meetings, and chat messages.
          </p>
        </div>
        
        <div className="bg-white px-4 lg:px-6 py-3 lg:py-4 rounded-xl lg:rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4 lg:gap-6 self-center md:self-start">
            <div className="text-center">
                <div className="text-xl lg:text-2xl font-bold text-slate-900">{connectedCount}</div>
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Sources</div>
            </div>
            <div className="h-6 lg:h-8 w-px bg-slate-100"></div>
            <div className="flex-1 min-w-[100px] lg:min-w-[120px]">
                <div className="flex justify-between text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">
                    <span>Datasets</span>
                    <span>{loadedDatasetsCount}/{realDatasets.length}</span>
                </div>
                <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                    <div 
                        className="h-full bg-purple-500 transition-all duration-1000 ease-out" 
                        style={{ width: `${(loadedDatasetsCount / realDatasets.length) * 100}%` }}
                    ></div>
                </div>
            </div>
        </div>
      </div>

      {/* ================================================================== */}
      {/* REAL DATASETS SECTION - Research-Grade Data Sources */}
      {/* ================================================================== */}
      <div className="mb-16">
        <div className="flex items-center justify-between mb-8">
          {datasetStats.relevantItems > 0 && (
            <div className="bg-gradient-to-r from-emerald-50 to-blue-50 px-6 py-4 rounded-2xl border border-emerald-100">
              <div className="flex items-center gap-6">
                <div className="text-center">
                  <div className="text-xl font-bold text-emerald-600">{datasetStats.emailsLoaded}</div>
                  <div className="text-[10px] font-bold text-slate-400 uppercase">Emails</div>
                </div>
                <div className="text-center">
                  <div className="text-xl font-bold text-blue-600">{datasetStats.meetingsLoaded}</div>
                  <div className="text-[10px] font-bold text-slate-400 uppercase">Meetings</div>
                </div>
                <div className="text-center">
                  <div className="text-xl font-bold text-purple-600">{datasetStats.relevantItems}</div>
                  <div className="text-[10px] font-bold text-slate-400 uppercase">Relevant</div>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="grid md:grid-cols-3 gap-6 mb-8">
          {realDatasets.map((dataset) => {
            // Check both local state and persisted project sources
            const isLoadedLocal = Boolean(
              (dataset.id === 'enron' && loadedDatasets.enron?.length) ||
              (dataset.id === 'ami' && loadedDatasets.ami?.length) ||
              (dataset.id === 'meetingTranscripts' && loadedDatasets.transcripts?.length)
            );
            const isLoadedPersisted = alreadyLoadedDatasets.includes(dataset.id);
            const isLoaded = isLoadedLocal || isLoadedPersisted;
            const isLoading = isLoadingDataset === dataset.id;
            
            // Get loaded count for this dataset
            const loadedCount = dataset.id === 'enron' ? loadedDatasets.enron?.length || 0 :
                               dataset.id === 'ami' ? loadedDatasets.ami?.length || 0 :
                               loadedDatasets.transcripts?.length || 0;
            
            return (
              <div 
                key={dataset.id}
                className={`bg-white p-6 rounded-2xl border-2 transition-all duration-300 ${
                  isLoaded ? 'border-emerald-200 shadow-md shadow-emerald-100' : 'border-slate-100 hover:border-purple-100 hover:shadow-lg'
                }`}
              >
                {/* Header */}
                <div className="flex items-start justify-between mb-4">
                  <div className={`p-3 rounded-xl ${
                    dataset.id === 'enron' ? 'bg-blue-50 text-blue-600' :
                    dataset.id === 'ami' ? 'bg-emerald-50 text-emerald-600' :
                    'bg-orange-50 text-orange-600'
                  }`}>
                    {dataset.id === 'enron' ? <Mail className="h-6 w-6" /> :
                     dataset.id === 'ami' ? <Video className="h-6 w-6" /> :
                     <FileText className="h-6 w-6" />}
                  </div>
                  {isLoaded && (
                    <div className="bg-emerald-500 text-white p-1.5 rounded-full">
                      <Check className="h-4 w-4" />
                    </div>
                  )}
                </div>

                {/* Info */}
                <h3 className="font-bold text-slate-900 text-lg mb-2">{dataset.name}</h3>
                <p className="text-sm text-slate-500 mb-4 line-clamp-2">{dataset.description}</p>

                {/* Metadata */}
                <div className="flex flex-wrap gap-2 mb-4">
                  <span className="px-2 py-1 bg-slate-50 text-slate-600 text-xs rounded-lg font-medium">
                    {dataset.recordCount}
                  </span>
                  <span className="px-2 py-1 bg-slate-50 text-slate-600 text-xs rounded-lg font-medium">
                    {dataset.license}
                  </span>
                  {isLoaded && (
                    <span className="px-2 py-1 bg-emerald-100 text-emerald-700 text-xs rounded-lg font-bold flex items-center gap-1">
                      <Database className="h-3 w-3" />
                      {loadedCount > 0 ? `${loadedCount} Loaded` : 'Real Data'}
                    </span>
                  )}
                </div>

                {/* Usage Notes */}
                <div className="mb-4">
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Ideal For:</div>
                  <div className="flex flex-wrap gap-1">
                    {dataset.idealFor.slice(0, 2).map((use, i) => (
                      <span key={i} className="px-2 py-0.5 bg-purple-50 text-purple-600 text-xs rounded font-medium">
                        {use}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-2 pt-4 border-t border-slate-50">
                  <Button
                    variant={isLoaded ? "outline" : "primary"}
                    size="sm"
                    className={`flex-1 rounded-xl ${isLoaded ? 'border-emerald-200 text-emerald-600 cursor-default' : ''}`}
                    onClick={() => !isLoaded && handleLoadSampleDataset(dataset.id)}
                    disabled={isLoading || !!isLoadingDataset || isLoaded}
                  >
                    {isLoading ? (
                      <>
                        <Loader className="h-4 w-4 animate-spin mr-2" />
                        Loading...
                      </>
                    ) : isLoaded ? (
                      <>
                        <Check className="h-4 w-4 mr-2" />
                        Already Loaded
                      </>
                    ) : (
                      <>
                        <Zap className="h-4 w-4 mr-2" />
                        Load Sample
                      </>
                    )}
                  </Button>
                  {!isLoaded && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="rounded-xl"
                      onClick={() => {
                        setActiveDatasetUpload(dataset.id);
                        datasetFileInputRef.current?.click();
                      }}
                      disabled={isLoading}
                    >
                      <UploadCloud className="h-4 w-4" />
                    </Button>
                  )}
                  <a
                    href={dataset.downloadUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2 border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors"
                  >
                    <ExternalLink className="h-4 w-4 text-slate-500" />
                  </a>
                </div>
              </div>
            );
          })}
        </div>

        {/* Loaded Data Preview */}
        {(loadedDatasets.enron?.length || loadedDatasets.ami?.length) && (
          <div className="bg-white rounded-2xl border border-slate-200 p-6 mb-8">
            <div className="flex items-center gap-2 mb-4">
              <Database className="h-5 w-5 text-purple-600" />
              <h3 className="font-bold text-slate-900">Loaded Data Preview</h3>
              <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 text-xs rounded-full font-medium">
                Real Data Active
              </span>
            </div>

            {/* Enron Emails Preview */}
            {loadedDatasets.enron && loadedDatasets.enron.length > 0 && (
              <div className="mb-6">
                <div className="flex items-center gap-2 mb-3">
                  <Mail className="h-4 w-4 text-blue-600" />
                  <span className="font-semibold text-slate-800">Enron Corporate Emails</span>
                  <span className="text-xs text-slate-500">({loadedDatasets.enron.length} emails)</span>
                </div>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {loadedDatasets.enron.slice(0, 5).map((email, idx) => (
                    <div key={email.id || idx} className="bg-slate-50 rounded-lg p-3 text-sm border border-slate-100">
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <span className="font-medium text-slate-800 truncate flex-1">
                          {email.subject || '(No Subject)'}
                        </span>
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                          email.relevanceScore > 0.5 ? 'bg-emerald-100 text-emerald-700' :
                          email.relevanceScore > 0.3 ? 'bg-yellow-100 text-yellow-700' :
                          'bg-slate-200 text-slate-600'
                        }`}>
                          {Math.round(email.relevanceScore * 100)}% relevant
                        </span>
                      </div>
                      <div className="text-xs text-slate-500 mb-1">
                        <span className="font-medium">From:</span> {email.from} | 
                        <span className="font-medium"> To:</span> {email.to?.slice(0, 2).join(', ')}{email.to?.length > 2 ? ` +${email.to.length - 2}` : ''}
                      </div>
                      <p className="text-xs text-slate-600 line-clamp-2">
                        {email.body?.slice(0, 150)}...
                      </p>
                      {(email.hasProjectKeywords || email.hasDecisionKeywords || email.hasDeadlineKeywords) && (
                        <div className="flex gap-1 mt-2">
                          {email.hasProjectKeywords && <span className="px-1.5 py-0.5 bg-blue-100 text-blue-700 text-[10px] rounded">Project</span>}
                          {email.hasDecisionKeywords && <span className="px-1.5 py-0.5 bg-purple-100 text-purple-700 text-[10px] rounded">Decision</span>}
                          {email.hasDeadlineKeywords && <span className="px-1.5 py-0.5 bg-orange-100 text-orange-700 text-[10px] rounded">Deadline</span>}
                        </div>
                      )}
                    </div>
                  ))}
                  {loadedDatasets.enron.length > 5 && (
                    <div className="text-center text-xs text-slate-500 py-2">
                      ... and {loadedDatasets.enron.length - 5} more emails
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* AMI Meetings Preview */}
            {loadedDatasets.ami && loadedDatasets.ami.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Video className="h-4 w-4 text-emerald-600" />
                  <span className="font-semibold text-slate-800">Meeting Transcripts</span>
                  <span className="text-xs text-slate-500">({loadedDatasets.ami.length} meetings)</span>
                </div>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {loadedDatasets.ami.slice(0, 5).map((meeting, idx) => (
                    <div key={meeting.id || idx} className="bg-slate-50 rounded-lg p-3 text-sm border border-slate-100">
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <span className="font-medium text-slate-800">
                          {meeting.meetingId} - {meeting.scenario}
                        </span>
                        {meeting.summary && (
                          <span className="px-1.5 py-0.5 bg-emerald-100 text-emerald-700 text-[10px] rounded font-bold">
                            Has Summary
                          </span>
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
                      {Array.isArray(meeting.transcript) && meeting.transcript.length > 0 && (
                        <div className="mt-2 pl-2 border-l-2 border-emerald-200">
                          <p className="text-[11px] text-slate-600 italic">
                            "{(meeting.transcript[0] as any).text?.slice(0, 100)}..."
                          </p>
                        </div>
                      )}
                    </div>
                  ))}
                  {loadedDatasets.ami.length > 5 && (
                    <div className="text-center text-xs text-slate-500 py-2">
                      ... and {loadedDatasets.ami.length - 5} more meetings
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Multi-Channel Simulation */}
        <div className="bg-gradient-to-r from-purple-50 via-blue-50 to-emerald-50 p-6 rounded-2xl border border-purple-100">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Sparkles className="h-5 w-5 text-purple-600" />
                <h3 className="font-bold text-slate-900">Multi-Channel Simulation</h3>
              </div>
              <p className="text-sm text-slate-600">
                Generate synthetic Slack messages from Enron emails to simulate multi-channel ingestion as specified in the problem statement.
              </p>
            </div>
            <Button
              variant="outline"
              className={`shrink-0 ${alreadyLoadedDatasets.includes('synthetic_slack') ? 'border-emerald-200 text-emerald-600' : 'border-purple-200 text-purple-700 hover:bg-purple-100'}`}
              onClick={handleGenerateSyntheticSlack}
              disabled={(!loadedDatasets.enron && !alreadyLoadedDatasets.includes('enron')) || isLoadingDataset === 'synthetic_slack' || alreadyLoadedDatasets.includes('synthetic_slack')}
            >
              {isLoadingDataset === 'synthetic_slack' ? (
                <>
                  <Loader className="h-4 w-4 animate-spin mr-2" />
                  Generating...
                </>
              ) : alreadyLoadedDatasets.includes('synthetic_slack') ? (
                <>
                  <Check className="h-4 w-4 mr-2" />
                  Slack Generated
                </>
              ) : (
                <>
                  <MessageSquare className="h-4 w-4 mr-2" />
                  Generate Slack from Emails
                </>
              )}
            </Button>
          </div>
          {!loadedDatasets.enron && !alreadyLoadedDatasets.includes('enron') && (
            <p className="text-xs text-purple-500 mt-3 flex items-center gap-1">
              <AlertCircle className="h-3 w-3" />
              Load Enron emails first to enable synthetic Slack generation
            </p>
          )}
        </div>
      </div>

      {/* Privacy & Transparency Section */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 lg:gap-8 mb-10 lg:mb-16">
          <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100">
              <div className="flex items-center gap-3 mb-3 text-blue-600">
                  <ShieldCheck className="h-5 w-5" />
                  <h4 className="font-bold text-slate-900">Privacy First</h4>
              </div>
              <p className="text-sm text-slate-500 leading-relaxed">
                  Your data is encrypted at rest and in transit. We only extract business requirements, never personal information.
              </p>
          </div>
          <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100">
              <div className="flex items-center gap-3 mb-3 text-emerald-600">
                  <Check className="h-5 w-5" />
                  <h4 className="font-bold text-slate-900">Traceability</h4>
              </div>
              <p className="text-sm text-slate-500 leading-relaxed">
                  Every generated requirement includes a link back to the exact source snippet, ensuring 100% accountability.
              </p>
          </div>
          <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100">
              <div className="flex items-center gap-3 mb-3 text-orange-600">
                  <Info className="h-5 w-5" />
                  <h4 className="font-bold text-slate-900">AI Verification</h4>
              </div>
              <p className="text-sm text-slate-500 leading-relaxed">
                  Our Confidence Engine flags ambiguous statements for your review instead of making assumptions.
              </p>
          </div>
      </div>

      {/* Connected Sources Detail (Only if sources exist) */}
      {project.sources.length > 0 && (
          <div className="bg-white rounded-2xl lg:rounded-[2rem] border border-slate-200 shadow-sm mb-8 lg:mb-12 animate-in fade-in slide-in-from-top-4">
              <div className="px-4 lg:px-10 py-4 lg:py-6 border-b border-slate-100 bg-slate-50/30 flex flex-col sm:flex-row justify-between sm:items-center gap-3">
                  <div>
                      <h3 className="font-bold text-slate-900 text-base lg:text-lg">Active Connections</h3>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {project.sources.filter(s => s.fileType?.includes('enron')).length} emails, {' '}
                        {project.sources.filter(s => s.fileType?.includes('ami') || s.fileType?.includes('meeting')).length} meetings, {' '}
                        {project.sources.filter(s => s.fileType?.includes('slack') || s.fileType?.includes('chat')).length} chat messages
                      </p>
                  </div>
                  <Tooltip content="All sources are being analyzed by the AI engine.">
                      <div className="flex items-center gap-2 text-emerald-600 text-xs font-bold bg-emerald-50 px-3 py-1.5 rounded-full border border-emerald-100 w-fit">
                          <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
                          System Healthy
                      </div>
                  </Tooltip>
              </div>
              <div className="divide-y divide-slate-50 max-h-96 overflow-y-auto">
                  {project.sources.map((source) => (
                      <div key={source.id} className="px-4 lg:px-10 py-3 lg:py-4 flex flex-col sm:flex-row sm:items-start justify-between gap-3 hover:bg-slate-50/50 transition-colors group">
                          <div className="flex items-start gap-3 lg:gap-4 flex-1 min-w-0">
                              <div className="w-10 h-10 lg:w-12 lg:h-12 rounded-xl bg-white border border-slate-100 flex items-center justify-center text-slate-400 shadow-sm group-hover:border-blue-100 transition-colors shrink-0">
                                  {source.type === 'meeting' && <Video className="h-5 w-5 text-emerald-500" />}
                                  {source.type === 'email' && <Mail className="h-5 w-5 text-blue-500" />}
                                  {source.type === 'jira' && <Database className="h-5 w-5 text-blue-500" />}
                                  {source.type === 'slack' && <MessageSquare className="h-5 w-5 text-purple-500" />}
                                  {source.type === 'chat' && <MessageSquare className="h-5 w-5 text-purple-500" />}
                                  {source.type === 'upload' && <UploadCloud className="h-5 w-5 text-orange-500" />}
                              </div>
                              <div className="flex-1 min-w-0">
                                  <div className="font-semibold text-slate-900 truncate">{source.name}</div>
                                  <div className="text-xs text-slate-500 font-medium flex flex-wrap items-center gap-2 mt-1">
                                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                                      source.fileType?.includes('enron') ? 'bg-blue-100 text-blue-700' :
                                      source.fileType?.includes('ami') ? 'bg-emerald-100 text-emerald-700' :
                                      source.fileType?.includes('slack') || source.fileType?.includes('chat') ? 'bg-purple-100 text-purple-700' :
                                      'bg-slate-100 text-slate-600'
                                    }`}>{source.fileType || source.type}</span>
                                    <span className="flex items-center gap-1 text-slate-400"><Clock className="h-3 w-3" /> {new Date(source.timestamp).toLocaleString()}</span>
                                  </div>
                                  {source.content && (
                                    <p className="text-xs text-slate-500 mt-2 line-clamp-2 bg-slate-50 p-2 rounded border border-slate-100">
                                      {source.content.slice(0, 200)}{source.content.length > 200 ? '...' : ''}
                                    </p>
                                  )}
                              </div>
                          </div>
                          <div className="flex items-center gap-2 shrink-0 ml-4">
                              <div className={`w-2 h-2 rounded-full ${source.status === 'active' ? 'bg-emerald-500' : 'bg-slate-300'}`}></div>
                              <span className="text-xs text-slate-500 capitalize">{source.status}</span>
                          </div>
                      </div>
                  ))}
              </div>
              {project.sources.length > 5 && (
                <div className="px-10 py-3 bg-slate-50 border-t border-slate-100 text-center">
                  <span className="text-xs text-slate-500">Showing all {project.sources.length} connected sources</span>
                </div>
              )}
          </div>
      )}

      {/* Footer CTA */}
      <div className="mt-8 lg:mt-12 flex flex-col items-center gap-4 lg:gap-6">
          {project.sources.length === 0 && (
              <div className="flex items-center gap-2 text-orange-600 bg-orange-50 px-4 py-2 rounded-xl border border-orange-100 text-sm font-medium animate-bounce">
                  <AlertCircle className="h-4 w-4" /> Connect at least one source to continue
              </div>
          )}
          
          <div className="w-full sm:w-auto">
              <Button 
                onClick={onContinue} 
                size="lg" 
                disabled={project.sources.length === 0}
                className={`w-full sm:w-auto shadow-2xl h-14 lg:h-16 px-6 lg:px-10 text-base lg:text-xl font-bold rounded-xl lg:rounded-2xl transition-all transform active:scale-95 ${project.sources.length > 0 ? 'shadow-blue-500/30' : 'opacity-50 grayscale cursor-not-allowed'}`}
              >
                  Continue to Project Context <ArrowRight className="ml-2 lg:ml-3 h-5 lg:h-6 w-5 lg:w-6" />
              </Button>
          </div>
          
          <p className="text-slate-400 text-xs text-center max-w-md">
              By continuing, you agree to allow ClarityAI to process the selected data sources for the purpose of requirement generation.
          </p>
      </div>
    </div>
  );
};

export default DataSources;