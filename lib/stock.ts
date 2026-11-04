// Estoque da empresa: leitura do arquivo (CSV) e insights para o supervisor. Código determinístico, sem imports.

export type StockRow = {
  name: string;
  qty: number;
  minQty: number;
  unitCostCents: number;
  lastOutAt: string | null; // ISO
};
export type Insight = { level: "alerta" | "atencao" | "info"; kind: "repor" | "parado" | "excesso"; item: string; message: string };

export const IDLE_DAYS = 60;
export const MAX_ROWS = 5000;
export const MAX_BYTES = 1_000_000;

const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

function toNumber(raw: string): number | null {
  let s = raw.trim().replace(/R\$/gi, "").replace(/\s/g, "");
  if (!s) return null;
  if (s.includes(",")) s = s.replace(/\./g, "").replace(",", ".");
  if (!/^-?\d+(\.\d+)?$/.test(s)) return null;
  return Number(s);
}

function toIso(raw: string): string | null | undefined {
  const s = raw.trim();
  if (!s) return null;
  const br = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(s);
  const iso = br ? `${br[3]}-${br[2].padStart(2, "0")}-${br[1].padStart(2, "0")}` : s;
  const t = Date.parse(iso);
  return Number.isNaN(t) ? undefined : new Date(t).toISOString();
}

function splitLine(line: string, sep: string): string[] {
  const out: string[] = [];
  let cur = "", quoted = false;
  for (const ch of line) {
    if (ch === '"') quoted = !quoted;
    else if (ch === sep && !quoted) { out.push(cur); cur = ""; }
    else cur += ch;
  }
  out.push(cur);
  return out.map((c) => c.trim());
}

const ALIASES: Record<string, string[]> = {
  name: ["produto", "item", "nome", "descricao"],
  qty: ["quantidade", "qtd", "estoque", "saldo"],
  minQty: ["minimo", "estoque minimo", "min", "ponto de reposicao"],
  cost: ["custo", "custo unitario", "preco", "valor"],
  lastOut: ["ultima saida", "ultima_saida", "ultima venda", "ultima movimentacao"],
};

/** Lê um CSV (vírgula ou ponto e vírgula; números no formato brasileiro). Colunas obrigatórias: produto e quantidade. */
export function parseStockCsv(text: string): { rows: StockRow[]; errors: string[] } {
  const errors: string[] = [];
  const lines = text.replace(/^﻿/, "").split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return { rows: [], errors: ["O arquivo precisa de um cabeçalho e ao menos uma linha."] };
  if (lines.length - 1 > MAX_ROWS) return { rows: [], errors: [`Arquivo grande demais (máximo ${MAX_ROWS} linhas).`] };
  const sep = (lines[0].match(/;/g)?.length ?? 0) >= (lines[0].match(/,/g)?.length ?? 0) ? ";" : ",";
  const header = splitLine(lines[0], sep).map(norm);
  const col = (key: string) => header.findIndex((h) => ALIASES[key].includes(h));
  const iName = col("name"), iQty = col("qty"), iMin = col("minQty"), iCost = col("cost"), iOut = col("lastOut");
  if (iName < 0 || iQty < 0) return { rows: [], errors: ["Faltam as colunas obrigatórias: produto e quantidade."] };

  const rows: StockRow[] = [];
  lines.slice(1).forEach((line, idx) => {
    const c = splitLine(line, sep);
    const n = idx + 2;
    const name = (c[iName] ?? "").slice(0, 80);
    const qty = toNumber(c[iQty] ?? "");
    if (name.length < 2 || qty === null || qty < 0) return void errors.push(`Linha ${n}: produto ou quantidade inválidos.`);
    const minQty = iMin >= 0 ? toNumber(c[iMin] ?? "") ?? 0 : 0;
    const cost = iCost >= 0 ? toNumber(c[iCost] ?? "") : 0;
    const out = iOut >= 0 ? toIso(c[iOut] ?? "") : null;
    if (out === undefined) return void errors.push(`Linha ${n}: data da última saída inválida.`);
    rows.push({ name, qty, minQty: Math.max(0, minQty), unitCostCents: Math.max(0, Math.round((cost ?? 0) * 100)), lastOutAt: out });
  });
  return { rows, errors: errors.slice(0, 20) };
}

/** O que o supervisor precisa saber: o que repor, o que está parado, o que sobra. */
export function computeInsights(rows: (StockRow & { lastInAt?: string | null })[], now: Date): Insight[] {
  const out: Insight[] = [];
  for (const r of rows) {
    if (r.minQty > 0 && r.qty <= r.minQty) {
      const sugerido = Math.max(1, Math.ceil(r.minQty * 2 - r.qty));
      out.push({ level: r.qty === 0 ? "alerta" : "atencao", kind: "repor", item: r.name, message: `${r.name}: ${r.qty} em estoque (mínimo ${r.minQty}). Sugestão: comprar ${sugerido}.` });
    }
    const ref = r.lastOutAt ?? r.lastInAt ?? null;
    const dias = ref ? Math.floor((now.getTime() - Date.parse(ref)) / 86_400_000) : null;
    if (r.qty > 0 && (dias === null || dias > IDLE_DAYS)) {
      const parado = r.unitCostCents * r.qty;
      out.push({ level: "info", kind: "parado", item: r.name, message: `${r.name}: ${dias === null ? "sem registro de saída" : `sem saída há ${dias} dias`}${parado > 0 ? `, ${(parado / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })} parados` : ""}.` });
    }
    if (r.minQty > 0 && r.qty > r.minQty * 5) {
      out.push({ level: "info", kind: "excesso", item: r.name, message: `${r.name}: ${r.qty} em estoque, mais de 5× o mínimo (${r.minQty}). Evite comprar mais por enquanto.` });
    }
  }
  const peso = { alerta: 0, atencao: 1, info: 2 } as const;
  return out.sort((a, b) => peso[a.level] - peso[b.level]);
}
