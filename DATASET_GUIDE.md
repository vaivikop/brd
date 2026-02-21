# Real Dataset Integration Guide

This guide explains how to use the real-world business communication datasets integrated into the ClarityAI BRD Agent for robust requirements extraction testing.

## Overview

The system integrates three research-grade datasets:

| Dataset | Type | Records | License | Best For |
|---------|------|---------|---------|----------|
| **Enron Email** | Emails | ~500K | Public Domain | Email channel, noise filtering, stakeholder analysis |
| **AMI Meeting Corpus** | Meeting Transcripts | ~279 | CC BY 4.0 | Meeting channel, decision extraction, ground truth |
| **Meeting Transcripts** | Simple Transcripts | Variable | Check source | Quick prototyping |

---

## Quick Start (Sample Data)

The system includes built-in sample data for immediate testing without downloading full datasets.

### Step 1: Load Sample Data
1. Navigate to **Data Sources** in the app
2. Scroll to **"Research-Grade Datasets"** section
3. Click **"Load Sample"** on any dataset card
4. Sample data will be parsed and added as sources

### Step 2: View Loaded Data
- Loaded emails/meetings appear in **"Active Connections"**
- Stats panel shows counts of loaded and relevant items

### Step 3: Generate Multi-Channel Data
- After loading Enron emails, click **"Generate Slack from Emails"**
- Creates synthetic Slack messages for multi-channel simulation

---

## Full Dataset Setup

For production testing with complete datasets:

### 1. Enron Email Dataset

**Download:**
```
https://www.kaggle.com/datasets/wcukierski/enron-email-dataset
```

**Steps:**
1. Download `emails.csv` (~1.5GB) from Kaggle
2. Create folder: `public/datasets/enron/`
3. Place `emails.csv` in the folder
4. Or use the Upload button (📤) on the Enron card to upload directly

**CSV Format Expected:**
```csv
file,message
maildir/allen-p/inbox/1,"Message-ID: <xxx>
Date: Mon, 1 Oct 2001 09:00:00
From: john@enron.com
To: team@enron.com
Subject: Project Requirements

Body content here..."
```

**Filtering Options:**
The loader automatically:
- Extracts email headers (From, To, CC, Subject, Date)
- Scores emails by relevance (project keywords, decisions, deadlines)
- Filters low-relevance emails (lunch plans, newsletters)
- Analyzes stakeholder hierarchy from To/CC patterns

### 2. AMI Meeting Corpus

**Download Options:**
- HuggingFace: `https://huggingface.co/datasets/knkarthick/AMI`
- Full Corpus: `https://groups.inf.ed.ac.uk/ami/corpus/`

**Steps:**
1. Download meeting transcripts in JSON format
2. Create folder: `public/datasets/ami/`
3. Place `meetings.json` in the folder
4. Or use Upload button directly

**JSON Format Expected:**
```json
[
  {
    "meeting_id": "ES2008a",
    "scenario": "Product Design - Remote Control",
    "duration": "35:20",
    "participants": [
      {"role": "Project Manager", "speakerId": "PM"},
      {"role": "Industrial Designer", "speakerId": "ID"}
    ],
    "transcript": [
      {
        "speaker": "PM",
        "role": "Project Manager",
        "timestamp": "00:00:15",
        "text": "Let's discuss the requirements..."
      }
    ],
    "summary": {
      "abstractive": "The team discussed...",
      "extractive": ["Key point 1", "Key point 2"],
      "decisions": ["Decision 1"],
      "actionItems": ["Action item 1"]
    }
  }
]
```

**Features:**
- Pre-existing summaries serve as ground truth
- Role-based speakers (PM, Designer, Marketing)
- Decisions and action items already extracted
- Perfect for evaluating BRD extraction accuracy

### 3. Meeting Transcripts Dataset (Simpler)

**Download:**
```
https://www.kaggle.com/datasets/abhishekunnam/meeting-transcripts
```

**Use for:** Quick prototyping before scaling to AMI corpus.

---

## API Usage

### Load Datasets Programmatically

```typescript
import { 
  DatasetLoader, 
  DATASETS, 
  filterEmailsByRelevance 
} from './services/datasets';

// Load Enron emails with filters
const emails = await DatasetLoader.loadEnronEmails({
  limit: 1000,
  filterByKeywords: ['requirements', 'decisions', 'deadlines'],
  dateRange: {
    start: new Date('2001-01-01'),
    end: new Date('2001-12-31')
  }
});

// Filter to high-relevance only
const relevantEmails = filterEmailsByRelevance(emails, 0.4);

// Load AMI meetings
const meetings = await DatasetLoader.loadAMIMeetings({
  limit: 50,
  scenario: 'Product Design'
});

// Generate synthetic Slack from emails
const slackMessages = await DatasetLoader.generateSyntheticSlackFromEnron(
  emails,
  { channelName: '#requirements', limit: 100 }
);

// Convert all to unified format
const unifiedSources = DatasetLoader.convertToUnifiedFormat(
  emails,
  meetings,
  []
);
```

