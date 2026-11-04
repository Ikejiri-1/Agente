// Compra agendada: quando um agendamento vence. Sem imports (testável com `node --test`).

export type ScheduleLike = { dayOfMonth: number; active: boolean; lastRunMonth: string | null };

export const monthKey = (d: Date) => d.toISOString().slice(0, 7);

/** Vence no dia escolhido (1 a 28, para existir em todo mês) e roda uma única vez por mês, mesmo que o painel só seja aberto depois. */
export function isDue(s: ScheduleLike, now: Date): boolean {
  if (!s.active) return false;
  const day = Math.min(28, Math.max(1, Math.trunc(s.dayOfMonth)));
  return now.getUTCDate() >= day && s.lastRunMonth !== monthKey(now);
}

/** Ao criar o agendamento, o mês atual já conta como cumprido se o dia escolhido já passou (ou é hoje): a primeira execução é no mês seguinte.
 *  Sem isso, agendar "dia 1" no dia 3 dispararia uma compra imediatamente. */
export function initialLastRunMonth(dayOfMonth: number, now: Date): string | null {
  const day = Math.min(28, Math.max(1, Math.trunc(dayOfMonth)));
  return now.getUTCDate() >= day ? monthKey(now) : null;
}
