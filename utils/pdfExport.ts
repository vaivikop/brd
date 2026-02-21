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
      { label: 'SECTIONS', value: `${brd.sections.length} sections` }
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
  pdf.text('Generated by ClarityAI', margin, pageHeight - 15);
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
    const infoText = `Confidence: ${section.confidence}% • Sources: ${section.sources.length}`;
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
