"use client";

import { useEffect, useRef } from "react";

/**
 * Rede neural que atravessa a página inteira. Dois canvas fixos:
 *   .nx-rede      atrás do conteúdo: o fundo e os filamentos de luz ligando as bolhas da página.
 *   .nx-formacao  na frente do conteúdo: os pontos de luz que constroem cada bloco ao rolar a página.
 *
 * Cada bolha se declara com atributos:
 *   data-no-id="x"   nome da bolha
 *   data-no-de="y"   de qual bolha ela recebe a rede (o filamento sai de "y" e chega em "x");
 *                    aceita vários nomes separados por espaço (várias quedas convergem em "x")
 * Os filamentos sempre caem na vertical, como uma cachoeira que pousa em cada bolha.
 *
 * Formação: todo elemento com data-revela nasce invisível. Quando ele se aproxima da tela, uma onda de pontos
 * desce pelos filamentos até a bolha dele, a bolha acende, os pontos se espalham para traçar a moldura e os
 * títulos, e só então o conteúdo (classes f2 = moldura e bolha, f3 = textos) se condensa por cima dos pontos.
 * O conteúdo fica sempre no HTML: leitores de tela e busca enxergam tudo; só a aparência é animada.
 */

type Cor = [number, number, number];
const CIANO: Cor = [79, 195, 255];
const OURO: Cor = [255, 196, 92];
const BRANCO: Cor = [235, 248, 255];
const rgba = ([vermelho, verde, azul]: Cor, opacidade: number) => `rgba(${vermelho},${verde},${azul},${opacidade})`;

type Faisca = { fase: number; velocidade: number; dourada: boolean };
type Fio = { desvio: number; fase: number; opacidade: number; largura: number; faiscas: Faisca[] };
type Ligacao = { id: string; de: HTMLElement; para: HTMLElement };
type Ponto = [number, number];
type Curva = { inicio: Ponto; controle1: Ponto; controle2: Ponto; fim: Ponto };
type BaseDaLigacao = { origemX: number; origemY: number; destinoX: number; destinoY: number; vao: number; abertura: number };

/** Ponto que viaja pelos filamentos até a bolha. */
type Viajante = { ligacao: number; fio: number; atraso: number; duracao: number; dourado: boolean };
/** Ponto que sai da bolha e pousa sobre a moldura ou o título. */
type Broto = { dx: number; dy: number; atraso: number; duracao: number; desvio: number; tamanho: number; cor: "branco" | "ciano" | "ouro"; orbe: number };
type Onda = {
  elemento: HTMLElement; inicio: number; ligacoes: Ligacao[]; orbes: HTMLElement[]; viajantes: Viajante[]; brotos: Broto[];
  chegada: number; duracaoTotal: number; moldura: boolean; textos: boolean;
};

const QUANTIDADE_DE_FIOS = 5;
const SELETOR_DE_TEXTO = "h2, h3, p, li, .nx-btn, .nx-etiqueta, .nx-numero, .nx-kicker, strong, .nx-esfera-texto span";
const SELETOR_DE_TITULO = "h2, h3, .nx-preco strong";
const SELETOR_DE_MOLDURA = ".nx-vidro, .nx-hud";
const aleatorio = (minimo: number, maximo: number) => minimo + (maximo - minimo) * Math.random();
const limitar = (valor: number, minimo: number, maximo: number) => Math.min(maximo, Math.max(minimo, valor));
const suave = (u: number) => (u < 0.5 ? 4 * u ** 3 : 1 - (-2 * u + 2) ** 3 / 2);

function criarBrilho(cor: Cor): HTMLCanvasElement {
  const sprite = document.createElement("canvas");
  sprite.width = sprite.height = 64;
  const contexto = sprite.getContext("2d")!;
  const gradiente = contexto.createRadialGradient(32, 32, 0, 32, 32, 32);
  gradiente.addColorStop(0, rgba(cor, 1));
  gradiente.addColorStop(0.2, rgba(cor, 0.5));
  gradiente.addColorStop(1, rgba(cor, 0));
  contexto.fillStyle = gradiente;
  contexto.fillRect(0, 0, 64, 64);
  return sprite;
}

