const brlFormatter = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

export function brl(cents: number): string {
  return brlFormatter.format(cents / 100);
}

/** Converte "12,50", "12.50", "R$ 1.234,56" em centavos. Retorna null se inválido. */
export function parseMoneyToCents(input: string): number | null {
  let s = input.replace(/R\$/gi, "").replace(/\s/g, "");
  if (!s) return null;
  if (s.includes(",")) s = s.replace(/\./g, "").replace(",", ".");
  if (!/^\d+(\.\d{1,2})?$/.test(s)) return null;
  const value = Number(s);
  if (!Number.isFinite(value) || value > 1_000_000) return null;
  return Math.round(value * 100);
}
