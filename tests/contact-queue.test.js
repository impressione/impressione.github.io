import { describe, it } from "node:test";
import assert from "node:assert/strict";
import worker from "../workers/app/index.js";

function mockEnv() {
  const emails = [];
  return {
    env: {
      FROM_EMAIL: "contato@impressione.me",
      TEAM_EMAIL: "contato@impressione.me",
      EMAIL: { send: async (msg) => emails.push(msg) },
    },
    emails,
  };
}

const submission = {
  email: "a@b.com",
  name: "Ada",
  company: "Acme",
  interest: "IA aplicada e automação",
  message: "Vamos conversar.",
  submittedAt: "2026-10-09T12:00:00.000Z",
  source: "website-contact-form",
};

describe("queue consumer", () => {
  it("valid message -> email with replyTo and formatted body", async () => {
    const { env, emails } = mockEnv();
    await worker.queue({ messages: [{ body: submission }] }, env);
    assert.equal(emails.length, 1);
    assert.equal(emails[0].from, "contato@impressione.me");
    assert.equal(emails[0].to, "contato@impressione.me");
    assert.equal(emails[0].subject, "Novo contato de a@b.com");
    assert.equal(emails[0].replyTo, "a@b.com");
    assert.match(emails[0].text, /Email: a@b\.com/);
    assert.match(emails[0].text, /Empresa: Acme/);
    assert.match(emails[0].text, /Vamos conversar\./);
  });

  it("missing email / null body -> skipped", async () => {
    const { env, emails } = mockEnv();
    await worker.queue(
      { messages: [{ body: { email: "" } }, { body: null }] },
      env,
    );
    assert.equal(emails.length, 0);
  });
});
