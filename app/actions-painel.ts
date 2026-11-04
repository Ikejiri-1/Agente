"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { audit, listItems, listStores, removeItem, upsertItem } from "@/lib/db";
import {
  addNotification, addSchedule, clearChat, deleteSchedule, getSettings, getSubstitution, importStock, listStock, markNotificationsRead,
  notifyOnce, recordMovement, saveSettings, setSubstitutionStatus, updateSchedule,
} from "@/lib/db-painel";
import { can, parsePlan, planFor, PLAN_LABEL, type Feature } from "@/lib/plans";
import { purchaseProposal } from "@/lib/purchase";
import { computeInsights, MAX_BYTES, parseStockCsv } from "@/lib/stock";

const text = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function go(aba: string, kind: "erro" | "ok", msg: string): never {
  redirect(`/painel?aba=${aba}&${kind}=${encodeURIComponent(msg)}`);
}

/** Barra no servidor o que o plano do usuário não inclui (a interface já esconde, mas só isto vale). */
async function userWith(feature: Feature, aba: string) {
  const user = await requireUser();
  const settings = getSettings(user.id);
  if (!can(settings.plan, feature)) go(aba, "erro", `Este recurso faz parte do plano ${PLAN_LABEL[planFor(feature)]}.`);
  return { user, settings };
}

// ---------- plano (modo de teste: ainda não há cobrança) ----------
export async function setPlan(fd: FormData) {
  const user = await requireUser();
  const plan = parsePlan(text(fd, "plan"));
  saveSettings(user.id, { plan });
  audit(user.id, "plan_changed", { plan });
  revalidatePath("/painel");
  go("conversa", "ok", `Plano ${PLAN_LABEL[plan]} ativado (modo de teste: nenhuma cobrança é feita).`);
}

// ---------- mercado e preferências ----------
export async function chooseStore(fd: FormData) {
  const { user } = await userWith("mercado", "precos");
  const raw = text(fd, "storeId");
  const id = raw === "" ? null : Number(raw);
  if (id !== null && !listStores().some((s) => s.id === id)) go("precos", "erro", "Mercado inválido.");
  saveSettings(user.id, { storeId: id });
  revalidatePath("/painel");
  go("precos", "ok", id === null ? "Comparando todos os mercados." : "Mercado escolhido.");
}

export async function savePrefs(fd: FormData) {
  const { user, settings } = await userWith("limites", "automacao");
  const criterion = text(fd, "criterion");
  saveSettings(user.id, {
    criterion: criterion === "qualidade" || criterion === "equilibrado" ? criterion : "preco",
    allowSubstitution: fd.get("allowSubstitution") === "on",
  });
  audit(user.id, "prefs_saved", { criterion, plan: settings.plan });
  revalidatePath("/painel");
  go("automacao", "ok", "Preferências salvas.");
}

// ---------- compra ----------
export async function buyProposal(fd: FormData) {
  const user = await requireUser();
  const r = await purchaseProposal(user.id, Number(fd.get("id")));
  revalidatePath("/painel");
  go("propostas", r.ok ? "ok" : "erro", r.message);
}

// ---------- agendamento ----------
export async function createSchedule(fd: FormData) {
  const { user } = await userWith("agendamento", "automacao");
  const day = Number(fd.get("day"));
  if (!Number.isInteger(day) || day < 1 || day > 28) go("automacao", "erro", "Escolha um dia de 1 a 28.");
  const authorize = fd.get("authorize") === "on";
  addSchedule(user.id, day, authorize);
  audit(user.id, "schedule_created", { day, authorize });
  revalidatePath("/painel");
  go("automacao", "ok", authorize ? `Agendado para o dia ${day}, com compra pré-autorizada dentro dos seus limites.` : `Agendado para o dia ${day}: o agente cria a proposta e você aprova.`);
}

export async function changeSchedule(fd: FormData) {
  const { user } = await userWith("agendamento", "automacao");
  const id = Number(fd.get("id"));
  const op = text(fd, "op");
  if (op === "delete") deleteSchedule(user.id, id);
  else if (op === "toggle") updateSchedule(user.id, id, { active: fd.get("active") === "1" });
  else if (op === "authorize") updateSchedule(user.id, id, { authorizePurchase: fd.get("authorize") === "1" });
  audit(user.id, "schedule_changed", { id, op });
  revalidatePath("/painel");
  go("automacao", "ok", "Agendamento atualizado.");
}

