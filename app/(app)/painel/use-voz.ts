"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { dividirParaFala, mensagemDeErroDeVoz, textoParaFala } from "@/lib/voz";

/**
 * Voz do chat, com as APIs do próprio navegador (sem servidor nosso, sem custo):
 *   - ouvir: SpeechRecognition (Chrome, Edge e Safari; não existe no Firefox). No Chrome/Edge o áudio é transcrito
 *     pelos servidores da Google/Microsoft, e o navegador só libera o microfone em HTTPS ou em localhost.
 *   - falar: speechSynthesis (voz do sistema, em português do Brasil).
 */

type Resultado = ArrayLike<{ transcript: string }> & { isFinal: boolean };
type EventoDeResultado = { resultIndex: number; results: ArrayLike<Resultado> };
type Reconhecimento = {
  lang: string; interimResults: boolean; continuous: boolean; maxAlternatives: number;
  onresult: ((e: EventoDeResultado) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void; stop(): void; abort(): void;
};
type ConstrutorDeReconhecimento = new () => Reconhecimento;

const CHAVE_DA_FALA = "nexa-voz-resposta";
const LINGUA = "pt-BR";

function construtorDoReconhecimento(): ConstrutorDeReconhecimento | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: ConstrutorDeReconhecimento; webkitSpeechRecognition?: ConstrutorDeReconhecimento };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

/** Prefere uma voz em português do Brasil; as vozes carregam depois da página, por isso é escolhida na hora de falar. */
function escolherVoz(): SpeechSynthesisVoice | undefined {
  const vozes = window.speechSynthesis.getVoices();
  return vozes.find((v) => v.lang === LINGUA && /google|natural|online/i.test(v.name)) ?? vozes.find((v) => v.lang === LINGUA) ?? vozes.find((v) => v.lang.toLowerCase().startsWith("pt"));
}

export function useVoz(aoOuvir: (texto: string) => void) {
  const [suporteEntrada, setSuporteEntrada] = useState(false);
  const [suporteSaida, setSuporteSaida] = useState(false);
  const [ouvindo, setOuvindo] = useState(false);
  const [falando, setFalando] = useState(false);
  const [parcial, setParcial] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [falaAtiva, setFalaAtiva] = useState(false);

  const reconhecimento = useRef<Reconhecimento | null>(null);
  const aoOuvirAtual = useRef(aoOuvir);
  useEffect(() => { aoOuvirAtual.current = aoOuvir; });

  useEffect(() => {
    setSuporteEntrada(construtorDoReconhecimento() !== null);
    setSuporteSaida("speechSynthesis" in window);
    setFalaAtiva(window.localStorage.getItem(CHAVE_DA_FALA) === "1");
    return () => { // ao sair da tela: silêncio e microfone desligado
      reconhecimento.current?.abort();
      if ("speechSynthesis" in window) window.speechSynthesis.cancel();
    };
  }, []);

  const pararFala = useCallback(() => {
    if ("speechSynthesis" in window) window.speechSynthesis.cancel();
    setFalando(false);
  }, []);

  const falar = useCallback((texto: string) => {
    if (!("speechSynthesis" in window)) return;
    const partes = dividirParaFala(textoParaFala(texto));
    if (partes.length === 0) return;
    window.speechSynthesis.cancel();
    const voz = escolherVoz();
    partes.forEach((parte, indice) => {
      const fala = new SpeechSynthesisUtterance(parte);
      fala.lang = LINGUA;
      fala.rate = 1.05;
      if (voz) fala.voice = voz;
      if (indice === 0) fala.onstart = () => setFalando(true);
      if (indice === partes.length - 1) fala.onend = () => setFalando(false);
      fala.onerror = () => setFalando(false);
      window.speechSynthesis.speak(fala);
    });
  }, []);

  const alternarFala = useCallback(() => {
    setFalaAtiva((ativa) => {
      window.localStorage.setItem(CHAVE_DA_FALA, ativa ? "0" : "1");
      if (ativa) pararFala();
      return !ativa;
    });
  }, [pararFala]);

  const pararDeOuvir = useCallback(() => reconhecimento.current?.stop(), []);

  const ouvir = useCallback(() => {
    const Construtor = construtorDoReconhecimento();
    if (!Construtor || reconhecimento.current) return;
    pararFala(); // a Nexa se cala para não ouvir a si mesma
    setErro(null);
    setParcial("");

    const rec = new Construtor();
    rec.lang = LINGUA;
    rec.interimResults = true;
    rec.continuous = false;
    rec.maxAlternatives = 1;
    let finais = "";
    let provisorio = "";
    let falhou = false;

    rec.onresult = (evento) => {
      provisorio = "";
      for (let i = evento.resultIndex; i < evento.results.length; i++) {
        const resultado = evento.results[i];
        if (resultado.isFinal) finais += resultado[0].transcript;
        else provisorio += resultado[0].transcript;
      }
      setParcial((finais + provisorio).trim());
    };
    rec.onerror = (evento) => {
      falhou = true;
      setErro(mensagemDeErroDeVoz(evento.error));
    };
    rec.onend = () => {
      reconhecimento.current = null;
      setOuvindo(false);
      setParcial("");
      const dito = (finais || provisorio).trim();
      if (dito && !falhou) aoOuvirAtual.current(dito);
    };

    reconhecimento.current = rec;
    try {
      rec.start();
      setOuvindo(true);
    } catch {
      reconhecimento.current = null;
      setErro("Não consegui ligar o microfone agora. Tente de novo.");
    }
  }, [pararFala]);

  return { suporteEntrada, suporteSaida, ouvindo, falando, parcial, erro, setErro, falaAtiva, alternarFala, ouvir, pararDeOuvir, falar, pararFala };
}
