// Compra agendada. Não há processo em segundo plano neste MVP: os agendamentos vencidos rodam quando o painel é aberto
// e também por um gatilho externo diário (GET /api/cron com CRON_SECRET), que é o que garante o dia 01 mesmo sem visita.
import { audit, listItems } from "./db.ts";
import { addNotification, getSettings, listSchedules, markScheduleRun, usersWithActiveSchedules } from "./db-painel.ts";
import { runAgent } from "./agent.ts";
import { can } from "./plans.ts";
import { purchaseProposal } from "./purchase.ts";
import { isDue, monthKey } from "./schedule.ts";

export async function runDueSchedules(userId: number, now = new Date()): Promise<number> {
  const settings = getSettings(userId);
  if (!can(settings.plan, "agendamento")) return 0;
  let ran = 0;
  for (const schedule of listSchedules(userId)) {
    if (!isDue(schedule, now)) continue;
    markScheduleRun(schedule.id, monthKey(now)); // marca antes: duas abas abertas não geram duas propostas
    if (listItems(userId).length === 0) {
      addNotification(userId, "agendamento", `A compra agendada do dia ${schedule.dayOfMonth} não rodou: sua lista está vazia.`);
      continue;
    }
    const result = await runAgent(userId, { storeId: settings.storeId });
    ran++;
    if (!result.ok || !result.proposalId) {
      addNotification(userId, "agendamento", `Compra agendada: ${result.message}`);
      continue;
    }
    if (schedule.authorizePurchase && can(settings.plan, "compra")) {
      const paid = await purchaseProposal(userId, result.proposalId, true);
      addNotification(userId, "agendamento", paid.ok ? `Compra agendada concluída (proposta #${result.proposalId}). ${paid.message}` : `Compra agendada: proposta #${result.proposalId} criada, mas não foi paga. ${paid.message}`);
    } else {
      addNotification(userId, "agendamento", `Compra agendada: proposta #${result.proposalId} está pronta para você aprovar.`);
    }
    audit(userId, "schedule_ran", { scheduleId: schedule.id, proposalId: result.proposalId });
  }
  return ran;
}

export async function runAllDueSchedules(now = new Date()): Promise<number> {
  let total = 0;
  for (const userId of usersWithActiveSchedules()) total += await runDueSchedules(userId, now);
  return total;
}
