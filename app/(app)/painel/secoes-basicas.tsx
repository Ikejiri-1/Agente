import type { ReactNode } from "react";
import { listPrices, listStores, type Proposal } from "@/lib/db";
import type { Settings } from "@/lib/db-painel";
import { brl } from "@/lib/format";
import { can, PLAN_LABEL, planFor, type Feature, type PlanId } from "@/lib/plans";
import { matches, type ListItem } from "@/lib/pricing";
import { addListItem, decide, generateProposal, removeListItem } from "@/app/actions";
import { buyProposal, chooseStore } from "@/app/actions-painel";

/** Cartão para recurso que o plano atual não inclui: diz qual plano libera e o que ele faz. */
export function Bloqueado({ recurso, titulo, texto }: { recurso: Feature; titulo: string; texto: string }) {
  return (
    <section className="nx-hud pn-card">
      <p className="nx-kicker">Disponível no plano {PLAN_LABEL[planFor(recurso)]}</p>
      <h2>{titulo}</h2>
      <p className="pn-sub">{texto}</p>
      <p className="pn-mute">Use o seletor de plano no topo da página para ver este painel (modo de teste, sem cobrança).</p>
    </section>
  );
}

const SUGESTOES_DE_COMPARACAO = [
  ["Grãos", "arroz, feijão, macarrão, açúcar"],
  ["Legumes", "tomate, batata, cebola, cenoura, abobrinha"],
  ["Limpeza", "detergente, sabão em pó, água sanitária"],
];

