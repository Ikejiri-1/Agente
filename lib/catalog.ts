// Categorias de produto e catálogo de demonstração por nicho. Sem imports (testável com `node --test`).
// Todos os preços abaixo são FICTÍCIOS: servem só para testar o fluxo.

const norm = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

// A ordem importa: a primeira regra que casar vence (ex.: "óleo de motor" antes de "óleo de soja").
const RULES: [string, RegExp][] = [
  ["Automotivo", /(oleo de motor|pastilha|bateria|filtro|fluido|pneu|diesel)/],
  ["Construção", /(cimento|areia|brita|tijolo|vergalhao|tinta)/],
  ["Legumes e verduras", /(tomate|batata|cebola|cenoura|alface|abobrinha|pimentao|brocolis|chuchu)/],
  ["Grãos e básicos", /(arroz|feijao|macarrao|farinha|acucar|sal |sal$|cafe|oleo)/],
  ["Laticínios", /(leite|queijo|iogurte|manteiga)/],
  ["Limpeza", /(detergente|sabao|agua sanitaria|desinfetante)/],
  ["Higiene", /(papel higienico|sabonete|shampoo|creme dental)/],
];

export function categoryOf(product: string): string {
  const p = norm(product);
  return RULES.find(([, re]) => re.test(p))?.[0] ?? "Outros";
}

export const NICHOS = ["Construtora", "Transportadora", "Automotiva", "Supermercado / mercearia", "Restaurante / alimentação"] as const;

/** Que categorias interessam a cada nicho (o agente pesquisa por elas). */
export const NICHO_CATEGORIAS: Record<string, string[]> = {
  Construtora: ["Construção", "Limpeza"],
  Transportadora: ["Automotivo", "Limpeza"],
  Automotiva: ["Automotivo", "Limpeza"],
  "Supermercado / mercearia": ["Grãos e básicos", "Laticínios", "Limpeza", "Higiene", "Legumes e verduras"],
  "Restaurante / alimentação": ["Grãos e básicos", "Legumes e verduras", "Laticínios"],
};

// produto, preço na loja 1, loja 2, loja 3 (0 = não vende), em centavos
export const DEMO_EXTRAS: [string, number, number, number][] = [
  ["Arroz integral 1kg", 899, 859, 799],
  ["Feijão preto 1kg", 949, 899, 849],
  ["Tomate kg", 799, 749, 699],
  ["Batata kg", 549, 519, 479],
  ["Cebola kg", 459, 429, 389],
  ["Cenoura kg", 399, 379, 349],
  ["Alface unidade", 349, 329, 0],
  ["Abobrinha kg", 599, 569, 549],
  ["Pimentão verde kg", 899, 849, 0],
  ["Brócolis maço", 499, 479, 449],
  ["Cimento 50kg", 3890, 3690, 3490],
  ["Areia média m³", 12000, 11500, 10900],
  ["Brita 1 m³", 13500, 12900, 12400],
  ["Tijolo 8 furos (milheiro)", 89000, 85000, 82000],
  ["Vergalhão 10mm barra 12m", 6490, 6190, 5890],
  ["Tinta acrílica 18L", 29900, 27900, 25900],
  ["Diesel S10 litro", 619, 609, 599],
  ["Pneu 295/80 R22.5", 189000, 179000, 172000],
  ["Óleo de motor 15W40 20L", 42900, 40900, 38900],
  ["Filtro de óleo caminhão", 6990, 6490, 5990],
  ["Pastilha de freio dianteira", 15900, 14900, 13900],
  ["Bateria 60Ah", 52900, 49900, 47900],
  ["Filtro de ar", 4990, 4590, 4290],
  ["Fluido de freio DOT4 500ml", 3290, 2990, 2790],
];
