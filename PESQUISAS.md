# Pesquisas realizadas (referência de decisão)

Data da pesquisa: 03/11/2026. Projeto: agente de compras para famílias (MVP B2C), ver [README.md](README.md).

**Como ler**
- **Confiança:** `OFICIAL` = li o texto da norma ou da documentação do próprio fornecedor. `SECUNDÁRIA` = blog, escritório de advocacia, artigo ou fornecedor terceiro. `INFERÊNCIA` = dedução minha, não escrita na fonte. `NÃO CONFIRMADO` = não consegui verificar.
- Isto **não é parecer jurídico**. Onde há risco regulatório, confirme com advogado.
- Preços, normas e termos mudam. Reconfira antes de decisões caras.

---

## 1. Resumo de decisões

| # | Decisão | Base |
|---|---|---|
| 1 | Só B2C no MVP | Escolha do usuário |
| 2 | Agente propõe; usuário aprova; sem ferramenta de pagamento | OWASP (privilégio mínimo, humano no circuito) + regulação |
| 3 | Dinheiro das compras fora do nosso fluxo | Resoluções BCB 80, 494 e Conjunta 14 (seção 3) |
| 4 | Mensalidade via Asaas | Documentação oficial do Asaas (seção 4) |
| 5 | Preços: colaborativo + cupom do usuário; scraping só de leitura | Seções 5 e 6 |
| 6 | WhatsApp fica fora do MVP | Política da Meta (seção 9) |
| 7 | Stack: Next.js + Supabase, LLM direto | Simplicidade para uma pessoa |

---

## 2. Críticas ao plano inicial (Gemini)

| Ponto do plano | Avaliação |
|---|---|
| Stack NestJS + Python + Redis + LangChain | Pesada para um MVP. Monolito Next.js + Supabase basta. |
| "Token de cartão com limite" no gateway | Não existe limite imposto pelo gateway. **Limites precisam ser aplicados por nós, em código.** |
| Scraping/RPA como "alternativa simples" | Frágil e arriscado (termos de uso); automatizar login/checkout de terceiros é bem pior que ler preços. |
| Agente que paga | Exige parceria ou licença (seção 3). |
| Preços de plano (R$ 29,90 / R$ 199) | Palpites. Calcular custo por usuário primeiro. |
| B2B de estoque | Previsão de estoque é estatística clássica, não LLM; o valor depende de integrar PDV/ERP (fechado). Adiado. |

---

## 3. Regulação de pagamentos (Banco Central)

**Pergunta:** podemos receber o dinheiro do usuário e repassar ao mercado?

### Resolução BCB nº 80/2021, art. 3º (via cópia no LegisWeb; `OFICIAL`, conferir no DOU)
- **Iniciador de transação de pagamento:** instituição de pagamento que presta iniciação "sem gerenciar conta de pagamento" e "sem deter em momento algum os fundos transferidos".
- **Credenciador:** habilita recebedores a aceitar instrumento de pagamento e participa da liquidação como credor perante o emissor.
- **Emissor de moeda eletrônica:** gerencia conta de pagamento pré-paga do usuário; exige lastro dos saldos (art. 22).
- Art. 2º: exclui arranjos de propósito limitado e programas de benefícios.

### Resolução BCB nº 494/2025 (`OFICIAL`)
- Art. 9º (nova redação): toda instituição de pagamento deve solicitar autorização antes de iniciar o serviço, incluindo todas as modalidades que pretende oferecer. Não achei dispensa por volume.
- Art. 9º-A: quem já operava sem autorização tinha de pedir entre 01/05/2026 e 31/05/2026 (janela encerrada).

### Resolução Conjunta nº 14/2025, capital mínimo (`OFICIAL`, texto lido no site do BC; versão vigente atualizada em 27/04/2026)
- Limite mínimo = **custo + atividades** (art. 8º).
- **Custo:** R$ 2 milhões × nº de categorias de atividade comunicadas; + R$ 5 milhões se prestar serviços intensivos em tecnologia (cada serviço adicional +50%, teto R$ 10 milhões).
- **Atividades:** (soma dos valores das categorias operacionais + valor da categoria de investimento) × fator de captação.
  - Operacional: serviços R$ 1 mi; custódia R$ 3 mi; **intermediação R$ 5 mi**; concessão R$ 7 mi.
  - Investimento: restrito R$ 5 mi; livre R$ 8 mi.
  - Captação: recursos próprios 60%; institucionais 80%; público exceto depósitos 120%; depósitos 200%.
