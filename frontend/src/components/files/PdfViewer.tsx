interface PdfViewerProps {
  url: string;
}

/**
 * Renders the PDF using the browser's built-in PDF viewer via iframe.
 * This gives native pinch-to-zoom, continuous scroll, search, and page navigation.
 */
export function PdfViewer({ url }: PdfViewerProps) {
  return (
    <div className="pdf-viewer">
      <iframe
        src={url}
        className="pdf-iframe"
        title="PDF viewer"
      />
    </div>
  );
}
