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

test('never offers the button on social, chat, search, app or shop hosts', () => {
  const urls = [
    'https://www.instagram.com/p/Cabc123/',
    'https://www.instagram.com/someone/',
    'https://twitter.com/someone/status/123456',
    'https://x.com/someone/status/123456',
    'https://www.facebook.com/groups/123/posts/456',
    'https://www.tiktok.com/@someone/video/123',
    'https://www.linkedin.com/feed/update/urn:li:activity:1/',
    'https://web.whatsapp.com/',
    'https://discord.com/channels/1/2',
    'https://www.google.com/search?q=news',
    'https://www.google.com.tr/search?q=haber',
    'https://news.google.com/topstories',
    'https://docs.google.com/document/d/abc/edit',
    'https://www.amazon.co.uk/dp/B000',
    'https://www.trendyol.com/marka/urun-p-123',
    'https://chatgpt.com/c/abc',
    'https://github.com/owner/repo/issues/1',
    'https://open.spotify.com/track/abc',
  ];
  for (const url of urls) {
    assert.equal(ArticlePageEligibility.canOfferArticleButton(url), false, url);
    assert.equal(
      ArticlePageEligibility.shouldOfferForSignals(url, {
        articleSchema: true, forumSchema: true, ogArticle: true, forumPlatform: true,
        paragraphChars: 10000, paragraphCount: 40,
      }),
      false,
      url
    );
  }
});

test('lookalike hosts are not caught by the social block list', () => {
  assert.equal(ArticlePageEligibility.isNonArticleHost('https://www.netflixnews.com/story'), false);
  assert.equal(ArticlePageEligibility.isNonArticleHost('https://www.theinstagramblog.org/post'), false);
  assert.equal(ArticlePageEligibility.isNonArticleHost('https://box.com/news'), false);
});

test('homepages do not get the button, story paths can', () => {
  assert.equal(ArticlePageEligibility.isHomepage('https://www.bbc.com/'), true);
  assert.equal(ArticlePageEligibility.isHomepage('https://www.hurriyet.com.tr'), true);
  assert.equal(ArticlePageEligibility.isHomepage('https://www.example.com/index.html'), true);
  assert.equal(ArticlePageEligibility.isHomepage('https://www.example.com/?utm_source=x'), true);
  assert.equal(ArticlePageEligibility.isHomepage('https://www.example.com/?p=123'), false);
  assert.equal(ArticlePageEligibility.canOfferArticleButton('https://www.bbc.com/'), false);
  assert.equal(
    ArticlePageEligibility.canOfferArticleButton('https://www.bbc.com/news/articles/c123'),
    true
  );
});

test('known forum and Q&A threads pass on URL alone', () => {
  const urls = [
    'https://www.reddit.com/r/programming/comments/abc123/some_title/',
    'https://old.reddit.com/r/turkey/comments/xyz9/baslik/',
    'https://news.ycombinator.com/item?id=123',
    'https://stackoverflow.com/questions/123/how-to',
    'https://eksisozluk.com/bir-baslik--123456',
    'https://www.technopat.net/sosyal/konu/bir-konu.12345/',
  ];
  for (const url of urls) {
    assert.equal(ArticlePageEligibility.isKnownThreadPage(url), true, url);
    assert.equal(ArticlePageEligibility.shouldOfferForSignals(url, null), true, url);
  }
  assert.equal(ArticlePageEligibility.isKnownThreadPage('https://www.reddit.com/r/programming/'), false);
});

const EMPTY = {
  articleSchema: false, forumSchema: false, ogArticle: false, forumPlatform: false,
  paragraphChars: 0, paragraphCount: 0,
};
const NEWS = 'https://www.example-news.com/world/2026/10/07/story';

test('content gate: article metadata plus some real text', () => {
  assert.equal(ArticlePageEligibility.shouldOfferForSignals(NEWS, EMPTY), false);
  assert.equal(
    ArticlePageEligibility.shouldOfferForSignals(NEWS, { ...EMPTY, articleSchema: true, paragraphChars: 800, paragraphCount: 3 }),
    true
  );
  assert.equal(
    ArticlePageEligibility.shouldOfferForSignals(NEWS, { ...EMPTY, ogArticle: true, paragraphChars: 800, paragraphCount: 3 }),
    true
  );
  assert.equal(
    ArticlePageEligibility.shouldOfferForSignals(NEWS, { ...EMPTY, ogArticle: true, paragraphChars: 120, paragraphCount: 1 }),
    false,
    'og:type=article alone on a thin page is not enough'
  );
});

test('content gate: forum software with a short thread', () => {
  const url = 'https://forum.example.org/t/some-topic/42';
  assert.equal(
    ArticlePageEligibility.shouldOfferForSignals(url, { ...EMPTY, forumPlatform: true, paragraphChars: 300, paragraphCount: 2 }),
    true
  );
  assert.equal(
    ArticlePageEligibility.shouldOfferForSignals(url, { ...EMPTY, forumSchema: true, paragraphChars: 300, paragraphCount: 2 }),
    true
  );
});

test('content gate: no metadata needs long-form text', () => {
  assert.equal(
    ArticlePageEligibility.shouldOfferForSignals(NEWS, { ...EMPTY, paragraphChars: 1500, paragraphCount: 8 }),
    false
  );
  assert.equal(
    ArticlePageEligibility.shouldOfferForSignals(NEWS, { ...EMPTY, paragraphChars: 2600, paragraphCount: 4 }),
    false
  );
  assert.equal(
    ArticlePageEligibility.shouldOfferForSignals(NEWS, { ...EMPTY, paragraphChars: 2600, paragraphCount: 7 }),
    true
  );
});