- Adicional de R$ 30 milhões para uso da palavra "banco" (art. 11).
- Transição (art. 12): só para instituições em funcionamento ou com pedido protocolado antes da vigência. Regra antiga até 30/06/2026; depois 25% da diferença (até dez/2026), 50% (até jun/2027), 75% (até dez/2027); integral em 2028. **Quem pede autorização agora não está na transição.**
- Art. 4º: **intermediação** = serviços que "envolvam fluxo de dinheiro ou outro ativo financeiro, exceto os prestados por conta e ordem de terceiro"; **serviços** = os demais.
- Resolução BCB 517 (`OFICIAL`, via LegisWeb): classifica iniciação de pagamento em "serviços"; moeda eletrônica, pagamentos e transferências e credenciamento em "intermediação"; pós-pago em "concessão".

### Ordem de grandeza (cálculo meu, `INFERÊNCIA`)
Com investimento "restrito" e captação por recursos próprios (60%): só iniciação ≈ R$ 5,6 mi; credenciador ou moeda eletrônica ≈ R$ 8 mi (≈ R$ 13 mi se contar como serviço intensivo em tecnologia). A classificação real de investimento e captação depende de regulamentação que não li. Uma fonte secundária cita faixa de R$ 9,2 a 32,8 milhões; não aparece no texto lido.

### Conclusão e regra de decisão
- **Não receber nem custodiar o dinheiro das compras.** O usuário paga ao mercado.
- Se o produto passar a mover dinheiro de terceiros: **parar e obter parecer de advogado de pagamentos** antes de qualquer código.
- Em aberto: o enquadramento exato de um fluxo específico é classificação do Banco Central (`NÃO CONFIRMADO`, depende de advogado).

---

## 4. Provedores de pagamento (para a mensalidade)

| Provedor | Pix Automático / recorrência | Confiança |
|---|---|---|
| **Asaas** | Sim. Cria autorização (frequência semanal, mensal ou trimestral, valor fixo opcional), cobranças via API com `pixAutomaticAuthorizationId`, webhooks. A autorização só fica ativa após o 1º pagamento (jornada 3). Sandbox: não confirmado. | `OFICIAL` |
| **Mercado Pago** | API de assinatura exige `card_token_id` (cartão). A visão geral cita Pix entre meios de pagamento do fluxo hospedado, mas **sem mandato nem valor máximo documentados**. O blog oficial (13/08/2026) não diz que o plano de assinaturas usa Pix Automático. Itens do changelog (36 páginas) não trazem Pix Automático. | `OFICIAL` (docs e blog) |
| **Pagar.me** | Documentação oficial: assinaturas aceitam cartão e boleto; "Pix: não disponível para recorrência". Pix apenas avulso. | `OFICIAL` |
| **Stripe** | Documentação e suporte dizem que o Pix Automático **não está disponível para empresas domiciliadas no Brasil** (só Pix avulso em BRL). A página-guia do Pix Automático não menciona essa restrição. | `OFICIAL` (docs e suporte) |
| Cielo | Pix Automático documentado; sem sandbox, segundo a documentação (pode estar desatualizado). | `OFICIAL` |

**Regras de Pix Automático** (`SECUNDÁRIA`, fornecedores e imprensa; o guia do BC não foi lido na íntegra): o pagador autoriza no app do banco e define valor máximo; cobrança acima do teto não é agendada; o pagador pode cancelar até 23h59 do dia anterior; devolução em até 80 dias pelo mecanismo especial. Recebedor precisa ser instituição de pagamento ou operar sob a licença de um provedor.

**Decisão:** usar o Asaas. Cartão tokenizado como alternativa (o token fica no provedor, nunca no nosso banco).

---

## 5. Fontes de preço

### Base oficial por nota fiscal
- Apps "Menor Preço" (RS/"Menor Preço Brasil", PR, ES) usam preços das NFC-e. `SECUNDÁRIA` (notícias dos governos).
- **São Paulo:** não achei base oficial agregada de preços. A consulta pública da SEFAZ-SP é nota a nota: exige **chave de acesso de 44 caracteres + captcha** (`OFICIAL`, formulário conferido).
- Um post de blog afirma que a API do Menor Preço-PR proíbe uso automatizado: `NÃO CONFIRMADO`.
- Projeto aberto de referência: "Esse Era o Preço" (preços de notas enviadas por usuários). Política de privacidade/licença dos dados do projeto ainda indefinida, segundo o repositório.

