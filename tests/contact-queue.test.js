import { describe, it } from "node:test";
import assert from "node:assert/strict";
import worker from "../workers/app/index.js";

function mockEnv({ changes = 1, rowid = 7 } = {}) {
  const created = [];
  return {
    env: {
      FROM_EMAIL: "contato@impressione.me",
      TEAM_EMAIL: "contato@impressione.me",
      EMAIL: { send: async () => {} },
      DB: {
        prepare: () => ({
          bind: () => ({
            run: async () => ({ meta: { changes, last_row_rowid: rowid } }),
          }),
        }),
      },
      CONTACT_WORKFLOW: {
        create: async (opts) => created.push(opts),
      },
    },
    created,
  };
}

const body = {
  email: "a@b.com",
  name: "Ada",
  company: "Acme",
  interest: "X",
  message: "oi",
  submittedAt: "t",
  source: "website-contact-form",
};

describe("queue consumer (thin: dedupe + workflow.create)", () => {
  it("new message -> saved + workflow instance created", async () => {
    const { env, created } = mockEnv();
    await worker.queue({ messages: [{ body }] }, env);
    assert.equal(created.length, 1);
    assert.equal(created[0].id, "contact-7");
    assert.equal(created[0].params.contactId, 7);
  });

  it("duplicate delivery (changes=0) -> workflow NOT created", async () => {
    const { env, created } = mockEnv({ changes: 0 });
    await worker.queue({ messages: [{ body }] }, env);
    assert.equal(created.length, 0);
  });

  it("missing email / null body -> skipped", async () => {
    const { env, created } = mockEnv();
    await worker.queue(
      { messages: [{ body: { email: "" } }, { body: null }] },
      env,
    );
    assert.equal(created.length, 0);
  });
});
