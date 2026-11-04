// Motor de limites: código determinístico, fora do alcance do LLM.
// Sem imports para poder ser testado direto com `node --test`.

export type Limits = { perPurchaseCents: number; monthlyCents: number };
export type Check = { ok: boolean; reasons: string[] };

const fmt = (cents: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);

export function checkLimits(totalCents: number, limits: Limits, spentThisMonthCents: number): Check {
  const reasons: string[] = [];
  if (!Number.isInteger(totalCents) || totalCents <= 0) {
    reasons.push("Total da compra inválido.");
    return { ok: false, reasons };
  }
  if (totalCents > limits.perPurchaseCents) {
    reasons.push(
      `Total ${fmt(totalCents)} acima do limite por compra (${fmt(limits.perPurchaseCents)}).`,
    );
  }
  if (spentThisMonthCents + totalCents > limits.monthlyCents) {
    reasons.push(
      `Já aprovado no mês: ${fmt(spentThisMonthCents)}. Com esta compra passaria do limite mensal (${fmt(limits.monthlyCents)}).`,
    );
  }
  return { ok: reasons.length === 0, reasons };
}

export type CartLineLike = { itemName: string; qty: number; unitCents: number };
export type ListItemLike = { name: string; qty: number };

/** O carrinho só pode conter itens da lista, com quantidade e preço válidos. */
export function validateCartAgainstList(lines: CartLineLike[], list: ListItemLike[]): Check {
  const reasons: string[] = [];
  const byName = new Map(list.map((i) => [i.name, i.qty]));
  for (const l of lines) {
    const allowed = byName.get(l.itemName);
    if (allowed === undefined) {
      reasons.push(`Item fora da lista: ${l.itemName}.`);
    } else if (!Number.isInteger(l.qty) || l.qty <= 0 || l.qty > allowed) {
      reasons.push(`Quantidade inválida para ${l.itemName}.`);
    }
    if (!Number.isInteger(l.unitCents) || l.unitCents <= 0) {
      reasons.push(`Preço inválido para ${l.itemName}.`);
    }
  }
  return { ok: reasons.length === 0, reasons };
}
