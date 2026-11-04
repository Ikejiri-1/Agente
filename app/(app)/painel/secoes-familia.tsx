import { getLimits, spentThisMonth } from "@/lib/db";
import { approvedCarts, listPurchases, listSchedules, listSubstitutions, monthlySpend, type Settings } from "@/lib/db-painel";
import { alertasDoUsuario } from "@/lib/alertas";
import { categoryOf } from "@/lib/catalog";
import { brl } from "@/lib/format";
import { monthKey } from "@/lib/schedule";
import { updateLimits } from "@/app/actions";
import { changeSchedule, createSchedule, decideSubstitution, savePrefs } from "@/app/actions-painel";

const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const virgula = (cents: number) => brl(cents).replace(",00", "");

function ultimosMeses(n: number, agora: Date): string[] {
  return Array.from({ length: n }, (_, i) => {
    const d = new Date(Date.UTC(agora.getUTCFullYear(), agora.getUTCMonth() - (n - 1 - i), 1));
    return monthKey(d);
  });
}

/** Barras dos últimos 6 meses (aprovado) com a linha tracejada do limite mensal. */
function GraficoMensal({ meses, valores, limite, atual }: { meses: string[]; valores: number[]; limite: number; atual: string }) {
  const L = 520, A = 180, base = 150, topo = 22;
  const maximo = Math.max(limite, ...valores, 1);
  const y = (v: number) => base - (v / maximo) * (base - topo);
  const largura = (L - 20) / meses.length;
  return (
    <svg className="pn-grafico" viewBox={`0 0 ${L} ${A}`} role="img" aria-label="Gasto aprovado por mês, com o limite mensal tracejado">
      <defs>
        <linearGradient id="pn-barra" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#8fe3ff" /><stop offset="1" stopColor="#1b8bff" /></linearGradient>
        <linearGradient id="pn-barra-ouro" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#ffe3a3" /><stop offset="1" stopColor="#f3a93a" /></linearGradient>
      </defs>
      <line x1="10" x2={L - 10} y1={base} y2={base} stroke="rgba(140,215,255,0.35)" />
      <line x1="10" x2={L - 10} y1={y(limite)} y2={y(limite)} stroke="#f3c76a" strokeDasharray="5 5" opacity="0.8" />
      <text x={L - 12} y={y(limite) - 5} textAnchor="end" style={{ fill: "#f3c76a" }}>limite {virgula(limite)}</text>
      {meses.map((m, i) => {
        const v = valores[i];
        const x = 10 + i * largura + largura * 0.2;
        const w = largura * 0.6;
        return (
          <g key={m}>
            {v > 0 && <rect x={x} y={y(v)} width={w} height={base - y(v)} rx="5" fill={m === atual ? "url(#pn-barra-ouro)" : "url(#pn-barra)"} style={{ filter: "drop-shadow(0 0 8px rgba(95,211,255,0.55))" }} />}
            {v > 0 && <text className="valor" x={x + w / 2} y={y(v) - 6} textAnchor="middle">{virgula(v)}</text>}
            <text x={x + w / 2} y={base + 18} textAnchor="middle">{MESES[Number(m.slice(5)) - 1]}</text>
          </g>
        );
      })}
    </svg>
  );
}

