import jsPDF from 'jspdf';
import { BRDSection, ProjectState } from './db';

interface ExportOptions {
  project: ProjectState;
  includeMetadata?: boolean;
  includeTOC?: boolean;
}

// Helper to strip markdown formatting for clean text
function stripMarkdown(text: string): string {
  return text
    // Remove headers
    .replace(/^#{1,6}\s+/gm, '')
    // Remove bold/italic
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/__([^_]+)__/g, '$1')
    .replace(/_([^_]+)_/g, '$1')
    // Remove inline code
    .replace(/`([^`]+)`/g, '$1')
    // Remove links but keep text
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    // Remove images
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, '')
    // Clean up extra whitespace
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

// Parse markdown to structured blocks for better rendering
interface TextBlock {
  type: 'heading' | 'paragraph' | 'list-item' | 'code';
  content: string;
  level?: number; // For headings/list items
}

function parseMarkdownToBlocks(markdown: string): TextBlock[] {
  const lines = markdown.split('\n');
  const blocks: TextBlock[] = [];
  let currentParagraph: string[] = [];

  const flushParagraph = () => {
    if (currentParagraph.length > 0) {
      const text = currentParagraph.join(' ').trim();
      if (text) {
        blocks.push({ type: 'paragraph', content: stripMarkdown(text) });
      }
      currentParagraph = [];
    }
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmedLine = line.trim();

    // Empty line - flush paragraph
    if (!trimmedLine) {
      flushParagraph();
      continue;
    }

    // Heading
    const headingMatch = trimmedLine.match(/^(#{1,6})\s+(.+)$/);
    if (headingMatch) {
      flushParagraph();
      blocks.push({
        type: 'heading',
        content: stripMarkdown(headingMatch[2]),
        level: headingMatch[1].length
      });
      continue;
    }

    // List item (bullet or numbered)
    const listMatch = trimmedLine.match(/^[-*+]|\d+\.\s+(.+)$/);
    if (listMatch || trimmedLine.match(/^[-*+]\s+/)) {
      flushParagraph();
      const content = trimmedLine.replace(/^[-*+]\s+/, '').replace(/^\d+\.\s+/, '');
      blocks.push({
        type: 'list-item',
        content: stripMarkdown(content),
        level: 1
      });
      continue;
    }

    // Code block markers (skip them)
    if (trimmedLine.startsWith('```')) {
      flushParagraph();
      continue;
    }

    // Regular text - add to paragraph
    currentParagraph.push(trimmedLine);
  }

  flushParagraph();
  return blocks;
}

/**
 * Export BRD to PDF with professional formatting
 */