### Infosimples (consulta de NFC-e SP)
- Parâmetro `nfce`; fonte = consulta pública da SEFAZ-SP (`OFICIAL`, página pública).
- **Formato do parâmetro (chave de 44 dígitos ou URL do QR Code): `NÃO CONFIRMADO`.** A API unificada de NFC-e aceita qualquer UF com um único `nfce` (`INFERÊNCIA`: consistente com a chave, cujos 2 primeiros dígitos identificam a UF). A documentação da API é autenticada (login). Pendência: criar conta de teste.
- Preço: serviço SEFAZ/SP/NFC-e com adicional de **R$ 0,04** por consulta (`OFICIAL`, página de preços). Faixa base de exemplo R$ 0,20 (1 a 500 consultas) → **≈ R$ 0,24** no início (`INFERÊNCIA` sobre a soma). Franquia mínima R$ 100,00/mês; pré-pago; crédito de teste R$ 100,00 por até 30 dias.
- Dados retornados: produtos (descrição, quantidade, valor unitário, EAN, NCM), emitente, totais; também campos de CPF/CNPJ do destinatário (dado pessoal a tratar).

### Termos da Infosimples (PDFs lidos por inteiro: Gerais de 22/09/2026 e Específicos de 21/08/2026)
- 3.7 (Gerais): o cliente pode "desenvolver e comercializar soluções próprias [...] incluindo soluções que usam dados provenientes da Plataforma".
- 4.2 (Gerais): usar os dados só para "propósitos lícitos e para as finalidades de uso informadas no momento da aceitação" → **declarar a finalidade real** (validar cupom enviado pelo usuário para comparar preços).
- 1.5 e 1.6 (Específicos), 12.4 e 8.6 (Gerais): o cliente declara ter obtido os dados de entrada de forma lícita, com as autorizações da LGPD.
- 12.5 (Gerais): autorização irrevogável para a Infosimples usar dados pessoais enviados → refletir na política de privacidade.
- 7.1(g): proíbe uso que desrespeite privacidade. 15.5(b): podem suspender sem aviso se o modelo de negócio não estiver "alinhado" às diretrizes deles.
- 14.1: multa de 50% da média mensal por descumprimento. 15.1/15.2: 12 meses com renovação automática; aviso de 30 dias.
- Não encontrei cláusula proibindo armazenar ou comparar preços (busca por palavras-chave e leitura das cláusulas relevantes).

### Scraping e legalidade
- Sem lei brasileira específica sobre web scraping (`SECUNDÁRIA`: artigos de escritórios). Preço de produto não é dado pessoal; o risco está em **termos de uso** (sem jurisprudência clara encontrada) e em coletar dados pessoais.
- **Regra:** só leitura de preços públicos, respeitando robots.txt e termos; nunca automatizar login/checkout de terceiros.

---

## 6. Parcerias com supermercados

- Rappi tem portal de desenvolvedores para parceiros aprovados (integração de ERP de lojistas, `SECUNDÁRIA` sobre escopo). Não é para app de terceiro comprar pelo consumidor.
- iFood Mercado: não achei API pública de pedidos.
- **Nenhum programa aberto** encontrado. Parceria é negociada caso a caso e depende da Fase 0.
- Concorrentes de comparação de preços já existem (BoaLista, Facilista, ClickSuper, MeuCarrinho, entre outros). A diferença do produto: o agente que **executa a rotina recorrente**, não só compara.

---

## 7. LGPD

- **Encarregado (Resolução CD/ANPD 18/2024):** agentes de pequeno porte, incluindo startups, são dispensados de nomear encarregado, mas **devem manter canal de comunicação com o titular** (art. 11 da Res. 2/2022). A dispensa não vale em tratamento de alto risco, e não dispensa as demais obrigações (`SECUNDÁRIA` sobre exceções; ler a norma).
- **Decisões automatizadas (art. 20):** direito de pedir revisão; o veto de 2019 manteve a revisão não necessariamente humana (Serpro). A regulamentação específica da ANPD **ainda não foi publicada** (Nota Técnica 12/2025; previsão de 2026-2027 é projeção de terceiros). Estado atual: `NÃO CONFIRMADO` além disso.
- **Aplicação ao projeto:** o agente só propõe e o usuário aprova (risco menor), mas registrar entrada, critério e resultado de cada proposta. CPF de cupom: não guardar sem necessidade; base legal e finalidade na política de privacidade.
- PL 2338/2023 (marco da IA): sem fonte atual de tramitação (`NÃO CONFIRMADO`).

---

## 8. Segurança do agente (OWASP LLM)

