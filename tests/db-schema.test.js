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

    const received = [];
    const ok = { exec: async (sql) => { calls++; received.push(sql); } };
    await ensureSchema(ok);
    await ensureSchema(ok);
    assert.equal(calls, 4); // 1 falha + 3 statements (2ª chamada usa cache)
    assert.equal(received.length, 3);
  });

  it("exec receives single statements (D1 rejects multi-statement exec)", async () => {
    _resetSchemaForTests();
    const d1Like = {
      exec: async (sql) => {
        // Reproduz o comportamento real do D1 que quebrou produção.
        if (sql.includes(";")) throw new Error("incomplete input: SQLITE_ERROR");
      },
    };
    await ensureSchema(d1Like); // não deve lançar
  });
});