### Relevance Scoring

Emails are scored 0-1 based on:
- **+0.30**: Contains project keywords (project, milestone, deliverable, etc.)
- **+0.25**: Contains decision keywords (decided, approved, confirmed, etc.)
- **+0.20**: Contains deadline keywords (deadline, due date, urgent, etc.)
- **+0.15**: Contains requirements keywords (requirement, feature, spec, etc.)
- **+0.10**: Contains action keywords (action item, follow up, etc.)
- **+0.10**: Multiple recipients (>3 in To/CC)
- **-0.10**: Very short emails (<20 words)

### Keyword Filters

```typescript
import { KEYWORD_FILTERS, extractRequirementsKeywords } from './services/datasets';

// Available categories
console.log(KEYWORD_FILTERS.project);      // ['project', 'initiative', ...]
console.log(KEYWORD_FILTERS.requirements); // ['requirement', 'feature', ...]
console.log(KEYWORD_FILTERS.decisions);    // ['decided', 'approved', ...]
console.log(KEYWORD_FILTERS.deadlines);    // ['deadline', 'due date', ...]
console.log(KEYWORD_FILTERS.stakeholders); // ['stakeholder', 'sponsor', ...]
console.log(KEYWORD_FILTERS.actions);      // ['action item', 'follow up', ...]

// Extract keywords from text
const keywords = extractRequirementsKeywords("The deadline for phase 1 is...");
// Returns: ['deadlines:deadline', 'project:phase']
```

---

## Multi-Channel Testing Strategy

As recommended in the problem statement, combine datasets to simulate multi-channel ingestion:

### Channel Mapping

| Channel | Dataset Source | Simulation Method |
|---------|---------------|-------------------|
| **Email** | Enron Dataset | Direct loading |
| **Meetings** | AMI Corpus | Direct loading |
| **Slack/Chat** | Enron → Synthetic | Generate from emails |

### Recommended Test Workflow

1. **Load Enron emails** (email channel)
   - Filter by project keywords
   - Extract stakeholder hierarchy from CC patterns

2. **Load AMI meetings** (meeting transcript channel)
   - Use summaries as ground truth
   - Extract decisions and action items

3. **Generate synthetic Slack** (chat channel)
   - Convert relevant emails to chat format
   - Simulate rapid-fire informal discussions

4. **Run BRD Agent**
   - Test noise filtering (distinguish project emails from lunch plans)
   - Test requirement extraction across all channels
   - Validate against AMI ground truth summaries

---

## Sample Data Included

The system includes realistic sample data for immediate testing:

### Enron Sample (5 emails)
- Project Falcon kickoff requirements
- Technical feasibility review
- Budget approval with decisions
- Legal compliance requirements
- Final stakeholder sign-off

### AMI Sample (2 meetings)
- Product Design Kickoff: Initial requirements gathering
- Design Review: Decision on product approach

### Meeting Transcripts Sample (2 transcripts)
- Sprint Planning with prioritization
- Architecture Review with technical decisions

---

## Folder Structure

```
public/
  datasets/
    enron/
      emails.csv          # Full dataset (download from Kaggle)
      emails_sample.json  # Sample for quick testing
    ami/
      meetings.json       # Full corpus
      meetings_sample.json
    transcripts/
      transcripts.json
      sample.json
```

---

## License Information

| Dataset | License | Attribution Required |
|---------|---------|---------------------|
| Enron | Public Domain (FERC) | No |
| AMI | CC BY 4.0 | Yes |
| Transcripts | Check Kaggle | Varies |

**AMI Attribution:**
```
The AMI Meeting Corpus is licensed under CC BY 4.0.
https://groups.inf.ed.ac.uk/ami/corpus/
```

---

## Troubleshooting

### "Could not load dataset"
- Check if file exists in `public/datasets/`
- Verify JSON/CSV format matches expected schema
- Try uploading file directly using Upload button

### Low relevance scores
- Adjust `minScore` in `filterEmailsByRelevance()`
- Review keyword dictionaries in `KEYWORD_FILTERS`
- Some emails are intentionally low-relevance (noise testing)

### Large file performance
- Use `limit` parameter to load subset first
- Process in batches for datasets >100K records
- Consider server-side processing for production

---

## Next Steps

1. Download full Enron dataset from Kaggle
2. Download AMI corpus from HuggingFace
3. Test BRD extraction on real data
4. Compare output against AMI ground truth summaries
5. Tune relevance scoring for your use case
