/**
 * URL gate for the on-page article button and the popup article check.
 * Same heuristics as checkArticlePage: full-URL regexes, not hostnames.
 */
const test = require('node:test');
const assert = require('node:assert/strict');

require('./article-page-eligibility.js');

const { ArticlePageEligibility } = globalThis;

test('offers the button on an ordinary https article', () => {
  assert.equal(
    ArticlePageEligibility.canOfferArticleButton('https://www.example.com/news/story'),
    true
  );
});

test('offers the button on http', () => {
  assert.equal(
    ArticlePageEligibility.canOfferArticleButton('http://blog.example.org/post'),
    true
  );
});

test('skips YouTube and youtu.be', () => {
  assert.equal(ArticlePageEligibility.canOfferArticleButton('https://www.youtube.com/watch?v=abc'), false);
  assert.equal(ArticlePageEligibility.canOfferArticleButton('https://youtu.be/abc'), false);
  assert.equal(ArticlePageEligibility.classify('https://youtu.be/abc').isYouTube, true);
});

test('skips chrome and extension pages', () => {
  assert.equal(ArticlePageEligibility.canOfferArticleButton('chrome://extensions'), false);
  assert.equal(ArticlePageEligibility.canOfferArticleButton('chrome-extension://abc/popup.html'), false);
  assert.equal(ArticlePageEligibility.classify('chrome://newtab').reason, 'BROWSER_PAGE');
});

test('author pages are articles, auth pages are not', () => {
  assert.equal(
    ArticlePageEligibility.canOfferArticleButton('https://www.example.com/author/jane'),
    true
  );
  assert.equal(
    ArticlePageEligibility.canOfferArticleButton('https://www.example.com/auth/callback'),
    false
  );
});

test('skips banking, mail, login, and checkout', () => {
  assert.equal(ArticlePageEligibility.isBlockedUrl('https://www.example.com/banking/home'), true);
  assert.equal(ArticlePageEligibility.isBlockedUrl('https://mail.google.com/mail/u/0/'), true);
  assert.equal(ArticlePageEligibility.isBlockedUrl('https://accounts.example.com/signin'), true);
  assert.equal(ArticlePageEligibility.isBlockedUrl('https://shop.example.com/checkout'), true);
  assert.equal(ArticlePageEligibility.canOfferArticleButton('https://shop.example.com/cart'), false);
});

test('password pages stay extractor-sensitive and still match the button heuristic', () => {
  const url = 'https://notes.example.com/password-tips';
  assert.equal(ArticlePageEligibility.isBlockedUrl(url), false);
  assert.equal(ArticlePageEligibility.isSensitivePage(url), true);
  assert.equal(ArticlePageEligibility.canOfferArticleButton(url), true);
});
