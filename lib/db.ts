import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";
import type { DatabaseSync } from "node:sqlite";
import type { ListItem, PriceRow, Store, Cart } from "./pricing.ts";
import { DEMO_EXTRAS } from "./catalog.ts";
import type { Limits } from "./limits.ts";

const nodeRequire = createRequire(path.join(process.cwd(), "package.json"));
type G = typeof globalThis & { __agenteDb?: DatabaseSync };

const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  pass_hash TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS list_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  qty INTEGER NOT NULL CHECK (qty > 0),
  UNIQUE (user_id, name)
);
CREATE TABLE IF NOT EXISTS limits (
  user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  per_purchase_cents INTEGER NOT NULL CHECK (per_purchase_cents > 0),
  monthly_cents INTEGER NOT NULL CHECK (monthly_cents > 0)
);
CREATE TABLE IF NOT EXISTS stores (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  shipping_cents INTEGER NOT NULL,
  free_above_cents INTEGER NOT NULL,
  eta_days INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS prices (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  store_id INTEGER NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  product TEXT NOT NULL,
  unit_cents INTEGER NOT NULL CHECK (unit_cents > 0),
  source TEXT NOT NULL,
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS proposals (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  run_id INTEGER,
  status TEXT NOT NULL CHECK (status IN ('pending','blocked','approved','rejected')),
  cart_json TEXT NOT NULL,
  total_cents INTEGER NOT NULL,
  saving_cents INTEGER NOT NULL,
  justification TEXT NOT NULL,
  block_reasons TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL,
  decided_at TEXT
);
CREATE TABLE IF NOT EXISTS agent_runs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL,
  input_json TEXT NOT NULL,
  steps_json TEXT NOT NULL,
  model TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS user_settings (
  user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  plan TEXT NOT NULL DEFAULT 'gratis',
  store_id INTEGER,
  niche TEXT,
  supervisor_email TEXT,
  allow_substitution INTEGER NOT NULL DEFAULT 0,
  auto_purchase INTEGER NOT NULL DEFAULT 0,
  criterion TEXT NOT NULL DEFAULT 'preco'
);
CREATE TABLE IF NOT EXISTS chat_messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user','assistant')),
  content TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS schedules (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  day_of_month INTEGER NOT NULL CHECK (day_of_month BETWEEN 1 AND 28),
  active INTEGER NOT NULL DEFAULT 1,
  authorize_purchase INTEGER NOT NULL DEFAULT 0,
  last_run_month TEXT,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS purchases (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  proposal_id INTEGER NOT NULL UNIQUE REFERENCES proposals(id),
  total_cents INTEGER NOT NULL,
  gateway TEXT NOT NULL,
  gateway_ref TEXT NOT NULL,
  automatic INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS substitutions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  item_name TEXT NOT NULL,
  from_product TEXT NOT NULL,
  to_product TEXT NOT NULL,
  saving_cents INTEGER NOT NULL,
  reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  created_at TEXT NOT NULL,
  decided_at TEXT
);
CREATE TABLE IF NOT EXISTS promotions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  store_id INTEGER NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  product TEXT NOT NULL,
  promo_cents INTEGER NOT NULL,
  until TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS stock_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  qty REAL NOT NULL,
  min_qty REAL NOT NULL DEFAULT 0,
  unit_cost_cents INTEGER NOT NULL DEFAULT 0,
  last_in_at TEXT,
  last_out_at TEXT,
  UNIQUE (user_id, name)
);
CREATE TABLE IF NOT EXISTS stock_movements (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  item_id INTEGER NOT NULL REFERENCES stock_items(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('in','out')),
  qty REAL NOT NULL CHECK (qty > 0),
  note TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS notifications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  message TEXT NOT NULL,
  created_at TEXT NOT NULL,
  read INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS audit (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER,
  ts TEXT NOT NULL,
  event TEXT NOT NULL,
  payload TEXT NOT NULL
);
`;

// Dados FICTÍCIOS de demonstração (nomes e preços inventados), só para testar o fluxo.
const DEMO_STORES = [
  { name: "Mercado Exemplo Centro", ship: 800, free: 15000, eta: 1 },
  { name: "Supermercado Exemplo Norte", ship: 1200, free: 20000, eta: 2 },
  { name: "Atacarejo Exemplo", ship: 1500, free: 25000, eta: 3 },
];
const DEMO_QUALITY = [5, 4, 3]; // nota de qualidade fictícia de cada loja demo
const DEMO_PRICES: [string, number, number, number][] = [
  // produto, preço loja 1, loja 2, loja 3 (0 = não vende)
  ["Arroz branco 5kg", 2790, 2650, 2390],
  ["Feijão carioca 1kg", 890, 849, 799],
  ["Óleo de soja 900ml", 749, 729, 689],
  ["Açúcar refinado 1kg", 459, 429, 399],
  ["Café torrado 500g", 1890, 1790, 1690],
  ["Leite integral 1L", 549, 529, 499],
  ["Detergente líquido 500ml", 249, 229, 219],
  ["Sabão em pó 1kg", 1290, 1190, 1090],
  ["Papel higiênico 12 rolos", 2290, 2190, 1990],
  ["Macarrão espaguete 500g", 459, 429, 399],
  ["Sal refinado 1kg", 299, 279, 249],
  ["Farinha de trigo 1kg", 549, 519, 479],
  ["Molho de tomate 340g", 349, 329, 0],
  ["Sabonete 90g", 229, 199, 0],
  ["Água sanitária 1L", 399, 379, 349],
];

function seedIfEmpty(db: DatabaseSync) {
  const row = db.prepare("SELECT COUNT(*) AS n FROM stores").get() as unknown as { n: number };
  if (row.n > 0) return;
  const now = new Date().toISOString();
  const insStore = db.prepare(
    "INSERT INTO stores (name, shipping_cents, free_above_cents, eta_days) VALUES (?,?,?,?)",
  );
  const insPrice = db.prepare(
    "INSERT INTO prices (store_id, product, unit_cents, source, updated_at) VALUES (?,?,?,?,?)",
  );
  DEMO_STORES.forEach((s, i) => {
    const r = insStore.run(s.name, s.ship, s.free, s.eta);
    const storeId = Number(r.lastInsertRowid);
    for (const p of DEMO_PRICES) {
      const price = p[i + 1] as number;
      if (price > 0) insPrice.run(storeId, p[0], price, "demo", now);
    }
  });
}

/** Dados fictícios extras (legumes e catálogos por nicho), inseridos uma vez; também ajusta bancos já existentes. */
function seedExtras(db: DatabaseSync) {
  const cols = db.prepare("PRAGMA table_info(stores)").all() as unknown as { name: string }[];
  if (!cols.some((c) => c.name === "quality")) {
    db.exec("ALTER TABLE stores ADD COLUMN quality INTEGER NOT NULL DEFAULT 3");
    DEMO_QUALITY.forEach((q, i) => db.prepare("UPDATE stores SET quality = ? WHERE name = ?").run(q, DEMO_STORES[i].name));
  }
  const stores = db.prepare("SELECT id FROM stores ORDER BY id").all() as unknown as { id: number }[];
  const has = db.prepare("SELECT 1 AS x FROM prices WHERE product = ? LIMIT 1");
  const ins = db.prepare("INSERT INTO prices (store_id, product, unit_cents, source, updated_at) VALUES (?,?,?,?,?)");
  const now = new Date().toISOString();
  for (const e of DEMO_EXTRAS) {
    if (has.get(e[0])) continue;
    stores.slice(0, 3).forEach((s, i) => {
      const preco = e[i + 1] as number;
      if (preco > 0) ins.run(s.id, e[0], preco, "demo", now);
    });
  }
  const promos = db.prepare("SELECT COUNT(*) AS n FROM promotions").get() as unknown as { n: number };
  if (promos.n === 0 && stores.length >= 3) {
    const until = new Date(Date.now() + 7 * 86_400_000).toISOString();
    const insPromo = db.prepare("INSERT INTO promotions (store_id, product, promo_cents, until) VALUES (?,?,?,?)");
    insPromo.run(stores[2].id, "Arroz branco 5kg", 2190, until);
    insPromo.run(stores[1].id, "Tomate kg", 599, until);
    insPromo.run(stores[0].id, "Feijão carioca 1kg", 749, until);
  }
}

export function getDb(): DatabaseSync {
  const g = globalThis as G;
  if (g.__agenteDb) return g.__agenteDb;
  const { DatabaseSync: DB } = nodeRequire("node:sqlite") as typeof import("node:sqlite");
  const file = process.env.DB_PATH || path.join(process.cwd(), "data", "app.db");
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const db = new DB(file);
  db.exec("PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;");
  db.exec(SCHEMA);
  seedIfEmpty(db);
  seedExtras(db);
  g.__agenteDb = db;
  return db;
}

type Row = Record<string, unknown>;
const one = (sql: string, ...p: (string | number | null)[]) =>
  getDb().prepare(sql).get(...p) as unknown as Row | undefined;
const all = (sql: string, ...p: (string | number | null)[]) =>
  getDb().prepare(sql).all(...p) as unknown as Row[];
const run = (sql: string, ...p: (string | number | null)[]) => getDb().prepare(sql).run(...p);

export type User = { id: number; email: string; name: string; passHash: string };

export function findUserByEmail(email: string): User | null {
  const r = one("SELECT id, email, name, pass_hash FROM users WHERE email = ?", email);
  return r ? { id: Number(r.id), email: String(r.email), name: String(r.name), passHash: String(r.pass_hash) } : null;
}
export function findUserById(id: number): User | null {
  const r = one("SELECT id, email, name, pass_hash FROM users WHERE id = ?", id);
  return r ? { id: Number(r.id), email: String(r.email), name: String(r.name), passHash: String(r.pass_hash) } : null;
}

export function createUser(email: string, name: string, passHash: string): number {
  const db = getDb();
  db.exec("BEGIN");
  try {
    const r = run(
      "INSERT INTO users (email, name, pass_hash, created_at) VALUES (?,?,?,?)",
      email,
      name,
      passHash,
      new Date().toISOString(),
    );
    const id = Number(r.lastInsertRowid);
    run("INSERT INTO limits (user_id, per_purchase_cents, monthly_cents) VALUES (?,?,?)", id, 40000, 80000);
    db.exec("COMMIT");
    return id;
  } catch (e) {
    db.exec("ROLLBACK");
    throw e;
  }
}

export function listItems(userId: number): ListItem[] {
  return all("SELECT id, name, qty FROM list_items WHERE user_id = ? ORDER BY name", userId).map((r) => ({
    id: Number(r.id),
    name: String(r.name),
    qty: Number(r.qty),
  }));
}
export function upsertItem(userId: number, name: string, qty: number) {
  run(
    "INSERT INTO list_items (user_id, name, qty) VALUES (?,?,?) ON CONFLICT(user_id, name) DO UPDATE SET qty = excluded.qty",
    userId,
    name,
    qty,
  );
}
export function removeItem(userId: number, id: number) {
  run("DELETE FROM list_items WHERE id = ? AND user_id = ?", id, userId);
}

export function getLimits(userId: number): Limits {
  const r = one("SELECT per_purchase_cents, monthly_cents FROM limits WHERE user_id = ?", userId);
  return {
    perPurchaseCents: Number(r?.per_purchase_cents ?? 40000),
    monthlyCents: Number(r?.monthly_cents ?? 80000),
  };
}
export function saveLimits(userId: number, l: Limits) {
  run(
    "INSERT INTO limits (user_id, per_purchase_cents, monthly_cents) VALUES (?,?,?) ON CONFLICT(user_id) DO UPDATE SET per_purchase_cents = excluded.per_purchase_cents, monthly_cents = excluded.monthly_cents",
    userId,
    l.perPurchaseCents,
    l.monthlyCents,
  );
}

export function listStores(): Store[] {
  return all("SELECT id, name, shipping_cents, free_above_cents, eta_days, quality FROM stores ORDER BY id").map((r) => ({
    quality: Number(r.quality ?? 3),
    id: Number(r.id),
    name: String(r.name),
    shippingCents: Number(r.shipping_cents),
    freeAboveCents: Number(r.free_above_cents),
    etaDays: Number(r.eta_days),
  }));
}
export function listPrices(): PriceRow[] {
  return all("SELECT id, store_id, product, unit_cents, source, updated_at FROM prices").map((r) => ({
    id: Number(r.id),
    storeId: Number(r.store_id),
    product: String(r.product),
    unitCents: Number(r.unit_cents),
    source: String(r.source),
    updatedAt: String(r.updated_at),
  }));
}
export function addPrice(userId: number, storeId: number, product: string, unitCents: number) {
  run(
    "INSERT INTO prices (store_id, product, unit_cents, source, created_by, updated_at) VALUES (?,?,?,?,?,?)",
    storeId,
    product,
    unitCents,
    "user",
    userId,
    new Date().toISOString(),
  );
}

export type ProposalStatus = "pending" | "blocked" | "approved" | "rejected";
export type Proposal = {
  id: number;
  status: ProposalStatus;
  cart: Cart;
  totalCents: number;
  savingCents: number;
  justification: string;
  blockReasons: string[];
  createdAt: string;
  decidedAt: string | null;
};

const toProposal = (r: Row): Proposal => ({
  id: Number(r.id),
  status: String(r.status) as ProposalStatus,
  cart: JSON.parse(String(r.cart_json)) as Cart,
  totalCents: Number(r.total_cents),
  savingCents: Number(r.saving_cents),
  justification: String(r.justification),
  blockReasons: JSON.parse(String(r.block_reasons)) as string[],
  createdAt: String(r.created_at),
  decidedAt: r.decided_at ? String(r.decided_at) : null,
});

export function insertProposal(p: {
  userId: number;
  runId: number;
  status: ProposalStatus;
  cart: Cart;
  savingCents: number;
  justification: string;
  blockReasons: string[];
}): number {
  const r = run(
    "INSERT INTO proposals (user_id, run_id, status, cart_json, total_cents, saving_cents, justification, block_reasons, created_at) VALUES (?,?,?,?,?,?,?,?,?)",
    p.userId,
    p.runId,
    p.status,
    JSON.stringify(p.cart),
    p.cart.totalCents,
    p.savingCents,
    p.justification,
    JSON.stringify(p.blockReasons),
    new Date().toISOString(),
  );
  return Number(r.lastInsertRowid);
}
export function listProposals(userId: number, limit = 10): Proposal[] {
  return all("SELECT * FROM proposals WHERE user_id = ? ORDER BY id DESC LIMIT ?", userId, limit).map(toProposal);
}
export function getProposal(userId: number, id: number): Proposal | null {
  const r = one("SELECT * FROM proposals WHERE id = ? AND user_id = ?", id, userId);
  return r ? toProposal(r) : null;
}

/** Soma das propostas APROVADAS no mês corrente (UTC). */
export function spentThisMonth(userId: number, excludeProposalId = 0): number {
  const month = new Date().toISOString().slice(0, 7);
  const r = one(
    "SELECT COALESCE(SUM(total_cents), 0) AS s FROM proposals WHERE user_id = ? AND status = 'approved' AND substr(decided_at, 1, 7) = ? AND id <> ?",
    userId,
    month,
    excludeProposalId,
  );
  return Number(r?.s ?? 0);
}

export function insertRun(userId: number, input: unknown, steps: unknown, model: string): number {
  const r = run(
    "INSERT INTO agent_runs (user_id, created_at, input_json, steps_json, model) VALUES (?,?,?,?,?)",
    userId,
    new Date().toISOString(),
    JSON.stringify(input),
    JSON.stringify(steps),
    model,
  );
  return Number(r.lastInsertRowid);
}

export function audit(userId: number | null, event: string, payload: unknown) {
  run("INSERT INTO audit (user_id, ts, event, payload) VALUES (?,?,?,?)", userId, new Date().toISOString(), event, JSON.stringify(payload));
}

export function listAudit(userId: number, limit = 15): { ts: string; event: string; payload: string }[] {
  return all("SELECT ts, event, payload FROM audit WHERE user_id = ? ORDER BY id DESC LIMIT ?", userId, limit).map((r) => ({
    ts: String(r.ts),
    event: String(r.event),
    payload: String(r.payload),
  }));
}

/** Aprovação atômica: revalida o limite dentro da transação antes de gravar. */
export function decideProposal(
  userId: number,
  proposalId: number,
  decision: "approved" | "rejected",
  limitCheck: (totalCents: number, spent: number) => { ok: boolean; reasons: string[] },
): { ok: boolean; message: string } {
  const db = getDb();
  db.exec("BEGIN IMMEDIATE");
  try {
    const p = getProposal(userId, proposalId);
    if (!p) {
      db.exec("ROLLBACK");
      return { ok: false, message: "Proposta não encontrada." };
    }
    if (p.status !== "pending") {
      db.exec("ROLLBACK");
      return { ok: false, message: "Esta proposta não está mais pendente." };
    }
    if (decision === "approved") {
      const check = limitCheck(p.totalCents, spentThisMonth(userId, proposalId));
      if (!check.ok) {
        db.exec("ROLLBACK");
        return { ok: false, message: check.reasons.join(" ") };
      }
    }
    run("UPDATE proposals SET status = ?, decided_at = ? WHERE id = ? AND user_id = ?", decision, new Date().toISOString(), proposalId, userId);
    audit(userId, `proposal_${decision}`, { proposalId, totalCents: p.totalCents });
    db.exec("COMMIT");
    return { ok: true, message: decision === "approved" ? "Proposta aprovada." : "Proposta recusada." };
  } catch (e) {
    db.exec("ROLLBACK");
    throw e;
  }
}
