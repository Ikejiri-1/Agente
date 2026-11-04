// Avisos do plano Família: promoções de itens da lista e proximidade do limite de gasto.
import { getLimits, listItems, spentThisMonth } from "./db.ts";
import { listPromotions } from "./db-painel.ts";
import { brl } from "./format.ts";
import { matches } from "./pricing.ts";

export type Alerta = { nivel: "promo" | "atencao" | "alerta"; texto: string };

export function alertasDoUsuario(userId: number): Alerta[] {
  const out: Alerta[] = [];
  const itens = listItems(userId);
  for (const promo of listPromotions()) {
    const item = itens.find((i) => matches(i.name, promo.product));
    if (item) out.push({ nivel: "promo", texto: `${promo.product} em promoção por ${brl(promo.promoCents)} no ${promo.storeName} (até ${new Date(promo.until).toLocaleDateString("pt-BR")}). Está na sua lista.` });
  }
  const limites = getLimits(userId);
  const gasto = spentThisMonth(userId);
  const uso = limites.monthlyCents > 0 ? gasto / limites.monthlyCents : 0;
  if (uso >= 1) out.push({ nivel: "alerta", texto: `Você atingiu o limite mensal (${brl(gasto)} de ${brl(limites.monthlyCents)}). Novas compras serão bloqueadas.` });
  else if (uso >= 0.8) out.push({ nivel: "atencao", texto: `Você já usou ${Math.round(uso * 100)}% do limite mensal (${brl(gasto)} de ${brl(limites.monthlyCents)}).` });
  return out;
}
