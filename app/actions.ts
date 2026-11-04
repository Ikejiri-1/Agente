"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import {
  clearFailures,
  createSession,
  destroySession,
  hashPassword,
  recordFailure,
  requireUser,
  tooManyAttempts,
  verifyPassword,
} from "@/lib/auth";
import {
  addPrice,
  audit,
  createUser,
  decideProposal,
  findUserByEmail,
  getLimits,
  listStores,
  removeItem,
  saveLimits,
  upsertItem,
} from "@/lib/db";
import { checkLimits } from "@/lib/limits";
import { parseMoneyToCents } from "@/lib/format";
import { runAgent } from "@/lib/agent";
import { getSettings } from "@/lib/db-painel";
import { can, planFor, PLAN_LABEL, type Feature } from "@/lib/plans";

const text = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();
function go(path: string, kind: "erro" | "ok", msg: string): never {
  redirect(`${path}${path.includes("?") ? "&" : "?"}${kind}=${encodeURIComponent(msg)}`);
}

/** O servidor barra o que o plano do usuário não inclui. */
async function userWith(feature: Feature, back: string) {
  const user = await requireUser();
  if (!can(getSettings(user.id).plan, feature)) go(back, "erro", `Este recurso faz parte do plano ${PLAN_LABEL[planFor(feature)]}.`);
  return user;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function signup(fd: FormData) {
  const name = text(fd, "name");
  const email = text(fd, "email").toLowerCase();
  const password = String(fd.get("password") ?? "");
  if (name.length < 2 || name.length > 80) go("/cadastro", "erro", "Informe um nome válido.");
  if (!EMAIL_RE.test(email) || email.length > 200) go("/cadastro", "erro", "E-mail inválido.");
  if (password.length < 8 || password.length > 200) go("/cadastro", "erro", "A senha precisa ter pelo menos 8 caracteres.");
  if (findUserByEmail(email)) go("/cadastro", "erro", "Não foi possível criar a conta com esses dados.");
  const id = createUser(email, name, hashPassword(password));
  audit(id, "signup", {});
  await createSession(id);
  redirect("/painel");
}

export async function login(fd: FormData) {
  const email = text(fd, "email").toLowerCase();
  const password = String(fd.get("password") ?? "");
  if (tooManyAttempts(email)) go("/login", "erro", "Muitas tentativas. Aguarde alguns minutos.");
  const user = findUserByEmail(email);
  if (!user || !verifyPassword(password, user.passHash)) {
    recordFailure(email);
    go("/login", "erro", "E-mail ou senha incorretos.");
    return;
  }
  clearFailures(email);
  await createSession(user.id);
  audit(user.id, "login", {});
  redirect("/painel");
}

export async function logout() {
  await destroySession();
  redirect("/login");
}

export async function addListItem(fd: FormData) {
  const user = await requireUser();
  const name = text(fd, "name");
  const qty = Number(fd.get("qty"));
  if (name.length < 2 || name.length > 60) go("/painel?aba=lista", "erro", "Nome do item inválido.");
  if (!Number.isInteger(qty) || qty < 1 || qty > 99) go("/painel?aba=lista", "erro", "Quantidade deve ser de 1 a 99.");
  upsertItem(user.id, name.toLowerCase(), qty);
  revalidatePath("/painel");
  redirect("/painel?aba=lista");
}

export async function removeListItem(fd: FormData) {
  const user = await requireUser();
  removeItem(user.id, Number(fd.get("id")));
  revalidatePath("/painel");
  redirect("/painel?aba=lista");
}

export async function updateLimits(fd: FormData) {
  const user = await userWith("limites", "/painel?aba=automacao");
  const per = parseMoneyToCents(text(fd, "perPurchase"));
  const monthly = parseMoneyToCents(text(fd, "monthly"));
  if (!per || !monthly || per <= 0 || monthly <= 0) go("/painel?aba=automacao", "erro", "Informe valores válidos (ex.: 400,00).");
  if (per > monthly) go("/painel?aba=automacao", "erro", "O limite por compra não pode ser maior que o mensal.");
  saveLimits(user.id, { perPurchaseCents: per!, monthlyCents: monthly! });
  audit(user.id, "limits_updated", { per, monthly });
  revalidatePath("/painel");
  go("/painel?aba=automacao", "ok", "Limites salvos.");
}

export async function generateProposal() {
  const user = await userWith("propostas", "/painel?aba=propostas");
  const r = await runAgent(user.id, { storeId: getSettings(user.id).storeId });
  revalidatePath("/painel");
  go("/painel?aba=propostas", r.ok ? "ok" : "erro", r.message);
}

export async function decide(fd: FormData) {
  const user = await userWith("propostas", "/painel?aba=propostas");
  const decision = text(fd, "decision") === "approve" ? "approved" : "rejected";
  const limits = getLimits(user.id);
  const r = decideProposal(user.id, Number(fd.get("id")), decision, (total, spent) => checkLimits(total, limits, spent));
  revalidatePath("/painel");
  go("/painel?aba=propostas", r.ok ? "ok" : "erro", r.message);
}

export async function submitPrice(fd: FormData) {
  const user = await requireUser();
  const storeId = Number(fd.get("storeId"));
  const product = text(fd, "product");
  const cents = parseMoneyToCents(text(fd, "price"));
  if (!listStores().some((s) => s.id === storeId)) go("/precos", "erro", "Loja inválida.");
  if (product.length < 2 || product.length > 80) go("/precos", "erro", "Nome do produto inválido.");
  if (!cents || cents <= 0) go("/precos", "erro", "Preço inválido.");
  addPrice(user.id, storeId, product, cents!);
  audit(user.id, "price_added", { storeId, product, cents });
  revalidatePath("/precos");
  go("/precos", "ok", "Preço registrado.");
}
