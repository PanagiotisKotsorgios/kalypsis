/** Print the PDF document, never the surrounding dashboard. Some PDF viewers
 * isolate their frame; fall back to the browser's native PDF print toolbar. */
export function printGuidePdf(frame: { contentWindow: { focus(): void; print(): void } | null } | null, openPdf: () => void): boolean {
  try {
    if (!frame?.contentWindow) throw new Error("PDF viewer is not ready");
    frame.contentWindow.focus();
    frame.contentWindow.print();
    return true;
  } catch {
    openPdf();
    return false;
  }
}
