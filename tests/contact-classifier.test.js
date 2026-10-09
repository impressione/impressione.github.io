import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  classifyContact,
  CONFIDENCE_THRESHOLD,
  CONTACT_TYPES,
} from "../workers/app/contact-classifier.js";

function mockAI(answer) {
  return { run: async () => ({ answers: { tipo: answer } }) };
}

describe("contact classifier (clef-flash)", () => {
  it("high-confidence choice -> type with confidence", async () => {
    const ai = mockAI({
      probabilities: { real_contact: 0.91, marketing: 0.06, bot_noise: 0.03 },
    });
    const res = await classifyContact(ai, { message: "x" });
    assert.equal(res.type, "real_contact");
    assert.equal(res.confidence, 0.91);
  });

  it("below threshold -> unclassified (fail-closed)", async () => {
    const ai = mockAI({
      probabilities: { real_contact: 0.5, marketing: 0.4, bot_noise: 0.1 },
    });
    const res = await classifyContact(ai, { message: "x" });
    assert.equal(res.type, "unclassified");
    assert.ok(res.confidence < CONFIDENCE_THRESHOLD);
  });

  it("AI throws -> unclassified with ai-error reason", async () => {
    const ai = { run: async () => { throw new Error("boom"); } };
    const res = await classifyContact(ai, { message: "x" });
    assert.equal(res.type, "unclassified");
    assert.match(res.reason, /ai-error/);
  });

  it("unparseable answer -> unclassified", async () => {
    const ai = mockAI({ nonsense: true });
    const res = await classifyContact(ai, { message: "x" });
    assert.equal(res.type, "unclassified");
  });

  it("phishing answer -> phishing_scam, no email path", async () => {
    const ai = mockAI({
      probabilities: { phishing_scam: 0.93, real_contact: 0.03, marketing: 0.02, bot_noise: 0.01, suspicious_language: 0.01 },
    });
    const res = await classifyContact(ai, { message: "x" });
    assert.equal(res.type, "phishing_scam");
    assert.notEqual(res.type, "real_contact");
  });

  it("other-language answer -> suspicious_language", async () => {
    const ai = mockAI({
      probabilities: { suspicious_language: 0.88, real_contact: 0.07, marketing: 0.03, bot_noise: 0.02, phishing_scam: 0.0 },
    });
    const res = await classifyContact(ai, { message: "x" });
    assert.equal(res.type, "suspicious_language");
  });

  it("sends state + typed question to clef-flash", async () => {
    const calls = [];
    const ai = {
      run: async (model, input) => {
        calls.push([model, input]);
        return { answers: { tipo: { probabilities: { marketing: 0.99, real_contact: 0.01, bot_noise: 0.0 } } } };
      },
    };
    const submission = { name: "N", company: "C", interest: "I", message: "M" };
    const res = await classifyContact(ai, submission);
    assert.equal(calls[0][0], "@cf/cloudflare/clef-flash");
    assert.deepEqual(calls[0][1].state, { name: "N", company: "C", interest: "I", message: "M" });
    assert.equal(calls[0][1].questions.tipo.type, "choice");
    assert.deepEqual(Object.keys(calls[0][1].questions.tipo.criteria).sort(), [...CONTACT_TYPES].sort());
    assert.equal(res.type, "marketing");
  });

  it("golden fixtures stay well-formed", async () => {
    const fixtures = JSON.parse(
      readFileSync(new URL("./fixtures/contacts.json", import.meta.url)),
    );
    assert.ok(fixtures.length >= 6);
    for (const item of fixtures) {
      assert.ok(typeof item.message === "string" && item.message.length > 0);
      assert.ok(
        ["real_contact", "marketing", "bot_noise", "phishing_scam", "suspicious_language"].includes(item.expected),
      );
    }
  });
});