/** Minimal Document stand-in for collectPageSignals. */
function fakeDoc({ ld = [], itemtypes = [], meta = {}, paragraphs = [], forumThread = false }) {
  const p = paragraphs.map((text) => ({ textContent: text }));
  const root = { querySelectorAll: (sel) => (sel === 'p' ? p : []) };
  return {
    body: root,
    querySelectorAll(sel) {
      if (sel === 'script[type="application/ld+json"]') return ld.map((x) => ({ textContent: x }));
      if (sel === '[itemtype]') return itemtypes.map((t) => ({ getAttribute: () => t }));
      return [];
    },
    querySelector(sel) {
      const m = sel.match(/^meta\[(?:property|name)="([^"]+)"\]$/);
      if (m) return meta[m[1]] ? { getAttribute: () => meta[m[1]] } : null;
      if (sel.startsWith('body.section-viewtopic')) return forumThread ? {} : null;
      if (sel.startsWith('[itemprop="articleBody"]')) return root;
      return null;
    },
  };
}

const LONG = 'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore.';

test('collectPageSignals reads JSON-LD @graph, microdata, og:type and paragraphs', () => {
  const s = ArticlePageEligibility.collectPageSignals(fakeDoc({
    ld: [
      'not json',
      JSON.stringify({ '@context': 'https://schema.org', '@graph': [{ '@type': 'WebPage' }, { '@type': ['NewsArticle'] }] }),
    ],
    meta: { 'og:type': 'article' },
    paragraphs: [LONG, LONG, 'short caption', LONG],
  }));
  assert.equal(s.articleSchema, true);
  assert.equal(s.ogArticle, true);
  assert.equal(s.forumSchema, false);
  assert.equal(s.paragraphCount, 3);
  assert.ok(s.paragraphChars > 300);

  const forum = ArticlePageEligibility.collectPageSignals(fakeDoc({
    itemtypes: ['http://schema.org/DiscussionForumPosting'],
    meta: { generator: 'Discourse 3.2' },
  }));
  assert.equal(forum.forumSchema, true);
  assert.equal(forum.forumPlatform, true);
  assert.equal(forum.articleSchema, false);
});

test('a feed-like page with only short snippets gets no button', () => {
  const url = 'https://some-app.example.com/feed/latest';
  const doc = fakeDoc({
    meta: { 'og:type': 'website' },
    paragraphs: Array.from({ length: 50 }, () => 'Nice photo! 😍 #travel'),
  });
  assert.equal(ArticlePageEligibility.canOfferArticleButtonOnPage(url, doc), false);
});

test('a news story with schema and body text gets the button', () => {
  const doc = fakeDoc({
    ld: [JSON.stringify({ '@type': 'NewsArticle', headline: 'x' })],
    paragraphs: [LONG, LONG, LONG, LONG, LONG, LONG],
  });
  assert.equal(ArticlePageEligibility.canOfferArticleButtonOnPage(NEWS, doc), true);
});

test('section page: many teaser cards are not one story body', () => {
  // Same total text, but spread over separate cards (one paragraph each).
  const teasers = { ...EMPTY, paragraphChars: 3700, paragraphCount: 29, bodyChars: 260, bodyCount: 2 };
  assert.equal(ArticlePageEligibility.shouldOfferForSignals(NEWS, teasers), false);
  const story = { ...EMPTY, paragraphChars: 3700, paragraphCount: 12, bodyChars: 3400, bodyCount: 10 };
  assert.equal(ArticlePageEligibility.shouldOfferForSignals(NEWS, story), true);
});

test('collectPageSignals groups paragraphs by parent and skips link teasers', () => {
  const cardA = {}; const cardB = {}; const body = {};
  const para = (parentElement, inLink = false) => ({
    textContent: LONG, parentElement, closest: () => (inLink ? {} : null),
  });
  const paragraphs = [para(cardA), para(cardB), para(body), para(body), para(body), para(cardA, true)];
  const root = { querySelectorAll: () => paragraphs };
  const doc = {
    body: root,
    querySelectorAll: () => [],
    querySelector: (sel) => (sel.startsWith('[itemprop="articleBody"]') ? root : null),
  };
  const s = ArticlePageEligibility.collectPageSignals(doc);
  assert.equal(s.paragraphCount, 5, 'the paragraph inside a link is skipped');
  assert.equal(s.bodyCount, 3);
  assert.equal(s.bodyChars, LONG.length * 3);
});

test('forum thread markup passes even when posts are not <p> paragraphs', () => {
  const url = 'https://www.phpbb.com/community/viewtopic.php?t=2628926';
  const thread = fakeDoc({ forumThread: true, paragraphs: ['short'] });
  assert.equal(ArticlePageEligibility.collectPageSignals(thread).forumThread, true);
  assert.equal(ArticlePageEligibility.canOfferArticleButtonOnPage(url, thread), true);
  const boardIndex = fakeDoc({ meta: { generator: 'phpBB' }, paragraphs: ['short'] });
  assert.equal(
    ArticlePageEligibility.canOfferArticleButtonOnPage('https://forum.example.org/viewforum.php?f=2', boardIndex),
    false,
    'a board index is not a thread'
  );
});
