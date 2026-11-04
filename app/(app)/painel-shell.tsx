"use client";

import type { MouseEvent, ReactNode } from "react";
import { RedeViva } from "../(site)/rede-viva";
import "../(site)/site.css";
import "./painel.css";

/** Moldura das telas logadas: a mesma rede viva, vinheta e vidro do site, com o brilho que segue o ponteiro nos painéis. */
export function PainelShell({ topo, children }: { topo: ReactNode; children: ReactNode }) {
  const seguirPonteiro = (evento: MouseEvent<HTMLDivElement>) => {
    const painel = (evento.target as HTMLElement).closest<HTMLElement>(".nx-vidro, .nx-hud");
    if (!painel) return;
    const caixa = painel.getBoundingClientRect();
    painel.style.setProperty("--mx", `${evento.clientX - caixa.left}px`);
    painel.style.setProperty("--my", `${evento.clientY - caixa.top}px`);
  };

  return (
    <div className="nx-root pn-root" onMouseMove={seguirPonteiro}>
      <RedeViva />
      <div className="nx-veu" aria-hidden="true" />
      {topo}
      {children}
    </div>
  );
}
