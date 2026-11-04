// Dados do painel: configurações do plano, conversa, agendamentos, compras, substituições, promoções, estoque e finanças.
import { getDb } from "./db.ts";
import { parsePlan, type PlanId } from "./plans.ts";
import type { Cart, Criterion } from "./pricing.ts";
import { initialLastRunMonth } from "./schedule.ts";

type Row = Record<string, unknown>;
type Param = string | number | null;
const one = (sql: string, ...p: Param[]) => getDb().prepare(sql).get(...p) as unknown as Row | undefined;
const all = (sql: string, ...p: Param[]) => getDb().prepare(sql).all(...p) as unknown as Row[];
const run = (sql: string, ...p: Param[]) => getDb().prepare(sql).run(...p);
const now = () => new Date().toISOString();

// ---------- configurações ----------
export type Settings = {
  plan: PlanId;
  storeId: number | null;
  niche: string | null;
  supervisorEmail: string | null;
  allowSubstitution: boolean;
  autoPurchase: boolean;
  criterion: Criterion;
};

export function getSettings(userId: number): Settings {
  run("INSERT OR IGNORE INTO user_settings (user_id) VALUES (?)", userId);
  const r = one("SELECT * FROM user_settings WHERE user_id = ?", userId)!;
  const criterion = r.criterion === "qualidade" || r.criterion === "equilibrado" ? r.criterion : "preco";
  return {
    plan: parsePlan(r.plan),
    storeId: r.store_id === null ? null : Number(r.store_id),
    niche: r.niche ? String(r.niche) : null,
    supervisorEmail: r.supervisor_email ? String(r.supervisor_email) : null,
    allowSubstitution: Number(r.allow_substitution) === 1,
    autoPurchase: Number(r.auto_purchase) === 1,
    criterion,
  };
}

const COLUMNS: Record<keyof Settings, string> = {
  plan: "plan", storeId: "store_id", niche: "niche", supervisorEmail: "supervisor_email",
  allowSubstitution: "allow_substitution", autoPurchase: "auto_purchase", criterion: "criterion",
};
export function saveSettings(userId: number, patch: Partial<Settings>) {
  getSettings(userId);
  for (const [key, value] of Object.entries(patch) as [keyof Settings, Settings[keyof Settings]][]) {
    const stored = typeof value === "boolean" ? (value ? 1 : 0) : (value as Param);
    run(`UPDATE user_settings SET ${COLUMNS[key]} = ? WHERE user_id = ?`, stored, userId);
  }
}

// ---------- conversa ----------
export type ChatMessage = { id: number; role: "user" | "assistant"; content: string; createdAt: string };
export function listChat(userId: number, limit = 40): ChatMessage[] {
  return all("SELECT id, role, content, created_at FROM (SELECT * FROM chat_messages WHERE user_id = ? ORDER BY id DESC LIMIT ?) ORDER BY id", userId, limit).map((r) => ({
    id: Number(r.id), role: r.role === "assistant" ? "assistant" : "user", content: String(r.content), createdAt: String(r.created_at),
  }));
}
export function addChat(userId: number, role: "user" | "assistant", content: string) {
  run("INSERT INTO chat_messages (user_id, role, content, created_at) VALUES (?,?,?,?)", userId, role, content, now());
}
export function clearChat(userId: number) {
  run("DELETE FROM chat_messages WHERE user_id = ?", userId);
}

