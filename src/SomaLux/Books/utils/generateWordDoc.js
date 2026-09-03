import { Document, Packer, Paragraph, TextRun, HeadingLevel, Table, TableCell, TableRow, WidthType, BorderStyle, UnderlineType } from 'docx';
import { saveAs } from 'file-saver';
import { generateSummary } from './summarizeText';

/**
 * Generate a Word document with summaries of multiple pages
 * @param {object} pageTextMap - Map of page numbers to text content
 * @param {array} pageNumbers - Array of page numbers to include
 * @param {string} bookTitle - Title of the book
 * @returns {Promise<void>}
 */
export const generateSummaryDocument = async (pageTextMap, pageNumbers, bookTitle) => {
  if (!pageNumbers || pageNumbers.length === 0) {
    alert('No pages to generate summary for');
    return;
  }

  try {
    const sections = [];

    // Title section
    sections.push(
      new Paragraph({
        text: `${bookTitle} - Summary`,
        heading: HeadingLevel.HEADING_1,
        thematicBreak: false,
        spacing: { after: 200 },
        bold: true,
        size: 32,
      })
    );

    // Metadata
    sections.push(
      new Paragraph({
        text: `Generated on: ${new Date().toLocaleDateString()} at ${new Date().toLocaleTimeString()}`,
        italics: true,
        color: '666666',
        spacing: { after: 400 },
        size: 20,
      })
    );

    sections.push(
      new Paragraph({
        text: `Total Bookmarked Pages: ${pageNumbers.length}`,
        italics: true,
        color: '666666',
        spacing: { after: 600 },
        size: 20,
      })
    );

    // Add summary for each page
    pageNumbers.forEach((pageNum, idx) => {
      const pageData = pageTextMap[pageNum];
      if (!pageData || !pageData.text) return;

      // Page heading
      sections.push(
        new Paragraph({
          text: `Page ${pageNum}`,
          heading: HeadingLevel.HEADING_2,
          spacing: { before: 400, after: 200 },
          bold: true,
          size: 24,
        })
      );

      // Page summary
      const summary = generateSummary(pageData.text, 5);
      sections.push(
        new Paragraph({
          text: summary,
          spacing: { after: 400 },
          alignment: 'justified',
          size: 22,
        })
      );

      // Page break (except for last page)
      if (idx < pageNumbers.length - 1) {
        sections.push(
          new Paragraph({
            text: '',
            pageBreakBefore: true,
          })
        );
      }
    });

    // Create document
    const doc = new Document({
      sections: [{ children: sections }],
    });

    // Generate and save
    const blob = await Packer.toBlob(doc);
    saveAs(blob, `${bookTitle}-summaries.docx`);
  } catch (error) {
    console.error('Error generating Word document:', error);
    alert('Failed to generate summary document');
  }
};
