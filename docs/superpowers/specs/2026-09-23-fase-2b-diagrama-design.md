# Fase 2B — Diagrama do Feature Model: desenho

Aprovado em 23/09/2026. Detalha a linha da Fase 2B da [SPEC](../../SPEC.md) §9 e o editor da §7, dentro do [ADR 0007](../../adr/0007-diagrama-com-layout-automatico.md).

## Objetivo

Trocar a árvore em lista da Fase 2A por um diagrama gráfico com layout automático, menu de contexto no nó, arrastar e soltar para mudar o pai de uma feature e subárvores recolhíveis. A aceitação da 2A continua valendo e agora é feita pelo diagrama.

**Não muda:**

- domínio, comandos, histórico e formato dos arquivos: toda edição continua sendo um comando do histórico;
- painel de propriedades, painel de restrições, diálogos e atalhos da 2A;
- a barra de ações acima da área da árvore (Filha, Irmã, ↑, ↓, Agrupar filhas…, Excluir…), que fica acima do diagrama.

**Fora desta fase:** o modo configuração do diagrama (Fase 3), os assets ancorados no painel (Fase 4), a barra lateral com as abas Modelo, Configurações e Assets (chega quando houver a segunda aba) e restrições desenhadas no diagrama (o ADR 0007 as deixa no painel).

## Abordagem escolhida

React Flow (`@xyflow/react`) para a tela e elkjs para o layout, como pede o ADR 0007. O **grupo é um nó próprio do React Flow**: um arco colado embaixo do pai, com a abertura exata das linhas até os membros. Assim a notação continua a clássica, e o arco é um alvo de soltar como qualquer nó.

Alternativas descartadas:

- **Grupo como nó de junção** entre o pai e os membros: a geometria fica mais simples, mas o arco sai do pai e as linhas ficam quebradas.
- **SVG próprio, sem React Flow:** contraria o ADR 0007 e obriga a fazer zoom e arrasto do zero.

## Aparência

- **Nó de feature:** caixa com o **nome** em destaque e o **ID** pequeno embaixo, em fonte monoespaçada. A feature selecionada tem destaque de cor.
- **Linhas:** retas, do centro da base do pai ao centro do topo de cada filha.
- **Variabilidade:** na ponta da linha, junto da filha:
  - círculo **cheio** = obrigatória;
  - círculo **vazio** = opcional;
  - sem círculo = membro de grupo.
- **Grupos:** o arco fica junto do pai e cruza as linhas até os membros:
  - arco **vazio** = alternative `[1..1]`;
  - arco **cheio** = or `[1..*]`;
  - nos demais grupos, arco vazio com o rótulo `[n..m]` ao lado (`*` quando não há máximo).
- **Botão de recolher:** fica na base do nó que tem filhas. Recolhido, o nó mostra `+N`, com N = quantidade de features escondidas na subárvore.
- **Controles:** aproximar, afastar e "ajustar à tela".

## Comportamento

### Layout

- É sempre calculado pelo elkjs, de cima para baixo. Nenhuma posição é salva (ADR 0007).
- A **ordem dos irmãos da esquerda para a direita é a ordem do modelo**. Ela tem significado: é a ordem das seções no produto gerado. Membros de um grupo ficam juntos, na posição do grupo entre os irmãos.
- O layout é refeito depois de cada edição, desfazer, refazer, recolher e expandir. Isso **não** mexe no zoom nem na posição da tela, com uma exceção: se a feature selecionada ficar fora da área visível (por exemplo, a que acabou de ser criada com Tab), a tela rola até ela, sem mudar o zoom.
- Se um cálculo de layout antigo terminar depois de um novo, o resultado dele é descartado.
- Ao abrir um projeto, o diagrama se ajusta à tela.

### Seleção

- Clicar num nó seleciona a feature (a seleção continua na store, como na 2A). O botão direito também seleciona antes de abrir o menu.
- Clicar no fundo do diagrama não muda a seleção.
- Arcos de grupo não são selecionáveis. A cardinalidade continua no painel de propriedades de um membro, como na 2A.
- Se a feature selecionada estiver dentro de uma subárvore recolhida (por exemplo, depois de desfazer), os ancestrais dela se expandem.