function criarFios(): Fio[] {
  return Array.from({ length: QUANTIDADE_DE_FIOS }, (_, indice) => ({
    desvio: (indice - (QUANTIDADE_DE_FIOS - 1) / 2) * aleatorio(0.5, 1.1),
    fase: aleatorio(0, Math.PI * 2),
    opacidade: aleatorio(0.09, 0.24),
    largura: aleatorio(0.6, 1.3),
    faiscas: Array.from({ length: 2 }, () => ({ fase: Math.random(), velocidade: aleatorio(0.04, 0.12), dourada: Math.random() < 0.45 })),
  }));
}

function pontoNaCurva({ inicio, controle1, controle2, fim }: Curva, u: number): Ponto {
  const inverso = 1 - u;
  const a = inverso ** 3, b = 3 * inverso * inverso * u, c = 3 * inverso * u * u, d = u ** 3;
  return [a * inicio[0] + b * controle1[0] + c * controle2[0] + d * fim[0], a * inicio[1] + b * controle1[1] + c * controle2[1] + d * fim[1]];
}

/** Caixas de cada linha de texto de um elemento (uma por linha quebrada), em coordenadas da janela. */
function caixasDeTexto(elemento: HTMLElement): DOMRect[] {
  const caixas: DOMRect[] = [];
  const andador = document.createTreeWalker(elemento, NodeFilter.SHOW_TEXT);
  for (let no = andador.nextNode(); no; no = andador.nextNode()) {
    if (!no.textContent?.trim()) continue;
    const faixa = document.createRange();
    faixa.selectNodeContents(no);
    caixas.push(...Array.from(faixa.getClientRects()).filter((caixa) => caixa.width > 4 && caixa.height > 4));
  }
  return caixas;
}

