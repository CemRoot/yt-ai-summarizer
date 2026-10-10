#!/usr/bin/env node
/**
 * Title and notes for the GitHub release of the current manifest version.
 * No network. Used by .github/workflows/release.yml.
 *
 * - title: "vX.Y.Z — <popup What's new line>" (popup/popup.html #whatsNewTitle + its <span>)
 * - notes: the README "### vX.Y.Z" section, an install line, and a compare link
 *
 * Usage: node scripts/release-notes.mjs <notes-out.md> [previousTag]
 * Prints the title on stdout. Exits 1 when the README has no section for the version.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

const version = JSON.parse(read('manifest.json')).version;
const [, , outFile, previousTag] = process.argv;
if (!outFile) {
  console.error('usage: release-notes.mjs <notes-out.md> [previousTag]');
  process.exit(2);
}

const readme = read('README.md');
const heading = new RegExp(`^### v${version.replace(/\./g, '\\.')}\\b.*$`, 'm');
const start = readme.search(heading);
if (start === -1) {
  console.error(`README.md has no "### v${version}" section`);
  process.exit(1);
}
const afterHeading = readme.indexOf('\n', start) + 1;
const nextMatch = /^(### v\d|## )/m.exec(readme.slice(afterHeading));
const section = readme
  .slice(afterHeading, nextMatch ? afterHeading + nextMatch.index : undefined)
  .trim();

const popup = read('popup/popup.html');
const summary = (popup.match(/id="whatsNewTitle">[^<]*<\/strong>\s*<span>([^<]+)<\/span>/) || [])[1];
const title = summary ? `v${version} — ${summary.trim()}` : `v${version}`;

const repo = process.env.GITHUB_REPOSITORY || 'CemRoot/yt-ai-summarizer';
const parts = [
  section,
  '',
  `**Install:** download \`youtube-ai-summarizer-v${version}.zip\` below (same bundle as \`scripts/package-extension.sh\`).`,
];
if (previousTag) {
  parts.push('', `**Full diff:** https://github.com/${repo}/compare/${previousTag}...v${version}`);
}
fs.writeFileSync(outFile, parts.join('\n') + '\n');
console.log(title);
