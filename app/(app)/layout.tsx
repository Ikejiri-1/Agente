import Link from "next/link";
import { getUser } from "@/lib/auth";
import { BRAND } from "@/lib/brand";
import { getSettings } from "@/lib/db-painel";
import { PLAN_LABEL, PLAN_ORDER } from "@/lib/plans";
import { logout } from "@/app/actions";
import { setPlan } from "@/app/actions-painel";
import { PainelShell } from "./painel-shell";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getUser();
  const plano = user ? getSettings(user.id).plan : null;

  const topo = (
    <header className="nx-nav pn-topo">
      <Link href="/" className="nx-logo">
        <span className="nx-logo-orbe" aria-hidden="true" /> {BRAND}
      </Link>
      <nav aria-label="Painel">
        {user ? (
          <>
            <Link href="/painel" className="nx-link">Painel</Link>
            <Link href="/precos" className="nx-link pn-oculta">Base de preços</Link>
            <form action={setPlan} className="pn-plano" title="Modo de teste: troque de plano para ver cada painel. Nenhuma cobrança é feita.">
              <span className="pn-plano-rotulo">Plano</span>
              {PLAN_ORDER.map((id) => (
                <button key={id} name="plan" value={id} className={id === plano ? "on" : ""} aria-pressed={id === plano}>
                  {PLAN_LABEL[id]}
                </button>
              ))}
            </form>
            <span className="pn-usuario pn-oculta">{user.name}</span>
            <form action={logout}>
              <button className="nx-btn nx-btn-pequeno">Sair</button>
            </form>
          </>
        ) : (
          <>
            <Link href="/login" className="nx-link">Entrar</Link>
            <Link href="/cadastro" className="nx-btn nx-btn-solid nx-btn-pequeno">Criar conta</Link>
          </>
        )}
      </nav>
    </header>
  );

  return <PainelShell topo={topo}>{children}</PainelShell>;
}
