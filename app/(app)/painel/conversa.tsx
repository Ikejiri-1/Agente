"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { EsferaDeVidro } from "../../(site)/esfera-vidro";
import { useVoz } from "./use-voz";

type Mensagem = { papel: "eu" | "ag"; texto: string; digitar?: boolean; erro?: boolean; acoes?: string[] };

const VELOCIDADE_DA_DIGITACAO = 14; // ms por bloco de letras

/** Markdown mínimo e seguro (sem HTML cru): **negrito** e listas com "-", "*" ou "•". Um negrito ainda aberto (texto sendo digitado) vale até o fim. */
function Rico({ texto }: { texto: string }) {
  const linhas = texto.split("\n");
  return (
    <>
      {linhas.map((linha, i) => {
        const item = /^\s*[-*•]\s+(.*)$/.exec(linha);
        const partes = (item ? item[1] : linha).split(/(\*\*[^*]*(?:\*\*|$))/);
        return (
          <span key={i}>
            {item && "• "}
            {partes.map((p, j) => (p.startsWith("**") ? <strong key={j}>{p.replace(/^\*\*|\*\*$/g, "")}</strong> : p))}
            {i < linhas.length - 1 && "\n"}
          </span>
        );
      })}
    </>
  );
}

/** A resposta do agente se escreve sozinha. Quem prefere menos movimento recebe o texto pronto. */
function Digitado({ texto, aoAvancar, aoTerminar }: { texto: string; aoAvancar: () => void; aoTerminar: () => void }) {
  const [escritos, setEscritos] = useState(() => (typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches ? texto.length : 0));
  useEffect(() => {
    if (escritos >= texto.length) { aoTerminar(); return; }
    const passo = Math.max(1, Math.round(texto.length / 220)); // respostas longas não demoram demais
    const espera = setTimeout(() => { setEscritos((n) => Math.min(texto.length, n + passo)); aoAvancar(); }, VELOCIDADE_DA_DIGITACAO);
    return () => clearTimeout(espera);
  }, [escritos, texto, aoAvancar, aoTerminar]);
  return <><Rico texto={texto.slice(0, escritos)} />{escritos < texto.length && <i className="pn-cursor" />}</>;
}

