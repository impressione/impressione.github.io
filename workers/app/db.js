// Garante o schema em runtime (consumer + scheduled chamam antes de usar).
// Evita depender de `migrations apply` no deploy: o DDL é idempotente
// (IF NOT EXISTS) e o resultado é cacheado por isolate. O teste
// `db-schema.test.js` garante que este DDL é idêntico ao versionado em
// `migrations/0001_contacts.sql` (usado pelo `db:migrate` manual/preview).
const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS contacts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL,
  name TEXT NOT NULL DEFAULT '',
  company TEXT NOT NULL DEFAULT '',
  interest TEXT NOT NULL DEFAULT '',
  message TEXT NOT NULL DEFAULT '',
  submittedAt TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'website-contact-form',
  classification TEXT NOT NULL DEFAULT 'unclassified',
  confidence REAL,
  reason TEXT,
  classified_at TEXT,
  emailed_at TEXT,
  UNIQUE(email, submittedAt)
);
CREATE INDEX IF NOT EXISTS idx_contacts_classified
  ON contacts(classification, submittedAt);
CREATE TABLE IF NOT EXISTS daily_summary (
  day TEXT PRIMARY KEY,
  sent_at TEXT NOT NULL,
  counts TEXT NOT NULL DEFAULT '{}'
);
`;

export function getSchemaSql() {
  return SCHEMA_SQL;
}

let schemaPromise = null;

export function ensureSchema(db) {
  if (!schemaPromise) {
    schemaPromise = db.exec(SCHEMA_SQL).catch((err) => {
      schemaPromise = null;
      throw err;
    });
  }
  return schemaPromise;
}

export function _resetSchemaForTests() {
  schemaPromise = null;
}