// ---------- compra agendada ----------
export type Schedule = { id: number; dayOfMonth: number; active: boolean; authorizePurchase: boolean; lastRunMonth: string | null };
const toSchedule = (r: Row): Schedule => ({
  id: Number(r.id), dayOfMonth: Number(r.day_of_month), active: Number(r.active) === 1,
  authorizePurchase: Number(r.authorize_purchase) === 1, lastRunMonth: r.last_run_month ? String(r.last_run_month) : null,
});
export const listSchedules = (userId: number) => all("SELECT * FROM schedules WHERE user_id = ? ORDER BY day_of_month", userId).map(toSchedule);
export function addSchedule(userId: number, dayOfMonth: number, authorizePurchase: boolean, now = new Date()): number {
  return Number(
    run(
      "INSERT INTO schedules (user_id, day_of_month, active, authorize_purchase, last_run_month, created_at) VALUES (?,?,1,?,?,?)",
      userId, dayOfMonth, authorizePurchase ? 1 : 0, initialLastRunMonth(dayOfMonth, now), now.toISOString(),
    ).lastInsertRowid,
  );
}
export function updateSchedule(userId: number, id: number, patch: { active?: boolean; authorizePurchase?: boolean }) {
  if (patch.active !== undefined) run("UPDATE schedules SET active = ? WHERE id = ? AND user_id = ?", patch.active ? 1 : 0, id, userId);
  if (patch.authorizePurchase !== undefined) run("UPDATE schedules SET authorize_purchase = ? WHERE id = ? AND user_id = ?", patch.authorizePurchase ? 1 : 0, id, userId);
}
export const deleteSchedule = (userId: number, id: number) => void run("DELETE FROM schedules WHERE id = ? AND user_id = ?", id, userId);
/** Usuários com agendamento ativo (para o gatilho externo diário). */
export const usersWithActiveSchedules = (): number[] => all("SELECT DISTINCT user_id FROM schedules WHERE active = 1").map((r) => Number(r.user_id));
export const markScheduleRun = (id: number, month: string) => void run("UPDATE schedules SET last_run_month = ? WHERE id = ?", month, id);

// ---------- compras ----------
export type Purchase = { id: number; proposalId: number; totalCents: number; gateway: string; gatewayRef: string; automatic: boolean; createdAt: string };
const toPurchase = (r: Row): Purchase => ({
  id: Number(r.id), proposalId: Number(r.proposal_id), totalCents: Number(r.total_cents), gateway: String(r.gateway),
  gatewayRef: String(r.gateway_ref), automatic: Number(r.automatic) === 1, createdAt: String(r.created_at),
});
export function recordPurchase(userId: number, proposalId: number, totalCents: number, gateway: string, ref: string, automatic: boolean) {
  run("INSERT INTO purchases (user_id, proposal_id, total_cents, gateway, gateway_ref, automatic, created_at) VALUES (?,?,?,?,?,?,?)", userId, proposalId, totalCents, gateway, ref, automatic ? 1 : 0, now());
}
export const listPurchases = (userId: number, limit = 20) => all("SELECT * FROM purchases WHERE user_id = ? ORDER BY id DESC LIMIT ?", userId, limit).map(toPurchase);
export const purchaseOf = (userId: number, proposalId: number) => {
  const r = one("SELECT * FROM purchases WHERE user_id = ? AND proposal_id = ?", userId, proposalId);
  return r ? toPurchase(r) : null;
};
/** Desfaz a aprovação quando o pagamento falha: a proposta volta a aguardar o usuário. */
export const reopenProposal = (userId: number, proposalId: number) =>
  void run("UPDATE proposals SET status = 'pending', decided_at = NULL WHERE id = ? AND user_id = ? AND status = 'approved'", proposalId, userId);

