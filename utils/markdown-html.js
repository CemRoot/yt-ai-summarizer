/**
 * MarkdownHtml — escape-then-markdown for panel innerHTML.
 *
 * Model text is escaped before any tags are inserted. The YouTube panel and
 * the article panel keep their existing markup. Neither renderer emits links,
 * so a javascript: URL stays text.
 */
class MarkdownHtml {

  /**
   * @param {string} text
   * @returns {string}
   */
  static #escapeMarkup(text) {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  /**
   * Plain-text escape used by the article panel (titles, errors, excerpts).
   * @param {unknown} text
   * @returns {string}
   */
  static escapeText(text) {
    if (!text) return '';
    return MarkdownHtml.#escapeMarkup(String(text));
  }

  /**
   * YouTube summary and assistant chat (SummarizerUI).
   * @param {string} text
   * @returns {string}
   */
  static renderVideoPanel(text) {
    if (!text) return '';
    let html = MarkdownHtml.#escapeMarkup(text)
      .replace(/^### (.+)$/gm, '<h4>$1</h4>')
      .replace(/^## (.+)$/gm, '<h3>$1</h3>')
      .replace(/^# (.+)$/gm, '<h3>$1</h3>')
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.+?)\*/g, '<em>$1</em>')
      .replace(/^\d+\.\s+(.+)$/gm, '<oli>$1</oli>')
      .replace(/^[-*]\s+(.+)$/gm, '<uli>$1</uli>')
      .replace(/((?:<oli>.*<\/oli>\n?)+)/g, m => `<ol>${m.replace(/<\/?oli>/g, t => t === '<oli>' ? '<li>' : '</li>')}</ol>`)
      .replace(/((?:<uli>.*<\/uli>\n?)+)/g, m => `<ul>${m.replace(/<\/?uli>/g, t => t === '<uli>' ? '<li>' : '</li>')}</ul>`)
      .replace(/\n\n/g, '</p><p>')
      .replace(/\n/g, '<br>');
    if (!html.startsWith('<')) html = `<p>${html}</p>`;
    return html;
  }

  /**
   * Article summary and chat (ArticleUI).
   * @param {string} text
   * @returns {string}
   */
  static renderArticlePanel(text) {
    if (!text) return '';

    return MarkdownHtml.#escapeMarkup(text)
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.+?)\*/g, '<em>$1</em>')
      .replace(/`(.+?)`/g, '<code>$1</code>')
      .replace(/^### (.+)$/gm, '<h4>$1</h4>')
      .replace(/^## (.+)$/gm, '<h3>$1</h3>')
      .replace(/^# (.+)$/gm, '<h2>$1</h2>')
      .replace(/^- (.+)$/gm, '<li>$1</li>')
      .replace(/(<li>.*<\/li>\n?)+/g, '<ul>$&</ul>')
      .replace(/\n\n/g, '</p><p>')
      .replace(/^(.+)$/gm, (match) => {
        if (match.startsWith('<')) return match;
        return `<p>${match}</p>`;
      })
      .replace(/<p><\/p>/g, '');
  }
}

if (typeof globalThis !== 'undefined') {
  globalThis.MarkdownHtml = MarkdownHtml;
}
