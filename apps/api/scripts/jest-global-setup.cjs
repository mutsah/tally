// Jest globalSetup tripwire — runs on EVERY jest invocation (bare `jest`, the
// IDE runner, CI, `npm test`), before any suite executes.
//
// It performs an independent census of `*.spec.ts` files under src by walking the
// tree and matching on FILENAME — deliberately NOT using jest's own crawler,
// because that crawler is the thing being audited. (On this OneDrive checkout the
// crawler silently drops dehydrated cloud-placeholder specs; see
// scripts/hydrate-cloud-specs.mjs.) If the census doesn't match the expected
// total, we throw so the run fails loudly instead of reporting green on a subset.
//
// The `pretest` hydrate hook and this tripwire are complementary: hydrate makes
// the run WORK (it force-materializes placeholders with a read/write round-trip so
// jest can discover them); this guard makes a silent under-run IMPOSSIBLE — it
// fails on BOTH ways the census can lie:
//   1. the COUNT drifts (a spec was added/removed without updating the constant);
//   2. a spec is still a DEHYDRATED PLACEHOLDER. Counting such a file by name
//      would let the census pass while jest-haste-map silently skips it — the
//      exact under-run this file exists to prevent. We now hard-fail instead.
//
// Detection note: a placeholder is an NTFS reparse point that `readdir` surfaces
// as a SYMLINK dirent — and that dirent is precisely what jest's crawler tests.
// `statSync` FOLLOWS the reparse point (that is why the walk below uses it to
// resolve directories), so `statSync(...).isFile()` returns true for a placeholder
// and cannot detect one. We therefore test the dirent itself, cross-checked with
// `lstat`, which does not follow.
//
// ── Maintaining the expected count ─────────────────────────────────────────────
// EXPECTED_SPEC_COUNT is the number of `*.spec.ts` files under apps/api/src.
// When you ADD or REMOVE a spec file, update this ONE number to match. If it's
// stale, `npm test` fails on the first run with a message telling you the new
// count — so it can never drift silently.
const EXPECTED_SPEC_COUNT = 16;

const fs = require('node:fs');
const path = require('node:path');

const SRC_DIR = path.join(__dirname, '..', 'src');

/**
 * A `*.spec.ts` entry that readdir does NOT report as a real file is a dehydrated
 * cloud placeholder (or otherwise not a plain file). jest-haste-map skips exactly
 * those, so counting it would make the census pass over a suite jest never runs.
 * Throw, naming the path.
 */
function assertRealFile(full, entry) {
  if (entry.isFile()) return;

  let detail = 'readdir reports it as a non-file dirent';
  if (entry.isSymbolicLink()) {
    detail = 'readdir reports it as a SYMLINK (NTFS cloud reparse point)';
  } else if (entry.isDirectory()) {
    detail = 'it is a directory, not a file';
  }
  try {
    if (!entry.isDirectory() && fs.lstatSync(full).isSymbolicLink()) {
      detail = 'lstat reports it as a SYMLINK (NTFS cloud reparse point)';
    }
  } catch (err) {
    detail = `lstat failed: ${err.code ?? err.message}`;
  }

  throw new Error(
    `Spec-file census: "${full}" is a DEHYDRATED CLOUD PLACEHOLDER, not a real ` +
      `file (${detail}). jest-haste-map SKIPS such entries, so the suite would ` +
      `run a subset and still report green — aborting instead. Fix: run ` +
      `"npm run hydrate-specs" (the pretest hook does this automatically and now ` +
      `force-materializes placeholders with a read/write round-trip), or mark the ` +
      `file "Always keep on this device" in OneDrive.`,
  );
}

/** Count *.spec.ts under `dir`. Every spec-named entry MUST be a real file (see
 *  assertRealFile) — a placeholder is a hard error, never a silent +1. Directory
 *  recursion uses statSync, which follows the reparse point, so a dehydrated
 *  directory still resolves as a directory even when its dirent type is unhelpful. */
function countSpecs(dir) {
  let count = 0;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);

    if (entry.name.endsWith('.spec.ts')) {
      assertRealFile(full, entry);
      count += 1;
      continue;
    }

    let isDir = entry.isDirectory();
    if (!isDir) {
      try {
        isDir = fs.statSync(full).isDirectory();
      } catch {
        isDir = false;
      }
    }
    if (isDir) count += countSpecs(full);
  }
  return count;
}

module.exports = async function jestSpecCensus() {
  const found = countSpecs(SRC_DIR);

  if (found < EXPECTED_SPEC_COUNT) {
    throw new Error(
      `Spec-file census failed: expected ${EXPECTED_SPEC_COUNT} *.spec.ts under ` +
        `apps/api/src but found ${found}. Jest would run a SUBSET and still pass ` +
        `— aborting instead. Likely cause: OneDrive dehydrated some specs into ` +
        `cloud placeholders; run "npm run hydrate-specs" (the pretest hook does ` +
        `this automatically). If you genuinely removed a spec, lower ` +
        `EXPECTED_SPEC_COUNT in scripts/jest-global-setup.cjs to ${found}.`,
    );
  }

  if (found > EXPECTED_SPEC_COUNT) {
    throw new Error(
      `Spec-file census: found ${found} *.spec.ts under apps/api/src but ` +
        `EXPECTED_SPEC_COUNT is ${EXPECTED_SPEC_COUNT}. You likely added a spec ` +
        `— bump EXPECTED_SPEC_COUNT in scripts/jest-global-setup.cjs to ${found}.`,
    );
  }
};
