import { test } from "node:test";
import assert from "node:assert/strict";
import { checkLimits, validateCartAgainstList } from "../lib/limits.ts";
import { parseMoneyToCents } from "../lib/format.ts";

const limits = { perPurchaseCents: 40000, monthlyCents: 80000 };

test("aprova compra dentro dos limites", () => {
  assert.equal(checkLimits(30000, limits, 0).ok, true);
});

test("bloqueia acima do limite por compra", () => {
  const r = checkLimits(40001, limits, 0);
  assert.equal(r.ok, false);
  assert.match(r.reasons[0], /limite por compra/);
});

test("aceita exatamente o limite por compra", () => {
  assert.equal(checkLimits(40000, limits, 0).ok, true);
});

test("bloqueia quando estoura o limite mensal acumulado", () => {
  const r = checkLimits(30000, limits, 60000);
  assert.equal(r.ok, false);
  assert.match(r.reasons.join(" "), /limite mensal/);
});

test("aceita fechar exatamente o limite mensal", () => {
  assert.equal(checkLimits(20000, limits, 60000).ok, true);
});

test("rejeita total zero, negativo ou não inteiro", () => {
  assert.equal(checkLimits(0, limits, 0).ok, false);
  assert.equal(checkLimits(-5, limits, 0).ok, false);
  assert.equal(checkLimits(10.5, limits, 0).ok, false);
});

test("reporta os dois motivos quando ambos os limites falham", () => {
  const r = checkLimits(50000, limits, 60000);
  assert.equal(r.reasons.length, 2);
});

test("carrinho só pode ter itens da lista e quantidade permitida", () => {
  const list = [{ name: "arroz", qty: 2 }];
  assert.equal(validateCartAgainstList([{ itemName: "arroz", qty: 2, unitCents: 100 }], list).ok, true);
  assert.equal(validateCartAgainstList([{ itemName: "tv", qty: 1, unitCents: 100 }], list).ok, false);
  assert.equal(validateCartAgainstList([{ itemName: "arroz", qty: 3, unitCents: 100 }], list).ok, false);
  assert.equal(validateCartAgainstList([{ itemName: "arroz", qty: 1, unitCents: 0 }], list).ok, false);
});

test("parseMoneyToCents entende formatos brasileiros", () => {
  assert.equal(parseMoneyToCents("12,50"), 1250);
  assert.equal(parseMoneyToCents("R$ 1.234,56"), 123456);
  assert.equal(parseMoneyToCents("12.5"), 1250);
  assert.equal(parseMoneyToCents("400"), 40000);
  assert.equal(parseMoneyToCents("abc"), null);
  assert.equal(parseMoneyToCents("-3"), null);
  assert.equal(parseMoneyToCents(""), null);
});