- Prompt injection indireto: qualquer texto lido pelo modelo (ex.: nome de produto em um site) pode conter instruções. O modelo não separa instruções de dados.
- Mitigações: privilégio mínimo; controles na **camada de ferramentas e APIs**, não no prompt; confirmação humana para ações de alto impacto; revalidação de valores no servidor.
- **Implicação:** sem ferramenta de pagamento; motor de limites determinístico; saídas de ferramenta tratadas como dados.

---

## 9. WhatsApp

- Desde 15/01/2026 a Meta proíbe chatbots de IA **de uso geral** na API do WhatsApp Business. Bots de suporte, vendas e notificações continuam permitidos (`SECUNDÁRIA`: imprensa e respond.io). A fronteira para "agente de compras" não é clara.
- **Decisão:** MVP usa e-mail e painel web. WhatsApp só depois de ler os termos atuais da Meta.

---

## 10. Custos de IA

- Documentação oficial do Claude Opus 5.5: entrada US$ 4 / saída US$ 20 por milhão de tokens; escrita de cache de 5 min US$ 5, de 1 h US$ 8; leitura de cache US$ 0,20 (`OFICIAL`).
- Sonnet 5.5 US$ 2/US$ 10 e Haiku 5.5 a partir de US$ 0,10/US$ 0,50: a página oficial os lista; fontes secundárias concordam, com divergência no preço de leitura de cache do Sonnet (`SECUNDÁRIA`). Haiku tem faixa mais cara acima de 100 mil tokens de contexto (`SECUNDÁRIA`).
- **Decisão:** modelo pequeno com prompt de sistema e ferramentas em cache; **medir o custo por proposta no protótipo** antes de fixar preço de plano.

---

## 11. Checklist de políticas (usar antes de decidir)

| Pergunta | Se "sim" | Referência |
|---|---|---|
| A mudança faz o dinheiro das compras passar por nós, ou guardar saldo do usuário? | Parar. Parecer jurídico e possível autorização do BC. | Seção 3 |
| O agente ganhou ferramenta de pagamento, login em mercado ou envio de dinheiro? | Reverter, ou exigir aprovação humana e motor de limites. | Seções 2 e 8 |
| Vamos guardar dados de cartão? | Não. Usar só token do provedor. | Seção 4 |
| Vamos coletar CPF/dados pessoais (ex.: de cupom)? | Definir base legal, finalidade e prazo de retenção; atualizar política de privacidade. | Seção 7 |
| Vamos enviar dados pessoais a terceiros (LLM, Infosimples, Asaas)? | Listar na política de privacidade. | Seções 5 e 7 |
| Vamos usar nova fonte de preço por scraping? | Ler termos e robots.txt; só leitura; sem login/checkout. | Seção 5 |
| A finalidade de uso na Infosimples mudou? | Atualizar a finalidade declarada (cláusula 4.2). | Seção 5 |
| Vamos usar WhatsApp? | Ler os termos atuais da Meta sobre IA. | Seção 9 |
| Vamos trocar de provedor de cobrança? | Verificar se o Pix Automático é suportado para empresa brasileira. | Seção 4 |
| O agente toma decisão que afeta o usuário? | Registrar entrada/critério/resultado; canal de revisão. | Seção 7 |

---

## 12. Pendências (o que não consegui fechar)

| Item | Por quê | Como fechar |
|---|---|---|
| Formato do `nfce` da Infosimples e exemplos de requisição | Documentação da API exige conta de cliente (login). O usuário decidiu deixar para depois. | Criar conta de teste e ler a documentação |
| Preço exato do serviço NFC-e SP na tabela progressiva | Só vi o adicional (R$ 0,04) e a faixa base de exemplo | Calculadora da Infosimples após cadastro |
| Pix Automático no Pagar.me e no Mercado Pago (API) | Documentação lida não indica suporte | Perguntar ao suporte, se o provedor interessar |
| Enquadramento regulatório de um fluxo que mova dinheiro | Classificação do Banco Central; depende do desenho | Advogado de pagamentos |
| Classificação de investimento e captação para instituições de pagamento | Regulamentação específica não lida | Advogado / BC |
| Base de preços oficial em SP | Não encontrada | Fase 0 e fontes colaborativas |
| Texto de normas via fonte oficial (Res. 80 e 494) | Li cópia de terceiro (LegisWeb); só a Conjunta 14 foi lida no site do BC | Conferir no DOU |
| Regulamentação da ANPD sobre IA e art. 20 | Ainda não publicada | Acompanhar a agenda regulatória da ANPD |

---

## 13. Fontes

