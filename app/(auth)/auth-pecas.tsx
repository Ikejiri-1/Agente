"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { Base } from "../(site)/componentes";
import { AgenteSurreal } from "./agente-surreal";
import { useFase } from "./troca";

/** A mensagem que o agente "diz" abaixo dele em cada tela. */
const MENSAGENS: Record<string, [string, string][]> = {
  "/login": [
    ["PEDIDO", "você pede"],
    ["LIMITE", "você define"],
    ["PROPOSTA", "pronta"],
    ["APROVAÇÃO", "sua"],
  ],
  "/cadastro": [
    ["PLANO", "grátis para começar"],
    ["COMPRAS", "só com o seu OK"],
    ["REGISTRO", "de cada decisão"],
    ["DADOS", "exclusão sob pedido"],
  ],
};

const INTERVALO_DA_DIGITACAO = 24;
const ESPERA_ANTES_DE_DIGITAR = 700; // o painel de mensagem termina de abrir primeiro

/** A mensagem se escreve sozinha, letra a letra. O texto inteiro já ocupa o espaço (invisível): o painel não muda de tamanho. */
function Mensagem({ linhas }: { linhas: [string, string][] }) {
  const textos = linhas.map(([chave, valor]) => ({ chave: `[${chave}]`, completo: `[${chave}] ${valor}` }));
  const total = textos.reduce((soma, { completo }) => soma + completo.length, 0);
  const [digitados, setDigitados] = useState(0);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return setDigitados(total);
    let intervalo: ReturnType<typeof setInterval> | undefined;
    const espera = setTimeout(() => {
      let escritos = 0;
      intervalo = setInterval(() => {
        setDigitados(++escritos);
        if (escritos >= total) clearInterval(intervalo);
      }, INTERVALO_DA_DIGITACAO);
    }, ESPERA_ANTES_DE_DIGITAR);
    return () => {
      clearTimeout(espera);
      clearInterval(intervalo);
    };
  }, [total]);

  let inicioDaLinha = 0;
  return (
    <>
      {textos.map(({ chave, completo }, indice) => {
        const escritos = Math.min(Math.max(digitados - inicioDaLinha, 0), completo.length);
        const ultima = indice === textos.length - 1;
        const naLinha = (digitados >= inicioDaLinha && digitados < inicioDaLinha + completo.length) || (ultima && digitados >= total);
        inicioDaLinha += completo.length;
        return (
          <p key={chave}>
            <b>{completo.slice(0, Math.min(escritos, chave.length))}</b>
            {escritos > chave.length && completo.slice(chave.length, escritos)}
            {naLinha && <i className="au-cursor" />}
            <span className="au-resto">{completo.slice(escritos)}</span>
          </p>
        );
      })}
    </>
  );
}

/** Painel de mensagem sob o agente: colapsa até o meio e abre de novo junto com o painel do formulário. */
function Dados() {
  const caminho = usePathname();
  const fase = useFase();
  return (
    <div className={`au-dados-wrap ${fase}`}>
      <div className="nx-hud au-dados">
        <Mensagem key={caminho} linhas={MENSAGENS[caminho] ?? MENSAGENS["/login"]} />
      </div>
      <i className="au-nucleo" aria-hidden="true" />
    </div>
  );
}

/** Lado esquerdo: o agente projetado de uma plataforma holográfica. Fica no layout, então não reinicia a cada troca de tela. */
export function CenaDoAgente() {
  return (
    <div className="au-cena" aria-hidden="true">
      <div className="au-cena-topo">
        <AgenteSurreal rotulo="Agente" />
      </div>
      <div className="nx-feixe au-feixe" />
      <div className="au-base">
        <Base />
      </div>
      <Dados />
    </div>
  );
}

/** Lado direito: o painel da página atual (Entrar ou Criar conta) com o ponto de luz em que ele fecha e abre. */
export function PainelDaTela({ children }: { children: ReactNode }) {
  const fase = useFase();
  return (
    <div className={`au-painel-wrap ${fase}`}>
      {children}
      <i className="au-nucleo" aria-hidden="true" />
    </div>
  );
}

const ICONES = {
  email: <path d="M3 6h18v12H3zM3 7l9 7 9-7" />,
  senha: <path d="M6 11h12v9H6zM8.5 11V8a3.5 3.5 0 0 1 7 0v3" />,
  nome: <path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4.5 20a7.5 7.5 0 0 1 15 0" />,
};

function IconeDoCampo({ nome }: { nome: keyof typeof ICONES }) {
  return (
    <svg className="au-icone" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {ICONES[nome]}
    </svg>
  );
}

type PropsDoCampo = {
  rotulo: string;
  name: string;
  icone: keyof typeof ICONES;
  type?: "text" | "email" | "password";
  autoComplete: string;
  minLength?: number;
  maxLength?: number;
  dica?: string;
};

/** Campo de vidro: ícone, brilho ao focar e uma linha de varredura na base. */
export function Campo({ rotulo, icone, type = "text", dica, ...resto }: PropsDoCampo) {
  const [visivel, setVisivel] = useState(false);
  const ehSenha = type === "password";
  return (
    <label className="au-campo">
      <span className="au-rotulo">{rotulo}</span>
      <span className="au-entrada">
        <IconeDoCampo nome={icone} />
        <input {...resto} type={ehSenha && visivel ? "text" : type} required />
        {ehSenha && (
          <button type="button" className="au-olho" onClick={() => setVisivel((v) => !v)} aria-pressed={visivel} aria-label={visivel ? "Ocultar senha" : "Mostrar senha"}>
            {visivel ? "OCULTAR" : "VER"}
          </button>
        )}
      </span>
      {dica && <span className="au-dica">{dica}</span>}
    </label>
  );
}

/** Botão de envio: mostra o estado de autenticação enquanto a ação do servidor roda. */
export function Enviar({ children, enviando }: { children: ReactNode; enviando: string }) {
  const { pending } = useFormStatus();
  return (
    <button className="nx-btn nx-btn-solid au-enviar" disabled={pending} aria-busy={pending}>
      {pending ? <><span className="au-spinner" aria-hidden="true" /> {enviando}</> : children}
    </button>
  );
}
