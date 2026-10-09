import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  ensureSchema,
  getSchemaSql,
  _resetSchemaForTests,
} from "../workers/app/db.js";

const normalize = (sql) => sql.replace(/\s+/g, " ").trim();

describe("db schema", () => {
  it("embedded DDL matches versioned migration file", () => {
    const file = readFileSync(
      new URL("../workers/app/migrations/0001_contacts.sql", import.meta.url),
      "utf8",
    );
    assert.equal(normalize(getSchemaSql()), normalize(file));
  });

  it("ensureSchema runs once per isolate, retries after failure", async () => {
    _resetSchemaForTests();
    let calls = 0;
    const failing = { exec: async () => { calls++; throw new Error("d1 down"); } };
    await assert.rejects(() => ensureSchema(failing), /d1 down/);

    const ok = { exec: async () => { calls++; } };
    await ensureSchema(ok);
    await ensureSchema(ok);
    assert.equal(calls, 2); // 1 falha + 1 sucesso (2ª chamada usa cache)
  });
});
