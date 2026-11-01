// End-to-end check: results imported by the Python script (Admin SDK) can be read, through the
// security rules, by their owner, and parse correctly with the web app's own parser.
// Run with: npm run test:import   (see package.json; the emulator + Python import run first)
import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { assertFails, assertSucceeds, initializeTestEnvironment, type RulesTestEnvironment } from "@firebase/rules-unit-testing";
import { collection, doc, getDoc, getDocs } from "firebase/firestore";
import { parseExperiment, parseRound } from "../lib/experiments";

const SOURCE = resolve("../ml/outputs/D-smoke-s42/result.json");
let env: RulesTestEnvironment;

before(async () => {
  env = await initializeTestEnvironment({
    projectId: "demo-tobacco",
    firestore: { rules: readFileSync(resolve("../firebase/firestore.rules"), "utf8"), host: "127.0.0.1", port: 8080 },
  });
});
after(async () => env.cleanup());

test("imported experiment is readable by its owner and parses to the source values", async () => {
  const src = JSON.parse(readFileSync(SOURCE, "utf8"));
  const db = env.authenticatedContext("alice").firestore();

  const snap = await assertSucceeds(getDoc(doc(db, `users/alice/experiments/${src.id}`)));
  assert.ok(snap.exists(), "experiment document exists");
  const exp = parseExperiment(snap.id, snap.data()!);
  assert.equal(exp.name, src.name);
  assert.equal(exp.summary.accuracy, src.summary.accuracy);
  assert.equal(exp.summary.totalCommBytes, src.summary.totalCommBytes);
  assert.equal(exp.config.compression, "topk");
  assert.equal(exp.perClass.length, 16);
  assert.equal(exp.confusionMatrix.length, 16);
  assert.ok(exp.createdAt instanceof Date);

  const rounds = (await assertSucceeds(getDocs(collection(db, `users/alice/experiments/${src.id}/rounds`)))).docs
    .map((d) => parseRound(d.data()))
    .sort((a, b) => a.round - b.round);
  assert.equal(rounds.length, src.rounds.length);
  assert.equal(rounds[0].commBytes, src.rounds[0].commBytes);
  assert.deepEqual(rounds[0].selectedClients, src.rounds[0].selectedClients);
});

test("another user and signed-out visitors cannot read the imported data", async () => {
  const src = JSON.parse(readFileSync(SOURCE, "utf8"));
  const path = `users/alice/experiments/${src.id}`;
  await assertFails(getDoc(doc(env.authenticatedContext("bob").firestore(), path)));
  await assertFails(getDoc(doc(env.unauthenticatedContext().firestore(), path)));
});
