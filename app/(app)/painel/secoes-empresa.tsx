import { listPrices, listStores } from "@/lib/db";
import { listMovements, listNotifications, listStock, type Settings } from "@/lib/db-painel";
import { categoryOf, NICHO_CATEGORIAS, NICHOS } from "@/lib/catalog";
import { brl } from "@/lib/format";
import { computeInsights } from "@/lib/stock";
import { addMovement, saveNiche, uploadStock } from "@/app/actions-painel";

export function SecaoNicho({ settings }: { settings: Settings }) {
  const stores = new Map(listStores().map((s) => [s.id, s.name]));
  const categorias = settings.niche ? NICHO_CATEGORIAS[settings.niche] : undefined;
  const ofertas = new Map<string, { produto: string; centavos: number; loja: string }>();
  if (settings.niche) {
    for (const p of listPrices()) {
      const cat = categoryOf(p.product);
      if (categorias && !categorias.includes(cat)) continue;
      const atual = ofertas.get(p.product);
      if (!atual || p.unitCents < atual.centavos) ofertas.set(p.product, { produto: p.product, centavos: p.unitCents, loja: stores.get(p.storeId) ?? "?" });
    }
  }
  const lista = [...ofertas.values()].sort((a, b) => a.produto.localeCompare(b.produto, "pt-BR")).slice(0, 24);
  const conhecido = settings.niche && (NICHOS as readonly string[]).includes(settings.niche);

  return (
    <section className="nx-hud pn-card">
      <p className="nx-kicker">Nicho da empresa</p>
      <h2>O que a sua empresa faz?</h2>
      <p className="pn-sub">O agente pesquisa e recomenda de acordo com o seu ramo. Você também pode dizer o nicho no chat.</p>
      <form action={saveNiche} className="pn-bloco">
        <label className="pn-campo">
          <span>Ramo</span>
          <select className="pn-input" name="niche" defaultValue={conhecido ? settings.niche! : settings.niche ? "outro" : NICHOS[0]}>
            {NICHOS.map((n) => <option key={n} value={n}>{n}</option>)}
            <option value="outro">Outro…</option>
          </select>
        </label>
        <label className="pn-campo"><span>Se for outro, qual?</span><input className="pn-input" name="other" maxLength={60} defaultValue={settings.niche && !conhecido ? settings.niche : ""} placeholder="Ex.: clínica veterinária" /></label>
        <button className="nx-btn nx-btn-solid pn-btn">Salvar nicho</button>
      </form>
      {settings.niche && (
        <>
          <h3>Melhores preços para {settings.niche}</h3>
          {lista.length === 0 ? <p className="pn-vazio">Ainda não há preços cadastrados para esse ramo.</p> : (
            <div className="pn-tabela-caixa">
              <table className="pn-tabela">
                <thead><tr><th>Produto</th><th>Melhor mercado</th><th className="num">Preço</th></tr></thead>
                <tbody>{lista.map((o) => <tr key={o.produto}><td>{o.produto}</td><td className="pn-mute">{o.loja}</td><td className="num barato">{brl(o.centavos)}</td></tr>)}</tbody>
              </table>
            </div>
          )}
          <p className="pn-mute">Preços de demonstração (fictícios). Peça ao agente no chat para comparar qualquer item deste ramo.</p>
        </>
      )}
    </section>
  );
}

const FORMATO = "produto;quantidade;minimo;custo;ultima_saida\nCimento 50kg;120;200;38,90;10/10/2026\nTijolo 8 furos (milheiro);30;10;820,00;01/03/2026";

