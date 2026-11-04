# Agente de Compras para Famílias (MVP B2C)

Software web com agente de IA que ajuda famílias a fazer a compra recorrente do mês: o usuário cadastra uma lista, define um limite de gasto, o agente compara preços entre mercados, monta o carrinho ideal e **propõe**. O usuário aprova. Nada é pago sem aprovação e sem passar pelo motor de limites.

> Este README descreve **como a implementação deve funcionar**. As decisões têm origem em [PESQUISAS.md](PESQUISAS.md). Antes de mudar qualquer decisão abaixo, consulte aquele arquivo e confira a seção "Checklist de políticas".

Status: **MVP de teste implementado** (Fase 1 a 4 do roadmap, versão local). Veja "12. Rodando o MVP de teste".

---

## 1. Escopo do MVP

**Dentro**
- Cadastro e login (conta individual por usuário/família).
- Lista de compras recorrente ("Compras do mês") e limite de gasto por compra e por mês.
- Comparação de preços entre 2 ou 3 mercados da região (Taubaté e arredores).
- Agente que monta o carrinho, justifica a escolha e envia a proposta.
- Tela de aprovação (aprovar, editar, recusar) e histórico auditável.
- Cobrança da **mensalidade da plataforma** via provedor licenciado.
- Notificação por e-mail e painel web.

**Fora (por decisão pesquisada, ver PESQUISAS.md)**
- Pagar o mercado em nome do usuário (exigiria ser instituição de pagamento ou ter parceria).
- Automação de login/checkout em sites de terceiros.
- Módulo B2B de estoque (adiado; só se algum comerciante real aceitar testar).
- WhatsApp (adiado; ver política da Meta).
- Pix Automático para compras de mercado.

## 2. Princípios inegociáveis

1. **O agente propõe, o usuário decide.** O LLM não tem ferramenta de pagamento.
2. **Limites são código, não prompt.** Teto por compra e por mês é verificado no servidor, em transação atômica, antes de qualquer ação com efeito financeiro.
3. **O dinheiro das compras não passa por nós.** O usuário finaliza no mercado (ou, com parceria, paga direto a ele). Só cobramos a mensalidade, por provedor licenciado.
4. **Dados de cartão nunca no nosso banco.** Só tokens do provedor.
5. **Tudo que o agente decide é registrado** (entrada, critério, resultado) para atender pedido de revisão (LGPD art. 20).
6. **Texto externo é não confiável.** Nomes de produto, descrições e respostas de sites nunca viram instrução para o modelo.

## 3. Arquitetura

```
Navegador (Next.js + Tailwind)
        │
Next.js (App Router) ── rotas de API ── Supabase (Auth + Postgres + RLS)
        │                                   │
        ├── Camada de preços (fontes plugáveis)
        ├── Agente (LLM com tool-calling)  ──► Motor de limites (determinístico)
        ├── Jobs (cron mensal) ──► gera propostas ──► notificações (e-mail)
        └── Cobrança da mensalidade (Asaas) ◄── webhooks
```

Stack recomendada (monolito para MVP de uma pessoa):
- **Front e back:** Next.js + TypeScript + Tailwind.
- **Banco e login:** Supabase (Postgres, Auth, RLS por usuário).
- **LLM:** chamada direta à API com tool-calling, sem LangChain. Modelo pequeno para comparar e montar carrinho; cache do prompt de sistema e das definições de ferramentas.
- **Jobs:** cron do próprio host ou do Supabase. Fila (Redis) só quando houver volume que justifique.
- **Cobrança da mensalidade:** Asaas (Pix Automático e cartão), via webhooks.

## 4. Modelo de dados (rascunho)

