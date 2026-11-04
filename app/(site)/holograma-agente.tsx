"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { Base } from "./componentes";
import { Icon } from "./icons";
import { NODES } from "./nodes";

/**
 * Holograma que se abre ao clicar numa bolha do agente (a cena do topo da página).
 * A câmera "mergulha" na bolha: um círculo nasce nela e cresce até tomar a tela, sem trocar de página.
 *   Desktop: o holograma (ícone dourado, anéis, feixe e plataforma) à esquerda e o painel de informações à direita.
 *   Celular: uma bolha com o ícone; do feixe dela se projeta o cartão com as informações.
 * Os ícones são os das imagens do projeto, extraídos sem as mãos e sem o fundo (public/holo/*.png).
 * Os textos vêm de nodes.ts (NODES), para a página e o holograma nunca divergirem.
 */

export type AlvoDoHolograma = { chave: string; nome: string; x: number; y: number; raio: number };

/** chave da bolha na cena -> função em nodes.ts e imagem do ícone */
const HOLOGRAMAS: Record<string, { no: string; imagem: string }> = {
  a0: { no: "pesquisa", imagem: "/holo/pesquisa.png?v=2" },
  a1: { no: "comparacao", imagem: "/holo/comparacao.png?v=2" },
  a2: { no: "compra", imagem: "/holo/compra.png?v=2" },
  a3: { no: "pagamento", imagem: "/holo/pagamento.png?v=2" },
  a4: { no: "estoque", imagem: "/holo/estoque.png?v=2" },
};

const DURACAO_DA_SAIDA_MS = 560;
const DURACAO_DO_SALTO_MS = 380; // quando a tela já está coberta pelo clarão, a página salta até Planos
const DURACAO_DA_SAIDA_PARA_PLANOS_MS = 980;
const ordem = (indice: number) => ({ "--i": indice }) as CSSProperties;

function usarCelular() {
  const [celular, definirCelular] = useState(() => window.matchMedia("(max-width: 719px)").matches);
  useEffect(() => {
    const consulta = window.matchMedia("(max-width: 719px)");
    const atualizar = () => definirCelular(consulta.matches);
    consulta.addEventListener("change", atualizar);
    return () => consulta.removeEventListener("change", atualizar);
  }, []);
  return celular;
}

function Aneis() {
  return (
    <svg className="hz-aneis" viewBox="-165 -165 330 330" aria-hidden="true">
      <g className="nx-anel nx-anel-a">
        <circle r="158" strokeDasharray="2 9" />
        <path d="M-158 0A158 158 0 0 1 0 -158" className="forte" />
        <path d="M158 0A158 158 0 0 1 0 158" className="forte" />
      </g>
      <g className="nx-anel nx-anel-b">
        <circle r="132" />
        <path d="M0 132A132 132 0 0 1 -132 0" className="ouro" />
      </g>
      <g className="nx-anel nx-anel-c">
        <circle r="108" strokeDasharray="16 7" />
      </g>
    </svg>
  );
}

type PropriedadesDoPainel = {
  nome: string;
  no: (typeof NODES)[number];
  botaoVoltar: React.RefObject<HTMLButtonElement | null>;
  aoVoltar: () => void;
  aoVerPlanos: () => void;
  comOrbe: boolean;
  classe?: string;
};

/** Painel de informações: a mesma linguagem dos cartões de Planos (moldura em colchetes, linhas de varredura e brilho). */
function Painel({ nome, no, botaoVoltar, aoVoltar, aoVerPlanos, comOrbe, classe = "" }: PropriedadesDoPainel) {
  const disponivel = no.status === "mvp";
  return (
    <div className={`nx-hud hz-painel ${classe}`}>
      <header className="hz-cab" style={ordem(0)}>
        {comOrbe && (
          <span className="nx-orbe" style={{ "--d": "52px" } as CSSProperties}>
            <Icon name={no.icon} size={22} />
          </span>
        )}
        <span className={disponivel ? "nx-chip nx-chip-on" : "nx-chip"}>{disponivel ? "Disponível no teste" : "Em breve"}</span>
      </header>
      <h2 id="hz-titulo" style={ordem(1)}>{nome}</h2>
      <p className="hz-curto" style={ordem(2)}>{no.short}</p>
      <ul className="nx-lista" style={ordem(3)}>
        {no.points.map((ponto) => (
          <li key={ponto}>{ponto}</li>
        ))}
      </ul>
      <p className="hz-detalhe" style={ordem(4)}>{no.detail}</p>
      <div className="hz-acoes" style={ordem(5)}>
        <button type="button" className="nx-btn nx-btn-solid" onClick={aoVerPlanos}>Ver planos</button>
        <button ref={botaoVoltar} type="button" className="nx-btn" onClick={aoVoltar}>Voltar ao agente</button>
      </div>
    </div>
  );
}

