/**
 * Minimal markdown-to-HTML converter for legal documents.
 * Handles: headings, bold, links, unordered lists, paragraphs.
 *
 * The output is sanitized: all HTML tags not produced by this converter are
 * escaped, and link hrefs are restricted to http(s) protocols.
 */
export function markdownToHtml(md: string): string {
  // First, escape any raw HTML to prevent XSS
  const escaped = md
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

  return escaped
    .replace(/^### (.+)$/gm, "<h3>$1</h3>")
    .replace(/^## (.+)$/gm, "<h2>$1</h2>")
    .replace(/^# (.+)$/gm, "<h1>$1</h1>")
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(
      /\[(.+?)\]\((.+?)\)/g,
      (_match, text, href) => {
        // Only allow http(s) and relative URLs
        if (/^(https?:\/\/|\/[^/])/.test(href)) {
          return `<a href="${href}" target="_blank" rel="noopener">${text}</a>`;
        }
        return text;
      },
    )
    .replace(/^- (.+)$/gm, "<li>$1</li>")
    .replace(/(<li>.*<\/li>\n?)+/g, (match) => `<ul>${match}</ul>`)
    .replace(/\n{2,}/g, "</p><p>")
    .replace(/^(?!<[hulo])/gm, (line) => (line.trim() ? `<p>${line}` : ""))
    .replace(/<p><(h[1-3]|ul|li|ol)/g, "<$1");
}