export function SecaoEstoque({ userId, settings }: { userId: number; settings: Settings }) {
  const itens = listStock(userId);
  const insights = computeInsights(itens, new Date());
  const avisos = listNotifications(userId, 6).filter((n) => n.kind === "supervisor" || n.kind === "estoque");
  const movimentos = listMovements(userId, 8);

  return (
    <>
      <section className="nx-hud pn-card">
        <p className="nx-kicker">Controle de estoque</p>
        <h2>Envie o arquivo do seu estoque</h2>
        <p className="pn-sub">O agente lê o arquivo, acompanha entradas e saídas e avisa o supervisor do que precisa de atenção: o que repor, o que está parado e o que sobra.</p>
        <form action={uploadStock} encType="multipart/form-data" className="pn-bloco">
          <label className="pn-campo"><span>Arquivo CSV</span><input className="pn-input" type="file" name="file" accept=".csv,.txt,text/csv" required /></label>
          <label className="pn-campo"><span>E-mail do supervisor</span><input className="pn-input" type="email" name="supervisorEmail" defaultValue={settings.supervisorEmail ?? ""} placeholder="supervisor@empresa.com" maxLength={200} /></label>
          <button className="nx-btn nx-btn-solid pn-btn">Importar estoque</button>
        </form>
        <details className="pn-mute">
          <summary style={{ cursor: "pointer" }}>Como montar o arquivo (no Excel: Salvar como → CSV)</summary>
          <pre style={{ margin: "8px 0 0", padding: 10, borderRadius: 8, background: "rgba(2,12,52,0.6)", overflowX: "auto", fontSize: 12 }}>{FORMATO}</pre>
          <p style={{ margin: "8px 0 0" }}>Obrigatórias: produto e quantidade. Opcionais: mínimo, custo, ultima_saida (dd/mm/aaaa). Itens com o mesmo nome são atualizados.</p>
        </details>
      </section>

      <section className="nx-hud pn-card">
        <p className="nx-kicker">Insights para o supervisor</p>
        <h2>O que precisa de atenção</h2>
        {itens.length === 0 ? <p className="pn-vazio">Importe o estoque para ver os insights.</p> : insights.length === 0 ? <p className="pn-aviso">Tudo em ordem: nenhum item abaixo do mínimo, parado ou em excesso.</p> : (
          <div className="pn-avisos">
            {insights.slice(0, 14).map((i, idx) => <p key={idx} className={`pn-aviso ${i.level === "alerta" ? "alerta" : i.level === "atencao" ? "atencao" : ""}`}>{i.message}</p>)}
          </div>
        )}
        {avisos.length > 0 && (<><h3>Avisos já registrados{settings.supervisorEmail ? ` para ${settings.supervisorEmail}` : ""}</h3><ul className="nx-lista">{avisos.map((n) => <li key={n.id}>{n.message}</li>)}</ul></>)}
        <p className="pn-mute">O aviso fica registrado aqui no painel. O envio por e-mail ao supervisor ainda não está configurado neste ambiente.</p>
      </section>

      <section className="nx-hud pn-card">
        <p className="nx-kicker">Entradas e saídas</p>
        <h2>Registrar movimentação</h2>
        <form action={addMovement} className="pn-bloco">
          <div className="pn-grid2">
            <label className="pn-campo"><span>Produto</span><input className="pn-input" name="product" list="estoque-itens" required maxLength={80} /></label>
            <label className="pn-campo"><span>Tipo</span><select className="pn-input" name="kind"><option value="out">Saída</option><option value="in">Entrada</option></select></label>
            <label className="pn-campo"><span>Quantidade</span><input className="pn-input" name="qty" inputMode="decimal" required /></label>
            <label className="pn-campo"><span>Observação</span><input className="pn-input" name="note" maxLength={120} /></label>
          </div>
          <datalist id="estoque-itens">{itens.map((i) => <option key={i.id} value={i.name} />)}</datalist>
          <button className="nx-btn nx-btn-solid pn-btn">Registrar</button>
        </form>
        {movimentos.length > 0 && (
          <div className="pn-tabela-caixa">
            <table className="pn-tabela">
              <tbody>{movimentos.map((m) => (
                <tr key={m.id}>
                  <td><span className={`pn-pill ${m.kind === "in" ? "aprovada" : "pendente"}`}>{m.kind === "in" ? "entrada" : "saída"}</span></td>
                  <td>{m.item}</td><td className="num">{m.qty}</td><td className="pn-mute">{m.note}</td><td className="pn-mute">{new Date(m.createdAt).toLocaleDateString("pt-BR")}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        )}
      </section>

      {itens.length > 0 && (
        <section className="nx-hud pn-card">
          <p className="nx-kicker">Estoque atual</p>
          <h2>{itens.length} itens</h2>
          <div className="pn-tabela-caixa">
            <table className="pn-tabela">
              <thead><tr><th>Produto</th><th className="num">Saldo</th><th className="num">Mínimo</th><th className="num">Custo un.</th></tr></thead>
              <tbody>{itens.slice(0, 40).map((i) => (
                <tr key={i.id}><td>{i.name}</td><td className={`num${i.minQty > 0 && i.qty <= i.minQty ? " pn-ouro" : ""}`}>{i.qty}</td><td className="num pn-mute">{i.minQty}</td><td className="num pn-mute">{i.unitCostCents ? brl(i.unitCostCents) : "—"}</td></tr>
              ))}</tbody>
            </table>
          </div>
          {itens.length > 40 && <p className="pn-mute">Mostrando 40 de {itens.length}.</p>}
        </section>
      )}
    </>
  );
}
