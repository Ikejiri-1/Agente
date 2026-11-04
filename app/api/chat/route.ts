import { getUser } from "@/lib/auth";
import { chat } from "@/lib/chat-agent";

// Freio simples por usuário (memória do processo; suficiente para o MVP): 20 mensagens por minuto.
const recent = new Map<number, number[]>();
function tooFast(userId: number): boolean {
  const now = Date.now();
  const hits = (recent.get(userId) ?? []).filter((t) => now - t < 60_000);
  hits.push(now);
  recent.set(userId, hits);
  return hits.length > 20;
}

export async function POST(request: Request) {
  const user = await getUser();
  if (!user) return Response.json({ error: "Entre na sua conta para conversar." }, { status: 401 });

  // só aceita chamadas feitas pela própria página (defesa contra requisição de outro site)
  const origin = request.headers.get("origin");
  if (origin && new URL(origin).host !== request.headers.get("host")) return Response.json({ error: "Origem não permitida." }, { status: 403 });

  if (tooFast(user.id)) return Response.json({ error: "Muitas mensagens seguidas. Aguarde um instante." }, { status: 429 });

  const body = (await request.json().catch(() => null)) as { message?: unknown } | null;
  const message = typeof body?.message === "string" ? body.message.trim() : "";
  if (!message || message.length > 1000) return Response.json({ error: "Escreva uma mensagem de até 1000 caracteres." }, { status: 400 });

  return Response.json(await chat(user, message));
}
