/**
 * Dataset Service for BRD Agent
 * 
 * Provides integration with real-world business communication datasets:
 * 1. Enron Email Dataset - Real corporate emails with project discussions
 * 2. AMI Meeting Corpus - Meeting transcripts with requirements discussions
 * 3. Meeting Transcripts Dataset - Simpler meeting data for prototyping
 * 
 * USAGE STEPS:
 * ============
 * 
 * STEP 1: Download Datasets
 * -------------------------
 * - Enron: https://www.kaggle.com/datasets/wcukierski/enron-email-dataset
 *   Download 'emails.csv' (~1.5GB)
 * 
 * - AMI Corpus: https://huggingface.co/datasets/knkarthick/AMI
 *   Use the HuggingFace datasets library or download transcripts
 * 
 * - Meeting Transcripts: https://www.kaggle.com/datasets/abhishekunnam/meeting-transcripts
 *   Download for quick prototyping
 * 
 * STEP 2: Place in /public/datasets/
 * -----------------------------------
 * Create folder structure:
 *   /public/datasets/
 *     /enron/
 *       emails.csv (or subset emails_sample.csv)
 *     /ami/
 *       meetings.json
 *     /transcripts/
 *       transcripts.json
 * 
 * STEP 3: Use DatasetLoader in your component
 * --------------------------------------------
 * import { DatasetLoader, DATASETS } from '../services/datasets';
 * const emails = await DatasetLoader.loadEnronEmails({ limit: 100 });
 * const meetings = await DatasetLoader.loadAMIMeetings();
 */

// ============================================================================
// DATASET CONFIGURATIONS
// ============================================================================

export interface DatasetConfig {
  id: string;
  name: string;
  description: string;
  source: string;
  downloadUrl: string;
  license: string;
  licenseUrl?: string;
  recordCount: string;
  fileFormat: string;
  usageNotes: string[];
  idealFor: string[];
  sampleEndpoint?: string;
}

export const DATASETS: Record<string, DatasetConfig> = {
  enron: {
    id: 'enron',
    name: 'Enron Email Dataset',
    description: 'Real corporate emails from ~150 Enron employees containing project discussions, decisions, meeting scheduling, and stakeholder interactions.',
    source: 'Kaggle / FERC Public Release',
    downloadUrl: 'https://www.kaggle.com/datasets/wcukierski/enron-email-dataset',
    license: 'Public Domain',
    licenseUrl: 'https://www.ferc.gov/industries-data/electric/general-information/electric-industry-forms/form-no-2-2a-3-q-gas-2-2a',
    recordCount: '500 emails',
    fileFormat: 'CSV (emails.csv)',
    usageNotes: [
      'Extract project-relevant requirements from noisy everyday emails',
      'Use to/cc/bcc patterns for stakeholder analysis',
      'Filter by date ranges for specific project timelines',
      'Search for keywords like "requirements", "deadline", "approve", "decision"'
    ],
    idealFor: ['Email channel ingestion', 'Noise filtering testing', 'Stakeholder hierarchy analysis'],
    sampleEndpoint: '/datasets/enron/sample.json'
  },
  ami: {
    id: 'ami',
    name: 'AMI Meeting Corpus',
    description: 'Meeting transcripts from scenario-based design project sessions with PM, designers, and marketing roles discussing product development.',
    source: 'University of Edinburgh / HuggingFace',
    downloadUrl: 'https://huggingface.co/datasets/knkarthick/AMI',
    license: 'CC BY 4.0',
    licenseUrl: 'https://creativecommons.org/licenses/by/4.0/',
    recordCount: '100 meetings',
    fileFormat: 'JSON (transcripts + summaries)',
    usageNotes: [
      'Contains requirements discussions, design decisions, feature prioritization',
      'Pre-existing summaries for ground truth evaluation',
      'Role-based speakers: PM, Industrial Designer, Interface Designer, Marketing',
      'Meetings progress from kickoff to product completion'
    ],
    idealFor: ['Meeting transcript channel', 'Decision extraction', 'Ground truth validation'],
    sampleEndpoint: '/datasets/ami/sample.json'
  },
  meetingTranscripts: {
    id: 'meetingTranscripts',
    name: 'Meeting Transcripts Dataset',
    description: 'Simpler meeting transcript dataset for quick prototyping before testing on larger AMI corpus.',
    source: 'Kaggle Community',
    downloadUrl: 'https://www.kaggle.com/datasets/abhishekunnam/meeting-transcripts',
    license: 'Check Kaggle page (community-uploaded)',
    recordCount: 'Variable',
    fileFormat: 'Various',
    usageNotes: [
      'Good for quick prototyping',
      'Simpler structure than AMI',
      'Use as stepping stone before full corpus testing'
    ],
    idealFor: ['Quick prototyping', 'Initial algorithm testing'],
    sampleEndpoint: '/datasets/transcripts/sample.json'
  }
};

