#!/usr/bin/env node
/**
 * Fail if extension surface still references Cursor/local NDJSON debug ingest.
 * Evidence for CI and local dev: `node scripts/verify-no-debug-hosts.mjs`
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const PATTERN = /127\.0\.0\.1:7243|:7243\/ingest/;
const MANIFEST_BAD = /127\.0\.0\.1|:7243/;

function fail(msg) {
  console.error(msg);
  process.exit(1);
}

function readText(abs) {
  return fs.readFileSync(abs, 'utf8');
}

function scanFile(rel) {
  const abs = path.join(ROOT, rel);
  if (!fs.existsSync(abs)) return;
  const text = readText(abs);
  if (PATTERN.test(text)) {
    fail(`FAIL: debug ingest pattern in ${rel}`);
  }
  if (rel === 'manifest.json' && MANIFEST_BAD.test(text)) {
    fail(`FAIL: manifest.json must not reference localhost debug hosts (127.0.0.1 / :7243)`);
  }
}

function walkJs(relDir) {
  const abs = path.join(ROOT, relDir);
  if (!fs.existsSync(abs)) return;
  const st = fs.statSync(abs);
  if (st.isFile()) {
    if (relDir.endsWith('.js')) scanFile(relDir);
    return;
  }
  for (const name of fs.readdirSync(abs)) {
    if (name === 'node_modules' || name.startsWith('.')) continue;
    walkJs(path.join(relDir, name));
  }
}

scanFile('manifest.json');
for (const f of ['service-worker.js']) {
  scanFile(f);
}
for (const d of ['content', 'popup', 'welcome', 'utils']) {
  walkJs(d);
}

console.log('OK: no 127.0.0.1:7243 / :7243/ingest in manifest or extension JS roots');
