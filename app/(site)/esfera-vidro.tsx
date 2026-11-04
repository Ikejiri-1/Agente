"use client";

import { useEffect, useRef } from "react";
import { criarPassadaDaEsfera, type OpcoesDaEsfera } from "./shader-esfera";

/**
 * Esferas secundárias do site (bolhas dos passos, pilares e planos, "Você decide", chamada final).
 * São ~16 na página e os navegadores limitam os contextos WebGL, então todas dividem UM motor:
 * ele desenha só as que estão na tela, uma de cada vez, e copia o resultado para o canvas 2D de cada esfera.
 */

type Configuracao = { aneis: number; aquecer: number; calmaria: number; passos: number; particulas: number; fio: number };
type Registro = { tela: HTMLCanvasElement; contexto: CanvasRenderingContext2D; lado: number; configuracao: Configuracao; semente: number; visivel: boolean };
type Motor = { canvas: HTMLCanvasElement; desenhar: (opcoes: OpcoesDaEsfera) => void };

const MOVIMENTO_REDUZIDO = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const INTERVALO_ENTRE_QUADROS = 33; // ~30 quadros por segundo: as esferas pequenas não precisam de mais
const ESCALA_DO_CANVAS = 1.69; // o canvas é maior que a esfera: sobra lugar para o halo e os anéis (o raio é 0.8 de 1.35 do palco)

const registros = new Set<Registro>();
const ponteiro: [number, number] = [0, 0];
let motor: Motor | null | undefined;
let quadro = 0;
let ultimoQuadro = 0;
let ouvindoOPonteiro = false;
const inicio = typeof performance === "undefined" ? 0 : performance.now();

function obterMotor(): Motor | null {
  if (motor !== undefined) return motor;
  const canvas = document.createElement("canvas");
  const gl = canvas.getContext("webgl", { alpha: true, premultipliedAlpha: true, antialias: false });
  const desenhar = gl && criarPassadaDaEsfera(gl);
  motor = desenhar ? { canvas, desenhar } : null;
  return motor;
}

function desenharRegistro(motorAtual: Motor, registro: Registro, segundos: number) {
  const { canvas, desenhar } = motorAtual;
  const { lado, tela, contexto, configuracao } = registro;
  if (canvas.width !== lado) canvas.width = canvas.height = lado;
  desenhar({ largura: lado, altura: lado, tempo: segundos + registro.semente * 17, mouse: ponteiro, nascimento: 1, ...configuracao });
  contexto.clearRect(0, 0, tela.width, tela.height);
  contexto.drawImage(canvas, 0, 0);
  tela.classList.add("pronto");
}

function passarOQuadro(agora: number) {
  quadro = 0;
  const motorAtual = obterMotor();
  const visiveis = Array.from(registros).filter((registro) => registro.visivel);
  if (!motorAtual || visiveis.length === 0 || document.hidden) return;
  if (agora - ultimoQuadro >= INTERVALO_ENTRE_QUADROS) {
    ultimoQuadro = agora;
    visiveis.sort((a, b) => a.lado - b.lado); // mesmo tamanho em sequência: o canvas do motor quase não é realocado
    for (const registro of visiveis) desenharRegistro(motorAtual, registro, (agora - inicio) / 1000);
  }
  quadro = requestAnimationFrame(passarOQuadro);
}

function acordarOMotor() {
  if (quadro || MOVIMENTO_REDUZIDO()) return;
  quadro = requestAnimationFrame(passarOQuadro);
}

function aoMoverOPonteiro(evento: PointerEvent) {
  ponteiro[0] = Math.max(-1, Math.min(1, evento.clientX / window.innerWidth * 2 - 1)) * 0.6;
  ponteiro[1] = Math.max(-1, Math.min(1, -(evento.clientY / window.innerHeight * 2 - 1))) * 0.6;
}

export type PropsDaEsfera = { diametro: number; aneis?: number; aquecer?: number; calmaria?: number; semente?: number };

/** O canvas da esfera: vai como primeiro filho do elemento redondo (.nx-orbe ou .nx-esfera), que define --d. */
export function EsferaDeVidro({ diametro, aneis = 0.8, aquecer = 0, calmaria = 0.7, semente = 0 }: PropsDaEsfera) {
  const referencia = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const tela = referencia.current;
    const contexto = tela?.getContext("2d");
    if (!tela || !contexto || !obterMotor()) return;

    const css = diametro * ESCALA_DO_CANVAS;
    const escala = Math.min(window.devicePixelRatio || 1, 1.5);
    const lado = Math.min(288, Math.max(96, Math.ceil((css * escala) / 32) * 32));
    tela.width = tela.height = lado;
    const pequena = diametro < 100;
    const registro: Registro = {
      tela, contexto, lado, semente, visivel: false,
      configuracao: { aneis: diametro < 60 ? 0 : aneis, aquecer, calmaria, passos: pequena ? 12 : 18, particulas: pequena ? 0 : 10, fio: Math.min(2.8, Math.max(1, 300 / css)) },
    };
    registros.add(registro);
    if (!ouvindoOPonteiro) {
      ouvindoOPonteiro = true;
      window.addEventListener("pointermove", aoMoverOPonteiro);
    }

    const observador = new IntersectionObserver(([entrada]) => {
      registro.visivel = entrada.isIntersecting;
      if (!registro.visivel) return;
      if (MOVIMENTO_REDUZIDO()) desenharRegistro(obterMotor()!, registro, 4); // um único quadro, parado
      else acordarOMotor();
    }, { rootMargin: "120px" });
    observador.observe(tela);

    return () => {
      observador.disconnect();
      registros.delete(registro);
    };
  }, [diametro, aneis, aquecer, calmaria, semente]);

  return <canvas ref={referencia} className="nx-shader" aria-hidden="true" />;
}
