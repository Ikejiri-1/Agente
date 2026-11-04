// Voz do chat: preparo do texto para ser falado e mensagens de erro do reconhecimento. Sem imports (testável com `node --test`).

/** Tira da resposta o que soaria estranho em voz alta (markdown, emojis, símbolos) e deixa pontuação para o ritmo da fala. */
export function textoParaFala(texto: string): string {
  return texto
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1") // [texto](link) -> texto
    .replace(/[*_`#>~]+/g, "")
    .replace(/\p{Extended_Pictographic}/gu, "")
    .replace(/×/g, " vezes ")
    .replace(/→/g, " para ")
    .replace(/^\s*[-•]\s+/gm, "") // marcadores de lista
    .replace(/([^.!?…:;\s])\s*\n+/g, "$1. ") // fim de linha sem pontuação vira pausa
    .replace(/\s+/g, " ")
    .trim();
}

/** Divide em pedaços curtos: algumas vozes do navegador cortam a fala em textos longos. */
export function dividirParaFala(texto: string, max = 180): string[] {
  const frases = texto.split(/(?<=[.!?…])\s+/).map((f) => f.trim()).filter(Boolean);
  const partes: string[] = [];
  const empurrar = (pedaco: string) => {
    const ultimo = partes[partes.length - 1];
    if (ultimo !== undefined && ultimo.length + 1 + pedaco.length <= max) partes[partes.length - 1] = `${ultimo} ${pedaco}`;
    else partes.push(pedaco);
  };
  for (const frase of frases) {
    if (frase.length <= max) { empurrar(frase); continue; }
    // frase longa: quebra em vírgulas e, em último caso, em palavras
    let atual = "";
    for (const trecho of frase.split(/(?<=[,;:])\s+/)) {
      for (const palavra of trecho.split(" ")) {
        if (atual && atual.length + 1 + palavra.length > max) { empurrar(atual); atual = ""; }
        atual = atual ? `${atual} ${palavra}` : palavra;
      }
    }
    if (atual) empurrar(atual);
  }
  return partes;
}

/** Mensagem para o usuário a partir do código de erro do reconhecimento de voz. `null` = não é erro (foi cancelado). */
export function mensagemDeErroDeVoz(codigo: string): string | null {
  switch (codigo) {
    case "aborted": return null;
    case "not-allowed":
    case "service-not-allowed": return "O microfone está bloqueado. Permita o acesso no ícone de cadeado da barra de endereço e tente de novo.";
    case "no-speech": return "Não ouvi nada. Toque no microfone e fale de novo.";
    case "audio-capture": return "Não encontrei um microfone neste computador.";
    case "network": return "O reconhecimento de voz precisa de internet para funcionar.";
    case "language-not-supported": return "Este navegador não reconhece português por voz.";
    default: return `Não consegui ouvir (${codigo}). Tente de novo ou escreva a mensagem.`;
  }
}