// ---------- substituição inteligente (só vale depois da permissão do usuário) ----------
export type Substitution = { id: number; itemName: string; fromProduct: string; toProduct: string; savingCents: number; reason: string; status: "pending" | "approved" | "rejected"; createdAt: string };
const toSubstitution = (r: Row): Substitution => ({
  id: Number(r.id), itemName: String(r.item_name), fromProduct: String(r.from_product), toProduct: String(r.to_product),
  savingCents: Number(r.saving_cents), reason: String(r.reason), status: r.status as Substitution["status"], createdAt: String(r.created_at),
});
export function addSubstitution(userId: number, s: Omit<Substitution, "id" | "status" | "createdAt">): number {
  return Number(run("INSERT INTO substitutions (user_id, item_name, from_product, to_product, saving_cents, reason, created_at) VALUES (?,?,?,?,?,?,?)", userId, s.itemName, s.fromProduct, s.toProduct, s.savingCents, s.reason.slice(0, 300), now()).lastInsertRowid);
}
export const listSubstitutions = (userId: number, limit = 20) => all("SELECT * FROM substitutions WHERE user_id = ? ORDER BY id DESC LIMIT ?", userId, limit).map(toSubstitution);
export const getSubstitution = (userId: number, id: number) => {
  const r = one("SELECT * FROM substitutions WHERE id = ? AND user_id = ?", id, userId);
  return r ? toSubstitution(r) : null;
};
export const setSubstitutionStatus = (userId: number, id: number, status: "approved" | "rejected") =>
  void run("UPDATE substitutions SET status = ?, decided_at = ? WHERE id = ? AND user_id = ? AND status = 'pending'", status, now(), id, userId);

// ---------- promoções ----------
export type Promotion = { id: number; storeId: number; storeName: string; product: string; promoCents: number; until: string };
export function listPromotions(): Promotion[] {
  return all("SELECT p.id, p.store_id, s.name AS store_name, p.product, p.promo_cents, p.until FROM promotions p JOIN stores s ON s.id = p.store_id WHERE p.until > ? ORDER BY p.until", now()).map((r) => ({
    id: Number(r.id), storeId: Number(r.store_id), storeName: String(r.store_name), product: String(r.product), promoCents: Number(r.promo_cents), until: String(r.until),
  }));
}

// ---------- estoque (plano empresarial) ----------
export type StockItem = { id: number; name: string; qty: number; minQty: number; unitCostCents: number; lastInAt: string | null; lastOutAt: string | null };
const toStock = (r: Row): StockItem => ({
  id: Number(r.id), name: String(r.name), qty: Number(r.qty), minQty: Number(r.min_qty), unitCostCents: Number(r.unit_cost_cents),
  lastInAt: r.last_in_at ? String(r.last_in_at) : null, lastOutAt: r.last_out_at ? String(r.last_out_at) : null,
});
export const listStock = (userId: number) => all("SELECT * FROM stock_items WHERE user_id = ? ORDER BY name", userId).map(toStock);

/** Importa o arquivo: cria ou atualiza cada item pelo nome, em uma transação. */
export function importStock(userId: number, rows: { name: string; qty: number; minQty: number; unitCostCents: number; lastOutAt: string | null }[]): number {
  const db = getDb();
  db.exec("BEGIN IMMEDIATE");
  try {
    for (const r of rows) {
      run(
        `INSERT INTO stock_items (user_id, name, qty, min_qty, unit_cost_cents, last_out_at) VALUES (?,?,?,?,?,?)
         ON CONFLICT(user_id, name) DO UPDATE SET qty = excluded.qty, min_qty = excluded.min_qty, unit_cost_cents = excluded.unit_cost_cents,
           last_out_at = COALESCE(excluded.last_out_at, stock_items.last_out_at)`,
        userId, r.name, r.qty, r.minQty, r.unitCostCents, r.lastOutAt,
      );
    }
    db.exec("COMMIT");
    return rows.length;
  } catch (e) {
    db.exec("ROLLBACK");
    throw e;
  }
}

