/**
 * Minimal markdown-to-HTML converter for legal documents.
 * Handles: headings, bold, inline code, links, unordered lists,
 * GFM-style pipe tables, paragraphs.
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
    .replace(/`([^`\n]+)`/g, "<code>$1</code>")
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
    // GFM-style pipe tables: header row, separator row (---), body rows.
    // Must run before the paragraph wrap so the `|` lines aren't wrapped in <p>.
    // Body rows are captured with leading `\n` so the trailing newline after
    // the last row is left for the paragraph-split step.
    .replace(
      /^(\|[^\n]+\|)\n(\|[\s\-:|]+\|)((?:\n\|[^\n]+\|)+)/gm,
      (_match, headerLine: string, _sep: string, bodyBlock: string) => {
        const header = splitRow(headerLine);
        const rows = bodyBlock
          .split("\n")
          .filter((l) => l.trim())
          .map(splitRow);
        const thead =
          "<thead><tr>" +
          header.map((c) => `<th>${c}</th>`).join("") +
          "</tr></thead>";
        const tbody = rows.length
          ? "<tbody>" +
            rows
              .map(
                (cells) =>
                  "<tr>" +
                  cells.map((c) => `<td>${c}</td>`).join("") +
                  "</tr>",
              )
              .join("") +
            "</tbody>"
          : "";
        return `<table>${thead}${tbody}</table>`;
      },
    )
    .replace(/^- (.+)$/gm, "<li>$1</li>")
    .replace(/(<li>.*<\/li>\n?)+/g, (match) => `<ul>${match}</ul>`)
    .replace(/\n{2,}/g, "</p><p>")
    .replace(/^(?!<[hulot])/gm, (line) => (line.trim() ? `<p>${line}` : ""))
    .replace(/<p><(h[1-3]|ul|li|ol|table)/g, "<$1");
}

function splitRow(line: string): string[] {
  return line
    .replace(/^\s*\|/, "")
    .replace(/\|\s*$/, "")
    .split("|")
    .map((c) => c.trim());
}
