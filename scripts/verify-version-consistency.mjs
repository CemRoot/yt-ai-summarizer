#!/usr/bin/env node
/**
 * Fail if manifest.json version drifts from the surfaces users see.
 * No network. Called from .github/workflows/ci.yml (version-check).
 *
 * Checks:
 * - every vX.Y.Z in privacy-policy.html
 * - the first ### vX.Y.Z in README.md
 * - the first version: 'X.Y.Z' in update/update.js (CHANGELOG, newest first)
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

function read(rel) {
  return fs.readFileSync(path.join(ROOT, rel), 'utf8');
}

const manifestVer = JSON.parse(read('manifest.json')).version;
const errors = [];

const ppVersions = [
  ...new Set((read('privacy-policy.html').match(/v(\d+\.\d+\.\d+)/g) || []).map((s) => s.slice(1))),
];
for (const v of ppVersions) {
  if (v !== manifestVer) {
    errors.push(`privacy-policy.html has v${v}, expected v${manifestVer}`);
  }
}

const readmeVersions = [...read('README.md').matchAll(/### v(\d+\.\d+\.\d+)/g)].map((m) => m[1]);
if (readmeVersions.length && readmeVersions[0] !== manifestVer) {
  errors.push(`README.md latest changelog is v${readmeVersions[0]}, expected v${manifestVer}`);
}

const updateMatch = read('update/update.js').match(/version:\s*['"](\d+\.\d+\.\d+)['"]/);
const updateVer = updateMatch ? updateMatch[1] : null;
if (!updateVer) {
  errors.push('update/update.js CHANGELOG has no version entry');
} else if (updateVer !== manifestVer) {
  errors.push(`update/update.js CHANGELOG first version is ${updateVer}, expected ${manifestVer}`);
}

console.log(`manifest.json: ${manifestVer}`);
console.log(`privacy-policy.html versions: ${ppVersions.length ? [...ppVersions].join(', ') : 'NONE'}`);
console.log(`README.md latest changelog: v${readmeVersions[0] || 'NONE'}`);
console.log(`update/update.js CHANGELOG first: ${updateVer || 'NONE'}`);

if (errors.length) {
  for (const e of errors) console.error(`FAIL: ${e}`);
  process.exit(1);
}
console.log('OK: All version numbers are consistent');
