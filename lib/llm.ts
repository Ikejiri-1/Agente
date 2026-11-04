// Provedores de modelo para o chat. O agente (lib/chat-agent.ts) fala com uma interface única;
// aqui ficam os detalhes de cada API. Escolha: LLM_PROVIDER=gemini|claude, ou automático pela chave que existir.
//   GEMINI_API_KEY    -> Gemini (há camada gratuita no Google AI Studio: bom para testar). Modelo: GEMINI_MODEL (padrão gemini-3.8-flash)
//   ANTHROPIC_API_KEY -> Claude. Modelo: ANTHROPIC_MODEL_CHAT (padrão claude-sonnet-5-5)

type Json = Record<string, unknown>;
export type ToolSpec = { name: string; description: string; input_schema: Json };
export type ModelCall = { id: string; name: string; input: Json };
export type ModelTurn = { text: string; calls: ModelCall[]; error?: string };
export type HistoryMessage = { role: "user" | "assistant"; content: string };

/** Uma conversa em andamento com o modelo: cada send() devolve o próximo turno; addResults() devolve o resultado das ferramentas. */
export interface Conversation {
  send(): Promise<ModelTurn>;
  addResults(calls: ModelCall[], outputs: string[]): void;
}
export type Provider = {
  id: "gemini" | "claude";
  label: string;
  start(system: string, history: HistoryMessage[], userText: string, tools: ToolSpec[]): Conversation;
};

const TIMEOUT_MS = 60_000;

// Erros temporários do provedor (sobrecarga, falha momentânea): vale tentar de novo. Cota (429) e chave inválida (400/401/403) não.
const TEMPORARY_STATUS = new Set([500, 502, 503, 504]);
const retryDelaysMs = (): number[] => (process.env.LLM_RETRY_MS ?? "1500,4000").split(",").map(Number).filter((n) => n >= 0);

async function postJson(url: string, headers: Record<string, string>, body: unknown): Promise<{ ok: true; json: Json } | { ok: false; error: string }> {
  const delays = retryDelaysMs();
  for (let attempt = 0; ; attempt++) {
    let status = 0;
    let error: string;
    try {
      const res = await fetch(url, { method: "POST", headers: { "content-type": "application/json", ...headers }, body: JSON.stringify(body), signal: AbortSignal.timeout(TIMEOUT_MS) });
      const json = (await res.json().catch(() => ({}))) as Json;
      if (res.ok) return { ok: true, json };
      status = res.status;
      const detail = (json.error as { message?: string } | undefined)?.message ?? "";
      error = `${res.status}${detail ? `: ${detail.slice(0, 240)}` : ""}`;
    } catch {
      error = "sem resposta do provedor (tempo esgotado ou sem conexão)";
    }
    const temporary = status === 0 || TEMPORARY_STATUS.has(status);
    if (!temporary || attempt >= delays.length) {
      return { ok: false, error: status === 503 ? `${error} Já tentei ${attempt + 1} vezes; tente de novo em instantes.` : error };
    }
    await new Promise((resolve) => setTimeout(resolve, delays[attempt]));
  }
}

// ---------- Claude ----------
type ClaudeBlock = { type: string; text?: string; id?: string; name?: string; input?: Json; tool_use_id?: string; content?: string };

const claude: Provider = {
  id: "claude",
  label: "Claude",
  start(system, history, userText, tools) {
    const messages: { role: "user" | "assistant"; content: string | ClaudeBlock[] }[] = [...history, { role: "user", content: userText }];
    return {
      async send() {
        const r = await postJson(
          "https://api.anthropic.com/v1/messages",
          { "x-api-key": process.env.ANTHROPIC_API_KEY ?? "", "anthropic-version": "2023-06-01" },
          { model: process.env.ANTHROPIC_MODEL_CHAT || "claude-sonnet-5-5", max_tokens: 1200, system, messages, tools },
        );
        if (!r.ok) return { text: "", calls: [], error: r.error };
        const content = ((r.json.content as ClaudeBlock[] | undefined) ?? []);
        messages.push({ role: "assistant", content });
        return {
          text: content.filter((b) => b.type === "text").map((b) => b.text ?? "").join("\n").trim(),
          calls: content.filter((b) => b.type === "tool_use").map((b) => ({ id: b.id ?? "", name: b.name ?? "", input: b.input ?? {} })),
        };
      },
      addResults(calls, outputs) {
        messages.push({ role: "user", content: calls.map((c, i) => ({ type: "tool_result", tool_use_id: c.id, content: outputs[i] })) });
      },
    };
  },
};

