// Dossier builder for the token-radar entry.
//
// Takes a finished output directory (dashboard/ plus screenshots/) and
// packs it into the single JSON summary the judge reads. The layout is
// fixed: a short markdown write-up of the dashboard files, the screenshot
// files as base64 with a checksum each, a cover pointer, and a schema tag.
// The JSON is written in canonical form, keys sorted at every depth, with
// no trailing newline, so repeated runs produce identical bytes.

import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { extname, join } from 'node:path';

export type DossierCaps = {
  text_max_bytes: number;
  screenshots: { max: number; max_bytes: number };
  dashboard: { max_files: number; max_bytes: number };
};

type PageFile = {
  name: string;
  bytes: Buffer;
  newlineCount: number;
};

const SCHEMA_TAG = 'makefun/dossier/v1';

// MIME type for a screenshot, guessed from its file extension.
function mediaTypeFor(filename: string): string {
  switch (extname(filename).toLowerCase()) {
    case '.png':
      return 'image/png';
    case '.jpg':
    case '.jpeg':
      return 'image/jpeg';
    case '.gif':
      return 'image/gif';
    case '.webp':
      return 'image/webp';
    case '.avif':
      return 'image/avif';
    case '.svg':
      return 'image/svg+xml';
    default:
      return 'application/octet-stream';
  }
}

// Fence language for a dashboard source file, from its extension.
function fenceLanguageFor(filename: string): string {
  const suffix = extname(filename).toLowerCase().replace(/^\./, '');
  if (suffix === 'mjs') return 'js';
  return suffix;
}

function countNewlines(buf: Buffer): number {
  let total = 0;
  for (const byte of buf) {
    if (byte === 0x0a) total += 1;
  }
  return total;
}

function hexDigest(buf: Buffer): string {
  return createHash('sha256').update(buf).digest('hex');
}

// Sorted directory listing restricted to regular files.
function listFiles(folder: string): string[] {
  return readdirSync(folder)
    .sort()
    .filter((name) => statSync(join(folder, name)).isFile());
}

function collectDashboard(
  folder: string,
  caps: DossierCaps['dashboard'],
): PageFile[] {
  const names = listFiles(folder);
  if (names.length > caps.max_files) {
    throw new Error(
      `dashboard has ${names.length} files, over the limit of ${caps.max_files}`,
    );
  }
  const pages: PageFile[] = [];
  let totalBytes = 0;
  for (const name of names) {
    const bytes = readFileSync(join(folder, name));
    totalBytes += bytes.length;
    if (totalBytes > caps.max_bytes) {
      throw new Error(
        `dashboard totals ${totalBytes} bytes, over the limit of ${caps.max_bytes}`,
      );
    }
    pages.push({ name, bytes, newlineCount: countNewlines(bytes) });
  }
  return pages;
}

function renderDashboardText(pages: PageFile[]): string {
  const totalBytes = pages.reduce((sum, page) => sum + page.bytes.length, 0);
  const chunks: string[] = [];
  chunks.push(`## Dashboard\n\nFiles: ${pages.length} (${totalBytes} bytes)\n`);
  for (const page of pages) {
    chunks.push(`- ${page.name} (${page.bytes.length} bytes)\n`);
  }
  chunks.push('\n## Source\n\n');
  const sections = pages.map((page) => {
    const header =
      `### ${page.name}\n\n` +
      `${page.bytes.length} bytes, ${page.newlineCount} lines\n\n` +
      `\`\`\`${fenceLanguageFor(page.name)}\n`;
    return header + page.bytes.toString('utf8') + '```\n';
  });
  chunks.push(sections.join('\n'));
  return chunks.join('');
}

function collectShots(
  folder: string,
  caps: DossierCaps['screenshots'],
): Array<{ base64: string; media_type: string; name: string; sha256: string }> {
  const names = listFiles(folder);
  if (names.length > caps.max) {
    throw new Error(
      `found ${names.length} screenshots, over the limit of ${caps.max}`,
    );
  }
  return names.map((name) => {
    const bytes = readFileSync(join(folder, name));
    if (bytes.length > caps.max_bytes) {
      throw new Error(
        `screenshot ${name} is ${bytes.length} bytes, over the limit of ${caps.max_bytes}`,
      );
    }
    return {
      base64: bytes.toString('base64'),
      media_type: mediaTypeFor(name),
      name,
      sha256: hexDigest(bytes),
    };
  });
}

// Canonical JSON: object keys in alphabetical order at every level,
// compact separators, strings escaped exactly as JSON.stringify does.
function canonicalJson(value: unknown): string {
  if (value === null) return 'null';
  if (Array.isArray(value)) {
    return '[' + value.map((item) => canonicalJson(item)).join(',') + ']';
  }
  if (typeof value === 'object') {
    const entries = Object.keys(value as Record<string, unknown>).sort();
    const parts = entries.map(
      (key) =>
        JSON.stringify(key) +
        ':' +
        canonicalJson((value as Record<string, unknown>)[key]),
    );
    return '{' + parts.join(',') + '}';
  }
  return JSON.stringify(value);
}

export function buildDossier(
  directoryPath: string,
  caps: DossierCaps,
): Uint8Array {
  const pages = collectDashboard(join(directoryPath, 'dashboard'), caps.dashboard);
  const text = renderDashboardText(pages);
  const textBytes = Buffer.byteLength(text, 'utf8');
  if (textBytes > caps.text_max_bytes) {
    throw new Error(
      `dashboard text is ${textBytes} bytes, over the limit of ${caps.text_max_bytes}`,
    );
  }
  const images = collectShots(join(directoryPath, 'screenshots'), caps.screenshots);
  const dossier = {
    cover: 0,
    images,
    schema: SCHEMA_TAG,
    text,
  };
  return new TextEncoder().encode(canonicalJson(dossier));
}
