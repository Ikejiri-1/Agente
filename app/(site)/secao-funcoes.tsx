import { CabecalhoDeSecao, Orbe } from "./componentes";
import { NODES } from "./nodes";

/**
 * SEÇÃO "O QUE O AGENTE FAZ" — retirada da landing por enquanto, guardada aqui para uma alteração futura.
 *
 * Como voltar a usar: importe `SecaoFuncoes` em landing.tsx e coloque entre a cena e "Como funciona".
 * Depois ajuste a rede viva: o cabeçalho desta seção (id "funcoes-no") recebe a rede de "cena",
 * e os passos de "Como funciona" passam a receber de "funcoes-no" no lugar de "cena".
 * Os dados completos (10 funções, com detalhe, pontos, status e cena animada) estão em nodes.ts (NODES).
 * O CSS (.nx-grade, .nx-vidro, .nx-funcao, .nx-chip, .nx-lista) continua em site.css.
 */
export function SecaoFuncoes() {
  return (
    <section id="funcoes" className="nx-secao" aria-label="O que o agente faz">
      <CabecalhoDeSecao
        icone="search"
        id="funcoes-no"
        de="cena"
        kicker="O que o agente faz"
        titulo="Uma rede de funções trabalhando por você"
        texto="Cada nó da rede cuida de uma parte da compra. Você só decide."
      />
      <div className="nx-grade">
        {NODES.map((no) => (
          <article key={no.id} className="nx-vidro nx-funcao" data-revela>
            <Orbe icone={no.icon} diametro={56} id={`no-${no.id}`} de="funcoes-no" />
            <span className={no.status === "mvp" ? "nx-chip nx-chip-on" : "nx-chip"}>{no.status === "mvp" ? "Disponível no teste" : "Em breve"}</span>
            <h3>{no.title}</h3>
            <p className="nx-curto">{no.short}</p>
            <ul className="nx-lista">
              {no.points.slice(0, 2).map((ponto) => (
                <li key={ponto}>{ponto}</li>
              ))}
            </ul>
          </article>
        ))}
      </div>
    </section>
  );
}
