/**
 * Extract relevant emails from Enron CSV dataset
 * 
 * Usage: node scripts/extract-enron-sample.js <path-to-emails.csv>
 * 
 * Example: node scripts/extract-enron-sample.js "C:\Users\Vaivik\Downloads\emails.csv"
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');

// Keywords that indicate project-relevant content
const PROJECT_KEYWORDS = [
  'project', 'requirement', 'requirements', 'deadline', 'milestone',
  'deliverable', 'scope', 'budget', 'approval', 'approve', 'approved',
  'decision', 'decided', 'meeting', 'action item', 'follow up',
  'stakeholder', 'schedule', 'timeline', 'phase', 'launch',
  'specification', 'feature', 'priority', 'urgent', 'review',
  'agreement', 'contract', 'proposal', 'implementation', 'design'
];

// How many emails to extract
const LIMIT = 500;

async function extractEmails(csvPath) {
  console.log(`\n📧 Enron Email Extractor`);
  console.log(`========================\n`);
  console.log(`Reading: ${csvPath}`);
  
  if (!fs.existsSync(csvPath)) {
    console.error(`❌ File not found: ${csvPath}`);
    process.exit(1);
  }

  const fileStream = fs.createReadStream(csvPath, { encoding: 'utf8' });
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity
  });

  const emails = [];
  let lineNumber = 0;
  let currentEmail = '';
  let inQuotes = false;
  let headers = [];
  let relevantCount = 0;
  let totalProcessed = 0;

  console.log(`Scanning for project-relevant emails...\n`);

  for await (const line of rl) {
    lineNumber++;
    
    // First line is headers
    if (lineNumber === 1) {
      headers = parseCSVLine(line);
      console.log(`Found columns: ${headers.join(', ')}`);
      continue;
    }

    // Handle multi-line messages (quoted fields)
    if (currentEmail === '') {
      currentEmail = line;
    } else {
      currentEmail += '\n' + line;
    }

    // Count quotes to determine if we're still in a quoted field
    const quoteCount = (currentEmail.match(/"/g) || []).length;
    inQuotes = quoteCount % 2 !== 0;

    if (!inQuotes) {
      // Complete email found
      totalProcessed++;
      
      const values = parseCSVLine(currentEmail);
      const emailObj = {};
      headers.forEach((h, i) => {
        emailObj[h] = values[i] || '';
      });

      // Check relevance
      const content = (emailObj.message || emailObj.body || '').toLowerCase();
      const isRelevant = PROJECT_KEYWORDS.some(kw => content.includes(kw));
      
      if (isRelevant && emails.length < LIMIT) {
        const parsed = parseEnronEmail(emailObj, emails.length);
        if (parsed.subject && parsed.body.length > 50) {
          emails.push(parsed);
          relevantCount++;
          
          if (relevantCount % 50 === 0) {
            console.log(`  Found ${relevantCount} relevant emails (scanned ${totalProcessed})...`);
          }
        }
      }

      currentEmail = '';

      // Stop if we have enough
      if (emails.length >= LIMIT) {
        console.log(`\n✅ Reached target of ${LIMIT} emails`);
        break;
      }

      // Progress update every 10k emails
      if (totalProcessed % 10000 === 0) {
        console.log(`  Scanned ${totalProcessed} emails, found ${relevantCount} relevant...`);
      }
    }
  }

  console.log(`\n📊 Results:`);
  console.log(`   Total scanned: ${totalProcessed}`);
  console.log(`   Relevant found: ${emails.length}`);

  // Save to JSON
  const outputDir = path.join(__dirname, '..', 'public', 'datasets', 'enron');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const outputPath = path.join(outputDir, 'emails_sample.json');
  fs.writeFileSync(outputPath, JSON.stringify(emails, null, 2));
  
  console.log(`\n💾 Saved to: ${outputPath}`);
  console.log(`\n🎉 Done! You can now use the real data in the app.`);
  console.log(`   Go to Data Sources → Load Sample on Enron card\n`);

  return emails;
}

function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
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

function parseEnronEmail(row, index) {
  const body = row.message || row.body || row.content || '';
  
  return {
    id: `enron_${index}`,
    messageId: extractHeader(body, 'Message-ID') || `msg_${index}`,
    date: extractHeader(body, 'Date') || new Date().toISOString(),
    from: extractHeader(body, 'From') || '',
    to: (extractHeader(body, 'To') || '').split(',').map(s => s.trim()).filter(Boolean),
    cc: (extractHeader(body, 'Cc') || extractHeader(body, 'CC') || '').split(',').map(s => s.trim()).filter(Boolean),
    bcc: (extractHeader(body, 'Bcc') || extractHeader(body, 'BCC') || '').split(',').map(s => s.trim()).filter(Boolean),
    subject: extractHeader(body, 'Subject') || '',
    body: extractBody(body),
    folder: row.file || ''
  };
}

function extractHeader(content, header) {
  const regex = new RegExp(`^${header}:\\s*(.+)$`, 'mi');
  const match = content.match(regex);
  return match ? match[1].trim() : '';
}

function extractBody(content) {
  // Split on double newline to separate headers from body
  const parts = content.split(/\n\n/);
  return parts.length > 1 ? parts.slice(1).join('\n\n').trim() : content;
}

// Run the extractor
const csvPath = process.argv[2];

if (!csvPath) {
  console.log(`
📧 Enron Email Extractor
========================

Usage: node scripts/extract-enron-sample.js <path-to-emails.csv>

Example:
  node scripts/extract-enron-sample.js "C:\\Users\\Vaivik\\Downloads\\emails.csv"

This will extract ${LIMIT} project-relevant emails and save them to:
  public/datasets/enron/emails_sample.json
`);
  process.exit(0);
}

extractEmails(csvPath).catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