export function SecaoPrecos({ settings, q }: { settings: Settings; q: string }) {
  const stores = listStores();
  const prices = listPrices();
  const termos = q.split(",").map((t) => t.trim()).filter(Boolean).slice(0, 8);
  const linhas = termos.map((termo) => ({
    termo,
    porLoja: stores.map((s) => {
      const doProduto = prices.filter((p) => p.storeId === s.id && p.unitCents > 0 && matches(termo, p.product));
      return doProduto.length ? doProduto.reduce((a, b) => (b.unitCents < a.unitCents ? b : a)) : null;
    }),
  }));
  const totais = stores.map((_, i) => ({
    soma: linhas.reduce((a, l) => a + (l.porLoja[i]?.unitCents ?? 0), 0),
    faltam: linhas.filter((l) => !l.porLoja[i]).length,
  }));

  return (
    <>
      <section className="nx-hud pn-card">
        <p className="nx-kicker">Escolha do mercado</p>
        <h2>Onde você quer comprar?</h2>
        <p className="pn-sub">O agente usa o mercado escolhido nas propostas. Deixe em "todos" para ele comparar e dividir entre mercados.</p>
        <form action={chooseStore} className="pn-bloco">
          <div className="pn-mercados">
            <label className="pn-mercado">
              <input type="radio" name="storeId" value="" defaultChecked={settings.storeId === null} />
              <strong>Todos os mercados</strong>
              <span>O agente compara e escolhe o melhor</span>
            </label>
            {stores.map((s) => {
              const nota = s.quality ?? 3;
              return (
              <label key={s.id} className="pn-mercado">
                <input type="radio" name="storeId" value={s.id} defaultChecked={settings.storeId === s.id} />
                <strong>{s.name}</strong>
                <span className="pn-estrelas" aria-label={`Qualidade ${nota} de 5`}>{"★".repeat(nota)}{"☆".repeat(5 - nota)}</span>
                <span>Frete {brl(s.shippingCents)}{s.freeAboveCents ? ` · grátis acima de ${brl(s.freeAboveCents)}` : ""} · entrega em {s.etaDays} dia(s)</span>
              </label>
              );
            })}
          </div>
          <button className="nx-btn nx-btn-solid pn-btn">Usar este mercado</button>
        </form>
      </section>

      <section className="nx-hud pn-card">
        <p className="nx-kicker">Comparativo de preços</p>
        <h2>Quanto custa em cada mercado</h2>
        <form className="pn-linha" action="/painel">
          <input type="hidden" name="aba" value="precos" />
          <input className="pn-input" style={{ flex: 1, minWidth: 220 }} name="q" defaultValue={q} placeholder="Ex.: arroz, feijão, tomate, batata" aria-label="Produtos para comparar" maxLength={200} />
          <button className="nx-btn pn-btn">Comparar</button>
        </form>
        <div className="pn-linha">
          {SUGESTOES_DE_COMPARACAO.map(([nome, lista]) => (
            <a key={nome} className="pn-btn-claro" href={`/painel?aba=precos&q=${encodeURIComponent(lista)}`}>{nome}</a>
          ))}
        </div>
        {termos.length === 0 ? (
          <p className="pn-vazio">Digite os produtos separados por vírgula.</p>
        ) : (
          <div className="pn-tabela-caixa">
            <table className="pn-tabela">
              <thead>
                <tr>
                  <th>Produto</th>
                  {stores.map((s) => (<th key={s.id} className={`num${s.id === settings.storeId ? " escolhido" : ""}`}>{s.name.replace(/ Exemplo/, "")}</th>))}
                </tr>
              </thead>
              <tbody>
                {linhas.map((l) => {
                  const menor = Math.min(...l.porLoja.map((p) => p?.unitCents ?? Infinity));
                  return (
                    <tr key={l.termo}>
                      <td>{l.termo}</td>
                      {l.porLoja.map((p, i) => (
                        <td key={stores[i].id} className={`num${p && p.unitCents === menor ? " barato" : ""}${stores[i].id === settings.storeId ? " escolhido" : ""}`} title={p?.product}>
                          {p ? brl(p.unitCents) : "—"}
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr>
                  <td>Total dos itens</td>
                  {totais.map((t, i) => (<td key={stores[i].id} className="num">{brl(t.soma)}{t.faltam > 0 && <span className="pn-mute"> ({t.faltam} sem preço)</span>}</td>))}
                </tr>
              </tfoot>
            </table>
          </div>
        )}
        <p className="pn-mute">Preços de demonstração (fictícios). O preço é o da embalagem listada, sem converter por quilo. O verde marca o mais barato de cada linha.</p>
      </section>
    </>
  );
}

export function SecaoLista({ items, plan }: { items: (ListItem & { id: number })[]; plan: PlanId }) {
  return (
    <section className="nx-hud pn-card">
      <p className="nx-kicker">Lista de compras</p>
      <h2>Sua lista do mês</h2>
      <p className="pn-sub">
        {can(plan, "automacao")
          ? "Você pode editar aqui ou pedir no chat: o agente organiza a lista para você."
          : "Neste plano a organização é manual. No plano Família o agente organiza a lista pelo chat."}
      </p>
      {items.length === 0 ? (
        <p className="pn-vazio">Nenhum item ainda. Ex.: arroz, feijão, tomate, detergente.</p>
      ) : (
        <ul className="nx-lista" style={{ gap: 4 }}>
          {items.map((i) => (
            <li key={i.id} style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span>{i.name} <span className="pn-mute">× {i.qty}</span></span>
              <form action={removeListItem} className="pn-fim">
                <input type="hidden" name="id" value={i.id} />
                <button className="pn-btn-claro">Remover</button>
              </form>
            </li>
          ))}
        </ul>
      )}
      <form action={addListItem} className="pn-linha">
        <input className="pn-input" style={{ flex: 1, minWidth: 180 }} name="name" placeholder="Item (ex.: arroz)" required minLength={2} maxLength={60} aria-label="Item" />
        <input className="pn-input" style={{ width: 84 }} name="qty" type="number" min={1} max={99} defaultValue={1} required aria-label="Quantidade" />
        <button className="nx-btn nx-btn-solid pn-btn">Adicionar</button>
      </form>
    </section>
  );
}

const STATUS: Record<Proposal["status"], { rotulo: string; classe: string }> = {
  pending: { rotulo: "Aguardando você", classe: "pendente" },
  blocked: { rotulo: "Bloqueada pelos limites", classe: "bloqueada" },
  approved: { rotulo: "Aprovada", classe: "aprovada" },
  rejected: { rotulo: "Recusada", classe: "recusada" },
};

function Proposta({ p, comprada, podeComprar }: { p: Proposal; comprada: boolean; podeComprar: boolean }) {
  const st = comprada ? { rotulo: "Comprada", classe: "comprada" } : STATUS[p.status];
  return (
    <div className="pn-bloco">
      <div className="pn-linha">
        <strong>Proposta #{p.id}</strong>
        <span className={`pn-pill ${st.classe}`}>{st.rotulo}</span>
        <span className="pn-fim pn-forte">{brl(p.totalCents)}</span>
      </div>
      <p className="pn-mute" style={{ whiteSpace: "pre-line", margin: 0 }}>{p.justification}</p>
      {p.blockReasons.length > 0 && (<ul className="nx-lista" style={{ color: "#ffd3da" }}>{p.blockReasons.map((r, i) => <li key={i}>{r}</li>)}</ul>)}
      <div className="pn-tabela-caixa">
        <table className="pn-tabela">
          <thead><tr><th>Item</th><th>Produto · loja</th><th className="num">Qtd</th><th className="num">Subtotal</th></tr></thead>
          <tbody>
            {p.cart.lines.map((l, i) => (
              <tr key={i}>
                <td>{l.itemName}</td>
                <td>{l.product} <span className="pn-mute">· {l.storeName}</span>{l.stale && <span className="pn-ouro"> (preço antigo)</span>}</td>
                <td className="num">{l.qty}</td>
                <td className="num">{brl(l.subtotalCents)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr><td colSpan={3} className="num pn-mute">Frete</td><td className="num">{brl(p.cart.shippingCents)}</td></tr>
            <tr><td colSpan={3} className="num">Total</td><td className="num">{brl(p.totalCents)}</td></tr>
          </tfoot>
        </table>
      </div>
      {p.cart.missing.length > 0 && <p className="pn-aviso atencao">Sem preço encontrado: {p.cart.missing.join(", ")}.</p>}
      {p.status === "pending" && (
        <div className="pn-linha">
          {podeComprar && (
            <form action={buyProposal}>
              <input type="hidden" name="id" value={p.id} />
              <button className="nx-btn nx-btn-solid pn-btn" title="Confere seus limites e cobra pelo gateway de pagamento">Comprar agora</button>
            </form>
          )}
          <form action={decide}>
            <input type="hidden" name="id" value={p.id} />
            <input type="hidden" name="decision" value="approve" />
            <button className="nx-btn pn-btn">Só aprovar</button>
          </form>
          <form action={decide}>
            <input type="hidden" name="id" value={p.id} />
            <input type="hidden" name="decision" value="reject" />
            <button className="pn-btn-perigo">Recusar</button>
          </form>
        </div>
      )}
    </div>
  );
}

export function SecaoPropostas({ proposals, comprados, podeComprar, itens }: { proposals: Proposal[]; comprados: Set<number>; podeComprar: boolean; itens: number }): ReactNode {
  return (
    <section className="nx-hud pn-card">
      <p className="nx-kicker">Compra automatizada</p>
      <h2>Propostas do agente</h2>
      <p className="pn-sub">O agente monta o carrinho com o seu critério. Você confere e confirma; os limites de gasto são verificados no servidor antes de qualquer cobrança.</p>
      <form action={generateProposal} className="pn-linha">
        <button className="nx-btn nx-btn-solid pn-btn" disabled={itens === 0}>Pedir uma proposta agora</button>
        {itens === 0 && <span className="pn-mute">Adicione itens à lista primeiro (ou peça no chat).</span>}
      </form>
      {proposals.length === 0 ? <p className="pn-vazio">Nenhuma proposta ainda.</p> : proposals.map((p) => <Proposta key={p.id} p={p} comprada={comprados.has(p.id)} podeComprar={podeComprar} />)}
      <p className="pn-mute">Modo de teste: a cobrança é simulada e nenhum dinheiro é movimentado.</p>
    </section>
  );
}