export function HologramaDoAgente({ alvo, aoFechar }: { alvo: AlvoDoHolograma; aoFechar: (paraPlanos: boolean) => void }) {
  const [saida, definirSaida] = useState<null | "bolha" | "planos">(null); // qual animação de saída está rodando
  const celular = usarCelular();
  const raiz = useRef<HTMLDivElement>(null);
  const botaoVoltar = useRef<HTMLButtonElement>(null);
  const dados = HOLOGRAMAS[alvo.chave];
  const no = NODES.find((item) => item.id === dados?.no);
  const reduzido = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /** Voltar: o círculo encolhe de volta para a bolha clicada. */
  const fechar = useCallback(() => {
    if (saida) return;
    definirSaida("bolha");
    window.setTimeout(() => aoFechar(false), reduzido() ? 0 : DURACAO_DA_SAIDA_MS);
  }, [saida, aoFechar]);

  /**
   * Ver planos: o holograma se dissolve em um clarão com uma varredura de luz para baixo. Com a tela ainda coberta,
   * a página salta de uma vez até Planos (sem rolagem suave: o trajeto nunca aparece e a barra de rolagem fica oculta),
   * e só então o holograma some, revelando a seção já no lugar. O foco vai para o título de Planos.
   */
  const verPlanos = useCallback(() => {
    if (saida) return;
    definirSaida("planos");
    const secao = document.getElementById("planos");
    const sem = reduzido();
    window.setTimeout(() => {
      if (secao) window.scrollTo({ top: secao.getBoundingClientRect().top + window.scrollY, behavior: "instant" });
    }, sem ? 0 : DURACAO_DO_SALTO_MS);
    window.setTimeout(() => {
      aoFechar(true);
      const titulo = secao?.querySelector<HTMLElement>("h2");
      if (titulo) { titulo.tabIndex = -1; titulo.focus({ preventScroll: true }); }
    }, sem ? 0 : DURACAO_DA_SAIDA_PARA_PLANOS_MS);
  }, [saida, aoFechar]);

  useEffect(() => {
    document.documentElement.classList.add("hz-aberto"); // trava a rolagem da página por baixo
    raiz.current?.focus({ preventScroll: true }); // o foco entra no diálogo sem desenhar anel em nenhum botão; o Tab segue daqui
    const aoTeclar = (evento: KeyboardEvent) => {
      if (evento.key === "Escape") { fechar(); return; }
      if (evento.key !== "Tab" || !raiz.current) return; // o foco fica preso dentro do holograma
      const focaveis = Array.from(raiz.current.querySelectorAll<HTMLElement>("a[href], button:not([disabled])"));
      if (!focaveis.length) return;
      const primeiro = focaveis[0], ultimo = focaveis[focaveis.length - 1];
      if (evento.shiftKey && document.activeElement === primeiro) { evento.preventDefault(); ultimo.focus(); }
      else if (!evento.shiftKey && document.activeElement === ultimo) { evento.preventDefault(); primeiro.focus(); }
    };
    window.addEventListener("keydown", aoTeclar);
    return () => {
      window.removeEventListener("keydown", aoTeclar);
      document.documentElement.classList.remove("hz-aberto");
    };
  }, [fechar]);

  if (!dados || !no) return null;

  const aoClicarFora = (evento: React.MouseEvent) => {
    if (!(evento.target as HTMLElement).closest(".hz-estagio, .hz-painel, .hz-cel")) fechar();
  };

  const estilo = { "--ox": `${alvo.x}px`, "--oy": `${alvo.y}px`, "--or": `${alvo.raio}px` } as CSSProperties;
  const painel = <Painel nome={alvo.nome} no={no} botaoVoltar={botaoVoltar} aoVoltar={fechar} aoVerPlanos={verPlanos} comOrbe={!celular} classe={celular ? "hz-painel-cel" : ""} />;

  return createPortal(
    <div ref={raiz} className={saida === "bolha" ? "hz-raiz saindo" : saida === "planos" ? "hz-raiz indo-planos" : "hz-raiz"} style={estilo} role="dialog" aria-modal="true" aria-labelledby="hz-titulo" tabIndex={-1} onClick={aoClicarFora}>
      <div className="hz-fundo" />
      <span className="hz-onda" aria-hidden="true" />
      <div className="hz-conteudo">
        {celular ? (
          <div className="hz-cel">
            <span className="nx-orbe hz-bolha" aria-hidden="true">
              <img src={dados.imagem} alt="" draggable={false} />
            </span>
            <div className="hz-cone" aria-hidden="true" />
            {painel}
          </div>
        ) : (
          <div className="hz-palco">
            <div className="hz-estagio" aria-hidden="true">
              <Aneis />
              <div className="hz-icone">
                <img src={dados.imagem} alt="" draggable={false} />
              </div>
              <div className="hz-feixe" />
              <div className="hz-base">
                <Base />
              </div>
              <p className="hz-legenda">{alvo.nome}</p>
            </div>
            {painel}
          </div>
        )}
      </div>
    </div>,
    document.querySelector(".nx-root") ?? document.body,
  );
}