export function Conversa({ inicial, sugestoes, configurado, plano, motor, limpar }: {
  inicial: { papel: "eu" | "ag"; texto: string }[];
  sugestoes: string[];
  configurado: boolean;
  plano: string;
  motor: string | null;
  limpar: () => Promise<void>;
}) {
  const roteador = useRouter();
  const [mensagens, setMensagens] = useState<Mensagem[]>(inicial);
  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);
  const fim = useRef<HTMLDivElement>(null);
  const caixa = useRef<HTMLTextAreaElement>(null);
  const aoOuvir = useRef<(dito: string) => void>(() => {});
  const voz = useVoz((dito) => aoOuvir.current(dito));

  const descer = () => fim.current?.scrollIntoView({ block: "end" });
  useEffect(() => { descer(); }, [mensagens, enviando]);

  /** `porVoz`: o cliente falou, então a Nexa responde falando (mesmo com a voz desligada para mensagens digitadas). */
  async function enviar(conteudo: string, porVoz = false) {
    const pergunta = conteudo.trim();
    if (!pergunta || enviando) return;
    voz.pararFala();
    voz.setErro(null);
    setTexto("");
    setMensagens((m) => [...m, { papel: "eu", texto: pergunta }]);
    setEnviando(true);
    try {
      const res = await fetch("/api/chat", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ message: pergunta }) });
      const dados = (await res.json()) as { reply?: string; actions?: string[]; error?: string; failed?: boolean };
      if (!res.ok || !dados.reply) throw new Error(dados.error ?? "Não consegui responder agora.");
      setMensagens((m) => [...m, { papel: "ag", texto: dados.reply!, digitar: !dados.failed, erro: dados.failed, acoes: dados.actions }]);
      if (!dados.failed && (porVoz || voz.falaAtiva)) voz.falar(dados.reply);
      if (dados.actions?.length) roteador.refresh(); // lista, propostas e agendamentos aparecem no painel ao lado
    } catch (erro) {
      setMensagens((m) => [...m, { papel: "ag", texto: erro instanceof Error ? erro.message : "Falha de conexão.", erro: true }]);
    } finally {
      setEnviando(false);
      caixa.current?.focus();
    }
  }

  useEffect(() => { aoOuvir.current = (dito) => void enviar(dito, true); });

  const aoEnviar = (evento: FormEvent) => { evento.preventDefault(); void enviar(texto); };
  const aoTeclar = (evento: KeyboardEvent<HTMLTextAreaElement>) => {
    if (evento.key === "Enter" && !evento.shiftKey) { evento.preventDefault(); void enviar(texto); }
  };

  return (
    <section className="nx-hud pn-chat" aria-label="Conversa com o agente">
      <header className="pn-chat-cab">
        <span className={`nx-orbe pn-avatar${voz.ouvindo ? " ouvindo" : ""}${voz.falando ? " falando" : ""}`} aria-hidden="true"><EsferaDeVidro diametro={52} aneis={0} calmaria={0.8} semente={5} /></span>
        <div>
          <h1>Agente Nexa</h1>
          <p>Especialista em compras · plano {plano}{motor ? ` · ${motor}` : ""}</p>
        </div>
        <div className="pn-cab-acoes">
          {voz.suporteSaida && (
            <button
              type="button"
              className={`pn-icone-btn${voz.falaAtiva ? " on" : ""}`}
              onClick={voz.alternarFala}
              aria-pressed={voz.falaAtiva}
              title={voz.falaAtiva ? "A Nexa lê as respostas em voz alta. Toque para desligar." : "Ligar a voz da Nexa (ela já responde falando quando você usa o microfone)"}
            >
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9.5v5h3.5L12 18.5v-13L7.5 9.5z" />{voz.falaAtiva ? <path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11" /> : <path d="m16 9.5 5 5m0-5-5 5" />}</svg>
              <span className="pn-so-leitor">{voz.falaAtiva ? "Voz da Nexa ligada" : "Voz da Nexa desligada"}</span>
            </button>
          )}
          {mensagens.length > 0 && (
            <button className="pn-limpar" onClick={async () => { voz.pararFala(); await limpar(); setMensagens([]); }}>Limpar conversa</button>
          )}
        </div>
      </header>

      {!configurado && <p className="pn-offline">O chat inteligente está desligado neste ambiente (falta GEMINI_API_KEY ou ANTHROPIC_API_KEY no .env.local). O restante do painel funciona normalmente.</p>}

      <div className="pn-msgs" role="log" aria-live="polite">
        {mensagens.length === 0 && (
          <div className="pn-vazio-chat">
            <strong>Do que você precisa?</strong>
            <span>Conte o que quer comprar e eu pesquiso, comparo e recomendo. Você decide.</span>
            <div className="pn-sugestoes">
              {sugestoes.map((s) => (<button key={s} type="button" onClick={() => void enviar(s)} disabled={enviando}>{s}</button>))}
            </div>
          </div>
        )}
        {mensagens.map((m, i) => (
          <div key={i} style={{ display: "contents" }}>
            <div className={`pn-msg ${m.papel}${m.erro ? " erro" : ""}`}>
              {m.digitar ? (
                <Digitado texto={m.texto} aoAvancar={descer} aoTerminar={() => setMensagens((l) => l.map((x, j) => (j === i ? { ...x, digitar: false } : x)))} />
              ) : m.papel === "ag" ? <Rico texto={m.texto} /> : m.texto}
            </div>
            {m.acoes && m.acoes.length > 0 && !m.digitar && <div className="pn-acoes">{m.acoes.map((a) => <span key={a}>{a}</span>)}</div>}
          </div>
        ))}
        {enviando && <div className="pn-msg ag pn-pensando" aria-label="O agente está pensando"><i /><i /><i /></div>}
        <div ref={fim} />
      </div>

      {(voz.ouvindo || voz.falando || voz.erro) && (
        <div className={`pn-voz-estado${voz.erro ? " erro" : ""}`} role="status" aria-live="polite">
          {voz.ouvindo && (<><span className="pn-ondas" aria-hidden="true"><i /><i /><i /><i /><i /></span><span>{voz.parcial || "Ouvindo… pode falar"}</span></>)}
          {!voz.ouvindo && voz.falando && (<><span className="pn-ondas falando" aria-hidden="true"><i /><i /><i /><i /><i /></span><span>A Nexa está falando…</span><button type="button" className="pn-btn-claro pn-fim" onClick={voz.pararFala}>Parar</button></>)}
          {!voz.ouvindo && !voz.falando && voz.erro && (<><span>{voz.erro}</span><button type="button" className="pn-btn-claro pn-fim" onClick={() => voz.setErro(null)}>Ok</button></>)}
        </div>
      )}

      <form className="pn-envio" onSubmit={aoEnviar}>
        {voz.suporteEntrada && (
          <button
            type="button"
            className={`pn-mic${voz.ouvindo ? " ouvindo" : ""}`}
            onClick={voz.ouvindo ? voz.pararDeOuvir : voz.ouvir}
            disabled={enviando}
            aria-pressed={voz.ouvindo}
            aria-label={voz.ouvindo ? "Parar de ouvir e enviar" : "Falar com a Nexa"}
            title={voz.ouvindo ? "Toque para terminar e enviar" : "Toque e fale com a Nexa"}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5.5 11.5a6.5 6.5 0 0 0 13 0M12 18v3" /></svg>
          </button>
        )}
        <textarea ref={caixa} value={texto} onChange={(e) => setTexto(e.target.value)} onKeyDown={aoTeclar} rows={1} maxLength={1000} placeholder={voz.suporteEntrada ? "Escreva ou toque no microfone e fale…" : "Escreva o que você precisa…"} aria-label="Mensagem para o agente" />
        <button className="nx-btn nx-btn-solid" disabled={enviando || !texto.trim()}>Enviar</button>
      </form>
      {voz.suporteEntrada && <p className="pn-nota">Voz: o navegador transcreve o áudio (no Chrome e no Edge isso usa servidores da Google e da Microsoft). Nada é gravado por nós.</p>}
    </section>
  );
}