// ---------- Gemini ----------
type GeminiPart = Json;

/** O Gemini aceita um subconjunto do JSON Schema: sem `properties` vazio e sem `required` vazio. */
function geminiDeclaration(t: ToolSpec) {
  const schema = t.input_schema as { properties?: Json; required?: string[] };
  const hasParams = schema.properties && Object.keys(schema.properties).length > 0;
  if (!hasParams) return { name: t.name, description: t.description };
  const { required, ...rest } = schema;
  return { name: t.name, description: t.description, parameters: { ...rest, ...(required && required.length ? { required } : {}) } };
}

const gemini: Provider = {
  id: "gemini",
  label: "Gemini",
  start(system, history, userText, tools) {
    const contents: { role: "user" | "model"; parts: GeminiPart[] }[] = [
      ...history.map((m) => ({ role: m.role === "user" ? ("user" as const) : ("model" as const), parts: [{ text: m.content }] })),
      { role: "user", parts: [{ text: userText }] },
    ];
    const model = process.env.GEMINI_MODEL || "gemini-3.8-flash";
    return {
      async send() {
        const r = await postJson(
          `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
          { "x-goog-api-key": process.env.GEMINI_API_KEY ?? "" },
          { systemInstruction: { parts: [{ text: system }] }, contents, tools: tools.length ? [{ functionDeclarations: tools.map(geminiDeclaration) }] : undefined, generationConfig: { maxOutputTokens: 1200 } },
        );
        if (!r.ok) return { text: "", calls: [], error: r.error };
        const candidate = (r.json.candidates as { content?: { parts?: GeminiPart[] }; finishReason?: string }[] | undefined)?.[0];
        const parts = candidate?.content?.parts ?? [];
        if (parts.length === 0) return { text: "", calls: [], error: `o modelo não devolveu resposta (${candidate?.finishReason ?? "bloqueada"})` };
        contents.push({ role: "model", parts }); // as partes voltam intactas (inclui a assinatura de raciocínio que os modelos novos exigem)
        return {
          text: parts.filter((p) => typeof p.text === "string" && !p.thought).map((p) => p.text as string).join("\n").trim(),
          calls: parts.flatMap((p, i) => {
            const fc = p.functionCall as { name?: string; args?: Json } | undefined;
            return fc?.name ? [{ id: `${fc.name}_${i}`, name: fc.name, input: fc.args ?? {} }] : [];
          }),
        };
      },
      addResults(calls, outputs) {
        contents.push({
          role: "user",
          parts: calls.map((c, i) => {
            let resultado: unknown = outputs[i];
            try { resultado = JSON.parse(outputs[i]); } catch { /* texto puro */ }
            return { functionResponse: { name: c.name, response: { resultado } } };
          }),
        });
      },
    };
  },
};

/** Provedor em uso, ou null se nenhuma chave estiver configurada. */
export function pickProvider(): Provider | null {
  const wanted = process.env.LLM_PROVIDER;
  if (wanted === "gemini" && process.env.GEMINI_API_KEY) return gemini;
  if (wanted === "claude" && process.env.ANTHROPIC_API_KEY) return claude;
  if (process.env.GEMINI_API_KEY) return gemini;
  if (process.env.ANTHROPIC_API_KEY) return claude;
  return null;
}