// ============================================================================
// DATA TYPES
// ============================================================================

export type EmailClassification = 'noise' | 'low-relevance' | 'relevant' | 'high-relevance';

export interface EnronEmail {
  id: string;
  messageId: string;
  date: string;
  from: string;
  to: string[];
  cc: string[];
  bcc: string[];
  subject: string;
  body: string;
  folder: string;
  // Extracted metadata
  hasProjectKeywords: boolean;
  hasDecisionKeywords: boolean;
  hasDeadlineKeywords: boolean;
  relevanceScore: number;
  // Noise classification
  isNoise: boolean;
  noiseReason?: string;
  classification: EmailClassification;
}

export interface AMIMeeting {
  id: string;
  meetingId: string;
  scenario: string;
  duration: string;
  participants: {
    role: string;
    speakerId: string;
  }[];
  transcript: {
    speaker: string;
    role: string;
    timestamp: string;
    text: string;
  }[];
  summary?: {
    abstractive: string;
    extractive: string[];
    decisions: string[];
    actionItems: string[];
  };
}

export interface MeetingTranscript {
  id: string;
  title: string;
  date: string;
  participants: string[];
  transcript: string;
  duration?: string;
}

export interface ParsedSource {
  id: string;
  type: 'email' | 'meeting' | 'chat';
  dataset: string;
  title: string;
  content: string;
  metadata: Record<string, any>;
  extractedRequirements?: string[];
  relevanceScore: number;
  timestamp: string;
}

// ============================================================================
// KEYWORD DICTIONARIES FOR FILTERING
// ============================================================================

export const KEYWORD_FILTERS = {
  project: [
    'project', 'initiative', 'program', 'deliverable', 'milestone',
    'scope', 'phase', 'sprint', 'release', 'launch'
  ],
  requirements: [
    'requirement', 'requirements', 'need', 'needs', 'must', 'should', 'shall',
    'feature', 'functionality', 'capability', 'specification', 'spec',
    'user story', 'acceptance criteria', 'use case'
  ],
  decisions: [
    'decided', 'decision', 'agreed', 'approved', 'confirmed', 'finalized',
    'go forward', 'proceed with', 'selected', 'chosen', 'concluded'
  ],
  deadlines: [
    'deadline', 'due date', 'by end of', 'deliver by', 'complete by',
    'target date', 'eta', 'timeline', 'schedule', 'urgent', 'asap'
  ],
  stakeholders: [
    'stakeholder', 'sponsor', 'owner', 'manager', 'lead', 'director',
    'executive', 'client', 'customer', 'end user', 'team'
  ],
  actions: [
    'action item', 'action items', 'todo', 'to do', 'follow up', 'follow-up',
    'next steps', 'assigned to', 'responsible', 'owner'
  ]
};

