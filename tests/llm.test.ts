import test from "node:test";
import assert from "node:assert/strict";
import { pickProvider } from "../lib/llm.ts";

const TOOLS = [
  { name: "ver_lista", description: "Lista", input_schema: { type: "object", properties: {}, required: [] } },
  { name: "consultar_precos", description: "Preços", input_schema: { type: "object", properties: { produto: { type: "string" } }, required: ["produto"] } },
];

function withEnv(env: Record<string, string | undefined>, fn: () => Promise<void> | void) {
  const saved: Record<string, string | undefined> = {};
  for (const k of Object.keys(env)) { saved[k] = process.env[k]; if (env[k] === undefined) delete process.env[k]; else process.env[k] = env[k]; }
  const restore = () => { for (const k of Object.keys(saved)) { if (saved[k] === undefined) delete process.env[k]; else process.env[k] = saved[k]; } };
  return Promise.resolve(fn()).finally(restore);
}

test("provedor: escolhe pela chave que existe", async () => {
  await withEnv({ GEMINI_API_KEY: undefined, ANTHROPIC_API_KEY: undefined, LLM_PROVIDER: undefined }, () => assert.equal(pickProvider(), null));
  await withEnv({ GEMINI_API_KEY: "x", ANTHROPIC_API_KEY: undefined, LLM_PROVIDER: undefined }, () => assert.equal(pickProvider()?.id, "gemini"));
  await withEnv({ GEMINI_API_KEY: undefined, ANTHROPIC_API_KEY: "y", LLM_PROVIDER: undefined }, () => assert.equal(pickProvider()?.id, "claude"));
  await withEnv({ GEMINI_API_KEY: "x", ANTHROPIC_API_KEY: "y", LLM_PROVIDER: "claude" }, () => assert.equal(pickProvider()?.id, "claude"));
});

test("gemini: declara ferramentas, lê a chamada e devolve o resultado com as partes intactas", async () => {
  await withEnv({ GEMINI_API_KEY: "chave-falsa", GEMINI_MODEL: "modelo-teste", LLM_PROVIDER: "gemini" }, async () => {
    const pedidos: { url: string; headers: Record<string, string>; body: any }[] = [];
    const respostas = [
      { candidates: [{ content: { role: "model", parts: [{ functionCall: { name: "consultar_precos", args: { produto: "arroz" } }, thoughtSignature: "assinatura-opaca" }] } }] },
      { candidates: [{ content: { role: "model", parts: [{ text: "O arroz mais barato está no Atacarejo." }] } }] },
    ];
    const original = globalThis.fetch;
    globalThis.fetch = (async (url: string, init: { headers: Record<string, string>; body: string }) => {
      pedidos.push({ url: String(url), headers: init.headers, body: JSON.parse(init.body) });
      return new Response(JSON.stringify(respostas.shift()), { status: 200 });
    }) as typeof fetch;
    try {
      const conversa = pickProvider()!.start("sistema", [{ role: "user", content: "oi" }, { role: "assistant", content: "olá" }], "preço do arroz?", TOOLS);
      const turno1 = await conversa.send();
      assert.equal(turno1.calls.length, 1);
      assert.deepEqual(turno1.calls[0].input, { produto: "arroz" });
      conversa.addResults(turno1.calls, ['{"preco":"R$ 23,90"}']);
      const turno2 = await conversa.send();
      assert.equal(turno2.text, "O arroz mais barato está no Atacarejo.");

      const [p1, p2] = pedidos;
      assert.match(p1.url, /models\/modelo-teste:generateContent$/);
      assert.equal(p1.headers["x-goog-api-key"], "chave-falsa");
      const decl = p1.body.tools[0].functionDeclarations;
      assert.equal(decl[0].parameters, undefined, "ferramenta sem parâmetros não leva schema vazio");
      assert.deepEqual(decl[1].parameters.required, ["produto"]);
      assert.deepEqual(p1.body.contents.map((c: { role: string }) => c.role), ["user", "model", "user"]);
      // o segundo pedido repete a chamada do modelo (com a assinatura) e anexa o resultado da ferramenta
      const modelo = p2.body.contents[3];
      assert.equal(modelo.role, "model");
      assert.equal(modelo.parts[0].thoughtSignature, "assinatura-opaca");
      assert.deepEqual(p2.body.contents[4].parts[0].functionResponse, { name: "consultar_precos", response: { resultado: { preco: "R$ 23,90" } } });
    } finally {
      globalThis.fetch = original;
    }
  });
});

test("gemini: erro da API volta como mensagem, sem derrubar o chat", async () => {
  await withEnv({ GEMINI_API_KEY: "chave-falsa", LLM_PROVIDER: "gemini" }, async () => {
    const original = globalThis.fetch;
    globalThis.fetch = (async () => new Response(JSON.stringify({ error: { message: "Quota exceeded" } }), { status: 429 })) as typeof fetch;
    try {
      const turno = await pickProvider()!.start("s", [], "oi", []).send();
      assert.match(turno.error ?? "", /^429: Quota exceeded/);
    } finally {
      globalThis.fetch = original;
    }
  });
});

test("gemini: sobrecarga temporária (503) é tentada de novo e funciona", async () => {
  await withEnv({ GEMINI_API_KEY: "chave-falsa", LLM_PROVIDER: "gemini", LLM_RETRY_MS: "1,1" }, async () => {
    const original = globalThis.fetch;
    const respostas = [
      new Response(JSON.stringify({ error: { message: "high demand" } }), { status: 503 }),
      new Response(JSON.stringify({ error: { message: "high demand" } }), { status: 503 }),
      new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: "Pronto!" }] } }] }), { status: 200 }),
    ];
    let chamadas = 0;
    globalThis.fetch = (async () => { chamadas++; return respostas.shift()!; }) as typeof fetch;
    try {
      const turno = await pickProvider()!.start("s", [], "oi", []).send();
      assert.equal(turno.text, "Pronto!");
      assert.equal(chamadas, 3);
    } finally {
      globalThis.fetch = original;
    }
  });
});

test("gemini: cota esgotada (429) NÃO é repetida, e 503 persistente desiste com aviso", async () => {
  await withEnv({ GEMINI_API_KEY: "chave-falsa", LLM_PROVIDER: "gemini", LLM_RETRY_MS: "1,1" }, async () => {
    const original = globalThis.fetch;
    let chamadas = 0;
    try {
      globalThis.fetch = (async () => { chamadas++; return new Response(JSON.stringify({ error: { message: "Quota exceeded" } }), { status: 429 }); }) as typeof fetch;
      const cota = await pickProvider()!.start("s", [], "oi", []).send();
      assert.equal(chamadas, 1);
      assert.match(cota.error ?? "", /^429/);

      chamadas = 0;
      globalThis.fetch = (async () => { chamadas++; return new Response(JSON.stringify({ error: { message: "high demand" } }), { status: 503 }); }) as typeof fetch;
      const sobrecarga = await pickProvider()!.start("s", [], "oi", []).send();
      assert.equal(chamadas, 3); // 1 tentativa + 2 repetições
      assert.match(sobrecarga.error ?? "", /503.*tente de novo/);
    } finally {
      globalThis.fetch = original;
    }
  });
});
