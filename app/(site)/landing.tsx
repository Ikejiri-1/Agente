"use client";

import Link from "next/link";
import { useEffect, useState, type MouseEvent } from "react";
import { BRAND } from "@/lib/brand";
import { CenaNeural } from "./cena-neural";
import { Base, CabecalhoDeSecao, Esfera, Orbe, Saida } from "./componentes";
import { HologramaFinal } from "./holograma-final";
import { PLANS, STEPS, type Plan } from "./nodes";
import { RedeViva } from "./rede-viva";
import "./site.css";

// A seção "O que o agente faz" está guardada em ./secao-funcoes.tsx para uma alteração futura.

const PILARES = [
  { icon: "check", titulo: "O agente propõe, você aprova", texto: "Nada é comprado sem o seu OK. A proposta chega pronta, e você aprova, edita ou recusa." },
  { icon: "lock", titulo: "Limites são código", texto: "O teto por compra e por mês é verificado no servidor, antes de qualquer ação do agente." },
  { icon: "search", titulo: "Tudo fica registrado", texto: "Cada decisão guarda a entrada, o critério e o resultado, para você revisar quando quiser." },
];

const PLANOS_ICONE: Record<string, string> = { gratis: "check", familia: "home", empresarial: "store" };

/** Cartão de plano: um painel holográfico projetado de uma plataforma própria. */
function CartaoDePlano({ plano }: { plano: Plan }) {
  const destaque = Boolean(plano.tag);
  return (
    <article className={destaque ? "nx-plano is-hot" : "nx-plano"} data-revela>
      <Orbe icone={PLANOS_ICONE[plano.id] ?? "check"} diametro={64} id={`plano-${plano.id}`} de="planos" quente={destaque} />
      <div className="nx-hud nx-plano-painel">
        {(plano.tag || plano.badge) && <span className="nx-etiqueta">{plano.tag ?? plano.badge}</span>}
        <h3>{plano.name}</h3>
        <p className="nx-plano-texto">{plano.blurb}</p>
        <p className="nx-preco">
          <strong>{plano.price}</strong> <span>{plano.per}</span>
        </p>
        <ul className="nx-lista">
          {plano.features.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
        {plano.href ? (
          <Link href={plano.href} className={destaque ? "nx-btn nx-btn-solid" : "nx-btn"}>
            {plano.cta}
          </Link>
        ) : (
          <button className="nx-btn" disabled>
            {plano.cta}
          </button>
        )}
      </div>
      <div className="nx-plano-projecao" aria-hidden="true">
        <div className="nx-feixe" />
        <Base />
        <Saida id={`base-${plano.id}`} />
      </div>
    </article>
  );
}

export default function Landing() {
  const [pronto, setPronto] = useState(false);

  // a formação do conteúdo (os pontos da rede construindo cada bloco ao rolar) mora em rede-viva.tsx
  useEffect(() => setPronto(true), []);

  // O vidro e os painéis holográficos acompanham o ponteiro com um brilho (via variáveis CSS).
  const seguirPonteiro = (evento: MouseEvent<HTMLDivElement>) => {
    const painel = (evento.target as HTMLElement).closest<HTMLElement>(".nx-vidro, .nx-hud");
    if (!painel) return;
    const caixa = painel.getBoundingClientRect();
    painel.style.setProperty("--mx", `${evento.clientX - caixa.left}px`);
    painel.style.setProperty("--my", `${evento.clientY - caixa.top}px`);
  };

  return (
    <div className={pronto ? "nx-root nx-pronto" : "nx-root"} onMouseMove={seguirPonteiro}>
      <RedeViva />
      <div className="nx-veu" aria-hidden="true" />

      <header className="nx-nav">
        <a href="#topo" className="nx-logo">
          <span className="nx-logo-orbe" aria-hidden="true" /> {BRAND}
        </a>
        <nav aria-label="Principal">
          <a href="#como" className="nx-link nx-link-ancora">Como funciona</a>
          <a href="#planos" className="nx-link nx-link-ancora">Planos</a>
          <Link href="/login" className="nx-link">Entrar</Link>
          <Link href="/cadastro" className="nx-btn nx-btn-solid nx-btn-pequeno">Começar grátis</Link>
        </nav>
      </header>

      <main id="topo">
        <section className="nx-hero">
          <p className="nx-selo">Agente de IA de compras e estoque</p>
          <h1>
            Você pede. <span>O agente pesquisa, compara e propõe.</span>
          </h1>
          <p className="nx-sub">Nada acontece sem a sua aprovação, e sempre dentro do limite que você definiu.</p>
          <div className="nx-hero-cta">
            <Link href="/cadastro" className="nx-btn nx-btn-solid">Começar grátis</Link>
            <a href="#planos" className="nx-btn">Ver planos</a>
          </div>
        </section>

        <CenaNeural />

        <section id="como" className="nx-secao" aria-label="Como funciona">
          <CabecalhoDeSecao icone="chat" id="como-no" de="cena" kicker="Como funciona" titulo="Do pedido à compra pronta, em quatro passos" />
          <ol className="nx-passos">
            {STEPS.map((passo, indice) => (
              <li key={passo.label} data-revela>
                <Orbe icone={passo.icon} diametro={80} id={`passo-${indice}`} de="como-no" />
                <span className="nx-numero">{String(indice + 1).padStart(2, "0")}</span>
                <strong>{passo.label}</strong>
                <p>{passo.texto}</p>
                <Saida id={`saida-passo-${indice}`} />
              </li>
            ))}
          </ol>
        </section>

        <section className="nx-secao" aria-label="Você no controle">
          <header className="nx-cab" data-revela>
            <Esfera diametro={230} id="controle" de={STEPS.map((_, indice) => `saida-passo-${indice}`).join(" ")}>
              <strong>Você decide</strong>
              <span>Aprovação · Limite · Controle</span>
            </Esfera>
            <p className="nx-kicker">No controle</p>
            <h2>O agente propõe. Você decide.</h2>
          </header>
          <div className="nx-grade nx-grade-3">
            {PILARES.map((pilar, indice) => (
              <article key={pilar.titulo} className="nx-vidro nx-funcao" data-revela>
                <Orbe icone={pilar.icon} diametro={56} id={`pilar-${indice}`} de="controle" />
                <h3>{pilar.titulo}</h3>
                <p className="nx-curto">{pilar.texto}</p>
                <Saida id={`saida-pilar-${indice}`} />
              </article>
            ))}
          </div>
        </section>

        <section id="planos" className="nx-secao" aria-label="Planos">
          <CabecalhoDeSecao
            icone="cart"
            id="planos"
            de={PILARES.map((_, indice) => `saida-pilar-${indice}`).join(" ")}
            kicker="Planos"
            titulo="Escolha como o agente trabalha para você"
            texto="Valores de referência. Serão confirmados depois do período de testes."
          />
          <div className="nx-grade nx-grade-3 nx-grade-planos">
            {PLANS.map((plano) => (
              <CartaoDePlano key={plano.id} plano={plano} />
            ))}
          </div>
        </section>

        <section className="nx-secao nx-final" aria-label="Comece agora">
          <HologramaFinal de={PLANS.map((plano) => `base-${plano.id}`).join(" ")} />
        </section>
      </main>

      <footer className="nx-rodape">
        <span className="nx-logo"><span className="nx-logo-orbe" aria-hidden="true" /> {BRAND}</span>
        <p className="nx-fine">Versão de teste: nenhum pagamento é feito e os preços de demonstração são fictícios.</p>
        <nav aria-label="Rodapé">
          <Link href="/login" className="nx-link">Entrar</Link>
          <Link href="/cadastro" className="nx-link">Criar conta</Link>
        </nav>
      </footer>
    </div>
  );
}
