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
