"use client";

import { useEffect, useRef, useState } from "react";
import { HologramaDoAgente, type AlvoDoHolograma } from "./holograma-agente";

/**
 * Cena animada da rede neural (public/rede-neural-nexa.html), isolada em um iframe do mesmo domínio.
 * Conversa com ela por postMessage:
 *   página -> cena   "visibilidade": fora da tela a animação pausa (o iframe não enxerga a rolagem da página);
 *                    "nexa-limpar": fecha o cartão de hover quando o holograma abre.
 *   cena -> página   "nexa-abrir": o clique numa bolha do agente; a página abre o holograma a partir daquela bolha.
 */
export function CenaNeural() {
  const quadro = useRef<HTMLIFrameElement>(null);
  const [alvo, definirAlvo] = useState<AlvoDoHolograma | null>(null);

  useEffect(() => {
    const elemento = quadro.current;
    if (!elemento) return;
    let visivel = true;
    const avisarVisibilidade = () =>
      elemento.contentWindow?.postMessage({ tipo: "visibilidade", visivel }, window.location.origin);
    const observador = new IntersectionObserver(([entrada]) => {
      visivel = entrada.isIntersecting;
      avisarVisibilidade();
    });
    observador.observe(elemento);
    elemento.addEventListener("load", avisarVisibilidade);

    const aoReceber = (evento: MessageEvent) => {
      const dados = evento.data;
      if (evento.origin !== window.location.origin || evento.source !== elemento.contentWindow) return;
      if (!dados || dados.tipo !== "nexa-abrir" || typeof dados.chave !== "string" || !(dados.largura > 0)) return;
      const caixa = elemento.getBoundingClientRect();
      const fator = caixa.width / dados.largura; // converte do palco da cena para a janela da página
      definirAlvo({ chave: dados.chave, nome: String(dados.nome), x: caixa.left + dados.x * fator, y: caixa.top + dados.y * fator, raio: dados.raio * fator });
      elemento.contentWindow?.postMessage({ tipo: "nexa-limpar" }, window.location.origin);
    };
    window.addEventListener("message", aoReceber);
    return () => {
      observador.disconnect();
      elemento.removeEventListener("load", avisarVisibilidade);
      window.removeEventListener("message", aoReceber);
    };
  }, []);

  const fechar = (paraPlanos: boolean) => {
    definirAlvo(null);
    if (!paraPlanos) quadro.current?.focus({ preventScroll: true });
  };

  return (
    <section className="nx-cena" aria-label="Como o agente trabalha para você">
      <iframe
        ref={quadro}
        src="/rede-neural-nexa.html?embutido=1"
        title="Ilustração animada: o agente de IA no centro, ligado a pesquisa, comparação, compra, pagamento e estoque. Clique numa bolha para ver o holograma dela."
        loading="lazy"
      />
      {/* origem da rede da página: a base da esfera da cena. A posição vertical (CSS) acompanha o layout da cena. */}
      <span className="nx-ancora" data-no-id="cena" aria-hidden="true" />
      {alvo && <HologramaDoAgente alvo={alvo} aoFechar={fechar} />}
    </section>
  );
}
