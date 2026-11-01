// Tests Firestore security rules against the local emulator.
// Run with: npm run test:rules
import { after, before, beforeEach, describe, test } from "node:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import { deleteDoc, doc, getDoc, serverTimestamp, setDoc, updateDoc } from "firebase/firestore";

let env: RulesTestEnvironment;

before(async () => {
  env = await initializeTestEnvironment({
    projectId: "demo-tobacco",
    firestore: { rules: readFileSync(resolve("../firebase/firestore.rules"), "utf8"), host: "127.0.0.1", port: 8080 },
  });
});
after(async () => env.cleanup());

beforeEach(async () => {
  await env.clearFirestore();
  // Seed data as if the Python import script (Admin SDK) had written it.
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, "users/alice/experiments/exp1"), { name: "FedAvg baseline" });
    await setDoc(doc(db, "users/alice/experiments/exp1/rounds/r1"), { round: 1 });
    await setDoc(doc(db, "users/alice/predictions/p1"), { label: "healthy", confidence: 0.9 });
  });
});

const alice = () => env.authenticatedContext("alice").firestore();
const bob = () => env.authenticatedContext("bob").firestore();
const anon = () => env.unauthenticatedContext().firestore();

const goodPrediction = () => ({ label: "wildfire", confidence: 0.8, createdAt: serverTimestamp() });

describe("experiments (read-only for owner)", () => {
  test("owner can read own experiment and its rounds", async () => {
    await assertSucceeds(getDoc(doc(alice(), "users/alice/experiments/exp1")));
    await assertSucceeds(getDoc(doc(alice(), "users/alice/experiments/exp1/rounds/r1")));
  });
  test("another user cannot read it", async () => {
    await assertFails(getDoc(doc(bob(), "users/alice/experiments/exp1")));
    await assertFails(getDoc(doc(bob(), "users/alice/experiments/exp1/rounds/r1")));
  });
  test("signed-out visitor cannot read it", async () => {
    await assertFails(getDoc(doc(anon(), "users/alice/experiments/exp1")));
  });
  test("owner cannot create, edit or delete experiments or rounds", async () => {
    await assertFails(setDoc(doc(alice(), "users/alice/experiments/new"), { name: "x" }));
    await assertFails(updateDoc(doc(alice(), "users/alice/experiments/exp1"), { name: "hacked" }));
    await assertFails(deleteDoc(doc(alice(), "users/alice/experiments/exp1")));
    await assertFails(setDoc(doc(alice(), "users/alice/experiments/exp1/rounds/r2"), { round: 2 }));
  });
});

describe("predictions", () => {
  test("owner can create a valid prediction record", async () => {
    await assertSucceeds(setDoc(doc(alice(), "users/alice/predictions/p2"), goodPrediction()));
  });
  test("cannot create under another user's path", async () => {
    await assertFails(setDoc(doc(bob(), "users/alice/predictions/p2"), goodPrediction()));
  });
  test("signed-out visitor cannot create", async () => {
    await assertFails(setDoc(doc(anon(), "users/alice/predictions/p2"), goodPrediction()));
  });
  test("rejects extra fields, bad confidence, wrong types and client-chosen timestamps", async () => {
    const p = doc(alice(), "users/alice/predictions/p3");
    await assertFails(setDoc(p, { ...goodPrediction(), imageData: "AAAA" }));
    await assertFails(setDoc(p, { ...goodPrediction(), confidence: 1.5 }));
    await assertFails(setDoc(p, { ...goodPrediction(), confidence: "high" }));
    await assertFails(setDoc(p, { ...goodPrediction(), label: "" }));
    await assertFails(setDoc(p, { ...goodPrediction(), createdAt: new Date("2020-01-01") }));
  });
  test("owner can read and delete own, others cannot; updates are blocked", async () => {
    await assertSucceeds(getDoc(doc(alice(), "users/alice/predictions/p1")));
    await assertFails(getDoc(doc(bob(), "users/alice/predictions/p1")));
    await assertFails(updateDoc(doc(alice(), "users/alice/predictions/p1"), { label: "other" }));
    await assertFails(deleteDoc(doc(bob(), "users/alice/predictions/p1")));
    await assertSucceeds(deleteDoc(doc(alice(), "users/alice/predictions/p1")));
  });
});

describe("default deny", () => {
  test("unknown paths are blocked, even for signed-in users", async () => {
    await assertFails(setDoc(doc(alice(), "other/doc"), { a: 1 }));
    await assertFails(getDoc(doc(alice(), "users/alice")));
  });
});
