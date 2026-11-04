// O que cada plano libera. Código determinístico: a interface esconde o que não é do plano e o servidor barra de verdade.
// Sem imports (testável com `node --test`).

export type PlanId = "gratis" | "familia" | "empresarial";

export type Feature =
  | "mercado" // escolher o mercado
  | "comparar" // comparar preços entre produtos
  | "lista" // lista de compras (manual no gratuito)
  | "propostas" // agente monta a proposta (preço, qualidade...)
  | "compra" // compra automatizada (carrinho + pagamento com confirmação)
  | "agendamento" // compra agendada
  | "financeiro" // dashboard de controle financeiro
  | "limites" // limites de gasto e avisos de promoções
  | "substituicao" // substituição inteligente (com permissão)
  | "automacao" // organização automatizada da lista
  | "nicho" // escolha do nicho da empresa
  | "estoque"; // controle de estoque com insights

const GRATIS: Feature[] = ["mercado", "comparar", "lista"];
const FAMILIA: Feature[] = [...GRATIS, "propostas", "compra", "agendamento", "financeiro", "limites", "substituicao", "automacao"];
const EMPRESARIAL: Feature[] = [...FAMILIA, "nicho", "estoque"];

export const PLAN_FEATURES: Record<PlanId, Feature[]> = { gratis: GRATIS, familia: FAMILIA, empresarial: EMPRESARIAL };
export const PLAN_LABEL: Record<PlanId, string> = { gratis: "Gratuito", familia: "Família", empresarial: "Empresarial" };
export const PLAN_ORDER: PlanId[] = ["gratis", "familia", "empresarial"];

export function parsePlan(value: unknown): PlanId {
  return value === "familia" || value === "empresarial" ? value : "gratis";
}

export function can(plan: PlanId, feature: Feature): boolean {
  return PLAN_FEATURES[plan].includes(feature);
}

/** Menor plano que libera o recurso (para dizer "disponível no plano X"). */
export function planFor(feature: Feature): PlanId {
  return PLAN_ORDER.find((p) => can(p, feature)) ?? "empresarial";
}
