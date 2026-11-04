import { requireUser } from "@/lib/auth";
import { listPrices, listStores } from "@/lib/db";
import { brl } from "@/lib/format";
import { isStale } from "@/lib/pricing";
import { submitPrice } from "@/app/actions";

export const metadata = { title: "Base de preços" };

export default async function Precos({ searchParams }: { searchParams: Promise<{ erro?: string; ok?: string }> }) {
  await requireUser();
  const { erro, ok } = await searchParams;
  const stores = listStores();
  const prices = listPrices().sort((a, b) => a.product.localeCompare(b.product, "pt-BR"));
  const now = new Date();
  const storeName = new Map(stores.map((s) => [s.id, s.name]));

  return (
    <main className="pn-main" style={{ gridTemplateColumns: "minmax(0, 1fr)", maxWidth: 1000 }}>
      <div className="pn-side">
        {erro && <p className="pn-flash erro" role="alert">{erro}</p>}
        {ok && <p className="pn-flash ok" role="status">{ok}</p>}

        <section className="nx-hud pn-card">
          <p className="nx-kicker">Base de preços</p>
          <h2>Registrar um preço</h2>
          <p className="pn-sub">Os preços informados por você e por outros usuários alimentam a comparação. Os de origem &quot;demo&quot; são fictícios.</p>
          <form action={submitPrice} className="pn-bloco">
            <div className="pn-grid2">
              <label className="pn-campo">
                <span>Mercado</span>
                <select name="storeId" className="pn-input" required>
                  {stores.map((s) => (<option key={s.id} value={s.id}>{s.name}</option>))}
                </select>
              </label>
              <label className="pn-campo"><span>Produto</span><input name="product" placeholder="Ex.: Arroz branco 5kg" required minLength={2} maxLength={80} className="pn-input" /></label>
              <label className="pn-campo"><span>Preço</span><input name="price" placeholder="Ex.: 27,90" required className="pn-input" /></label>
            </div>
            <button className="nx-btn nx-btn-solid pn-btn">Registrar preço</button>
          </form>
        </section>

        <section className="nx-hud pn-card">
          <p className="nx-kicker">{prices.length} preços</p>
          <h2>Preços cadastrados</h2>
          <div className="pn-tabela-caixa">
            <table className="pn-tabela">
              <thead>
                <tr><th>Produto</th><th>Loja</th><th className="num">Preço</th><th>Origem</th><th>Atualizado</th></tr>
              </thead>
              <tbody>
                {prices.map((p) => (
                  <tr key={p.id}>
                    <td>{p.product}</td>
                    <td className="pn-mute">{storeName.get(p.storeId)}</td>
                    <td className="num">{brl(p.unitCents)}</td>
                    <td className="pn-mute">{p.source}</td>
                    <td className={isStale(p.updatedAt, now) ? "pn-ouro" : "pn-mute"}>{new Date(p.updatedAt).toLocaleDateString("pt-BR")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </main>
  );
}