| Tabela | Conteúdo principal |
|---|---|
| `users` / `households` | conta, membros, consentimentos (LGPD) |
| `shopping_lists`, `list_items` | itens, quantidade, marcas aceitas, substitutos permitidos |
| `stores` | mercados cobertos, região, política de frete |
| `prices` | item/EAN, loja, valor, data, **fonte** (manual, colaborativo, cupom, parceiro) |
| `limits` | teto por compra, teto mensal, regra de exigir confirmação extra |
| `proposals` | carrinho proposto, total, economia, justificativa, status |
| `approvals` | quem aprovou, quando, versão aprovada |
| `agent_runs` | entrada, chamadas de ferramenta, saída, modelo, custo (auditoria) |
| `receipts` | cupons enviados (chave de acesso, itens) — **sem guardar CPF se não necessário** |
| `subscriptions`, `billing_events` | plano, status, webhooks do Asaas |

Regras de RLS: toda tabela com dados do usuário filtra por `auth.uid()` ou pelo `household_id`. Testar acesso cruzado entre contas.

## 5. Como o agente funciona

Ferramentas expostas ao modelo (somente leitura ou de proposta):

| Ferramenta | Efeito |
|---|---|
| `buscar_precos(itens, lojas)` | lê a camada de preços |
| `comparar(carrinhos)` | calcula total, frete, prazo, economia |
| `montar_carrinho(lista, limite)` | monta o carrinho candidato |
| `propor_compra(carrinho)` | grava uma **proposta**; não paga nada |

**Não existe** ferramenta de pagamento, de login em mercado ou de envio de dinheiro.

Fluxo:
1. Gatilho (mensal ou pedido no chat) → `agent_run`.
2. O agente chama as ferramentas, monta o carrinho e chama `propor_compra`.
3. O **motor de limites** valida: total ≤ teto por compra, soma do mês ≤ teto mensal, itens dentro da lista. Falhou, a proposta é recusada com motivo.
4. Notificação ao usuário com resumo (preço, economia, entrega, itens substituídos).
5. O usuário aprova, edita ou recusa. A aprovação grava a versão exata do carrinho.
6. Fechamento: lista/carrinho pronto para o usuário finalizar no mercado. Com parceria futura, o pagamento é direto ao mercado.

Defesas contra prompt injection: saídas de ferramenta são dados, não instruções; o servidor revalida valores e itens; limites e permissões ficam fora do alcance do modelo.

## 6. Fontes de preço (ordem de preferência)

1. **Parceria com mercado local** (API, planilha ou feed): melhor, mas ainda não existe.
2. **Preços colaborativos** informados por usuários.
3. **Cupom fiscal enviado pelo usuário** (QR Code → chave de acesso de 44 dígitos → consulta). A consulta pode ser feita via Infosimples (paga) — **formato de entrada ainda a confirmar com a conta de teste**.
4. **Leitura de catálogo público** de sites, respeitando robots.txt e termos, apenas leitura de preço (nunca login/checkout). Avaliar risco contratual antes.

Cada preço guarda fonte e data; preços velhos são sinalizados.

## 7. Cobrança da mensalidade

- Provedor: **Asaas** (Pix Automático com autorização e cobranças por API, webhooks de status).
- O dinheiro das compras **não** passa por essa conta.
- Planos sugeridos (a validar com custo real por usuário): gratuito (lista e comparação manual) e pago (agente recorrente). Preço só depois de medir custo de LLM e de consultas.

## 8. Segurança e privacidade

- Senhas e sessões pelo Supabase Auth; 2FA opcional, obrigatório se um dia houver alteração de limite alto.
- RLS em todas as tabelas; teste automatizado de acesso entre usuários.
- Segredos fora do repositório (variáveis de ambiente).
- LGPD: política de privacidade, base legal por finalidade, canal de atendimento ao titular, exclusão de dados, minimização (não guardar CPF de cupom sem necessidade).
- Registro de auditoria imutável das decisões do agente.
- Dependências e envio de dados a terceiros (LLM, Infosimples, Asaas) listados na política de privacidade.

## 9. Roadmap

