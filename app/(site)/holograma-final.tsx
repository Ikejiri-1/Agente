import Link from "next/link";
import { Base, Esfera } from "./componentes";

/**
 * Chamada final: o agente (a esfera) é projetado de uma plataforma holográfica.
 * O texto e o botão vivem no painel projetado; os dois painéis laterais são decorativos
 * e só repetem o que o produto garante (o agente propõe, você aprova, o limite vale).
 */
export function HologramaFinal({ de }: { de: string }) {
  return (
    <div className="nx-holo" data-revela>
      <div className="nx-holo-topo">
        <Esfera diametro={170} id="final" de={de} semente={3} />
      </div>

      <div className="nx-feixe nx-holo-feixe" aria-hidden="true" />

      <div className="nx-hud nx-holo-dados nx-holo-esq" aria-hidden="true">
        <p><b>[PEDIDO]</b> você pede</p>
        <p><b>[LIMITE]</b> você define</p>
        <p><b>[MERCADOS]</b> comparados</p>
        <p><b>[PREÇOS]</b> com fonte e data</p>
        <i className="nx-conector" />
      </div>
      <div className="nx-hud nx-holo-dados nx-holo-dir" aria-hidden="true">
        <p><b>[PROPOSTA]</b> pronta</p>
        <p><b>[MOTIVO]</b> registrado</p>
        <p><b>[APROVAÇÃO]</b> <span className="ouro">sua</span></p>
        <p><b>[AÇÃO]</b> só depois do OK</p>
        <i className="nx-conector" />
      </div>

      <div className="nx-hud nx-holo-painel">
        <h2>Nunca mais “não temos hoje”.</h2>
        <p className="nx-sub">Comece grátis e deixe o agente montar a próxima compra do mês. Você aprova antes de qualquer ação.</p>
        <Link href="/cadastro" className="nx-btn nx-btn-solid">Começar grátis</Link>
      </div>

      <div className="nx-holo-base">
        <Base />
      </div>
    </div>
  );
}
