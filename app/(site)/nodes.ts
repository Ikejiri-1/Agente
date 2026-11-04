export type Status = "mvp" | "breve";
export type Scene = "radar" | "bars" | "gauge" | "pulse";
export type Side = "top" | "bottom" | "left" | "right";

export type NodeDef = {
  id: string;
  title: string;
  icon: string; // chave do ícone em icons.tsx
  /** posição no palco, em % (palco de 160x100) */
  x: number;
  y: number;
  /** lado para onde o cartão de hover abre */
  tip: Side;
  status: Status;
  scene: Scene;
  short: string;
  points: string[];
  detail: string;
};

// Os textos dizem só o que o produto faz ou fará de verdade:
// o agente propõe, o usuário aprova, e nenhuma ferramenta de pagamento é dada à IA.
export const NODES: NodeDef[] = [
  {
    id: "pesquisa",
    title: "Pesquisa nas lojas",
    icon: "search",
    x: 50, y: 11, tip: "bottom", status: "mvp", scene: "radar",
    short: "Busca, filtra e encontra.",
    points: ["Lê os preços de cada mercado da região", "Sinaliza preço velho (mais de 30 dias)", "Cada preço guarda fonte e data"],
    detail: "O agente varre a base de preços, descarta o que está desatualizado e entrega só candidatos confiáveis para comparar.",
  },
  {
    id: "comparacao",
    title: "Comparação",
    icon: "scale",
    x: 29, y: 24, tip: "right", status: "mvp", scene: "bars",
    short: "Preço, frete e disponibilidade.",
    points: ["Compara carrinho inteiro, não item solto", "Considera o frete de cada loja", "Só divide em duas lojas se a economia compensar"],
    detail: "Monta o carrinho inteiro em uma loja ou dividido entre lojas, soma o frete e escolhe o que custa menos, explicando o porquê.",
  },
  {
    id: "compra",
    title: "Compra recorrente",
    icon: "cart",
    x: 71, y: 24, tip: "left", status: "mvp", scene: "pulse",
    short: "Pede, repete todo mês, ajusta.",
    points: ["Sua lista do mês vira uma proposta pronta", "Você aprova, edita ou recusa", "Nada avança sem o seu aprovar"],
    detail: "A cada ciclo o agente prepara a proposta. A decisão final é sempre sua, e o carrinho aprovado fica registrado.",
  },
  {
    id: "pagamento",
    title: "Limites e segurança",
    icon: "lock",
    x: 30, y: 70, tip: "right", status: "mvp", scene: "gauge",
    short: "Você aprova. Respeita o limite.",
    points: ["Teto por compra e teto por mês", "Conferido de novo na hora de aprovar", "A IA não tem ferramenta de pagamento"],
    detail: "Os limites são código no servidor, não pedido ao modelo. Mudou o limite depois da proposta? A aprovação é barrada.",
  },
  {
    id: "estoque",
    title: "Controle de estoque",
    icon: "box",
    x: 70, y: 70, tip: "left", status: "breve", scene: "bars",
    short: "Entradas, previsão e reposição.",
    points: ["Registra entradas e saídas", "Prevê quando vai faltar", "Sugere reposição na hora certa"],
    detail: "Plano empresarial: o agente aprende o ritmo do seu estoque e propõe a reposição antes de faltar ou sobrar.",
  },
  {
    id: "familia",
    title: "Compras da família",
    icon: "home",
    x: 9, y: 22, tip: "right", status: "mvp", scene: "pulse",
    short: "Uma lista para a casa toda.",
    points: ["Lista do mês e limites da família", "Histórico de tudo que foi proposto", "Plano Família"],
    detail: "Pensado para a compra recorrente da casa: arroz, feijão, café, limpeza. Menos tempo, mais controle.",
  },
  {
    id: "login",
    title: "Login e senha",
    icon: "key",
    x: 7, y: 47, tip: "right", status: "mvp", scene: "gauge",
    short: "Conta individual e protegida.",
    points: ["Senha guardada com hash forte", "Bloqueio após tentativas erradas", "Cada usuário vê só os próprios dados"],
    detail: "Cada conta é isolada. Sessão assinada, bloqueio de força bruta e nada de dados de cartão no nosso banco.",
  },
  {
    id: "mercados",
    title: "Supermercados integrados",
    icon: "store",
    x: 11, y: 74, tip: "right", status: "breve", scene: "radar",
    short: "Preços direto dos parceiros.",
    points: ["Ainda sem parcerias fechadas", "Hoje: preços colaborativos e cupons", "Meta: catálogo oficial dos mercados"],
    detail: "A integração direta depende de parceria com os mercados. Enquanto isso, a base nasce de preços informados pelos próprios usuários.",
  },
  {
    id: "empresas",
    title: "Empresas e comércios",
    icon: "shop",
    x: 91, y: 22, tip: "left", status: "breve", scene: "bars",
    short: "Reposição para quem vende.",
    points: ["Plano Empresarial", "Estoque, previsão e reposição", "Em desenho, sob validação com comerciantes"],
    detail: "Comércios que não querem ficar sem produto nem com excesso parado. Entra depois da validação com negócios reais.",
  },
  {
    id: "alerta",
    title: "Alerta de falta ou excesso",
    icon: "bell",
    x: 93, y: 47, tip: "left", status: "breve", scene: "pulse",
    short: "Avisa antes de virar problema.",
    points: ["Falta iminente de item", "Excesso parado no estoque", "Aviso por e-mail e painel"],
    detail: "O agente cruza consumo e saldo e avisa quando o ritmo indica falta ou sobra.",
  },
  {
    id: "supervisor",
    title: "Aviso ao supervisor",
    icon: "chat",
    x: 89, y: 74, tip: "left", status: "breve", scene: "pulse",
    short: "Quem decide é avisado.",
    points: ["Encaminha propostas para aprovação", "Registro de quem aprovou e quando", "Para equipes e comércios"],
    detail: "Em equipes, a proposta chega a quem tem alçada para aprovar, com trilha de auditoria.",
  },
];

