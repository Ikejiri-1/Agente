import test from "node:test";
import assert from "node:assert/strict";
import { can, parsePlan, planFor } from "../lib/plans.ts";
import { categoryOf } from "../lib/catalog.ts";
import { computeInsights, parseStockCsv } from "../lib/stock.ts";
import { initialLastRunMonth, isDue } from "../lib/schedule.ts";
import { chooseBest, type PriceRow, type Store } from "../lib/pricing.ts";

test("planos: cada plano libera só o que é dele", () => {
  assert.equal(can("gratis", "comparar"), true);
  assert.equal(can("gratis", "propostas"), false);
  assert.equal(can("gratis", "compra"), false);
  assert.equal(can("familia", "agendamento"), true);
  assert.equal(can("familia", "estoque"), false);
  assert.equal(can("empresarial", "estoque"), true);
  assert.equal(can("empresarial", "compra"), true);
  assert.equal(planFor("estoque"), "empresarial");
  assert.equal(parsePlan("qualquer coisa"), "gratis");
});

test("categorias: óleo de motor não vira grão", () => {
  assert.equal(categoryOf("Óleo de motor 15W40 20L"), "Automotivo");
  assert.equal(categoryOf("Óleo de soja 900ml"), "Grãos e básicos");
  assert.equal(categoryOf("Tomate kg"), "Legumes e verduras");
  assert.equal(categoryOf("Cimento 50kg"), "Construção");
  assert.equal(categoryOf("Coisa qualquer"), "Outros");
});

test("estoque: lê CSV brasileiro e acusa linhas ruins", () => {
  const csv = "Produto;Quantidade;Mínimo;Custo;Última saída\nCimento 50kg;120;200;38,90;10/01/2026\nTijolo;abc;10;1,2;\nBrita;50;10;130,00;";
  const { rows, errors } = parseStockCsv(csv);
  assert.equal(rows.length, 2);
  assert.equal(rows[0].unitCostCents, 3890);
  assert.equal(rows[0].lastOutAt?.slice(0, 10), "2026-01-10");
  assert.equal(errors.length, 1);
  assert.match(errors[0], /Linha 3/);
  assert.equal(parseStockCsv("nome;x\na;1").errors[0].includes("obrigatórias"), true);
});

test("estoque: insights de reposição, parado e excesso", () => {
  const now = new Date("2026-11-03T12:00:00Z");
  const insights = computeInsights(
    [
      { name: "Cimento", qty: 0, minQty: 50, unitCostCents: 3890, lastOutAt: "2026-10-30T00:00:00Z" },
      { name: "Brita", qty: 40, minQty: 10, unitCostCents: 13000, lastOutAt: "2026-01-01T00:00:00Z" },
      { name: "Areia", qty: 500, minQty: 10, unitCostCents: 100, lastOutAt: "2026-11-01T00:00:00Z" },
    ],
    now,
  );
  assert.equal(insights[0].level, "alerta"); // sem estoque vem primeiro
  assert.equal(insights[0].kind, "repor");
  assert.ok(insights.some((i) => i.kind === "parado" && i.item === "Brita"));
  assert.ok(insights.some((i) => i.kind === "excesso" && i.item === "Areia"));
});

test("agendamento: vence no dia, uma vez por mês", () => {
  const dia1 = new Date("2026-12-01T09:00:00Z");
  assert.equal(isDue({ dayOfMonth: 1, active: true, lastRunMonth: null }, dia1), true);
  assert.equal(isDue({ dayOfMonth: 1, active: true, lastRunMonth: "2026-12" }, dia1), false);
  assert.equal(isDue({ dayOfMonth: 15, active: true, lastRunMonth: null }, dia1), false);
  assert.equal(isDue({ dayOfMonth: 1, active: false, lastRunMonth: null }, dia1), false);
  // painel aberto só no dia 5: o dia 1 ainda não rodou neste mês, então roda agora
  assert.equal(isDue({ dayOfMonth: 1, active: true, lastRunMonth: "2026-11" }, new Date("2026-12-05T00:00:00Z")), true);
});

test("critério de qualidade escolhe a loja mais bem avaliada, mesmo mais cara", () => {
  const stores: Store[] = [
    { id: 1, name: "Boa", shippingCents: 0, freeAboveCents: 0, etaDays: 1, quality: 5 },
    { id: 2, name: "Barata", shippingCents: 0, freeAboveCents: 0, etaDays: 1, quality: 2 },
  ];
  const now = new Date();
  const prices: PriceRow[] = [
    { id: 1, storeId: 1, product: "Arroz 5kg", unitCents: 3000, source: "demo", updatedAt: now.toISOString() },
    { id: 2, storeId: 2, product: "Arroz 5kg", unitCents: 2000, source: "demo", updatedAt: now.toISOString() },
  ];
  const items = [{ id: 1, name: "arroz", qty: 1 }];
  assert.equal(chooseBest(items, stores, prices, now, "preco").best?.storeNames[0], "Barata");
  assert.equal(chooseBest(items, stores, prices, now, "qualidade").best?.storeNames[0], "Boa");
});

test("agendar não compra na hora: o primeiro disparo é no mês seguinte quando o dia já passou", () => {
  const dia3 = new Date("2026-11-03T12:00:00Z");
  const recemCriado = (day: number) => ({ dayOfMonth: day, active: true, lastRunMonth: initialLastRunMonth(day, dia3) });
  assert.equal(isDue(recemCriado(1), dia3), false); // dia 1 já passou: nada de compra imediata
  assert.equal(isDue(recemCriado(3), dia3), false); // hoje também espera
  assert.equal(isDue(recemCriado(10), dia3), false); // ainda não chegou
  assert.equal(isDue(recemCriado(10), new Date("2026-11-10T08:00:00Z")), true); // chegando o dia, roda
  assert.equal(isDue(recemCriado(1), new Date("2026-12-01T08:00:00Z")), true); // dia 1 do mês seguinte
});