0. **Validação (sem código):** entrevistar 10 a 15 famílias e 3 a 5 mercados. Perguntas: o que compram, onde, confiariam em delegar? Aceitariam enviar o cupom? Algum mercado dá catálogo/API?
1. **Fundação:** projeto Next.js + Supabase, login, RLS, modelo de dados, telas de lista e limite.
2. **Preços:** camada plugável com fonte manual/colaborativa; leitura de cupom.
3. **Agente recomendador:** ferramentas, motor de limites, tela de aprovação.
4. **Recorrência:** cron mensal + notificações.
5. **Mensalidade:** Asaas, webhooks, planos.
6. **Segurança e beta:** testes de abuso (estourar limite, injeção por nome de produto, acesso cruzado), LGPD, beta com 5 a 10 famílias.
7. **Decisão pós-beta:** parceria, pagamento ao mercado (com parecer jurídico), WhatsApp ou B2B.

## 10. Pendências abertas

| Item | Como fechar |
|---|---|
| Formato exato do parâmetro `nfce` da Infosimples | Criar conta de teste (R$ 100,00 de crédito) e ler a documentação da API |
| Termos de reuso/armazenamento de dados da Infosimples | Já lidos: não há proibição encontrada; confirmar por escrito se houver dúvida |
| Pix Automático no Pagar.me e no Mercado Pago | Documentação lida indica que não há; confirmar com o suporte, só se precisar |
| Enquadramento regulatório se um dia o fluxo mover dinheiro | Parecer de advogado especialista em pagamentos |
| Custo real por usuário (LLM + consultas) | Medir no protótipo |
| Fonte de preços em SP (sem base oficial encontrada) | Resultado da Fase 0 |

## 12. Rodando o MVP de teste

Requisitos: Node 24 (usa `node:sqlite`, sem dependências nativas).

```bash
npm install
# .env.local já tem AUTH_SECRET de desenvolvimento; para outro ambiente copie .env.example
npm run dev        # http://localhost:3000   (ou: npm run build && npm start)
npm test           # 19 testes do motor de limites e da comparação de preços
```

Roteiro de teste: criar conta → adicionar itens (ex.: arroz, feijão carioca, café, detergente) → ajustar limites → "Pedir ao agente" → conferir a proposta → aprovar ou recusar. Em `/precos` dá para registrar preços novos.

**Diferenças em relação ao desenho final (versão de teste):**

| Desenho (seções 3 a 8) | No MVP de teste |
|---|---|
| Supabase (Postgres + Auth + RLS) | SQLite local (`data/app.db`) e sessão por cookie assinado; isolamento por `user_id` nas consultas (testado) |
| Preços de parceiros / cupons | 3 mercados e 15 produtos **fictícios** (`source = demo`) + preços digitados por usuários |
| Agente com LLM | Ferramentas e fluxo reais, decisão por regras; se `ANTHROPIC_API_KEY` existir, o Claude só redige a justificativa (**essa chamada não foi testada**) |
| Cron mensal e e-mail | Não implementado: a proposta é gerada pelo botão |
| Cobrança da mensalidade (Asaas) | Não implementado |
| Leitura de cupom / Infosimples | Não implementado (formato de `nfce` ainda a confirmar) |
| Preço por unidade (kg, L) | Compara o preço da embalagem; produtos de tamanhos diferentes não são normalizados |

**O que já foi verificado em teste:** cadastro e login; senha com hash `scrypt`; bloqueio após 5 tentativas; cookie adulterado ou expirado rejeitado; rotas privadas redirecionam para o login; um usuário não vê nem aprova proposta de outro; limite por compra e mensal (inclusive acumulado); **revalidação do limite no momento da aprovação** (baixar o limite depois de gerar a proposta impede a aprovação); aprovação atômica e sem repetição.

**Limitações conhecidas:** o freio de tentativas de login fica na memória do processo; sem 2FA, sem recuperação de senha, sem confirmação de e-mail; sem exclusão de conta pela interface (LGPD: ainda precisa de canal e rotina); sem proteção CSRF além do que o Next.js já fornece para server actions; preços "demo" não representam mercados reais.

## 11. Como usar esta documentação

- Decisão técnica ou de negócio nova → ler a seção correspondente em [PESQUISAS.md](PESQUISAS.md), conferir o nível de confiança e o "Checklist de políticas".
- Se uma fonte mudar (norma, termos, API), atualizar PESQUISAS.md com a data e o link.
