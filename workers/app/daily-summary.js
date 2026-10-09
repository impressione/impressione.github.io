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

export function buildDailySummaryEmail({ day, counts, items }) {
  const marketing = counts.marketing ?? 0;
  const bot = counts.bot_noise ?? 0;
  const pending = counts.unclassified ?? 0;

  const lines = [
    `Resumo de contatos — ${day}`,
    "",
    `Marketing: ${marketing} · Bot noise: ${bot} · Pendentes: ${pending}`,
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
    subject: `Resumo diário de contatos (${marketing} mkt · ${bot} bot · ${pending} pendentes)`,
    text: lines.join("\n"),
  };
}
