// The launch calculator (scripts/launch-calc.mjs) does the date, risk, and
// slip arithmetic so the model never does it in its head. These cases were
// recorded from the calculator as it passed its full test suite, and each one
// is replayed here against the script in this folder: same files, same
// command, same exit code, same answer.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { copy, ROOT, run, write } from "./helpers.mjs";

const { sets, cases } = JSON.parse(readFileSync(join(ROOT, "tests/fixtures/calc-cases.json"), "utf8"));

test("there are recorded cases to replay", () => assert.ok(cases.length >= 15));

for (const c of cases) {
  test(`calculator: ${c.name}`, () => {
    const dir = copy();
    for (const [rel, text] of Object.entries(sets[c.set])) write(dir, rel, text);
    const r = run(dir, "scripts/launch-calc.mjs", ...c.args);
    assert.equal(r.status, c.status, r.out);
    assert.deepEqual(r.stdout.trim() ? JSON.parse(r.stdout) : null, c.stdout);
    assert.equal(r.stderr.trim(), c.stderr);
  });
}
