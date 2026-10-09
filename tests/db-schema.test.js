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

  it("ensureSchema batches single statements once, retries after failure", async () => {
    _resetSchemaForTests();
    let batches = 0;
    const failing = {
      prepare: (sql) => ({ sql }),
      batch: async () => { batches++; throw new Error("d1 down"); },
    };
    await assert.rejects(() => ensureSchema(failing), /d1 down/);

    const prepared = [];
    const ok = {
      prepare: (sql) => {
        prepared.push(sql);
        return { sql };
      },
      batch: async (stmts) => { batches++; return stmts.map(() => ({})); },
    };
    await ensureSchema(ok);
    await ensureSchema(ok);
    assert.equal(batches, 2); // 1 falha + 1 sucesso (2ª chamada usa cache)
    assert.equal(prepared.length, 3);
    assert.ok(prepared.every((sql) => !sql.includes(";")));
    assert.ok(prepared[0].startsWith("CREATE TABLE IF NOT EXISTS contacts"));
  });
});