export async function exportBRDToPDF(options: ExportOptions): Promise<void> {
  const { project, includeMetadata = true, includeTOC = true } = options;
  const brd = project.brd;

  if (!brd || !brd.sections || brd.sections.length === 0) {
    throw new Error('No BRD content available to export');
  }

  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 20;
  const contentWidth = pageWidth - margin * 2;
  let currentY = margin;

  // Colors
  const colors = {
    primary: [30, 64, 175] as [number, number, number],     // Blue-700
    secondary: [71, 85, 105] as [number, number, number],   // Slate-500
    text: [15, 23, 42] as [number, number, number],         // Slate-900
    lightText: [100, 116, 139] as [number, number, number], // Slate-500
    accent: [16, 185, 129] as [number, number, number]      // Emerald-500
  };

  // Helper function to add a new page if needed
  const checkPageBreak = (neededSpace: number): void => {
    if (currentY + neededSpace > pageHeight - margin) {
      pdf.addPage();
      currentY = margin;
    }
  };

  // Helper function to add text with word wrap
  const addWrappedText = (
    text: string,
    fontSize: number,
    color: [number, number, number],
    lineHeight: number = 1.4,
    isBold: boolean = false
  ): void => {
    pdf.setFontSize(fontSize);
    pdf.setTextColor(...color);
    pdf.setFont('helvetica', isBold ? 'bold' : 'normal');
    
    const lines = pdf.splitTextToSize(text, contentWidth);
    const lineSpacing = fontSize * lineHeight * 0.352778; // Convert pt to mm
    
    for (const line of lines) {
      checkPageBreak(lineSpacing + 2);
      pdf.text(line, margin, currentY);
      currentY += lineSpacing;
    }
  };

  // ============== COVER PAGE ==============
  // Title background accent
  pdf.setFillColor(240, 245, 255); // Very light blue
  pdf.rect(0, 0, pageWidth, 80, 'F');
  
  // Decorative line
  pdf.setFillColor(...colors.primary);
  pdf.rect(margin, 65, 40, 2, 'F');

  // Main title
  currentY = 35;
  pdf.setFontSize(28);
  pdf.setFont('helvetica', 'bold');
  pdf.setTextColor(...colors.text);
  pdf.text('Business Requirements', margin, currentY);
  currentY += 12;
  pdf.text('Document', margin, currentY);

  // Project name
  currentY = 85;
  pdf.setFontSize(18);
  pdf.setFont('helvetica', 'bold');
  pdf.setTextColor(...colors.primary);
  pdf.text(project.name, margin, currentY);

  // Description if available
  if (project.description) {
    currentY += 12;
    pdf.setFontSize(11);
    pdf.setFont('helvetica', 'normal');
    pdf.setTextColor(...colors.secondary);
    const descLines = pdf.splitTextToSize(project.description, contentWidth);
    for (const line of descLines.slice(0, 4)) { // Limit to 4 lines
      pdf.text(line, margin, currentY);
      currentY += 5;
    }
  }

  // Metadata box
  if (includeMetadata) {
    currentY = pageHeight - 80;
    
    pdf.setFillColor(248, 250, 252); // Slate-50
    pdf.roundedRect(margin, currentY - 5, contentWidth, 50, 3, 3, 'F');
    
    pdf.setFontSize(9);
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(...colors.lightText);
    
    const metadataItems = [
      { label: 'VERSION', value: `v${brd.version}.0` },
      { label: 'GENERATED', value: new Date(brd.generatedAt).toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
      })},
      { label: 'STATUS', value: project.status },
      { label: 'AUTHOR', value: project.userName || 'ClarityAI User' }
    ];

    const colWidth = contentWidth / 4;
    metadataItems.forEach((item, index) => {
      const x = margin + colWidth * index + 8;
      pdf.setFont('helvetica', 'normal');
      pdf.setTextColor(...colors.lightText);
      pdf.text(item.label, x, currentY + 8);
      pdf.setFont('helvetica', 'bold');
      pdf.setTextColor(...colors.text);
      pdf.text(item.value, x, currentY + 16);
    });
  }

  // Footer on cover page
  pdf.setFontSize(8);
  pdf.setFont('helvetica', 'normal');
  pdf.setTextColor(...colors.lightText);
  const authorText = project.userName ? `Prepared by ${project.userName} • ClarityAI` : 'Generated by ClarityAI';
  pdf.text(authorText, margin, pageHeight - 15);
  pdf.text(`Confidence Score: ${project.overallConfidence || 0}%`, pageWidth - margin - 40, pageHeight - 15);

  // ============== TABLE OF CONTENTS ==============
  if (includeTOC && brd.sections.length > 3) {
    pdf.addPage();
    currentY = margin;

    // TOC Title
    pdf.setFontSize(20);
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(...colors.text);
    pdf.text('Table of Contents', margin, currentY);
    
    currentY += 15;
    pdf.setFillColor(...colors.primary);
    pdf.rect(margin, currentY - 3, 30, 1.5, 'F');
    currentY += 15;

    // TOC entries
    brd.sections.forEach((section, index) => {
      checkPageBreak(12);
      
      const sectionNum = `${index + 1}.`;
      const title = section.title;
      
      pdf.setFontSize(11);
      pdf.setFont('helvetica', 'bold');
      pdf.setTextColor(...colors.primary);
      pdf.text(sectionNum, margin, currentY);
      
      pdf.setFont('helvetica', 'normal');
      pdf.setTextColor(...colors.text);
      pdf.text(title, margin + 12, currentY);
      
      // Confidence indicator
      const confText = `${section.confidence}%`;
      pdf.setFontSize(9);
      pdf.setTextColor(...colors.accent);
      pdf.text(confText, pageWidth - margin - 15, currentY);
      
      currentY += 10;
    });
  }

  // ============== CONTENT PAGES ==============
  brd.sections.forEach((section, sectionIndex) => {
    pdf.addPage();
    currentY = margin;

    // Section header with number
    const sectionNumber = `${sectionIndex + 1}`;
    
    // Number badge
    pdf.setFillColor(...colors.primary);
    pdf.circle(margin + 5, currentY + 2, 5, 'F');
    pdf.setFontSize(10);
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(255, 255, 255);
    pdf.text(sectionNumber, margin + 3.5, currentY + 5);

    // Section title
    pdf.setFontSize(18);
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(...colors.text);
    pdf.text(section.title, margin + 15, currentY + 5);
    
    currentY += 20;

    // Confidence and sources info
    pdf.setFontSize(9);
    pdf.setFont('helvetica', 'normal');
    pdf.setTextColor(...colors.lightText);
    const infoText = `Confidence: ${section.confidence}% • Sources: ${section.sources?.length || 0}`;
    pdf.text(infoText, margin, currentY);
    
    currentY += 15;

    // Divider line
    pdf.setDrawColor(226, 232, 240); // Slate-200
    pdf.setLineWidth(0.3);
    pdf.line(margin, currentY - 5, pageWidth - margin, currentY - 5);

    // Parse and render content
    const blocks = parseMarkdownToBlocks(section.content);

    for (const block of blocks) {
      switch (block.type) {
        case 'heading':
          currentY += 6;
          checkPageBreak(15);
          const headingSize = block.level === 1 ? 14 : block.level === 2 ? 12 : 11;
          addWrappedText(block.content, headingSize, colors.text, 1.3, true);
          currentY += 3;
          break;

        case 'paragraph':
          checkPageBreak(15);
          addWrappedText(block.content, 10, colors.secondary, 1.5);
          currentY += 4;
          break;

        case 'list-item':
          checkPageBreak(10);
          // Bullet point
          pdf.setFillColor(...colors.primary);
          pdf.circle(margin + 2, currentY - 1, 1, 'F');
          
          // Text with indent
          pdf.setFontSize(10);
          pdf.setFont('helvetica', 'normal');
          pdf.setTextColor(...colors.secondary);
          const listLines = pdf.splitTextToSize(block.content, contentWidth - 10);
          for (let i = 0; i < listLines.length; i++) {
            checkPageBreak(6);
            pdf.text(listLines[i], margin + 8, currentY);
            currentY += 5;
          }
          currentY += 2;
          break;

        case 'code':
          checkPageBreak(15);
          pdf.setFillColor(248, 250, 252);
          const codeLines = pdf.splitTextToSize(block.content, contentWidth - 10);
          const codeHeight = codeLines.length * 5 + 8;
          pdf.roundedRect(margin, currentY - 3, contentWidth, codeHeight, 2, 2, 'F');
          pdf.setFontSize(9);
          pdf.setFont('courier', 'normal');
          pdf.setTextColor(...colors.text);
          for (const codeLine of codeLines) {
            pdf.text(codeLine, margin + 5, currentY + 2);
            currentY += 5;
          }
          currentY += 8;
          break;
      }
    }

    // Page footer
    pdf.setFontSize(8);
    pdf.setFont('helvetica', 'normal');
    pdf.setTextColor(...colors.lightText);
    pdf.text(project.name, margin, pageHeight - 10);
    pdf.text(`Page ${pdf.getCurrentPageInfo().pageNumber}`, pageWidth - margin - 15, pageHeight - 10);
  });

  // Save the PDF
  const fileName = `${project.name.replace(/[^a-zA-Z0-9]/g, '_')}_BRD_v${brd.version}.pdf`;
  pdf.save(fileName);
}

