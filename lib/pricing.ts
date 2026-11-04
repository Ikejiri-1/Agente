// Comparação de preços e montagem de carrinho. Sem imports (testável com `node --test`).

export type Store = {
  id: number;
  name: string;
  shippingCents: number;
  freeAboveCents: number; // 0 = não há frete grátis
  etaDays: number;
  quality?: number; // 1 a 5 (demonstração); usado quando o usuário prefere qualidade
};
export type PriceRow = {
  id: number;
  storeId: number;
  product: string;
  unitCents: number;
  source: string;
  updatedAt: string; // ISO
};
export type ListItem = { id: number; name: string; qty: number };

export type CartLine = {
  itemName: string;
  qty: number;
  storeId: number;
  storeName: string;
  product: string;
  unitCents: number;
  subtotalCents: number;
  priceId: number;
  stale: boolean;
};
export type Cart = {
  kind: "single" | "split";
  storeIds: number[];
  storeNames: string[];
  lines: CartLine[];
  missing: string[];
  itemsCents: number;
  shippingCents: number;
  totalCents: number;
  etaDays: number;
};

export const STALE_DAYS = 30;
export const SPLIT_MIN_SAVING_CENTS = 500;

export function normalize(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** O item da lista casa com o produto se todas as palavras do item aparecem no produto. */
export function matches(itemName: string, product: string): boolean {
  const p = normalize(product);
  const tokens = normalize(itemName).split(" ").filter(Boolean);
  return tokens.length > 0 && tokens.every((t) => p.includes(t));
}

export function isStale(updatedAt: string, now: Date): boolean {
  const t = Date.parse(updatedAt);
  if (Number.isNaN(t)) return true;
  return now.getTime() - t > STALE_DAYS * 24 * 60 * 60 * 1000;
}

export function shippingFor(store: Store, itemsCents: number): number {
  if (itemsCents <= 0) return 0;
  if (store.freeAboveCents > 0 && itemsCents >= store.freeAboveCents) return 0;
  return store.shippingCents;
}

/** Produto mais barato da loja que casa com o item (compara preço da embalagem; limitação do MVP). */
function bestLineInStore(item: ListItem, store: Store, prices: PriceRow[], now: Date): CartLine | null {
  let best: PriceRow | null = null;
  for (const p of prices) {
    if (p.storeId !== store.id || p.unitCents <= 0) continue;
    if (!matches(item.name, p.product)) continue;
    if (!best || p.unitCents < best.unitCents) best = p;
  }
  if (!best) return null;
  return {
    itemName: item.name,
    qty: item.qty,
    storeId: store.id,
    storeName: store.name,
    product: best.product,
    unitCents: best.unitCents,
    subtotalCents: best.unitCents * item.qty,
    priceId: best.id,
    stale: isStale(best.updatedAt, now),
  };
}

function finalize(kind: Cart["kind"], lines: CartLine[], missing: string[], stores: Store[]): Cart {
  const byStore = new Map<number, number>();
  for (const l of lines) byStore.set(l.storeId, (byStore.get(l.storeId) ?? 0) + l.subtotalCents);
  const used = stores.filter((s) => byStore.has(s.id));
  const itemsCents = lines.reduce((a, l) => a + l.subtotalCents, 0);
  const shippingCents = used.reduce((a, s) => a + shippingFor(s, byStore.get(s.id) ?? 0), 0);
  return {
    kind,
    storeIds: used.map((s) => s.id),
    storeNames: used.map((s) => s.name),
    lines,
    missing,
    itemsCents,
    shippingCents,
    totalCents: itemsCents + shippingCents,
    etaDays: used.reduce((a, s) => Math.max(a, s.etaDays), 0),
  };
}

export function buildSingleCart(items: ListItem[], store: Store, prices: PriceRow[], now: Date): Cart {
  const lines: CartLine[] = [];
  const missing: string[] = [];
  for (const it of items) {
    const line = bestLineInStore(it, store, prices, now);
    if (line) lines.push(line);
    else missing.push(it.name);
  }
  return finalize("single", lines, missing, [store]);
}

/** Item a item, o mais barato entre todas as lojas (frete somado por loja usada). */
export function buildSplitCart(items: ListItem[], stores: Store[], prices: PriceRow[], now: Date): Cart {
  const lines: CartLine[] = [];
  const missing: string[] = [];
  for (const it of items) {
    let best: CartLine | null = null;
    for (const s of stores) {
      const l = bestLineInStore(it, s, prices, now);
      if (l && (!best || l.unitCents < best.unitCents)) best = l;
    }
    if (best) lines.push(best);
    else missing.push(it.name);
  }
  return finalize("split", lines, missing, stores);
}

export type Choice = { best: Cart | null; candidates: Cart[]; savingCents: number };
export type Criterion = "preco" | "equilibrado" | "qualidade";

const avgQuality = (cart: Cart, stores: Store[]) => {
  const q = cart.storeIds.map((id) => stores.find((s) => s.id === id)?.quality ?? 3);
  return q.length ? q.reduce((a, b) => a + b, 0) / q.length : 3;
};

export function chooseBest(items: ListItem[], stores: Store[], prices: PriceRow[], now: Date, criterion: Criterion = "preco"): Choice {
  const singles = stores
    .map((s) => buildSingleCart(items, s, prices, now))
    .filter((c) => c.lines.length > 0);
  const split = buildSplitCart(items, stores, prices, now);
  const candidates = [...singles];
  if (split.lines.length > 0 && split.storeIds.length > 1) candidates.push(split);
  if (candidates.length === 0) return { best: null, candidates: [], savingCents: 0 };

  // "equilibrado" desconta 5% do total por ponto de qualidade acima de 3; "qualidade" decide primeiro pela nota da loja.
  const score = (c: Cart) => (criterion === "equilibrado" ? c.totalCents / (1 + 0.05 * (avgQuality(c, stores) - 3)) : c.totalCents);
  const rank = (a: Cart, b: Cart) =>
    a.missing.length - b.missing.length ||
    (criterion === "qualidade" ? avgQuality(b, stores) - avgQuality(a, stores) : 0) ||
    score(a) - score(b) ||
    (a.kind === "single" ? -1 : 1) - (b.kind === "single" ? -1 : 1);
  candidates.sort(rank);

  let best = candidates[0];
  if (best.kind === "split" && criterion === "preco") {
    const bestSingle = candidates.find((c) => c.kind === "single");
    if (
      bestSingle &&
      bestSingle.missing.length === best.missing.length &&
      bestSingle.totalCents - best.totalCents < SPLIT_MIN_SAVING_CENTS
    ) {
      best = bestSingle; // ganho pequeno não compensa comprar em várias lojas
    }
  }
  const comparable = candidates.filter((c) => c.missing.length === best.missing.length);
  const worst = Math.max(...comparable.map((c) => c.totalCents));
  return { best, candidates, savingCents: Math.max(0, worst - best.totalCents) };
}
