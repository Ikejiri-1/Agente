import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { listItems, listProposals } from "@/lib/db";
import { getSettings, listChat, listNotifications, listPurchases } from "@/lib/db-painel";
import { alertasDoUsuario } from "@/lib/alertas";
import { chatConfigured, chatProviderLabel } from "@/lib/chat-agent";
import { can, PLAN_LABEL, planFor, type Feature, type PlanId } from "@/lib/plans";
import { runDueSchedules } from "@/lib/scheduler";
import { clearConversation, readNotifications } from "@/app/actions-painel";
import { Conversa } from "./conversa";
import { Bloqueado, SecaoLista, SecaoPrecos, SecaoPropostas } from "./secoes-basicas";
import { SecaoAutomacao, SecaoFinancas } from "./secoes-familia";
import { SecaoEstoque, SecaoNicho } from "./secoes-empresa";

export const metadata = { title: "Painel" };

type Aba = { id: string; rotulo: string; recurso: Feature | null; titulo: string; texto: string };
const ABAS: Aba[] = [
  { id: "precos", rotulo: "Mercado e preços", recurso: null, titulo: "", texto: "" },
  { id: "lista", rotulo: "Lista", recurso: null, titulo: "", texto: "" },
  { id: "propostas", rotulo: "Propostas", recurso: "propostas", titulo: "Propostas e compra automatizada", texto: "O agente monta o carrinho de acordo com o seu critério (preço, qualidade) e você confirma a compra, sempre dentro dos seus limites." },
  { id: "financas", rotulo: "Finanças", recurso: "financeiro", titulo: "Controle financeiro", texto: "Gasto por mês e por categoria, economia acumulada e quanto falta do seu limite." },
  { id: "automacao", rotulo: "Automação", recurso: "limites", titulo: "Automação, limites e agendamento", texto: "Limites de gasto, avisos de promoção, compra agendada e substituição inteligente de produtos (com a sua permissão)." },
  { id: "nicho", rotulo: "Nicho", recurso: "nicho", titulo: "Pesquisa pelo nicho da empresa", texto: "O agente pesquisa de acordo com o que a sua empresa faz: construtora, transportadora, automotiva e outros ramos." },
  { id: "estoque", rotulo: "Estoque", recurso: "estoque", titulo: "Controle de estoque com insights", texto: "Envie o arquivo do estoque: o agente registra entradas e saídas e avisa o supervisor do que repor ou do que está parado." },
];

const SUGESTOES: Record<PlanId, string[]> = {
  gratis: ["Compare o preço do arroz e do feijão nos mercados", "Qual mercado está mais barato para legumes?", "Quanto gasto para comprar arroz, feijão, tomate e batata?"],
  familia: ["Monte a lista do mês para uma família de 4 pessoas", "Crie uma proposta pelo menor preço", "Tem promoção de algo que está na minha lista?", "Agende minha compra para todo dia 1"],
  empresarial: ["Sou uma construtora: quais materiais compro para uma laje?", "O que no meu estoque precisa de reposição?", "Quais produtos estão parados há muito tempo?", "Compare o preço do diesel nos mercados"],
};

export default async function Painel({ searchParams }: { searchParams: Promise<{ aba?: string; q?: string; erro?: string; ok?: string }> }) {
  const user = await requireUser();
  const { aba: pedida, q, erro, ok } = await searchParams;
  await runDueSchedules(user.id); // compras agendadas que venceram (só no plano Família ou acima)
  const settings = getSettings(user.id);
  const plano = settings.plan;
  const aba = ABAS.find((a) => a.id === pedida) ?? ABAS[0];
  const liberada = !aba.recurso || can(plano, aba.recurso);

  const naoLidas = listNotifications(user.id, 6).filter((n) => !n.read);
  const alertas = can(plano, "limites") ? alertasDoUsuario(user.id).slice(0, 3) : [];
  const itens = listItems(user.id);
  const mensagens = listChat(user.id, 40).map((m) => ({ papel: m.role === "user" ? ("eu" as const) : ("ag" as const), texto: m.content }));

  return (
    <main className="pn-main">
      <div className="pn-col-chat">
        <Conversa inicial={mensagens} sugestoes={SUGESTOES[plano]} configurado={chatConfigured()} plano={PLAN_LABEL[plano]} motor={chatProviderLabel()} limpar={clearConversation} />
      </div>

      <div className="pn-side">
        {erro && <p className="pn-flash erro" role="alert">{erro}</p>}
        {ok && <p className="pn-flash ok" role="status">{ok}</p>}

        {(naoLidas.length > 0 || alertas.length > 0) && (
          <section className="nx-hud pn-card" aria-label="Avisos">
            <p className="nx-kicker">Avisos</p>
            <div className="pn-avisos">
              {alertas.map((a, i) => <p key={`a${i}`} className={`pn-aviso ${a.nivel}`}>{a.texto}</p>)}
              {naoLidas.map((n) => <p key={n.id} className="pn-aviso">{n.message}</p>)}
            </div>
            {naoLidas.length > 0 && <form action={readNotifications}><button className="pn-btn-claro">Marcar como lidos</button></form>}
          </section>
        )}

        <nav className="pn-tabs" aria-label="Seções do painel">
          {ABAS.map((a) => {
            const trava = Boolean(a.recurso && !can(plano, a.recurso));
            return (
              <Link key={a.id} href={`/painel?aba=${a.id}`} className={`pn-tab${a.id === aba.id ? " on" : ""}${trava ? " trava" : ""}`} aria-current={a.id === aba.id ? "page" : undefined}>
                {a.rotulo}
                {trava && a.recurso && <span className="pn-selo">{PLAN_LABEL[planFor(a.recurso)]}</span>}
              </Link>
            );
          })}
        </nav>

        {!liberada && aba.recurso && <Bloqueado recurso={aba.recurso} titulo={aba.titulo} texto={aba.texto} />}
        {liberada && aba.id === "precos" && <SecaoPrecos settings={settings} q={q ?? "arroz, feijão, tomate, batata"} />}
        {liberada && aba.id === "lista" && <SecaoLista items={itens} plan={plano} />}
        {liberada && aba.id === "propostas" && (
          <SecaoPropostas proposals={listProposals(user.id, 10)} comprados={new Set(listPurchases(user.id, 50).map((c) => c.proposalId))} podeComprar={can(plano, "compra")} itens={itens.length} />
        )}
        {liberada && aba.id === "financas" && <SecaoFinancas userId={user.id} />}
        {liberada && aba.id === "automacao" && <SecaoAutomacao userId={user.id} settings={settings} />}
        {liberada && aba.id === "nicho" && <SecaoNicho settings={settings} />}
        {liberada && aba.id === "estoque" && <SecaoEstoque userId={user.id} settings={settings} />}
      </div>
    </main>
  );
}
