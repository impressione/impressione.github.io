// Resumo diário: agrega contatos não-reais das últimas 24h em 1 e-mail.

export async function queryPendingReview(db, sinceIso) {
  const countsRow = await db
    .prepare(
      `SELECT classification AS type, COUNT(*) AS n FROM contacts
       WHERE submittedAt >= ? AND classification != 'real_contact'
       GROUP BY classification`,
    )
    .bind(sinceIso)
    .all();

  const itemsRow = await db
    .prepare(
      `SELECT submittedAt, email, name, classification, confidence, reason,
              substr(message, 1, 160) AS excerpt
       FROM contacts
       WHERE submittedAt >= ? AND classification != 'real_contact'
       ORDER BY submittedAt DESC LIMIT 20`,
    )
    .bind(sinceIso)
    .all();

  const counts = {};
  for (const row of countsRow.results ?? []) {
    counts[row.type] = row.n;
  }
  return { counts, items: itemsRow.results ?? [] };
}

const TYPE_LABELS = {
  real_contact: "reais",
  marketing: "mkt",
  spam: "spam",
  phishing_scam: "phishing",
  suspicious_language: "idioma",
  unclassified: "pendentes",
};

export function buildDailySummaryEmail({ day, counts, items }) {
  const parts = Object.entries(counts).map(
    ([type, n]) => `${n} ${TYPE_LABELS[type] ?? type}`,
  );

  const lines = [
    `Resumo de contatos — ${day}`,
    "",
    parts.length > 0 ? parts.join(" · ") : "Nada a revisar nas últimas 24h.",
    "",
  ];

  if (items.length === 0) {
    lines.push("Nada a revisar nas últimas 24h.");
  } else {
    for (const item of items) {
      lines.push(
        `- [${item.submittedAt}] ${item.email} (${item.name || "-"}) :: ${item.classification} (conf ${item.confidence ?? "-"})`,
      );
      if (item.reason) lines.push(`  motivo: ${item.reason}`);
      if (item.excerpt) lines.push(`  trecho: ${item.excerpt}`);
    }
  }

  return {
    subject:
      parts.length > 0
        ? `Resumo diário de contatos (${parts.join(" · ")})`
        : "Resumo diário de contatos (nada a revisar)",
    text: lines.join("\n"),
  };
}
