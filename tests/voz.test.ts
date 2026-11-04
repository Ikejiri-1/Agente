import test from "node:test";
import assert from "node:assert/strict";
import { dividirParaFala, mensagemDeErroDeVoz, textoParaFala } from "../lib/voz.ts";

test("voz: tira markdown, emojis e símbolos antes de falar", () => {
  const falado = textoParaFala("**Arroz** é mais barato no [Atacarejo](http://x.com) 🛒\n- Feijão: R$ 7,99\n- 2 × óleo → ok");
  assert.equal(falado.includes("*"), false);
  assert.equal(falado.includes("http"), false);
  assert.equal(falado.includes("🛒"), false);
  assert.match(falado, /Arroz é mais barato no Atacarejo/);
  assert.match(falado, /R\$ 7,99/);
  assert.match(falado, /2 vezes óleo para ok/);
});

test("voz: fim de linha sem pontuação vira pausa, e com pontuação não duplica", () => {
  assert.equal(textoParaFala("Olá\nTudo bem?\nSim"), "Olá. Tudo bem? Sim");
});

test("voz: divide em pedaços curtos sem perder texto", () => {
  const texto = "Primeira frase curta. Segunda frase também curta! " + "palavra ".repeat(60).trim() + ". Última?";
  const partes = dividirParaFala(texto, 80);
  assert.ok(partes.every((p) => p.length <= 80), "nenhum pedaço passa do limite");
  assert.equal(partes.join(" ").replace(/\s+/g, " "), texto.replace(/\s+/g, " "));
  assert.deepEqual(dividirParaFala("Oi. Tudo bem?", 180), ["Oi. Tudo bem?"], "frases curtas ficam juntas");
  assert.deepEqual(dividirParaFala("", 180), []);
});

test("voz: mensagens de erro do reconhecimento", () => {
  assert.equal(mensagemDeErroDeVoz("aborted"), null);
  assert.match(mensagemDeErroDeVoz("not-allowed")!, /bloqueado/);
  assert.match(mensagemDeErroDeVoz("no-speech")!, /Não ouvi/);
  assert.match(mensagemDeErroDeVoz("audio-capture")!, /microfone/);
  assert.match(mensagemDeErroDeVoz("outra-coisa")!, /outra-coisa/);
});
