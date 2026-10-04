/**
 * Escape-then-markdown contract for panel innerHTML.
 *
 * SummarizerUI and ArticleUI inject model text with innerHTML. Tags are
 * added only after `&`, `<`, and `>` are escaped. Neither renderer emits
 * links. No HTML sanitizer library.
 */
const test = require('node:test');
const assert = require('node:assert/strict');

require('./markdown-html.js');

const { MarkdownHtml } = globalThis;

const renderers = [
  ['video panel', (text) => MarkdownHtml.renderVideoPanel(text)],
  ['article panel', (text) => MarkdownHtml.renderArticlePanel(text)]
];

function assertTagStaysText(html, tagName) {
  assert.equal(html.includes(`<${tagName}`), false);
  assert.equal(html.includes(`</${tagName}`), false);
  assert.equal(html.includes(`&lt;${tagName}`), true);
}

function assertNoLinks(html) {
  assert.equal(/<a\b/i.test(html), false);
  assert.equal(html.includes('javascript:alert(1)'), true);
}

for (const [name, render] of renderers) {
  test(`${name} escapes a raw script tag`, () => {
    const html = render('<script>alert(1)</script>');
    assertTagStaysText(html, 'script');
    assert.equal(html.includes('&lt;script&gt;alert(1)&lt;/script&gt;'), true);
  });

  test(`${name} escapes an img onerror payload, including inside bold`, () => {
    const raw = '<img src=x onerror=alert(1)>';
    assertTagStaysText(render(raw), 'img');
    assert.equal(render(raw).includes('&lt;img src=x onerror=alert(1)&gt;'), true);

    const bold = render(`**${raw}**`);
    assert.equal(bold.includes('<strong>'), true);
    assertTagStaysText(bold, 'img');
    assert.equal(bold.includes('<strong>&lt;img src=x onerror=alert(1)&gt;</strong>'), true);
  });

  test(`${name} leaves javascript: URLs as text`, () => {
    assertNoLinks(render('See javascript:alert(1) for details'));
    assertNoLinks(render('[click](javascript:alert(1))'));
    const brokenAnchor = render('javascript:alert(1)</a><a href="javascript:alert(1)">');
    assertNoLinks(brokenAnchor);
    assert.equal(brokenAnchor.includes('&lt;/a&gt;&lt;a href="javascript:alert(1)"&gt;'), true);
  });

  test(`${name} escapes a tag split from the surrounding markup by a blank line`, () => {
    const html = render('hello\n\n</p><script>alert(1)</script>');
    assertTagStaysText(html, 'script');
    assert.equal(html.includes('&lt;/p&gt;&lt;script&gt;'), true);
  });

  test(`${name} still renders emphasis after escaping`, () => {
    const html = render('**bold** and *em*');
    assert.equal(html.includes('<strong>bold</strong>'), true);
    assert.equal(html.includes('<em>em</em>'), true);
  });
}

test('article panel escapes a script inside a code span', () => {
  const html = MarkdownHtml.renderArticlePanel('`<script>alert(1)</script>`');
  assert.equal(html.includes('<code>'), true);
  assertTagStaysText(html, 'script');
  assert.equal(html.includes('<code>&lt;script&gt;alert(1)&lt;/script&gt;</code>'), true);
});

test('escapeText matches the article plain-text escape', () => {
  assert.equal(MarkdownHtml.escapeText(''), '');
  assert.equal(MarkdownHtml.escapeText(null), '');
  assert.equal(
    MarkdownHtml.escapeText('a <b> & c'),
    'a &lt;b&gt; &amp; c'
  );
});
