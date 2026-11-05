# Graph Report - Agente  (2026-11-05)

## Corpus Check
- Corpus is ~45,866 words - fits in a single context window. You may not need a graph.

## Summary
- 504 nodes · 1416 edges · 13 communities (12 shown, 1 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 8 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- Community 0
- Community 1
- Community 2
- Community 3
- Community 4
- Community 5
- Community 6
- Community 7
- Community 8
- Community 9
- Community 10
- Community 11
- Community 12

## God Nodes (most connected - your core abstractions)
1. `execute()` - 25 edges
2. `audit()` - 24 edges
3. `Painel()` - 23 edges
4. `runAgent()` - 22 edges
5. `getSettings()` - 22 edges
6. `brl()` - 20 edges
7. `can()` - 19 edges
8. `run()` - 18 edges
9. `requireUser()` - 17 edges
10. `listStores()` - 17 edges

## Surprising Connections (you probably didn't know these)
- `AppLayout()` --calls--> `getSettings()`  [EXTRACTED]
  app/(app)/layout.tsx → lib/db-painel.ts
- `Painel()` --calls--> `requireUser()`  [EXTRACTED]
  app/(app)/painel/page.tsx → lib/auth.ts
- `Painel()` --calls--> `listItems()`  [EXTRACTED]
  app/(app)/painel/page.tsx → lib/db.ts
- `Painel()` --calls--> `listProposals()`  [EXTRACTED]
  app/(app)/painel/page.tsx → lib/db.ts
- `Painel()` --calls--> `getSettings()`  [EXTRACTED]
  app/(app)/painel/page.tsx → lib/db-painel.ts

## Import Cycles
- None detected.

## Communities (13 total, 1 thin omitted)

### Community 0 - "Community 0"
Cohesion: 0.06
Nodes (74): Aba, ABAS, metadata, Painel(), SUGESTOES, Bloqueado(), Proposta(), SecaoLista() (+66 more)

### Community 1 - "Community 1"
Cohesion: 0.08
Nodes (65): addMovement(), buyProposal(), changeSchedule(), chooseStore(), clearConversation(), createSchedule(), decideSubstitution(), go() (+57 more)

### Community 2 - "Community 2"
Cohesion: 0.05
Nodes (50): AgentResult, deterministicText(), explainWithClaude(), runAgent(), Step, all(), DEMO_PRICES, DEMO_QUALITY (+42 more)

### Community 3 - "Community 3"
Cohesion: 0.07
Nodes (49): AgenteSurreal(), CenaNeural(), Base(), CabecalhoDeSecao(), Esfera(), Orbe(), Saida(), tamanho() (+41 more)

### Community 4 - "Community 4"
Cohesion: 0.11
Nodes (37): addListItem(), decide(), generateProposal(), go(), login(), logout(), signup(), submitPrice() (+29 more)

### Community 5 - "Community 5"
Cohesion: 0.11
Nodes (25): Campo(), CenaDoAgente(), Dados(), Enviar(), IconeDoCampo(), ICONES, Mensagem(), MENSAGENS (+17 more)

### Community 6 - "Community 6"
Cohesion: 0.12
Nodes (23): GET(), listItems(), listSchedules(), markScheduleRun(), toSchedule(), usersWithActiveSchedules(), initialLastRunMonth(), isDue() (+15 more)

### Community 7 - "Community 7"
Cohesion: 0.09
Nodes (27): dependencies, next@^16.4.4, react@^19.3.1, react-dom@^19.3.1, devDependencies, tailwindcss@^4.3.4, @tailwindcss/postcss@^4.3.4, @types/node@^26.6.6 (+19 more)

### Community 8 - "Community 8"
Cohesion: 0.13
Nodes (22): aleatorio(), BaseDaLigacao, BRANCO, Broto, caixasDeTexto(), CIANO, Cor, criarBrilho() (+14 more)

### Community 9 - "Community 9"
Cohesion: 0.10
Nodes (19): compilerOptions, allowImportingTsExtensions, allowJs, esModuleInterop, incremental, isolatedModules, jsx, lib (+11 more)

### Community 10 - "Community 10"
Cohesion: 0.20
Nodes (14): Conversa(), Digitado(), Mensagem, Rico(), ConstrutorDeReconhecimento, construtorDoReconhecimento(), escolherVoz(), EventoDeResultado (+6 more)

### Community 11 - "Community 11"
Cohesion: 0.12
Nodes (14): claude, ClaudeBlock, Conversation, gemini, GeminiPart, HistoryMessage, Json, ModelCall (+6 more)

## Knowledge Gaps
- **1 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `next` connect `Community 5` to `Community 0`, `Community 1`, `Community 3`, `Community 4`, `Community 7`, `Community 10`?**
  _High betweenness centrality (0.209) - this node is a cross-community bridge._
- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.06442577030812324 - nodes in this community are weakly interconnected._
- **Why does `react` connect `Community 3` to `Community 0`, `Community 5`, `Community 7`, `Community 8`, `Community 10`?**
  _High betweenness centrality (0.142) - this node is a cross-community bridge._
- **Should `Community 1` be split into smaller, more focused modules?**
  _Cohesion score 0.07887323943661972 - nodes in this community are weakly interconnected._
- **Why does `Conversa()` connect `Community 10` to `Community 0`, `Community 3`?**
  _High betweenness centrality (0.015) - this node is a cross-community bridge._
- **Should `Community 2` be split into smaller, more focused modules?**
  _Cohesion score 0.05110809588421529 - nodes in this community are weakly interconnected._
- **Should `Community 3` be split into smaller, more focused modules?**
  _Cohesion score 0.07168458781362007 - nodes in this community are weakly interconnected._