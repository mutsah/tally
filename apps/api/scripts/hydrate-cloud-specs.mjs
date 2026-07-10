// Hydrate OneDrive "Files On-Demand" cloud placeholders before Jest's crawler runs.
//
// Why this exists: this repo lives under a OneDrive folder. OneDrive dehydrates
// "unused" files into cloud placeholders (NTFS reparse points, tag 0x9000a01a).
// Node's readdir reports those placeholders as SYMLINKS, and jest-haste-map's
// node crawler skips symlink dirents unconditionally — so any dehydrated
// `*.spec.ts` silently disappears from `jest`'s discovery and `npm test`
// under-reports with no error. (The native GNU-find crawler that would include
// them isn't reachable: on Windows `spawn('find')` resolves to System32\find.exe,
// so jest falls back to the JS crawler.)
//
// Materializing them: a bare `readFileSync` returns the bytes (OneDrive recalls
// them on demand) but does NOT durably clear the reparse point — readdir keeps
// reporting a symlink dirent, and jest keeps skipping the file. Writing the bytes
// back is what actually materializes it. So for any spec whose dirent is not a
// real file we do a read -> write round-trip (byte-identical, so git stays clean)
// and then re-check with lstat that it is now a plain file.
//
// We match on the file NAME (not the dirent type), so placeholders classified as
// symlinks are still found. This is a no-op on non-OneDrive / already-hydrated
// checkouts. If a spec cannot be materialized we say so loudly and exit non-zero
// rather than letting the suite run a silent subset — and jest-global-setup.cjs
// independently hard-fails on any placeholder that slips through.
import { readdirSync, readFileSync, writeFileSync, statSync, lstatSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const srcDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'src');

let alreadyLocal = 0;
let materialized = 0;
const failed = [];

function walk(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    // statSync follows the cloud reparse point, so a dehydrated directory still
    // resolves as a directory (dirent.isDirectory() can be false for placeholders).
    let isDir = entry.isDirectory();
    if (!isDir && !entry.name.endsWith('.spec.ts')) {
      try {
        isDir = statSync(full).isDirectory();
      } catch {
        isDir = false;
      }
    }
    if (isDir) {
      walk(full);
      continue;
    }
    if (!entry.name.endsWith('.spec.ts')) continue;

    // A real file already — nothing to do.
    if (entry.isFile()) {
      alreadyLocal += 1;
      continue;
    }

    // Placeholder: force materialization with a byte-identical rewrite.
    try {
      const bytes = readFileSync(full);
      writeFileSync(full, bytes);
      // lstat does NOT follow the reparse point, so it tells us whether the
      // placeholder is really gone (statSync would follow and always say "file").
      if (!lstatSync(full).isFile()) {
        throw new Error('still a reparse point after rewrite');
      }
      materialized += 1;
    } catch (err) {
      failed.push(`${full} (${err.message})`);
    }
  }
}

walk(srcDir);

if (failed.length > 0) {
  console.error(
    `hydrate-cloud-specs: could NOT materialize ${failed.length} spec file(s):\n` +
      failed.map((f) => `  - ${f}`).join('\n') +
      `\nJest would silently skip these. Mark them "Always keep on this device" ` +
      `in OneDrive, then re-run.`,
  );
  process.exit(1);
}

// Intentionally quiet on the happy path; one line so the step isn't a mystery.
console.log(
  `hydrate-cloud-specs: ${alreadyLocal + materialized} spec file(s) local` +
    (materialized > 0 ? ` (materialized ${materialized} placeholder(s))` : ''),
);
