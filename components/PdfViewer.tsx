"use client";

import { useEffect, useRef } from "react";
import { jsPDF } from "jspdf";

interface PdfViewerProps {
  pdfUrl: string;
  width?: number;
  height?: number;
}

export default function PdfViewer({ pdfUrl, width = 400, height = 500 }: PdfViewerProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    if (!pdfUrl || !iframeRef.current) return;

    iframeRef.current.src = pdfUrl;
  }, [pdfUrl]);

  return (
    <div>
      <iframe
        ref={iframeRef}
        src={pdfUrl}
        width={width}
        height={height}
        style={{ border: "1px solid #ccc" }}
      ></iframe>
    </div>
  );
}
