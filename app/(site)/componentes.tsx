import type { CSSProperties, ReactNode } from "react";
import { EsferaDeVidro } from "./esfera-vidro";
import { Icon } from "./icons";

/**
 * Peças visuais da landing, compartilhadas entre as seções.
 * Os atributos data-no-id / data-no-de ligam cada peça à rede neural viva (rede-viva.tsx):
 * a rede cai de "de" para "id". "de" aceita vários nomes separados por espaço (a rede converge).
 */

const tamanho = (diametro: number) => ({ "--d": `${diametro}px` }) as CSSProperties;

/** Bolha de vidro (a esfera do agente, em miniatura) com ícone e a elipse de plataforma. `quente` leva o brilho para o dourado. */
export function Orbe({ icone, diametro = 64, id, de, quente = false }: { icone: string; diametro?: number; id: string; de: string; quente?: boolean }) {
  return (
    <span className="nx-orbe" style={tamanho(diametro)} data-no-id={id} data-no-de={de}>
      <EsferaDeVidro diametro={diametro} aneis={0.8} aquecer={quente ? 1 : 0} calmaria={0.6} semente={id.length} />
      <Icon name={icone} size={28} />
    </span>
  );
}

/** Ponto invisível na base de um cartão: dali a rede segue para a próxima seção. */
export function Saida({ id }: { id: string }) {
  return <span className="nx-saida" data-no-id={id} aria-hidden="true" />;
}

export function CabecalhoDeSecao({ icone, id, de, kicker, titulo, texto }: { icone?: string; id?: string; de?: string; kicker: string; titulo: string; texto?: string }) {
  const comOrbe = Boolean(icone && id && de);
  return (
    <header className={comOrbe ? "nx-cab" : "nx-cab nx-cab-simples"} data-revela>
      {comOrbe && <Orbe icone={icone!} diametro={72} id={id!} de={de!} />}
      <p className="nx-kicker">{kicker}</p>
      <h2>{titulo}</h2>
      {texto && <p className="nx-sub">{texto}</p>}
    </header>
  );
}

/** A esfera inteligente: a mesma esfera de vidro do agente do login (filamentos, núcleo dourado, anéis). O CSS antigo fica de reserva se o WebGL falhar. */
export function Esfera({ diametro, id, de, children, aneis = 1, semente = 0 }: { diametro: number; id: string; de: string; children?: ReactNode; aneis?: number; semente?: number }) {
  return (
    <div className="nx-esfera" style={tamanho(diametro)} data-no-id={id} data-no-de={de}>
      <EsferaDeVidro diametro={diametro} aneis={aneis} calmaria={children ? 0.55 : 0.85} semente={semente} />
      <div className="nx-esfera-rede" aria-hidden="true" />
      <div className="nx-esfera-texto">{children}</div>
    </div>
  );
}

/** Plataforma holográfica em perspectiva: anéis e segmentos girando, de onde a projeção sobe. */
export function Base() {
  return (
    <div className="nx-base" aria-hidden="true">
      <div className="nx-base-disco">
        <i className="nx-b-glow" />
        <i className="nx-b-aneis" />
        <i className="nx-b-seg" />
      </div>
    </div>
  );
}
