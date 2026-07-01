// Hydrate OneDrive "Files On-Demand" cloud placeholders before Jest's crawler runs.
//
// Why this exists: this repo lives under a OneDrive folder. OneDrive dehydrates
// "unused" files into cloud placeholders (NTFS reparse points, tag 0x9000a01a).
// Node's readdir reports those placeholders as SYMLINKS, and jest-haste-map's
// node crawler skips symlink dirents unconditionally — so any dehydrated
// `*.spec.ts` silently disappears from `jest`'s discovery and `npm test`
// under-reports (7/11 suites) with no error. (The native GNU-find crawler that
// would include them isn't reachable: on Windows `spawn('find')` resolves to
// System32\find.exe, so jest falls back to the JS crawler.)
//
// Reading a placeholder's bytes forces OneDrive to materialize it, after which
// readdir reports a normal file and the crawler picks it up. We match on the
// file NAME (not the dirent type), so placeholders classified as symlinks are
// still hydrated. This is a no-op on non-OneDrive / already-hydrated checkouts.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const srcDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'src');

let hydrated = 0;
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
    } else if (entry.name.endsWith('.spec.ts')) {
      try {
        readFileSync(full); // materialize if it's a cloud placeholder
        hydrated += 1;
      } catch {
        // Unreadable file — let jest surface it rather than failing the hook.
      }
    }
  }
}

walk(srcDir);
// Intentionally quiet on the happy path; one line so the step isn't a mystery.
console.log(`hydrate-cloud-specs: ensured ${hydrated} spec file(s) are local`);
