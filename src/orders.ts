import type { Db } from "./db.js";

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

export type NewOrder = Omit<Order, "id">;

export function listOrders(db: Db, status?: OrderStatus): Order[] {
  return status
    ? (db.prepare("SELECT * FROM orders WHERE status = ? ORDER BY id").all(status) as Order[])
    : (db.prepare("SELECT * FROM orders ORDER BY id").all() as Order[]);
}

export function getOrder(db: Db, id: number): Order | undefined {
  return db.prepare("SELECT * FROM orders WHERE id = ?").get(id) as Order | undefined;
}

/** Returns the updated order, or undefined when no order has this id. */
export function updateOrderStatus(db: Db, id: number, status: OrderStatus): Order | undefined {
  const result = db.prepare("UPDATE orders SET status = ? WHERE id = ?").run(status, id);
  return result.changes === 0 ? undefined : getOrder(db, id);
}
