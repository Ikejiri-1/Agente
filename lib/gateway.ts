// Gateway de pagamento. O agente (IA) NUNCA chama isto: só o servidor, depois que o usuário confirmou
// e que o motor de limites aprovou (ver lib/purchase.ts).
//
// Hoje só existe o modo SANDBOX: nenhum dinheiro é movimentado, a cobrança é simulada.
// Para ligar um provedor real: implemente `PaymentGateway` abaixo e escolha-o em `gatewayAtual()`
// (variável PAYMENT_GATEWAY). Antes, confira o risco regulatório descrito em PESQUISAS.md (seção 3).

export type ChargeRequest = { amountCents: number; reference: string; description: string };
export type ChargeResult = { ok: true; ref: string } | { ok: false; error: string };

export interface PaymentGateway {
  name: string;
  charge(req: ChargeRequest): Promise<ChargeResult>;
}

const sandbox: PaymentGateway = {
  name: "sandbox",
  async charge(req) {
    if (!Number.isInteger(req.amountCents) || req.amountCents <= 0) return { ok: false, error: "Valor inválido." };
    return { ok: true, ref: `sbx_${req.reference}_${Date.now().toString(36)}` };
  },
};

export function gatewayAtual(): PaymentGateway | null {
  const nome = process.env.PAYMENT_GATEWAY || "sandbox";
  return nome === "sandbox" ? sandbox : null; // provedor real ainda não implementado
}