**Banco Central e normas**
- [Resolução Conjunta 14/2025 (site do BC)](https://www.bcb.gov.br/estabilidadefinanceira/exibenormativo?tipo=Resolu%C3%A7%C3%A3o%20Conjunta&numero=14)
- [Resolução BCB 80/2021 consolidada (LegisWeb)](https://www.legisweb.com.br/legislacao/?id=411674)
- [Resolução BCB 494/2025 (LegisWeb)](https://www.legisweb.com.br/legislacao/?id=483156)
- [Resolução BCB 517/2025 (LegisWeb)](https://www.legisweb.com.br/legislacao/?id=485891)
- [Capital mínimo, Resoluções 14 e 517 (NDM Advogados)](https://ndmadvogados.com.br/artigo/mudancas-no-capital-minimo-das-instituicoes-autorizadas/)
- [Guia de implementação do Pix Automático (BC)](https://www.bcb.gov.br/content/estabilidadefinanceira/pix/automatico/guia_pix_automatico.pdf)

**Pagamento**
- [Pix Automático (Asaas)](https://docs.asaas.com/docs/pix-automatico)
- [Pix Automático, implementação (Asaas)](https://docs.asaas.com/docs/pix-automatico-implementacao)
- [Assinaturas com plano associado (Mercado Pago)](https://www.mercadopago.com.br/developers/pt/docs/subscriptions/integration-configuration/subscription-associated-plan)
- [Visão geral de Assinaturas (Mercado Pago)](https://www.mercadopago.com.br/developers/pt/docs/subscriptions/overview)
- [Blog: Pix para cobrar mensalidades (Mercado Pago)](https://www.mercadopago.com.br/blog/pix-cobrar-mensalidades-recorrentes-automatico)
- [Checkout de assinatura (Pagar.me)](https://docs.pagar.me/docs/checkout_pagarme_skill_subscription.md)
- [Pix (Stripe)](https://docs.stripe.com/payments/pix)
- [Suporte Stripe: Pix no Brasil](https://support.stripe.com/questions/how-to-enable-pix-as-a-payment-method-in-brazil)
- [Pix Automático (Cielo)](https://docs.cielo.com.br/gateway/docs/pix-automatico)

**Preços e notas fiscais**
- [Consulta pública NFC-e, SEFAZ-SP](https://www.nfce.fazenda.sp.gov.br/NFCeConsultaPublica/Paginas/ConsultaPublica.aspx)
- [Infosimples, API SEFAZ/SP/NFC-e](https://infosimples.com/consultas/sefaz-sp-nfce/)
- [Infosimples, API unificada de NFC-e](https://infosimples.com/consultas/sefaz-nfce/)
- [Infosimples, preços](https://infosimples.com/consultas/precos/)
- [Infosimples, termos](https://infosimples.com/termos/)
- [Menor Preço, Nota Fiscal Gaúcha](https://nfg.sefaz.rs.gov.br/site/MenorPreco.aspx)
- [Dados abertos da SEFAZ-SP](https://www.sfp.sp.gov.br/sefaz/transparencia/dados/dados-abertos/)
- [Esse Era o Preço (GitHub)](https://github.com/uJeFFF/essaeraopreco)

**LGPD e segurança**
- [Resolução CD/ANPD 18/2024](https://www.tjba.jus.br/extrajudicial/wp-content/uploads/2024/08/RESOLUCAO-ANPD-No-18-Encarregado-de-Dados.pdf)
- [Agentes de pequeno porte (Confidata)](https://confidata.com.br/blog/lgpd-pequenas-empresas-resolucao-pequeno-porte)
- [Art. 20 da LGPD (Serpro)](https://serpro.gov.br/lgpd/noticias/2019/congresso-aprecia-veto-ao-artigo-20-da-lgpd)
- [ANPD e regulação de IA 2026-2027 (Confidata)](https://confidata.com.br/blog/anpd-regulacao-ia-brasil-2026-2027)
- [Web scraping e LGPD (JUS)](https://jus.com.br/artigos/87950/web-sscraping-na-lei-geral-protecao-de-dados-pessoais)
- [OWASP LLM01 Prompt Injection](https://genai.owasp.org/LLM01/)

**Outros**
- [Política de chatbots do WhatsApp (respond.io)](https://respond.io/blog/whatsapp-chatbot-policy-2026)
- [Claude Opus 5.5, documentação oficial](https://platform.claude.com/docs/en/models/opus-5-5/overview)
- [Portal do desenvolvedor Rappi](https://dev-portal.dev.rappi.com/)
