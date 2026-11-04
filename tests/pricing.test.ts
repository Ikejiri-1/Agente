import { test } from "node:test";
import assert from "node:assert/strict";
import {
  chooseBest,
  matches,
  normalize,
  shippingFor,
  isStale,
  type PriceRow,
  type Store,
} from "../lib/pricing.ts";

const NOW = new Date("2026-11-03T12:00:00Z");
const FRESH = "2026-11-01T00:00:00Z";

const stores: Store[] = [
  { id: 1, name: "A", shippingCents: 800, freeAboveCents: 15000, etaDays: 1 },
  { id: 2, name: "B", shippingCents: 1200, freeAboveCents: 0, etaDays: 2 },
];

let pid = 0;
const price = (storeId: number, product: string, unitCents: number, updatedAt = FRESH): PriceRow => ({
  id: ++pid,
  storeId,
  product,
  unitCents,
  source: "test",
  updatedAt,
});

test("normalize remove acentos e pontuação", () => {
  assert.equal(normalize("  Feijão  Carioca, 1kg! "), "feijao carioca 1kg");
});

test("matches exige todas as palavras do item no produto", () => {
  assert.equal(matches("arroz", "Arroz Branco 5kg"), true);
  assert.equal(matches("feijao carioca", "Feijão carioca 1kg"), true);
  assert.equal(matches("feijao preto", "Feijão carioca 1kg"), false);
  assert.equal(matches("", "qualquer"), false);
});

test("frete grátis a partir do mínimo e zero para carrinho vazio", () => {
  assert.equal(shippingFor(stores[0], 14999), 800);
  assert.equal(shippingFor(stores[0], 15000), 0);
  assert.equal(shippingFor(stores[1], 99999), 1200);
  assert.equal(shippingFor(stores[0], 0), 0);
});

test("preço antigo é marcado como desatualizado", () => {
  assert.equal(isStale("2026-09-01T00:00:00Z", NOW), true);
  assert.equal(isStale(FRESH, NOW), false);
  assert.equal(isStale("data-invalida", NOW), true);
});

test("escolhe a loja mais barata considerando frete", () => {
  const items = [{ id: 1, name: "arroz", qty: 1 }];
  const prices = [price(1, "Arroz 5kg", 2000), price(2, "Arroz 5kg", 1500)];
  // A: 2000 + 800 = 2800; B: 1500 + 1200 = 2700
  const { best } = chooseBest(items, stores, prices, NOW);
  assert.equal(best?.storeIds[0], 2);
  assert.equal(best?.totalCents, 2700);
});

test("usa o produto mais barato da loja entre os que casam", () => {
  const items = [{ id: 1, name: "arroz", qty: 2 }];
  const prices = [price(1, "Arroz Premium 5kg", 3000), price(1, "Arroz Comum 5kg", 2000)];
  const { best } = chooseBest(items, [stores[0]], prices, NOW);
  assert.equal(best?.lines[0].product, "Arroz Comum 5kg");
  assert.equal(best?.lines[0].subtotalCents, 4000);
});

test("prefere carrinho completo a um mais barato porém incompleto", () => {
  const items = [
    { id: 1, name: "arroz", qty: 1 },
    { id: 2, name: "cafe", qty: 1 },
  ];
  const prices = [
    price(1, "Arroz 5kg", 1000), // loja A só tem arroz (barata)
    price(2, "Arroz 5kg", 1100),
    price(2, "Café 500g", 1200), // loja B tem tudo
  ];
  const { best } = chooseBest(items, stores, prices, NOW);
  assert.equal(best?.missing.length, 0);
  assert.equal(best?.kind === "split" || best?.storeIds[0] === 2, true);
});

test("não divide em várias lojas por ganho pequeno", () => {
  const items = [
    { id: 1, name: "arroz", qty: 1 },
    { id: 2, name: "cafe", qty: 1 },
  ];
  const prices = [
    price(1, "Arroz 5kg", 2000),
    price(1, "Café 500g", 2000),
    price(2, "Arroz 5kg", 1990), // só 10 centavos mais barato
    price(2, "Café 500g", 2100),
  ];
  const { best } = chooseBest(items, stores, prices, NOW);
  assert.equal(best?.kind, "single");
});

test("sem nenhum preço casando, não há carrinho", () => {
  const { best } = chooseBest([{ id: 1, name: "caviar", qty: 1 }], stores, [price(1, "Arroz", 100)], NOW);
  assert.equal(best, null);
});

test("calcula a economia contra o carrinho mais caro comparável", () => {
  const items = [{ id: 1, name: "arroz", qty: 1 }];
  const prices = [price(1, "Arroz 5kg", 2000), price(2, "Arroz 5kg", 1500)];
  const { savingCents } = chooseBest(items, stores, prices, NOW);
  assert.equal(savingCents, 2800 - 2700);
});
