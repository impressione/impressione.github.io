import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  queryPendingReview,
  buildDailySummaryEmail,
} from "../workers/app/daily-summary.js";

// Fake mínimo da API D1: prepare(sql).bind(...).all() -> { results }.
function fakeDb({ counts, items }) {
  return {
    prepare: (sql) => ({
      bind: () => ({
        all: async () => ({
          results: sql.includes("GROUP BY") ? counts : items,
        }),
      }),
    }),
  };
}

describe("daily summary", () => {
  it("builds subject + body with counts and items", () => {
    const { subject, text } = buildDailySummaryEmail({
      day: "2026-10-10",
      counts: { marketing: 2, bot_noise: 1, unclassified: 1 },
      items: [
        {
          submittedAt: "t", email: "a@b.com", name: "A",
          classification: "marketing", confidence: 0.9,
          reason: "", excerpt: "oferta de seo",
        },
      ],
    });
    assert.match(subject, /2 mkt/);
    assert.match(text, /Marketing: 2/);
    assert.match(text, /a@b\.com/);
    assert.match(text, /oferta de seo/);
  });

  it("empty day -> heartbeat body, real contacts excluded by query", async () => {
    const seen = [];
    const db = {
      prepare: (sql) => ({
        bind: (...args) => {
          seen.push(sql);
          return { all: async () => ({ results: [] }) };
        },
      }),
    };
    const { counts, items } = await queryPendingReview(db, "2026-10-09T00:00:00.000Z");
    assert.deepEqual(counts, {});
    assert.deepEqual(items, []);
    assert.ok(seen.every((sql) => sql.includes("!= 'real_contact'")));
    const { text } = buildDailySummaryEmail({ day: "d", counts, items });
    assert.match(text, /Nada a revisar/);
  });
});
