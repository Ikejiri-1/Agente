"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createContext, useContext, useState, type MouseEvent, type ReactNode } from "react";

/**
 * Troca entre Entrar e Criar conta. Só o painel e a mensagem trocam: o painel colapsa até o meio dele
 * ("fecha"), a rota muda e o próximo abre do mesmo ponto ("abre"). O resto da tela (agente, fundo) fica parado.
 */
export type Fase = "abre" | "fecha";

const DURACAO_DO_FECHAMENTO = 640;
const Contexto = createContext<{ fase: Fase; trocarPara: (destino: string) => void }>({ fase: "abre", trocarPara: () => {} });

export const useFase = () => useContext(Contexto).fase;

export function TrocaProvider({ children }: { children: ReactNode }) {
  const caminho = usePathname();
  const roteador = useRouter();
  const [destino, setDestino] = useState<string | null>(null);
  const [caminhoAnterior, setCaminhoAnterior] = useState(caminho);

  // a rota mudou (pelo link ou pelo botão voltar): o fechamento acabou e o novo painel abre
  if (caminhoAnterior !== caminho) {
    setCaminhoAnterior(caminho);
    setDestino(null);
  }

  const fase: Fase = destino ? "fecha" : "abre";

  const trocarPara = (proximo: string) => {
    if (destino || proximo === caminho) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return roteador.push(proximo);
    setDestino(proximo);
    setTimeout(() => roteador.push(proximo), DURACAO_DO_FECHAMENTO);
  };

  return <Contexto.Provider value={{ fase, trocarPara }}>{children}</Contexto.Provider>;
}

/** Link entre Entrar e Criar conta: dispara o fechamento do painel antes de navegar. */
export function LinkTroca({ href, children }: { href: string; children: ReactNode }) {
  const { trocarPara } = useContext(Contexto);
  const aoClicar = (evento: MouseEvent<HTMLAnchorElement>) => {
    if (evento.metaKey || evento.ctrlKey || evento.shiftKey || evento.button !== 0) return;
    evento.preventDefault();
    trocarPara(href);
  };
  return <Link href={href} onClick={aoClicar}>{children}</Link>;
}