### Menu de contexto (botão direito no nó)

| Item                | Atalho | Desabilitado quando  |
| ------------------- | ------ | -------------------- |
| Adicionar filha…    | Tab    | —                    |
| Adicionar irmã…     | Enter  | é a raiz             |
| Agrupar filhas…     | —      | não há filhas soltas |
| Mover para cima     | Alt+↑  | é a raiz             |
| Mover para baixo    | Alt+↓  | é a raiz             |
| Recolher / Expandir | —      | não tem filhas       |
| Excluir…            | Delete | é a raiz             |

Cada item abre o mesmo diálogo ou roda o mesmo comando que o botão da barra ou o atalho equivalente.

### Arrastar e soltar

Arrastar um nó **muda o pai** da feature. Não serve para posicionar o nó (ADR 0007).

- **Só o nó arrastado acompanha o cursor.** A subárvore vai junto quando o movimento é aplicado. O arrasto só começa depois de alguns pixels, para não se confundir com o clique.
- **O alvo é o que está sob o cursor:**
  - uma feature: a arrastada vira a **última filha solta** dela;
  - um arco de grupo: a arrastada vira **membro** desse grupo.
- **Validade ao vivo:** o alvo fica com borda verde quando o movimento é válido e vermelha quando não é. A validade é exatamente a que o comando teria. O movimento é simulado por `executeCommand` com o comando `moveFeature`, sem entrar no histórico e conferido pelas mesmas regras (M1–M5, A1–A3).
- **Soltar num alvo válido** roda o comando `moveFeature`, que dá para desfazer com Ctrl+Z. A feature movida fica selecionada.
- **Soltar num alvo inválido** é recusado, e o motivo aparece no aviso "Edição recusada: …" da 2A. Exemplos: dentro da própria subárvore, ou num grupo em que ela já está.
- **Soltar fora de qualquer alvo** não faz nada.
- Em qualquer caso, o layout recoloca o nó no lugar.
- A raiz não pode ser arrastada.

### Teclado

- Os atalhos da 2A (Tab, Enter, F2, Delete, Alt+↑/↓, Ctrl+Z/Y, Ctrl+S) continuam os mesmos e continuam no nível da janela.
- As teclas próprias do React Flow ficam desligadas: Delete/Backspace para apagar, as setas para mover nós e a seleção múltipla. Assim nada passa por cima do diálogo de impacto nem dos comandos.

## Arquitetura

Tudo fica em `ui/`: o domínio e a aplicação não mudam. Os arquivos do diagrama ficam em `ui/diagram/` (SPEC §6.1).

| Unidade                                | Faz                                                                                                                                                                                                                                 | Depende de                            |
| -------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------- |
| `ui/diagram/diagram-graph.ts`          | Função pura: modelo + subárvores recolhidas → nós de feature (em pré-ordem, com tipo, `+N` e se pode recolher), grupos (pai, posição, membros, cardinalidade) e linhas (com o marcador de variabilidade). Sem React.                | `domain/`                             |
| `ui/diagram/diagram-layout.ts`         | Recebe o grafo e o tamanho de cada nó; chama o elkjs e devolve as posições. Calcula a geometria de cada arco (centro, raio, ângulos) a partir das posições do pai e dos membros.                                                    | `elkjs`, `diagram-graph`              |
| `ui/diagram/FeatureDiagram.tsx`        | Tela do React Flow: monta nós e linhas, refaz o layout, controla zoom e "ajustar à tela", sincroniza a seleção com a store e trata o arrasto.                                                                                       | `@xyflow/react`, store, os dois acima |
| `ui/diagram/FeatureNode.tsx`           | Caixa da feature com o menu de contexto. O elemento clicável mantém `data-feature-id`, como na lista, para os roteiros de verificação.                                                                                              | componente `context-menu`             |
| `ui/diagram/GroupArcNode.tsx`          | Desenha o arco (e o rótulo `[n..m]`) em SVG; é alvo de soltar.                                                                                                                                                                      | —                                     |
| `ui/diagram/VariabilityEdge.tsx`       | Linha reta com o círculo cheio ou vazio na ponta, ou sem círculo.                                                                                                                                                                   | `@xyflow/react`                       |
| `ui/components/ui/context-menu.tsx`    | Componente shadcn (Radix), com os textos em português.                                                                                                                                                                              | `radix-ui`                            |
| `ui/stores/project-store.ts`           | Ganha `collapsedFeatureIds` (só enquanto o projeto está aberto: zera ao abrir outro e não vai para o XML), `toggleCollapsed(id)` e `check(command)`, que simula o comando por `executeCommand` e devolve `null` (pode) ou o motivo. | `application/`                        |
| `ui/screens/project/ProjectScreen.tsx` | A área da esquerda vira coluna: avisos e barra de ações em cima, diagrama ocupando o resto. A `FeatureTree.tsx` é removida.                                                                                                         | —                                     |

