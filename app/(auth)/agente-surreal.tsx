"use client";

import { useEffect, useRef, useState } from "react";
import { Esfera } from "../(site)/componentes";
import { criarPassadaDaEsfera } from "../(site)/shader-esfera";

/** O agente grande do login: a esfera de vidro com todo o detalhe e seu próprio contexto WebGL. Sem WebGL, cai na esfera de CSS do site. */
export function AgenteSurreal({ rotulo }: { rotulo: string }) {
  const referencia = useRef<HTMLCanvasElement>(null);
  const [semWebgl, setSemWebgl] = useState(false);

  useEffect(() => {
    const tela = referencia.current;
    const gl = tela?.getContext("webgl", { alpha: true, premultipliedAlpha: true, antialias: false });
    const desenharEsfera = gl && criarPassadaDaEsfera(gl);
    if (!tela || !gl || !desenharEsfera) return setSemWebgl(true);

    const movimentoReduzido = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const alvo = { x: 0, y: 0 };
    const suave = { x: 0, y: 0 };
    let visivel = true, quadro = 0;
    const inicio = performance.now();

    const redimensionar = () => {
      const escala = Math.min(window.devicePixelRatio || 1, 1.5) * 0.85;
      tela.width = Math.round(tela.clientWidth * escala);
      tela.height = Math.round(tela.clientHeight * escala);
    };

    const desenhar = (agora: number) => {
      const segundos = movimentoReduzido ? 4 : (agora - inicio) / 1000;
      suave.x += (alvo.x - suave.x) * 0.06;
      suave.y += (alvo.y - suave.y) * 0.06;
      desenharEsfera({
        largura: tela.width, altura: tela.height, tempo: segundos, mouse: [suave.x, suave.y], nascimento: movimentoReduzido ? 1 : Math.min(segundos / 1.8, 1),
        passos: 22, particulas: 26, aneis: 1, aquecer: 0, calmaria: 1, fio: 1,
      });
      if (!movimentoReduzido && visivel) quadro = requestAnimationFrame(desenhar);
    };

    const aoMoverMouse = (evento: PointerEvent) => {
      const caixa = tela.getBoundingClientRect();
      alvo.x = Math.max(-1, Math.min(1, (evento.clientX - (caixa.left + caixa.width / 2)) / (window.innerWidth / 2)));
      alvo.y = Math.max(-1, Math.min(1, -(evento.clientY - (caixa.top + caixa.height / 2)) / (window.innerHeight / 2)));
    };
    const alternar = () => {
      cancelAnimationFrame(quadro);
      if (visivel && !document.hidden) quadro = requestAnimationFrame(desenhar);
    };
    const observador = new IntersectionObserver(([entrada]) => { visivel = entrada.isIntersecting; alternar(); });

    redimensionar();
    observador.observe(tela);
    window.addEventListener("resize", redimensionar);
    window.addEventListener("pointermove", aoMoverMouse);
    document.addEventListener("visibilitychange", alternar);
    quadro = requestAnimationFrame(desenhar);
    return () => {
      cancelAnimationFrame(quadro);
      observador.disconnect();
      window.removeEventListener("resize", redimensionar);
      window.removeEventListener("pointermove", aoMoverMouse);
      document.removeEventListener("visibilitychange", alternar);
    };
  }, []);

  if (semWebgl) {
    return (
      <Esfera diametro={170} id="auth-esfera" de="">
        <strong>{rotulo}</strong>
      </Esfera>
    );
  }
  return <canvas ref={referencia} className="au-agente" />;
}
