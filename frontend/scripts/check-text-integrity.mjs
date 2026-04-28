import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../src');
const FILE_PATTERN = /\.(js|jsx|css)$/;
const MOJIBAKE_PATTERNS = [
  /\u00C3/,
  /\u00C2\u00A9/,
  /\u00C4/,
  /\u00E1\u00BB/,
  /\u00E1\u00BA/,
  /\u00C6[\u00A1\u00B0]/,
  /\u00E2\u20AC[\u00A6\u2013\u2014]/,
  /\uFFFD/,
];

const issues = [];

function scanDirectory(directoryPath) {
  const entries = fs.readdirSync(directoryPath, { withFileTypes: true });
  for (const entry of entries) {
    const childPath = path.join(directoryPath, entry.name);
    if (entry.isDirectory()) {
      scanDirectory(childPath);
      continue;
    }
    if (!FILE_PATTERN.test(entry.name)) continue;

    const content = fs.readFileSync(childPath, 'utf8');
    const lines = content.split(/\r?\n/);

    lines.forEach((line, index) => {
      if (MOJIBAKE_PATTERNS.some((pattern) => pattern.test(line))) {
        issues.push({
          file: path.normalize(childPath),
          lineNumber: index + 1,
          line: line.trim(),
        });
      }
    });
  }
}

scanDirectory(ROOT);

if (issues.length > 0) {
  console.error('Text integrity check failed. Fix mojibake or replacement characters before build:');
  for (const issue of issues) {
    console.error(`${issue.file}:${issue.lineNumber}: ${issue.line}`);
  }
  process.exit(1);
}

console.log('Text integrity check passed.');