export function SecaoFinancas({ userId }: { userId: number }) {
  const agora = new Date();
  const limites = getLimits(userId);
  const gasto = spentThisMonth(userId);
  const meses = ultimosMeses(6, agora);
  const serie = monthlySpend(userId, 12);
  const valores = meses.map((m) => serie.find((s) => s.month === m)?.totalCents ?? 0);
  const economia = serie.reduce((a, s) => a + s.savingCents, 0);
  const compras = serie.reduce((a, s) => a + s.count, 0);
  const uso = limites.monthlyCents > 0 ? gasto / limites.monthlyCents : 0;
  const nivel = uso >= 1 ? "alerta" : uso >= 0.8 ? "atencao" : "";

  const porCategoria = new Map<string, number>();
  for (const cart of approvedCarts(userId, monthKey(agora))) {
    for (const l of cart.lines) porCategoria.set(categoryOf(l.product), (porCategoria.get(categoryOf(l.product)) ?? 0) + l.subtotalCents);
  }
  const categorias = [...porCategoria.entries()].sort((a, b) => b[1] - a[1]);
  const maiorCategoria = Math.max(1, ...categorias.map(([, v]) => v));
  const recentes = listPurchases(userId, 5);

  return (
    <section className="nx-hud pn-card">
      <p className="nx-kicker">Controle financeiro</p>
      <h2>Para onde vai o seu dinheiro</h2>
      <div className="pn-kpis">
        <div className="pn-kpi"><span>Aprovado no mês</span><strong>{brl(gasto)}</strong><small>de {brl(limites.monthlyCents)}</small></div>
        <div className="pn-kpi"><span>Ainda disponível</span><strong>{brl(Math.max(0, limites.monthlyCents - gasto))}</strong><small>limite por compra: {brl(limites.perPurchaseCents)}</small></div>
        <div className="pn-kpi"><span>Economia acumulada</span><strong className="pn-ouro">{brl(economia)}</strong><small>{compras} compra(s) aprovada(s)</small></div>
      </div>
      <div className={`pn-medidor ${nivel}`} role="progressbar" aria-valuenow={Math.round(uso * 100)} aria-valuemin={0} aria-valuemax={100} aria-label="Uso do limite mensal"><i style={{ width: `${Math.min(100, uso * 100)}%` }} /></div>
      <h3>Últimos 6 meses</h3>
      <GraficoMensal meses={meses} valores={valores} limite={limites.monthlyCents} atual={monthKey(agora)} />
      <h3>Neste mês, por categoria</h3>
      {categorias.length === 0 ? <p className="pn-vazio">Nenhuma compra aprovada neste mês ainda.</p> : categorias.map(([nome, valor]) => (
        <div key={nome} className="pn-cat">
          <span>{nome}</span>
          <div className="pn-medidor"><i style={{ width: `${(valor / maiorCategoria) * 100}%` }} /></div>
          <span className="pn-forte">{brl(valor)}</span>
        </div>
      ))}
      <h3>Compras recentes</h3>
      {recentes.length === 0 ? <p className="pn-vazio">Nenhuma compra confirmada ainda.</p> : (
        <div className="pn-tabela-caixa">
          <table className="pn-tabela">
            <tbody>
              {recentes.map((c) => (
                <tr key={c.id}>
                  <td>Proposta #{c.proposalId}{c.automatic && <span className="pn-pill" style={{ marginLeft: 8 }}>agendada</span>}</td>
                  <td className="pn-mute">{new Date(c.createdAt).toLocaleDateString("pt-BR")}</td>
                  <td className="num pn-forte">{brl(c.totalCents)}</td>
                  <td className="pn-mute">{c.gateway === "sandbox" ? "teste" : c.gateway}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

export function SecaoAutomacao({ userId, settings }: { userId: number; settings: Settings }) {
  const alertas = alertasDoUsuario(userId);
  const limites = getLimits(userId);
  const agendamentos = listSchedules(userId);
  const sugestoes = listSubstitutions(userId, 8);
  const moeda = (c: number) => (c / 100).toFixed(2).replace(".", ",");

  return (
    <>
      <section className="nx-hud pn-card">
        <p className="nx-kicker">Limites e avisos</p>
        <h2>Seu teto de gastos</h2>
        {alertas.length === 0 ? <p className="pn-vazio">Sem avisos por enquanto: nenhuma promoção da sua lista e limite sob controle.</p> : (
          <div className="pn-avisos">{alertas.map((a, i) => <p key={i} className={`pn-aviso ${a.nivel}`}>{a.texto}</p>)}</div>
        )}
        <form action={updateLimits} className="pn-grid2">
          <label className="pn-campo"><span>Limite por compra (R$)</span><input className="pn-input" name="perPurchase" defaultValue={moeda(limites.perPurchaseCents)} /></label>
          <label className="pn-campo"><span>Limite mensal (R$)</span><input className="pn-input" name="monthly" defaultValue={moeda(limites.monthlyCents)} /></label>
          <button className="nx-btn nx-btn-solid pn-btn">Salvar limites</button>
        </form>
        <p className="pn-mute">Os limites são código no servidor: nem o agente nem o agendamento conseguem ultrapassá-los.</p>
      </section>

      <section className="nx-hud pn-card">
        <p className="nx-kicker">Preferências do agente</p>
        <h2>Como ele escolhe</h2>
        <form action={savePrefs} className="pn-bloco">
          <label className="pn-campo">
            <span>Critério da proposta</span>
            <select className="pn-input" name="criterion" defaultValue={settings.criterion}>
              <option value="preco">Menor preço</option>
              <option value="equilibrado">Equilibrado (preço e qualidade)</option>
              <option value="qualidade">Melhor qualidade (loja mais bem avaliada)</option>
            </select>
          </label>
          <label className="pn-check">
            <input type="checkbox" name="allowSubstitution" defaultChecked={settings.allowSubstitution} />
            <span>Permitir que o agente <strong>sugira</strong> substituições de produtos. Nada muda na sua lista sem a sua aprovação abaixo.</span>
          </label>
          <button className="nx-btn pn-btn">Salvar preferências</button>
        </form>
      </section>

      <section className="nx-hud pn-card">
        <p className="nx-kicker">Compra agendada</p>
        <h2>Todo mês, no dia que você escolher</h2>
        <p className="pn-sub">No dia, o agente monta a proposta. Se você pré-autorizar, ele também confirma a compra, sempre dentro dos seus limites.</p>
        <form action={createSchedule} className="pn-bloco">
          <div className="pn-linha">
            <label className="pn-campo"><span>Dia do mês (1 a 28)</span><input className="pn-input" style={{ width: 120 }} name="day" type="number" min={1} max={28} defaultValue={1} required /></label>
          </div>
          <label className="pn-check">
            <input type="checkbox" name="authorize" />
            <span>Pré-autorizo o agente a <strong>comprar</strong> nesse dia, se a proposta couber nos meus limites. Posso desligar quando quiser.</span>
          </label>
          <button className="nx-btn nx-btn-solid pn-btn">Agendar</button>
        </form>
        {agendamentos.map((a) => (
          <div key={a.id} className="pn-bloco">
            <div className="pn-linha">
              <strong>Dia {a.dayOfMonth}</strong>
              <span className={`pn-pill ${a.active ? "aprovada" : "recusada"}`}>{a.active ? "ativo" : "pausado"}</span>
              <span className={`pn-pill ${a.authorizePurchase ? "pendente" : ""}`}>{a.authorizePurchase ? "compra pré-autorizada" : "só cria a proposta"}</span>
              <span className="pn-mute pn-fim">{a.lastRunMonth ? `última execução: ${a.lastRunMonth}` : "ainda não rodou"}</span>
            </div>
            <div className="pn-linha">
              <form action={changeSchedule}><input type="hidden" name="id" value={a.id} /><input type="hidden" name="op" value="toggle" /><input type="hidden" name="active" value={a.active ? "0" : "1"} /><button className="pn-btn-claro">{a.active ? "Pausar" : "Ativar"}</button></form>
              <form action={changeSchedule}><input type="hidden" name="id" value={a.id} /><input type="hidden" name="op" value="authorize" /><input type="hidden" name="authorize" value={a.authorizePurchase ? "0" : "1"} /><button className="pn-btn-claro">{a.authorizePurchase ? "Retirar pré-autorização" : "Pré-autorizar compra"}</button></form>
              <form action={changeSchedule}><input type="hidden" name="id" value={a.id} /><input type="hidden" name="op" value="delete" /><button className="pn-btn-perigo">Excluir</button></form>
            </div>
          </div>
        ))}
        <p className="pn-mute">O agendamento roda quando você abre o painel e por um gatilho diário externo (rota /api/cron). Sem esse gatilho configurado, o dia 01 só é cumprido na próxima vez que você entrar.</p>
      </section>

      <section className="nx-hud pn-card">
        <p className="nx-kicker">Substituição inteligente</p>
        <h2>Sugestões que esperam a sua permissão</h2>
        {sugestoes.length === 0 ? <p className="pn-vazio">Nenhuma sugestão. Peça no chat: &quot;sugira uma substituição para o item que falta&quot;.</p> : sugestoes.map((s) => (
          <div key={s.id} className="pn-bloco">
            <div className="pn-linha">
              <span><strong>{s.fromProduct}</strong> → <strong className="pn-ouro">{s.toProduct}</strong></span>
              <span className={`pn-pill ${s.status === "pending" ? "pendente" : s.status === "approved" ? "aprovada" : "recusada"} pn-fim`}>{s.status === "pending" ? "aguardando você" : s.status === "approved" ? "aprovada" : "recusada"}</span>
            </div>
            <p className="pn-mute" style={{ margin: 0 }}>{s.reason}</p>
            {s.status === "pending" && (
              <div className="pn-linha">
                <form action={decideSubstitution}><input type="hidden" name="id" value={s.id} /><input type="hidden" name="decision" value="approve" /><button className="nx-btn nx-btn-solid pn-btn">Permitir a troca</button></form>
                <form action={decideSubstitution}><input type="hidden" name="id" value={s.id} /><input type="hidden" name="decision" value="reject" /><button className="pn-btn-perigo">Manter como está</button></form>
              </div>
            )}
          </div>
        ))}
      </section>
    </>
  );
}
