import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { SEED_ORDERS } from "./seed.js";

export type Db = Database.Database;

const SCHEMA = `
CREATE TABLE IF NOT EXISTS orders (
  id          INTEGER PRIMARY KEY,
  customer    TEXT    NOT NULL,
  product     TEXT    NOT NULL,
  quantity    INTEGER NOT NULL,
  total_cents INTEGER NOT NULL,
  status      TEXT    NOT NULL,
  created_at  TEXT    NOT NULL
);

CREATE TABLE IF NOT EXISTS audit_log (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  username  TEXT NOT NULL,
  tool      TEXT NOT NULL,
  args      TEXT NOT NULL,
  decision  TEXT NOT NULL CHECK (decision IN ('allowed', 'denied')),
  reason    TEXT,
  timestamp TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
`;

/** Opens (or creates) the database, applies the schema and seeds orders on first run. */
export function openDb(path: string): Db {
  if (path !== ":memory:") mkdirSync(dirname(path), { recursive: true });
  const db = new Database(path);
  db.pragma("journal_mode = WAL");
  db.exec(SCHEMA);
  seedOrdersIfEmpty(db);
  return db;
}

function seedOrdersIfEmpty(db: Db): void {
  const { count } = db.prepare("SELECT COUNT(*) AS count FROM orders").get() as { count: number };
  if (count > 0) return;

  const insert = db.prepare(
    `INSERT INTO orders (customer, product, quantity, total_cents, status, created_at)
     VALUES (@customer, @product, @quantity, @total_cents, @status, @created_at)`,
  );
  db.transaction(() => SEED_ORDERS.forEach((order) => insert.run(order)))();
}
