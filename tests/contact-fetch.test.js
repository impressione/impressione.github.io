import { describe, it } from "node:test";
import assert from "node:assert/strict";
import worker from "../workers/app/index.js";

function mockEnv(overrides = {}) {
  const sent = [];
  return {
    env: {
      CONTACT_QUEUE: { send: async (msg) => sent.push(msg) },
      ASSETS: {
        fetch: async (req) => new Response("asset:" + new URL(req.url).pathname),
      },
      FROM_EMAIL: "contato@impressione.me",
      TEAM_EMAIL: "contato@impressione.me",
      EMAIL: { send: async () => {} },
      ...overrides,
    },
    sent,
  };
}

function postForm(fields) {
  const formData = new FormData();
  for (const [key, value] of Object.entries(fields)) {
    formData.append(key, value);
  }
  return new Request("http://localhost/api/contact", {
    method: "POST",
    body: formData,
  });
}

describe("POST /api/contact", () => {
  it("valid submission -> 303 /contato/obrigado + queued payload", async () => {
    const { env, sent } = mockEnv();
    const res = await worker.fetch(
      postForm({ email: "a@b.com", name: "N", website: "" }),
      env,
    );
    assert.equal(res.status, 303);
    assert.equal(res.headers.get("location"), "/contato/obrigado");
    assert.equal(sent.length, 1);
    assert.deepEqual(sent[0], {
      email: "a@b.com",
      name: "N",
      company: "",
      interest: "",
      message: "",
      submittedAt: sent[0].submittedAt,
      source: "website-contact-form",
    });
  });

  it("invalid email -> 303 /contato/falha, nothing queued", async () => {
    const { env, sent } = mockEnv();
    const res = await worker.fetch(
      postForm({ email: "not-an-email", website: "" }),
      env,
    );
    assert.equal(res.status, 303);
    assert.equal(res.headers.get("location"), "/contato/falha");
    assert.equal(sent.length, 0);
  });

  it("honeypot filled -> fake success, nothing queued", async () => {
    const { env, sent } = mockEnv();
    const res = await worker.fetch(
      postForm({ email: "bot@spam.com", website: "http://spam" }),
      env,
    );
    assert.equal(res.status, 303);
    assert.equal(res.headers.get("location"), "/contato/obrigado");
    assert.equal(sent.length, 0);
  });

  it("wrong content-type -> 303 /contato/falha", async () => {
    const { env, sent } = mockEnv();
    const res = await worker.fetch(
      new Request("http://localhost/api/contact", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "{}",
      }),
      env,
    );
    assert.equal(res.status, 303);
    assert.equal(res.headers.get("location"), "/contato/falha");
    assert.equal(sent.length, 0);
  });

  it("GET -> 405, OPTIONS -> 204", async () => {
    const { env } = mockEnv();
    const get = await worker.fetch(
      new Request("http://localhost/api/contact"),
      env,
    );
    assert.equal(get.status, 405);
    const options = await worker.fetch(
      new Request("http://localhost/api/contact", { method: "OPTIONS" }),
      env,
    );
    assert.equal(options.status, 204);
    assert.equal(options.headers.get("allow"), "POST, OPTIONS");
  });

  it("other paths fall through to ASSETS", async () => {
    const { env } = mockEnv();
    const res = await worker.fetch(new Request("http://localhost/"), env);
    assert.equal(res.status, 200);
    assert.equal(await res.text(), "asset:/");
  });
});