/**
 * Quick export with default options
 */
export function quickExportBRD(project: ProjectState): Promise<void> {
  return exportBRDToPDF({ project });
}

/**
 * Export BRD to Word-compatible format (downloads as HTML with Word styling)
 */
export async function exportToWord(project: ProjectState): Promise<void> {
  const brd = project.brd;
  if (!brd || !brd.sections || brd.sections.length === 0) {
    throw new Error('No BRD content available to export');
  }

  // Create Word-compatible HTML
  const wordHTML = `
<!DOCTYPE html>
<html xmlns:o="urn:schemas-microsoft-com:office:office"
      xmlns:w="urn:schemas-microsoft-com:office:word"
      xmlns="http://www.w3.org/TR/REC-html40">
<head>
  <meta charset="utf-8">
  <title>${project.name} - Business Requirements Document</title>
  <!--[if gte mso 9]>
  <xml>
    <w:WordDocument>
      <w:View>Print</w:View>
      <w:Zoom>100</w:Zoom>
    </w:WordDocument>
  </xml>
  <![endif]-->
  <style>
    @page {
      size: letter;
      margin: 1in;
    }
    body {
      font-family: 'Calibri', 'Arial', sans-serif;
      font-size: 11pt;
      line-height: 1.5;
      color: #333;
    }
    h1 {
      font-size: 24pt;
      color: #1e40af;
      border-bottom: 2px solid #1e40af;
      padding-bottom: 8pt;
      margin-top: 24pt;
    }
    h2 {
      font-size: 16pt;
      color: #1e40af;
      margin-top: 18pt;
      margin-bottom: 12pt;
    }
    h3 {
      font-size: 13pt;
      color: #374151;
      margin-top: 12pt;
      margin-bottom: 8pt;
    }
    p {
      margin-bottom: 8pt;
    }
    ul, ol {
      margin-left: 20pt;
      margin-bottom: 12pt;
    }
    li {
      margin-bottom: 4pt;
    }
    table {
      border-collapse: collapse;
      width: 100%;
      margin: 12pt 0;
    }
    th, td {
      border: 1px solid #d1d5db;
      padding: 8pt;
      text-align: left;
    }
    th {
      background-color: #f3f4f6;
      font-weight: bold;
    }
    .cover-page {
      text-align: center;
      page-break-after: always;
    }
    .cover-title {
      font-size: 36pt;
      color: #1e40af;
      margin-top: 200pt;
    }
    .cover-project {
      font-size: 24pt;
      color: #374151;
      margin-top: 24pt;
    }
    .cover-meta {
      font-size: 12pt;
      color: #6b7280;
      margin-top: 48pt;
    }
    .section {
      page-break-inside: avoid;
    }
    .toc {
      page-break-after: always;
    }
    .toc-entry {
      margin: 6pt 0;
    }
    .confidence-badge {
      display: inline-block;
      padding: 2pt 6pt;
      border-radius: 3pt;
      font-size: 9pt;
      background-color: #dbeafe;
      color: #1e40af;
    }
  </style>
</head>
<body>
  <!-- Cover Page -->
  <div class="cover-page">
    <div class="cover-title">Business Requirements Document</div>
    <div class="cover-project">${project.name}</div>
    ${project.description ? `<p style="margin-top: 24pt; font-size: 14pt; color: #6b7280;">${project.description}</p>` : ''}
    <div class="cover-meta">
      <p>Version ${brd.version}.0</p>
      <p>Generated: ${new Date(brd.generatedAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
      <p>Status: ${project.status}</p>
    </div>
  </div>

  <!-- Table of Contents -->
  <div class="toc">
    <h1>Table of Contents</h1>
    ${brd.sections.map((section, index) => `
      <div class="toc-entry">
        <strong>${index + 1}.</strong> ${section.title}
        <span class="confidence-badge">${section.confidence}%</span>
      </div>
    `).join('')}
  </div>

  <!-- Content -->
  ${brd.sections.map((section, index) => `
    <div class="section">
      <h1>${index + 1}. ${section.title}</h1>
      <p style="font-size: 10pt; color: #6b7280;">
        Confidence: ${section.confidence}% | Sources: ${(section.sources || []).join(', ') || 'N/A'}
      </p>
      ${markdownToHTML(section.content)}
    </div>
  `).join('')}

  <!-- Footer -->
  <div style="margin-top: 48pt; border-top: 1px solid #e5e7eb; padding-top: 12pt; font-size: 10pt; color: #9ca3af;">
    <p>${project.userName ? `Prepared by ${project.userName} • ` : ''}Generated by ClarityAI | ${new Date().toLocaleString()}</p>
  </div>
</body>
</html>`;

  // Download as .doc file
  const blob = new Blob([wordHTML], { type: 'application/msword' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${project.name.replace(/[^a-zA-Z0-9]/g, '_')}_BRD_v${brd.version}.doc`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Export BRD to HTML format
 */
export async function exportToHTML(project: ProjectState): Promise<void> {
  const brd = project.brd;
  if (!brd || !brd.sections || brd.sections.length === 0) {
    throw new Error('No BRD content available to export');
  }

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${project.name} - BRD</title>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
      line-height: 1.6;
      color: #1e293b;
      background: #f8fafc;
    }
    .container { max-width: 900px; margin: 0 auto; padding: 40px 20px; }
    .header {
      background: linear-gradient(135deg, #1e40af 0%, #3b82f6 100%);
      color: white;
      padding: 60px 40px;
      border-radius: 24px;
      margin-bottom: 40px;
    }
    .header h1 { font-size: 2.5rem; font-weight: 700; margin-bottom: 8px; }
    .header p { opacity: 0.9; font-size: 1.1rem; }
    .meta { display: flex; gap: 20px; margin-top: 24px; font-size: 0.9rem; }
    .meta span {
      background: rgba(255,255,255,0.2);
      padding: 6px 12px;
      border-radius: 8px;
    }
    .toc {
      background: white;
      border-radius: 16px;
      padding: 24px;
      margin-bottom: 32px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.1);
    }
    .toc h2 {
      font-size: 1rem;
      color: #64748b;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      margin-bottom: 16px;
    }
    .toc a {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 12px 16px;
      color: #334155;
      text-decoration: none;
      border-radius: 8px;
      transition: background 0.2s;
    }
    .toc a:hover { background: #f1f5f9; }
    .toc .confidence {
      font-size: 0.75rem;
      padding: 4px 8px;
      border-radius: 4px;
      font-weight: 600;
    }
    .confidence-high { background: #d1fae5; color: #065f46; }
    .confidence-medium { background: #dbeafe; color: #1e40af; }
    .confidence-low { background: #fef3c7; color: #92400e; }
    .section {
      background: white;
      border-radius: 16px;
      padding: 32px;
      margin-bottom: 24px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.1);
    }
    .section-header {
      display: flex;
      align-items: center;
      gap: 16px;
      margin-bottom: 24px;
      padding-bottom: 16px;
      border-bottom: 1px solid #e2e8f0;
    }
    .section-num {
      width: 40px;
      height: 40px;
      background: #1e40af;
      color: white;
      border-radius: 12px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 700;
    }
    .section h2 { font-size: 1.5rem; font-weight: 700; }
    .section-meta {
      font-size: 0.85rem;
      color: #64748b;
      margin-bottom: 20px;
    }
    .content h3 { font-size: 1.1rem; font-weight: 600; margin: 24px 0 12px; color: #334155; }
    .content p { margin-bottom: 12px; color: #475569; }
    .content ul, .content ol { margin: 12px 0 12px 24px; }
    .content li { margin-bottom: 8px; color: #475569; }
    .content table { width: 100%; border-collapse: collapse; margin: 16px 0; }
    .content th, .content td { padding: 12px; border: 1px solid #e2e8f0; text-align: left; }
    .content th { background: #f8fafc; font-weight: 600; }
    .footer {
      text-align: center;
      padding: 40px;
      color: #94a3b8;
      font-size: 0.9rem;
    }
    @media print {
      body { background: white; }
      .container { max-width: 100%; }
      .section { break-inside: avoid; box-shadow: none; border: 1px solid #e2e8f0; }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>${project.name}</h1>
      <p>Business Requirements Document</p>
      <div class="meta">
        <span>Version ${brd.version}.0</span>
        <span>${new Date(brd.generatedAt).toLocaleDateString()}</span>
        <span>${project.status}</span>
      </div>
    </div>

    <div class="toc">
      <h2>Table of Contents</h2>
      ${brd.sections.map((section, index) => {
        const confClass = section.confidence >= 80 ? 'high' : section.confidence >= 60 ? 'medium' : 'low';
        return `
          <a href="#section-${index + 1}">
            <span><strong>${index + 1}.</strong> ${section.title}</span>
            <span class="confidence confidence-${confClass}">${section.confidence}%</span>
          </a>
        `;
      }).join('')}
    </div>

    ${brd.sections.map((section, index) => `
      <div class="section" id="section-${index + 1}">
        <div class="section-header">
          <div class="section-num">${index + 1}</div>
          <h2>${section.title}</h2>
        </div>
        <div class="section-meta">
          Confidence: ${section.confidence}% • Sources: ${(section.sources || []).join(', ') || 'N/A'}
        </div>
        <div class="content">
          ${markdownToHTML(section.content)}
        </div>
      </div>
    `).join('')}

    <div class="footer">
      <p>${project.userName ? `Prepared by ${project.userName} • ` : ''}Generated by ClarityAI • ${new Date().toLocaleString()}</p>
    </div>
  </div>
</body>
</html>`;

  const blob = new Blob([html], { type: 'text/html' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${project.name.replace(/[^a-zA-Z0-9]/g, '_')}_BRD_v${brd.version}.html`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Export BRD to Confluence wiki markup
 */
export async function exportToConfluence(project: ProjectState): Promise<void> {
  const brd = project.brd;
  if (!brd || !brd.sections || brd.sections.length === 0) {
    throw new Error('No BRD content available to export');
  }

  const confluenceMarkup = `
h1. ${project.name} - Business Requirements Document

{info:title=Document Information}
*Version:* ${brd.version}.0
*Generated:* ${new Date(brd.generatedAt).toLocaleDateString()}
*Status:* ${project.status}
{info}

h2. Table of Contents
{toc:printable=true|style=disc|maxLevel=2|indent=20px|minLevel=1|class=bigpink|exclude=[1//]|type=list|outline=true|include=.*}

----

${brd.sections.map((section, index) => `
h2. ${index + 1}. ${section.title}

{panel:title=Section Metadata|borderStyle=solid|borderColor=#ccc}
*Confidence:* ${section.confidence}%
*Sources:* ${(section.sources || []).join(', ') || 'N/A'}
{panel}

${markdownToConfluence(section.content)}

----
`).join('\n')}

{note:title=${project.userName ? `Prepared by ${project.userName}` : 'Generated by ClarityAI'}}
This document was automatically generated${project.userName ? ` by ${project.userName}` : ''} using ClarityAI. Last updated: ${new Date().toLocaleString()}
{note}
`;

  const blob = new Blob([confluenceMarkup], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${project.name.replace(/[^a-zA-Z0-9]/g, '_')}_BRD_v${brd.version}_confluence.txt`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Convert markdown to basic HTML
 */
function markdownToHTML(markdown: string): string {
  return markdown
    // Headers
    .replace(/^### (.*$)/gim, '<h4>$1</h4>')
    .replace(/^## (.*$)/gim, '<h3>$1</h3>')
    .replace(/^# (.*$)/gim, '<h3>$1</h3>')
    // Bold
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    // Italic
    .replace(/\*([^*]+)\*/g, '<em>$1</em>')
    // Lists
    .replace(/^[\-\*] (.*$)/gim, '<li>$1</li>')
    .replace(/(<li>.*<\/li>\n?)+/g, '<ul>$&</ul>')
    // Numbered lists
    .replace(/^\d+\. (.*$)/gim, '<li>$1</li>')
    // Code
    .replace(/`([^`]+)`/g, '<code style="background:#f1f5f9;padding:2px 6px;border-radius:4px;">$1</code>')
    // Links
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>')
    // Paragraphs
    .replace(/\n\n/g, '</p><p>')
    // Wrap in paragraph
    .replace(/^(.+)$/gm, (match) => {
      if (match.startsWith('<')) return match;
      return `<p>${match}</p>`;
    })
    // Clean up empty paragraphs
    .replace(/<p><\/p>/g, '')
    .replace(/<p>(<[hulo])/g, '$1')
    .replace(/(<\/[hulo][^>]*>)<\/p>/g, '$1');
}

/**
 * Convert markdown to Confluence wiki markup
 */
function markdownToConfluence(markdown: string): string {
  return markdown
    // Headers
    .replace(/^### (.*$)/gim, 'h4. $1')
    .replace(/^## (.*$)/gim, 'h3. $1')
    .replace(/^# (.*$)/gim, 'h3. $1')
    // Bold
    .replace(/\*\*([^*]+)\*\*/g, '*$1*')
    // Italic
    .replace(/\*([^*]+)\*/g, '_$1_')
    // Lists
    .replace(/^[\-\*] (.*$)/gim, '* $1')
    // Numbered lists
    .replace(/^\d+\. (.*$)/gim, '# $1')
    // Code
    .replace(/`([^`]+)`/g, '{{$1}}')
    // Links
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '[$1|$2]')
    // Tables (basic)
    .replace(/\|(.*)\|/g, '||$1||')
    // Line breaks
    .replace(/\n\n/g, '\n\n');
}
