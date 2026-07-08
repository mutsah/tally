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
// the run WORK (materializes placeholders so jest can discover them); this guard
// makes a silent under-run IMPOSSIBLE.
//
// ── Maintaining the expected count ─────────────────────────────────────────────
// EXPECTED_SPEC_COUNT is the number of `*.spec.ts` files under apps/api/src.
// When you ADD or REMOVE a spec file, update this ONE number to match. If it's
// stale, `npm test` fails on the first run with a message telling you the new
// count — so it can never drift silently.
const EXPECTED_SPEC_COUNT = 14;

const fs = require('node:fs');
const path = require('node:path');

const SRC_DIR = path.join(__dirname, '..', 'src');

/** Count *.spec.ts under `dir`, robust to OneDrive cloud placeholders: match on
 *  the entry NAME (a dehydrated file is still named *.spec.ts), and use statSync
 *  — which follows the reparse point — to recurse into directories that readdir
 *  may report with an unhelpful dirent type. */
function countSpecs(dir) {
  let count = 0;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    let isDir = entry.isDirectory();
    if (!isDir && !entry.name.endsWith('.spec.ts')) {
      try {
        isDir = fs.statSync(full).isDirectory();
      } catch {
        isDir = false;
      }
    }
    if (isDir) {
      count += countSpecs(full);
    } else if (entry.name.endsWith('.spec.ts')) {
      count += 1;
    }
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