export const STEPS = [
  { icon: "chat", label: "Você pede", texto: "Monte a lista ou diga o que precisa. Você define o limite de gasto." },
  { icon: "search", label: "Pesquisa e compara", texto: "O agente lê os preços, compara o carrinho inteiro e considera o frete." },
  { icon: "check", label: "Você aprova", texto: "A proposta chega com a justificativa. Nada acontece sem o seu OK." },
  { icon: "cart", label: "Carrinho pronto", texto: "O carrinho fica pronto dentro do limite que você definiu." },
];

export type Plan = {
  id: string;
  name: string;
  price: string;
  per: string;
  tag?: string;
  badge?: string;
  blurb: string;
  features: string[];
  cta: string;
  href?: string;
};

export const PLANS: Plan[] = [
  {
    id: "gratis",
    name: "Gratuito",
    price: "R$ 0",
    per: "para sempre",
    blurb: "Para conhecer o agente.",
    features: ["Lista de compras", "Comparação manual entre mercados", "Limite de gasto por compra", "Registro de preços"],
    cta: "Começar grátis",
    href: "/cadastro",
  },
  {
    id: "familia",
    name: "Família",
    price: "R$ 29,90",
    per: "por mês",
    tag: "Mais escolhido",
    blurb: "Para a compra do mês da casa.",
    features: ["Tudo do Gratuito", "Agente monta a proposta todo mês", "Limite por compra e mensal", "Histórico e justificativa de cada escolha", "Aprovação antes de qualquer ação"],
    cta: "Testar o plano Família",
    href: "/cadastro",
  },
  {
    id: "empresarial",
    name: "Empresarial",
    price: "R$ 199",
    per: "por mês",
    badge: "Em breve",
    blurb: "Para quem vende e precisa repor.",
    features: ["Controle de estoque", "Previsão de falta e excesso", "Sugestão de reposição", "Alertas e aviso ao supervisor", "Vários usuários"],
    cta: "Em breve",
  },
];
