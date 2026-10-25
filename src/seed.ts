import type { NewOrder } from "./orders.js";

/** Demo data inserted on first start. */
export const SEED_ORDERS: NewOrder[] = [
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
