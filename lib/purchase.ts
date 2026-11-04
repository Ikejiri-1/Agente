// Compra: a ÚNICA porta de saída de dinheiro. Só o servidor chama, e só depois de o usuário confirmar (botão no painel)
// ou de ele ter pré-autorizado um agendamento. O motor de limites roda DENTRO da transação de aprovação.
import { audit, decideProposal, getLimits, getProposal } from "./db.ts";
import { getSettings, purchaseOf, recordPurchase, reopenProposal } from "./db-painel.ts";
import { gatewayAtual } from "./gateway.ts";
import { checkLimits } from "./limits.ts";
import { can } from "./plans.ts";

export async function purchaseProposal(userId: number, proposalId: number, automatic = false): Promise<{ ok: boolean; message: string }> {
  if (!can(getSettings(userId).plan, "compra")) return { ok: false, message: "A compra pelo agente faz parte do plano Família." };
  const gateway = gatewayAtual();
  if (!gateway) return { ok: false, message: "Gateway de pagamento não configurado." };

  const proposal = getProposal(userId, proposalId);
  if (!proposal) return { ok: false, message: "Proposta não encontrada." };
  if (purchaseOf(userId, proposalId)) return { ok: false, message: "Esta proposta já foi comprada." };
  if (proposal.status !== "pending") return { ok: false, message: "Só propostas aguardando aprovação podem ser compradas." };

  const limits = getLimits(userId);
  const approved = decideProposal(userId, proposalId, "approved", (total, spent) => checkLimits(total, limits, spent));
  if (!approved.ok) return approved; // limite estourado: nada é cobrado

  const charge = await gateway.charge({ amountCents: proposal.totalCents, reference: `p${proposalId}`, description: `Compra #${proposalId}` });
  if (!charge.ok) {
    reopenProposal(userId, proposalId);
    audit(userId, "purchase_failed", { proposalId, error: charge.error });
    return { ok: false, message: `O pagamento não foi concluído: ${charge.error}` };
  }
  recordPurchase(userId, proposalId, proposal.totalCents, gateway.name, charge.ref, automatic);
  audit(userId, automatic ? "purchase_scheduled" : "purchase", { proposalId, totalCents: proposal.totalCents, gateway: gateway.name });
  return { ok: true, message: `Compra #${proposalId} confirmada${gateway.name === "sandbox" ? " (modo de teste: nenhum dinheiro foi movimentado)" : ""}.` };
}