// ---------- substituição inteligente: só com a sua permissão ----------
export async function decideSubstitution(fd: FormData) {
  const { user } = await userWith("substituicao", "automacao");
  const sub = getSubstitution(user.id, Number(fd.get("id")));
  if (!sub || sub.status !== "pending") go("automacao", "erro", "Sugestão não encontrada.");
  if (text(fd, "decision") === "approve") {
    const item = listItems(user.id).find((i) => i.name === sub!.itemName);
    if (item) {
      removeItem(user.id, item.id);
      upsertItem(user.id, sub!.toProduct.toLowerCase().slice(0, 60), item.qty);
    }
    setSubstitutionStatus(user.id, sub!.id, "approved");
    audit(user.id, "substitution_approved", { id: sub!.id });
    revalidatePath("/painel");
    go("automacao", "ok", `Pronto: ${sub!.itemName} foi trocado por ${sub!.toProduct}.`);
  }
  setSubstitutionStatus(user.id, sub!.id, "rejected");
  revalidatePath("/painel");
  go("automacao", "ok", "Sugestão recusada; a lista não mudou.");
}

// ---------- empresarial: nicho e estoque ----------
export async function saveNiche(fd: FormData) {
  const { user } = await userWith("nicho", "nicho");
  const chosen = text(fd, "niche") === "outro" ? text(fd, "other") : text(fd, "niche");
  if (chosen.length < 2 || chosen.length > 60) go("nicho", "erro", "Informe o ramo da empresa.");
  saveSettings(user.id, { niche: chosen });
  revalidatePath("/painel");
  go("nicho", "ok", `Nicho definido: ${chosen}.`);
}

export async function uploadStock(fd: FormData) {
  const { user, settings } = await userWith("estoque", "estoque");
  const email = text(fd, "supervisorEmail");
  if (email && !EMAIL_RE.test(email)) go("estoque", "erro", "E-mail do supervisor inválido.");
  if (email !== (settings.supervisorEmail ?? "")) saveSettings(user.id, { supervisorEmail: email || null });

  const file = fd.get("file");
  if (!(file instanceof File) || file.size === 0) go("estoque", "erro", "Escolha o arquivo do estoque (CSV).");
  const f = file as File;
  if (f.size > MAX_BYTES) go("estoque", "erro", "Arquivo grande demais (máximo 1 MB).");
  if (!/\.(csv|txt)$/i.test(f.name)) go("estoque", "erro", "Por enquanto o arquivo precisa ser CSV (no Excel: Salvar como → CSV).");

  const { rows, errors } = parseStockCsv(await f.text());
  if (rows.length === 0) go("estoque", "erro", errors[0] ?? "Nenhuma linha válida no arquivo.");
  importStock(user.id, rows);

  const insights = computeInsights(listStock(user.id), new Date());
  const alvos = insights.filter((i) => i.level !== "info");
  for (const i of alvos) notifyOnce(user.id, "supervisor", i.message);
  if (insights.length) addNotification(user.id, "estoque", `Estoque importado: ${rows.length} itens, ${insights.length} insight(s) para o supervisor${settings.supervisorEmail || email ? "" : " (informe o e-mail do supervisor)"}.`);
  audit(user.id, "stock_imported", { rows: rows.length, errors: errors.length });
  revalidatePath("/painel");
  go("estoque", "ok", `${rows.length} itens importados${errors.length ? `; ${errors.length} linha(s) ignoradas` : ""}.`);
}

export async function addMovement(fd: FormData) {
  const { user } = await userWith("estoque", "estoque");
  const kind = text(fd, "kind") === "in" ? "in" : "out";
  const r = recordMovement(user.id, text(fd, "product"), kind, Number(String(fd.get("qty")).replace(",", ".")), text(fd, "note"));
  if (r.ok) audit(user.id, "stock_movement", { kind });
  revalidatePath("/painel");
  go("estoque", r.ok ? "ok" : "erro", r.ok ? `Registrado. Saldo atual: ${r.newQty}.` : r.message);
}

// ---------- conversa e avisos ----------
export async function clearConversation() {
  const user = await requireUser();
  clearChat(user.id);
}

export async function readNotifications() {
  const user = await requireUser();
  markNotificationsRead(user.id);
  revalidatePath("/painel");
  redirect("/painel");
}