/** Entrada ou saída de estoque: sempre registrada. Saída maior que o saldo é recusada. */
export function recordMovement(userId: number, name: string, kind: "in" | "out", qty: number, note: string): { ok: boolean; message: string; newQty?: number } {
  if (!(qty > 0) || qty > 1_000_000) return { ok: false, message: "Quantidade inválida." };
  const db = getDb();
  db.exec("BEGIN IMMEDIATE");
  try {
    let item = one("SELECT * FROM stock_items WHERE user_id = ? AND lower(name) = lower(?)", userId, name);
    if (!item) {
      if (kind === "out") { db.exec("ROLLBACK"); return { ok: false, message: `${name} não está no estoque.` }; }
      run("INSERT INTO stock_items (user_id, name, qty, min_qty, unit_cost_cents) VALUES (?,?,0,0,0)", userId, name);
      item = one("SELECT * FROM stock_items WHERE user_id = ? AND lower(name) = lower(?)", userId, name)!;
    }
    const saldo = Number(item.qty);
    if (kind === "out" && qty > saldo) { db.exec("ROLLBACK"); return { ok: false, message: `Saldo insuficiente de ${item.name}: ${saldo}.` }; }
    const newQty = kind === "in" ? saldo + qty : saldo - qty;
    run(`UPDATE stock_items SET qty = ?, ${kind === "in" ? "last_in_at" : "last_out_at"} = ? WHERE id = ?`, newQty, now(), Number(item.id));
    run("INSERT INTO stock_movements (user_id, item_id, kind, qty, note, created_at) VALUES (?,?,?,?,?,?)", userId, Number(item.id), kind, qty, note.slice(0, 120), now());
    db.exec("COMMIT");
    return { ok: true, message: "Movimentação registrada.", newQty };
  } catch (e) {
    db.exec("ROLLBACK");
    throw e;
  }
}
export type Movement = { id: number; item: string; kind: "in" | "out"; qty: number; note: string; createdAt: string };
export const listMovements = (userId: number, limit = 12): Movement[] =>
  all("SELECT m.id, i.name, m.kind, m.qty, m.note, m.created_at FROM stock_movements m JOIN stock_items i ON i.id = m.item_id WHERE m.user_id = ? ORDER BY m.id DESC LIMIT ?", userId, limit).map((r) => ({
    id: Number(r.id), item: String(r.name), kind: r.kind === "in" ? "in" : "out", qty: Number(r.qty), note: String(r.note), createdAt: String(r.created_at),
  }));

// ---------- notificações (avisos ao supervisor e alertas do painel) ----------
export type Notification = { id: number; kind: string; message: string; createdAt: string; read: boolean };
export const addNotification = (userId: number, kind: string, message: string) =>
  void run("INSERT INTO notifications (user_id, kind, message, created_at) VALUES (?,?,?,?)", userId, kind, message.slice(0, 400), now());
export const listNotifications = (userId: number, limit = 12): Notification[] =>
  all("SELECT * FROM notifications WHERE user_id = ? ORDER BY id DESC LIMIT ?", userId, limit).map((r) => ({
    id: Number(r.id), kind: String(r.kind), message: String(r.message), createdAt: String(r.created_at), read: Number(r.read) === 1,
  }));
export const markNotificationsRead = (userId: number) => void run("UPDATE notifications SET read = 1 WHERE user_id = ?", userId);
/** Evita repetir o mesmo aviso: só cria se não houver um igual nas últimas 24 horas. */
export function notifyOnce(userId: number, kind: string, message: string) {
  const since = new Date(Date.now() - 86_400_000).toISOString();
  if (one("SELECT 1 AS x FROM notifications WHERE user_id = ? AND kind = ? AND message = ? AND created_at > ?", userId, kind, message, since)) return;
  addNotification(userId, kind, message);
}

// ---------- finanças ----------
export type MonthSpend = { month: string; totalCents: number; savingCents: number; count: number };
export function monthlySpend(userId: number, months = 6): MonthSpend[] {
  return all(
    "SELECT substr(decided_at, 1, 7) AS m, SUM(total_cents) AS t, SUM(saving_cents) AS s, COUNT(*) AS n FROM proposals WHERE user_id = ? AND status = 'approved' GROUP BY m ORDER BY m DESC LIMIT ?",
    userId, months,
  ).map((r) => ({ month: String(r.m), totalCents: Number(r.t), savingCents: Number(r.s), count: Number(r.n) })).reverse();
}
export function approvedCarts(userId: number, month: string): Cart[] {
  return all("SELECT cart_json FROM proposals WHERE user_id = ? AND status = 'approved' AND substr(decided_at, 1, 7) = ?", userId, month).map((r) => JSON.parse(String(r.cart_json)) as Cart);
}
