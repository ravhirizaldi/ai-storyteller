/**
 * Safe, minimal inline-markdown renderer for story prose.
 *
 * Renders ONLY:
 *   - `**bold**` → `<strong>…</strong>`
 *   - `*italic*` → `<em>…</em>`
 *
 * Everything else (headings, lists, tables, code blocks, links, HTML
 * injection, etc.) is stripped or escaped. Newlines are preserved as
 * literal `\n` — the consuming element should use `white-space: pre-wrap`
 * for paragraph spacing.
 *
 * Kept deliberately small and dependency-free. We do NOT pull in a full
 * markdown parser or a sanitizer library because our surface area is
 * intentionally tiny and predictable.
 */

const HTML_ESCAPE_REGEX = /[&<>"']/g;
const HTML_ESCAPE_MAP: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

function escapeHtml(s: string): string {
  return s.replace(HTML_ESCAPE_REGEX, (ch) => HTML_ESCAPE_MAP[ch] ?? ch);
}

/**
 * Render a story prose string with inline-only markdown support.
 *
 * Implementation notes:
 *  - We escape ALL HTML up front so nothing the model (or user) types can
 *    inject raw markup.
 *  - Then we apply two regexes against the escaped text: bold FIRST
 *    (double-asterisk, non-greedy) then italic (single-asterisk,
 *    non-greedy). Running bold first prevents the italic pattern from
 *    eating the inner asterisks of a `**bold**` run.
 *  - The italic regex requires at least one non-asterisk, non-whitespace
 *    character inside so standalone asterisks (e.g. for redaction:
 *    "f***ing") don't accidentally get wrapped.
 *  - Mid-stream safety: unmatched dangling markers (e.g. `*text` without
 *    a closer because the token hasn't arrived yet) are left as literal
 *    asterisks; once the closer streams in, the next render pass will
 *    pick it up naturally.
 */
export function renderInlineMarkdown(input: string): string {
  const escaped = escapeHtml(input);
  return escaped
    .replace(/\*\*([^*\n]+?)\*\*/g, "<strong>$1</strong>")
    .replace(/(^|[^*])\*([^*\s][^*\n]*?)\*(?!\*)/g, "$1<em>$2</em>");
}
