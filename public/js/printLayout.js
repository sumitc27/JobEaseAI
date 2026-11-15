// Use the same canvas size as the preview. Margins belong to the resume paper,
// not to a second browser-print margin outside that paper.
export function printPageStyle(size) {
  const letter = size === 'letter';
  const width = letter ? '8.5in' : '210mm';
  const height = letter ? '11in' : '297mm';
  return `@media print {
    @page { size: ${letter ? 'letter' : 'a4'} portrait; margin: 0; }
    :root { --print-paper-width: ${width}; --print-paper-height: ${height}; }
  }`;
}
