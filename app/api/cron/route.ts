import { timingSafeEqual } from "node:crypto";
import { runAllDueSchedules } from "@/lib/scheduler";

// Gatilho externo (um cron diário de verdade: Vercel Cron, GitHub Actions, etc.) das compras agendadas.
// Chame com:  Authorization: Bearer <CRON_SECRET>
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return Response.json({ error: "CRON_SECRET não configurado." }, { status: 503 });
  const given = Buffer.from(request.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${secret}`);
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return Response.json({ error: "Não autorizado." }, { status: 401 });
  return Response.json({ executados: await runAllDueSchedules() });
}
