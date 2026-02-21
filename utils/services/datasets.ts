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
    recordCount: '~500,000 emails',
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
    recordCount: '~279 meetings',
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
      // Try to load from public folder
      try {
        const response = await fetch(`${this.baseUrl}/datasets/enron/emails_sample.json`);
        if (!response.ok) throw new Error('Sample not found');
        rawData = await response.json();
      } catch {
        // Return sample data for demo
        rawData = this.getEnronSampleData();
      }
    }

    // Detect if data is pre-parsed (from extraction script) or raw CSV
    const isPreParsed = rawData.length > 0 && rawData[0].id && rawData[0].subject && !rawData[0].message;
    
    let emails = rawData.slice(0, limit).map((row, index) => {
      if (isPreParsed) {
        // Data is already in EnronEmail format
        return {
          ...row,
          to: Array.isArray(row.to) ? row.to : [row.to].filter(Boolean),
          cc: Array.isArray(row.cc) ? row.cc : [row.cc].filter(Boolean),
          bcc: Array.isArray(row.bcc) ? row.bcc : [row.bcc].filter(Boolean),
          relevanceScore: 0,
          hasProjectKeywords: KEYWORD_FILTERS.project.some(k => `${row.subject} ${row.body}`.toLowerCase().includes(k)),
          hasDecisionKeywords: KEYWORD_FILTERS.decisions.some(k => `${row.subject} ${row.body}`.toLowerCase().includes(k)),
          hasDeadlineKeywords: KEYWORD_FILTERS.deadlines.some(k => `${row.subject} ${row.body}`.toLowerCase().includes(k)),
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

    // Calculate relevance scores
    emails = emails.map(email => ({
      ...email,
      relevanceScore: this.calculateRelevanceScore(email)
    }));

    // Sort by relevance
    emails.sort((a, b) => b.relevanceScore - a.relevanceScore);

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
        if (!response.ok) throw new Error('Sample not found');
        rawData = await response.json();
      } catch {
        rawData = this.getAMISampleData();
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
        if (!response.ok) throw new Error('Sample not found');
        rawData = await response.json();
      } catch {
        rawData = this.getMeetingTranscriptsSampleData();
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
    
    return {
      id: `enron_${index}`,
      messageId: row.messageId || row['Message-ID'] || `msg_${index}`,
      date,
      from,
      to,
      cc,
      bcc,
      subject,
      body: this.extractEmailBody(body),
      folder: row.folder || row.file || '',
      hasProjectKeywords: KEYWORD_FILTERS.project.some(k => content.includes(k)),
      hasDecisionKeywords: KEYWORD_FILTERS.decisions.some(k => content.includes(k)),
      hasDeadlineKeywords: KEYWORD_FILTERS.deadlines.some(k => content.includes(k)),
      relevanceScore: 0
    };
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

  private static calculateRelevanceScore(email: EnronEmail): number {
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

  // ============================================================================
  // SAMPLE DATA FOR DEMO/TESTING
  // ============================================================================

  private static getEnronSampleData(): any[] {
    return [
      {
        message: `Message-ID: <001@enron.com>
Date: Mon, 15 Oct 2001 09:30:00 -0700
From: john.smith@enron.com
To: team@enron.com, stakeholders@enron.com
Cc: management@enron.com
Subject: Project Falcon - Requirements Review Meeting

Team,

Following our kickoff meeting last week, I wanted to summarize the key requirements we've identified:

1. FUNCTIONAL REQUIREMENTS:
   - System must handle 10,000 concurrent users
   - Real-time data synchronization across all regions
   - Integration with existing SAP and Oracle systems
   - Mobile access for field operations team

2. NON-FUNCTIONAL REQUIREMENTS:
   - 99.9% uptime SLA
   - Response time under 2 seconds for all queries
   - SOX compliance for all financial modules

3. TIMELINE:
   - Phase 1 completion: December 15, 2001
   - UAT begins: January 5, 2002
   - Go-live target: February 1, 2002

Please review and confirm these requirements by EOD Wednesday. We need stakeholder approval before proceeding to design phase.

Action Items:
- Sarah: Validate technical feasibility with IT
- Mike: Get budget approval from finance
- Lisa: Schedule follow-up with legal for compliance review

Best regards,
John Smith
Project Manager`
      },
      {
        message: `Message-ID: <002@enron.com>
Date: Tue, 16 Oct 2001 14:15:00 -0700
From: sarah.jones@enron.com
To: john.smith@enron.com
Cc: team@enron.com
Subject: RE: Project Falcon - Requirements Review Meeting

John,

I've reviewed the requirements with the IT team. Here are our findings:

APPROVED:
- 10,000 concurrent users is achievable with our current infrastructure
- SAP integration is straightforward using existing APIs

CONCERNS:
- Oracle integration will require custom middleware - estimated 3 weeks additional development
- Real-time sync may need to be "near real-time" (30-second refresh) due to network latency constraints

DECISION NEEDED:
Should we proceed with near real-time sync or invest in dedicated fiber connection? The fiber option adds $150K to budget but ensures true real-time capability.

Recommending we discuss this in tomorrow's standup.

Sarah
Technical Lead`
      },
      {
        message: `Message-ID: <003@enron.com>
Date: Wed, 17 Oct 2001 10:00:00 -0700
From: mike.wilson@enron.com
To: john.smith@enron.com, sarah.jones@enron.com
Cc: finance@enron.com
Subject: RE: Project Falcon - Budget Approval

Team,

Finance has approved the Project Falcon budget with the following conditions:

APPROVED BUDGET: $2.4M
- Development: $1.2M
- Infrastructure: $600K
- Contingency: $300K
- Training & Documentation: $300K

DECISION: We're approving the fiber connection option that Sarah mentioned. The $150K is covered under contingency.

DEADLINE: All procurement requests must be submitted by October 25th to ensure December delivery timeline.

One requirement change from executive sponsor:
- Adding requirement for executive dashboard with KPI visualization
- This is P1 priority for CEO visibility

Please update the requirements document and circulate for final sign-off.

Mike Wilson
Finance Director`
      },
      {
        message: `Message-ID: <004@enron.com>
Date: Thu, 18 Oct 2001 16:45:00 -0700
From: lisa.chen@enron.com
To: project-falcon@enron.com
Subject: Legal Review Complete - Compliance Requirements Added

All,

Legal has completed review. Adding the following compliance requirements:

MANDATORY REQUIREMENTS:
1. All user actions must be logged with timestamp and user ID
2. Data retention policy: 7 years for financial records
3. User access must be role-based with quarterly access reviews
4. Encryption required for data at rest and in transit (AES-256 minimum)

STAKEHOLDER APPROVAL NEEDED:
- These requirements may impact the timeline
- Audit logging could affect performance - need Sarah's assessment
- Recommend adding 2 weeks to Phase 1 for compliance testing

Decision meeting scheduled for Friday 10 AM. Please confirm attendance.

Lisa Chen
Legal Counsel`
      },
      {
        message: `Message-ID: <005@enron.com>
Date: Fri, 19 Oct 2001 11:30:00 -0700
From: john.smith@enron.com
To: project-falcon@enron.com, executives@enron.com
Subject: Project Falcon - Final Requirements Sign-off

Team and Stakeholders,

Following today's meeting, I'm pleased to confirm the following decisions:

APPROVED CHANGES:
✓ Real-time sync via dedicated fiber connection - APPROVED
✓ Executive KPI dashboard - ADDED to scope
✓ Full compliance requirements per legal - ACCEPTED
✓ Timeline extended by 2 weeks - APPROVED

FINAL TIMELINE:
- Phase 1: December 31, 2001
- UAT: January 15, 2002
- Go-live: February 15, 2002

BUDGET: $2.55M (final)

All stakeholders have signed off. Requirements document v2.0 is attached and locked.

Next milestone: Design review - November 1, 2001

Thank you all for your collaboration.

Best,
John Smith
Project Manager, Project Falcon`
      }
    ];
  }

  private static getAMISampleData(): any[] {
    return [
      {
        meeting_id: 'ES2008a',
        scenario: 'Product Design - Remote Control Project',
        duration: '35:20',
        participants: [
          { role: 'Project Manager', speakerId: 'PM' },
          { role: 'Industrial Designer', speakerId: 'ID' },
          { role: 'User Interface Designer', speakerId: 'UI' },
          { role: 'Marketing Expert', speakerId: 'ME' }
        ],
        transcript: [
          { speaker: 'PM', role: 'Project Manager', timestamp: '00:00:15', text: "Okay, let's get started with our kickoff meeting for the new remote control project. The goal is to design a remote that's both innovative and user-friendly." },
          { speaker: 'ME', role: 'Marketing Expert', timestamp: '00:01:22', text: "From our market research, users are frustrated with having too many buttons. They want something simple but powerful. Price point should be under twenty-five euros for mass market appeal." },
          { speaker: 'ID', role: 'Industrial Designer', timestamp: '00:02:45', text: "I'm thinking we should explore ergonomic designs. Maybe a curved shape that fits naturally in the hand. We could reduce buttons by using a scroll wheel or touch surface." },
          { speaker: 'UI', role: 'User Interface Designer', timestamp: '00:03:58', text: "For the interface, I'd suggest we prioritize the most-used functions. Channel, volume, and power should be immediately accessible. Everything else can be in a menu." },
          { speaker: 'PM', role: 'Project Manager', timestamp: '00:05:12', text: "Good points. So our requirements are: ergonomic design, simplified button layout, intuitive interface, and manufacturing cost under twelve euros. Does everyone agree?" },
          { speaker: 'ME', role: 'Marketing Expert', timestamp: '00:06:30', text: "Yes, and I'd add that the design should appeal to younger demographics. Maybe we can incorporate customizable colors or interchangeable covers." },
          { speaker: 'ID', role: 'Industrial Designer', timestamp: '00:07:45', text: "The interchangeable cover is feasible. It would also make manufacturing easier since we can produce one base unit with multiple cover options." },
          { speaker: 'PM', role: 'Project Manager', timestamp: '00:09:00', text: "Excellent. Let me document these decisions. Action items: Industrial Designer will create three concept sketches by next meeting. UI Designer will prototype the button layout. Marketing will finalize target demographic profile." }
        ],
        summary: {
          abstractive: "The team held a kickoff meeting for a new remote control project. They established key requirements: ergonomic design, simplified button interface, price point under €25 retail (€12 manufacturing), and appeal to younger demographics. The team decided to explore interchangeable covers for customization. Action items were assigned for concept sketches, UI prototypes, and demographic research.",
          extractive: [
            "Users want something simple but powerful",
            "Price point should be under twenty-five euros",
            "Ergonomic curved shape that fits naturally in the hand",
            "Channel, volume, and power should be immediately accessible",
            "Design should appeal to younger demographics"
          ],
          decisions: [
            "Manufacturing cost target: under €12",
            "Will explore interchangeable cover design",
            "Most-used functions will be prioritized on interface"
          ],
          actionItems: [
            "Industrial Designer: Create three concept sketches",
            "UI Designer: Prototype button layout",
            "Marketing: Finalize target demographic profile"
          ]
        }
      },
      {
        meeting_id: 'ES2008b',
        scenario: 'Product Design - Remote Control - Design Review',
        duration: '28:45',
        participants: [
          { role: 'Project Manager', speakerId: 'PM' },
          { role: 'Industrial Designer', speakerId: 'ID' },
          { role: 'User Interface Designer', speakerId: 'UI' },
          { role: 'Marketing Expert', speakerId: 'ME' }
        ],
        transcript: [
          { speaker: 'PM', role: 'Project Manager', timestamp: '00:00:20', text: "Welcome back everyone. Today we're reviewing the concept designs. Industrial Designer, would you like to present your sketches?" },
          { speaker: 'ID', role: 'Industrial Designer', timestamp: '00:01:15', text: "Sure. I've created three concepts. Option A is a traditional rectangle with rounded edges. Option B is an egg-shaped design that's very ergonomic. Option C is a more futuristic triangular shape." },
          { speaker: 'ME', role: 'Marketing Expert', timestamp: '00:03:40', text: "Option B looks great for comfort, but Option C would really stand out on store shelves. Could we combine elements? Maybe the ergonomics of B with the distinctive look of C?" },
          { speaker: 'UI', role: 'User Interface Designer', timestamp: '00:05:22', text: "For the button layout, I recommend Option B. The curved surface gives us better placement for a central navigation pad. The triangular design limits where we can put buttons." },
          { speaker: 'ID', role: 'Industrial Designer', timestamp: '00:07:00', text: "Combining B and C is possible. We could do an asymmetrical curved design with one pointed end. It would be unique and ergonomic." },
          { speaker: 'PM', role: 'Project Manager', timestamp: '00:08:45', text: "Let's vote. The hybrid design seems to have consensus. Are we all in agreement?" },
          { speaker: 'ME', role: 'Marketing Expert', timestamp: '00:09:30', text: "Agreed. But we need to ensure the manufacturing cost stays within budget. Can we get a cost estimate?" },
          { speaker: 'ID', role: 'Industrial Designer', timestamp: '00:10:15', text: "I'll need to consult with production. Initial estimate is around ten euros for the base unit, leaving room for the interchangeable covers." },
          { speaker: 'PM', role: 'Project Manager', timestamp: '00:11:30', text: "Decision made: We're proceeding with the hybrid design. Next steps: ID will create detailed CAD models, UI will finalize button placement, Marketing will test the design concept with focus groups." }
        ],
        summary: {
          abstractive: "The team reviewed three concept designs for the remote control. After discussion, they decided on a hybrid approach combining the ergonomic qualities of the egg-shaped design with distinctive features of the triangular concept. Manufacturing cost is estimated at €10 for the base unit. Next steps include CAD modeling, button placement finalization, and focus group testing.",
          extractive: [
            "Option B is very ergonomic",
            "Option C would stand out on store shelves",
            "Combining B and C: asymmetrical curved design with one pointed end",
            "Manufacturing cost around ten euros for base unit"
          ],
          decisions: [
            "Proceeding with hybrid design concept",
            "Base unit cost: €10 estimated",
            "Will conduct focus group testing"
          ],
          actionItems: [
            "Industrial Designer: Create detailed CAD models",
            "UI Designer: Finalize button placement",
            "Marketing: Conduct focus group testing"
          ]
        }
      }
    ];
  }

  private static getMeetingTranscriptsSampleData(): any[] {
    return [
      {
        title: "Sprint Planning - Q4 Features",
        date: "2024-10-01T10:00:00Z",
        participants: ["Product Owner", "Scrum Master", "Dev Team Lead", "QA Lead"],
        transcript: `Product Owner: Let's prioritize the Q4 backlog. Our main goals are improving user onboarding and reducing churn.

Scrum Master: We have capacity for about 40 story points this sprint. What are the top priorities?

Product Owner: The new onboarding wizard is P1. Users are dropping off at step 3 of the current flow. We need to simplify it.

Dev Team Lead: That's estimated at 13 points. We can definitely take that on. What about the notification system redesign?

Product Owner: That's P2. If we have capacity, yes. The requirement is to support email, push, and in-app notifications with user preferences.

QA Lead: I'll need 2 days for regression testing on the onboarding flow. Can we get a test environment by Wednesday?

Scrum Master: Noted. Action item for DevOps. Any blockers we should discuss?

Dev Team Lead: We're waiting on the API specs from the backend team. That could delay the notification work.

Product Owner: I'll follow up with them today. Let's commit to the onboarding wizard and tentatively plan for notifications.

Scrum Master: Agreed. Decision: Sprint goal is completing the onboarding wizard with 95% test coverage.`,
        duration: "45:00"
      },
      {
        title: "Architecture Review - Microservices Migration",
        date: "2024-10-05T14:00:00Z",
        participants: ["CTO", "Principal Engineer", "Platform Team Lead", "Security Architect"],
        transcript: `CTO: We need to finalize the architecture for phase 2 of our microservices migration. What's the recommendation?

Principal Engineer: Based on our analysis, we should prioritize the user service and order service. They're the most critical and have the most technical debt.

Platform Team Lead: For infrastructure, I recommend Kubernetes on AWS EKS. It gives us the scalability we need and team expertise exists.

Security Architect: Key requirement: all service-to-service communication must use mTLS. Zero trust architecture is non-negotiable.

CTO: Understood. What's the timeline looking like?

Principal Engineer: Realistic estimate is 6 months for both services with proper testing. We could do user service in 3 months if we focus there first.

Platform Team Lead: We need to migrate the database first. That's a prerequisite. Estimated 4 weeks for PostgreSQL migration from Oracle.

CTO: Decision: Let's phase this. Month 1: Database migration. Months 2-4: User service. Months 5-6: Order service.

Security Architect: I'll need to conduct security review at each phase gate. Non-negotiable requirement before production deployment.

CTO: Agreed. Document these requirements and circulate for stakeholder approval by end of week.`,
        duration: "60:00"
      }
    ];
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