export function RedeViva() {
  const referencia = useRef<HTMLCanvasElement>(null);
  const referenciaDaFormacao = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const tela = referencia.current;
    const telaDaFormacao = referenciaDaFormacao.current;
    const contexto = tela?.getContext("2d");
    const contextoDaFormacao = telaDaFormacao?.getContext("2d");
    if (!tela || !telaDaFormacao || !contexto) return;

    const movimentoReduzido = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const brilhos = { ciano: criarBrilho(CIANO), ouro: criarBrilho(OURO), branco: criarBrilho(BRANCO) };
    const fiosPorId = new Map<string, Fio[]>();
    const poeira = Array.from({ length: 210 }, () => ({ x: Math.random(), y: Math.random(), profundidade: aleatorio(0.2, 1),
      tamanho: aleatorio(0.4, 1.6), brilho: aleatorio(0.2, 1), cor: Math.random() < 0.1 ? OURO : Math.random() < 0.55 ? CIANO : BRANCO }));
    const correntes = Array.from({ length: 34 }, () => ({ x: Math.random(), comprimento: aleatorio(0.08, 0.35), fase: Math.random(), velocidade: aleatorio(0.015, 0.05), brilho: aleatorio(0.08, 0.26) }));
    let ligacoes: Ligacao[] = [];
    let ondas: Onda[] = [];
    let formacaoSuja = false;
    let largura = 0, altura = 0, escala = 1, quadro = 0, tempoInicial = performance.now();

    const mapearLigacoes = () => {
      const elementos = Array.from(document.querySelectorAll<HTMLElement>("[data-no-id]"));
      const porId = new Map(elementos.map((elemento) => [elemento.dataset.noId!, elemento]));
      ligacoes = elementos.flatMap((para) =>
        (para.dataset.noDe ?? "").split(/\s+/).filter(Boolean).flatMap((idDeOrigem) => {
          const de = porId.get(idDeOrigem);
          if (!de) return [];
          const id = `${para.dataset.noId}<${idDeOrigem}`;
          if (!fiosPorId.has(id)) fiosPorId.set(id, criarFios());
          return [{ id, de, para }];
        }),
      );
    };

    const redimensionar = () => {
      escala = Math.min(window.devicePixelRatio || 1, 1.5);
      // o tamanho do próprio canvas (sem a barra de rolagem): innerWidth a incluiria e esticaria o desenho, deslocando os filamentos
      largura = tela.clientWidth;
      altura = tela.clientHeight;
      for (const canvas of [tela, telaDaFormacao]) {
        canvas.width = Math.round(largura * escala);
        canvas.height = Math.round(altura * escala);
      }
      mapearLigacoes();
    };

    const centroDe = (elemento: HTMLElement): [number, number, number] => {
      const caixa = elemento.getBoundingClientRect();
      return [caixa.left + caixa.width / 2, caixa.top + caixa.height / 2, Math.max(caixa.width, caixa.height)];
    };

    /** Geometria de uma ligação (lida uma vez por quadro) e a curva de cada um dos seus fios. */
    const baseDaLigacao = ({ de, para }: Ligacao): BaseDaLigacao => {
      const [origemX, origemY, tamanhoDeOrigem] = centroDe(de);
      const [destinoX, destinoY, tamanhoDeDestino] = centroDe(para);
      return { origemX, origemY, destinoX, destinoY, vao: Math.hypot(destinoX - origemX, destinoY - origemY), abertura: Math.min(tamanhoDeOrigem, tamanhoDeDestino) * 0.07 };
    };

    const curvaDoFio = (base: BaseDaLigacao, indice: number, fio: Fio, tempo: number): Curva => {
      const centralizado = indice - (QUANTIDADE_DE_FIOS - 1) / 2;
      const lateral = fio.desvio * Math.min(base.vao * 0.05, 26) + Math.sin(tempo * 0.5 + fio.fase) * 5;
      const dy = base.destinoY - base.origemY;
      const inicio: Ponto = [base.origemX + centralizado * base.abertura, base.origemY];
      const fim: Ponto = [base.destinoX + centralizado * base.abertura, base.destinoY];
      return { inicio, fim, controle1: [inicio[0] + lateral, base.origemY + dy * 0.5], controle2: [fim[0] + lateral * 0.6, base.destinoY - dy * 0.35] }; // sai e pousa na vertical
    };

    const desenharFundo = (tempo: number, rolagem: number) => {
      const base = contexto.createLinearGradient(0, 0, 0, altura);
      base.addColorStop(0, "#010720"); base.addColorStop(0.5, "#031238"); base.addColorStop(1, "#020c2c");
      contexto.fillStyle = base; contexto.fillRect(0, 0, largura, altura);
      contexto.globalCompositeOperation = "lighter";
      for (const [fracaoX, fracaoY, raioRelativo, cor, opacidade] of [
        [0.14, 0.3, 0.55, [20, 70, 190], 0.2], [0.86, 0.62, 0.5, [20, 80, 200], 0.18], [0.5, 0.92, 0.7, [30, 110, 255], 0.13],
      ] as [number, number, number, Cor, number][]) {
        const y = (fracaoY + Math.sin(rolagem / 900 + fracaoX * 6) * 0.2) * altura, raio = Math.max(largura, altura) * raioRelativo;
        const gradiente = contexto.createRadialGradient(fracaoX * largura, y, 0, fracaoX * largura, y, raio);
        gradiente.addColorStop(0, rgba(cor, opacidade)); gradiente.addColorStop(1, rgba(cor, 0));
        contexto.fillStyle = gradiente; contexto.fillRect(0, 0, largura, altura);
      }
      for (const corrente of correntes) { // correntes de dados caindo (microdetalhe)
        const x = corrente.x * largura, comprimento = corrente.comprimento * altura;
        const cabeca = ((corrente.fase + tempo * corrente.velocidade) % 1) * (altura + comprimento) - comprimento;
        const gradiente = contexto.createLinearGradient(0, cabeca, 0, cabeca + comprimento);
        gradiente.addColorStop(0, rgba(CIANO, 0)); gradiente.addColorStop(1, rgba(CIANO, corrente.brilho));
        contexto.fillStyle = gradiente; contexto.fillRect(x, cabeca, 1, comprimento);
      }
      for (const grao of poeira) {
        const y = (((grao.y * altura - rolagem * grao.profundidade * 0.25) % altura) + altura) % altura;
        const cintilacao = 0.6 + 0.4 * Math.sin(tempo * 1.6 + grao.x * 40 + grao.y * 30);
        contexto.fillStyle = rgba(grao.cor, grao.brilho * cintilacao * 0.8);
        contexto.fillRect(grao.x * largura, y, grao.tamanho, grao.tamanho);
      }
    };

    const desenharLigacao = (ligacao: Ligacao, tempo: number) => {
      const base = baseDaLigacao(ligacao);
      if (Math.max(base.origemY, base.destinoY) < -80 || Math.min(base.origemY, base.destinoY) > altura + 80) return; // fora da tela
      const brilho = largura < 720 ? 0.6 : 1; // no celular as quedas se empilham na mesma coluna: menos luz atrás do texto
      for (const [indice, fio] of (fiosPorId.get(ligacao.id) ?? []).entries()) {
        const curva = curvaDoFio(base, indice, fio, tempo);
        contexto.beginPath(); contexto.moveTo(curva.inicio[0], curva.inicio[1]);
        contexto.bezierCurveTo(curva.controle1[0], curva.controle1[1], curva.controle2[0], curva.controle2[1], curva.fim[0], curva.fim[1]);
        contexto.lineCap = "round";
        contexto.strokeStyle = rgba(CIANO, fio.opacidade * 0.22 * brilho); contexto.lineWidth = fio.largura * 4; contexto.stroke(); // véu largo
        contexto.strokeStyle = rgba(CIANO, fio.opacidade * brilho); contexto.lineWidth = fio.largura; contexto.stroke(); // núcleo fino
        for (const faisca of fio.faiscas) {
          const progresso = (faisca.fase + tempo * faisca.velocidade) % 1, intensidade = Math.sin(progresso * Math.PI);
          const [x, y] = pontoNaCurva(curva, progresso);
          const tamanho = 16 * intensidade + 3;
          contexto.globalAlpha = 0.65 * intensidade;
          contexto.drawImage(faisca.dourada ? brilhos.ouro : brilhos.branco, x - tamanho / 2, y - tamanho / 2, tamanho, tamanho);
        }
        contexto.globalAlpha = 1;
      }
    };

    // ======================= FORMAÇÃO DO CONTEÚDO =======================

    const revelarJa = (elemento: HTMLElement) => elemento.classList.add("inst", "f2", "f3");

    const numerarTextos = (elemento: HTMLElement) =>
      elemento.querySelectorAll<HTMLElement>(SELETOR_DE_TEXTO).forEach((texto, indice) => texto.style.setProperty("--i", String(Math.min(indice, 14))));

    /** Prepara a onda de um elemento: quem desce pelos filamentos e onde cada ponto vai pousar. */
    const formar = (elemento: HTMLElement) => {
      if (movimentoReduzido || !contextoDaFormacao || largura === 0) return revelarJa(elemento);
      numerarTextos(elemento);
      window.setTimeout(() => elemento.classList.add("f2", "f3"), 7000); // rede de segurança: o conteúdo nunca fica preso invisível

      const leve = largura < 720; // no celular, menos pontos
      const ligadas = ligacoes.filter((ligacao) => elemento.contains(ligacao.para));
      const orbes = [...new Set(ligadas.map((ligacao) => ligacao.para))];
      const caixa = elemento.getBoundingClientRect();

      const viajantes: Viajante[] = ligadas.flatMap((ligacao, indice) => {
        const duracao = limitar(0.45 + baseDaLigacao(ligacao).vao / 2600, 0.5, 1);
        return Array.from({ length: leve ? 8 : 14 }, () => ({ ligacao: indice, fio: Math.floor(Math.random() * QUANTIDADE_DE_FIOS),
          atraso: aleatorio(0, 0.4), duracao, dourado: Math.random() < 0.4 }));
      });
      const chegada = viajantes.length ? Math.min(...viajantes.map((v) => v.atraso + v.duracao)) + 0.05 : 0.15;

      const centrosDasOrbes = orbes.map(centroDe);
      const brotos: Broto[] = [];
      const lancar = (dx: number, dy: number, ordem: number) => {
        let orbe = -1, menor = Infinity;
        centrosDasOrbes.forEach(([x, y], indice) => {
          const distancia = Math.hypot(caixa.left + dx - x, caixa.top + dy - y);
          if (distancia < menor) { menor = distancia; orbe = indice; }
        });
        const sorteio = Math.random();
        brotos.push({ dx, dy, atraso: limitar(ordem, 0, 1) * 0.55 + aleatorio(0, 0.12), duracao: aleatorio(0.5, 0.8), desvio: aleatorio(-40, 40),
          tamanho: aleatorio(8, 14), cor: sorteio < 0.1 ? "ouro" : sorteio < 0.3 ? "ciano" : "branco", orbe });
      };

      // moldura: os pontos percorrem a borda do cartão, um depois do outro
      const molduras = [elemento, ...elemento.querySelectorAll<HTMLElement>(SELETOR_DE_MOLDURA)].filter((item) => item.matches(SELETOR_DE_MOLDURA));
      for (const moldura of molduras) {
        const area = moldura.getBoundingClientRect();
        if (area.width < 40 || area.height < 40) continue;
        const rx = area.left - caixa.left, ry = area.top - caixa.top, perimetro = 2 * (area.width + area.height);
        const quantidade = Math.min(leve ? 40 : 80, Math.round(perimetro / 14));
        for (let indice = 0; indice < quantidade; indice++) {
          let percorrido = (indice / quantidade) * perimetro, x = 0, y = 0;
          if (percorrido < area.width) { x = percorrido; y = 0; }
          else if ((percorrido -= area.width) < area.height) { x = area.width; y = percorrido; }
          else if ((percorrido -= area.height) < area.width) { x = area.width - percorrido; y = area.height; }
          else { percorrido -= area.width; x = 0; y = area.height - percorrido; }
          lancar(rx + x, ry + y, indice / quantidade);
        }
      }
      // títulos: os pontos pousam sobre as próprias letras, linha por linha, da esquerda para a direita
      let linhaGlobal = 0;
      for (const titulo of elemento.querySelectorAll<HTMLElement>(SELETOR_DE_TITULO)) {
        for (const linha of caixasDeTexto(titulo)) {
          const quantidade = Math.min(leve ? 22 : 44, Math.round(linha.width / (leve ? 16 : 10)));
          for (let indice = 0; indice < quantidade; indice++) {
            const fracao = (indice + Math.random()) / quantidade;
            lancar(linha.left - caixa.left + fracao * linha.width, linha.top - caixa.top + linha.height * aleatorio(0.2, 0.85), 0.35 + linhaGlobal * 0.25 + fracao * 0.3);
          }
          linhaGlobal++;
        }
      }
      const duracaoTotal = chegada + Math.max(0.6, ...brotos.map((broto) => broto.atraso + broto.duracao + 0.75));
      ondas.push({ elemento, inicio: performance.now(), ligacoes: ligadas, orbes, viajantes, brotos, chegada, duracaoTotal, moldura: false, textos: false });
    };

    const desenharPonto = (sprite: HTMLCanvasElement, x: number, y: number, tamanho: number, opacidade: number) => {
      if (opacidade <= 0.01 || y < -40 || y > altura + 40) return;
      contextoDaFormacao!.globalAlpha = Math.min(1, opacidade);
      contextoDaFormacao!.drawImage(sprite, x - tamanho / 2, y - tamanho / 2, tamanho, tamanho);
    };

    const desenharFormacao = (agora: number, tempo: number) => {
      const c = contextoDaFormacao;
      if (!c) return;
      if (!ondas.length) {
        if (formacaoSuja) { c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, telaDaFormacao.width, telaDaFormacao.height); formacaoSuja = false; }
        return;
      }
      formacaoSuja = true;
      c.setTransform(escala, 0, 0, escala, 0, 0);
      c.clearRect(0, 0, largura, altura);
      c.globalCompositeOperation = "lighter";
      for (const onda of ondas) {
        const decorrido = (agora - onda.inicio) / 1000;
        if (!onda.moldura && decorrido >= onda.chegada + 0.18) { onda.moldura = true; onda.elemento.classList.add("f2"); }
        if (!onda.textos && decorrido >= onda.chegada + 0.55) { onda.textos = true; onda.elemento.classList.add("f3"); }
        const caixa = onda.elemento.getBoundingClientRect();
        if (caixa.bottom < -60) { // o leitor passou direto por este bloco: ele aparece pronto e a onda termina
          revelarJa(onda.elemento);
          onda.duracaoTotal = 0;
          continue;
        }
        // 1) a onda desce pelos filamentos
        const bases = onda.ligacoes.map(baseDaLigacao);
        for (const viajante of onda.viajantes) {
          const progresso = (decorrido - viajante.atraso) / viajante.duracao;
          if (progresso <= 0 || progresso >= 1) continue;
          const fio = fiosPorId.get(onda.ligacoes[viajante.ligacao].id)?.[viajante.fio];
          if (!fio) continue;
          const curva = curvaDoFio(bases[viajante.ligacao], viajante.fio, fio, tempo);
          const sprite = viajante.dourado ? brilhos.ouro : brilhos.branco;
          for (let cauda = 0; cauda < 4; cauda++) { // cauda curta: parece cometa
            const [x, y] = pontoNaCurva(curva, Math.max(0, suave(progresso) - cauda * 0.022));
            desenharPonto(sprite, x, y, 22 - cauda * 4, Math.sin(progresso * Math.PI) * (1 - cauda * 0.27));
          }
        }
        // 2) a bolha acende quando a onda chega
        const centros = onda.orbes.map(centroDe);
        const desdeAChegada = decorrido - onda.chegada;
        if (desdeAChegada > 0 && desdeAChegada < 0.95) {
          const fase = desdeAChegada / 0.95;
          for (const [x, y, tamanho] of centros) {
            desenharPonto(brilhos.branco, x, y, tamanho * (1.2 + fase), (1 - fase) * 0.9);
            for (const defasagem of [0, 0.22]) {
              const f = Math.max(0, fase - defasagem);
              if (f <= 0) continue;
              c.globalAlpha = (1 - f) * 0.7; c.strokeStyle = rgba(BRANCO, 1); c.lineWidth = 1.6;
              c.beginPath(); c.arc(x, y, tamanho * (0.5 + f * 1.1), 0, Math.PI * 2); c.stroke();
            }
          }
        }
        // 3) os pontos saem da bolha, traçam a moldura e pousam sobre os títulos
        for (const broto of onda.brotos) {
          const s = decorrido - onda.chegada - broto.atraso;
          if (s < 0) continue;
          const centro = centros[broto.orbe];
          const origemX = centro ? centro[0] : caixa.left + caixa.width / 2, origemY = centro ? centro[1] : caixa.top;
          const alvoX = caixa.left + broto.dx, alvoY = caixa.top + broto.dy;
          const u = Math.min(1, s / broto.duracao), e = 1 - (1 - u) ** 3;
          const depois = s - broto.duracao; // tempo parado no destino
          const opacidade = depois <= 0 ? Math.min(1, s / 0.12) : 1 - limitar((depois - 0.3) / 0.4, 0, 1);
          if (depois > 0.7) continue;
          const tamanho = broto.tamanho * (depois <= 0 ? 0.7 + 0.3 * u : 1 - limitar((depois - 0.3) / 0.4, 0, 1) * 0.6);
          desenharPonto(brilhos[broto.cor], origemX + (alvoX - origemX) * e + Math.sin(u * Math.PI) * broto.desvio, origemY + (alvoY - origemY) * e, tamanho, opacidade);
        }
      }
      ondas = ondas.filter((onda) => (agora - onda.inicio) / 1000 < onda.duracaoTotal);
      c.globalAlpha = 1; c.globalCompositeOperation = "source-over";
    };

    // ======================= CICLO =======================

    const desenhar = (agora: number) => {
      const tempo = movimentoReduzido ? 3 : (agora - tempoInicial) / 1000;
      contexto.setTransform(escala, 0, 0, escala, 0, 0);
      contexto.globalCompositeOperation = "source-over";
      desenharFundo(tempo, window.scrollY);
      contexto.globalCompositeOperation = "lighter";
      const jaComHalo = new Set<HTMLElement>();
      for (const ligacao of ligacoes) {
        desenharLigacao(ligacao, tempo);
        for (const elemento of [ligacao.de, ligacao.para]) {
          if (jaComHalo.has(elemento)) continue;
          jaComHalo.add(elemento);
          const [x, y, tamanho] = centroDe(elemento);
          if (tamanho < 20 || y < -tamanho * 2 || y > altura + tamanho * 2) continue; // pontos de saída não brilham
          contexto.globalAlpha = 0.5; contexto.drawImage(brilhos.ciano, x - tamanho * 1.6, y - tamanho * 1.6, tamanho * 3.2, tamanho * 3.2);
        }
      }
      contexto.globalAlpha = 1; contexto.globalCompositeOperation = "source-over";
      desenharFormacao(agora, tempo);
    };

    const animar = (agora: number) => {
      if (!document.hidden) desenhar(agora);
      quadro = requestAnimationFrame(animar);
    };
    const redesenharUmaVez = () => { cancelAnimationFrame(quadro); quadro = requestAnimationFrame((agora) => desenhar(agora)); };

    redimensionar();

    // observa os blocos: entrando na tela forma o conteúdo; blocos que o leitor já deixou para trás aparecem prontos
    const observadorDeBlocos = new IntersectionObserver(
      (entradas) => {
        for (const entrada of entradas) {
          const elemento = entrada.target as HTMLElement;
          if (entrada.isIntersecting) { observadorDeBlocos.unobserve(elemento); formar(elemento); }
          else if (entrada.boundingClientRect.bottom < 0) { observadorDeBlocos.unobserve(elemento); revelarJa(elemento); }
        }
      },
      { rootMargin: "0px 0px -12% 0px" },
    );
    document.querySelectorAll<HTMLElement>("[data-revela]").forEach((elemento) => {
      if (movimentoReduzido) revelarJa(elemento);
      else observadorDeBlocos.observe(elemento);
    });

    const observadorDeTamanho = new ResizeObserver(() => { mapearLigacoes(); if (movimentoReduzido) redesenharUmaVez(); });
    observadorDeTamanho.observe(document.body);
    window.addEventListener("resize", redimensionar);
    if (movimentoReduzido) {
      window.addEventListener("scroll", redesenharUmaVez, { passive: true });
      redesenharUmaVez();
    } else {
      quadro = requestAnimationFrame(animar);
    }
    tempoInicial = performance.now();
    return () => {
      cancelAnimationFrame(quadro);
      observadorDeBlocos.disconnect();
      observadorDeTamanho.disconnect();
      window.removeEventListener("resize", redimensionar);
      window.removeEventListener("scroll", redesenharUmaVez);
    };
  }, []);

  return (
    <>
      <canvas ref={referencia} className="nx-rede" aria-hidden="true" />
      <canvas ref={referenciaDaFormacao} className="nx-formacao" aria-hidden="true" />
    </>
  );
}
