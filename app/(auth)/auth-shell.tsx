"use client";

import Link from "next/link";
import type { MouseEvent, ReactNode } from "react";
import { BRAND } from "@/lib/brand";
import { RedeViva } from "../(site)/rede-viva";
import "../(site)/site.css";
import { CenaDoAgente, PainelDaTela } from "./auth-pecas";
import { TrocaProvider } from "./troca";
import "./auth.css";

/** Moldura das telas de acesso: a mesma rede viva, vinheta e vidro do site público. */
export function AuthShell({ children }: { children: ReactNode }) {
  // o painel holográfico acompanha o ponteiro com um brilho (variáveis CSS lidas por .nx-hud::before)
  const seguirPonteiro = (evento: MouseEvent<HTMLDivElement>) => {
    const painel = (evento.target as HTMLElement).closest<HTMLElement>(".nx-vidro, .nx-hud");
    if (!painel) return;
    const caixa = painel.getBoundingClientRect();
    painel.style.setProperty("--mx", `${evento.clientX - caixa.left}px`);
    painel.style.setProperty("--my", `${evento.clientY - caixa.top}px`);
  };

  return (
    <div className="nx-root au-root" onMouseMove={seguirPonteiro}>
      <RedeViva />
      <div className="nx-veu" aria-hidden="true" />

      <header className="nx-nav">
        <Link href="/" className="nx-logo">
          <span className="nx-logo-orbe" aria-hidden="true" /> {BRAND}
        </Link>
        <nav aria-label="Principal">
          <Link href="/" className="nx-link">Voltar ao site</Link>
        </nav>
      </header>

      <TrocaProvider>
        <main className="au-main">
          <div className="au-palco">
            <CenaDoAgente />
            <PainelDaTela>{children}</PainelDaTela>
          </div>
        </main>
      </TrocaProvider>

      <footer className="au-rodape">
        <p className="nx-fine">Versão de teste: nenhum pagamento é feito e os preços de demonstração são fictícios.</p>
      </footer>
    </div>
  );
}
