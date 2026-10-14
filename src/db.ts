import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";

export type Db = Database.Database;

export const ORDER_STATUSES = ["pending", "paid", "shipped", "delivered", "cancelled"] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export interface Order {
  id: number;
  customer: string;
  product: string;
  quantity: number;
  total_cents: number;
  status: OrderStatus;
  created_at: string;
}

export interface AuditEntry {
  id: number;
  username: string;
  tool: string;
  args: string;
  decision: "allowed" | "denied";
  reason: string | null;
  timestamp: string;
}

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

const SEED_ORDERS: Array<Omit<Order, "id">> = [
  { customer: "Alice Martin", product: "Mechanical Keyboard", quantity: 1, total_cents: 12900, status: "delivered", created_at: "2026-09-01T09:12:00Z" },
  { customer: "Bob Nguyen", product: "USB-C Hub", quantity: 2, total_cents: 7998, status: "shipped", created_at: "2026-09-02T14:30:00Z" },
  { customer: "Chloé Dubois", product: "27\" Monitor", quantity: 1, total_cents: 32900, status: "paid", created_at: "2026-09-03T10:05:00Z" },
  { customer: "David Kim", product: "Noise-Cancelling Headphones", quantity: 1, total_cents: 29900, status: "pending", created_at: "2026-09-04T16:45:00Z" },
  { customer: "Emma Rossi", product: "Webcam 4K", quantity: 1, total_cents: 11900, status: "delivered", created_at: "2026-09-05T08:20:00Z" },
  { customer: "Farid Benali", product: "Laptop Stand", quantity: 3, total_cents: 13497, status: "shipped", created_at: "2026-09-06T11:00:00Z" },
  { customer: "Grace Lee", product: "Wireless Mouse", quantity: 2, total_cents: 5998, status: "cancelled", created_at: "2026-09-07T13:15:00Z" },
  { customer: "Hugo Silva", product: "Desk Lamp", quantity: 1, total_cents: 4500, status: "pending", created_at: "2026-09-08T17:40:00Z" },
  { customer: "Inès Haddad", product: "Ergonomic Chair", quantity: 1, total_cents: 45900, status: "paid", created_at: "2026-09-09T09:00:00Z" },
  { customer: "Jonas Weber", product: "External SSD 2TB", quantity: 1, total_cents: 18900, status: "delivered", created_at: "2026-09-10T12:25:00Z" },
  { customer: "Karim Saidi", product: "Microphone", quantity: 1, total_cents: 13900, status: "shipped", created_at: "2026-09-11T15:50:00Z" },
  { customer: "Lena Fischer", product: "Docking Station", quantity: 1, total_cents: 24900, status: "pending", created_at: "2026-09-12T10:10:00Z" },
  { customer: "Marco Bianchi", product: "Mechanical Keyboard", quantity: 2, total_cents: 25800, status: "paid", created_at: "2026-09-13T09:35:00Z" },
  { customer: "Nadia Amrani", product: "Monitor Arm", quantity: 2, total_cents: 15800, status: "delivered", created_at: "2026-09-14T14:00:00Z" },
  { customer: "Oscar Johansson", product: "Webcam 4K", quantity: 1, total_cents: 11900, status: "cancelled", created_at: "2026-09-15T16:20:00Z" },
  { customer: "Priya Sharma", product: "USB-C Cable Pack", quantity: 5, total_cents: 4995, status: "shipped", created_at: "2026-09-16T08:45:00Z" },
  { customer: "Quentin Moreau", product: "Standing Desk", quantity: 1, total_cents: 59900, status: "pending", created_at: "2026-09-17T11:30:00Z" },
  { customer: "Rania Toumi", product: "Noise-Cancelling Headphones", quantity: 1, total_cents: 29900, status: "paid", created_at: "2026-09-18T13:05:00Z" },
  { customer: "Sam Carter", product: "Wireless Charger", quantity: 2, total_cents: 5998, status: "delivered", created_at: "2026-09-19T10:55:00Z" },
  { customer: "Tara O'Neil", product: "Laptop Sleeve", quantity: 1, total_cents: 3500, status: "pending", created_at: "2026-09-20T15:15:00Z" },
];

/** Opens (or creates) the database, applies the schema and seeds orders on first run. */
export function openDb(path: string): Db {
  if (path !== ":memory:") mkdirSync(dirname(path), { recursive: true });
  const db = new Database(path);
  db.pragma("journal_mode = WAL");
  db.exec(SCHEMA);

  const { count } = db.prepare("SELECT COUNT(*) AS count FROM orders").get() as { count: number };
  if (count === 0) {
    const insert = db.prepare(
      `INSERT INTO orders (customer, product, quantity, total_cents, status, created_at)
       VALUES (@customer, @product, @quantity, @total_cents, @status, @created_at)`,
    );
    db.transaction(() => SEED_ORDERS.forEach((o) => insert.run(o)))();
  }
  return db;
}

export function listOrders(db: Db, status?: OrderStatus): Order[] {
  return status
    ? (db.prepare("SELECT * FROM orders WHERE status = ? ORDER BY id").all(status) as Order[])
    : (db.prepare("SELECT * FROM orders ORDER BY id").all() as Order[]);
}

export function getOrder(db: Db, id: number): Order | undefined {
  return db.prepare("SELECT * FROM orders WHERE id = ?").get(id) as Order | undefined;
}

export function updateOrderStatus(db: Db, id: number, status: OrderStatus): Order | undefined {
  const result = db.prepare("UPDATE orders SET status = ? WHERE id = ?").run(status, id);
  return result.changes === 0 ? undefined : getOrder(db, id);
}

export function writeAudit(
  db: Db,
  entry: { username: string; tool: string; args: unknown; decision: "allowed" | "denied"; reason?: string },
): void {
  db.prepare(
    "INSERT INTO audit_log (username, tool, args, decision, reason) VALUES (?, ?, ?, ?, ?)",
  ).run(entry.username, entry.tool, JSON.stringify(entry.args ?? {}), entry.decision, entry.reason ?? null);
}

export function readAudit(db: Db, limit: number): AuditEntry[] {
  return db.prepare("SELECT * FROM audit_log ORDER BY id DESC LIMIT ?").all(limit) as AuditEntry[];
}
