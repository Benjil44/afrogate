import { execFileSync } from 'node:child_process';
import { readFileSync, statSync } from 'node:fs';

const MAX_TEXT_FILE_BYTES = 1_000_000;
const allowedSecretLikeFiles = new Set(['.env.example']);
const binaryExtensions = new Set([
  '.avif',
  '.gif',
  '.ico',
  '.jpg',
  '.jpeg',
  '.pdf',
  '.png',
  '.ttf',
  '.webp',
  '.woff',
  '.woff2',
]);

const secretPatterns = [
  {
    name: 'private key block',
    pattern: /-----BEGIN [A-Z ]*PRIVATE KEY-----/g,
  },
  {
    name: 'GitHub token',
    pattern: /\bgh[pousr]_[A-Za-z0-9_]{36,255}\b/g,
  },
  {
    name: 'OpenAI API key',
    pattern: /\bsk-(?:proj-)?[A-Za-z0-9_-]{32,}\b/g,
  },
  {
    name: 'Telegram bot token',
    pattern: /\b\d{8,10}:[A-Za-z0-9_-]{35}\b/g,
  },
  {
    name: 'AWS access key id',
    pattern: /\b(?:AKIA|ASIA)[0-9A-Z]{16}\b/g,
  },
  {
    name: 'Google API key',
    pattern: /\bAIza[0-9A-Za-z_-]{35}\b/g,
  },
  {
    name: 'Slack token',
    pattern: /\bxox[baprs]-[0-9A-Za-z-]{20,}\b/g,
  },
  {
    name: 'Stripe secret key',
    pattern: /\bsk_(?:live|test)_[0-9a-zA-Z]{24,}\b/g,
  },
];

function listScannableFiles() {
  const output = execFileSync('git', ['ls-files', '-z', '--cached', '--others', '--exclude-standard'], {
    encoding: 'utf8',
  });

  return output.split('\0').filter(Boolean);
}

function normalizePath(filePath) {
  return filePath.replace(/\\/g, '/');
}

function extensionOf(filePath) {
  const lastDot = filePath.lastIndexOf('.');

  return lastDot === -1 ? '' : filePath.slice(lastDot).toLowerCase();
}

function isSensitiveTrackedPath(filePath) {
  const normalized = normalizePath(filePath);
  const basename = normalized.split('/').at(-1) ?? normalized;

  if (allowedSecretLikeFiles.has(normalized) || allowedSecretLikeFiles.has(basename)) return false;
  if (basename === '.env' || basename.startsWith('.env.')) return true;
  if (/^id_(rsa|dsa|ecdsa|ed25519)$/i.test(basename)) return true;
  if (/\.(pem|key|p12|pfx)$/i.test(basename)) return true;

  return false;
}

function shouldScanContent(filePath) {
  const normalized = normalizePath(filePath);
  const extension = extensionOf(normalized);

  if (binaryExtensions.has(extension)) return false;
  if (normalized.startsWith('node_modules/')) return false;
  if (normalized.startsWith('dist/')) return false;
  if (normalized.startsWith('build/')) return false;
  if (normalized.startsWith('playwright-report/')) return false;
  if (normalized.startsWith('test-results/')) return false;

  const stats = statSync(filePath);

  return stats.isFile() && stats.size <= MAX_TEXT_FILE_BYTES;
}

function lineNumberAt(content, index) {
  let line = 1;

  for (let position = 0; position < index; position += 1) {
    if (content.charCodeAt(position) === 10) line += 1;
  }

  return line;
}

const findings = [];

for (const filePath of listScannableFiles()) {
  if (isSensitiveTrackedPath(filePath)) {
    findings.push(`${filePath}: tracked sensitive filename`);
    continue;
  }

  if (!shouldScanContent(filePath)) continue;

  const buffer = readFileSync(filePath);
  if (buffer.includes(0)) continue;

  const content = buffer.toString('utf8');

  for (const { name, pattern } of secretPatterns) {
    pattern.lastIndex = 0;

    for (const match of content.matchAll(pattern)) {
      findings.push(`${filePath}:${lineNumberAt(content, match.index ?? 0)}: possible ${name}`);
    }
  }
}

if (findings.length > 0) {
  console.error('Secret scan failed. Review these repository files:');
  for (const finding of findings) console.error(`- ${finding}`);
  process.exit(1);
}

console.log('Secret scan passed.');