Dependências novas: `@xyflow/react` (12.11) e `elkjs` (0.12). O componente `context-menu` do shadcn usa o `radix-ui`, que já está instalado. Depois de `npx shadcn add`, confira os imports e traduza os textos (armadilha registrada no handoff).

## Riscos a eliminar no protótipo (antes do plano)

1. **elkjs com a Content-Security-Policy do app.** A política `script-src 'self'` proíbe `eval` e workers de blob. O elkjs precisa rodar na versão empacotada (`elk.bundled.js`) dentro do `mdd.exe`.
2. **Ordem dos irmãos.** Escolher o algoritmo do ELK e as opções que garantem a ordem do modelo da esquerda para a direita em todos os níveis, inclusive com grupos.
3. **Tamanho dos nós.** O layout precisa do tamanho de cada caixa, que depende do nome. Escolher entre medir depois de desenhar (duas passadas) ou estimar pelo texto, sem sobrepor nós.
4. **Arrasto sobre o arco.** Confirmar que dá para achar o nó sob o cursor durante o arrasto (feature ou arco), ignorando o próprio nó arrastado.

O plano da fase só é escrito com essas respostas, e contém o código já verificado.

## Verificação

Sem testes automatizados (ADR 0008).

- **Checagens de sempre:** `npm run typecheck`, `npm run lint`, `npm run build`, com Prettier antes de cada commit.
- **Grafo e layout:** script descartável em `.checks/`, rodado com `npx tsx`, sobre `docs/examples/loja-online`. Confere:
  - os nós em pré-ordem;
  - os marcadores das linhas (`catalogo` e `pagamento` cheios; `busca` e `mobile` vazios; membros sem círculo);
  - o grupo or de `pagamento` com os três membros;
  - a ordem da esquerda para a direita em cada nível;
  - que nenhum nó se sobrepõe;
  - o `+N` ao recolher `pagamento`.
- **Roteiro da interface** (protocolo de depuração do Chromium, com entrada real e emulação de foco), no `mdd.exe` empacotado. Os diálogos nativos são respondidos pelo inspetor do main, como na aceitação da 2A:
  1. Criar o projeto e **recriar o exemplo** usando o diagrama: menu de contexto para criar filhas e irmãs, o grupo pelo menu, e pelo menos um movimento por arrastar e soltar (por exemplo, criar `Boleto` fora de Pagamento e soltá-lo sobre o arco do grupo). Salvar e conferir com `cmp` que o arquivo é idêntico ao exemplo.
  2. **Arrasto inválido:** soltar `pagamento` sobre `pag_pix` (dentro da própria subárvore) mostra a recusa, e nada muda.
  3. **Excluir `pag_pix` pelo menu de contexto** mostra 1 restrição, 2 assets e 1 configuração; Ctrl+Z restaura tudo.
  4. **Recolher e expandir** `pagamento`: os membros somem e aparece `+3`; ao expandir, eles voltam. Desfazer uma edição dentro da subárvore recolhida expande os ancestrais da feature selecionada.
  5. O roteiro `ui-check.mjs` da 2A, ajustado à nova aparência. O texto do nó não tem mais o marcador ●/○, que passou para a linha; as ações são as mesmas.
- **Aceitação da fase (SPEC §9):** a aceitação da 2A, feita pelo diagrama (itens 1 e 3 acima), mais a confirmação ao fechar e os recentes, como na 2A.
