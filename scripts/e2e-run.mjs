// Runs the whole e2e suite one spec file at a time, each in its own process, so memory is returned
// to the OS between files. A failing file does not stop the run. Results: e2e/last-run/<file>.json
import { spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync, readdirSync, existsSync, rmSync } from 'node:fs';

// Inventory files use their own config and run last (zz-integrity sorts last by name).
const files = readdirSync('e2e').filter((f) => f.endsWith('.e2e.js')).sort();
const isInventory = (f) => f.startsWith('inventory');
// Optional argument: `inventory`, or `core` (users, products, orders, smoke: everything that is not inventory),
// so each half can get fresh emulators.
const only = process.argv[2];
if (only && !['inventory', 'core'].includes(only)) {
  console.error('Usage: npm run e2e:run [-- inventory | core]');
  process.exit(2);
}
const pick = (f) => !only || (only === 'inventory') === isInventory(f);
const GROUPS = [...files.filter((f) => !isInventory(f)), ...files.filter(isInventory)].filter(pick).map((f) => ({
  name: f.replace('.e2e.js', ''),
  args: [`e2e/${f}`, ...(isInventory(f) ? ['-c', 'playwright.inventory.config.js'] : [])],
}));

const OUT = 'e2e/last-run';
mkdirSync(OUT, { recursive: true });

function failures(suite, found = []) {
  for (const spec of suite.specs ?? []) {
    if (!spec.ok) found.push(`${spec.file}:${spec.line} ${spec.title}`);
  }
  for (const child of suite.suites ?? []) failures(child, found);
  return found;
}

const stamp = () => new Date().toTimeString().slice(0, 8);

const rows = [];
const failed = [];
for (const { name, args } of GROUPS) {
  console.log(`\n=== ${stamp()} ${name} ===`);
  const file = `${OUT}/${name}.json`;
  rmSync(file, { force: true }); // a stale report must not pass for this run's
  // --reporter replaces the config's html reporter: the json file is the report.
  spawnSync('npx', ['playwright', 'test', ...args, '--reporter=line,json'], {
    stdio: 'inherit',
    shell: true,
    env: { ...process.env, PLAYWRIGHT_JSON_OUTPUT_NAME: file },
  });
  if (!existsSync(file)) {
    rows.push({ name, error: 'no report written (config error or crash)' });
    continue;
  }
  const report = JSON.parse(readFileSync(file, 'utf8'));
  const { expected, unexpected, flaky, skipped, duration } = report.stats;
  rows.push({
    name, passed: expected, failed: unexpected, flaky, skipped,
    minutes: (duration / 60000).toFixed(1),
  });
  failed.push(...report.suites.flatMap((s) => failures(s)).map((f) => `FAILED [${name}] ${f}`));
  // Printed per file so a killed run still leaves its progress in the output.
  console.log(`RESULT ${stamp()} ${name}: ${expected} passed, ${unexpected} failed, ${flaky} flaky, ${skipped} skipped`);
}

console.log('\n=== Summary ===');
console.table(rows);
failed.forEach((line) => console.log(line));
process.exitCode = rows.some((r) => r.error || r.failed) ? 1 : 0;