// Noise detection patterns - emails that are spam/auto-generated/not useful
export const NOISE_PATTERNS = {
  // Subject patterns indicating noise
  subjectPatterns: [
    /^(re:|fw:|fwd:)\s*(re:|fw:|fwd:)+/i, // Multiple forwards/replies chains
    /^out of (the )?office/i,
    /^automatic reply/i,
    /^auto(-)?reply/i,
    /^(ooo|oof):/i,
    /unsubscribe/i,
    /newsletter/i,
    /subscription/i,
    /^test\s*(email|message)?$/i,
    /spam/i,
    /\[spam\]/i,
    /delivery (status )?notification/i,
    /undeliverable/i,
    /failed delivery/i,
    /returned mail/i,
    /postmaster/i,
    /mailer(-)?daemon/i,
    /calendar:/i,
    /^accepted:/i,
    /^declined:/i,
    /^tentative:/i,
    /meeting (request|invitation|cancelled|updated)/i,
    /^invitation:/i,
  ],
  // Body patterns indicating noise
  bodyPatterns: [
    /this is an auto(-)?generated (message|email|reply)/i,
    /do not reply to this (message|email)/i,
    /this mailbox is not monitored/i,
    /i('m| am) (currently )?(out of (the )?office|on vacation|away)/i,
    /i will (be )?return(ing)? on/i,
    /click here to unsubscribe/i,
    /to unsubscribe from this/i,
    /you are receiving this (email|message) because/i,
    /this email was sent to/i,
    /view this email in your browser/i,
    /trouble viewing this email/i,
    /add .+ to your address book/i,
  ],
  // Sender patterns indicating noise
  senderPatterns: [
    /no(-)?reply@/i,
    /noreply@/i,
    /do(-)?not(-)?reply@/i,
    /mailer(-)?daemon@/i,
    /postmaster@/i,
    /bounce@/i,
    /notification@/i,
    /alert@/i,
    /system@/i,
    /automated@/i,
  ]
};

// ============================================================================
// DATASET LOADER CLASS
// ============================================================================

export class DatasetLoader {
  private static baseUrl = '';

  /**
   * Configure the base URL for dataset files
   */
  static configure(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  /**
   * Load and parse Enron email dataset
   */
  static async loadEnronEmails(options: {
    limit?: number;
    filterByKeywords?: (keyof typeof KEYWORD_FILTERS)[];
    dateRange?: { start: Date; end: Date };
    fromFile?: File;
  } = {}): Promise<EnronEmail[]> {
    const { limit = 1000, filterByKeywords, dateRange, fromFile } = options;
    
    let rawData: any[];

    if (fromFile) {
      // Parse uploaded file
      rawData = await this.parseCSVFile(fromFile);
    } else {
      // Try to load from public folder - require actual data, no demo fallback
      try {
        const response = await fetch(`${this.baseUrl}/datasets/enron/emails_sample.json`);
        if (!response.ok) throw new Error('No Enron dataset found');
        rawData = await response.json();
        if (!rawData || rawData.length === 0) {
          throw new Error('Dataset is empty');
        }
      } catch (error) {
        throw new Error('Enron email dataset not available. Please upload your own email data file (CSV or JSON format).');
      }
    }

    // Detect if data is pre-parsed (from extraction script) or raw CSV
    const isPreParsed = rawData.length > 0 && rawData[0].id && rawData[0].subject && !rawData[0].message;
    
    let emails = rawData.slice(0, limit).map((row, index) => {
      if (isPreParsed) {
        // Data is already in EnronEmail format - add noise detection
        const noiseResult = this.detectNoise({ subject: row.subject || '', body: row.body || '', from: row.from || '' });
        return {
          ...row,
          to: Array.isArray(row.to) ? row.to : [row.to].filter(Boolean),
          cc: Array.isArray(row.cc) ? row.cc : [row.cc].filter(Boolean),
          bcc: Array.isArray(row.bcc) ? row.bcc : [row.bcc].filter(Boolean),
          relevanceScore: 0,
          hasProjectKeywords: KEYWORD_FILTERS.project.some(k => `${row.subject} ${row.body}`.toLowerCase().includes(k)),
          hasDecisionKeywords: KEYWORD_FILTERS.decisions.some(k => `${row.subject} ${row.body}`.toLowerCase().includes(k)),
          hasDeadlineKeywords: KEYWORD_FILTERS.deadlines.some(k => `${row.subject} ${row.body}`.toLowerCase().includes(k)),
          isNoise: noiseResult.isNoise,
          noiseReason: noiseResult.reason,
          classification: 'low-relevance' as EmailClassification,
        } as EnronEmail;
      }
      return this.parseEnronRow(row, index);
    });

    // Apply filters
    if (filterByKeywords && filterByKeywords.length > 0) {
      emails = emails.filter(email => {
        const content = `${email.subject} ${email.body}`.toLowerCase();
        return filterByKeywords.some(category => 
          KEYWORD_FILTERS[category].some(keyword => content.includes(keyword.toLowerCase()))
        );
      });
    }

    if (dateRange) {
      emails = emails.filter(email => {
        const emailDate = new Date(email.date);
        return emailDate >= dateRange.start && emailDate <= dateRange.end;
      });
    }

    // Calculate relevance scores and classification
    emails = emails.map(email => {
      const relevanceScore = this.calculateRelevanceScore(email);
      const updatedEmail = { ...email, relevanceScore };
      return {
        ...updatedEmail,
        classification: this.classifyEmail(updatedEmail)
      };
    });

    // Sort by relevance (noise at the bottom)
    emails.sort((a, b) => {
      // Noise always at the bottom
      if (a.isNoise && !b.isNoise) return 1;
      if (!a.isNoise && b.isNoise) return -1;
      return b.relevanceScore - a.relevanceScore;
    });

    return emails;
  }

  /**
   * Load and parse AMI Meeting Corpus
   */
  static async loadAMIMeetings(options: {
    limit?: number;
    scenario?: string;
    fromFile?: File;
  } = {}): Promise<AMIMeeting[]> {
    const { limit = 100, scenario, fromFile } = options;

    let rawData: any[];

    if (fromFile) {
      const text = await fromFile.text();
      rawData = JSON.parse(text);
    } else {
      try {
        const response = await fetch(`${this.baseUrl}/datasets/ami/meetings_sample.json`);
        if (!response.ok) throw new Error('No AMI dataset found');
        rawData = await response.json();
        if (!rawData || rawData.length === 0) {
          throw new Error('Dataset is empty');
        }
      } catch (error) {
        throw new Error('AMI meeting dataset not available. Please upload your own meeting data file (JSON format).');
      }
    }

    let meetings = rawData.slice(0, limit).map((item, index) => this.parseAMIMeeting(item, index));

    if (scenario) {
      meetings = meetings.filter(m => m.scenario.toLowerCase().includes(scenario.toLowerCase()));
    }

    return meetings;
  }

  /**
   * Load simple meeting transcripts
   */
  static async loadMeetingTranscripts(options: {
    limit?: number;
    fromFile?: File;
  } = {}): Promise<MeetingTranscript[]> {
    const { limit = 50, fromFile } = options;

    let rawData: any[];

    if (fromFile) {
      const text = await fromFile.text();
      rawData = JSON.parse(text);
    } else {
      try {
        const response = await fetch(`${this.baseUrl}/datasets/transcripts/sample.json`);
        if (!response.ok) throw new Error('No transcripts dataset found');
        rawData = await response.json();
        if (!rawData || rawData.length === 0) {
          throw new Error('Dataset is empty');
        }
      } catch (error) {
        throw new Error('Meeting transcripts dataset not available. Please upload your own transcript data file (JSON format).');
      }
    }

    return rawData.slice(0, limit).map((item, index) => ({
      id: `transcript_${index}`,
      title: item.title || `Meeting ${index + 1}`,
      date: item.date || new Date().toISOString(),
      participants: item.participants || [],
      transcript: item.transcript || item.text || '',
      duration: item.duration
    }));
  }

  /**
   * Generate synthetic Slack messages from Enron emails
   * (As recommended for multi-channel simulation)
   */
  static async generateSyntheticSlackFromEnron(
    emails: EnronEmail[],
    options: { channelName?: string; limit?: number } = {}
  ): Promise<ParsedSource[]> {
    const { channelName = '#project-requirements', limit = 100 } = options;
    
    return emails.slice(0, limit).map((email, index) => {
      // Convert email to Slack-like message
      const username = email.from.split('@')[0].replace(/[._]/g, ' ');
      const shortBody = email.body.split('\n').slice(0, 3).join(' ').slice(0, 500);
      
      return {
        id: `slack_${email.id}`,
        type: 'chat' as const,
        dataset: 'enron_synthetic',
        title: `${username} in ${channelName}`,
        content: shortBody,
        metadata: {
          channel: channelName,
          originalEmail: email.id,
          username,
          timestamp: email.date
        },
        relevanceScore: email.relevanceScore,
        timestamp: email.date
      };
    });
  }

  /**
   * Convert all loaded data to unified ParsedSource format
   */
  static convertToUnifiedFormat(
    emails: EnronEmail[] = [],
    meetings: AMIMeeting[] = [],
    transcripts: MeetingTranscript[] = []
  ): ParsedSource[] {
    const sources: ParsedSource[] = [];

    // Convert emails
    emails.forEach(email => {
      sources.push({
        id: `email_${email.id}`,
        type: 'email',
        dataset: 'enron',
        title: email.subject,
        content: email.body,
        metadata: {
          from: email.from,
          to: email.to,
          cc: email.cc,
          date: email.date,
          hasProjectKeywords: email.hasProjectKeywords,
          hasDecisionKeywords: email.hasDecisionKeywords
        },
        relevanceScore: email.relevanceScore,
        timestamp: email.date
      });
    });

    // Convert AMI meetings
    meetings.forEach(meeting => {
      const fullTranscript = meeting.transcript
        .map(t => `[${t.role}] ${t.text}`)
        .join('\n');
      
      sources.push({
        id: `meeting_${meeting.id}`,
        type: 'meeting',
        dataset: 'ami',
        title: `${meeting.scenario} - Meeting ${meeting.meetingId}`,
        content: fullTranscript,
        metadata: {
          participants: meeting.participants,
          duration: meeting.duration,
          summary: meeting.summary,
          scenario: meeting.scenario
        },
        extractedRequirements: meeting.summary?.extractive,
        relevanceScore: meeting.summary ? 0.9 : 0.7,
        timestamp: new Date().toISOString()
      });
    });

    // Convert simple transcripts
    transcripts.forEach(transcript => {
      sources.push({
        id: `transcript_${transcript.id}`,
        type: 'meeting',
        dataset: 'meetingTranscripts',
        title: transcript.title,
        content: transcript.transcript,
        metadata: {
          participants: transcript.participants,
          date: transcript.date,
          duration: transcript.duration
        },
        relevanceScore: 0.6,
        timestamp: transcript.date
      });
    });

    return sources.sort((a, b) => b.relevanceScore - a.relevanceScore);
  }

  // ============================================================================
  // PRIVATE HELPER METHODS
  // ============================================================================

  private static async parseCSVFile(file: File): Promise<any[]> {
    const text = await file.text();
    const lines = text.split('\n');
    const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
    
    return lines.slice(1).filter(line => line.trim()).map(line => {
      const values = this.parseCSVLine(line);
      const obj: Record<string, string> = {};
      headers.forEach((header, i) => {
        obj[header] = values[i] || '';
      });
      return obj;
    });
  }

  private static parseCSVLine(line: string): string[] {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    result.push(current.trim());
    return result;
  }

  private static parseEnronRow(row: any, index: number): EnronEmail {
    const body = row.message || row.body || row.content || '';
    const subject = this.extractEmailHeader(body, 'Subject') || row.subject || '';
    const from = this.extractEmailHeader(body, 'From') || row.from || '';
    const to = (this.extractEmailHeader(body, 'To') || row.to || '').split(',').map((s: string) => s.trim());
    const cc = (this.extractEmailHeader(body, 'Cc') || row.cc || '').split(',').map((s: string) => s.trim()).filter(Boolean);
    const bcc = (this.extractEmailHeader(body, 'Bcc') || row.bcc || '').split(',').map((s: string) => s.trim()).filter(Boolean);
    const date = this.extractEmailHeader(body, 'Date') || row.date || new Date().toISOString();

    const content = `${subject} ${body}`.toLowerCase();
    const extractedBody = this.extractEmailBody(body);
    
    // Detect noise first
    const noiseResult = this.detectNoise({ subject, body: extractedBody, from });
    
    const email: EnronEmail = {
      id: `enron_${index}`,
      messageId: row.messageId || row['Message-ID'] || `msg_${index}`,
      date,
      from,
      to,
      cc,
      bcc,
      subject,
      body: extractedBody,
      folder: row.folder || row.file || '',
      hasProjectKeywords: KEYWORD_FILTERS.project.some(k => content.includes(k)),
      hasDecisionKeywords: KEYWORD_FILTERS.decisions.some(k => content.includes(k)),
      hasDeadlineKeywords: KEYWORD_FILTERS.deadlines.some(k => content.includes(k)),
      relevanceScore: 0,
      isNoise: noiseResult.isNoise,
      noiseReason: noiseResult.reason,
      classification: 'low-relevance' // Will be updated after relevance score
    };
    
    return email;
  }

  private static extractEmailHeader(content: string, header: string): string {
    const regex = new RegExp(`^${header}:\\s*(.+)$`, 'mi');
    const match = content.match(regex);
    return match ? match[1].trim() : '';
  }

  private static extractEmailBody(content: string): string {
    // Remove headers and get body
    const parts = content.split(/\n\n/);
    return parts.length > 1 ? parts.slice(1).join('\n\n').trim() : content;
  }

  private static parseAMIMeeting(item: any, index: number): AMIMeeting {
    return {
      id: `ami_${index}`,
      meetingId: item.meeting_id || item.id || `meeting_${index}`,
      scenario: item.scenario || 'Product Design',
      duration: item.duration || 'Unknown',
      participants: item.participants || [
        { role: 'Project Manager', speakerId: 'PM' },
        { role: 'Industrial Designer', speakerId: 'ID' },
        { role: 'Interface Designer', speakerId: 'UI' },
        { role: 'Marketing', speakerId: 'MK' }
      ],
      transcript: item.transcript || item.dialogue || [],
      summary: item.summary ? {
        abstractive: item.summary.abstractive || item.summary,
        extractive: item.summary.extractive || [],
        decisions: item.summary.decisions || [],
        actionItems: item.summary.action_items || item.summary.actionItems || []
      } : undefined
    };
  }

  /**
   * Detect if email is noise (spam, auto-generated, etc.)
   */
  private static detectNoise(email: { subject: string; body: string; from: string }): { isNoise: boolean; reason?: string } {
    const subject = email.subject || '';
    const body = email.body || '';
    const from = email.from || '';
    
    // Check subject patterns
    for (const pattern of NOISE_PATTERNS.subjectPatterns) {
      if (pattern.test(subject)) {
        return { isNoise: true, reason: 'Auto-generated or system email' };
      }
    }
    
    // Check sender patterns
    for (const pattern of NOISE_PATTERNS.senderPatterns) {
      if (pattern.test(from)) {
        return { isNoise: true, reason: 'Automated sender' };
      }
    }
    
    // Check body patterns
    for (const pattern of NOISE_PATTERNS.bodyPatterns) {
      if (pattern.test(body)) {
        return { isNoise: true, reason: 'Auto-reply or notification' };
      }
    }
    
    // Check for very short emails with no substance (< 5 words)
    const wordCount = body.split(/\s+/).filter(w => w.length > 0).length;
    if (wordCount < 5 && !subject) {
      return { isNoise: true, reason: 'Empty or minimal content' };
    }
    
    // Check for purely forwarded content with no original message
    if (/^-+\s*forwarded/im.test(body) && body.split(/^-+\s*forwarded/im)[0].trim().length < 20) {
      return { isNoise: true, reason: 'Forward-only with no context' };
    }
    
    return { isNoise: false };
  }

  /**
   * Classify email based on relevance score and noise detection
   */
  private static classifyEmail(email: EnronEmail): EmailClassification {
    if (email.isNoise) return 'noise';
    if (email.relevanceScore >= 0.7) return 'high-relevance';
    if (email.relevanceScore >= 0.4) return 'relevant';
    return 'low-relevance';
  }

  private static calculateRelevanceScore(email: EnronEmail): number {
    // If already marked as noise, score is 0
    if (email.isNoise) return 0;
    
    let score = 0;
    const content = `${email.subject} ${email.body}`.toLowerCase();
    
    // Weight by keyword presence
    if (email.hasProjectKeywords) score += 0.3;
    if (email.hasDecisionKeywords) score += 0.25;
    if (email.hasDeadlineKeywords) score += 0.2;
    
    // Bonus for requirements-specific keywords
    if (KEYWORD_FILTERS.requirements.some(k => content.includes(k))) score += 0.15;
    if (KEYWORD_FILTERS.actions.some(k => content.includes(k))) score += 0.1;
    
    // Penalize very short or very long emails
    const wordCount = email.body.split(/\s+/).length;
    if (wordCount < 20) score -= 0.1;
    if (wordCount > 2000) score -= 0.05;
    
    // Bonus for multiple recipients (likely important)
    if (email.to.length + email.cc.length > 3) score += 0.1;
    
    return Math.max(0, Math.min(1, score));
  }
}

// ============================================================================
// EXPORT UTILITIES
// ============================================================================

export const getDatasetInfo = (datasetId: string): DatasetConfig | undefined => {
  return DATASETS[datasetId];
};

export const getAllDatasets = (): DatasetConfig[] => {
  return Object.values(DATASETS);
};

export const filterEmailsByRelevance = (
  emails: EnronEmail[],
  minScore: number = 0.3
): EnronEmail[] => {
  return emails.filter(e => e.relevanceScore >= minScore);
};

export const extractRequirementsKeywords = (text: string): string[] => {
  const keywords: string[] = [];
  const textLower = text.toLowerCase();
  
  Object.entries(KEYWORD_FILTERS).forEach(([category, words]) => {
    words.forEach(word => {
      if (textLower.includes(word.toLowerCase())) {
        keywords.push(`${category}:${word}`);
      }
    });
  });
  
  return [...new Set(keywords)];
};
